# Divine Names Overlay Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Color-code Torah verses based on which divine name they use (YHWH, Elohim, both, or neither).

**Architecture:** Preprocess Sefaria Hebrew text to count divine names per verse, store as compact JSON, integrate colors into existing layout system.

**Tech Stack:** TypeScript, Node.js for preprocessing, existing WebGL renderer

---

## Data Pipeline

Fetch Torah books from Sefaria's GitHub export (Hebrew text-only JSON files). Each book file contains nested arrays: `book.text[chapter][verse]` where each verse is a Hebrew string.

For each verse, scan for:
- **יהוה** (YHWH/Tetragrammaton)
- **אלהים** (Elohim)

Generate a preprocessed JSON file (`public/data/divine-names.json`) structured as:
```json
{
  "Genesis": [[0,1,0,2,1,...], [1,0,2,...], ...],
  "Exodus": [...]
}
```

Where each number encodes: `0`=neither, `1`=YHWH only, `2`=Elohim only, `3`=both.

This keeps the runtime data tiny (~6KB for all 5,672 verses) and avoids shipping Hebrew text to the browser.

---

## Color Scheme

| Code | Meaning | RGB |
|------|---------|-----|
| 0 | Neither | Gray (0.4-0.8 brightness, existing variation) |
| 1 | YHWH only | Blue `[0.3, 0.5, 0.9]` |
| 2 | Elohim only | Red `[0.9, 0.3, 0.3]` |
| 3 | Both | Purple `[0.7, 0.3, 0.8]` |

---

## Rendering Integration

Modify `layout.ts` to:
1. Accept divine names data as parameter to `computeLayout()`
2. Look up each verse's divine name code
3. Assign color based on code (or keep gray with variation for code 0)

No changes needed to geometry.ts, webgl.ts, or shaders - they already support per-verse RGB colors.

Position jitter and shader dithering remain unchanged.

---

## Preprocessing Script

Node.js script (`scripts/generate-divine-names.ts`):

1. Download 5 Torah book JSON files from Sefaria GitHub raw URLs:
   - `https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/json/Tanakh/Torah/Genesis/Hebrew/Tanakh:%20The%20Holy%20Scriptures,%20published%20by%20JPS.json`
   - (similar for Exodus, Leviticus, Numbers, Deuteronomy)
2. Iterate through each verse, count occurrences of יהוה and אלהים
3. Output `public/data/divine-names.json`

Run manually: `npx ts-node scripts/generate-divine-names.ts`

Cache downloaded files locally. Script is idempotent.

---

## Files to Create/Modify

**Create:**
- `scripts/generate-divine-names.ts` - Preprocessing script
- `public/data/divine-names.json` - Generated data (committed)

**Modify:**
- `src/layout.ts` - Accept divine names data, assign colors
- `src/main.ts` - Load divine-names.json, pass to computeLayout()
- `src/types.ts` - Add DivineNamesData type
