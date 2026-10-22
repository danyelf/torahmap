#!/usr/bin/env bash
#
# review-freshness <pr-number> — one line on how the PR's head compares to its
# latest review: the latest comment or review, from anyone, whose first line is
#   Reviewed up to `<40-character sha>`
#
# With no argument it reads `gh pr view --json headRefOid,commits,comments,reviews`
# from stdin instead of asking GitHub.

set -euo pipefail

if [ $# -eq 0 ]; then
  json=$(cat)
elif [ $# -eq 1 ] && [[ $1 =~ ^[0-9]+$ ]]; then
  json=$(gh pr view "$1" --json headRefOid,commits,comments,reviews)
else
  echo "usage: review-freshness <pr-number>" >&2
  exit 2
fi

jq -r '
  def short: .[0:7];
  .headRefOid as $head
  | [.commits[].oid] as $commits
  | [(.comments[] | {at: .createdAt, body}), (.reviews[] | {at: .submittedAt, body})]
  | map(select(.body // "" | test("^Reviewed up to `[0-9a-f]{40}`")) | .sha = .body[16:56])
  | (sort_by(.at) | last | .sha) as $sha
  | if $sha == null then "Not reviewed yet."
    elif $sha == $head then "Reviewed at the head, \($sha | short)."
    elif ($commits | index($sha)) == null then "Reviewed \($sha | short), which is no longer on the branch: rebased since."
    else ($commits | length - index($sha) - 1) as $n
      | "\($n) commit\(if $n == 1 then "" else "s" end) since the review at \($sha | short)."
    end
' <<<"$json"
