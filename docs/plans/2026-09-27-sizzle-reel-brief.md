# A Sizzle Reel for LinkedIn

**Date:** 2026-09-27
**Status:** Brief and first-draft outline; variants being explored.

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
