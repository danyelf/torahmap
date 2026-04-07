#!/usr/bin/env bash
# Usage: land-issue.sh [--keep-branch]
# Run from inside a worktree. Merges the worktree's branch into main, closes
# the issue (moves issues/open/<id>-*.md -> issues/closed/), pushes, cleans up.
set -e

KEEP_BRANCH=false
[[ "${1:-}" == "--keep-branch" ]] && KEEP_BRANCH=true

REPO_ROOT=$(git rev-parse --show-toplevel)
BRANCH_NAME=$(git branch --show-current)
ISSUE_ID="$BRANCH_NAME"

# Locate main repo (worktree's "linked" worktree points back to common dir)
MAIN_REPO=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
if [[ "$MAIN_REPO" == "$REPO_ROOT" ]]; then
  echo "Error: this looks like the main repo, not a worktree"
  echo "Run land-issue.sh from inside the worktree (../torahmap-worktrees/$ISSUE_ID)"
  exit 1
fi

cd "$REPO_ROOT"

# 1. No uncommitted changes
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: uncommitted changes in worktree"
  git status --short
  exit 1
fi

# 2. Kill any node/npm processes spawned from this worktree
KILLED=""
for pid in $(pgrep -f "$REPO_ROOT" 2>/dev/null || true); do
  if [[ "$pid" != "$$" ]] && ps -p "$pid" -o comm= 2>/dev/null | grep -qE 'node|npm'; then
    kill "$pid" 2>/dev/null && KILLED="$KILLED $pid"
  fi
done
[[ -n "$KILLED" ]] && { echo "Killed:$KILLED"; sleep 1; }

# 3. Move issue file open -> closed (commit on the feature branch)
shopt -s nullglob
issue_files=(issues/open/${ISSUE_ID}-*.md)
if (( ${#issue_files[@]} == 1 )); then
  src="${issue_files[0]}"
  dst="issues/closed/$(basename "$src")"
  echo "Closing issue: $src -> $dst"
  git mv "$src" "$dst"
  # Stamp closed: date in frontmatter; replace status: open with status: closed
  today=$(date +%Y-%m-%d)
  awk -v today="$today" '
    /^status: open/ { print "status: closed"; print "closed: " today; next }
    { print }
  ' "$dst" > "$dst.tmp" && mv "$dst.tmp" "$dst"
  git add "$dst"
  git commit -m "Close $ISSUE_ID"
else
  echo "Note: no issue file matched issues/open/${ISSUE_ID}-*.md (skipping close step)"
fi

# 4. Switch to main repo, pull, merge, push
cd "$MAIN_REPO"
echo "Pulling latest from origin..."
git pull --rebase

echo "Merging $BRANCH_NAME into main..."
git merge "$BRANCH_NAME" --no-edit

echo "Pushing..."
git push

# 5. Clean up worktree
echo "Removing worktree $REPO_ROOT..."
git worktree remove "$REPO_ROOT"

# 6. Optionally delete branch
if ! $KEEP_BRANCH; then
  git branch -d "$BRANCH_NAME"
  echo "Deleted branch $BRANCH_NAME"
fi

echo ""
echo "Landed $ISSUE_ID. You are now in $MAIN_REPO"
