---
name: landed
description: Use when Danyel says a pull request is merged or landed ("merged, clean up", "258 has landed, rebase and carry on", "clean up the worktrees"), or asks to remove dead worktrees.
---

# Landed

Two different requests share these words:

- **"merged, clean up"** — the work is finished. Remove what it left behind.
- **"N has landed, rebase and carry on"** — someone else's pull request moved main
  under a branch still in progress. Bring that branch up to date and keep going.

## Merged, clean up

1. **Leave the worktree.** A session inside a worktree cannot touch any other one,
   and the worktree you are standing in is locked. Call `ExitWorktree` with
   `action: "keep"`: `"remove"` compares against the local main, which has not
   seen the merge yet, and refuses. The sweep removes it. If you cannot leave,
   stop and tell Danyel: nothing below works from inside a worktree.
2. **Stop what you started for it**: background dev servers and subagents
   (`TaskStop`). A process you did not start is not yours, whatever port it holds.
3. **Sweep.** `bash scripts/sweep-worktrees.sh` lists what it would remove and
   why it keeps the rest. Removing every worktree it marks `remove` is what
   Danyel wants — they are merged, clean and unused — so run it again with
   `--apply` without asking. If it keeps the worktree you just left as "in use
   by caffeinate", that is Claude Code's own process; remove that one by hand
   (`git worktree remove <path> && git branch -d <branch>`).
4. **Update main**, if the primary checkout is on main and clean:
   `git -C <primary> pull --ff-only`. Never switch its branch.
5. **Memory.** Search the memory folder for the pull request number and branch
   name. Record the merge in the note that tracks this effort; if the effort is
   finished, delete the note and its line in `MEMORY.md`.
6. **Clear the in-progress label.** Remove it from the issues the merged pull
   request closed (`gh issue edit <N> --remove-label in-progress`). Then list
   what still carries it (`gh issue list --label in-progress --state all`) and
   check each against `git worktree list` and its open pull requests.
7. **Report** in a few lines: what was removed, anything the sweep kept that
   looks abandoned (a closed pull request, an agent worktree with no pull
   request), any in-progress issue with no worktree or pull request behind it,
   and that the site deploys about a minute after the merge. Ask about the
   abandoned ones; do not remove them.

## Landed, rebase and carry on

1. `git fetch origin && git rebase origin/main` in the branch you are working on.
2. Resolve conflicts, then `npm test` and the typecheck.
3. If the branch has a pull request, `git push --force-with-lease`.
4. Carry on with the task. Other open pull requests are not yours to rebase
   unless he names them.
