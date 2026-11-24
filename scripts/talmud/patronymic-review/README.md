# Reviewing the patronymic tags by hand

`patronymic-report.ts` lists the places where Sefaria tags only part of an "X son of Y" name.
These scripts turn that list into a sheet with one line per name, each with a first-pass call on
who is meant, for a person to check:

https://docs.google.com/spreadsheets/d/1kgXFBnRxyWd3Db3pVVRXQ3Eq1ROBDYFKKtG0HeJy604/edit

`verdicts.txt` holds the first-pass calls. They come from Sefaria's own entries and from Claude's
knowledge of the sages, not from a reference work. Its line numbers are the ids `names.py` gives,
so they hold only for the dump the sheet was made from.

## Running

`$S` is a working folder that already holds the report's three files: `facts.json`,
`all-topics.json` and `patronymic-report.json`. Run from the repo root.

```bash
D=scripts/talmud/patronymic-review
uv run $D/linktypes.py <dump>/topic_links.bson $S/family.json   # Sefaria's parent and child links
uv run $D/classify.py $S                        # sort each row by what Sefaria's data says
uv run $D/english.py $S public/data/talmud      # what the English translation's tags say
uv run $D/context.py $S public/data/talmud      # the words either side of each name
uv run $D/names.py $S                           # one line per name and current tag
uv run $D/loosematch.py $S                      # people whose name agrees but for vowel letters
uv run $D/sheet.py $S                           # patronymic-review.csv
```
