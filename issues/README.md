# Issues

Plain markdown issue tracker. One file per issue.

## Layout

```
issues/
  open/      # active work
  closed/    # done (kept for searchable history)
  README.md  # this file
```

Status = which folder the file lives in. To close an issue, `git mv` it from `open/` to `closed/` and add a `closed:` line to the frontmatter.

## File format

Filename: `<id>-<short-slug>.md` where id is a short random-ish tag (e.g. `tm-7ca`). Slug is for human grep, id is the stable handle.

```markdown
---
id: tm-abc
status: open
priority: 2          # 0=critical, 1=high, 2=medium, 3=low, 4=backlog
type: bug            # bug | feature | task | chore
created: 2026-04-06
---

# Short title

Why this exists. What "done" looks like. Any context the next reader (you or an agent) needs.
```

## Common operations

```bash
# What's open?
ls issues/open/

# What's high priority?
./scripts/issues-ready.sh

# New issue
./scripts/issues-new.sh "Fix the zoom bug" bug 1

# Close
git mv issues/open/tm-abc-*.md issues/closed/
# then edit frontmatter: status: closed, add closed: 2026-04-06
```

## Why not beads?

Beads was great in theory but spent too much time fighting Dolt, hooks, and sync. For a solo project with no real dependency graph, a folder of markdown wins on simplicity, git-friendliness, and zero infrastructure.

History: see `.beads-archive/` (or git log) for the previous tracker.
