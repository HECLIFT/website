#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LIFT Tracker Admin — local dashboard server.

Usage:
    python scripts/tracker_admin.py          # starts on http://localhost:4242
    python scripts/tracker_admin.py --port 8080

Opens a browser with a visual dashboard showing tracker status, staleness,
and step-by-step update guides.

Does NOT modify any production files except when you explicitly click
"Finaliser" (which only bumps last_updated in the .qmd frontmatter).
"""

import argparse
import cgi
import json
import os
import re
import shutil
import sys
import unicodedata
import webbrowser
from datetime import datetime, timedelta
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent  # website_oift/
MANIFEST_PATH = ROOT / "tracker_manifest.json"
DASHBOARD_HTML = SCRIPT_DIR / "admin_dashboard.html"

# ---------------------------------------------------------------------------
# Manifest & frontmatter helpers
# ---------------------------------------------------------------------------

def load_manifest():
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def read_frontmatter_field(qmd_path, field):
    """Read a single field from YAML frontmatter."""
    try:
        with open(qmd_path, "r", encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        return None

    m = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
    if not m:
        return None

    for line in m.group(1).splitlines():
        if line.strip().startswith(f"{field}:"):
            val = line.split(":", 1)[1].strip().strip('"').strip("'")
            return val
    return None


def update_frontmatter_field(qmd_path, field, new_value):
    """Update a single field in YAML frontmatter. Returns True on success."""
    try:
        with open(qmd_path, "r", encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        return False

    # Match the frontmatter field line and replace its value
    pattern = re.compile(
        rf'^({field}\s*:\s*)(".*?"|\'.*?\'|.*?)$',
        re.MULTILINE,
    )

    new_line = f'{field}: "{new_value}"'
    new_text, count = pattern.subn(new_line, text, count=1)

    if count == 0:
        return False

    with open(qmd_path, "w", encoding="utf-8") as f:
        f.write(new_text)
    return True


# ---------------------------------------------------------------------------
# Status computation
# ---------------------------------------------------------------------------

def compute_tracker_status(tracker_id, tracker_conf):
    """Compute live status for a single tracker."""
    page_path = ROOT / tracker_conf["page"]
    data_dir = ROOT / tracker_conf["data_dir"]

    # Read last_updated from frontmatter
    last_updated_str = read_frontmatter_field(page_path, "last_updated")
    last_updated = None
    if last_updated_str:
        try:
            last_updated = datetime.strptime(last_updated_str, "%Y-%m-%d")
        except ValueError:
            pass

    # Staleness
    staleness = "unknown"
    days_since = None
    days_overdue = None
    freq_days = tracker_conf.get("frequency_days")

    if last_updated and freq_days:
        days_since = (datetime.now() - last_updated).days
        expected_next = last_updated + timedelta(days=freq_days)
        days_overdue = (datetime.now() - expected_next).days

        if days_overdue > 30:
            staleness = "overdue"
        elif days_overdue > 0:
            staleness = "due_soon"
        else:
            staleness = "ok"
    elif tracker_conf["frequency"] == "À venir":
        staleness = "upcoming"

    # Check data files
    expected = tracker_conf.get("expected_files", [])
    present_files = []
    missing_files = []
    for fname in expected:
        fpath = data_dir / fname
        if fpath.exists():
            present_files.append(fname)
        else:
            missing_files.append(fname)

    # Check source availability
    source_dir = tracker_conf.get("source_output_dir")
    source_available = False
    source_files_found = 0
    if source_dir:
        source_path = ROOT / source_dir
        if source_path.is_dir():
            source_available = True
            for fname in expected:
                if fname not in tracker_conf.get("static_files", []):
                    if (source_path / fname).exists():
                        source_files_found += 1

    return {
        "id": tracker_id,
        "name": tracker_conf["name"],
        "section": tracker_conf["section"],
        "frequency": tracker_conf["frequency"],
        "frequency_days": freq_days,
        "last_updated": last_updated_str or "",
        "days_since_update": days_since,
        "days_overdue": days_overdue,
        "staleness": staleness,
        "data_files_expected": len(expected),
        "data_files_present": len(present_files),
        "data_files_missing": missing_files,
        "source_available": source_available,
        "source_files_found": source_files_found,
        "pipeline": tracker_conf.get("pipeline", []),
    }


def compute_all_status():
    manifest = load_manifest()
    results = []
    for tid, tconf in manifest["trackers"].items():
        results.append(compute_tracker_status(tid, tconf))
    return results


# ---------------------------------------------------------------------------
# Simple validation (reuses logic from build_tracker_data.py concepts)
# ---------------------------------------------------------------------------

def validate_tracker_data(tracker_id):
    """Quick validation of a tracker's data files. Returns list of issues."""
    manifest = load_manifest()
    tconf = manifest["trackers"].get(tracker_id)
    if not tconf:
        return [{"level": "error", "message": f"Tracker inconnu: {tracker_id}"}]

    data_dir = ROOT / tconf["data_dir"]
    issues = []

    for fname in tconf.get("expected_files", []):
        fpath = data_dir / fname
        if not fpath.exists():
            issues.append({"level": "error", "message": f"Fichier manquant: {fname}"})
            continue

        # CSV basic checks
        if fname.endswith(".csv"):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                if len(lines) < 2:
                    issues.append({"level": "warning", "message": f"{fname}: moins de 2 lignes"})
                else:
                    header_cols = len(lines[0].strip().split(","))
                    for i, line in enumerate(lines[1:6], start=2):
                        row_cols = len(line.strip().split(","))
                        if row_cols != header_cols:
                            issues.append({
                                "level": "warning",
                                "message": f"{fname} ligne {i}: {row_cols} colonnes (attendu {header_cols})"
                            })
                    issues.append({
                        "level": "info",
                        "message": f"{fname}: {len(lines)-1} lignes, {header_cols} colonnes"
                    })
            except Exception as e:
                issues.append({"level": "error", "message": f"{fname}: erreur lecture — {e}"})

        # JSON basic checks
        elif fname.endswith(".json"):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    issues.append({"level": "info", "message": f"{fname}: {len(data)} clés"})
                elif isinstance(data, list):
                    issues.append({"level": "info", "message": f"{fname}: {len(data)} éléments"})
            except Exception as e:
                issues.append({"level": "error", "message": f"{fname}: JSON invalide — {e}"})

        # GeoJSON
        elif fname.endswith(".geojson"):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                features = data.get("features", [])
                issues.append({"level": "info", "message": f"{fname}: {len(features)} features"})
            except Exception as e:
                issues.append({"level": "error", "message": f"{fname}: GeoJSON invalide — {e}"})

    if not any(i["level"] == "error" for i in issues):
        issues.insert(0, {"level": "success", "message": "Toutes les validations passent"})

    return issues


