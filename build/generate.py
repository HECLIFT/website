#!/usr/bin/env python3
"""Génère tout le site, en français et en anglais (sous en/), à partir de content/ et de
build/templates/. N'efface rien : écrit seulement les fichiers qu'il produit, dans --out.

Sources :
- build/templates/base.html : document commun (en-tête, menu, sélecteur FR | EN, pied de page) ;
- content/interface.json : libellés de l'interface (fr, en) et traductions des sections, rôles,
  étiquettes, types de publication et mois ;
- content/pages.json et content/pages/{fr,en,head}/ : pages écrites à la main (contenu de <main>
  dans chaque langue, morceaux de <head> propres à la page) ;
- content/members.json, content/publications.json : pages des membres et des publications,
  listes de membres.html et de publications.html (champs anglais en *_en) ;
- build/templates/membre.html, publication.html (contenu de <main>) et *_head.html.
Produit aussi sitemap.xml, search.json et en/search.json."""
import json, re, argparse, shutil, posixpath, html as html_lib
from pathlib import Path

LANGUES = ("fr", "en")
BASE_URL = "https://heclift.github.io/website/"
LOCALE = {"fr": "fr_FR", "en": "en_US"}
RE_LIEN = re.compile(r'\b(href|src)="([^"]*)"')
AVATAR = "images/membres/anonyme.jpg"

ICONS = {
 "x": '<svg width="20" height="20" viewbox="0 0 24 24" fill="currentColor"><path d="M18.146 3H21l-6.98 7.98L21.5 21h-5.73l-4.17-5.31L6.7 21H3l7.43-8.49L2.5 3h5.77l3.86 5.06L18.146 3z"></path></svg>',
 "linkedin": '<svg width="20" height="20" viewbox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM0 8h5v16H0V8zm7.5 0h4.8v2.2h.07C13.2 8.6 15.1 7.5 17.6 7.5 22.2 7.5 24 10.4 24 15.1V24h-5v-7.6c0-1.8-.03-4.1-2.5-4.1-2.5 0-2.9 2-2.9 4v7.7h-5V8z"></path></svg>',
 "email": '<svg width="20" height="20" viewbox="0 0 24 24" fill="currentColor"><path d="M22 6H2l10 6 10-6z"></path><path d="M12 13L2 6.76V18a2 2 0 002 2h16a2 2 0 002-2V6.76L12 13z"></path></svg>',
}

# ------------------------------------------------------------------ outils de langue
class Langue:
    def __init__(self, interface, lang):
        self.lang = lang
        self.t = interface[lang]
        self.tr = interface["traductions"]

    def de(self, categorie, valeur):
        """Traduit une valeur française d'une catégorie fermée (sections, rôles, étiquettes, types)."""
        if self.lang == "fr":
            return valeur
        return self.tr[categorie].get(valeur, valeur)

    def mois(self, texte):
        if self.lang == "fr":
            return texte
        for fr, en in self.tr["mois"].items():
            texte = texte.replace(fr, en)
        return texte

def champ(obj, cle, L):
    """Champ dans la langue de la page ; à défaut de version anglaise, le français (règle souple du 02/11/2026)."""
    if L.lang == "en" and obj.get(cle + "_en"):
        return obj[cle + "_en"]
    return obj.get(cle)

def photo(m):
    """Photo du membre ; sans photo, l'avatar par défaut."""
    return m.get("photo") or AVATAR

def _curly(t):
    """Apostrophe typographique, comme dans le bloc Résumé des pages de publication."""
    return t.replace("'", "’")

def pdf_en_francais(p, L):
    """Vrai si la page anglaise n'a à proposer que le PDF français."""
    return L.lang == "en" and not p.get("pdf_en") and p.get("langue", "fr") == "fr"

def pdf_de(p, L):
    """(fichier, compteur GoatCounter) du PDF à proposer dans la langue de la page."""
    if L.lang == "en" and p.get("pdf_en"):
        return p["pdf_en"], f"pdf-en-{p['id']}"
    return p.get("pdf"), f"pdf-{p['id']}"

