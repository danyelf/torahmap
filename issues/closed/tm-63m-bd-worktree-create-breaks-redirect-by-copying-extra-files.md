---
id: tm-63m
status: closed
priority: 2
type: bug
created: 2026-01-27
closed: 2026-01-27
---

# bd worktree create breaks redirect by copying extra files

**Bug**: `bd worktree create` copies database, config, and other files into the worktree's .beads/ directory, which prevents the redirect mechanism from working.

**Expected behavior**: Worktrees should share the main repo's database via the redirect mechanism. The .beads/ directory in a worktree should contain ONLY the redirect file.

**Actual behavior**: `bd worktree create` creates:
- .beads/redirect (correct)
- .beads/beads.db (breaks redirect!)
- .beads/config.yaml (unnecessary)
- .beads/issues.jsonl (unnecessary)
- etc.

When these extra files exist, bd commands in the worktree use the local database instead of following the redirect. This causes:
- Worktrees to have stale/divergent state
- Status shown differently between main and worktrees
- Loss of work when switching sessions

**Reproduction**:
1. bd worktree create ../test-worktree --branch test
2. cd ../test-worktree
3. ls -la .beads/  # Shows many files, not just redirect
4. bd show <issue>  # Shows stale/different status than main repo

**Workaround**:
```bash
cd worktree
REDIRECT_TARGET=$(cat .beads/redirect)
rm -rf .beads/*
echo "$REDIRECT_TARGET" > .beads/redirect
```

After cleanup, worktrees properly share database with main repo.

**Impact**: High - breaks core worktree functionality for multi-agent workflows
**Version**: bd v0.49.1

Should `bd worktree create` only create the redirect file and nothing else?