# ---------------------------------------------------------------------------
# Publications
# ---------------------------------------------------------------------------

PUBS_DIR = ROOT / "pubs"
FILES_DIR = ROOT / "files" / "papers"
IMAGES_DIR = ROOT / "images" / "pubs"
MEMBERS_JSON = ROOT / "data" / "members.json"
MEMBERS_PHOTOS_DIR = ROOT / "images" / "membres"

AVAILABLE_ROLES = ["Direction", "Fellow", "Conseil scientifique", ""]
SOCIAL_FIELDS = ["x", "linkedin", "email", "threads", "facebook", "wh"]


def slugify(text):
    """Convert text to a URL-friendly slug."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text


def list_publications():
    """List all existing publications with their metadata."""
    pubs = []
    if not PUBS_DIR.is_dir():
        return pubs

    for name in sorted(os.listdir(PUBS_DIR)):
        dirpath = PUBS_DIR / name
        qmd = dirpath / "index.qmd"
        if not dirpath.is_dir() or name.startswith(".") or not qmd.exists():
            continue

        fm = _read_full_frontmatter(qmd)
        meta_path = dirpath / "_metadata.yml"
        meta = {}
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and ":" in line and not line.startswith("#"):
                            k, v = line.split(":", 1)
                            meta[k.strip()] = v.strip().strip('"').strip("'")
            except Exception:
                pass

        pdf_path = FILES_DIR / f"{name}.pdf"
        img_path = IMAGES_DIR / f"{name}.png"

        pubs.append({
            "slug": name,
            "title": fm.get("title", name),
            "subtitle": fm.get("subtitle", ""),
            "date": fm.get("date", ""),
            "pubtype": fm.get("pubtype", "wp"),
            "categories": fm.get("categories", []),
            "abstract": fm.get("abstract", ""),
            "author_ids": fm.get("author-ids", []),
            "has_pdf": pdf_path.exists(),
            "has_image": img_path.exists(),
            "pdf_path": meta.get("pdf", f"/files/papers/{name}.pdf"),
            "image_path": meta.get("image", f"/images/pubs/{name}.png"),
        })

    return pubs


def _read_full_frontmatter(qmd_path):
    """Read full YAML frontmatter using PyYAML if available, else basic parse."""
    try:
        with open(qmd_path, "r", encoding="utf-8") as f:
            text = f.read()
    except Exception:
        return {}

    m = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
    if not m:
        return {}

    block = m.group(1)

    try:
        import yaml
        return yaml.safe_load(block) or {}
    except ImportError:
        pass
    except Exception:
        pass

    # Fallback: basic line-by-line
    fm = {}
    current_key = None
    for line in block.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if not line.startswith(" ") and ":" in stripped:
            key, val = stripped.split(":", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if val.startswith("[") and val.endswith("]"):
                val = [x.strip().strip("[],'\"") for x in val[1:-1].split(",") if x.strip()]
            elif val == "" or val == "|":
                val = ""
            fm[key] = val
            current_key = key
        elif current_key and line.startswith("  "):
            item = stripped.lstrip("- ").strip('"').strip("'")
            if isinstance(fm.get(current_key), list):
                fm[current_key].append(item)
            elif isinstance(fm.get(current_key), str):
                fm[current_key] = (fm[current_key] + " " + stripped).strip()

    return fm


def list_members_simple():
    """List members (id + name only) for author selectors."""
    try:
        with open(MEMBERS_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [{"id": m["id"], "name": m["name"]} for m in data.get("members", [])]
    except Exception:
        return []


def create_publication(form_data, files):
    """
    Create a new publication from form data and uploaded files.
    Returns {"ok": True, "slug": ...} or {"ok": False, "error": ...}
    """
    title = form_data.get("title", "").strip()
    if not title:
        return {"ok": False, "error": "Le titre est requis"}

    slug = form_data.get("slug", "").strip() or slugify(title)
    if not slug:
        return {"ok": False, "error": "Impossible de generer un slug"}

    pub_dir = PUBS_DIR / slug
    if pub_dir.exists():
        return {"ok": False, "error": f"Une publication avec le slug '{slug}' existe deja"}

    # Parse form fields
    subtitle = form_data.get("subtitle", "").strip()
    date = form_data.get("date", "").strip() or datetime.now().strftime("%Y-%m-%d")
    pubtype = form_data.get("pubtype", "wp").strip()
    abstract = form_data.get("abstract", "").strip()
    categories_raw = form_data.get("categories", "").strip()
    keywords_raw = form_data.get("keywords", "").strip()
    author_ids_raw = form_data.get("author_ids", "").strip()

    categories = [c.strip() for c in categories_raw.split(",") if c.strip()] if categories_raw else []
    keywords = [k.strip() for k in keywords_raw.split(",") if k.strip()] if keywords_raw else []
    author_ids = [a.strip() for a in author_ids_raw.split(",") if a.strip()] if author_ids_raw else []

    # Build index.qmd content
    lines = ["---"]
    lines.append(f'title: "{title}"')
    if subtitle:
        lines.append(f'subtitle: "{subtitle}"')
    lines.append(f'date: "{date}"')

    if author_ids:
        lines.append("author-ids:")
        for aid in author_ids:
            lines.append(f"  - {aid}")

    lines.append(f"pubtype: {pubtype}")
    lines.append("page-layout: full")
    lines.append("class: pubpage")
    lines.append("body-classes: pubpage")

    if categories:
        cat_str = ", ".join(categories)
        lines.append(f"categories: [{cat_str}]")
    if keywords:
        kw_str = ", ".join(keywords)
        lines.append(f"keywords: [{kw_str}]")

    if abstract:
        lines.append("")
        lines.append("abstract: ")
        # Use quoted block for abstract
        lines.append(f'  "{abstract}"')

    lines.append("---")
    lines.append("")
    lines.append("{{< pub >}}")
    lines.append("")

    qmd_content = "\n".join(lines)

    # Build _metadata.yml
    meta_lines = [
        "# Auto-genere par l'admin dashboard",
        f'pdf: "/files/papers/{slug}.pdf"',
        f'image: "/images/pubs/{slug}.png"',
        f'type: "{pubtype}"',
    ]
    meta_content = "\n".join(meta_lines) + "\n"

    # Create everything
    try:
        pub_dir.mkdir(parents=True, exist_ok=True)
        FILES_DIR.mkdir(parents=True, exist_ok=True)
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)

        # Write QMD
        (pub_dir / "index.qmd").write_text(qmd_content, encoding="utf-8")

        # Write metadata
        (pub_dir / "_metadata.yml").write_text(meta_content, encoding="utf-8")

        # Save uploaded PDF
        pdf_data = files.get("pdf")
        if pdf_data:
            pdf_dest = FILES_DIR / f"{slug}.pdf"
            with open(pdf_dest, "wb") as f:
                f.write(pdf_data)

        # Save uploaded image
        img_data = files.get("image")
        if img_data:
            img_dest = IMAGES_DIR / f"{slug}.png"
            with open(img_dest, "wb") as f:
                f.write(img_data)

        return {"ok": True, "slug": slug}

    except Exception as e:
        # Cleanup on failure
        if pub_dir.exists():
            shutil.rmtree(pub_dir, ignore_errors=True)
        return {"ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Members management
# ---------------------------------------------------------------------------

def _load_members_json():
    """Load full members.json data."""
    try:
        with open(MEMBERS_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"members": []}


def _save_members_json(data):
    """Save members.json with nice formatting."""
    with open(MEMBERS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def list_members_full():
    """List all members with full details."""
    data = _load_members_json()
    members = data.get("members", [])
    result = []
    for m in members:
        mid = m.get("id", "")
        # Check photo file exists
        photo_path = m.get("photo", "")
        has_photo = False
        if photo_path:
            # photo is like /images/membres/antonin.jpg
            rel = photo_path.lstrip("/")
            has_photo = (ROOT / rel).exists()

        result.append({
            "id": mid,
            "name": m.get("name", ""),
            "url": m.get("url", ""),
            "role": m.get("role", ""),
            "photo": photo_path,
            "has_photo": has_photo,
            "bio": m.get("bio", ""),
            "social": m.get("social", {}),
        })
    return result


def create_member(form_data, files):
    """Create a new member entry in members.json."""
    mid = form_data.get("id", "").strip()
    name = form_data.get("name", "").strip()

    if not mid:
        return {"ok": False, "error": "L'identifiant (id) est requis"}
    if not name:
        return {"ok": False, "error": "Le nom est requis"}

    # Validate id format (alphanumeric + underscores)
    if not re.match(r'^[a-z][a-z0-9_]*$', mid):
        return {"ok": False, "error": "L'id doit commencer par une lettre minuscule et ne contenir que des lettres, chiffres et underscores"}

    data = _load_members_json()
    existing_ids = {m["id"] for m in data.get("members", [])}
    if mid in existing_ids:
        return {"ok": False, "error": f"Un membre avec l'id '{mid}' existe deja"}

    # Build social dict
    social = {}
    for field in SOCIAL_FIELDS:
        val = form_data.get(f"social_{field}", "").strip()
        if field == "email" and val and not val.startswith("mailto:"):
            val = f"mailto:{val}"
        social[field] = val

    # Determine photo path and extension
    photo_data = files.get("photo")
    photo_filename = form_data.get("photo_filename", "")
    ext = ".jpg"
    if photo_filename:
        _, fext = os.path.splitext(photo_filename)
        if fext.lower() in (".jpg", ".jpeg", ".png", ".webp"):
            ext = fext.lower()

    photo_web_path = f"/images/membres/{mid}{ext}"

    member = {
        "id": mid,
        "name": name,
        "url": form_data.get("url", "").strip(),
        "role": form_data.get("role", "").strip(),
        "photo": photo_web_path,
        "bio": form_data.get("bio", "").strip(),
        "social": social,
    }

    try:
        data["members"].append(member)
        _save_members_json(data)

        # Save photo
        if photo_data:
            MEMBERS_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
            photo_dest = MEMBERS_PHOTOS_DIR / f"{mid}{ext}"
            with open(photo_dest, "wb") as f:
                f.write(photo_data)

        return {"ok": True, "id": mid}

    except Exception as e:
        return {"ok": False, "error": str(e)}


def update_member(mid, form_data, files):
    """Update an existing member in members.json."""
    data = _load_members_json()
    members = data.get("members", [])

    idx = None
    for i, m in enumerate(members):
        if m.get("id") == mid:
            idx = i
            break

    if idx is None:
        return {"ok": False, "error": f"Membre '{mid}' introuvable"}

    member = members[idx]

    # Update fields (only if provided and non-empty key)
    for field in ("name", "url", "role", "bio"):
        if field in form_data:
            member[field] = form_data[field].strip()

    # Update social links
    social = member.get("social", {})
    for field in SOCIAL_FIELDS:
        key = f"social_{field}"
        if key in form_data:
            val = form_data[key].strip()
            if field == "email" and val and not val.startswith("mailto:"):
                val = f"mailto:{val}"
            social[field] = val
    member["social"] = social

    # Handle photo upload
    photo_data = files.get("photo")
    if photo_data:
        photo_filename = form_data.get("photo_filename", "")
        ext = ".jpg"
        if photo_filename:
            _, fext = os.path.splitext(photo_filename)
            if fext.lower() in (".jpg", ".jpeg", ".png", ".webp"):
                ext = fext.lower()

        MEMBERS_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
        photo_dest = MEMBERS_PHOTOS_DIR / f"{mid}{ext}"
        with open(photo_dest, "wb") as f:
            f.write(photo_data)
        member["photo"] = f"/images/membres/{mid}{ext}"

    members[idx] = member

    try:
        _save_members_json(data)
        return {"ok": True, "id": mid}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def delete_member(mid):
    """Remove a member from members.json (does not delete photo)."""
    data = _load_members_json()
    members = data.get("members", [])
    new_members = [m for m in members if m.get("id") != mid]

    if len(new_members) == len(members):
        return {"ok": False, "error": f"Membre '{mid}' introuvable"}

    data["members"] = new_members

    try:
        _save_members_json(data)
        return {"ok": True, "id": mid}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# HTTP Server
# ---------------------------------------------------------------------------

class AdminHandler(SimpleHTTPRequestHandler):
    """Serves the dashboard and API endpoints."""

    def log_message(self, format, *args):
        # Quieter logging
        if "/api/" not in str(args[0]):
            super().log_message(format, *args)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/index.html":
            self._serve_dashboard()
        elif path == "/api/status":
            self._json_response(compute_all_status())
        elif path == "/api/publications":
            self._json_response(list_publications())
        elif path == "/api/members":
            self._json_response(list_members_full())
        elif path == "/api/members/roles":
            self._json_response(AVAILABLE_ROLES)
        elif path.startswith("/api/validate/"):
            tracker_id = path.split("/")[-1]
            self._json_response(validate_tracker_data(tracker_id))
        elif path.startswith("/api/finalize/"):
            tracker_id = path.split("/")[-1]
            self._handle_finalize(tracker_id)
        else:
            self.send_error(404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/publications":
            self._handle_create_publication()
        elif path == "/api/members":
            self._handle_member_action("create")
        elif path.startswith("/api/members/") and path.endswith("/update"):
            mid = path.split("/")[-2]
            self._handle_member_action("update", mid)
        elif path.startswith("/api/members/") and path.endswith("/delete"):
            mid = path.split("/")[-2]
            result = delete_member(mid)
            self._json_response(result)
        else:
            self.send_error(404)

    def _handle_member_action(self, action, mid=None):
        """Handle member create/update with multipart form."""
        content_type = self.headers.get("Content-Type", "")
        form_data = {}
        files = {}

        if "multipart/form-data" in content_type:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    "REQUEST_METHOD": "POST",
                    "CONTENT_TYPE": content_type,
                },
            )
            for key in form.keys():
                field = form[key]
                if hasattr(field, "filename") and field.filename:
                    files[key] = field.file.read()
                    form_data[f"{key}_filename"] = field.filename
                else:
                    form_data[key] = field.value

        elif "application/json" in content_type:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            form_data = json.loads(body)

        if action == "create":
            result = create_member(form_data, files)
        else:
            result = update_member(mid, form_data, files)

        self._json_response(result)

    def _handle_create_publication(self):
        """Handle multipart form upload for new publication."""
        content_type = self.headers.get("Content-Type", "")

        if "multipart/form-data" in content_type:
            # Parse multipart form data
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    "REQUEST_METHOD": "POST",
                    "CONTENT_TYPE": content_type,
                },
            )

            form_data = {}
            files = {}

            for key in form.keys():
                field = form[key]
                if hasattr(field, "filename") and field.filename:
                    # File upload
                    files[key] = field.file.read()
                else:
                    form_data[key] = field.value

            result = create_publication(form_data, files)
            self._json_response(result)

        elif "application/json" in content_type:
            # JSON body (no file uploads)
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            form_data = json.loads(body)
            result = create_publication(form_data, {})
            self._json_response(result)

        else:
            self._json_response({"ok": False, "error": "Content-Type non supporte"})

    def _serve_dashboard(self):
        try:
            with open(DASHBOARD_HTML, "r", encoding="utf-8") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content.encode("utf-8"))
        except FileNotFoundError:
            self.send_error(500, "admin_dashboard.html introuvable")

    def _json_response(self, data):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def _handle_finalize(self, tracker_id):
        """Bump last_updated to today's date."""
        manifest = load_manifest()
        tconf = manifest["trackers"].get(tracker_id)
        if not tconf:
            self._json_response({"ok": False, "error": "Tracker inconnu"})
            return

        page_path = ROOT / tconf["page"]
        today = datetime.now().strftime("%Y-%m-%d")
        success = update_frontmatter_field(page_path, "last_updated", today)

        if success:
            self._json_response({"ok": True, "new_date": today})
        else:
            self._json_response({
                "ok": False,
                "error": "Impossible de mettre à jour le frontmatter"
            })


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="LIFT Tracker Admin Dashboard")
    parser.add_argument("--port", type=int, default=4242, help="Port (default: 4242)")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser")
    args = parser.parse_args()

    if not MANIFEST_PATH.exists():
        print(f"ERREUR: {MANIFEST_PATH} introuvable", file=sys.stderr)
        sys.exit(1)

    if not DASHBOARD_HTML.exists():
        print(f"ERREUR: {DASHBOARD_HTML} introuvable", file=sys.stderr)
        sys.exit(1)

    os.chdir(ROOT)
    server = HTTPServer(("127.0.0.1", args.port), AdminHandler)
    url = f"http://localhost:{args.port}"

    print(f"\n  LIFT Tracker Admin")
    print(f"  Dashboard : {url}")
    print(f"  Ctrl+C pour arrêter\n")

    if not args.no_browser:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt.")
        server.server_close()


if __name__ == "__main__":
    main()
