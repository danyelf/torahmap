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
3. Pull latest main, merge the feature branch, push
4. Remove the worktree
5. Delete the local feature branch (use `--keep-branch` to skip)

**DO NOT try to merge manually** — use `land-issue.sh` so the issue file gets moved to `closed/` consistently.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

1. **File issues for remaining work** — `./scripts/issues-new.sh "Title"` for anything that needs follow-up
2. **Run quality gates** (if code changed) — `npm test`, build, etc.
3. **Update issue status** — close finished work by moving the file to `issues/closed/`
4. **PUSH TO REMOTE** — mandatory:
   ```bash
   git pull --rebase
   git push
   git status   # MUST show "up to date with origin"
   ```
5. **Clean up** — clear stashes, prune remote branches
6. **Verify** — all changes committed AND pushed

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing — that leaves work stranded locally
- NEVER say "ready to push when you are" — YOU must push
- If push fails, resolve and retry until it succeeds

## Why not beads?

Beads was the previous tracker. It had nice features (dependency graph, memories, sync) but for this solo project we weren't using the dep graph and the Dolt-backed daemon was too much infrastructure to babysit. A folder of markdown files is honest, git-native, and has zero moving parts.

The old data lives in `.beads-archive/` for grep purposes. Don't run `bd` against it.
