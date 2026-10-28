# The IEEE VIS map

**Status:** Built, awaiting Danyel's review (PR #471's rebuild). Preview only: the live site does not
build this page. Issue #491 (authors and keywords) is part of it.

The IEEE VIS 2026 program laid out as a map at `/ieeevis/`, one square per quarter page of each of its
488 papers, in a fixed place, with the same shell as the other texts (`createApp`).

## Decision: keep the spike's code, clean it, and rebuild only around it

#471 was a spike, and Danyel asked for it to be reimplemented from scratch with fewer flip-flops. This
document is the specification that request calls for; the code was checked against it rather than
thrown away. The reason is evidence, not preference:

- **The folder is small and has one path through it.** `apps/ieeevis/` was about 1,150 lines. One
  `listOverlay` already builds both Authors and Keywords; one `computeLayout` places everything; the
  shell's search, popup and story are used as the other texts use them. There is no second pipeline
  and no abandoned option except the layout's `?fill=` choice, which Danyel has not yet decided on.
- **The flip-flops were in the shared code, and they are out of the folder.** What the spike changed
  its mind about (the picker, the colour rules, the Worker route, the label options) lived outside
  `apps/ieeevis/`. Those pieces are now their own pull requests, each reviewed alone (#493, #496,
  #497, #498), so the VIS pull request holds only VIS.
- **What a rewrite would reproduce, the spike already had.** The rebuilt layout, started from nothing
  but this spec, would have the same modules in the same places. A cleaning pass found what was left
  over (below) and fixed it; each fix was checked against the spike, with the same twelve states on
  both servers giving identical pixels and identical text.

Residue found and removed:

- The time-slot grouping was a state machine inside the layout loop, comparing each session's start
  with the last one's. It is now a `timeSlotsOf(day)` in the data, and the layout walks slots. The
  new layout equals the old on the real data in all three fill orders (compared object for object).
- `hex` (a colour from `#9aa3ad`) and `idHash` (a square id's jitter seed) were copied from the AI Act's
  code. Both now live in `packages/utils` (#498).
- `covers.ts`, the tinted panel behind a group of squares, sat in `packages/shell` with a comment
  saying the Talmud used it; the Talmud has its own. It is now in the VIS folder.
- Sections and Paper type each wrote the legend row's HTML by hand, and the list overlays wrote it a
  third way. One `legendRow` and `swatchRow` now serve all four.
- Authors and Keywords each exported a URL-parameter list that `text.ts` picked between by id; the
  link keys now ask the overlay list.
- `data.ts` named a script path that had moved to the scrape project.
- Exports nothing imported.

## What the map shows

- **Days side by side**, each with its name on the left reading upward. A last column, "Not
  scheduled", holds sessions the program gives no day.
- **Time slots down each day.** Sessions that start together share one tinted, edged rectangle with
  the start time on a tab at its top; sessions with no time sit under "No time given". The program gives
  no end times.
- **Sessions in each slot**, each with its name above it, wrapping to more lines when it is too long
  for its width (the workshop titles). Papers in rows of eight under the session.
- **A paper is a block of squares**, four across, one for each piece of about 250 words in order. A paper
  with no text at all (18 of 488) is a block of dark squares with a dim ring, sized by its kind of paper.
- **Opening colouring: Paper type.** The story's first stop names that overlay, so a first-time
  visitor sees it. A returning reader, who skips the story, opens with no overlay.

## What a reader can do

- **Overlays.**
  - *Sections*: colours each piece by the part of its paper it falls in (abstract, introduction,
    related work, method, evaluation, discussion, conclusion, references, other). Dark squares have no text.
  - *Paper type*: full VIS paper, journal paper (TVCG, CG&A), short paper, workshop paper, poster,
    challenge contribution, arts program or talk.
  - *Authors* and *Keywords*: pick names, with suggestions as you type and a list of the 18 with the
    most papers as chips. Papers by a picked name light up in its colour (a paper by two is split between
    them); every other square dims. At most four picks. Clicking a picked chip again unpicks it. Keywords are
    shown in Title Case (acronyms and words with a digit or an inner capital are kept, short joining words
    stay lower case); they are matched and linked as written. The legend says how many papers list keywords
    (316 of 488).
- **Search** over every paper's title, authors and full text, with the shell's word and substring modes.
  A paper's title is found on its first piece only. Matches take colours from the same nine as the picks, so
  a word and a pick never share one (see the colour rules below).
- **A popup** for a piece: the paper's title (cut at 32 characters) and the piece's place ("3/15"), a link
  out to the conference site, and the piece's text, with the authors first on a paper's first piece. A
  piece in the References section shows each numbered entry on its own line.

## Data

Two files in `public/data/ieeevis/`, written by the
[ieeevis-scrape](https://github.com/danyelf/ieeevis-scrape) project's `build.py` (see
`docs/working-in-the-repo.md`, "IEEE VIS data"):

- `structure.json`, committed, 185 KB: `days[] → sessions[] → papers[]`. A session has a name and `start`
  ("10:00", or empty). A paper has `index`, `title`, `authors[]`, optional `keywords[]`, `kind`, `when`,
  and `pieces`, a string with one section letter per piece (`a i r m e d c f o`, or `x` for no text).
- `texts.json`, **never committed**, 21 MB: the text of each piece by its id, `"<paper index>.<piece>"`.
  Copyright varies and the repository is public. The Worker serves it from the private R2 bucket
  `torahmap-ieeevis` at the same path (#496), behind Cloudflare Access. 441 papers have full text, 29
  an abstract only, 18 neither.

The map opens on `structure.json` alone; the popup and search ask for `texts.json` when first used.

## Link parameters

| Parameter | Meaning |
| --- | --- |
| `at` | The pinned piece, `paper.piece` (`1.12`). |
| `zoom`, `x`, `y` | The camera, as for the other texts. Zoom runs 0.08 to 12. |
| `overlay` | `sections`, `kinds`, `authors` or `keywords`; absent for none. |
| `authors`, `keywords` | The picks as a plain, comma-separated list of names as written. |
| `search`, `mode` | The search words and how each is matched, as for the other texts. |
| `story`, `stop` | While reading the one story. |
| `fill` | `rows` (default), `columns` or `sections`: the order a paper's pieces fill its block. |

## Colour rules for picks and search words

Words and picks draw from one set of nine colours (`packages/shell/src/overlays/palette.ts`; #497). A new
word or pick takes the first colour no other holds and keeps it until removed. A link carries no colours:
on opening, words take colours first and picks follow in link order. At most five words and four picks.

## Hard-won fixes

- `texts.json` is never committed. Do not add it, a PDF or a cached page, and do not log its text.
- A Worker module cannot export a constant; the route's path stays unexported.
- Reference entries are split only when the popup is drawn, only for the References section, and only
  at `[n] ` after a space: splitting anything else breaks bracketed numbers in running text. Search
  reads the stored text, not the split.
- The program pages pack several keywords into one with `;`; the scrape splits them. 949 of 1,110
  keywords are on one paper only, so the legend says how many papers list any, so that a paper with none
  is not read as having none.
- An empty search box holds no colour; it takes one with its first word, or it would use up the first colour.
- `reduce(addTerm)` fails the typecheck now that `addTerm` takes `taken`; write the lambda.
- `.map(colorToCss)` passes the index as the second argument; the alpha version is a separate function.
- The layout reporter deletes tracked shots; restore with `git checkout -- layout-report`, and `git add -f`
  only the states being committed.
- A hand-driven headless Chromium needs `--use-gl=angle --use-angle=swiftshader
  --enable-unsafe-swiftshader --ignore-gpu-blocklist`, or the page says WebGL is missing.
- The pre-commit typecheck also covers `test-harness/` and `video/`.

## Not in scope

- Paper type as the default overlay for a returning reader. It needs a way to write "no overlay" in a
  link and a default overlay in the shell.
- A word and a pick can still share a colour after the reader switches to another overlay that holds
  picks, since only the current overlay's picks count as taken.
- On a phone, typing in a finder grows the sheet past the room the map has made for it. The Talmud's
  Rabbis finder does the same (#492).
- Putting the page live: `live: false` in `build.ts` keeps it out of torahmap.org.
- Two spellings of one author's name count as two authors; the program gives no author ids.
- Whether `sections` should be the default fill, and smaller grey time-slot labels.
- Analytics: the page sends none, since an event does not record which text sent it.
