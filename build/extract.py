#!/usr/bin/env python3
"""Extrai o conteúdo do site atual (HTML) para content/*.json. Somente leitura."""
import json, re, os, sys
from pathlib import Path

LIVE = Path(sys.argv[1] if len(sys.argv) > 1 else "live")
OUT = Path("content"); OUT.mkdir(exist_ok=True)

def txt(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()

INLINE_OK = re.compile(r"</?(?:em|strong|b|i|a|sup|sub|br)\b[^>]*>")

def rich(s):
    """Texto com HTML inline preservado (em/strong/a/...)."""
    keep = {}
    def stash(m):
        k = f"\x00{len(keep)}\x00"; keep[k] = m.group(0); return k
    s = INLINE_OK.sub(stash, s)
    s = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()
    for k, v in keep.items(): s = s.replace(k, v)
    return s

# ---------------------------------------------------------------- membres
list_html = (LIVE / "membres.html").read_text()
sections, order = {}, []
for label, block in re.findall(
    r'<div class="mbr-section-label">(.*?)</div>\s*<div class="mbr-list">(.*?)\n</div>',
    list_html, re.S):
    ids = re.findall(r'href="\./membres/([a-z0-9_-]+)\.html"', block)
    sections[txt(label)] = ids
    order += [(i, txt(label)) for i in ids]

members = []
for mid, section in order:
    h = (LIVE / "membres" / f"{mid}.html").read_text()
    nom = txt(re.search(r'<h1 class="title">(.*?)</h1>', h, re.S).group(1))
    role = txt(re.search(r'<div class="member-hero-role">(.*?)</div>', h, re.S).group(1))
    photo = re.search(r'<img class="member-hero-photo" src="\.\./(.*?)"', h).group(1)
    bio = re.search(r'<p class="member-hero-bio">(.*?)</p>', h, re.S)
    entry = re.search(r'href="\./membres/%s\.html".*?</a>' % re.escape(mid), list_html, re.S).group(0)
    short = re.search(r'<p class="mbr-bio">(.*?)</p>', entry, re.S)
    links = {}
    for url, cls in re.findall(r'<a href="([^"]+)" class="btn-icon btn-(\w+)"', h):
        links[cls] = url.replace("mailto:", "")
    perso = re.search(r'<a href="([^"]+)">Page personnelle</a>', h)
    pubs = re.findall(r'<a class="thumb" href="\.\./pubs/([a-z0-9-]+)/">', h)
    m = {"id": mid, "nom": nom, "section": section, "role": role, "photo": photo}
    if bio: m["bio"] = rich(bio.group(1))
    if short: m["bio_courte"] = rich(short.group(1))
    if perso: m["page_perso"] = perso.group(1)
    for k in ("email", "x", "linkedin", "github", "scholar"):
        if k in links: m[k] = links[k]
    m["publications"] = pubs
    members.append(m)

json.dump({"sections": list(sections), "membres": members},
          open(OUT / "members.json", "w"), ensure_ascii=False, indent=2)

# ---------------------------------------------------------- publications
pub_html = (LIVE / "publications.html").read_text()
pubs = []
for blk in re.findall(r'<div class="pub-entry"(.*?)\n  </div>', pub_html, re.S):
    typ = re.search(r'data-type="(\w+)"', blk).group(1)
    pid = re.search(r'<h3><a href="\./pubs/([a-z0-9-]+)/">', blk).group(1)
    p = {
        "id": pid,
        "titre": txt(re.search(r'<h3><a[^>]*>(.*?)</a></h3>', blk, re.S).group(1)),
        "type": typ,
        "type_label": txt(re.search(r'<div class="pub-type-line[^"]*">(.*?)·', blk, re.S).group(1)),
        "date": txt(re.search(r'<div class="pub-type-line[^"]*">.*?·(.*?)</div>', blk, re.S).group(1)),
        "auteurs": [a.strip() for a in txt(re.search(r'<div class="pub-authors">(.*?)</div>', blk, re.S).group(1)).split(",")],
        "venue": txt(re.search(r'<div class="pub-venue">(.*?)</div>', blk, re.S).group(1)),
        "tags": re.findall(r'<span class="pub-cat">(.*?)</span>', blk),
        "resume": rich(re.search(r'<div class="pub-abstract-body">(.*?)</div>', blk, re.S).group(1)),
        "thumb": re.search(r'<div class="pub-thumb"><img src="\./(.*?)"', blk).group(1),
    }
    pdf = re.search(r'href="\./(files/papers/[^"]+)"', blk)
    if pdf: p["pdf"] = pdf.group(1)
    pubs.append(p)
json.dump({"publications": pubs}, open(OUT / "publications.json", "w"), ensure_ascii=False, indent=2)

print(f"membres: {len(members)} em {len(sections)} seções -> content/members.json")
for s, ids in sections.items(): print(f"  {s}: {', '.join(ids)}")
print(f"publications: {len(pubs)} -> content/publications.json")

# ------------------------------------------- detalhes das páginas de pub
def linked_authors(html):
    """Autores como lista: id de membro quando há link, senão o nome em texto."""
    out = []
    for part in re.split(r',\s*(?![^<]*</a>)', html):
        a = re.search(r'href="\.\./\.\./membres/([a-z0-9_-]+)\.html">(.*?)</a>', part)
        out.append({"membre": a.group(1), "nom": txt(a.group(2))} if a else {"nom": txt(part)})
    return out

pubs_idx = {p["id"]: p for p in pubs}
for pid, p in pubs_idx.items():
    f = LIVE / "pubs" / pid / "index.html"
    if not f.exists():
        aviso = f"(sem página própria: {pid})"; print(aviso); continue
    h = f.read_text()
    kw = re.search(r'<meta name="keywords" content="(.*?)">', h)
    if kw: p["mots_cles"] = kw.group(1)
    p["titre"] = txt(re.search(r'<h1 class="title">(.*?)</h1>', h, re.S).group(1))  # versão da página (apóstrofo typographique)
    p["sous_titre"] = txt(re.search(r'<p class="subtitle lead">(.*?)</p>', h, re.S).group(1))
    p["categories"] = re.findall(r'<div class="quarto-category">(.*?)</div>', h)
    p["date_longue"] = txt(re.search(r'<p class="date">(.*?)</p>', h, re.S).group(1))
    bloc = re.search(r'<div class="abstract">\s*<div class="block-title">Résumé</div>(.*?)\n  </div>', h, re.S).group(1)
    p["resume_long"] = rich(re.sub(r'</?p>', '', bloc))
    p["auteurs_liens"] = linked_authors(
        re.search(r'<div class="quarto-title-meta-contents"><p>(.*?)</p></div>', h, re.S).group(1))
    p["tag_hero"] = txt(re.search(r'<span class="pub-hero-tag">(.*?)</span>', h, re.S).group(1))
    p["mots_cles_affiches"] = txt(re.findall(r'<span class="pub-hero-meta-value">(.*?)</span>', h, re.S)[1])
    p["resume_hero"] = rich(re.search(r'<p class="pub-hero-abstract">(.*?)</p>', h, re.S).group(1))

for p_ in pubs_idx.values():
    p_.pop("categories", None)                      # sempre igual a tags
    if p_.get("sous_titre") == p_.get("venue"): p_.pop("sous_titre")
    if p_.get("tag_hero") == f"{p_['type_label']} · {p_['date']}": p_.pop("tag_hero")
    for k in ("resume_long", "resume_hero"):
        if p_.get(k) == p_.get("resume"): p_.pop(k)

json.dump({"publications": list(pubs_idx.values())},
          open(OUT / "publications.json", "w"), ensure_ascii=False, indent=2)
print(f"detalhes das páginas de publicação adicionados")
