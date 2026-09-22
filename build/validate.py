#!/usr/bin/env python3
"""Confere content/*.json e os dados dos trackers antes de publicar.
Não altera nada: só diz o que está errado."""
import json, sys, csv, re
from pathlib import Path

erros, avisos = [], []
def erro(m): erros.append(m)
def aviso(m): avisos.append(m)

# ------------------------------------------------------------- membres
try:
    d = json.loads(Path("content/members.json").read_text())
except Exception as e:
    print(f"❌ content/members.json não é um JSON válido: {e}"); sys.exit(1)

vus = set()
for m in d["membres"]:
    who = m.get("nom") or m.get("id") or "?"
    for champ in ("id", "nom", "section", "role", "photo"):
        if not m.get(champ): erro(f"{who}: falta o campo « {champ} »")
    if m["id"] in vus: erro(f"{who}: id « {m['id']} » repetido")
    vus.add(m["id"])
    if not re.fullmatch(r"[a-z0-9_-]+", m.get("id", "")):
        erro(f"{who}: id « {m['id']} » deve ter só letras minúsculas, números e hífen")
    if m.get("section") not in d["sections"]:
        erro(f"{who}: seção « {m.get('section')} » não existe (use uma de: {', '.join(d['sections'])})")
    if m.get("photo") and not Path(m["photo"]).exists():
        erro(f"{who}: foto não encontrada — {m['photo']}")
    if m.get("email") and "@" not in m["email"]:
        erro(f"{who}: e-mail inválido — {m['email']}")

# --------------------------------------------------------- publications
pubs = json.loads(Path("content/publications.json").read_text())["publications"]
ids_pubs = {p["id"] for p in pubs}
for p in pubs:
    who = p.get("titre", p.get("id", "?"))[:50]
    for champ in ("id", "titre", "type", "date", "thumb"):
        if not p.get(champ): erro(f"[pub] {who}: falta « {champ} »")
    if p.get("thumb") and not Path(p["thumb"]).exists():
        erro(f"[pub] {who}: vignette não encontrada — {p['thumb']}")
    if p.get("pdf") and not Path(p["pdf"]).exists():
        erro(f"[pub] {who}: PDF não encontrado — {p['pdf']}")
for m in d["membres"]:
    for pid in m.get("publications", []):
        if pid not in ids_pubs:
            erro(f"{m['nom']}: publicação « {pid} » não existe em publications.json")

# ------------------------------------------------------------ trackers
ESPERADO = {
 "data/innovation-data/productivite/productivity.csv":
   ["country", "year", "gdp_per_capita", "labor_productivity", "pgf"],
 "data/innovation-data/breakthrough/timeseries.csv": ["year"],
 "data/innovation-data/innovation-hightech/timeseries.csv": ["year"],
 "data/ai-trackers/diffusion-science/brevets_by_year.csv":
   ["annee", "brevets_total", "brevets_ia"],
}
for f, cols in ESPERADO.items():
    p = Path(f)
    if not p.exists():
        erro(f"[tracker] arquivo ausente: {f}"); continue
    with p.open(encoding="utf-8") as fh:
        r = csv.DictReader(fh)
        faltando = [c for c in cols if c not in (r.fieldnames or [])]
        if faltando: erro(f"[tracker] {f}: faltam as colunas {', '.join(faltando)}")
        n, anos = 0, []
        for row in r:
            n += 1
            a = row.get("year") or row.get("annee")
            if a and a.strip().isdigit(): anos.append(int(a))
        if n == 0: erro(f"[tracker] {f}: arquivo vazio")
        if anos and not (1800 <= min(anos) and max(anos) <= 2035):
            erro(f"[tracker] {f}: anos fora do intervalo plausível ({min(anos)}–{max(anos)})")
        if anos and max(anos) < 2015: aviso(f"[tracker] {f}: dados param em {max(anos)}")

for a in avisos: print(f"⚠️  {a}")
if erros:
    print(f"\n❌ {len(erros)} problema(s):"); [print("   •", e) for e in erros]; sys.exit(1)
print(f"✅ tudo certo — {len(d['membres'])} membros, {len(pubs)} publicações, {len(ESPERADO)} arquivos de tracker")
