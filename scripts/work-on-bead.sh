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
# Relative path for bd worktree create (from repo root)
RELATIVE_WORKTREE_PATH="../${REPO_NAME}-worktrees/${BEAD_ID}"

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
  echo "Worktree already exists at $WORKTREE_PATH"
  cd "$WORKTREE_PATH"

  # Fix old worktrees: ensure .beads contains only redirect file
  if [ -f .beads/redirect ]; then
    echo "Fixing .beads redirect (ensuring proper git tracking)..."
    REDIRECT_TARGET=$(cat .beads/redirect)

    # Remove from git index if present
    git rm --cached .beads/README.md .beads/issues.jsonl .beads/metadata.json 2>/dev/null || true

    # Ensure worktree-local gitignore has these files
    EXCLUDE_FILE=$(git rev-parse --git-path info/exclude)
    if ! grep -q ".beads/issues.jsonl" "$EXCLUDE_FILE" 2>/dev/null; then
      cat >> "$EXCLUDE_FILE" << 'EOF'
# Beads data files (tracked in main repo, but use redirect in worktrees)
.beads/README.md
.beads/issues.jsonl
.beads/metadata.json
EOF
    fi

    # Clean up files and restore redirect
    rm -rf .beads/*
    echo "$REDIRECT_TARGET" > .beads/redirect
  fi

  echo "Launching Claude in existing worktree..."
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

bd worktree create "$RELATIVE_WORKTREE_PATH" --branch "$BRANCH_NAME"

# Change to worktree
cd "$WORKTREE_PATH"

# Fix redirect: bd worktree create copies too many files to .beads/
# The redirect only works when .beads/ contains ONLY the redirect file
echo "Fixing .beads redirect and git tracking..."
REDIRECT_TARGET=$(cat .beads/redirect)

# Remove from git index (but keep on disk temporarily)
git rm --cached .beads/README.md .beads/issues.jsonl .beads/metadata.json 2>/dev/null || true

# Add to worktree-local gitignore (not committed)
# Use git rev-parse to find the actual info/exclude path in worktree
EXCLUDE_FILE=$(git rev-parse --git-path info/exclude)
cat >> "$EXCLUDE_FILE" << 'EOF'
# Beads data files (tracked in main repo, but use redirect in worktrees)
.beads/README.md
.beads/issues.jsonl
.beads/metadata.json
EOF

# Now delete the files and keep only redirect
rm -rf .beads/*
echo "$REDIRECT_TARGET" > .beads/redirect

# Set terminal tab title
echo -ne "\033]0;${REPO_NAME}: ${BEAD_ID}\007"

# Gather context for Claude
BEAD_INFO=$(bd show "$BEAD_ID" --json)
BEAD_TITLE=$(echo "$BEAD_INFO" | jq -r '.[0].title // "No title"')
BEAD_STATUS=$(echo "$BEAD_INFO" | jq -r '.[0].status // "unknown"')
BEAD_TYPE=$(echo "$BEAD_INFO" | jq -r '.[0].type // "task"')

# Check if any work has been done on this branch
COMMIT_COUNT=$(git log main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$COMMIT_COUNT" -gt 0 ]; then
  WORK_STATUS="$COMMIT_COUNT commit(s) on this branch"
else
  WORK_STATUS="fresh branch, no commits yet"
fi

# Build context-rich prompt
PROMPT="Work on $BEAD_ID ($BEAD_TYPE): $BEAD_TITLE

Current status: $BEAD_STATUS
Branch: $BRANCH_NAME ($WORK_STATUS)

Note: This is a git worktree. The bead ID is also the branch name."

echo ""
echo "Launching Claude in worktree..."
echo "Issue: $BEAD_TITLE"
echo "Status: $BEAD_STATUS ($WORK_STATUS)"
echo "To return to main repo: cd $REPO_ROOT"
echo ""

exec claude --permission-mode bypassPermissions "$PROMPT"
