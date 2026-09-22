#!/usr/bin/env python3
"""Gera as páginas do site a partir de content/*.json. Não apaga nada:
escreve só os arquivos que produz, dentro de --out."""
import json, re, argparse, shutil
from pathlib import Path

ICONS = {
 "x": '<svg width="20" height="20" viewbox="0 0 24 24" fill="currentColor"><path d="M18.146 3H21l-6.98 7.98L21.5 21h-5.73l-4.17-5.31L6.7 21H3l7.43-8.49L2.5 3h5.77l3.86 5.06L18.146 3z"></path></svg>',
 "linkedin": '<svg width="20" height="20" viewbox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM0 8h5v16H0V8zm7.5 0h4.8v2.2h.07C13.2 8.6 15.1 7.5 17.6 7.5 22.2 7.5 24 10.4 24 15.1V24h-5v-7.6c0-1.8-.03-4.1-2.5-4.1-2.5 0-2.9 2-2.9 4v7.7h-5V8z"></path></svg>',
 "email": '<svg width="20" height="20" viewbox="0 0 24 24" fill="currentColor"><path d="M22 6H2l10 6 10-6z"></path><path d="M12 13L2 6.76V18a2 2 0 002 2h16a2 2 0 002-2V6.76L12 13z"></path></svg>',
}

def hero(m):
    out = ['<div class="member-hero">',
           f'<img class="member-hero-photo" src="../{m["photo"]}" alt="{m["nom"]}">',
           '<div class="member-hero-text">', '<h1 class="member-hero-name">', m["nom"], '</h1>',
           '<div class="member-hero-role">', m["role"], '</div>']
    if m.get("bio"):
        out.append(f'<p class="member-hero-bio">{m["bio"]}</p>')
    out.append('<div class="member-hero-actions">')
    if m.get("page_perso"):
        out.append(f'<a href="{m["page_perso"]}">Page personnelle</a>')
    out.append('<div class="socials">')
    for k in ("x", "linkedin", "email"):
        if m.get(k):
            href = ("mailto:" + m[k]) if k == "email" else m[k]
            out.append(f'<a href="{href}" class="btn-icon btn-{k}" aria-label="{k}">{ICONS[k]}</a>')
    out += ['</div>', '</div>', '</div>', '</div>']
    return "\n".join(out)

def pubs_du_membre(m, pubs_ordre):
    """Les publications d'un membre sont déduites de publications.json :
    toute publication dont il est auteur. Un champ « publications » dans
    members.json reste possible pour forcer une liste particulière."""
    if m.get("publications"):
        return [p for p in m["publications"] if p in {q["id"] for q in pubs_ordre}]
    return [p["id"] for p in pubs_ordre
            if any(a.get("membre") == m["id"] for a in p.get("auteurs_liens", []))]

def pubs_section(m, pubs_by_id, pubs_ordre):
    ids = pubs_du_membre(m, pubs_ordre)
    if not ids:
        return ""
    out = ['<section id="publications" class="level2">',
           '<h2 class="anchored" data-anchor-id="publications">Publications</h2>',
           '<div class="member-pubs">']
    for pid in ids:
        p = pubs_by_id[pid]
        links = f'<div class="links"><a class="btn-pdf" href="../{p["pdf"]}">PDF</a></div>' if p.get("pdf") else '<div class="links"></div>'
        out += ['<div class="member-pub">',
                f'  <a class="thumb" href="../pubs/{pid}/"><img src="../{p["thumb"]}" alt=""></a>',
                '  <div class="meta">',
                f'    <h3 class="t anchored"><a href="../pubs/{pid}/">{p["titre"]}</a></h3>',
                f'    <div class="s">{p["type_label"]} — {p["date"]}</div>',
                f'    {links}',
                '  </div>', '</div>']
    out += ['</div>', '</section>']
    return "\n".join(out)

