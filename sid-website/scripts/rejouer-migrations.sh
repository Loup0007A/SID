#!/usr/bin/env bash
# Rejoue toutes les migrations des trois sites sur une base VIDE, deux fois
# de suite. La deuxième passe vérifie qu'elles se relancent sans risque.
#
#   REJEU_URL=postgres://postgres@localhost:5432/rejeu SID_DIRS=../.. \
#     bash scripts/rejouer-migrations.sh
#
# REJEU_URL : base jetable (elle est remplie). SID_DIRS : dossier qui contient
# sid/, sid-wiki/ et sid-map/ (par défaut : deux dossiers au-dessus du site).
#
# Ordre : chaque site garde l'ordre de ses numéros ; entre les sites, on prend
# la première migration qui passe, en essayant d'abord le Dossier Central, puis
# le Wiki, puis la Cartographie (une migration du Dossier Central peut avoir
# besoin d'une table de la Cartographie). L'ordre obtenu est écrit dans
# supabase/ORDRE_MIGRATIONS.txt : c'est l'ordre à suivre pour une installation
# neuve des trois sites.
#
# Sur un Postgres nu, un socle imitant Supabase (rôles, auth.uid(), stockage)
# est posé d'abord : scripts/rejeu/socle-supabase.sql.
set -euo pipefail
: "${REJEU_URL:?REJEU_URL manquant (base jetable)}"
ICI=$(cd "$(dirname "$0")/.." && pwd)
DIRS=$(cd "${SID_DIRS:-$ICI/../..}" && pwd)
P=(psql "$REJEU_URL" -q -X -v ON_ERROR_STOP=1 --single-transaction)
SORTIE="$ICI/supabase/ORDRE_MIGRATIONS.txt"

if [ "$("${P[@]}" -At -c "select count(*) from information_schema.schemata where schema_name = 'auth'")" = "0" ]; then
  echo "Socle Supabase posé (Postgres nu)."
  "${P[@]}" -f "$ICI/scripts/rejeu/socle-supabase.sql" >/dev/null 2>&1
fi
if [ "$("${P[@]}" -At -c "select count(*) from information_schema.tables where table_schema = 'public'")" != "0" ]; then
  echo "La base n'est pas vide : donne une base jetable." >&2
  exit 2
fi

SITES=(sid/sid-website sid-wiki/sid-wiki sid-map/sid-map)
declare -a FILE0 FILE1 FILE2
mapfile -t FILE0 < <(ls "$DIRS/${SITES[0]}"/supabase/migrations/*.sql)
mapfile -t FILE1 < <(ls "$DIRS/${SITES[1]}"/supabase/migrations/*.sql)
mapfile -t FILE2 < <(ls "$DIRS/${SITES[2]}"/supabase/migrations/*.sql)
pos=(0 0 0)
total=$(( ${#FILE0[@]} + ${#FILE1[@]} + ${#FILE2[@]} ))
ordre=()
erreurs=()

head_of() { local -n arr="FILE$1"; echo "${arr[${pos[$1]}]:-}"; }

# Passe 1 : base vide, ordre construit.
while [ ${#ordre[@]} -lt "$total" ]; do
  avance=0; erreurs=()
  for s in 0 1 2; do
    f=$(head_of "$s"); [ -z "$f" ] && continue
    if msg=$("${P[@]}" -f "$f" 2>&1); then
      ordre+=("${f#"$DIRS"/}"); pos[$s]=$(( pos[s] + 1 )); avance=1; break
    else
      erreurs+=("${f#"$DIRS"/} : $(echo "$msg" | grep -m1 -E "ERROR|ERREUR" | cut -c1-200)")
    fi
  done
  if [ $avance = 0 ]; then
    echo "Passe 1 bloquée après ${#ordre[@]} migrations. Aucune des suivantes ne passe :" >&2
    printf '  %s\n' "${erreurs[@]}" >&2
    exit 1
  fi
done
echo "Passe 1 : ${#ordre[@]} migrations passées sur base vide."

# Passe 2 : tout relancer dans le même ordre, sur la base remplie. Les
# migrations écrites pour être relancées (« Peut être relancée » dans
# l'en-tête) doivent passer ; pour les autres, l'échec est seulement listé.
echecs=(); graves=()
for f in "${ordre[@]}"; do
  if ! msg=$("${P[@]}" -f "$DIRS/$f" 2>&1); then
    ligne="$f : $(echo "$msg" | grep -m1 -E "ERROR|ERREUR" | sed 's/^psql:[^:]*:[0-9]*: //' | cut -c1-160)"
    if grep -qiE "peut être relancée|relançable|rejouable|idempotent" "$DIRS/$f"; then graves+=("$ligne"); else echecs+=("$ligne"); fi
  fi
done
echo "Passe 2 : $(( ${#ordre[@]} - ${#echecs[@]} - ${#graves[@]} )) / ${#ordre[@]} migrations se relancent."
if [ ${#echecs[@]} -gt 0 ]; then
  echo "Anciennes migrations à passer une seule fois (${#echecs[@]}) :"
  printf '  %s\n' "${echecs[@]}"
fi
if [ ${#graves[@]} -gt 0 ]; then
  echo "Annoncées relançables mais en échec (${#graves[@]}) :" >&2
  printf '  %s\n' "${graves[@]}" >&2
  exit 1
fi

{
  echo "# Ordre d'installation des migrations des trois sites (base neuve)."
  echo "# Écrit par scripts/rejouer-migrations.sh : ne pas modifier à la main."
  printf '%s\n' "${ordre[@]}"
} > "$SORTIE"
echo "Ordre écrit dans supabase/ORDRE_MIGRATIONS.txt."