# ------------------------------------------------------------------ membres
def hero(m, L):
    out = ['<div class="member-hero">',
           f'<img class="member-hero-photo" src="../{photo(m)}" alt="{m["nom"]}">',
           '<div class="member-hero-text">', '<h1 class="member-hero-name">', m["nom"], '</h1>',
           '<div class="member-hero-role">', L.de("roles", m["role"]), '</div>']
    bio = champ(m, "bio", L)
    if bio:
        out.append(f'<p class="member-hero-bio">{bio}</p>')
    out.append('<div class="member-hero-actions">')
    if m.get("page_perso"):
        out.append(f'<a href="{m["page_perso"]}">{L.t["membre.page_perso"]}</a>')
    out.append('<div class="socials">')
    for k in ("x", "linkedin", "email"):
        if m.get(k):
            href = ("mailto:" + m[k]) if k == "email" else m[k]
            out.append(f'<a href="{href}" class="btn-icon btn-{k}" aria-label="{k}">{ICONS[k]}</a>')
    out += ['</div>', '</div>', '</div>', '</div>']
    return "\n".join(out)

def pubs_du_membre(m, pubs_ordre):
    """Les publications d'un membre sont déduites de publications.json : toute publication dont il
    est auteur. Un champ « publications » dans members.json reste possible pour forcer une liste."""
    if m.get("publications"):
        return [p for p in m["publications"] if p in {q["id"] for q in pubs_ordre}]
    return [p["id"] for p in pubs_ordre
            if any(a.get("membre") == m["id"] for a in p.get("auteurs_liens", []))]

def pubs_section(m, pubs_by_id, pubs_ordre, L):
    ids = pubs_du_membre(m, pubs_ordre)
    if not ids:
        return ""
    out = ['<section id="publications" class="level2">',
           f'<h2 class="anchored" data-anchor-id="publications">{L.t["membre.publications"]}</h2>',
           '<div class="member-pubs">']
    for pid in ids:
        p = pubs_by_id[pid]
        pdf, gc = pdf_de(p, L)
        links = (f'<div class="links"><a class="btn-pdf" href="../{pdf}" data-goatcounter-click="{gc}">{L.t["pdf.court_fr"] if pdf_en_francais(p, L) else L.t["pdf.court"]}</a></div>'
                 if pdf else '<div class="links"></div>')
        out += ['<div class="member-pub">',
                f'  <a class="thumb" href="../pubs/{pid}/"><img src="../{p["thumb"]}" alt=""></a>',
                '  <div class="meta">',
                f'    <h3 class="t anchored"><a href="../pubs/{pid}/">{champ(p, "titre", L)}</a></h3>',
                f'    <div class="s">{L.de("types", p["type_label"])} — {date_pub(p, L)}</div>',
                f'    {links}',
                '  </div>', '</div>']
    out += ['</div>', '</section>']
    return "\n".join(out)

def main_membre(m, tmpl, pubs_by_id, pubs_ordre, L):
    sec = pubs_section(m, pubs_by_id, pubs_ordre, L)
    html = tmpl.replace("{{nom}}", m["nom"]).replace("{{HERO}}", hero(m, L))
    if sec:
        return html.replace("{{PUBS}}", sec)
    # sans publication, le bloc disparaît avec ses sauts de ligne
    return html.replace("{{PUBS}}\n\n", "")

def liste_membres(data, L):
    blocks = []
    by_section = {}
    for m in data["membres"]:
        by_section.setdefault(m["section"], []).append(m)
    for section in data["sections"]:
        rows = []
        for m in by_section.get(section, []):
            bc = champ(m, "bio_courte", L)
            bio = f'\n      <p class="mbr-bio">{bc}</p>' if bc else ""
            rows.append(
f'''  <a class="mbr-entry" href="./membres/{m["id"]}.html">
    <img class="mbr-photo" src="./{photo(m)}" alt="{m["nom"]}">
    <div class="mbr-info">
      <div class="mbr-role">{L.de("roles", m["role"])}</div>
      <h3 class="mbr-name">{m["nom"]}</h3>{bio}
    </div>
  </a>''')
        blocks.append(f'<div class="mbr-section-label">{L.de("sections", section)}</div>\n<div class="mbr-list">\n' + "\n".join(rows) + '\n</div>')
    return "\n\n".join(blocks)

