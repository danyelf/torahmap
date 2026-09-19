#!/usr/bin/env bash
# Print each saved query's result over the last N days (default 30).
# Needs CLOUDFLARE_ACCOUNT_ID, and CLOUDFLARE_API_TOKEN with Account Analytics: Read.
# Column meanings are in src/telemetry/schema.ts.
set -euo pipefail

days="${1:-30}"
# What {{SITE}} in each query expands to: the live site's rows in the window.
site="blob5 = 'torahmap.org' AND timestamp > NOW() - INTERVAL '$days' DAY"
here="$(cd "$(dirname "$0")" && pwd)"
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"

for file in "$here"/*.sql; do
  echo "== $(basename "$file" .sql) (last $days days)"
  sed "s/{{SITE}}/$site/g" "$file" | tr '\n' ' ' | sed 's/$/ FORMAT JSON/' |
    curl -sS --fail-with-body \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" --data-binary @- |
    jq -r '(.meta | map(.name)) as $c | ($c | @tsv), (.data[] | [.[$c[]]] | @tsv)' |
    column -t -s $'\t'
  echo
done
