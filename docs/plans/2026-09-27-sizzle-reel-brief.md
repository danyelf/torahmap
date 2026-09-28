# A Sizzle Reel for LinkedIn

**Date:** 2026-09-27
**Status:** Brief, first draft, and the review of it (below); a direction to
choose.

## Goal

A short video of the map for LinkedIn, made with the scripted-video tool in
`video/`. It should be fun to watch for people who care about data and
visualization and do not care about religion.

## The message

**It isn't just a book. It's a dataset — interlocking layers of knowledge and
tradition — and building a visualization helps you read and understand it.**

## What a viewer should come away sensing

Not said in any caption; carried by how the reel is made:

- **Careful analysis** of a set of interesting questions.
- **An approachable, interesting tool** — the real interface, used.
- **Built with wisdom and discernment** — choices that show judgment, such as
  a tool that tells apart two things spelled the same way.

The ending stays understated. No call to action: "What would your data look
like?" is too on the nose, even if it is the private hope. The name and the
address are enough.

## Constraints

- **Sound off first.** LinkedIn plays videos muted until tapped, so short
  captions on screen carry the story; the voiceover is a bonus. Captions of
  eight words or fewer, readable in two seconds.
- **Square, 1080×1080.** Takes more of the feed than widescreen, and the app
  keeps its desktop layout. Check a test frame at that size before committing.
- **About 45 seconds.** Up to a minute is allowed, but a reel loses people
  after 45; spend extra time letting beats breathe rather than adding beats.
- **Every fact in a caption is checked against the data** before it goes in.
- **No big-number opening.** "23,000 verses" impresses no one.

## First-draft outline

| Time | On screen | Caption |
|---|---|---|
| 0–5 s | Close on one verse, Hebrew and English readable | *Read it as a book…* |
| 5–10 s | Long pull-back: the verse becomes one square among thousands | *…or explore it as a dataset.* |
| 10–15 s | The whole map; the camera drifts across the Torah columns so the ragged chapter edges read | *Each column a book. Each row a chapter.* |
| 15–27 s | Layers of tradition arrive one at a time, about 4 s each, each named: cantillation (the musical notation scribes added centuries ago), commentary (where later rabbis cited each verse), liturgy (what the prayer book quotes) | *Centuries of reading, layered on the text.* |
| *optional, +6 s* | The calendar: the haftarah layer, prophetic readings paired with Torah portions | *Traditions that tie one part to another.* |
| 27–35 s | Discernment: יצחק typed; the tool offers two meanings of the same letters, *Isaac* (a name) and *laughed* (a verb); the map separates them | *Same letters. "Isaac," or "he laughed." It knows the difference.* |
| 35–42 s | The interlock: Abraham searched over the liturgy layer; rings show which Abraham verses the prayer book quotes; the camera settles on the one it quotes most | *Layered together, they answer new questions.* |
| *optional, +6 s* | A glimpse of a guided story scrolling | *Or follow a guided story.* |
| 42–45 s | The map at rest | *torahmap.org* |

Why this shape: the opening pull-back turns "book" into "dataset" in one camera
move. The layers carry the "interlocking tradition" idea. The Isaac/laughed
beat is a data person's problem — two entities with one spelling — and is where
careful analysis shows. The interlock beat is the argument in one image: two
layers together answer a question neither answers alone.

## Directions considered and set aside

- **"Powers of Ten"** — overview, zoom to a verse, search, then rapid layer
  swaps. Folded into the draft above.
- **"Same map, five pictures"** — a fixed camera and a montage of layers.
  Striking, but shows little of the interaction; its punch lives on in the
  layer sequence.
- **"Where do they live?"** — questions answered by searches. Depends on
  surprises not yet found; its best moment became the interlock beat.

## Before rendering

1. Check every caption's claim against the data, and find the views: the
   opening verse, the camera for each layer, the verse the prayer book quotes
   most.
2. Bring the `video/` branch up to date with main: search has its own URL key
   (`search=`), stories moved to `src/stories/`, and a search can sit beside an
   overlay as rings.
3. Add captions to the renderer.
4. Write the script, render rough cuts, and review frames before a full render.

## What the review found

Three reviewers read the draft — for audience appeal, data storytelling, and
context — and six more each wrote a variant from a very different starting
point. Their findings, merged; each number was measured by the agent that
reports it (with `jq` over `public/data/`), not recalled.

### Corrections the draft needs whichever way it goes

- **There is no liturgy layer.** "Liturgy" is a category of the Commentary
  overlay, so "commentary, then liturgy" is the same heatmap twice. Script it
  as Commentary with the Liturgy category chosen.
- **The layers are in the wrong historical order.** The Talmud (c. 200–600 CE)
  predates the written cantillation marks (the Tiberian Masoretes, roughly the
  7th–10th centuries CE, recording an older chant). Reorder, or drop the
  implied sequence.
- **Captions that overreach:**
  - "Cantillation, the musical notation scribes added" → chant *and
    punctuation* marks, "written down over a thousand years ago".
  - "Commentary, where later rabbis cited each verse" → the count covers every
    kind of text Sefaria links (Talmud, midrash, law, kabbalah, liturgy,
    Second Temple works and more): "how much has been written about each
    verse".
  - "What the prayer book quotes" is today's prayer books, counted per edition
    — links, not recitations. Say "quotes" or "cites", never "recites most".
  - The commentary counts are links, not readership: never "what people read",
    and never "skipped" — every verse has at least one link.
