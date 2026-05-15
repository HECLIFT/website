#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Utilitaires partagés pour les scripts de pré-rendu.
Centralise les fonctions de parsing YAML, dates, et les chemins communs.
"""

import os
import io
import re
from pathlib import Path
from datetime import datetime
from html import escape as html_escape

# =============================================================================
# Chemins du projet
# =============================================================================
ROOT = Path(__file__).resolve().parents[1]  # scripts/ -> racine projet
PUBS_DIR = ROOT / "pubs"
DATA_DIR = ROOT / "data"
INCLUDES_DIR = ROOT / "_includes"
MEMBRES_DIR = ROOT / "membres"

# =============================================================================
# Parsing YAML front matter
# =============================================================================
YAML_RE = re.compile(r"^---\s*(.*?)\s*---", re.S | re.M)


def read_yaml_frontmatter(file_path):
    """
    Lit le front matter YAML d'un fichier .qmd.
    Supporte PyYAML si disponible, sinon fallback simple.

    Args:
        file_path: Chemin vers le fichier (str ou Path)

    Returns:
        dict avec les clés/valeurs du front matter
    """
    try:
        with io.open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
    except Exception:
        return {}

    m = YAML_RE.match(text)
    if not m:
        return {}

    block = m.group(1)

    # Essayer PyYAML si disponible
    try:
        import yaml
        return yaml.safe_load(block) or {}
    except ImportError:
        pass
    except Exception:
        pass

    # Fallback: parsing simple ligne par ligne
    fm = {}
    for line in block.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, val = line.split(":", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            # Gérer les listes simples [a, b, c]
            if val.startswith("[") and val.endswith("]"):
                val = [x.strip().strip("[],'\"") for x in val[1:-1].split(",") if x.strip()]
            fm[key] = val
    return fm


def read_metadata_yaml(meta_path):
    """
    Lit un fichier _metadata.yml minimal.

    Args:
        meta_path: Chemin vers le fichier _metadata.yml

    Returns:
        dict avec au moins 'pdf' et 'image' si présents
    """
    out = {}
    if not os.path.exists(meta_path):
        return out
    try:
        with io.open(meta_path, "r", encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#") or ":" not in line:
                    continue
                key, val = line.split(":", 1)
                out[key.strip()] = val.strip().strip('"').strip("'")
    except Exception:
        pass
    return out


# =============================================================================
# Parsing et formatage des dates
# =============================================================================
MONTHS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"
]


def parse_date(date_str):
    """
    Parse une date depuis plusieurs formats possibles.

    Args:
        date_str: Chaîne de date (YYYY-MM-DD, ISO 8601, YYYY/MM/DD)

    Returns:
        datetime ou None si échec
    """
    if not date_str:
        return None

    # Nettoyer la chaîne
    date_str = str(date_str).strip()

    # Essayer fromisoformat d'abord (plus flexible)
    try:
        return datetime.fromisoformat(date_str)
    except (ValueError, TypeError):
        pass

    # Essayer différents formats
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            pass

    return None


def format_date_fr(date_str):
    """
    Formate une date en français (ex: "15 janvier 2024").

    Args:
        date_str: Chaîne de date ISO

    Returns:
        Date formatée en français ou la chaîne originale si échec
    """
    if not date_str:
        return ""
    d = parse_date(date_str)
    if d is None:
        return str(date_str)
    return f"{d.day} {MONTHS_FR[d.month - 1]} {d.year}"


# =============================================================================
# Utilitaires divers
# =============================================================================
def escape_html(text):
    """Échappe le texte pour insertion dans du HTML."""
    if text is None:
        return ""
    return html_escape(str(text), quote=True)


def ensure_dir(path):
    """Crée un répertoire s'il n'existe pas."""
    Path(path).mkdir(parents=True, exist_ok=True)
