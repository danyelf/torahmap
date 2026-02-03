#!/usr/bin/env bash
set -e

# Usage: land-bead.sh [--delete-branch]
# Merges current worktree branch into main and cleans up
# Must be run from within a worktree
# Options:
#   --delete-branch  Automatically delete the feature branch after landing (no prompt)

DELETE_BRANCH=false
if [ "$1" = "--delete-branch" ]; then
  DELETE_BRANCH=true
fi

# Verify we're in a worktree
if [ ! -f .beads/redirect ]; then
  echo "Error: This script must be run from within a beads worktree"
  echo "Use scripts/work-on-bead.sh to create a worktree first"
  exit 1
fi

# Get current branch name (which is also the bead ID)
BRANCH_NAME=$(git branch --show-current)
BEAD_ID="$BRANCH_NAME"

# Get repo root
REPO_ROOT=$(git rev-parse --show-toplevel)
MAIN_REPO=$(cat .beads/redirect | sed 's|/.beads$||')

echo "Landing branch: $BRANCH_NAME"
echo "Main repo: $MAIN_REPO"
echo ""

# Step 1: Ensure no uncommitted changes in worktree
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: You have uncommitted changes in the worktree"
  echo "Please commit or stash them first"
  git status
  exit 1
fi

# Step 2: Kill any background npm/node processes spawned from this worktree
KILLED=""
for pid in $(pgrep -f "$REPO_ROOT" 2>/dev/null); do
  # Skip our own process tree
  if [ "$pid" != "$$" ] && ps -p "$pid" -o comm= 2>/dev/null | grep -qE 'node|npm'; then
    kill "$pid" 2>/dev/null && KILLED="$KILLED $pid"
  fi
done
if [ -n "$KILLED" ]; then
  echo "Killed background npm/node processes:$KILLED"
  sleep 1
fi

# Step 3: Sync beads from main repo and commit if needed
echo "Syncing beads from main repo..."
cd "$MAIN_REPO"
bd sync

# Commit any uncommitted beads changes in main repo
if git status --porcelain | grep -q "^.M .beads/"; then
  echo "Committing beads changes in main repo..."
  git add .beads/
  git commit -m "Sync beads before landing $BRANCH_NAME"
fi

# Step 4: Pull latest from remote
echo "Pulling latest changes from remote..."
git pull --rebase

# Step 5: Check if feature branch has any commits
cd "$REPO_ROOT"
COMMIT_COUNT=$(git log main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$COMMIT_COUNT" -eq 0 ]; then
  echo "No commits on branch $BRANCH_NAME. Nothing to merge."
  echo ""
  echo "Would you like to:"
  echo "  1. Delete this empty branch and worktree? (y/n)"
  read -r response
  if [ "$response" = "y" ]; then
    cd "$MAIN_REPO"
    git worktree remove "$REPO_ROOT"
    git branch -d "$BRANCH_NAME"
    echo "✓ Cleaned up empty branch and worktree"
  fi
  exit 0
fi

# Step 6: Verify feature branch has NO beads file changes (except .gitignore which is OK)
cd "$REPO_ROOT"
BEADS_CHANGES=$(git diff main --name-only | grep "^\.beads/" | grep -v "^\.beads/\.gitignore$" || true)
if [ -n "$BEADS_CHANGES" ]; then
  echo "ERROR: Feature branch has .beads/ changes!"
  echo "This should not happen - beads changes should only be on beads-sync branch"
  echo ""
  echo "Changes in .beads/:"
  echo "$BEADS_CHANGES"
  echo ""
  echo "This indicates a problem with the worktree setup."
  echo "The work-on-bead.sh script should have untracked these files."
  echo ""
  echo "To fix: Run the following in this worktree:"
  echo "  git rm --cached .beads/config.yaml .beads/issues.jsonl .beads/metadata.json"
  echo "  git commit --amend"
  exit 1
fi

# Step 7: Merge feature branch into main
echo "Merging $BRANCH_NAME into main..."
cd "$MAIN_REPO"
git merge "$BRANCH_NAME" --no-edit

# Step 8: Push to remote
echo "Pushing to remote..."
git push

# Step 9: Close the bead
echo "Closing bead $BEAD_ID..."
bd close "$BEAD_ID"
bd sync

# Step 10: Clean up worktree
echo "Cleaning up worktree..."
git worktree remove "$REPO_ROOT"

# Step 11: Optionally delete branch
if [ "$DELETE_BRANCH" = true ]; then
  echo "Deleting feature branch $BRANCH_NAME..."
  git branch -d "$BRANCH_NAME"
  echo "✓ Deleted branch $BRANCH_NAME"
else
  echo ""
  echo "Branch merged and worktree removed."
  echo "Would you like to delete the feature branch $BRANCH_NAME? (y/n)"
  read -r response
  if [ "$response" = "y" ]; then
    git branch -d "$BRANCH_NAME"
    echo "✓ Deleted branch $BRANCH_NAME"
  fi
fi

echo ""
echo "✓ Landing complete!"
echo "You are now in: $MAIN_REPO"
