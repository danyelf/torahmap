# Text Dating Data Format

## Source Format: `text-dating-source.json`

The source file is a flat JSON array. Each entry dates one chapter, one range
of chapters, or (with `"all"`) a whole book, to a single point estimate:

- **book**: Book name (must match names in `tanakh-structure.json`)
- **chapters**: `"15"`, a range like `"1-14"`, comma-separated ranges like
  `"1-14,16-40"`, or `"all"` for every chapter in the book
- **verses**: `"all"`, a single verse (`"5"`), or a range (`"1-11"`)
- **era**: one of the six eras in `src/overlays/text-dating.ts`
- **date_bce**: a single estimated year BCE
- **note**: explanation of the dating (source attribution, scholarly view)
- **citation**: optional URL, appended to the note as a link

### Example

```json
[
  {
    "book": "Exodus",
    "chapters": "15",
    "verses": "all",
    "era": "pre_monarchic",
    "date_bce": 1250,
    "note": "Song of the Sea - Late 13th century BCE, one of the earliest Hebrew poems.",
    "citation": "https://en.wikipedia.org/wiki/Dating_the_Bible"
  }
]
```

### Legacy format

`scripts/generate-text-dating.ts` also accepts an older shape,
`{ "entries": [ { book, chapter, verses, dating: { min, max }, note } ] }`,
with a numeric `chapter` per entry and an explicit `[min, max]` date range
instead of a single `date_bce`. Nothing in the repository is in this format
today, but the generator keeps reading it.

## Runtime Format: `public/data/text-dating.json`

`scripts/generate-text-dating.ts` expands every entry to one record per verse,
converting each `date_bce` to a `[min, max]` range (±25 years), deduplicating
notes into a lookup array, and producing a per-book, per-chapter, per-verse
structure for O(1) lookup by verse coordinates:

```json
{
  "notes": ["P source (Priestly)", "J source (Yahwist)"],
  "books": {
    "Genesis": [
      [{ "d": [-950, -900], "n": 0 }, { "d": [-950, -900], "n": 0 }]
    ]
  }
}
```

`d` is the date range `[min, max]`; `n` is the index into `notes`. Where two
entries date the same verse, the earlier one wins.

## Regenerating

```bash
npm run generate:text-dating
```

See DATA_REGENERATION.md for when to update the `collected` date.