def membre_page(m, tmpl, pubs_by_id, pubs_ordre):
    sec = pubs_section(m, pubs_by_id, pubs_ordre)
    html = tmpl.replace("{{nom}}", m["nom"]).replace("{{HERO}}", hero(m))
    if sec:
        return html.replace("{{PUBS}}", sec)
    # sem publicações: o bloco some e leva junto as quebras de linha extras
    return html.replace("{{PUBS}}\n\n\n", "\n")

def liste_membres(data, live_html):
    blocks = []
    by_section = {}
    for m in data["membres"]:
        by_section.setdefault(m["section"], []).append(m)
    for section in data["sections"]:
        rows = []
        for m in by_section.get(section, []):
            bio = f'\n      <p class="mbr-bio">{m["bio_courte"]}</p>' if m.get("bio_courte") else ""
            rows.append(
f'''  <a class="mbr-entry" href="./membres/{m["id"]}.html">
    <img class="mbr-photo" src="./{m["photo"]}" alt="{m["nom"]}">
    <div class="mbr-info">
      <div class="mbr-role">{m["role"]}</div>
      <h3 class="mbr-name">{m["nom"]}</h3>{bio}
    </div>
  </a>''')
        blocks.append(f'<div class="mbr-section-label">{section}</div>\n<div class="mbr-list">\n' + "\n".join(rows) + '\n</div>')
    novo = "\n\n".join(blocks)
    i = live_html.index('<div class="mbr-section-label">')
    j = live_html.rindex('</div>', 0, live_html.index("</main> <!-- /main -->")) + len('</div>')
    return live_html[:i] + novo + live_html[j:]


def _curly(t):
    """Apóstrofo tipográfico, como no bloco Résumé das páginas de publicação."""
    return t.replace("'", "\u2019")

def pub_defaults(p):
    d = dict(p)
    d.setdefault("sous_titre", p["venue"])
    d.setdefault("tag_hero", f"{p['type_label']} · {p['date']}")
    d.setdefault("resume_hero", p["resume"])
    d.setdefault("resume_long", _curly(p["resume"]))
    d.setdefault("mots_cles", ", ".join(t.lower() for t in p["tags"]))
    d.setdefault("mots_cles_affiches", ", ".join(p["tags"]))
    d.setdefault("date_longue", p["date"])
    d.setdefault("auteurs_liens", [{"nom": a} for a in p["auteurs"]])
    return d

def auteurs_html(p, membres, prefixe="../../", racine=Path(".")):
    """Lien vers la page du membre seulement si elle existe — sinon texte simple
    (un lien vers une page absente donnerait un 404)."""
    out = []
    for a in p["auteurs_liens"]:
        mid = a.get("membre")
        nom = a.get("nom") or membres.get(mid, {}).get("nom", "")
        if mid and (mid in membres or (racine / "membres" / f"{mid}.html").exists()):
            out.append(f'<a href="{prefixe}membres/{mid}.html">{nom}</a>')
        else:
            out.append(nom)
    return ", ".join(out)

def page_publication(p, tmpl, membres, racine=Path(".")):
    d = pub_defaults(p)
    cats = ""
    if d["tags"]:
        cats = ('  <div class="quarto-categories">\n'
                + "".join(f'    <div class="quarto-category">{t}</div>\n' for t in d["tags"])
                + "  </div>")
    h = tmpl.replace("{{CATEGORIES}}", cats).replace("{{AUTEURS}}", auteurs_html(d, membres, "../../", racine))
    if len(d["auteurs_liens"]) == 1:
        h = h.replace('<div class="quarto-title-meta-heading">Auteurs</div>',
                      '<div class="quarto-title-meta-heading">Auteur</div>')
    for k in ("titre", "sous_titre", "date_longue", "tag_hero", "mots_cles",
              "mots_cles_affiches", "resume_long", "resume_hero", "pdf"):
        h = h.replace("{{%s}}" % k, str(d.get(k, "")))
    return h

