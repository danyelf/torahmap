#!/usr/bin/env bash
#
# sweep-worktrees [--apply] — list every worktree whose work is all on main,
# and with --apply remove it and its branch. Anything uncommitted, locked or in
# use by a running process is kept and says why, with its pull request. Both
# modes fetch from origin first.
#
# Files git ignores (node_modules, layout-report/, video/out/) are not checked:
# a merged worktree's ignored files go with it.

set -euo pipefail

apply=""
case "${1:-}" in
  --apply) apply=1 ;;
  "") ;;
  *)
    echo "usage: sweep-worktrees [--apply]" >&2
    exit 2
    ;;
esac

cd "$(dirname "${BASH_SOURCE[0]}")"
git fetch --quiet --prune origin

# A squash merge leaves the branch off main's history, so also match the head
# of every merged pull request.
prs=$(gh pr list --state all --limit 500 --json number,state,headRefName,headRefOid \
  --jq '.[] | [.headRefName, "#\(.number) \(.state | ascii_downcase)", .state, .headRefOid] | @tsv')
in_use=$(lsof -d cwd -Fpn 2>/dev/null | awk '/^p/ { pid = substr($0, 2) } /^n/ { print pid, substr($0, 2) }')

git worktree list --porcelain | awk '
  /^worktree / { path = substr($0, 10); branch = ""; locked = 0 }
  /^HEAD /     { head = $2 }
  /^branch /   { branch = substr($2, 12) }
  /^locked/    { locked = 1 }
  /^$/         { if (NR > 1 && path) print path "\t" head "\t" branch "\t" locked; path = "" }
  END          { if (path) print path "\t" head "\t" branch "\t" locked }
' | tail -n +2 | while IFS=$'\t' read -r path head branch locked; do
  pr=$(awk -F'\t' -v b="$branch" '$1 == b { printf "%s ", $2 }' <<<"$prs")
  name="${branch:-detached ${head:0:7}}${pr:+, ${pr% }}"

  if [ "$locked" = 1 ]; then
    echo "keep    $path ($name): locked"
    continue
  fi
  if [ -n "$(git -C "$path" status --porcelain)" ]; then
    echo "keep    $path ($name): uncommitted changes"
    continue
  fi
  pid=$(awk -v p="$path" '$2 == p || index($2, p "/") == 1 { print $1; exit }' <<<"$in_use")
  if [ -n "$pid" ]; then
    echo "keep    $path ($name): in use by $(ps -o comm= -p "$pid" | xargs basename) (pid $pid)"
    continue
  fi
  if git merge-base --is-ancestor "$head" origin/main; then
    how="on main"
  elif awk -F'\t' -v h="$head" '$3 == "MERGED" && $4 == h { found = 1 } END { exit !found }' <<<"$prs"; then
    how="squash-merged"
  else
    echo "keep    $path ($name): has work not on main"
    continue
  fi

  if [ -z "$apply" ]; then
    echo "remove  $path ($name): $how"
  elif git worktree remove "$path" && { [ -z "$branch" ] || git branch -D "$branch" >/dev/null; }; then
    echo "removed $path ($name): $how"
  else
    echo "FAILED  $path ($name): see the error above"
  fi
done
