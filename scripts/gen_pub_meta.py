#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère/maintient les fichiers _metadata.yml pour chaque publication.
Assure que 'pdf' et 'image' ont des valeurs par défaut.
"""

import io
import os
import sys

from utils import PUBS_DIR


def ensure_line(lines, key, value):
    """Ajoute `key: value` s'il n'existe pas déjà dans le fichier."""
    has = any(l.strip().startswith(f"{key}:") for l in lines)
    if not has:
        lines.append(f'{key}: "{value}"\n')
    return lines


def process_pub_dir(dirpath):
    """Traite un répertoire de publication."""
    slug = os.path.basename(dirpath)
    index_qmd = os.path.join(dirpath, "index.qmd")
    if not os.path.exists(index_qmd):
        return

    meta_path = os.path.join(dirpath, "_metadata.yml")
    lines = []
    if os.path.exists(meta_path):
        with io.open(meta_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    else:
        lines = ["# Auto-généré (pre-render) — champs par défaut pour le listing\n"]

    pdf = f"/files/papers/{slug}.pdf"
    image = f"/images/pubs/{slug}.png"

    original_lines = list(lines)
    lines = ensure_line(lines, "pdf", pdf)
    lines = ensure_line(lines, "image", image)

    # N'écrire que si le contenu a changé (évite de déclencher le file-watcher Quarto)
    if lines != original_lines or not os.path.exists(meta_path):
        with io.open(meta_path, "w", encoding="utf-8") as f:
            f.writelines(lines)


def main():
    if not PUBS_DIR.is_dir():
        sys.exit(0)

    for name in os.listdir(PUBS_DIR):
        dirpath = PUBS_DIR / name
        if dirpath.is_dir():
            process_pub_dir(dirpath)


if __name__ == "__main__":
    main()
