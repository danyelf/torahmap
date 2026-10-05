#!/usr/bin/env bash
# Print each saved query's result over the last N days (default 30).
# Needs what query.sh needs. Column meanings are in src/telemetry/schema.ts.
set -euo pipefail

days="${1:-30}"
here="$(cd "$(dirname "$0")" && pwd)"

for file in "$here"/*.sql; do
  echo "== $(basename "$file" .sql) (last $days days)"
  "$here/query.sh" "$file" "$days" |
    # column collapses empty cells, shifting the rest of the row; show blanks as –.
    jq -r '(.meta | map(.name)) as $c | ($c | @tsv),
      (.data[] | [.[$c[]] | if . == "" then "–" else . end] | @tsv)' |
    column -t -s $'\t'
  echo
done