# ------------------------------------------------------------------ publications
def date_pub(p, L):
    return p["date"] if L.lang == "fr" else (p.get("date_en") or L.mois(p["date"]))

def propre(p, cle, L):
    """Valeur saisie pour cette langue, sans repli sur l'autre (sert aux champs dérivés)."""
    return p.get(cle) if L.lang == "fr" else p.get(cle + "_en")

def pub_defaults(p, L):
    d = dict(p)
    d["titre"] = champ(p, "titre", L)
    d["type_label"] = L.de("types", p["type_label"])
    d["date"] = date_pub(p, L)
    d["tags_affiches"] = [L.de("etiquettes", t) for t in p["tags"]]
    d["resume"] = champ(p, "resume", L)
    d["sous_titre"] = propre(p, "sous_titre", L) or propre(p, "venue", L) or L.mois(p.get("sous_titre") or p["venue"])
    d["tag_hero"] = propre(p, "tag_hero", L) or f"{d['type_label']} · {d['date']}"
    d["resume_hero"] = propre(p, "resume_hero", L) or d["resume"]
    d["resume_long"] = propre(p, "resume_long", L) or _curly(d["resume"])
    d["mots_cles"] = propre(p, "mots_cles", L) or ", ".join(t.lower() for t in d["tags_affiches"])
    d["mots_cles_affiches"] = propre(p, "mots_cles_affiches", L) or ", ".join(d["tags_affiches"])
    d["date_longue"] = propre(p, "date_longue", L) or d["date"]
    d.setdefault("auteurs_liens", [{"nom": a} for a in p["auteurs"]])
    return d

def auteurs_html(p, membres, prefixe="../../"):
    """Lien vers la page du membre seulement si elle existe ; sinon texte simple
    (un lien vers une page absente donnerait un 404)."""
    out = []
    for a in p["auteurs_liens"]:
        mid = a.get("membre")
        nom = a.get("nom") or membres.get(mid, {}).get("nom", "")
        if mid and mid in membres:
            out.append(f'<a href="{prefixe}membres/{mid}.html">{nom}</a>')
        else:
            out.append(nom)
    return ", ".join(out)

SVG_PDF = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'

def cta(d, L):
    """Boutons de téléchargement de la page d'une publication."""
    pid = d["id"]
    if L.lang == "fr":
        principal = (f'      <a href="../../{d["pdf"]}" class="pub-hero-cta" data-goatcounter-click="pdf-{pid}" target="_blank" rel="noopener">\n'
                     f'        {SVG_PDF} {L.t["pub.telecharger"]}\n      </a>')
        autre = (f'\n      <a href="../../{d["pdf_en"]}" class="pub-hero-cta pub-hero-cta-en" hreflang="en" lang="en" '
                 f'data-goatcounter-click="pdf-en-{pid}" target="_blank" rel="noopener">{SVG_PDF} English version (PDF)</a>') if d.get("pdf_en") else ""
        return principal + autre
    if d.get("pdf_en"):
        return (f'      <a href="../../{d["pdf_en"]}" class="pub-hero-cta" data-goatcounter-click="pdf-en-{pid}" target="_blank" rel="noopener">\n'
                f'        {SVG_PDF} {L.t["pub.telecharger"]}\n      </a>'
                f'\n      <a href="../../{d["pdf"]}" class="pub-hero-cta pub-hero-cta-en" hreflang="fr" lang="fr" '
                f'data-goatcounter-click="pdf-{pid}" target="_blank" rel="noopener">{SVG_PDF} {L.t["pub.version_fr"]}</a>')
    return (f'      <a href="../../{d["pdf"]}" class="pub-hero-cta" data-goatcounter-click="pdf-{pid}" target="_blank" rel="noopener">\n'
            f'        {SVG_PDF} {L.t["pub.pdf_en_francais"] if pdf_en_francais(d, L) else L.t["pub.telecharger"]}\n      </a>')

