#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère automatiquement :
- _includes/feature.md : la publication la plus récente
- _includes/latest-tracker.md : le tracker mis à jour le plus récemment
- data/kpis.json : compteurs automatiques (publications, trackers, membres)
"""

import os
import json
from datetime import datetime

from utils import (
    ROOT,
    PUBS_DIR,
    DATA_DIR,
    INCLUDES_DIR,
    MEMBRES_DIR,
    read_yaml_frontmatter,
    read_metadata_yaml,
    parse_date,
    escape_html,
    ensure_dir,
)

OUT_FEATURE_MD = INCLUDES_DIR / "feature.md"
OUT_TRACKER_MD = INCLUDES_DIR / "latest-tracker.md"
OUT_KPIS_JSON = DATA_DIR / "kpis.json"

# Dossiers des trackers
INNOVATION_DATA_DIR = ROOT / "innovation-data"
AI_TRACKERS_DIR = ROOT / "ai-trackers"


# =============================================================================
# Publications
# =============================================================================
def candidate_pub_from_dir(dirpath):
    """Extrait les métadonnées d'une publication pour le classement."""
    slug = os.path.basename(dirpath)
    qmd = os.path.join(dirpath, "index.qmd")
    if not os.path.exists(qmd):
        return None

    fm = read_yaml_frontmatter(qmd)
    title = fm.get("title") or slug.replace("-", " ").title()
    d = parse_date(fm.get("date"))

    # Fallback: date = mtime du fichier
    if d is None:
        try:
            d = datetime.fromtimestamp(os.path.getmtime(qmd))
        except Exception:
            d = datetime(1970, 1, 1)

    meta = read_metadata_yaml(os.path.join(dirpath, "_metadata.yml"))
    pdf = meta.get("pdf", f"/files/papers/{slug}.pdf")
    image = meta.get("image")

    # Check for image in standard location if not in metadata
    if not image:
        img_path = f"/images/pubs/{slug}.png"
        if os.path.exists(ROOT / "images" / "pubs" / f"{slug}.png"):
            image = img_path

    url = f"/pubs/{slug}/"

    return {
        "slug": slug,
        "title": title,
        "date": d,
        "date_str": d.strftime("%Y-%m-%d"),
        "pdf": pdf,
        "image": image,
        "url": url,
    }


def get_all_publications():
    """Récupère toutes les publications."""
    if not PUBS_DIR.is_dir():
        return []

    cands = []
    for name in os.listdir(PUBS_DIR):
        dirpath = PUBS_DIR / name
        if dirpath.is_dir() and not name.startswith("."):
            c = candidate_pub_from_dir(dirpath)
            if c:
                cands.append(c)
    return cands


def pick_latest_pub(cands):
    """Retourne la publication la plus récente."""
    if not cands:
        return None
    return sorted(cands, key=lambda c: c["date"], reverse=True)[0]


def generate_feature_md(pub):
    """Génère le contenu de feature.md (layout pub-feature)."""
    if not pub:
        return "_Aucune publication trouvée._\n"

    title = escape_html(pub["title"])
    date_str = escape_html(pub["date_str"])
    read_url = escape_html(pub["url"])
    pdf_url = escape_html(pub["pdf"])

    img_html = ""
    if pub.get("image"):
        img_src = escape_html(pub["image"])
        img_alt = escape_html(f"Illustration – {pub['title']}")
        img_html = (
            f'<div class="pub-feature-img">'
            f'<img src="{img_src}" alt="{img_alt}" loading="lazy">'
            f'</div>'
        )

    lines = [
        f'<div class="pub-feature">',
        img_html,
        '<div class="pub-feature-content">',
        f'<div><div class="pub-kicker">{date_str}</div>',
        f'<h3 class="pub-h">{title}</h3></div>',
        '<div class="pub-actions">',
        f'<a href="{read_url}" class="btn btn-primary">Lire →</a>',
        f'<a href="{pdf_url}" class="btn btn-outline-secondary">PDF</a>',
        '</div>',
        '</div>',
        '</div>',
    ]

    return "\n".join(lines) + "\n"


# =============================================================================
# Trackers
# =============================================================================
def candidate_tracker_from_dir(dirpath, url_prefix):
    """Extrait les métadonnées d'un tracker pour le classement."""
    slug = os.path.basename(dirpath)
    qmd = os.path.join(dirpath, "index.qmd")
    if not os.path.exists(qmd):
        return None

    fm = read_yaml_frontmatter(qmd)
    title = fm.get("title") or slug.replace("-", " ").title()
    description = fm.get("description", "")
    image = fm.get("image", "")
    update = fm.get("update", "")
    last_updated = fm.get("last_updated", "")

    # Skip redirect pages and trackers marked as "À venir" or without last_updated
    if fm.get("listing-exclude") or update.lower() == "à venir" or not last_updated:
        return None

    d = parse_date(last_updated)
    if d is None:
        return None

    url = f"{url_prefix}/{slug}/"

    return {
        "slug": slug,
        "title": title,
        "description": description,
        "date": d,
        "date_str": d.strftime("%Y-%m-%d"),
        "image": image,
        "update": update,
        "url": url,
    }


