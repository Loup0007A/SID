#!/usr/bin/env python3
"""
Remplace la monnaie "Cr." (crédits) par "Z" (zenis) dans tout le code du site.

À lancer à la racine du projet (là où se trouve package.json) :
    python3 rename_currency.py            # applique
    python3 rename_currency.py --dry-run  # montre ce qui changerait, sans rien écrire

Ce qui est modifié : src/**/*.ts, src/**/*.tsx, README.md.
Ce qui ne l'est PAS volontairement : les anciennes migrations SQL (ce sont
des archives ; la migration 0046 met à jour les messages déjà en base) et
les fichiers CHANGELOG_* (historique).

Règle appliquée : le mot isolé `Cr.` devient `Z`
    "12 Cr."        -> "12 Z"
    "Cr./action"    -> "Z/action"
    unit: "Cr."     -> unit: "Z"
Un mot comme "Créateur" ou "Crédit" n'est jamais touché (il faut le "Cr"
suivi d'un point, précédé d'une frontière de mot).

Idempotent : relancer le script ne change plus rien.
"""
import re
import sys
from pathlib import Path

root = Path(".")
if not (root / "package.json").exists():
    sys.exit("Lance ce script depuis la racine du projet (dossier contenant package.json).")

dry_run = "--dry-run" in sys.argv

PATTERN = re.compile(r"\bCr\.")

targets = sorted(list((root / "src").rglob("*.ts")) + list((root / "src").rglob("*.tsx")))
readme = root / "README.md"
if readme.exists():
    targets.append(readme)

total_files = 0
total_hits = 0
for f in targets:
    text = f.read_text(encoding="utf-8")
    new_text, n = PATTERN.subn("Z", text)
    if n:
        total_files += 1
        total_hits += n
        print(f"{'(simulé) ' if dry_run else ''}{f} : {n} occurrence(s)")
        if not dry_run:
            f.write_text(new_text, encoding="utf-8")

if total_hits == 0:
    print("Rien à faire (aucune occurrence de « Cr. » trouvée).")
else:
    verb = "seraient remplacées" if dry_run else "remplacées"
    print(f"\n{total_hits} occurrence(s) {verb} dans {total_files} fichier(s).")