def main_publication(p, tmpl, membres, L):
    d = pub_defaults(p, L)
    cats = ""
    if d["tags_affiches"]:
        cats = ('  <div class="quarto-categories">\n'
                + "".join(f'    <div class="quarto-category">{t}</div>\n' for t in d["tags_affiches"])
                + "  </div>")
    pdf, gc = pdf_de(p, L)
    h = (tmpl.replace("{{CATEGORIES}}", cats).replace("{{AUTEURS}}", auteurs_html(d, membres, "../../"))
             .replace("{{AUTEURS_TITRE}}", L.t["pub.auteur"] if len(d["auteurs_liens"]) == 1 else L.t["pub.auteurs"])
             .replace("{{CTA}}", cta(d, L)).replace("{{pdf_principal}}", pdf or "").replace("{{gc_principal}}", gc))
    for k in ("id", "titre", "sous_titre", "date_longue", "tag_hero", "mots_cles",
              "mots_cles_affiches", "resume_long", "resume_hero", "pdf"):
        h = h.replace("{{%s}}" % k, str(d.get(k, "")))
    return h, d

def liste_publications(pubs, membres, L):
    blocs = []
    for p in pubs:
        d = pub_defaults(p, L)
        cats = "".join(f'<span class="pub-cat">{t}</span>' for t in d["tags_affiches"])
        pdf = ""
        if L.lang == "fr":
            if d.get("pdf"):
                pdf = f'\n      <a href="./{d["pdf"]}" class="pub-pdf-btn" data-goatcounter-click="pdf-{d["id"]}" target="_blank">PDF ↓</a>'
            if d.get("pdf_en"):
                pdf += (f'\n      <a href="./{d["pdf_en"]}" class="pub-pdf-btn" hreflang="en" lang="en" '
                        f'data-goatcounter-click="pdf-en-{d["id"]}" target="_blank">PDF (EN) ↓</a>')
        else:
            if d.get("pdf_en"):
                pdf = f'\n      <a href="./{d["pdf_en"]}" class="pub-pdf-btn" data-goatcounter-click="pdf-en-{d["id"]}" target="_blank">PDF ↓</a>'
            elif d.get("pdf") and pdf_en_francais(d, L):
                pdf = f'\n      <a href="./{d["pdf"]}" class="pub-pdf-btn" hreflang="fr" data-goatcounter-click="pdf-{d["id"]}" target="_blank">{L.t["pub.pdf_en_francais"]} ↓</a>'
            elif d.get("pdf"):
                pdf = f'\n      <a href="./{d["pdf"]}" class="pub-pdf-btn" data-goatcounter-click="pdf-{d["id"]}" target="_blank">PDF ↓</a>'
        blocs.append(f'''  <div class="pub-entry" data-type="{d["type"]}" data-tags="{" ".join(p["tags"])}">
    <div class="pub-thumb"><img src="./{d["thumb"]}" alt="" loading="lazy"></div>
    <div class="pub-type-line pub-type-{d["type"]}">{d["type_label"]} · {d["date"]}</div>
    <h3><a href="./pubs/{d["id"]}/">{d["titre"]}</a></h3>
    <div class="pub-authors">{auteurs_html(d, membres, "./")}</div>
    <div class="pub-venue">{d["sous_titre"] if L.lang == "en" else d["venue"]}</div>
    <div class="pub-cats">
      {cats}
    </div>
    <div class="pub-abstract-body">
      {d["resume"]}
    </div>
    <div class="pub-actions">
      <button class="pub-abstract-btn" onclick="toggleAbstract(this)">Abstract ↓</button>
      <a href="./pubs/{d["id"]}/" class="pub-lire-btn">{L.t["pub.lire"]}</a>{pdf}
    </div>
  </div>''')
    return "\n\n".join(blocs)