def get_all_trackers():
    """Récupère tous les trackers."""
    trackers = []

    # Innovation data trackers
    if INNOVATION_DATA_DIR.is_dir():
        for name in os.listdir(INNOVATION_DATA_DIR):
            dirpath = INNOVATION_DATA_DIR / name
            if dirpath.is_dir() and not name.startswith("."):
                t = candidate_tracker_from_dir(dirpath, "/innovation-data")
                if t:
                    trackers.append(t)

    # AI trackers
    if AI_TRACKERS_DIR.is_dir():
        for name in os.listdir(AI_TRACKERS_DIR):
            dirpath = AI_TRACKERS_DIR / name
            if dirpath.is_dir() and not name.startswith("."):
                t = candidate_tracker_from_dir(dirpath, "/ai-trackers")
                if t:
                    trackers.append(t)

    return trackers


def pick_latest_tracker(trackers):
    """Retourne le tracker mis à jour le plus récemment."""
    if not trackers:
        return None
    return sorted(trackers, key=lambda t: t["date"], reverse=True)[0]


def generate_tracker_md(tracker):
    """Génère le contenu de latest-tracker.md."""
    if not tracker:
        return "_Aucun tracker disponible._\n"

    title = escape_html(tracker["title"])
    description = escape_html(tracker["description"])
    date_str = escape_html(tracker["date_str"])
    url = escape_html(tracker["url"])
    update = escape_html(tracker["update"])

    lines = [
        '<div class="feature-highlight">',
        '<div class="feature-copy">',
        f'<h3 class="feature-title">{title}</h3>',
        f'<p class="feature-date"><em>Dernière mise à jour : {date_str} · {update}</em></p>',
        f'<p style="color: var(--muted); margin: 0.5rem 0;">{description}</p>',
        '<div class="feature-actions">',
        f'<a href="{url}" class="btn btn-primary me-2">Voir le tracker</a>',
        '<a href="/innovation-data.html" class="btn btn-outline-secondary">Tous les trackers</a>',
        '</div>',
        "</div>",
    ]

    if tracker.get("image"):
        img_src = escape_html(tracker["image"])
        img_alt = escape_html(f"Tracker {tracker['title']}")
        lines.extend([
            '<figure class="feature-media">',
            f'<a href="{url}"><img src="{img_src}" alt="{img_alt}" loading="lazy"></a>',
            "</figure>",
        ])

    lines.append("</div>")
    return "\n".join(lines) + "\n"


# =============================================================================
# KPIs
# =============================================================================
def count_members():
    """Compte le nombre de membres affichés sur la page (ceux avec un rôle)."""
    members_json = DATA_DIR / "members.json"
    if members_json.exists():
        try:
            data = json.loads(members_json.read_text(encoding="utf-8"))
            return sum(1 for m in data.get("members", []) if m.get("role", "").strip())
        except Exception:
            pass

    # Fallback: compter les dossiers
    if MEMBRES_DIR.is_dir():
        count = 0
        for name in os.listdir(MEMBRES_DIR):
            if (MEMBRES_DIR / name).is_dir() and not name.startswith("."):
                count += 1
        return count

    return 0


def count_total_trackers():
    """Compte le nombre total de trackers (y compris ceux à venir)."""
    count = 0

    for tracker_dir in [INNOVATION_DATA_DIR, AI_TRACKERS_DIR]:
        if tracker_dir.is_dir():
            for name in os.listdir(tracker_dir):
                dirpath = tracker_dir / name
                if dirpath.is_dir() and not name.startswith("."):
                    qmd = dirpath / "index.qmd"
                    if qmd.exists():
                        fm = read_yaml_frontmatter(str(qmd))
                        if not fm.get("listing-exclude"):
                            count += 1

    return count


def generate_kpis_json(num_pubs, num_trackers, num_members):
    """Génère le fichier kpis.json."""
    kpis = {
        "kpis": [
            {"icon": "bi-journal-text", "num": num_pubs, "label": "Publications"},
            {"icon": "bi-graph-up", "num": num_trackers, "label": "Trackers interactifs"},
            {"icon": "bi-people", "num": num_members, "label": "Membres & fellows"},
        ]
    }
    return json.dumps(kpis, indent=2, ensure_ascii=False) + "\n"


