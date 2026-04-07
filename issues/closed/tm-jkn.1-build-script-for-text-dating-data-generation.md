---
id: tm-jkn.1
status: closed
priority: 2
type: task
created: 2026-01-27
closed: 2026-01-27
---

# Build script for text-dating data generation

Create scripts/generate-text-dating.ts that:
- Reads data/text-dating-source.json (range format)
- Reads public/data/tanakh-structure.json (for verse counts)
- Parses chapter/verse ranges including wildcards
- Expands ranges to per-verse entries
- Deduplicates notes into lookup table
- Generates public/data/text-dating.json (runtime format)

Accepts: Source data with ranges like '1-11' or '*'
Produces: Runtime data with note_id references and O(1) lookup
