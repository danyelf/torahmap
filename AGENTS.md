# Agent Instructions

This project tracks issues on **GitHub Issues**: https://github.com/danyelf/torahmap/issues

## How to Code

**Always work in a worktree.** Issue work never happens in the primary checkout — branching there
leaves Danyel's main directory sitting on a branch he didn't put it on. Create the worktree before
your first edit: the `EnterWorktree` tool is the easy path, because it also installs dependencies,
and `git worktree add <path> -b <branch>` works when the path matters. A `PreToolUse` hook enforces
this, so a `git checkout -b` in the primary checkout will simply be refused. Once you are in a
worktree, work there as autonomously as you can on the corresponding issue.

**UI Changes:** If you make a change that affects the UI, you MAY NOT consider it complete until Danyel has looked at it and agreed it's ready to close.

**Shorter is better than longer.** Every word earns its place or goes. This
applies to comments, docstrings, commit messages and documents alike.

Assume a literate reader who can follow the code. Do not explain what a line
does, restate a name, narrate a loop, or argue a case where stating a fact will
do. Prefer making the code say it: a better name, a smaller function or a
clearer structure beats the comment that would have explained the worse one.

Write a comment when the code cannot carry the information — a measured number,
a decision and why it went that way, a constraint that is not visible locally,
a failure mode worth naming. Say it once, in one place. Do not restate it in
the caller, the test, or the document.

Do not treat the length of the surrounding comments as a style to match. Most
of this codebase was written by an agent, so its habits are not a convention
and carry no authority; judge each comment on whether a reader needs it.

## Issue Tracking

Active issues live on GitHub. Use the `gh` CLI for everything.

### Quick reference

```bash
# What's open, sorted by priority label?
gh issue list --state open --label P0,P1,P2 --limit 50

# Read an issue
gh issue view 42

# Create a new issue
gh issue create --title "Fix the zoom bug" --label bug,P1 --body "..."

# Close an issue (usually via PR auto-close — see "Closes #N" in the PR body)
gh issue close 42 --comment "..."
```

### Label conventions

- **Type:** `bug`, `enhancement` (= feature), `task`, `chore`, `documentation`
- **Priority:** `P0` (critical) → `P4` (backlog). Default is `P2`.

Apply at least one priority and one type label when filing.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work on an issue is NOT complete until a PR is open against main. (Main is protected — Danyel merges the PR manually.)

1. **File follow-up issues** — `gh issue create --title "..." --label ...` for anything that needs follow-up.
2. **Run quality gates** (if code changed) — `npm test`, build, etc.
3. **Commit your changes.**
4. **OPEN A PR** — mandatory. From inside the worktree:
   ```bash
   git push -u origin "$(git branch --show-current)"
   gh pr create --base main --fill --body "Closes #<N>"
   ```
   Confirm the PR URL is printed.
5. **Verify** — branch pushed AND PR open against main. `gh pr view` should show it.

**CRITICAL RULES:**

- Work is NOT complete until a PR is open against main
- NEVER stop before opening the PR — that leaves work stranded locally
- NEVER say "ready to push when you are" — YOU must push and open the PR
- NEVER try to push directly to main — it's protected
- If push or PR creation fails, resolve and retry until it succeeds
- Worktree cleanup happens AFTER Danyel merges the PR, not before
