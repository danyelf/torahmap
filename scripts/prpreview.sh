#!/usr/bin/env bash
#
# prpreview <pr-number> — run a pull request's branch on a local dev server.
#
# Reuses a worktree that is already on the PR's branch when there is one, which
# means what you see is whatever is on disk there, not necessarily the PR. The
# banner says which it is. A reused worktree is left alone apart from an
# npm install when it has no node_modules.

set -euo pipefail

usage() {
  echo "usage: prpreview <pr-number>" >&2
  exit 2
}

[ $# -eq 1 ] || usage
pr="$1"
[[ "$pr" =~ ^[0-9]+$ ]] || usage

command -v gh >/dev/null || {
  echo "prpreview: gh is not installed" >&2
  exit 1
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
git() { command git -C "$script_dir" "$@"; }

main_root="$(git worktree list --porcelain | awk 'NR==1 {print $2}')"
project="$(basename "$main_root")"

IFS=$'\t' read -r branch head_sha state title < <(
  gh pr view "$pr" --json headRefName,headRefOid,state,title \
    --jq '[.headRefName, .headRefOid, .state, .title] | @tsv'
)
[ -n "$branch" ] || {
  echo "prpreview: could not read PR #$pr" >&2
  exit 1
}
[ "$state" = "OPEN" ] || echo "note: PR #$pr is $state"

git fetch --quiet origin "refs/pull/$pr/head" || {
  echo "prpreview: could not fetch refs/pull/$pr/head" >&2
  exit 1
}

# The worktree, if any, already checked out on the PR's branch.
worktree="$(git worktree list --porcelain | awk -v b="refs/heads/$branch" '
  /^worktree / { path = $2 }
  $0 == "branch " b { print path; exit }
')"

created_worktree=""
warnings=()

if [ -n "$worktree" ]; then
  [ -z "$(command git -C "$worktree" status --porcelain)" ] ||
    warnings+=("worktree has uncommitted changes — you are seeing what is on disk, not PR #$pr")

  on="$(command git -C "$worktree" rev-parse HEAD)"
  if [ "$on" != "$head_sha" ]; then
    behind="$(command git -C "$worktree" rev-list --count "$on..$head_sha" 2>/dev/null || echo '?')"
    warnings+=("worktree is at ${on:0:7}, PR head is ${head_sha:0:7} ($behind commits behind)")
  fi
else
  worktree="${main_root}-worktrees/preview-pr-$pr"
  echo "No worktree on $branch; checking out PR #$pr at $worktree"
  git worktree add --detach "$worktree" FETCH_HEAD >/dev/null
  created_worktree="$worktree"
fi

vite_pid=""
tail_pid=""
log="$(mktemp -t "prpreview-$pr")"

cleanup() {
  [ -n "$tail_pid" ] && kill "$tail_pid" 2>/dev/null || true
  [ -n "$vite_pid" ] && kill "$vite_pid" 2>/dev/null || true
  [ -n "$vite_pid" ] && wait "$vite_pid" 2>/dev/null || true
  if [ -n "$created_worktree" ]; then
    echo "Removing $created_worktree"
    git worktree remove --force "$created_worktree" 2>/dev/null || true
  fi
  rm -f "$log"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

if [ ! -d "$worktree/node_modules" ]; then
  echo "Installing dependencies in $worktree"
  (cd "$worktree" && npm install)
fi

# NO_COLOR keeps the port readable in the log; vite picks its own free port.
(cd "$worktree" && NO_COLOR=1 exec node_modules/.bin/vite) >"$log" 2>&1 &
vite_pid=$!

url=""
for _ in $(seq 1 120); do
  url="$(grep -oE 'http://localhost:[0-9]+/' "$log" | head -1 || true)"
  [ -n "$url" ] && break
  kill -0 "$vite_pid" 2>/dev/null || {
    echo "prpreview: vite exited" >&2
    cat "$log" >&2
    exit 1
  }
  sleep 0.5
done
[ -n "$url" ] || {
  echo "prpreview: no URL from vite after 60s" >&2
  cat "$log" >&2
  exit 1
}

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "$url" && break
  sleep 0.5
done
curl -sf -o /dev/null "$url" || {
  echo "prpreview: $url is not answering" >&2
  exit 1
}

echo
echo "  $project — PR #$pr: $title"
echo "  branch    $branch"
echo "  worktree  $worktree"
echo "  url       $url"
for w in ${warnings+"${warnings[@]}"}; do echo "  ⚠️  $w"; done
echo
echo "  Ctrl-C to stop."
echo

open "$url"

tail -f "$log" &
tail_pid=$!
wait "$vite_pid"
