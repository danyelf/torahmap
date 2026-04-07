#!/usr/bin/env bash
# Show open issues sorted by priority. Equivalent of `bd ready`.
set -euo pipefail

shopt -s nullglob
files=(issues/open/*.md)
if (( ${#files[@]} == 0 )); then
  echo "no open issues"
  exit 0
fi

for f in "${files[@]}"; do
  prio=$(awk '/^priority:/ {print $2; exit}' "$f")
  itype=$(awk '/^type:/ {print $2; exit}' "$f")
  title=$(awk '/^# / {sub(/^# /, ""); print; exit}' "$f")
  printf '%s\t%s\t%-7s\t%s\n' "${prio:-2}" "$(basename "$f" .md)" "${itype:-task}" "$title"
done | sort -k1,1n
