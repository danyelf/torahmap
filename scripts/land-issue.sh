#!/usr/bin/env bash
# Usage: land-issue.sh
# Run from inside a worktree. Closes the issue (moves issues/open/<id>-*.md ->
# issues/closed/), pushes the feature branch, and opens a PR against main.
# Main is protected — you merge the PR yourself.
set -e

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

# 4. Push feature branch
echo "Pushing $BRANCH_NAME..."
git push -u origin "$BRANCH_NAME"

# 5. Open a PR against main (if one doesn't already exist)
existing_pr=$(gh pr view "$BRANCH_NAME" --json url --jq .url 2>/dev/null || true)
if [[ -n "$existing_pr" ]]; then
  echo "PR already exists: $existing_pr"
else
  # Title: prefer the issue file's H1; fall back to the branch name
  pr_title="$ISSUE_ID"
  if (( ${#issue_files[@]} == 1 )); then
    h1=$(grep -m1 '^# ' "$dst" | sed 's/^# //')
    [[ -n "$h1" ]] && pr_title="$ISSUE_ID: $h1"
  fi
  echo "Opening PR..."
  gh pr create \
    --base main \
    --head "$BRANCH_NAME" \
    --title "$pr_title" \
    --body "Closes \`$ISSUE_ID\`."
fi

echo ""
echo "$ISSUE_ID: branch pushed and PR open. Merge it yourself, then run:"
echo "  cd $MAIN_REPO && git worktree remove $REPO_ROOT && git branch -D $BRANCH_NAME"