# ------------------------------------------------------------------ assemblage des pages
def lire_head(texte, lang):
    """Morceaux de <head> d'une page : blocs « <!--@nom--> » (les deux langues) ou « <!--@nom:fr--> »."""
    slots = {}
    for m in re.finditer(r"<!--@([\w]+)(?::(fr|en))?-->\n(.*?)(?=<!--@[\w]+(?::(?:fr|en))?-->\n|\Z)", texte, re.S):
        nom, l, val = m.group(1), m.group(2), m.group(3)
        if l is None or l == lang:
            slots[nom] = val
    return slots

def relocaliser(html, chemin, pages_en):
    """Réécrit les liens relatifs d'une page écrite pour <chemin> afin qu'elle serve sous en/<chemin>."""
    dir_fr = posixpath.dirname(chemin)
    dir_en = posixpath.join("en", dir_fr) if dir_fr else "en"
    def sub(m):
        attr, url = m.group(1), m.group(2)
        if not url or url.startswith(("http:", "https:", "//", "#", "mailto:", "data:", "javascript:")):
            return m.group(0)
        url, diese, ancre = url.partition("#")
        url, point_q, requete = url.partition("?")
        dossier = url.endswith("/") or url in (".", "./")
        cible = posixpath.normpath(posixpath.join(dir_fr, url))
        page = cible if cible.endswith(".html") else (posixpath.join(cible, "index.html") if dossier else None)
        if page is not None and posixpath.normpath(page) in pages_en:
            cible = posixpath.join("en", cible) if cible != "." else "en"
        rel = posixpath.relpath(cible, dir_en)
        if dossier:
            rel = "./" if rel == "." else rel + "/"
        elif url.startswith("./") and not rel.startswith("../"):
            rel = "./" + rel
        return f'{attr}="{rel}{point_q}{requete}{diese}{ancre}"'
    return RE_LIEN.sub(sub, html)

def selecteur(lang, lien, t):
    if lang == "fr":
        dedans = ('<span class="lang-current" lang="fr" aria-current="true">FR</span><span class="lang-sep" aria-hidden="true">|</span>'
                  f'<a class="lang-other" href="{lien}" hreflang="en" lang="en" title="{t["selecteur.autre_titre"]}">EN</a>')
    else:
        dedans = (f'<a class="lang-other" href="{lien}" hreflang="fr" lang="fr" title="{t["selecteur.autre_titre"]}">FR</a>'
                  '<span class="lang-sep" aria-hidden="true">|</span><span class="lang-current" lang="en" aria-current="true">EN</span>')
    return (f'  <li class="nav-item nav-lang">\n    <span class="lang-switch" role="group" aria-label="{t["selecteur.groupe"]}">'
            f'{dedans}</span>\n  </li>\n')

def meta_langues(lang, chemin):
    fr, en = BASE_URL + chemin, BASE_URL + "en/" + chemin
    autre = "en" if lang == "fr" else "fr"
    return (f'<link rel="canonical" href="{fr if lang == "fr" else en}">\n'
            f'<link rel="alternate" hreflang="fr" href="{fr}">\n'
            f'<link rel="alternate" hreflang="en" href="{en}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{fr}">\n'
            f'<meta property="og:locale" content="{LOCALE[lang]}">\n'
            f'<meta property="og:locale:alternate" content="{LOCALE[autre]}">\n')

SLOTS_HEAD = ("head_meta", "head_pandoc", "head_scripts", "head_listing", "head_page", "head_fin", "head_apres_css", "marge")

