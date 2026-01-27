# Text Dating Data Format

This directory contains source data for biblical text dating visualization.

## Source Format: `text-dating-source.json`

The source file contains dating estimates for passages of biblical text. Each entry specifies:

- **book**: Book name (must match names in `tanakh-structure.json`)
- **chapter**: Chapter number (1-indexed)
- **verses**: Verse range specification (see below)
- **dating**: Estimated date range
  - **min**: Earliest estimated date (BCE as negative, CE as positive)
  - **max**: Latest estimated date
- **note**: Explanation of the dating (e.g., source attribution, scholarly consensus)

### Verse Range Format

The `verses` field supports three formats:

1. **Single verse**: `"5"` - Just verse 5
2. **Range**: `"1-11"` - Verses 1 through 11 (inclusive)
3. **Wildcard**: `"*"` - All verses in the chapter

### Example

```json
{
  "entries": [
    {
      "book": "Genesis",
      "chapter": 1,
      "verses": "*",
      "dating": {
        "min": -950,
        "max": -900
      },
      "note": "P source (Priestly)"
    },
    {
      "book": "Exodus",
      "chapter": 20,
      "verses": "1-17",
      "dating": {
        "min": -1300,
        "max": -1200
      },
      "note": "Ten Commandments - traditional dating to Mosaic period"
    }
  ]
}
```

## Runtime Format: `public/data/text-dating.json`

The generation script (`scripts/generate-text-dating.ts`) processes the source file into an optimized runtime format:

- Expands all verse ranges into individual verse entries
- Deduplicates notes into a lookup array
- Produces per-book, per-chapter, per-verse data structure
- Enables O(1) lookup by verse coordinates

### Structure

```json
{
  "notes": [
    "P source (Priestly)",
    "J source (Yahwist)",
    ...
  ],
  "books": {
    "Genesis": [
      // Chapter 1
      [
        { "d": [-950, -900], "n": 0 },  // Verse 1: date range, note_id
        { "d": [-950, -900], "n": 0 },  // Verse 2
        ...
      ],
      // Chapter 2
      [...]
    ]
  }
}
```

### Field Abbreviations

- `d`: Date range `[min, max]`
- `n`: Note ID (index into `notes` array)

## Generating Runtime Data

After editing `text-dating-source.json`, regenerate the runtime file:

```bash
npm run generate:text-dating
```

Or directly:

```bash
npx tsx scripts/generate-text-dating.ts
```

## Date Conventions

- **BCE years**: Negative numbers (e.g., `-950` = 950 BCE)
- **CE years**: Positive numbers (e.g., `100` = 100 CE)
- **Ranges**: Use scholarly consensus for date ranges
  - Wider ranges for uncertain datings
  - Narrower ranges for well-established dates

## Data Sources

The dating estimates should be sourced from:

1. **Wikipedia**: Baseline scholarly consensus dates
2. **Academic literature**: Recent biblical scholarship
3. **Documentary Hypothesis**: Traditional source divisions (J, E, P, D, R)
4. **Post-documentary research**: Updated scholarly views

Always document the source/reasoning in the `note` field.
