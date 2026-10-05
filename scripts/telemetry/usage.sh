#!/usr/bin/env bash
# Writes telemetry-report/usage.html at the repository's root: page views per
# day over the last N days (default 90), with the data built into the page.
# Needs what query.sh needs.
set -euo pipefail

days="${1:-90}"
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/../../telemetry-report"
mkdir -p "$out"

visits="$("$here/query.sh" "$here/visits.sql" "$days")"
referrers="$("$here/query.sh" "$here/referrers.sql" "$days")"
# < keeps a "</script>" inside a referrer from closing the page's script.
jq -cn --argjson visits "$visits" --argjson referrers "$referrers" \
  --arg fetched "$(date -u +%Y-%m-%dT%H:%MZ)" \
  '{fetched: $fetched, visits: $visits.data, referrers: $referrers.data}' |
  sed 's/</\\u003c/g' >"$out/data.json"

awk -v data="$out/data.json" -v slot='/*DATA*/ null' '
  (i = index($0, slot)) { getline json < data; $0 = substr($0, 1, i - 1) json substr($0, i + length(slot)) }
  { print }
' "$here/usage.html" >"$out/usage.html"
rm "$out/data.json"
echo "$(cd "$out" && pwd)/usage.html"
