#!/usr/bin/env bash
# Create a new issue: ./scripts/issues-new.sh "Title" [type] [priority]
set -euo pipefail

title="${1:?usage: issues-new.sh \"title\" [type] [priority]}"
itype="${2:-task}"
priority="${3:-2}"

id="tm-$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c4)"
slug=$(printf '%s' "$title" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' \
  | cut -c1-60)
created=$(date +%Y-%m-%d)

fname="issues/open/${id}-${slug}.md"
cat > "$fname" <<EOF
---
id: $id
status: open
priority: $priority
type: $itype
created: $created
---

# $title

EOF

echo "$fname"
${EDITOR:-vi} "$fname" || true
