#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Valide les fichiers de données des trackers d'innovation.
- Tracker Productivité: productivity.csv + countries.json
- Tracker Breakthrough: timeseries.csv + countries.json + sectors.json
- Tracker Innovation High-Tech: timeseries.csv + summary.json + entities.json
"""

import json
import sys
import csv
from pathlib import Path

# Chemins
ROOT = Path(__file__).resolve().parents[1]

# Plage d'années valide
YEAR_MIN = 1800
YEAR_MAX = 2030


# =============================================================================
# TRACKER PRODUCTIVITÉ
# =============================================================================

def validate_productivity_tracker():
    """Valide les données du tracker de productivité."""
    print("\n  [Productivité]")

    data_dir = ROOT / "data" / "innovation-data" / "productivite"
    csv_file = data_dir / "productivity.csv"
    countries_file = data_dir / "countries.json"

    required_columns = ["country", "year", "gdp_per_capita", "labor_productivity", "pgf"]
    numeric_columns = ["gdp_per_capita", "labor_productivity", "pgf"]

    errors = []
    warnings = []
    stats = {"rows": 0, "countries": set(), "years": set()}

    # Valider CSV
    if not csv_file.exists():
        errors.append(f"Fichier CSV introuvable: {csv_file}")
    else:
        try:
            with open(csv_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)

                if reader.fieldnames:
                    missing = set(required_columns) - set(reader.fieldnames)
                    if missing:
                        errors.append(f"Colonnes manquantes: {', '.join(missing)}")
                    else:
                        for i, row in enumerate(reader, start=2):
                            stats["rows"] += 1

                            country = row.get("country", "").strip()
                            if not country:
                                errors.append(f"Ligne {i}: code pays vide")
                            else:
                                stats["countries"].add(country)

                            try:
                                year = int(row.get("year", 0))
                                if year < YEAR_MIN or year > YEAR_MAX:
                                    warnings.append(f"Ligne {i}: année hors plage ({year})")
                                stats["years"].add(year)
                            except (ValueError, TypeError):
                                errors.append(f"Ligne {i}: année invalide")

                            for col in numeric_columns:
                                val = row.get(col, "")
                                if val:
                                    try:
                                        v = float(val)
                                        if v < 0:
                                            warnings.append(f"Ligne {i}: {col} négatif")
                                    except (ValueError, TypeError):
                                        errors.append(f"Ligne {i}: {col} invalide")

        except Exception as e:
            errors.append(f"Erreur lecture CSV: {e}")

    # Valider countries.json
    json_countries = set()
    if not countries_file.exists():
        errors.append(f"Fichier countries.json introuvable")
    else:
        try:
            with open(countries_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for code, info in data.items():
                json_countries.add(code)
                if not isinstance(info, dict) or "name" not in info:
                    errors.append(f"Pays {code}: format invalide")
        except Exception as e:
            errors.append(f"Erreur countries.json: {e}")

    # Validation croisée
    if stats["countries"] and json_countries:
        missing = stats["countries"] - json_countries
        if missing:
            warnings.append(f"Pays sans métadonnées: {', '.join(sorted(missing))}")

    # Afficher stats
    if stats["rows"] > 0:
        year_min = min(stats["years"]) if stats["years"] else 0
        year_max = max(stats["years"]) if stats["years"] else 0
        print(f"    - {stats['rows']} lignes, {len(stats['countries'])} pays, {year_min}-{year_max}")

    return errors, warnings


# =============================================================================
# TRACKER BREAKTHROUGH
# =============================================================================

def validate_breakthrough_tracker():
    """Valide les données du tracker breakthrough/novelty."""
    print("\n  [Breakthrough]")

    data_dir = ROOT / "data" / "innovation-data" / "breakthrough"
    csv_file = data_dir / "timeseries.csv"
    countries_file = data_dir / "countries.json"

    required_columns = ["year", "country", "nouveaute_per_million", "influence_per_million", "rupture_per_million"]
    numeric_columns = ["nouveaute_per_million", "influence_per_million", "rupture_per_million"]

    errors = []
    warnings = []
    stats = {"rows": 0, "countries": set(), "years": set()}

    # Valider CSV
    if not csv_file.exists():
        warnings.append(f"Fichier timeseries.csv introuvable (données à générer)")
    else:
        try:
            with open(csv_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)

                if reader.fieldnames:
                    missing = set(required_columns) - set(reader.fieldnames)
                    if missing:
                        errors.append(f"Colonnes manquantes: {', '.join(missing)}")
                    else:
                        for i, row in enumerate(reader, start=2):
                            stats["rows"] += 1

                            country = row.get("country", "").strip()
                            if country:
                                stats["countries"].add(country)

                            try:
                                year = int(row.get("year", 0))
                                if year < YEAR_MIN or year > YEAR_MAX:
                                    warnings.append(f"Ligne {i}: année hors plage ({year})")
                                stats["years"].add(year)
                            except (ValueError, TypeError):
                                errors.append(f"Ligne {i}: année invalide")

                            for col in numeric_columns:
                                val = row.get(col, "")
                                if val:
                                    try:
                                        float(val)
                                    except (ValueError, TypeError):
                                        errors.append(f"Ligne {i}: {col} invalide")

        except Exception as e:
            errors.append(f"Erreur lecture CSV: {e}")

    # Valider countries.json
    json_countries = set()
    if not countries_file.exists():
        errors.append(f"Fichier countries.json introuvable")
    else:
        try:
            with open(countries_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for code, info in data.items():
                json_countries.add(code)
                if not isinstance(info, dict) or "name" not in info:
                    errors.append(f"Pays {code}: format invalide")
        except Exception as e:
            errors.append(f"Erreur countries.json: {e}")

    # Validation croisée
    if stats["countries"] and json_countries:
        missing = stats["countries"] - json_countries
        if missing:
            warnings.append(f"Pays sans métadonnées: {', '.join(sorted(missing))}")

    # Afficher stats
    if stats["rows"] > 0:
        year_min = min(stats["years"]) if stats["years"] else 0
        year_max = max(stats["years"]) if stats["years"] else 0
        print(f"    - {stats['rows']} lignes, {len(stats['countries'])} pays, {year_min}-{year_max}")
    else:
        print("    - Pas de données (à générer)")

    return errors, warnings


# =============================================================================
# TRACKER INNOVATION HIGH-TECH
# =============================================================================

def validate_innovation_hightech_tracker():
    """Valide les données du tracker innovation high-tech."""
    print("\n  [Innovation High-Tech]")

    data_dir = ROOT / "data" / "innovation-data" / "innovation-hightech"
    csv_file = data_dir / "timeseries.csv"
    summary_file = data_dir / "summary.json"
    entities_file = data_dir / "entities.json"

    required_columns = ["year", "entity", "fractional_patents", "share", "sector"]
    numeric_columns = ["fractional_patents", "share"]
    valid_entities = {"EU", "EUR", "US", "CN", "JP", "RoW_EU", "RoW_EUR"}

    errors = []
    warnings = []
    stats = {"rows": 0, "entities": set(), "sectors": set(), "years": set()}

    # Valider CSV
    if not csv_file.exists():
        warnings.append("Fichier timeseries.csv introuvable (données à générer)")
    else:
        try:
            with open(csv_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)

                if reader.fieldnames:
                    missing = set(required_columns) - set(reader.fieldnames)
                    if missing:
                        errors.append(f"Colonnes manquantes: {', '.join(missing)}")
                    else:
                        for i, row in enumerate(reader, start=2):
                            stats["rows"] += 1

                            entity = row.get("entity", "").strip()
                            if entity:
                                stats["entities"].add(entity)
                                if entity not in valid_entities:
                                    errors.append(f"Ligne {i}: entité inconnue '{entity}'")

                            sector = row.get("sector", "").strip()
                            if sector:
                                stats["sectors"].add(sector)

                            try:
                                year = int(row.get("year", 0))
                                if year < YEAR_MIN or year > YEAR_MAX:
                                    warnings.append(f"Ligne {i}: année hors plage ({year})")
                                stats["years"].add(year)
                            except (ValueError, TypeError):
                                errors.append(f"Ligne {i}: année invalide")

                            for col in numeric_columns:
                                val = row.get(col, "")
                                if val:
                                    try:
                                        float(val)
                                    except (ValueError, TypeError):
                                        errors.append(f"Ligne {i}: {col} invalide")

        except Exception as e:
            errors.append(f"Erreur lecture CSV: {e}")

    # Valider summary.json
    json_sectors = set()
    if not summary_file.exists():
        warnings.append("Fichier summary.json introuvable")
    else:
        try:
            with open(summary_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "sectors" not in data:
                errors.append("summary.json: clé 'sectors' manquante")
            else:
                for code, info in data["sectors"].items():
                    json_sectors.add(code)
                    if not isinstance(info, dict) or "label_fr" not in info:
                        errors.append(f"Secteur {code}: format invalide")
        except Exception as e:
            errors.append(f"Erreur summary.json: {e}")

    # Valider entities.json
    if not entities_file.exists():
        warnings.append("Fichier entities.json introuvable")
    else:
        try:
            with open(entities_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for code, info in data.items():
                if not isinstance(info, dict) or "name" not in info:
                    errors.append(f"Entité {code}: format invalide")
        except Exception as e:
            errors.append(f"Erreur entities.json: {e}")

    # Validation croisée
    if stats["sectors"] and json_sectors:
        missing = stats["sectors"] - json_sectors
        if missing:
            warnings.append(f"Secteurs sans métadonnées: {', '.join(sorted(missing))}")

    # Afficher stats
    if stats["rows"] > 0:
        year_min = min(stats["years"]) if stats["years"] else 0
        year_max = max(stats["years"]) if stats["years"] else 0
        print(f"    - {stats['rows']} lignes, {len(stats['sectors'])} secteurs, "
              f"{len(stats['entities'])} entités, {year_min}-{year_max}")
    else:
        print("    - Pas de données (à générer)")

    return errors, warnings


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("[build_tracker_data] Validation des données des trackers...")

    all_errors = []
    all_warnings = []

    # Valider chaque tracker
    errors, warnings = validate_productivity_tracker()
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    errors, warnings = validate_breakthrough_tracker()
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    errors, warnings = validate_innovation_hightech_tracker()
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    # Afficher les résultats
    if all_errors:
        print("\n  ERREURS:")
        for err in all_errors:
            print(f"    - {err}")
        print(f"\n[build_tracker_data] {len(all_errors)} erreur(s) trouvée(s)")
        sys.exit(1)

    if all_warnings:
        print("\n  AVERTISSEMENTS:")
        for warn in all_warnings[:10]:  # Limiter à 10
            print(f"    - {warn}")
        if len(all_warnings) > 10:
            print(f"    ... et {len(all_warnings) - 10} autres")

    print("\n[build_tracker_data] Validation OK")


if __name__ == "__main__":
    main()
