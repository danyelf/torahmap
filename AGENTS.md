# Agent Instructions

This project tracks issues as plain markdown files in `issues/`. See `issues/README.md` for the format.

## How to Code

When you start in a worktree, expect to work in that worktree as autonomously as you can on the corresponding issue.

**UI Changes:** If you make a change that affects the UI, you MAY NOT consider it complete until Danyel has looked at it and agreed it's ready to close.

## Issue Tracking

There is no daemon, database, or CLI tool. Issues are markdown files. Status = which folder.

```
issues/
  open/      # active work — one .md file per issue
  closed/    # done, kept for searchable history
  README.md  # format and conventions
```

### Quick reference

```bash
# What's open, sorted by priority?
./scripts/issues-ready.sh

# Create a new issue
./scripts/issues-new.sh "Title here" bug 1     # type and priority optional

# Read an issue
cat issues/open/tm-abc-*.md

# Close an issue manually (land-issue.sh does this for you in worktrees)
git mv issues/open/tm-abc-*.md issues/closed/
# then edit frontmatter: change `status: open` to `status: closed`, add `closed: 2026-04-06`
```

### File format

```markdown
---
id: tm-abc
status: open
priority: 2          # 0=critical, 1=high, 2=medium, 3=low, 4=backlog
type: bug            # bug | feature | task | chore
created: 2026-04-06
---

# Short title

Why this exists, what done looks like, any context the next reader needs.
```

The `id` is a short random tag chosen at creation time to avoid collisions when parallel agents in different worktrees both create issues. Filename is `<id>-<slug>.md` where slug is human-readable.

### Searching history

Closed issues stay in `issues/closed/`. Use grep:

```bash
grep -rl "search overlay" issues/
```

For older history (before the migration off beads), see `.beads-archive/issues.jsonl` or `git log -- .beads-archive/`.

## Working in Worktrees

This project does parallel agent work in git worktrees. Each issue gets its own worktree and branch.

**Starting work:**

```bash
./scripts/work-on-issue.sh tm-abc      # by id substring
./scripts/work-on-issue.sh             # interactive picker
```

This creates an isolated git worktree at `../torahmap-worktrees/<id>` on a new branch named after the issue id, then launches Claude inside it.

**Landing work (merge and clean up):**

From inside the worktree, when you're done and committed:

```bash
./scripts/land-issue.sh
```

This script will:

1. Verify no uncommitted changes
2. Move `issues/open/<id>-*.md` → `issues/closed/` and commit (on the feature branch)
3. Push the feature branch and open a PR against main via `gh`

Main is protected and requires PRs, so **Danyel merges the PR manually**. After
the merge lands, clean up the worktree:

```bash
cd <main repo> && git worktree remove ../torahmap-worktrees/<id> && git branch -D <id>
```

**DO NOT try to merge locally** — use `land-issue.sh` so the issue file gets moved to `closed/` consistently and the PR gets opened.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work on an issue is NOT complete until a PR is open against main. (Main is protected — Danyel merges the PR manually.)

1. **File issues for remaining work** — `./scripts/issues-new.sh "Title"` for anything that needs follow-up
2. **Run quality gates** (if code changed) — `npm test`, build, etc.
3. **Update issue status** — close finished work by moving the file to `issues/closed/` (or let `land-issue.sh` do it)
4. **OPEN A PR** — mandatory. From inside the worktree:
   ```bash
   ./scripts/land-issue.sh
   ```
   This pushes the feature branch and opens a PR. Confirm the PR URL is printed.
5. **Verify** — branch pushed AND PR open against main. `gh pr view` should show it.

**CRITICAL RULES:**

- Work is NOT complete until a PR is open against main
- NEVER stop before running `land-issue.sh` — that leaves work stranded locally
- NEVER say "ready to push when you are" — YOU must push and open the PR
- NEVER try to push directly to main — it's protected
- If push or PR creation fails, resolve and retry until it succeeds
- Worktree cleanup happens AFTER Danyel merges the PR, not before

## Why not beads?

Beads was the previous tracker. It had nice features (dependency graph, memories, sync) but for this solo project we weren't using the dep graph and the Dolt-backed daemon was too much infrastructure to babysit. A folder of markdown files is honest, git-native, and has zero moving parts.

The old data lives in `.beads-archive/` for grep purposes. Don't run `bd` against it.
