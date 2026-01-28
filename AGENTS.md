# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## How to Code

When you start in a worktree, expect to work in that worktree as autonomously as you can on the corresponding bead and its dependencies.

**UI Changes:** If you make a change that affects the UI, you MAY NOT consider it complete until Danyel has looked at it and agreed it's ready to close.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Working in Worktrees

**Starting work:**

```bash
./scripts/work-on-bead.sh tm-xxx
```

This creates an isolated git worktree and launches Claude with full context.

**Landing work (merge and cleanup):**

When you're done with the work, run from within the worktree:

```bash
./scripts/land-bead.sh --delete-branch
```

The `--delete-branch` flag automatically deletes the feature branch (recommended for most cases).
Omit it if you want to be prompted.

This script will:

1. Verify no uncommitted changes
2. Sync beads changes to beads-sync branch
3. Pull latest from remote
4. Merge feature branch into main (only code changes, no beads files)
5. Push to remote
6. Close the bead and sync
7. Clean up the worktree
8. Delete the feature branch (if --delete-branch passed)

**DO NOT try to merge manually** - use the land-bead.sh script to avoid beads conflicts.

**Note:** The worktree directory will be removed after landing, so any commands after that will fail (this is expected).

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
