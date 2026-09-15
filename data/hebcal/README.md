# Hebcal leyning data

Three files copied unchanged from hebcal's leyning package. They are the source
`scripts/generate-haftarah-mappings.ts` reads to build
`public/data/haftarah-mappings.json`. Do not hand-edit them: edit them and the
next refresh silently throws your changes away.

## Where they come from

| File | Contents |
| --- | --- |
| `aliyot.json` | The 54 weekly Torah portions and their combinations: which book, how the reading divides into aliyot, and the haftarah for each of the two customs. |
| `holiday-readings.json` | The same for festivals, fast days, Rosh Chodesh and the four special Shabbatot — 112 occasions, 54 of which have a haftarah. |
| `LICENSE` | Hebcal's BSD 2-Clause licence, which requires that this notice travel with the data. |

Taken from https://github.com/hebcal/hebcal-leyning at commit
`e6768f6cdd3d8d738315e88baf05b5c23adb3fc9` (30 July 2026), files `src/aliyot.json`,
`src/holiday-readings.json` and `LICENSE`.

Hebcal grants the licence but does not document where its own reading table
came from, so this records who gave us permission, not an unbroken chain back
to a first source. The same data is also published as CSV downloads at
https://www.hebcal.com/sedrot/ under CC BY 4.0; the repository was preferred
because BSD 2-Clause is the more permissive of the two and the JSON needs no
parsing.

## How to read an entry

```json
"Bereshit": {
  "num": 1,
  "book": 1,
  "haft": {"k": "Isaiah", "b": "42:5", "e": "43:10"},
  "seph": {"k": "Isaiah", "b": "42:5", "e": "42:21"},
  "fullkriyah": { "1": ["1:1", "2:3"], ... }
}
```

`haft` is the Ashkenazi haftarah and `seph` the Sephardi one. **`seph` appears
only where the two customs differ**, so an entry without it means both read the
same passage — the generator relies on this, and a reader who misses it will
think half the Sephardi readings are missing. Either field may hold a list
instead of a single passage where the reading spans two places in a book, or
two books.

`book` is 1 for Genesis through 5 for Deuteronomy. The portion's span in the
Torah is not stored directly: it runs from the start of the first aliyah to the
end of the seventh.

Hebcal keys some occasions by the calendar accident that produces them —
`"Chanukah Day 4 (on Shabbat)"`, `"Shabbat Shekalim (on Rosh Chodesh)"`. Which
of those keys we take is recorded in `../haftarah-names.json`, and the rows
whose choice is not obvious carry a `note` saying why.

## Refreshing them

```bash
SHA=<commit to pin to>
for f in aliyot.json holiday-readings.json; do
  curl -sL -o "data/hebcal/$f" \
    "https://raw.githubusercontent.com/hebcal/hebcal-leyning/$SHA/src/$f"
done
curl -sL -o data/hebcal/LICENSE \
  "https://raw.githubusercontent.com/hebcal/hebcal-leyning/$SHA/LICENSE"

npx tsx scripts/generate-haftarah-mappings.ts
```

Then update the commit hash above, and the `collected` date on the hebcal
credit in `src/overlays/haftarah.ts`.

The generator fails rather than writing a bad file if hebcal renames a key it
looks for, or if any reference falls outside the verse counts in
`public/data/tanakh-structure.json`. `src/__tests__/unit/haftarah-data.test.ts`
checks the generated file independently, so run the tests after a refresh: a
changed reading will show up there as a failure, which is the point.
