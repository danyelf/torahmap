#!/usr/bin/env bash
set -e

# Usage: work-on-bead.sh <bead-id>
# Creates a git worktree for the specified bead and launches Claude in it

if [ -z "$1" ]; then
  echo "Usage: $0 <bead-id>"
  echo "Example: $0 beads-123"
  exit 1
fi

BEAD_ID="$1"

# Verify bead exists BEFORE doing anything else
echo "Verifying bead $BEAD_ID exists..."
if ! bd show "$BEAD_ID" >/dev/null 2>&1; then
  echo "Error: Bead $BEAD_ID not found"
  echo "Run 'bd list' to see available beads"
  exit 1
fi
echo "✓ Bead $BEAD_ID found"

# Use bead ID as branch name
BRANCH_NAME="$BEAD_ID"

# Get repo root and name
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")

# Worktree path (sibling to main repo)
WORKTREE_DIR="${REPO_ROOT}/../${REPO_NAME}-worktrees"
WORKTREE_PATH="${WORKTREE_DIR}/${BEAD_ID}"

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
  echo "Worktree already exists at $WORKTREE_PATH"
  echo "Launching Claude in existing worktree..."
  cd "$WORKTREE_PATH"
  exec claude --permission-mode bypassPermissions "work on $BEAD_ID"
fi

# Create worktrees directory if it doesn't exist
mkdir -p "$WORKTREE_DIR"

# Mark the bead as in_progress before creating worktree
echo "Marking $BEAD_ID as in_progress..."
bd update "$BEAD_ID" --status in_progress

# Create worktree with beads redirect
echo ""
echo "Creating worktree for $BEAD_ID"
echo "Branch: $BRANCH_NAME"
echo "Path: $WORKTREE_PATH"
echo ""

bd worktree create "$WORKTREE_PATH" --branch "$BRANCH_NAME"

# Change to worktree and run claude
cd "$WORKTREE_PATH"

# Set terminal tab title
echo -ne "\033]0;${REPO_NAME}: ${BEAD_ID}\007"

echo ""
echo "Launching Claude in worktree..."
echo "To return to main repo: cd $REPO_ROOT"
echo ""

exec claude --permission-mode bypassPermissions "work on $BEAD_ID"
