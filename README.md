# Torah Map — Demo Gallery

This is an **orphan branch**. It has no shared history with `main` and is never
intended to be merged. It exists solely to host video recordings of the visual
concepts preserved on the `demo/*` branches, while keeping the main trunk
free of binary blobs.

## Concepts

Each concept's source code lives on a `demo/<name>` branch. The matching video
in `videos/` is a ~30s, 1920×1080 capture produced by the recording tooling
under `scripts/demo/` on `main`.

| Concept | Source | Video |
|---|---|---|
| Breathing Text — proximity-reveal of Hebrew opening words on hover | [`demo/breathing-text`](../../tree/demo/breathing-text) | [breathing-text.webm](videos/breathing-text.webm) |
| Gematria Constellations — hover lines to verses with matching numerical values | [`demo/gematria-constellations`](../../tree/demo/gematria-constellations) | [gematria-constellations.webm](videos/gematria-constellations.webm) |
| Heat Shimmer — subtle ambient brightness oscillation per verse | [`demo/heat-shimmer`](../../tree/demo/heat-shimmer) | [heat-shimmer.webm](videos/heat-shimmer.webm) |
| Manuscript Watermarks — illuminated parsha/section/chapter layers | [`demo/manuscript-watermarks`](../../tree/demo/manuscript-watermarks) | [manuscript-watermarks.webm](videos/manuscript-watermarks.webm) |
| Ripple Words — concentric wave reveals first Hebrew word of nearby verses on hover | [`demo/ripple-words`](../../tree/demo/ripple-words) | [ripple-words.webm](videos/ripple-words.webm) |
| Scatter Hover — gentle jostle effect on hover | [`demo/scatter-hover`](../../tree/demo/scatter-hover) | [scatter-hover.webm](videos/scatter-hover.webm) |
| Thread Lines — connections between verses with rare shared words | [`demo/thread-lines`](../../tree/demo/thread-lines) | [thread-lines.webm](videos/thread-lines.webm) |
| Torah Rain — ambient falling Hebrew characters | [`demo/torah-rain`](../../tree/demo/torah-rain) | [torah-rain.webm](videos/torah-rain.webm) |
| Verse Whisper — calligraphic Hebrew text reveal on hover | [`demo/verse-whisper`](../../tree/demo/verse-whisper) | [verse-whisper.webm](videos/verse-whisper.webm) |
| Word Clouds — multi-scale word clouds that refine as you zoom in | [`demo/word-clouds`](../../tree/demo/word-clouds) | [word-clouds.webm](videos/word-clouds.webm) |

## Format

VP8 webm, 1920×1080, 25fps, 2-pass encoded at ~7 Mbps target.

## Reproducing

The recording tooling lives on `main` under `scripts/demo/`. See its README
for the workflow.
