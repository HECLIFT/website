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
    for champ in ("id", "nom", "section", "role"):
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
    if p.get("pdf_en") and not Path(p["pdf_en"]).exists():
        erro(f"[pub] {who}: PDF anglais introuvable — {p['pdf_en']}")
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

# --------------------------------------------- tracker des métiers exposés (format des fichiers livrés)
# Contrat décrit dans 04_Website/TRACKERS.md du dossier LIFT (section « Métiers exposés : fichiers livrés par la chaîne »).
ME = Path("data/ai-trackers/metiers-exposes")
ME_COLS = {
 "embauches_tendances.csv": ["definition", "mois", "groupe", "age", "sexe", "embauches_cdi", "embauches_cdd", "fins_cdi", "fins_cdd"],
 "embauches_effectifs.csv": ["definition", "mois", "groupe", "age", "sexe", "embauches_cdi", "embauches_cdd", "fins_cdi", "fins_cdd"],
 "professions.csv": ["pcs", "pcs03", "libelle", "fap", "libelle_fap", "famille", "indice", "centile", "groupe", "atlas", "origine", "agregat",
                     "salaries", "part_femmes", "age_moyen", "part_moins_30", "salaire_horaire_net", "part_cdi",
                     "part_fonctionnaires", "part_temps_partiel", "part_apprentis"],
 "quintiles_profil.csv": ["indicateur", "unite", "q1", "q2", "q3", "q4", "q5", "ensemble"],
 "fap.csv": ["fap", "libelle", "indice", "atlas", "salaries", "pcs"],
 "zones.csv": ["zone", "libelle", "libelle_insee", "indice_moyen", "centile_moyen", "salaries", "part_g1", "part_g2", "part_g3", "part_g4", "part_g5"],
 "rome_metiers.csv": ["rome", "intitule", "domaine", "n_savoir_faire", "s", "rang_pct", "voie", "fiche_parente"],
 "rome_appellations.csv": ["appellation", "rome"],
 "rome_professions.csv": ["rome", "pcs03", "part_salaries", "pcs_ese", "pcs03_lib"],
 "intitules_insee.csv": ["libelle", "libelle_f", "statut", "niveaux", "defaut", "pcs2020", "pcs", "parts"],
}
if ME.exists():
    lus = {}
    for f, cols in ME_COLS.items():
        p = ME / f
        if not p.exists(): erro(f"[métiers exposés] fichier absent : {f}"); continue
        with p.open(encoding="utf-8") as fh:
            r = csv.DictReader(fh)
            if (r.fieldnames or []) != cols: erro(f"[métiers exposés] {f} : colonnes attendues {', '.join(cols)}")
            lus[f] = list(r)
        if not lus[f]: erro(f"[métiers exposés] {f} : fichier vide")
    try:
        meta = json.loads((ME / "tracker.json").read_text(encoding="utf-8"))
    except Exception as e:
        meta = None; erro(f"[métiers exposés] tracker.json illisible : {e}")
    T_ = lus.get("embauches_tendances.csv") or []
    if T_ and meta:
        mois = sorted({x["mois"] for x in T_})
        a, m = map(int, mois[0].split("-")); attendu = []
        while f"{a:04d}-{m:02d}" <= mois[-1]:
            attendu.append(f"{a:04d}-{m:02d}"); m += 1
            if m == 13: a, m = a + 1, 1
        if mois != attendu: erro("[métiers exposés] embauches_tendances.csv : mois manquants")
        if mois[-1] != meta.get("donnees_au"): erro(f"[métiers exposés] dernier mois {mois[-1]} différent de donnees_au {meta.get('donnees_au')} (tracker.json)")
        cles = [(x["definition"], x["mois"], x["groupe"], x["age"], x["sexe"]) for x in T_]
        if len(cles) != len(set(cles)): erro("[métiers exposés] embauches_tendances.csv : lignes en double")
        for x in T_:
            if x["mois"] == "2022-11" and x["embauches_cdi"] not in ("", "0", "0.0", "0.0000") and abs(float(x["embauches_cdi"])) > 1e-6:
                erro("[métiers exposés] embauches_tendances.csv : la tendance doit valoir 0 en novembre 2022"); break
        for x in T_:
            if x["definition"] not in ("salaries", "metiers") or x["groupe"] not in "12345" or x["sexe"] not in ("F", "H", "tous"):
                erro(f"[métiers exposés] embauches_tendances.csv : valeur inattendue {x['definition']}, {x['groupe']}, {x['sexe']}"); break
    for x in lus.get("professions.csv") or []:
        for k in ("part_femmes", "part_moins_30", "part_cdi", "part_fonctionnaires", "part_temps_partiel", "part_apprentis"):
            if x[k] and not 0 <= float(x[k]) <= 1: erro(f"[métiers exposés] professions.csv : {k} hors de [0, 1] pour {x['pcs']}"); break
        if x["groupe"] and x["groupe"] not in "12345": erro(f"[métiers exposés] professions.csv : groupe inattendu pour {x['pcs']}")
    if meta:
        for f, dd in (meta.get("fichiers") or {}).items():
            p = ME / f
            if p.exists() and dd.get("octets") != p.stat().st_size:
                aviso(f"[métiers exposés] tracker.json : taille de {f} à mettre à jour")

