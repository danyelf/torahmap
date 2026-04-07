#!/usr/bin/env bash
# Usage: work-on-issue.sh [issue-id-or-partial]
# Creates a git worktree for the specified issue and launches Claude in it.
# If no id provided, shows interactive picker over issues/open/.
set -e

trap 'stty sane 2>/dev/null || true' EXIT

ISSUE_ARG="${1:-}"
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# Resolve to a file under issues/open/
shopt -s nullglob
if [[ -z "$ISSUE_ARG" ]]; then
  files=(issues/open/*.md)
  if (( ${#files[@]} == 0 )); then
    echo "no open issues. Create one with: ./scripts/issues-new.sh \"title\""
    exit 1
  fi
  if command -v fzf >/dev/null && [ -t 0 ] && [ -t 1 ]; then
    SELECTED=$(printf '%s\n' "${files[@]}" | fzf \
      --height=40% --reverse --border \
      --prompt="Select issue: " \
      --preview='cat {}' --preview-window=right:60%:wrap)
  else
    PS3='Select issue number: '
    select SELECTED in "${files[@]}"; do
      [[ -n "$SELECTED" ]] && break
    done
  fi
  ISSUE_FILE="$SELECTED"
else
  matches=(issues/open/*"$ISSUE_ARG"*.md)
  if (( ${#matches[@]} == 0 )); then
    echo "no match for '$ISSUE_ARG' in issues/open/"
    exit 1
  fi
  if (( ${#matches[@]} > 1 )); then
    echo "ambiguous '$ISSUE_ARG':"
    printf '  %s\n' "${matches[@]}"
    exit 1
  fi
  ISSUE_FILE="${matches[0]}"
fi

[[ -f "$ISSUE_FILE" ]] || { echo "no issue file"; exit 1; }

# Extract id and title from the file
ISSUE_ID=$(awk '/^id:/ {print $2; exit}' "$ISSUE_FILE")
TITLE=$(awk '/^# / {sub(/^# /, ""); print; exit}' "$ISSUE_FILE")
[[ -n "$ISSUE_ID" ]] || { echo "no id in $ISSUE_FILE"; exit 1; }

BRANCH_NAME="$ISSUE_ID"
REPO_NAME=$(basename "$REPO_ROOT")
WORKTREE_DIR="${REPO_ROOT}/../${REPO_NAME}-worktrees"
WORKTREE_PATH="${WORKTREE_DIR}/${ISSUE_ID}"

if [[ -d "$WORKTREE_PATH" ]]; then
  echo "Worktree already exists at $WORKTREE_PATH"
  cd "$WORKTREE_PATH"
  exec claude --permission-mode bypassPermissions "Continue work on $ISSUE_ID: $TITLE"
fi

mkdir -p "$WORKTREE_DIR"
echo "Creating worktree for $ISSUE_ID at $WORKTREE_PATH"
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH"
cd "$WORKTREE_PATH"

echo -ne "\033]0;${REPO_NAME}: ${ISSUE_ID}\007"

PROMPT="Work on $ISSUE_ID: $TITLE

Issue file: $ISSUE_FILE (read this for full context)
Branch: $BRANCH_NAME
This is a git worktree. When done, run: ./scripts/land-issue.sh"

exec claude --permission-mode bypassPermissions "$PROMPT"