- **Isaac / "he laughed" leaves out the point.** The text names Isaac after
  the laughter on purpose (Genesis 17:17–19, 21:6): one root the text plays
  on, not two unrelated words. "He laughed" is right only for Genesis 17:17.
  Saying so is where the maker's understanding shows; leaving it out is where
  a knowledgeable viewer finds the reel glib. On screen both meanings share a
  colour, so the split shows by *unticking* one: untick "Isaac" and the twelve
  "laugh" verses remain, clustered in Genesis 17–21.
- **Shoot the rings close.** At whole-map zoom a square is too small to leave
  the hole that shows the overlay's colour inside the ring.
- **Chapters over 50 verses wrap to a second row** (Genesis 24, Numbers 7), so
  frame the "each row a chapter" shot where none do.
- **Numbers 33:1 has an inflated commentary count** (1,120, almost all one
  kind of link) — never frame on it.

### Verified findings worth building on

- **Abraham: the story and the prayer book miss each other.** Of the 159
  verses naming Abraham, 117 are in Genesis, but the prayer book cites only 29
  of those (78 links); it cites 26 of the 42 outside Genesis (282 links). Top:
  Exodus 3:15 (42), Micah 7:20 (35). *The prayer book remembers his name, not
  his story* — a true interlock: search alone shows Genesis, the liturgy
  category alone shows bright spots, only together do they miss.
- **Two books never mention God.** Esther (0 of 167 verses) and Song of Songs
  (0 of 117) contain neither the divine name nor "God"; every other book does.
  Ecclesiastes says "God" 36 times and never the name. Yet Song of Songs is
  3rd of 39 books by commentary per verse (median). Caveat: Song 8:6's "flame
  of Yah" is read by some as the name, so say "mention", not "name".
- **Three books sing differently.** The common chant mark zaqef qatan appears
  in every book except Psalms and Proverbs, and in Job only in its prose frame
  (chapters 1–2, 3:1, 42) — the poetic books have their own chant system, and
  the map shows Job's prose frame around its poetry.
- **Where the writing gathers.** The Torah is 25% of verses but 53% of
  commentary links; Genesis 1:1 is the most linked verse (1,734).
- **What the prayer book quotes.** Psalms: 1,127 of its 2,527 verses (45%),
  against 16% overall. The single most quoted verse is Exodus 34:6, the
  Thirteen Attributes of Mercy (181).
- **What is read aloud.** The weekly prophetic readings cover 18.7% of the
  Prophets (Ashkenazi custom; 17.6% Sephardi); Jonah and Obadiah are read
  whole, Nahum, Haggai and Zephaniah never.
- **Law draws the argument.** The Talmud category's brightest verses are
  Deuteronomy 24:1 (divorce) and 25:5 (a widow marrying her late husband's
  brother).

### The six variants

| Variant | Opens on | Strongest beat | Main risk |
|---|---|---|---|
| **Lead with a finding** — "the book that never mentions God" | Two dark books in a lit field | Absence, then the paradox: no God, heavy commentary | "Never mentions God" read as a jab; needs its commentary beat |
| **Abstract to figurative** | Colour fields with no labels, like generative art | The reveal: marks → verses → traditions of reading; ends on a readable verse | Opening mistaken for a screensaver |
| **A curious outsider's questions** | The plain map | Trop: three books go dark, Job's prose frame lit | Least interaction; no search |
| **Layers as geology** | Exodus 34:6 close up, a date stamp in the corner | Strata in true historical order, the stamp ticking forward | Five layer swaps in a row feel like a slideshow |
| **One continuous session** | Genesis 1:1, then arrow keys | Untick "Isaac" and the laughter remains | Clicks without a pointer look automated |
| **The design decisions** | Ragged chapter edges | Rule, then reason: "Search the meaning, not the spelling" | Can read as a design manifesto |

### What the reviewers agreed on

- **The opening is too quiet.** A close-up of Hebrew reads to a secular viewer
  as religious content, and they scroll on before the pull-back pays off. Open
  on something visually striking — a lit layer, a dark gap, a colour field —
  with two to four seconds of image before words.
- **The three-layer montage is the weakest stretch.** A heatmap cannot be read
  in four seconds at feed size. Show fewer layers, each with one pattern the
  caption names ("Gold: a chant mark almost never used", "Same colour: read on
  the same Sabbath").
- **Keep the fixed camera when layers change** — dissolves in which no square
  moves prove the layout's point without a caption.
- **Ask a question, then answer it**, rather than claiming "they answer new
  questions".
- **Drop both optional beats**; haftarah returns only if it can name what it
  shows.
- **Keep:** the pull-back from one verse, "Each column a book. Each row a
  chapter.", the Isaac beat (corrected), and the understated ending — on a
  fully coloured frame.
- **Collapse the side panel except where the interface is the point**; at
  1080×1080 it takes a third of the frame.

### What the tool would need

- A step to choose from a drop-down menu, if overlays are still switched by
  one on main (Playwright's `selectOption`).
- A way to aim at a verse on the map, for the continuous-session variant; the
  arrow keys already move between verses without it.
- Captions, as before. (A drawn mouse pointer was suggested again; it was
  already declined.)

## Recommendation

Keep the brief's message and build on the review's two strongest verified
findings. Two directions are worth choosing between:

1. **Questions the layers answer.** Open on a striking lit layer; pull back
   to the book-as-dataset turn; then two or three questions, each answered by
   one view: *where does Abraham live?* (Genesis) → *what does the prayer book
   quote?* (Psalms blazes) → *together*: it remembers his name, not his story.
   Close with Isaac, corrected, as the grace note on care.
2. **The book that never mentions God.** Open on the gap — the most
   surprising image the data holds — and let the commentary layer turn it into
   a paradox, then widen to "one map, many ways of reading".

The first is closer to the brief's message, layers answering questions
together; the second has the stronger hook. Either can borrow the trop
finding ("three books sing differently") as a middle beat.
