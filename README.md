# The Torah Map

Danyel Fisher
January 2026

I love the idea of being able to lay out an entire text as an interactive surface. Brad Paley's ["TextArc"](https://history.siggraph.org/artwork/w-bradford-paley-textarc/) was an early inspiration for me; so was Alexander's "Serendip" (TK: link) and "Pomeage" (TK: link).

The Tanakh -- the Jewish Bible -- is a rich and deep text, and -- fortunately -- we live in an era TK: finish this sentence.

Overlays, in the order the map offers them:

- **Text Search** — every verse holding the word you type, in the Hebrew or in the English. A Hebrew word is looked up as a dictionary word by default, so every form it takes is found.
- **Commentary** — how much has been written about each verse, counted from Sefaria's links, either in total or by kind of commentary.
- **Trop** — the cantillation marks that say how the Hebrew is chanted. Pick one to see which verses carry it, and how often.
- **Haftarah** — each weekly Torah portion and the passage from the Prophets read after it, in Ashkenazi or Sephardi custom.
- **Text Dating** — the period scholars date each passage to, from before the monarchy through the Hellenistic era.
- **Verse Length** — how many Hebrew words each verse has.

## Visual Concept Demos

A set of ten visual experiments built as parallel agent worktrees. None ship in
the live app — they're preserved here so future demos can cherry-pick from
them. Source code is on the `demo/*` branches; ~30s 1080p recordings are on
the orphan [`demo-gallery`](../../tree/demo-gallery) branch.

| Concept | Source | Video |
|---|---|---|
| **Breathing Text** — proximity reveals first Hebrew word of nearby verses on hover | [`demo/breathing-text`](../../tree/demo/breathing-text) | [.webm](../../blob/demo-gallery/videos/breathing-text.webm) |
| **Gematria Constellations** — hover draws lines to verses with matching numerical value | [`demo/gematria-constellations`](../../tree/demo/gematria-constellations) | [.webm](../../blob/demo-gallery/videos/gematria-constellations.webm) |
| **Heat Shimmer** — subtle ambient brightness oscillation, per-verse | [`demo/heat-shimmer`](../../tree/demo/heat-shimmer) | [.webm](../../blob/demo-gallery/videos/heat-shimmer.webm) |
| **Manuscript Watermarks** — illuminated parsha / section / chapter layers | [`demo/manuscript-watermarks`](../../tree/demo/manuscript-watermarks) | [.webm](../../blob/demo-gallery/videos/manuscript-watermarks.webm) |
| **Ripple Words** — concentric wave on hover reveals first word of ~15 nearby verses | [`demo/ripple-words`](../../tree/demo/ripple-words) | [.webm](../../blob/demo-gallery/videos/ripple-words.webm) |
| **Scatter Hover** — gentle jostle effect on hover | [`demo/scatter-hover`](../../tree/demo/scatter-hover) | [.webm](../../blob/demo-gallery/videos/scatter-hover.webm) |
| **Thread Lines** — connections between verses sharing rare words | [`demo/thread-lines`](../../tree/demo/thread-lines) | [.webm](../../blob/demo-gallery/videos/thread-lines.webm) |
| **Torah Rain** — ambient falling Hebrew characters | [`demo/torah-rain`](../../tree/demo/torah-rain) | [.webm](../../blob/demo-gallery/videos/torah-rain.webm) |
| **Verse Whisper** — calligraphic Hebrew text reveal on hover | [`demo/verse-whisper`](../../tree/demo/verse-whisper) | [.webm](../../blob/demo-gallery/videos/verse-whisper.webm) |
| **Word Clouds** — multi-scale word clouds that refine as you zoom in | [`demo/word-clouds`](../../tree/demo/word-clouds) | [.webm](../../blob/demo-gallery/videos/word-clouds.webm) |

The recording tooling that produced the videos lives at
[`scripts/demo/`](scripts/demo/) — see its README for the workflow if you want
to add a new concept or refresh an existing recording.
