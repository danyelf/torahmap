#!/usr/bin/env bash
#
# prpreview <pr-number> — serve a pull request from a local dev server.
#
# A worktree already on the PR's branch is served as it stands, so what you see
# may be someone's in-flight edits rather than the PR itself.

set -euo pipefail

[ $# -eq 1 ] && [[ $1 =~ ^[0-9]+$ ]] || {
  echo "usage: prpreview <pr-number>" >&2
  exit 2
}
pr=$1

cd "$(dirname "${BASH_SOURCE[0]}")"
main_root=$(git worktree list --porcelain | awk 'NR==1 { print $2 }')

IFS=$'\t' read -r branch head_sha title < <(
  gh pr view "$pr" --json headRefName,headRefOid,title --jq '[.headRefName, .headRefOid, .title] | @tsv'
)
git fetch --quiet origin "refs/pull/$pr/head"

worktree=$(git worktree list --porcelain | awk -v b="refs/heads/$branch" '
  /^worktree / { path = $2 }
  $0 == "branch " b { print path; exit }
')

created=""
trap 'if [ -n "$created" ]; then git worktree remove --force "$created"; fi' EXIT

if [ -n "$worktree" ]; then
  if [ "$(git -C "$worktree" rev-parse HEAD)" != "$head_sha" ] ||
    [ -n "$(git -C "$worktree" status --porcelain)" ]; then
    echo "⚠️  $worktree is not a clean checkout of PR #$pr — serving what is on disk"
  fi
else
  worktree="$main_root-worktrees/preview-pr-$pr"
  git worktree add --detach "$worktree" FETCH_HEAD
  created=$worktree
fi

[ -d "$worktree/node_modules" ] || (cd "$worktree" && npm install)

echo "PR #$pr · $title"
echo "branch $branch · $worktree"
(cd "$worktree" && npx vite --open)
