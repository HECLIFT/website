#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pipeline REGPAT sans BigQuery — Secteurs × Pays × Année
========================================================
Ce script remplace entièrement BigQuery. Il utilise directement les fichiers
OECD REGPAT pour produire : pour chaque secteur technologique, la répartition
des brevets PCT par pays d'inventeur et par année de dépôt.

Fichiers requis (OECD REGPAT, Février 2026) :
  - 202602_PCT_IPC.txt     (extraire de 202602_PCT_IPC.7z)
  - 202602_PCT_Inv_reg.txt (extraire de 202602_PCT_Inv_reg.7z)

Structure des fichiers :
  PCT_IPC    : pct_nbr | prio_year | app_year | IPC4
  PCT_Inv_reg: pct_nbr | ... | ctry_code | inv_share | ...

Usage :
  python3 scripts/regpat_sectors_pipeline.py \\
      --ipc-file  data/raw/202602_PCT_IPC.txt \\
      --inv-file  data/raw/202602_PCT_Inv_reg.txt \\
      --out-dir   data/output_regpat \\
      --sectors   ai biotech ict pharma nanotech robotics
"""

import argparse
import os
import sys
import time
from pathlib import Path

import pandas as pd

# =============================================================================
# Définition des secteurs : code_secteur → liste de préfixes IPC/CPC
# =============================================================================
# Pour chaque secteur, on filtre les brevets dont le code IPC commence par
# l'un des préfixes listés. Source : TRACKER.md + OECD Patent Statistics Manual.
#
# NOTE : PCT_IPC contient des codes IPC. Pour les secteurs définis par CPC
# (Green Y02, Semiconducteurs H01L, Batteries H01M 10/, Fabrication additive B33Y),
# les codes CPC G06N et Y02 ne sont PAS dans PCT_IPC — ils sont dans CPC_Classes.
# Dans PCT_IPC, l'IA peut être approchée via G06N (IPC ≈ CPC pour G06N).

SECTORS = {
    # ---------- IPC-based (directs depuis PCT_IPC) ----------
    "ai": {
        "label_fr": "Intelligence artificielle",
        "label_en": "Artificial Intelligence",
        "prefixes": ["G06N"],
        "classification": "IPC",
    },
    "biotech": {
        "label_fr": "Biotechnologie",
        "label_en": "Biotechnology",
        "prefixes": ["A01H", "A01K67", "A61K", "C02F", "C07G", "C07K",
                     "C12M", "C12N", "C12P", "C12Q", "C40B", "G01N", "G06F19"],
        "classification": "IPC",
    },
    "ict": {
        "label_fr": "Technologies de l'information",
        "label_en": "Information and Communication Technologies",
        "prefixes": ["H03", "H04", "G06", "G08", "H01P", "H01Q",
                     "H01S", "H03B", "H03C", "H03D", "H03F", "H03G",
                     "H03H", "H03J"],
        "classification": "IPC",
    },
    "pharma": {
        "label_fr": "Pharmacie",
        "label_en": "Pharmaceuticals",
        "prefixes": ["A61K", "A61P"],
        "classification": "IPC",
    },
    "nanotech": {
        "label_fr": "Nanotechnologie",
        "label_en": "Nanotechnology",
        "prefixes": ["B82"],
        "classification": "IPC",
    },
    "robotics": {
        "label_fr": "Robotique",
        "label_en": "Robotics",
        "prefixes": ["B25J"],
        "classification": "IPC",
    },
    # ---------- CPC-based (approximation via IPC quand possible) ----------
    # Green tech Y02 n'existe pas en IPC — skip ou utiliser CPC_Classes séparément
    # Semiconducteurs H01L existe bien en IPC
    "semiconductors": {
        "label_fr": "Semi-conducteurs",
        "label_en": "Semiconductors",
        "prefixes": ["H01L"],
        "classification": "IPC",
    },
    # Batteries H01M existe en IPC (H01M 10/ = batteries secondaires)
    "batteries": {
        "label_fr": "Batteries / Stockage d'énergie",
        "label_en": "Batteries & Energy Storage",
        "prefixes": ["H01M"],   # on filtre H01M puis on garde H01M10 dans le post-traitement
        "classification": "IPC",
    },
}

# Entités géographiques (même logique que build_tracker_data.py)
EU27 = {
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
    "PL", "PT", "RO", "SK", "SI", "ES", "SE",
}
EUR_EXTRA = {"NO", "CH", "GB"}   # ajoutés à EU pour le mode EUR


def country_to_entity(ctry, mode="EU"):
    """Mappe un code pays ISO-2 vers une entité (EU, EUR, US, CN, JP, RoW)."""
    if ctry == "US":
        return "US"
    if ctry == "CN":
        return "CN"
    if ctry == "JP":
        return "JP"
    if ctry in EU27:
        return "EU" if mode == "EU" else "EUR"
    if mode == "EUR" and ctry in EUR_EXTRA:
        return "EUR"
    return f"RoW_{mode}"


# =============================================================================
# Chargement du fichier IPC (en chunks — peut être très grand)
# =============================================================================
def load_ipc_for_sector(ipc_file: Path, prefixes: list[str], chunksize: int = 2_000_000):
    """
    Lit PCT_IPC.txt et retourne un DataFrame avec les pct_nbr qui matchent
    au moins un préfixe IPC parmi `prefixes`.

    Colonnes retournées : pct_nbr, prio_year
    """
    print(f"  Lecture de {ipc_file.name} (chunks de {chunksize:,})...")

    # Construire un pattern regex : OR de tous les préfixes
    pattern = "|".join(f"^{p}" for p in prefixes)

    kept = []
    total_rows = 0
    t0 = time.time()

    for chunk in pd.read_csv(
        ipc_file,
        sep="|",
        dtype=str,
        usecols=lambda c: c.strip('"') in {"pct_nbr", "prio_year", "app_year", "IPC4"},
        chunksize=chunksize,
        low_memory=False,
        encoding="utf-8",
        quotechar='"',
    ):
        # Nettoyer les noms de colonnes (parfois avec guillemets)
        chunk.columns = [c.strip('"').strip() for c in chunk.columns]
        total_rows += len(chunk)

        # Nettoyer les valeurs
        for col in chunk.columns:
            chunk[col] = chunk[col].astype(str).str.strip('"').str.strip()

        # Filtrer par préfixe IPC
        mask = chunk["IPC4"].str.contains(pattern, regex=True, na=False)
        matched = chunk[mask][["pct_nbr", "prio_year"]].copy()

        if not matched.empty:
            kept.append(matched)

        elapsed = time.time() - t0
        print(f"    {total_rows:>12,} lignes lues, {sum(len(k) for k in kept):>8,} matchées — {elapsed:.0f}s", end="\r")

    print()  # newline after \r
    if not kept:
        print(f"  ⚠ Aucun brevet trouvé pour les préfixes {prefixes}")
        return pd.DataFrame(columns=["pct_nbr", "prio_year"])

    result = pd.concat(kept, ignore_index=True)
    result = result.drop_duplicates(subset=["pct_nbr"])
    result["prio_year"] = pd.to_numeric(result["prio_year"], errors="coerce")
    result = result.dropna(subset=["prio_year"])
    result["prio_year"] = result["prio_year"].astype(int)

    print(f"  → {len(result):,} brevets PCT uniques pour ce secteur")
    return result


# =============================================================================
# Chargement du fichier Inv_reg (filtré sur les pct_nbr du secteur)
# =============================================================================
def load_inv_for_pct_nbrs(inv_file: Path, pct_nbr_set: set, chunksize: int = 1_000_000):
    """
    Lit PCT_Inv_reg.txt et garde uniquement les lignes dont pct_nbr est dans pct_nbr_set.
    Retourne : pct_nbr, ctry_code, inv_share
    """
    print(f"  Lecture de {inv_file.name} pour {len(pct_nbr_set):,} brevets...")

    kept = []
    total_rows = 0
    t0 = time.time()

    for chunk in pd.read_csv(
        inv_file,
        sep="|",
        dtype=str,
        usecols=lambda c: c.strip('"') in {"pct_nbr", "ctry_code", "inv_share"},
        chunksize=chunksize,
        low_memory=False,
        encoding="utf-8",
        quotechar='"',
    ):
        chunk.columns = [c.strip('"').strip() for c in chunk.columns]
        total_rows += len(chunk)

        for col in chunk.columns:
            chunk[col] = chunk[col].astype(str).str.strip('"').str.strip()

        matched = chunk[chunk["pct_nbr"].isin(pct_nbr_set)].copy()
        if not matched.empty:
            kept.append(matched)

        elapsed = time.time() - t0
        print(f"    {total_rows:>12,} lignes lues, {sum(len(k) for k in kept):>8,} matchées — {elapsed:.0f}s", end="\r")

    print()
    if not kept:
        return pd.DataFrame(columns=["pct_nbr", "ctry_code", "inv_share"])

    result = pd.concat(kept, ignore_index=True)
    result["inv_share"] = pd.to_numeric(result["inv_share"], errors="coerce").fillna(0)
    return result


# =============================================================================
# Agrégation : secteur × pays × année → comptages fractionnaires
# =============================================================================
def aggregate_sector(ipc_df: pd.DataFrame, inv_df: pd.DataFrame, sector_key: str):
    """
    Joint ipc_df (pct_nbr, prio_year) avec inv_df (pct_nbr, ctry_code, inv_share)
    et calcule les comptes fractionnaires par pays et année.
    """
    merged = inv_df.merge(ipc_df[["pct_nbr", "prio_year"]], on="pct_nbr", how="inner")

    if merged.empty:
        print(f"  ⚠ Aucune correspondance inventeur trouvée pour {sector_key}")
        return pd.DataFrame()

    # Agrégation par pays × année
    agg = (
        merged.groupby(["ctry_code", "prio_year"])["inv_share"]
        .sum()
        .reset_index()
        .rename(columns={"inv_share": "fractional_patents", "prio_year": "filing_year"})
    )
    agg["sector"] = sector_key
    return agg


# =============================================================================
# Calcul des entités et des parts de marché
# =============================================================================
def build_entity_timeseries(agg_df: pd.DataFrame):
    """
    Convertit le DataFrame pays×année en entités (EU, EUR, US, CN, JP, RoW).
    Produit deux modes : EU-mode et EUR-mode.
    """
    rows = []
    for mode in ["EU", "EUR"]:
        df = agg_df.copy()
        df["entity"] = df["ctry_code"].apply(lambda c: country_to_entity(c, mode))
        entity_agg = (
            df.groupby(["entity", "filing_year", "sector"])["fractional_patents"]
            .sum()
            .reset_index()
        )

        # Calculer les parts (total = somme de toutes les entités cette année-là)
        yearly_total = (
            entity_agg.groupby(["filing_year", "sector"])["fractional_patents"]
            .sum()
            .reset_index()
            .rename(columns={"fractional_patents": "total"})
        )
        entity_agg = entity_agg.merge(yearly_total, on=["filing_year", "sector"])
        entity_agg["share"] = entity_agg["fractional_patents"] / entity_agg["total"]
        entity_agg = entity_agg.drop(columns=["total"])
        rows.append(entity_agg)

    return pd.concat(rows, ignore_index=True).drop_duplicates()


# =============================================================================
# Main
# =============================================================================
def main():
    parser = argparse.ArgumentParser(description="Pipeline REGPAT sans BigQuery")
    parser.add_argument("--ipc-file", required=True, help="Chemin vers PCT_IPC.txt")
    parser.add_argument("--inv-file", required=True, help="Chemin vers PCT_Inv_reg.txt")
    parser.add_argument("--out-dir", default="data/output_regpat", help="Répertoire de sortie")
    parser.add_argument(
        "--sectors", nargs="+", default=list(SECTORS.keys()),
        help=f"Secteurs à traiter. Disponibles: {list(SECTORS.keys())}"
    )
    parser.add_argument("--year-min", type=int, default=1980, help="Année de début")
    parser.add_argument("--year-max", type=int, default=2024, help="Année de fin")
    parser.add_argument("--chunksize", type=int, default=2_000_000, help="Taille des chunks pandas")
    args = parser.parse_args()

    ipc_file = Path(args.ipc_file)
    inv_file = Path(args.inv_file)
    out_dir  = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if not ipc_file.exists():
        print(f"ERREUR: fichier IPC introuvable: {ipc_file}")
        sys.exit(1)
    if not inv_file.exists():
        print(f"ERREUR: fichier Inv_reg introuvable: {inv_file}")
        sys.exit(1)

    all_sector_dfs = []

    for sector_key in args.sectors:
        if sector_key not in SECTORS:
            print(f"⚠ Secteur inconnu: {sector_key}. Disponibles: {list(SECTORS.keys())}")
            continue

        sector = SECTORS[sector_key]
        print(f"\n{'='*60}")
        print(f"SECTEUR: {sector['label_fr']} ({sector_key})")
        print(f"  Préfixes IPC: {sector['prefixes']}")
        print(f"{'='*60}")

        # Étape 1: IPC → liste de pct_nbr pour ce secteur
        ipc_df = load_ipc_for_sector(ipc_file, sector["prefixes"], args.chunksize)

        if ipc_df.empty:
            continue

        # Filtrer par plage d'années
        ipc_df = ipc_df[
            (ipc_df["prio_year"] >= args.year_min) &
            (ipc_df["prio_year"] <= args.year_max)
        ]
        print(f"  Après filtre années {args.year_min}-{args.year_max}: {len(ipc_df):,} brevets")

        # Étape 2: Inv_reg → pays × inv_share pour ces brevets
        pct_set = set(ipc_df["pct_nbr"].tolist())
        inv_df = load_inv_for_pct_nbrs(inv_file, pct_set, chunksize=1_000_000)

        if inv_df.empty:
            continue

        # Étape 3: Agréger par pays × année
        agg = aggregate_sector(ipc_df, inv_df, sector_key)

        if agg.empty:
            continue

        # Sauvegarder le CSV pays-niveau (brut)
        out_csv = out_dir / f"{sector_key}_country_year.csv"
        agg.to_csv(out_csv, index=False)
        print(f"  ✓ Sauvegardé: {out_csv}")

        # Calculer les entités + parts
        entity_df = build_entity_timeseries(agg)
        entity_csv = out_dir / f"{sector_key}_entity_year.csv"
        entity_df.to_csv(entity_csv, index=False)
        print(f"  ✓ Sauvegardé: {entity_csv}")

        all_sector_dfs.append(entity_df)

        # Résumé rapide
        total = agg["fractional_patents"].sum()
        top5 = (
            agg.groupby("ctry_code")["fractional_patents"].sum()
            .sort_values(ascending=False).head(5)
        )
        print(f"  Total brevets fractionnaires: {total:,.0f}")
        print(f"  Top 5 pays: {dict(top5.round(0))}")

    # Fichier combiné tous secteurs
    if all_sector_dfs:
        combined = pd.concat(all_sector_dfs, ignore_index=True)
        combined_csv = out_dir / "all_sectors_entity_year.csv"
        combined.to_csv(combined_csv, index=False)
        print(f"\n✓ Fichier combiné: {combined_csv}")
        print(f"  Secteurs: {combined['sector'].unique().tolist()}")
        print(f"  Années: {combined['filing_year'].min()} – {combined['filing_year'].max()}")


if __name__ == "__main__":
    main()
