#!/usr/bin/env bash
#
# status — every open PR with its review freshness, whether it merges cleanly
# and its branch preview; then the issues in progress, and the worktrees whose
# branch has no open PR.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

prs=$(gh pr list --state open --limit 100 --json number,title,isDraft,mergeable,headRefName,comments)

echo "Open pull requests"
jq -r '.[] | [.number, .title + (if .isDraft then " (draft)" else "" end), (.mergeable | ascii_downcase),
    ([.comments[] | select(.author.login == "cloudflare-workers-and-pages")
      | .body | capture("(?<u>https://[^ ]+?).>Branch Preview URL").u] | last // "none")] | @tsv' <<<"$prs" |
  while IFS=$'\t' read -r n title mergeable preview; do
    echo "#$n $title"
    echo "    $(./review-freshness.sh "$n")"
    echo "    merge: $mergeable · preview: $preview"
  done

echo
echo "Issues in progress"
gh issue list --label in-progress --json number,title --jq '.[] | "#\(.number) \(.title)"'

echo
echo "Worktrees with no open PR"
git worktree list --porcelain | awk '/^worktree /{p=substr($0,10)} /^branch /{print substr($2,12) "\t" p}' |
  while IFS=$'\t' read -r branch path; do
    [ "$branch" = main ] || jq -e --arg b "$branch" 'any(.headRefName == $b)' <<<"$prs" >/dev/null ||
      echo "$branch  $path"
  done
