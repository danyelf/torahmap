# Issues — Archive

Active issue tracking has moved to **GitHub Issues**: https://github.com/danyelf/torahmap/issues

This directory is now read-only history.

## Layout

```
issues/
  closed/           # 194 closed issues, kept for searchable history
  MIGRATION-MAP.md  # tm-XXX → #N mapping for issues that were lifted to GH
  README.md         # this file
```

`open/` was deleted on 2026-05-07 — its 32 contents were migrated to GitHub Issues. The closed archive is preserved because it's full of useful context referenced from PRs, commit messages, and design docs.

## Searching the archive

```bash
# Find a closed issue by topic
grep -rl "search overlay" issues/closed/

# Find an issue by its old tm-XXX id
grep -rl "id: tm-7la" issues/closed/

# Look up where an old tm-XXX id went after migration
grep '^| tm-' issues/MIGRATION-MAP.md | grep tm-7la
```

## File format (historical)

Each archived file has YAML-like frontmatter and a `# Title` heading:

```markdown
---
id: tm-abc
status: closed
priority: 2          # 0=critical .. 4=backlog
type: bug            # bug | feature | task | chore
created: 2026-04-06
closed: 2026-04-10
---

# Short title

Body.
```

## Why the migration?

Markdown-in-tree was clean for a solo workflow but fell down on **discoverability across in-flight branches** — branch B couldn't see issues filed on branch A until A merged. GitHub Issues gives global visibility, native PR cross-linking, and a UI for non-CLI usage. Closed issues are kept here because pulling 194 archived items into GH would create more noise than signal.

History: see `.beads-archive/` for the tracker before this one.
