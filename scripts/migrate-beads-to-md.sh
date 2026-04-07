#!/usr/bin/env bash
# One-shot migration: .beads/issues.jsonl -> issues/{open,closed}/*.md
# Safe to re-run: skips files that already exist.
set -euo pipefail

SRC=".beads/issues.jsonl"
[[ -f "$SRC" ]] || { echo "no $SRC"; exit 1; }

mkdir -p issues/open issues/closed

count_open=0
count_closed=0

while IFS= read -r line; do
  id=$(jq -r '.id' <<<"$line")
  status=$(jq -r '.status' <<<"$line")
  title=$(jq -r '.title' <<<"$line")
  description=$(jq -r '.description // ""' <<<"$line")
  priority=$(jq -r '.priority // 2' <<<"$line")
  itype=$(jq -r '.issue_type // "task"' <<<"$line")
  created=$(jq -r '.created_at // ""' <<<"$line" | cut -d'T' -f1)
  closed=$(jq -r '.closed_at // ""' <<<"$line" | cut -d'T' -f1)

  # filename slug from title
  slug=$(printf '%s' "$title" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' \
    | cut -c1-60)

  case "$status" in
    closed) dir="issues/closed" ;;
    *)      dir="issues/open"   ;;
  esac

  fname="$dir/${id}-${slug}.md"
  if [[ -e "$fname" ]]; then
    continue
  fi

  {
    echo "---"
    echo "id: $id"
    echo "status: $status"
    echo "priority: $priority"
    echo "type: $itype"
    [[ -n "$created" ]] && echo "created: $created"
    [[ "$status" == "closed" && -n "$closed" ]] && echo "closed: $closed"
    echo "---"
    echo
    echo "# $title"
    echo
    echo "$description"
  } > "$fname"

  if [[ "$status" == "closed" ]]; then
    count_closed=$((count_closed + 1))
  else
    count_open=$((count_open + 1))
  fi
done < "$SRC"

echo "migrated: $count_open open, $count_closed closed"