def assembler(page, lang, base, interface, valeurs, pages_en):
    t = interface[lang]
    chemin = page["chemin"]
    profondeur = chemin.count("/")
    deux = chemin in pages_en
    html = base
    slots = page["head"](lang)
    remplacements = {k: slots.get(k, "") for k in SLOTS_HEAD}
    remplacements.update({"main": page["main"](lang), "lang": lang, "titre": page["titre"][lang],
                          "classe_body": page.get("classe_body", "nav-fixed quarto-light"),
                          "classe_main": page.get("classe_main", "column-page"),
                          "meta_langues": meta_langues(lang, chemin) if deux else "",
                          "H": "../" * profondeur, "P": "../" * profondeur or "./"})
    html = re.sub(r"\{\{(%s)\}\}" % "|".join(remplacements), lambda m: remplacements[m.group(1)], html)
    for cle, val in valeurs.items():
        html = html.replace("{{%s}}" % cle, val)
    html = re.sub(r"\{\{actif:(\w+)\}\}", lambda m: " active" if m.group(1) == page.get("actif") else "", html)
    html = re.sub(r"\{\{courant:(\w+)\}\}", lambda m: ' aria-current="page"' if m.group(1) == page.get("actif") else "", html)
    html = re.sub(r"\{\{t:([\w.-]+)\}\}", lambda m: t[m.group(1)], html)
    if lang == "en":
        html = relocaliser(html, chemin, pages_en)
    if deux:
        dir_fr = posixpath.dirname(chemin)
        lien = (posixpath.relpath("en/" + chemin, dir_fr or ".") if lang == "fr"
                else posixpath.relpath(chemin, posixpath.join("en", dir_fr)))
        html = html.replace("{{selecteur}}", selecteur(lang, lien, t))
    else:
        html = html.replace("{{selecteur}}", "")
    reste = re.findall(r"\{\{[^}]*\}\}", html)
    if reste:
        raise SystemExit(f"❌ {lang}/{chemin} : balises non remplacées {sorted(set(reste))}")
    return html

def toutes_les_pages(data, liste_pubs, interface):
    """Liste des pages à produire : dictionnaires {chemin, langues, titre, head(lang), main(lang), ...}."""
    pages = []
    membres_par_id = {m["id"]: m for m in data["membres"]}
    pubs_by_id = {p["id"]: p for p in liste_pubs}
    L = {lang: Langue(interface, lang) for lang in LANGUES}
    def fichier(*parts):
        return Path(*parts).read_text()
    # pages écrites à la main (dont l'habillage de membres.html et publications.html)
    for spec in json.loads(fichier("content/pages.json"))["pages"]:
        chemin = spec["chemin"]
        head_txt = fichier("content/pages/head", chemin) if Path("content/pages/head", chemin).exists() else ""
        def main_page(lang, chemin=chemin):
            frag = fichier("content/pages", lang, chemin)
            if "{{liste_membres}}" in frag:
                frag = frag.replace("{{liste_membres}}", liste_membres(data, L[lang]))
            if "{{liste_publications}}" in frag:
                frag = frag.replace("{{liste_publications}}", liste_publications(liste_pubs, membres_par_id, L[lang]))
            return frag
        pages.append(dict(spec, head=lambda lang, h=head_txt: lire_head(h, lang), main=main_page))
    # membres
    tmpl_m = fichier("build/templates/membre.html")
    head_m = fichier("build/templates/membre_head.html")
    for m in data["membres"]:
        pages.append({"chemin": f"membres/{m['id']}.html", "langues": list(LANGUES),
                      "titre": {lang: m["nom"] for lang in LANGUES}, "classe_body": "nav-fixed quarto-light memberpage",
                      "head": lambda lang: lire_head(head_m, lang),
                      "main": lambda lang, m=m: main_membre(m, tmpl_m, pubs_by_id, liste_pubs, L[lang])})
    # publications
    tmpl_p = fichier("build/templates/publication.html")
    head_p = fichier("build/templates/publication_head.html")
    for p in liste_pubs:
        def head_pub(lang, p=p):
            slots = lire_head(head_p, lang)
            slots["head_meta"] = f'<meta name="keywords" content="{pub_defaults(p, L[lang])["mots_cles"]}">\n'
            return slots
        pages.append({"chemin": f"pubs/{p['id']}/index.html", "langues": list(LANGUES),
                      "titre": {lang: champ(p, "titre", L[lang]) for lang in LANGUES},
                      "classe_body": "nav-fixed pubpage quarto-light", "head": head_pub,
                      "main": lambda lang, p=p: main_publication(p, tmpl_p, membres_par_id, L[lang])[0]})
    return pages

