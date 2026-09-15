#!/usr/bin/env bash
#
# Refresh public/data/commentary-counts.json from Sefaria's links export.
#
# Downloads the links CSVs (skipping any already present at the right size),
# regenerates the counts, and reports what moved. Sefaria re-exports on the 1st
# of each month, so there is no point running this more often than monthly.
#
# Usage:
#   scripts/refresh-commentary-counts.sh            # refresh
#   scripts/refresh-commentary-counts.sh --force    # re-download everything
#
set -euo pipefail

BUCKET="https://storage.googleapis.com/sefaria-export/links"
INDEX_URL="https://www.sefaria.org/api/index/"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LINKS_DIR="$PROJECT_ROOT/data/sefaria-links"
INDEX="$PROJECT_ROOT/data/sefaria-index.json"
COUNTS="$PROJECT_ROOT/public/data/commentary-counts.json"

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

# Header field for a file in the bucket, or empty if it is not there.
remote_header() {
  curl -sfI "$BUCKET/links$1.csv" 2>/dev/null | tr -d '\r' \
    | awk -v want="$2" 'tolower($1) == want":" {print $2}'
}

# How many files the export has. Ask the bucket rather than hardcoding a range:
# the count has grown before (13 -> 17), and downloading a short range gives you
# a partial corpus that still processes cleanly and is wrong in ways that are
# hard to spot, because the files are split alphabetically by source text.
echo "Checking how many files the export has..."
count=0
while [[ $count -lt 100 ]] && curl -sfI "$BUCKET/links$count.csv" >/dev/null 2>&1; do
  count=$((count + 1))
done

if [[ $count -eq 0 ]]; then
  echo "Could not reach $BUCKET — is the bucket still there?" >&2
  exit 1
fi

# The date Sefaria built this export. Worth noting alongside the counts: it is
# how old the shipped data is, whatever the commit date says.
export_date="$(curl -sfI "$BUCKET/links0.csv" | tr -d '\r' \
  | grep -i '^last-modified:' | cut -d' ' -f2- || true)"
last=$((count - 1))
echo "Export has $count files (links0..links$last)."
[[ -n "$export_date" ]] && echo "Exported: $export_date"

mkdir -p "$LINKS_DIR"

echo
for i in $(seq 0 "$last"); do
  file="$LINKS_DIR/links$i.csv"
  remote_size="$(remote_header "$i" 'content-length')"
  if [[ $FORCE -eq 0 && -f "$file" ]]; then
    local_size="$(wc -c < "$file" | tr -d ' ')"
    if [[ "$local_size" == "$remote_size" ]]; then
      echo "  links$i.csv — already current, skipping"
      continue
    fi
  fi
  echo "  links$i.csv — downloading ($(( ${remote_size:-0} / 1024 / 1024 ))MB)"
  curl -sf -o "$file" "$BUCKET/links$i.csv"
done

total_mb=$(du -smL "$LINKS_DIR" | cut -f1)
echo
echo "Links CSVs: ${total_mb}MB in $LINKS_DIR (gitignored)"

# Sefaria's index of the library. The links export says which shelf a text is
# filed on, which for a commentary is the shelf of whatever it comments on —
# Rashi comes back as Tanakh, Ben Yehoyada as Talmud. The index says what each
# text actually is, and without it a category called Mishnah is mostly not the
# Mishnah. Fetched every time: it is 4MB and it must describe the same library
# the links describe.
echo
echo "Downloading Sefaria's library index..."
if ! curl -sf --max-time 300 -o "$INDEX.tmp" "$INDEX_URL"; then
  rm -f "$INDEX.tmp"
  echo "Could not download $INDEX_URL" >&2
  exit 1
fi
# A truncated or error response parses as neither, and silently wrong here
# means every commentary in the library gets miscategorised.
if ! python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$INDEX.tmp"; then
  rm -f "$INDEX.tmp"
  echo "The index did not come back as JSON. Try again." >&2
  exit 1
fi
mv "$INDEX.tmp" "$INDEX"
echo "Library index: $(( $(wc -c < "$INDEX") / 1024 ))KB in $INDEX (gitignored)"

# Keep the outgoing counts so we can say what the refresh actually changed.
previous=""
if [[ -f "$COUNTS" ]]; then
  previous="$(mktemp -t commentary-counts-previous)"
  cp "$COUNTS" "$previous"
fi

echo
python3 "$SCRIPT_DIR/process_sefaria_links.py"

if [[ -n "$previous" ]]; then
  echo
  echo "=============================================================="
  echo "What changed"
  echo "=============================================================="
  python3 "$SCRIPT_DIR/compare_commentary_counts.py" "$previous" "$COUNTS"
  rm -f "$previous"
fi

echo "Done. Review the diff to public/data/commentary-counts.json before committing."
