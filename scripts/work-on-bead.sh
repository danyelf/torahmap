#!/usr/bin/env bash
set -e

# Usage: work-on-bead.sh [bead-id]
# Creates a git worktree for the specified bead and launches Claude in it
# If no bead-id provided, shows interactive selector

# Ensure terminal is restored to sane state on exit
trap 'stty sane 2>/dev/null || true' EXIT

BEAD_ID="$1"

# If no bead ID provided, show interactive selector
if [ -z "$BEAD_ID" ]; then
  echo "Fetching available beads..."

  # Get list of open beads with details
  BEAD_LIST=$(bd list --status=open --json)

  if [ -z "$BEAD_LIST" ] || [ "$BEAD_LIST" = "[]" ]; then
    echo "No open beads found. Create one with 'bd create'"
    exit 1
  fi

  # Format beads for display: "bead-id | type | priority | title"
  FORMATTED_BEADS=$(echo "$BEAD_LIST" | jq -r '.[] | "\(.id) | \(.issue_type // "task") | P\(.priority // "2") | \(.title // "No title")"')

  # Try fzf first (better UX), fall back to select
  # Only use fzf if it exists AND we have an interactive terminal
  if command -v fzf &> /dev/null && [ -t 0 ] && [ -t 1 ]; then
    SELECTED=$(echo "$FORMATTED_BEADS" | fzf \
      --height=40% \
      --reverse \
      --border \
      --prompt="Select bead: " \
      --header="ID | Type | Priority | Title" \
      --preview='bd show {1}' \
      --preview-window=right:60%:wrap)
  else
    # Use bash select as fallback (it prints the list automatically)
    IFS=$'\n' read -r -d '' -a BEAD_ARRAY <<< "$FORMATTED_BEADS" || true
    echo ""
    PS3='Select bead number (or Ctrl+C to cancel): '
    select SELECTED in "${BEAD_ARRAY[@]}"; do
      if [ -n "$SELECTED" ]; then
        break
      else
        echo "Invalid selection. Try again."
      fi
    done
  fi

  if [ -z "$SELECTED" ]; then
    echo "No bead selected. Exiting."
    exit 1
  fi

  # Extract bead ID (first field before |)
  BEAD_ID=$(echo "$SELECTED" | awk -F' \\| ' '{print $1}')
  echo ""
  echo "Selected: $SELECTED"
  echo ""
fi

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

# Set terminal tab title
echo -ne "\033]0;${REPO_NAME}: ${BEAD_ID}\007"

# Gather context for Claude
BEAD_INFO=$(bd show "$BEAD_ID" --json)
BEAD_TITLE=$(echo "$BEAD_INFO" | jq -r '.[0].title // "No title"')
BEAD_STATUS=$(echo "$BEAD_INFO" | jq -r '.[0].status // "unknown"')
BEAD_TYPE=$(echo "$BEAD_INFO" | jq -r '.[0].issue_type // "task"')

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
