# Dating the Talmud by the rabbis it names

**Status:** Approved by Danyel, 2026-10-24. Issue #25.

An overlay for the Talmud map that colours each passage by the generation of the latest rabbi it
names, so that reading one discussion shows its layers: who speaks early, who answers late.

## Decided

These are Danyel's, from #25 and from conversation.

- **Data: Sefaria alone.** Which rabbis a passage names, and each rabbi's generation, come from
  Sefaria's database dump: its person tags ("mentions") on the Talmud, counting only tags found in
  the Hebrew/Aramaic text. Tags found only in the English translation are left out. Brown's
  Rabbinic Citation Network is not used. On a sample of 100, Sefaria's Hebrew-text tags were about
  2% wrong against Brown's 7%.
- **A passage's date is the latest generation among the rabbis it names.**
- **A rabbi listed under two generations** (such as A2/A3) counts as the later one.
- **Uncertain.** When Sefaria can't resolve a name (ר"א could be two people), it tags an
  "ambiguous" topic listing the candidates. A passage dated only through such a name is shown as
  uncertain, not left out.
- **A passage that names no rabbi is dimmed but keeps a faint tint** of the map's usual
  Mishnah/Gemara colouring (`apps/talmud/src/baseColor.ts`), so the shape of the page still shows.
  This covers the Mishnah, quoted early teachings ("our rabbis taught") and the anonymous voice of
  the Gemara alike. The anonymous voice may get a colour of its own later.
- **No borrowing from neighbours.** An unnamed passage does not take the date of the passages
  around it, which would carry a late date into a Mishnah or early quotation beside a late rabbi.
- **Names in both Hebrew and English** in the pinned passage's panel.

## Also agreed (proposed by Claude, approved with the design)

- **Colours.** Each era has a colour family of its own, so an era shows at a glance, and its
  generations step within it, early to late: the Zugot violet to magenta, the Tannaim orange to
  yellow, the transitional generation a plain green between them, the Amoraim cyan to deep blue.
- **Uncertain passages** take their generation's colour, paler. On the map's tiny squares a lighter
  colour stays readable where a pattern would not.
- **The key**, in the side panel, lists only the generations that occur, each with rough years from
  Sefaria ("Tannaim, 5th generation · c. 135–170 CE"), plus "uncertain" and "names no rabbi".