def liste_publications(pubs, membres, live_html, racine=Path(".")):
    blocs = []
    for p in pubs:
        d = pub_defaults(p)
        cats = "".join(f'<span class="pub-cat">{t}</span>' for t in d["tags"])
        pdf = (f'\n      <a href="./{d["pdf"]}" class="pub-pdf-btn" target="_blank">PDF ↓</a>'
               if d.get("pdf") else "")
        blocs.append(f'''  <div class="pub-entry" data-type="{d["type"]}" data-tags="{" ".join(d["tags"])}">
    <div class="pub-thumb"><img src="./{d["thumb"]}" alt="" loading="lazy"></div>
    <div class="pub-type-line pub-type-{d["type"]}">{d["type_label"]} · {d["date"]}</div>
    <h3><a href="./pubs/{d["id"]}/">{d["titre"]}</a></h3>
    <div class="pub-authors">{auteurs_html(d, membres, "./", racine)}</div>
    <div class="pub-venue">{d["venue"]}</div>
    <div class="pub-cats">
      {cats}
    </div>
    <div class="pub-abstract-body">
      {d["resume"]}
    </div>
    <div class="pub-actions">
      <button class="pub-abstract-btn" onclick="toggleAbstract(this)">Abstract ↓</button>
      <a href="./pubs/{d["id"]}/" class="pub-lire-btn">Lire →</a>{pdf}
    </div>
  </div>''')
    novo = "\n\n".join(blocs)
    i = live_html.index('  <div class="pub-entry"')
    dernier = live_html.rindex('<div class="pub-entry"')
    j = live_html.index("\n  </div>\n", live_html.index("pub-actions", dernier)) + len("\n  </div>")
    return live_html[:i] + novo + live_html[j:]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", default=".", help="raiz do site (padrão: o próprio repo)")
    ap.add_argument("--out", default=".", help="onde escrever (padrão: no lugar)")
    ap.add_argument("--check", action="store_true", help="não escreve; falha se algo estiver desatualizado")
    a = ap.parse_args()
    live, out = Path(a.live), Path(a.out)
    if a.check:
        import tempfile
        out = Path(tempfile.mkdtemp())
    elif out != live:
        if out.exists(): shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)
    data = json.loads(Path("content/members.json").read_text())
    liste_pubs = json.loads(Path("content/publications.json").read_text())["publications"]
    pubs = {p["id"]: p for p in liste_pubs}
    tmpl = Path("build/templates/membre.html").read_text()

    (out / "membres").mkdir(exist_ok=True)
    for m in data["membres"]:
        (out / "membres" / f'{m["id"]}.html').write_text(membre_page(m, tmpl, pubs, liste_pubs))
    (out / "membres.html").write_text(liste_membres(data, (live / "membres.html").read_text()))

    membres_par_id = {m["id"]: m for m in data["membres"]}
    tmpl_pub = Path("build/templates/publication.html").read_text()
    for p in liste_pubs:
        dossier = out / "pubs" / p["id"]
        dossier.mkdir(parents=True, exist_ok=True)
        (dossier / "index.html").write_text(page_publication(p, tmpl_pub, membres_par_id, live))
    (out / "publications.html").write_text(
        liste_publications(liste_pubs, membres_par_id, (live / "publications.html").read_text(), live))

    # home: contador de membros
    idx = (live / "index.html").read_text()
    n = len(data["membres"])
    idx = re.sub(r'(<div class="stat-num">)\d+(</div>\s*<div class="stat-meta">\s*<div class="stat-key">Membres)',
                 lambda mm: f'{mm.group(1)}{n:02d}{mm.group(2)}', idx)
    (out / "index.html").write_text(idx)
    if a.check:
        difs = []
        for f in sorted(out.rglob("*.html")):
            rel = f.relative_to(out)
            atual = (live / rel)
            if not atual.exists() or atual.read_text() != f.read_text():
                difs.append(str(rel))
        shutil.rmtree(out)
        if difs:
            print("❌ páginas desatualizadas em relação a content/ (rode: python3 build/generate.py)")
            for d in difs: print("   •", d)
            raise SystemExit(1)
        print(f"✅ as páginas geradas estão em dia com content/ ({n} membros, {len(liste_pubs)} publicações)")
    else:
        print(f"gerado: {n} membros + {len(liste_pubs)} publicações -> {out}/")

if __name__ == "__main__":
    main()
