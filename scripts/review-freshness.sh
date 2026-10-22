#!/usr/bin/env bash
#
# review-freshness <pr-number> — one line on how the PR's head compares to its
# latest review: the latest comment or review, from anyone, whose first line is
#   Reviewed up to `<sha, 7 to 40 characters>`
#
# With no argument it reads `gh pr view --json commits,comments,reviews`
# from stdin instead of asking GitHub.

set -euo pipefail

if [ $# -eq 0 ]; then
  json=$(cat)
elif [ $# -eq 1 ] && [[ $1 =~ ^[0-9]+$ ]]; then
  json=$(gh pr view "$1" --json commits,comments,reviews)
else
  echo "usage: review-freshness <pr-number>" >&2
  exit 2
fi

jq -r '
  [.commits[].oid] as $commits
  | [(.comments[] | {at: .createdAt, body}), (.reviews[] | {at: .submittedAt, body})]
  | map(.sha = (.body // "" | capture("^Reviewed up to `(?<s>[0-9a-f]{7,40})`") | .s) | select(.sha))
  | (sort_by(.at) | last | .sha) as $sha
  | [$commits | to_entries[] | select(.value | startswith($sha // "-")) | .key] as $at
  | if $sha == null then "No comment starts with `Reviewed up to <sha>`."
    elif ($at | length) > 1 then "Reviewed \($sha), which matches more than one commit on the branch."
    elif $at == [] then "Reviewed \($sha[0:7]), which is not on the branch, so the review may not cover the current commits."
    else ($commits | length - $at[0] - 1) as $n
      | if $n == 0 then "Reviewed at the head commit, \($sha[0:7])."
        else "\($n) commit\(if $n == 1 then "" else "s" end) since the review of \($sha[0:7])." end
    end
' <<<"$json"

