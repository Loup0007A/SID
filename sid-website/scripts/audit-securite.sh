#!/usr/bin/env bash
# Contrôle des droits de la base (Lot 96) : RLS, fonctions ouvertes sans
# session, champs privés des fiches, essais avec un vrai membre. Ne modifie
# rien (tout se passe dans une transaction annulée).
#
#   AUDIT_URL=postgres://postgres:…@db.xxx.supabase.co:5432/postgres \
#     bash scripts/audit-securite.sh
#
# Sur Supabase : Project Settings → Database → Connection string (URI).
# Sort en erreur (code 1) s'il y a au moins un « ÉCHEC ».
set -euo pipefail
: "${AUDIT_URL:?AUDIT_URL manquant (chaîne de connexion de la base)}"
ICI=$(cd "$(dirname "$0")" && pwd)
sortie=$(psql "$AUDIT_URL" -X -q -f "$ICI/audit-securite.sql" 2>&1) || { echo "$sortie" >&2; exit 2; }
echo "$sortie" | grep -v '^$'
echo "$sortie" | grep -q '^ÉCHEC' && exit 1
exit 0