def texte_de(html):
    corps = html[html.index("<main"):html.index("</main>")]
    corps = re.sub(r"<(script|style)\b.*?</\1>", " ", corps, flags=re.S)
    return re.sub(r"\s+", " ", html_lib.unescape(re.sub(r"<[^>]+>", " ", corps))).strip()

def recherche(produits, lang):
    """Index de la recherche du site (search.json, en/search.json) : une entrée par page."""
    return json.dumps([{"objectID": c, "href": c, "title": titre, "section": "", "text": texte}
                       for l, c, titre, texte in produits if l == lang], ensure_ascii=False)

def sitemap(produits, pages_en):
    """Toutes les pages, dans les deux langues, avec leurs liens hreflang ; sans lastmod."""
    lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for l, c, _, _ in sorted(produits, key=lambda x: (x[1], x[0] != "fr")):
        lignes += ["  <url>", f"    <loc>{BASE_URL}{'en/' if l == 'en' else ''}{c}</loc>"]
        if c in pages_en:
            lignes += [f'    <xhtml:link rel="alternate" hreflang="fr" href="{BASE_URL + c}"/>',
                       f'    <xhtml:link rel="alternate" hreflang="en" href="{BASE_URL}en/{c}"/>',
                       f'    <xhtml:link rel="alternate" hreflang="x-default" href="{BASE_URL + c}"/>']
        lignes.append("  </url>")
    lignes.append("</urlset>")
    return "\n".join(lignes) + "\n"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", default=".", help="racine du site (par défaut : le dépôt lui-même)")
    ap.add_argument("--out", default=".", help="où écrire (par défaut : sur place)")
    ap.add_argument("--check", action="store_true", help="n'écrit rien ; échoue si une page n'est pas à jour")
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
    interface = json.loads(Path("content/interface.json").read_text())
    base = Path("build/templates/base.html").read_text()
    pages = toutes_les_pages(data, liste_pubs, interface)
    pages_en = {p["chemin"] for p in pages if "en" in p["langues"]}
    valeurs = {"n_membres": f'{len(data["membres"]):02d}', "n_publications": f"{len(liste_pubs):02d}"}
    produits, ecrits = [], []
    for page in pages:
        for lang in page["langues"]:
            rel = page["chemin"] if lang == "fr" else "en/" + page["chemin"]
            dest = out / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            html = assembler(page, lang, base, interface, valeurs, pages_en)
            dest.write_text(html)
            ecrits.append(rel)
            produits.append((lang, page["chemin"], page["titre"][lang], texte_de(html)))
    (out / "sitemap.xml").write_text(sitemap(produits, pages_en))
    (out / "search.json").write_text(recherche(produits, "fr"))
    (out / "en").mkdir(exist_ok=True)
    (out / "en" / "search.json").write_text(recherche(produits, "en"))
    ecrits += ["sitemap.xml", "search.json", "en/search.json"]
    n_fr = sum(1 for l, *_ in produits if l == "fr"); n_en = len(produits) - n_fr
    if a.check:
        difs = [r for r in ecrits if not (live / r).exists() or (live / r).read_text() != (out / r).read_text()]
        shutil.rmtree(out)
        if difs:
            print("❌ pages pas à jour par rapport à content/ (lancer : python3 build/generate.py)")
            for d in difs: print("   •", d)
            raise SystemExit(1)
        print(f"✅ les pages générées sont à jour ({n_fr} pages en français, {n_en} en anglais)")
    else:
        print(f"généré : {n_fr} pages en français, {n_en} en anglais -> {out}/")

if __name__ == "__main__":
    main()
