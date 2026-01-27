#!/usr/bin/env bash
set -e

# Usage: cleanup-worktrees.sh
# Removes worktrees for closed beads (with confirmation)

REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
WORKTREE_DIR="${REPO_ROOT}/../${REPO_NAME}-worktrees"

# Check if worktrees directory exists
if [ ! -d "$WORKTREE_DIR" ]; then
  echo "No worktrees directory found at $WORKTREE_DIR"
  exit 0
fi

# Find worktrees for closed beads
echo "Scanning for worktrees with closed beads..."
echo ""

CLOSED_WORKTREES=()
CLOSED_BEADS=()

for worktree_path in "$WORKTREE_DIR"/*; do
  if [ ! -d "$worktree_path" ]; then
    continue
  fi

  bead_id=$(basename "$worktree_path")

  # Check if bead exists and is closed
  if bd show "$bead_id" 2>/dev/null | grep -q "CLOSED]"; then
    CLOSED_WORKTREES+=("$worktree_path")
    CLOSED_BEADS+=("$bead_id")
  fi
done

# Report findings
if [ ${#CLOSED_WORKTREES[@]} -eq 0 ]; then
  echo "No worktrees found for closed beads."
  exit 0
fi

echo "Found ${#CLOSED_WORKTREES[@]} worktree(s) for closed beads:"
echo ""
for bead_id in "${CLOSED_BEADS[@]}"; do
  echo "  - $bead_id"
done
echo ""

# Confirm deletion
read -p "Remove these worktrees? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# Remove worktrees
echo ""
for i in "${!CLOSED_WORKTREES[@]}"; do
  worktree_path="${CLOSED_WORKTREES[$i]}"
  bead_id="${CLOSED_BEADS[$i]}"

  echo "Removing worktree: $bead_id"

  # Remove using git worktree remove (cleaner than rm -rf)
  if git worktree remove "$worktree_path" 2>/dev/null; then
    echo "✓ Removed $bead_id"
  else
    # Fallback: force remove if locked or has uncommitted changes
    echo "  (force removing due to uncommitted changes or lock)"
    git worktree remove --force "$worktree_path" 2>/dev/null || rm -rf "$worktree_path"
    echo "✓ Removed $bead_id"
  fi
done

echo ""
echo "Cleanup complete. Removed ${#CLOSED_WORKTREES[@]} worktree(s)."
