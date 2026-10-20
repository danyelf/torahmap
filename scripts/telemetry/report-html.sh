#!/usr/bin/env bash
# Writes telemetry-report/report.html at the repository's root: what report.sh
# prints, every saved query over the last N days (default 30), as a page.
# Needs what query.sh needs.
set -euo pipefail

days="${1:-30}"
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/../../telemetry-report"
mkdir -p "$out"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for file in "$here"/*.sql; do
  name="$(basename "$file" .sql)"
  "$here/query.sh" "$file" "$days" |
    jq -c --arg name "$name" --rawfile sql "$file" '{name: $name, sql: $sql, meta, data}' \
      >"$tmp/$name.json"
done

# < keeps a "</script>" inside a search term or error message from closing the page's script.
jq -cs --arg fetched "$(date -u +%Y-%m-%dT%H:%MZ)" --argjson days "$days" \
  '{fetched: $fetched, days: $days, queries: .}' "$tmp"/*.json |
  sed 's/</\\u003c/g' >"$tmp/data.json"

awk -v data="$tmp/data.json" -v slot='/*DATA*/ null' '
  (i = index($0, slot)) { getline json < data; $0 = substr($0, 1, i - 1) json substr($0, i + length(slot)) }
  { print }
' "$here/report.html" >"$out/report.html"
echo "$(cd "$out" && pwd)/report.html"