# --------------------------------------------- mesure d'audience (GoatCounter)
# Toute page servie porte le script juste avant </head> ; les iframes de assets/ n'en ont pas.
for f in sorted(Path(".").rglob("*.html")):
    s_ = str(f)
    if s_.startswith((".git/", "site_libs/", "assets/", "content/", "build/")):
        continue
    if "heclift.goatcounter.com/count" not in f.read_text(encoding="utf-8"):
        erro(f"[audiência] {s_}: falta o script do GoatCounter antes de </head> (ver AGENTS.md)")

# --------------------------------------------- langues (pages anglaises sous en/)
interface = json.loads(Path("content/interface.json").read_text())
if set(interface["fr"]) != set(interface["en"]):
    erro(f"[langues] content/interface.json : clés différentes entre fr et en : {sorted(set(interface['fr']) ^ set(interface['en']))}")
RE_SQUELETTE = re.compile(r'<(/?[a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*)?)>')
def squelette(texte):
    """Suite des balises avec leurs id et classes : doit être la même en français et en anglais."""
    out = []
    for nom, attrs in RE_SQUELETTE.findall(texte):
        ident = re.search(r'\bid="([^"]*)"', attrs)
        classe = re.search(r'\bclass="([^"]*)"', attrs)
        out.append((nom.lower(), ident.group(1) if ident else "", classe.group(1) if classe else ""))
    return out
for p in json.loads(Path("content/pages.json").read_text())["pages"]:
    for lang in p["langues"]:
        if not Path("content/pages", lang, p["chemin"]).exists():
            erro(f"[langues] fragment absent : content/pages/{lang}/{p['chemin']}")
    if "en" in p["langues"] and Path("content/pages/en", p["chemin"]).exists():
        sq_fr = squelette(Path("content/pages/fr", p["chemin"]).read_text())
        sq_en = squelette(Path("content/pages/en", p["chemin"]).read_text())
        if sq_fr != sq_en:
            k = next((i for i, (a, b) in enumerate(zip(sq_fr, sq_en)) if a != b), min(len(sq_fr), len(sq_en)))
            erro(f"[langues] {p['chemin']} : la structure de la version anglaise s'écarte de la française "
                 f"à la balise n° {k + 1} ({sq_fr[k] if k < len(sq_fr) else 'fin'} / {sq_en[k] if k < len(sq_en) else 'fin'})")
for f in sorted(Path(".").rglob("*.html")):
    s_ = str(f)
    if s_.startswith((".git/", "site_libs/", "assets/", "content/", "build/")):
        continue
    attendu = "en" if s_.startswith("en/") else "fr"
    m_ = re.search(r'<html[^>]*\blang="([a-z]+)"', f.read_text(encoding="utf-8"))
    if not m_ or m_.group(1) != attendu:
        erro(f"[langues] {s_} : <html lang> devrait valoir « {attendu} »")

for a in avisos: print(f"⚠️  {a}")
if erros:
    print(f"\n❌ {len(erros)} problema(s):"); [print("   •", e) for e in erros]; sys.exit(1)
print(f"✅ tudo certo — {len(d['membres'])} membros, {len(pubs)} publicações, {len(ESPERADO)} arquivos de tracker")
