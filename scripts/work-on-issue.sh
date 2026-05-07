#!/usr/bin/env bash
# Usage: work-on-issue.sh [issue-number]
# Creates a git worktree for the given GitHub issue and launches Claude in it.
# If no number is given, shows an interactive picker over open issues (needs fzf).
set -e

trap 'stty sane 2>/dev/null || true' EXIT

ISSUE_ARG="${1:-}"
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

if [[ -z "$ISSUE_ARG" ]]; then
  if command -v fzf >/dev/null && [ -t 0 ] && [ -t 1 ]; then
    SELECTED=$(gh issue list --state open --limit 200 \
      --json number,title,labels \
      --template '{{range .}}#{{.number}}{{"\t"}}[{{range $i, $l := .labels}}{{if $i}},{{end}}{{$l.name}}{{end}}]{{"\t"}}{{.title}}{{"\n"}}{{end}}' \
      | fzf --height=40% --reverse --border \
            --prompt="Select issue: " \
            --preview='gh issue view $(echo {} | awk "{print \$1}" | tr -d "#")' \
            --preview-window=right:60%:wrap)
    [[ -n "$SELECTED" ]] || { echo "no selection"; exit 1; }
    ISSUE_NUM=$(echo "$SELECTED" | awk '{print $1}' | tr -d '#')
  else
    echo "fzf not available; pass an issue number explicitly:"
    echo "  ./scripts/work-on-issue.sh 42"
    echo ""
    echo "Open issues:"
    gh issue list --state open --limit 50
    exit 1
  fi
else
  ISSUE_NUM="${ISSUE_ARG#\#}"
  if ! [[ "$ISSUE_NUM" =~ ^[0-9]+$ ]]; then
    echo "Error: '$ISSUE_ARG' is not a valid issue number"
    exit 1
  fi
fi

TITLE=$(gh issue view "$ISSUE_NUM" --json title --jq .title 2>/dev/null) || {
  echo "Error: could not fetch issue #$ISSUE_NUM"
  exit 1
}

SLUG=$(printf '%s' "$TITLE" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' \
  | cut -c1-40 \
  | sed 's/-$//')

BRANCH_NAME="${ISSUE_NUM}-${SLUG}"
REPO_NAME=$(basename "$REPO_ROOT")
WORKTREE_DIR="${REPO_ROOT}/../${REPO_NAME}-worktrees"
WORKTREE_PATH="${WORKTREE_DIR}/${BRANCH_NAME}"

if [[ -d "$WORKTREE_PATH" ]]; then
  echo "Worktree already exists at $WORKTREE_PATH"
  cd "$WORKTREE_PATH"
  claude --permission-mode bypassPermissions "Continue work on #$ISSUE_NUM: $TITLE"
  exit 0
fi

mkdir -p "$WORKTREE_DIR"
echo "Creating worktree for #$ISSUE_NUM at $WORKTREE_PATH"
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" origin/main
cd "$WORKTREE_PATH"

echo -ne "\033]0;${REPO_NAME}: #${ISSUE_NUM}\007"

PROMPT="Work on GitHub issue #$ISSUE_NUM: $TITLE

Branch: $BRANCH_NAME
This is a git worktree off main.

Read the issue body with:  gh issue view $ISSUE_NUM
When done, push and open a PR:
  git push -u origin $BRANCH_NAME
  gh pr create --base main --fill --body \"Closes #$ISSUE_NUM\""

claude --permission-mode bypassPermissions "$PROMPT"