- **The pinned passage's panel** is one line of the rabbis found, `Rava · רבא (A4); Abaye · אביי
  (A4)`, so a colour can always be checked; the rabbi who sets the date is in bold, and an ambiguous
  name shows its latest candidate as `(A3?)`. The key explains the generation codes. Each name is
  also marked in the passage's Hebrew in its generation's colour (pale if ambiguous), where the
  generator can find it in the map's own text.
- **The link** carries the overlay as on the Tanakh map (`?overlay=…`), with no settings yet.
- **The Zugot and the transitional generation are generations** like any other. The Zugot (Z3, the
  pairs before the Tannaim) are the earliest step; the transitional generation (TA) sits between
  the last Tannaim and the first Amoraim.
- **An uncertain passage is dated by its latest candidate**, matching the two-generation rule.
- **A passage with any resolved name is never uncertain.** Its date comes from the resolved names,
  and ambiguous names in it are ignored. 2,615 passages (6% of those dated) are dated only through
  an ambiguous name.

## What the data holds

Worked out while checking accuracy for #25; those scripts are scratch, so the builder rewrites them.

- **Where.** The topic data is inside `data/talmud/raw/sefaria-dump/dump_small.tar.gz` (2.6 GB,
  gitignored; in the primary checkout, not in worktrees). Extract `./dump/sefaria/topic_links.bson`,
  `topics.bson` and `time_period.bson` (about 7 seconds). They are MongoDB BSON files: Python's
  `bson` (from `pymongo`) or a Node BSON reader can read them.
- **A mention** is a `topic_links` row with `linkType: "mention"` and `class: "refTopic"`. Its `ref`
  looks like `Berakhot 11a:15`, where the last number is the 1-based line. Our
  `public/data/talmud/texts/<tractate>.json` starts at 2a as amud index 0. Jerusalem Talmud and
  Mishnah refs use other names and are dropped.
- **Language and edition.** `charLevelData.language` is `he` or `en`, and
  `charLevelData.versionTitle` names the edition. Use `William Davidson Edition - Aramaic`, the text
  the map shows. The same name is also stored for the vocalized Aramaic, the English and Wikisource,
  so a line can carry one person up to four times.
- **Generation** is `topics.properties.generation.value`; `time_period` gives each code's years by
  its `symbol`. 2,870 Hebrew-text tags (5.6%) name a person with no code, and date nothing.
- **Names** are the `primary: true` entries of `topics.titles`, one for `en` and one for `he`.
- **Ambiguous names** are tagged to a topic whose slug ends `(ambiguous)`. Its candidates are
  `topic_links` rows with `linkType: "possibility-for"`, `class: "intraTopic"`, the candidate in
  `fromTopic`. The mention's `unambiguousToTopic` is the tagger's guess; don't use it.
- **Overlapping tags.** A title can be tagged as its own person inside a fuller name, such as "Rav"
  inside "Rav Shmuel bar Rav Yitzhak" in Niddah 47b. The date is unaffected, but the pinned panel
  should drop a tag whose span lies inside another's, and so should the marks in the Hebrew.

The generations that tagged people carry, with the number of Hebrew-text tags:

| Code | Who | Years (approx.) | Tags |
| --- | --- | --- | --- |
| Z3 | Zugot | 100–60 BCE | 36 |
| T3 | Tannaim, 3rd | 80–110 | 78 |
| T4 | Tannaim, 4th | 110–135 | 430 |
| T5 | Tannaim, 5th | 135–170 | 2,815 |
| T6 | Tannaim, 6th | 170–200 | 475 |
| TA | Transitional | 200–220 | 381 |
| A1 | Amoraim, 1st | 220–250 | 8,203 |
| A2 | Amoraim, 2nd | 250–290 | 10,313 |
| A3 | Amoraim, 3rd | 290–320 | 7,708 |
| A4 | Amoraim, 4th | 320–350 | 10,159 |
| A5 | Amoraim, 5th | 350–375 | 2,415 |
| A6 | Amoraim, 6th | 375–425 | 2,798 |
| A7 | Amoraim, 7th | 425–460 | 90 |
| A8 | Amoraim, 8th | 460–500 | 3 |

Two-generation codes (A1/A2 through A6/A7) add 2,115 tags and count as the later generation.
`time_period` also defines T1, T2, Z1–Z5 and other pairs that no tagged person carries.

## What it takes

**The Talmud's first overlay.** The Talmud map has no overlays yet: `overlays: []` in
`apps/talmud/src/text.ts`, and its link has no overlay parameters (`overlayParams: () =>
undefined`). This work wires overlays into the Talmud the way the Tanakh has them, through the
shared overlay interface in `packages/shell`, the entry in `packages/overlay-catalog`, and the link
keys. The nearest model is the Tanakh's Text Dating overlay,
`apps/tanakh/src/overlays/text-dating.ts`: a fixed list of periods, a colour each, and a key.

**A generated data file.** A script beside the other Talmud scripts in `scripts/talmud/` reads the
Sefaria dump and writes one file to `public/data/talmud/`: for each passage, its latest
generation, whether that date is uncertain, and the rabbis it names. The file is committed like the
rest of `public/data`, and loads only when the overlay is chosen.

## Settled after review

A reader checked whether this could be built without asking. Its questions, and the answers
(Claude's calls unless marked):

- **Does a Sefaria line equal one of our passages?** Yes: both total 81,793. The script still checks
  the count per tractate against `public/data/talmud/texts/` and stops if one is off, and stops on
  a range ref rather than dropping it.
- **Is the overlay list per text?** If the catalogue has no notion of which text an overlay belongs
  to, add it, so this overlay never appears on the Tanakh's or the AI Act's menu.
- **Can the pinned panel take an overlay's own lines?** If not, add the smallest hook that allows
  it, in the shared shell, usable by any text.
- **Python or Node for the dump?** The builder's choice. Tests and CI never run the generator, so
  the dump is never needed outside it.
- **Can pale and full colours be told apart?** Judged on the PR. It changes the UI, so the PR shows
  screenshots of full, pale and tinted no-rabbi passages at the zoom levels the moiré guidance in
  `CLAUDE.md` names, and isn't done until Danyel has looked.
- **Browser suites:** `npm run test:browser` decides which run; if it asks for the loading suite,
  its expectations for the new file are in scope.
- **Names in Hebrew and English** (Danyel). **No-rabbi passages keep a faint tint** (Danyel).

## Out of scope, and left to the builder

Not in this work:

- A colour for the anonymous voice of the Gemara.
- Rabbis with no recorded generation: they name a person but date nothing.
- Filtering by rabbi, or searching for one.
- Brown's data.

Left to the builder:

- The data file's exact shape, and how it joins the Talmud's loader.
- The exact colours, within warm-to-cool by generation.
- The wording of the key and of the overlay's description.
- Tests of the script's rules on small examples: latest generation wins, two-generation codes take
  the later, English-only tags are ignored, a passage dated only by an ambiguous name is uncertain,
  a resolved name beats an ambiguous one. Plus a check that every passage in the shipped file
  exists on the map.
