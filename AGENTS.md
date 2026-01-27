# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

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
./scripts/land-bead.sh
```

This script will:
1. Verify no uncommitted changes
2. Sync beads changes to beads-sync branch
3. Pull latest from remote
4. Merge feature branch into main (only code changes, no beads files)
5. Push to remote
6. Close the bead and sync
7. Clean up the worktree
8. Optionally delete the feature branch

**DO NOT try to merge manually** - use the land-bead.sh script to avoid beads conflicts.

## Landing the Plane (Non-Worktree Sessions)

**When ending a regular work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