# =============================================================================
# Utilitaire idempotent
# =============================================================================
def write_if_changed(path, content):
    """Écrit le contenu dans le fichier seulement si différent de l'existant.
    Évite de déclencher le file-watcher de Quarto quand rien n'a changé."""
    if path.exists():
        try:
            if path.read_text(encoding="utf-8") == content:
                return False
        except Exception:
            pass
    path.write_text(content, encoding="utf-8")
    return True


# =============================================================================
# Hero & homepage sections
# =============================================================================

FEED_ITEMS = [
    ("fév. 2026", "/pubs/politique-travail/", "Note de politique", "La politique au travail"),
    ("oct. 2025", "/pubs/flexicurity/",       "Working paper",     "Cost of Failure &amp; Flexicurity"),
    ("juil. 2025", "/pubs/ai-innov/",         "Working paper",     "IA &amp; données de brevets"),
    ("jan. 2025",  "/innovation-data/innovation-hightech/", "Tracker mis à jour", "Innovation High-Tech"),
]

def generate_hero_md(num_pubs, num_trackers, num_members):
    """Génère le hero complet — aucune ligne vide dans les blocs HTML."""
    t_lines = [
        (f"Publications",         "Working papers + notes de politique", str(num_pubs)),
        ("Trackers interactifs",  "IA + Innovation + Productivité",      str(num_trackers)),
        ("Membres &amp; fellows", "Direction · Fellows · Conseil",        str(num_members)),
    ]
    tl_html = "".join(
        f'<div class="t-line"><div><div class="t-key">{k}</div><div class="t-sub">{s}</div></div><div class="t-val">{v}</div></div>'
        for k, s, v in t_lines
    )
    feed_html = "".join(
        f'<div class="feed-item"><span class="feed-date">{date}</span><span class="feed-text"><a href="{url}">{label}</a> — {desc}</span></div>'
        for date, url, label, desc in FEED_ITEMS
    )
    return (
        '<div class="hero">'
        '<div class="hero-left">'
        '<div class="hero-tag">Laboratoire de recherche · HEC Paris · Hi! Paris</div>'
        '<div>'
        '<div class="hero-logo-area">'
        '<img src="images/logo.png" alt="LIFT">'
        '<div class="hero-logo-text">Laboratoire de l\'Innovation<br>et du Futur du Travail</div>'
        '</div>'
        '<h1 class="hero-h1">Innovation<br>&amp; Futur<br>du Travail</h1>'
        '<p class="hero-subtitle">Analyses empiriques sur l\'impact de l\'intelligence artificielle, les dynamiques d\'innovation et les transformations structurelles du marché du travail.</p>'
        '<div class="hero-ctas">'
        '<a class="btn btn-primary" href="publications.html">Publications →</a>'
        '<a class="btn btn-outline-secondary" href="ai-trackers.html">Trackers IA</a>'
        '</div>'
        '</div>'
        '<div></div>'
        '</div>'
        '<div class="hero-right">'
        '<div class="terminal-header">'
        '<div class="terminal-dot r"></div>'
        '<div class="terminal-dot y"></div>'
        '<div class="terminal-dot g"></div>'
        '<span class="terminal-title">lift-stats · live</span>'
        '</div>'
        '<div class="terminal-body">'
        + tl_html +
        '<div class="terminal-feed">'
        '<div class="feed-label">// activité récente</div>'
        + feed_html +
        '</div>'
        '</div>'
        '</div>'
        '</div>\n'
    )


def generate_home_pubs_md(pub):
    """Génère la section 01 Publications."""
    feature = generate_feature_md(pub).strip()
    return (
        '<div class="spread">'
        '<div class="section-head">'
        '<span class="section-idx">01 / Publications</span>'
        '<h2 class="section-h">Dernière <span>publication</span></h2>'
        '<a class="btn btn-outline-secondary" href="publications.html">Toutes →</a>'
        '</div>'
        '<div class="section-body">'
        + feature +
        '</div>'
        '</div>\n'
    )


