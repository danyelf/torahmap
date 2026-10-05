#!/usr/bin/env bash
# Runs one saved query over the last N days (default 30) and prints the JSON
# Analytics Engine returns. Usage: query.sh <file.sql> [days]
# Needs CLOUDFLARE_ACCOUNT_ID, and CLOUDFLARE_API_TOKEN with Account Analytics: Read.
set -euo pipefail

file="$1"
days="${2:-30}"
# What {{SITE}} in each query expands to: the live site's rows in the window.
site="blob5 = 'torahmap.org' AND timestamp > NOW() - INTERVAL '$days' DAY"
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"

sed "s/{{SITE}}/$site/g" "$file" | tr '\n' ' ' | sed 's/$/ FORMAT JSON/' |
  curl -sS --fail-with-body \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" --data-binary @-
