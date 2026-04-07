---
id: tm-dkn
status: closed
priority: 2
type: feature
created: 2026-01-13
closed: 2026-01-13
---

# Refactor haftarah generation to parse from mechon-mamre HTML

## Problem
The current `scripts/generate-haftarah-mappings.ts` has hardcoded haftarah data with multiple errors:
- Truncated readings (Tazria, Vaera, Yitro, Terumah, Balak, Matot)
- Wrong verse ranges (Vayikra, Tzav, Acharei)  
- Swapped Ashkenazi/Sephardi traditions (Vayeilech, Vayishlach)

Manual data entry is error-prone.

## Solution
Fetch and parse directly from https://mechon-mamre.org/jewfaq/readings.htm - the canonical source. This way errors can be traced back to the original HTML.

## Implementation

### 1. Create: `data/readings.html`
Cached copy of the mechon-mamre page for:
- Offline generation
- Diffing against live version to detect upstream changes
- Version control of the source data

### 2. Modify: `scripts/generate-haftarah-mappings.ts`
- Remove hardcoded PARSHIOT and SPECIAL_OCCASIONS arrays
- Add HTML parser for the two tables (weekly parshiot + special readings)
- Parse verse references:
  - `Isaiah 42,5-43,10` (mechon-mamre uses commas)
  - `Jeremiah 34,8-22; 33,25-26` (semicolon-separated segments)
  - `(Sephardi: 42,5-21)` parenthetical variants
- Map book names: "2 Kings" → "II Kings"
- Keep Hebrew parasha name mapping
- Keep validation against tanakh-structure.json

### 3. Output unchanged: `public/data/haftarah-mappings.json`

## Verification
```bash
npx tsx scripts/generate-haftarah-mappings.ts
grep -A20 "Vayikra" public/data/haftarah-mappings.json  # Should show Isaiah 43:21-44:23
npm test
```