def generate_home_data_md():
    """Génère la section 02 Trackers & Données."""
    cells = [
        ("Tracker · IA · Emploi",   "Diffusion IA (emploi)",   "Suivi de l'adoption de l'IA dans les secteurs d'activité et son impact sur l'emploi en France.",             "Trimestriel",         "/ai-trackers/diffusion-emploi/",          "→ Voir"),
        ("Tracker · IA · Science",  "Diffusion IA (science)",  "Mesure de l'intégration de l'IA dans la production scientifique et les publications académiques.",             "Annuel",              "/ai-trackers/diffusion-science/",          "→ Voir"),
        ("Données · Brevets",       "Innovation High-Tech",    "Brevets PCT dans 10 secteurs high-tech : UE, États-Unis, Chine, Japon. Semestriel.",                          "2025-01-20 · Semestriel", "/innovation-data/innovation-hightech/",   "→ Voir"),
        ("Données · Macro",         "Productivité",            "Indicateurs de productivité totale des facteurs pour les principales économies mondiales.",                    "Semestriel",          "/innovation-data/productivite/",           "→"),
        ("Données · Rupture",       "Innovation de rupture",   "Mesure des innovations technologiques de rupture à travers les données de brevets internationaux.",           "Semestriel",          "/innovation-data/breakthrough/",           "→"),
    ]
    cells_html = "".join(
        f'<div class="data-cell">'
        f'<div class="data-cell-cat">{cat}</div>'
        f'<div class="data-cell-title">{title}</div>'
        f'<div class="data-cell-desc">{desc}</div>'
        f'<div class="data-cell-footer"><span>{freq}</span><a href="{url}">{link}</a></div>'
        f'</div>'
        for cat, title, desc, freq, url, link in cells
    )
    overview = (
        '<div class="data-cell" style="background:var(--bg3);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">'
        '<div style="font-family:var(--mono);font-size:9px;color:var(--fg3);letter-spacing:.12em;text-transform:uppercase;">Vue d\'ensemble</div>'
        '<a href="innovation-data.html" style="font-family:var(--display);font-size:1.1rem;font-weight:700;color:var(--fg3);letter-spacing:-.02em;text-decoration:none;">Toutes les données →</a>'
        '</div>'
    )
    return (
        '<div class="data-section">'
        '<div class="data-inner">'
        '<div class="data-head">'
        '<span class="data-head-title">Trackers &amp; Données</span>'
        '<span class="data-head-sub">02 / Suivi empirique</span>'
        '</div>'
        '<div class="data-grid">'
        + cells_html + overview +
        '</div>'
        '</div>'
        '</div>\n'
    )


def generate_home_partners_md():
    """Génère la section 03 Partenaires."""
    partners = [
        ("https://www.hec.edu/",        "images/brands/HEC_Paris.png", "HEC Paris"),
        ("https://www.hi-paris.fr/",    "images/brands/hi_paris.png",  "Hi! Paris"),
        ("https://www.iledefrance.fr/", "images/brands/region_idf.svg","Région Île-de-France"),
        ("https://www.ip-paris.fr/",    "images/brands/iei.png",       "IEI"),
    ]
    cells_html = "".join(
        f'<a class="partner-cell" href="{url}" target="_blank"><img src="{img}" alt="{alt}"></a>'
        for url, img, alt in partners
    )
    return (
        '<div class="spread">'
        '<div class="section-head">'
        '<span class="section-idx">03 / Réseau</span>'
        '<h2 class="section-h">Partenaires <span>&amp; soutiens</span></h2>'
        '</div>'
        '<div class="section-body">'
        '<div class="partners-grid">'
        + cells_html +
        '</div>'
        '</div>'
        '</div>\n'
    )


# =============================================================================
# Main
# =============================================================================
def main():
    ensure_dir(INCLUDES_DIR)
    ensure_dir(DATA_DIR)

    # Publications
    all_pubs = get_all_publications()
    latest_pub = pick_latest_pub(all_pubs)

    # Trackers
    all_trackers = get_all_trackers()
    latest_tracker = pick_latest_tracker(all_trackers)

    # KPIs
    num_pubs = len(all_pubs)
    num_trackers = count_total_trackers()
    num_members = count_members()
    kpis_content = generate_kpis_json(num_pubs, num_trackers, num_members)
    write_if_changed(OUT_KPIS_JSON, kpis_content)

    # Homepage includes (no blank lines inside HTML blocks)
    write_if_changed(INCLUDES_DIR / "hero.md",              generate_hero_md(num_pubs, num_trackers, num_members))
    write_if_changed(INCLUDES_DIR / "home-pubs.md",         generate_home_pubs_md(latest_pub))
    write_if_changed(INCLUDES_DIR / "home-data.md",         generate_home_data_md())
    write_if_changed(INCLUDES_DIR / "home-partners.md",     generate_home_partners_md())

    # Legacy includes (kept for sub-pages that still use them)
    tracker_content = generate_tracker_md(latest_tracker)
    write_if_changed(OUT_TRACKER_MD, tracker_content)

    # Log
    print(f"[build_feature] Publications: {num_pubs}, dernière: {latest_pub['title'] if latest_pub else 'N/A'}")
    print(f"[build_feature] Trackers: {num_trackers}, dernier mis à jour: {latest_tracker['title'] if latest_tracker else 'N/A'}")
    print(f"[build_feature] Membres: {num_members}")


if __name__ == "__main__":
    main()
