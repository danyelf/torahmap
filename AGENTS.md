# Agent Instructions

This project tracks issues on **GitHub Issues**: https://github.com/danyelf/torahmap/issues

Closed pre-migration issues live in `issues/closed/` as a searchable archive (see `issues/README.md`). The `issues/MIGRATION-MAP.md` file maps old `tm-XXX` IDs to new GH numbers.

## How to Code

When you start in a worktree, expect to work in that worktree as autonomously as you can on the corresponding issue.

**UI Changes:** If you make a change that affects the UI, you MAY NOT consider it complete until Danyel has looked at it and agreed it's ready to close.

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

These mirror the `priority`/`type` frontmatter from the old markdown system. Apply at least one priority and one type label when filing.

### Searching closed history

Closed issues from the pre-migration era live in `issues/closed/`:

```bash
grep -rl "search overlay" issues/closed/
```

For pre-migration issue references in code or commits, look up the new GH number in `issues/MIGRATION-MAP.md`.

## Working in Worktrees

This project does parallel agent work in git worktrees. Each issue gets its own worktree and branch.

**Starting work:**

```bash
./scripts/work-on-issue.sh 42          # by issue number
./scripts/work-on-issue.sh             # interactive picker (needs fzf)
```

This creates an isolated git worktree at `../torahmap-worktrees/<N>-<slug>` on a new branch named `<N>-<slug>` (matching `gh issue develop`'s convention), then launches Claude inside it.

**Landing work (push and open a PR):**

From inside the worktree, when you're done and committed:

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --base main --fill --body "Closes #<N>"
```

The `Closes #N` line auto-closes the issue when the PR merges. Main is protected — **Danyel merges the PR manually**. After the merge lands, clean up the worktree from the main repo:

```bash
git worktree remove ../torahmap-worktrees/<N>-<slug>
git branch -D <N>-<slug>
```

**DO NOT try to merge locally** — main is protected.

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

## Tracker history

GitHub Issues (current). Before that, plain markdown files under `issues/` (see `issues/README.md`).
