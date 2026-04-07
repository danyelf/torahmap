---
id: tm-7en
status: closed
priority: 2
type: feature
created: 2026-01-13
closed: 2026-01-13
---

# Implement special occasion haftarot

Extend haftarah overlay to show haftarot for special occasions beyond regular weekly parshiot.

## Special Occasions to Add
- **Rosh Chodesh**: Shabbat Rosh Chodesh, Shabbat Erev Rosh Chodesh
- **Four Shabbatot**: Shekalim, Zachor, Parah, HaChodesh
- **High Holidays**: Rosh Hashanah (2 days), Yom Kippur (Shacharit, Mincha)
- **Sukkot**: Days 1-2, Chol HaMoed Shabbat, Shemini Atzeret, Simchat Torah
- **Pesach**: Days 1-2, Chol HaMoed Shabbat, Days 7-8
- **Shavuot**: Days 1-2
- **Fast Days**: Tisha B'Av (Shacharit, Mincha), etc.
- **Other**: Shabbat Chanukah (1-2), Shabbat HaGadol

## Implementation Plan

1. Add `specialOccasions` array to `haftarah-mappings.json`
2. Update types in `src/overlays/haftarah.ts`
3. Update `buildIndexes()` to include special occasions (indices 54+)
4. Extend rainbow across all ~84 items (parshiot + special occasions)
5. Update hover info for special occasion haftarot
6. Update legend
7. Add special occasions data to generation script

## Design Decisions
- Rainbow extends to include special occasions (no separate color scheme)
- No additional UI controls - always shown alongside parshiot
- Use existing stipple pattern for overlap cases

## Files to Modify
- `scripts/generate-haftarah-mappings.ts`
- `public/data/haftarah-mappings.json`
- `src/overlays/haftarah.ts`
- `src/__tests__/overlays/haftarah.test.ts`
