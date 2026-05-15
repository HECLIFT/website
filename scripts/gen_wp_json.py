#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère data/pubs.json — liste complète des publications avec auteurs résolus.
Utilisé par la page working-papers.qmd (rendu côté client).
"""

import json
import sys
from pathlib import Path

from utils import ROOT, PUBS_DIR, DATA_DIR, read_yaml_frontmatter, parse_date, format_date_fr

MEMBERS_FILE = DATA_DIR / "members.json"
OUT = DATA_DIR / "pubs.json"


def load_members():
    if not MEMBERS_FILE.exists():
        return {}
    data = json.loads(MEMBERS_FILE.read_text(encoding="utf-8"))
    return {m["id"]: m for m in data.get("members", [])}


def extract_pub(index_qmd, members):
    meta = read_yaml_frontmatter(index_qmd)
    if not meta:
        return None

    slug = index_qmd.parent.name

    # IDs auteurs
    ids = meta.get("author-ids") or []
    if isinstance(ids, str):
        ids = [x.strip() for x in ids.replace("[", "").replace("]", "").split(",") if x.strip()]
    ids = [str(x).strip() for x in ids]

    authors = []
    for aid in ids:
        m = members.get(aid)
        if m:
            authors.append({
                "id": aid,
                "name": m.get("name", aid),
                "url": m.get("url", "") or f"/membres/{aid}.html",
                "role": m.get("role", ""),
            })
        else:
            authors.append({"id": aid, "name": aid, "url": "", "role": ""})

    # Date
    date_raw = str(meta.get("date", "")).strip()
    date_parsed = parse_date(date_raw)
    date_fr = format_date_fr(date_raw) if date_raw else ""

    # Abstract
    abstract = meta.get("abstract", "") or ""
    if isinstance(abstract, dict):
        abstract = ""
    abstract = str(abstract).strip()

    # Catégories / keywords
    cats = meta.get("categories") or []
    if isinstance(cats, str):
        cats = [c.strip() for c in cats.replace("[","").replace("]","").split(",") if c.strip()]
    cats = [str(c).strip() for c in cats]

    kws = meta.get("keywords") or []
    if isinstance(kws, str):
        kws = [k.strip() for k in kws.replace("[","").replace("]","").split(",") if k.strip()]
    kws = [str(k).strip() for k in kws]

    pubtype = str(meta.get("pubtype", "wp")).strip()

    return {
        "slug":      slug,
        "title":     str(meta.get("title", "")).strip(),
        "subtitle":  str(meta.get("subtitle", "")).strip(),
        "date":      date_raw,
        "date_sort": date_parsed.isoformat() if date_parsed else "1900-01-01",
        "date_fr":   date_fr,
        "authors":   authors,
        "abstract":  abstract,
        "categories": cats,
        "keywords":  kws,
        "pubtype":   pubtype,
        "pdf":       f"/files/papers/{slug}.pdf",
        "url":       f"/pubs/{slug}/",
        "image":     f"/images/pubs/{slug}.png",
    }


def main():
    members = load_members()
    pubs = []

    for index_qmd in sorted(PUBS_DIR.rglob("index.qmd")):
        slug = index_qmd.parent.name
        if slug == "test-validation":
            continue  # skip test pub
        pub = extract_pub(index_qmd, members)
        if pub:
            pubs.append(pub)

    # Trier par date décroissante
    pubs.sort(key=lambda p: p["date_sort"], reverse=True)

    # Numéroter les WP et PB séparément
    wp_num, pb_num = 1, 1
    for p in sorted(pubs, key=lambda x: x["date_sort"]):
        if p["pubtype"] == "wp":
            p["number"] = f"LIFT WP {p['date'][:4]}-{wp_num:02d}" if p["date"] else f"LIFT WP #{wp_num}"
            wp_num += 1
        elif p["pubtype"] == "pb":
            p["number"] = f"LIFT PN {p['date'][:4]}-{pb_num:02d}" if p["date"] else f"LIFT PN #{pb_num}"
            pb_num += 1
        else:
            p["number"] = ""

    content = json.dumps(pubs, ensure_ascii=False, indent=2)
    if OUT.exists() and OUT.read_text(encoding="utf-8") == content:
        print(f"[gen_wp_json] {len(pubs)} publications inchangées (pas de réécriture)")
    else:
        OUT.write_text(content, encoding="utf-8")
        print(f"[gen_wp_json] {len(pubs)} publications écrites → {OUT}")


if __name__ == "__main__":
    main()
