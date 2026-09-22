#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convertit les données JOCAS envoyées par Paul vers le format attendu par le site LIFT.

Format Paul :
  - colonne temporelle : numéro de quarter (0 = 2019Q1, 1 = 2019Q2, ...)
  - colonnes données   : ROME_M1403 (absolu) et ROME_M1403_rel (relatif 0-1)

Format site :
  - colonne date       : YYYY-MM-DD (premier jour du quarter)
  - colonnes données   : m1403 - chargé/chargée d'études socio-économiques

Usage :
  python scripts/convert_jocas_paul.py <fichier_paul.csv> <nom_output>

  nom_output : metier_area_data   (toutes les offres)
            ou metier_area_ia    (offres IA uniquement)

Exemples :
  python scripts/convert_jocas_paul.py ~/Downloads/jocas_metiers.csv metier_area_data
  python scripts/convert_jocas_paul.py ~/Downloads/jocas_metiers_ia.csv metier_area_ia

Résultat : data/ai-trackers/diffusion-emploi/<nom_output>.csv
"""

import sys
import csv
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
ROME_XLSX = ROOT / "data" / "ai-trackers" / "diffusion-emploi" / "rome_nomenclature.xlsx"
OUTPUT_DIR = ROOT / "data" / "ai-trackers" / "diffusion-emploi"

QUARTER_ZERO = date(2019, 1, 1)
QUARTER_MONTHS = [1, 4, 7, 10]


def quarter_to_date(q: int) -> str:
    """Quarter index → premier jour du quarter (ex: 0 → '2019-01-01', 1 → '2019-04-01')."""
    total_months = int(q) * 3
    year = QUARTER_ZERO.year + (QUARTER_ZERO.month - 1 + total_months) // 12
    month = (QUARTER_ZERO.month - 1 + total_months) % 12 + 1
    return date(year, month, 1).strftime("%Y-%m-%d")


def load_rome_labels(xlsx_path: Path) -> dict:
    """
    Lit le fichier ROME et retourne un dict {CODE_MAJUSCULE: 'libellé minuscule'}.
    Utilise la première appellation de chaque fiche comme libellé.
    """
    try:
        import pandas as pd
    except ImportError:
        print("pandas requis : pip install pandas openpyxl")
        sys.exit(1)

    df = pd.read_excel(xlsx_path, sheet_name="Arbo Principale 16-12-2024", header=None)
    df.columns = ["grand_domaine", "domaine", "rome", "libelle", "code_ogr"]
    for c in df.columns:
        df[c] = df[c].astype(str).str.strip()
    df = df[df["code_ogr"] != "Code OGR"].copy()
    df = df[df["rome"] != ""].copy()
    df["rome_full"] = df["grand_domaine"] + df["domaine"] + df["rome"]
    fiches = df.groupby("rome_full").first().reset_index()[["rome_full", "libelle"]]
    return {row["rome_full"].upper(): row["libelle"].lower() for _, row in fiches.iterrows()}


def detect_quarter_col(headers: list) -> str:
    """Détecte la colonne contenant les numéros de quarter."""
    for h in headers:
        if h.lower() in ("quarter", "trimestre", "q", "t", "period", "periode", "index"):
            return h
    # Fallback : première colonne non-ROME
    for h in headers:
        if not h.upper().startswith("ROME_"):
            return h
    return headers[0]


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    input_path = Path(sys.argv[1]).expanduser()
    output_name = sys.argv[2]

    if not input_path.exists():
        print(f"Erreur : fichier introuvable → {input_path}")
        sys.exit(1)

    if output_name not in ("metier_area_data", "metier_area_ia"):
        print(f"Attention : nom_output inhabituel '{output_name}' (attendu : metier_area_data ou metier_area_ia)")

    print(f"Chargement du fichier ROME : {ROME_XLSX}")
    rome_labels = load_rome_labels(ROME_XLSX)
    print(f"  → {len(rome_labels)} fiches ROME chargées")

    # Lecture du CSV de Paul
    with open(input_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        headers = reader.fieldnames or []

    if not rows:
        print("Erreur : fichier vide")
        sys.exit(1)

    quarter_col = detect_quarter_col(headers)
    print(f"Colonne quarter détectée : '{quarter_col}'")

    # Colonnes relatives
    rel_cols = [h for h in headers if h.upper().startswith("ROME_") and h.upper().endswith("_REL")]

    if not rel_cols:
        print("Aucune colonne _rel trouvée. Utilisation de toutes les colonnes ROME_.")
        rel_cols = [h for h in headers if h.upper().startswith("ROME_") and not h.upper().endswith("_REL")]

    print(f"  → {len(rel_cols)} colonnes métiers à convertir")

    # Construction des nouveaux noms de colonnes
    col_mapping = {}
    unmatched = []
    for col in rel_cols:
        code = col.upper().replace("ROME_", "").replace("_REL", "")
        label = rome_labels.get(code)
        if label:
            col_mapping[col] = f"{code.lower()} - {label}"
        else:
            col_mapping[col] = code.lower()
            unmatched.append(code)

    if unmatched:
        print(f"  ⚠ Codes sans libellé ROME : {unmatched}")

    # Écriture du fichier de sortie
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"{output_name}.csv"

    out_headers = ["date"] + [col_mapping[c] for c in rel_cols]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(out_headers)
        for row in rows:
            q = row[quarter_col]
            date_str = quarter_to_date(int(float(q)))
            out_row = [date_str] + [row[c] for c in rel_cols]
            writer.writerow(out_row)

    print(f"\nFichier écrit : {output_path}")
    print(f"  {len(rows)} lignes (quarters), {len(rel_cols)} métiers")
    q_min = int(float(rows[0][quarter_col]))
    q_max = int(float(rows[-1][quarter_col]))
    print(f"  Période : {quarter_to_date(q_min)} → {quarter_to_date(q_max)}")


if __name__ == "__main__":
    main()
