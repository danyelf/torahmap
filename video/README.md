# Scripted video of the map

Videos of the map made from a script: a list of scenes that plays the same way
on every render. A headless browser drives the app from outside, on a fake
clock, and screenshots every frame; nothing under `src/` changes. The design is
in `docs/plans/2026-09-27-video-harness-design.md`.

## Commands

| Command | Does |
|---|---|
| `npm run video -- video/scripts/x.md` | Renders a script to `video/out/x.mp4`. `--fps 10 --scale 0.5` for a quick draft, `--from`/`--to` for a stretch, `--out` to name the file. |
| `npm run rehearse` | Plays a script in the browser while you read the narration (`?script=x` in its URL picks one); a key press starts each scene, and *Copy timings* hands over the times to save as `x.times.json`. |
| `npm run capture` | The same page with no script: as you explore, captures views as scene lines, or as story stops. |
| `npm run mix -- video/out/x.mp4 voice.m4a --to S` | Lays a recorded voiceover under a render. `--from`/`--to` trim the recording, `--at` places it, `--cut A-B` drops a stretch, `--pause AT:S` adds silence; loudness comes out at −14 LUFS. |

## Files

| File | Is |
|---|---|
| `scripts/` | The scripts. `reel.md` is the LinkedIn reel; the command that mixes its voiceover is in a comment at its top. `sample.md` is a short example. |
| `scripts/*.times.json` | When each scene starts, in seconds, and `end`. Written by rehearsal or by hand. |
| `script.ts` | Reads a script. The scene settings are here. |
| `timeline.ts` | Turns a script and its times into what the page shows at each moment. |
| `render.ts` | The renderer. |
| `browser.ts`, `inPage.ts` | Opening the map headless, and the functions that run inside its page. |
| `rehearse.html`, `rehearse.ts`, `capture.ts` | The rehearsal and capture page. |
| `mix.ts` | The voiceover mixer. |
| `__tests__/` | Tests, run with the rest of the suite. |
| `out/` | Renders, drafts and recordings. Ignored by git; see its own README. |

## A script

A Markdown file. Settings for the whole video go at the top; each scene is a
comment, and the prose under it is narration, shown while rehearsing.

```markdown
---
size: 1080x1080
fps: 60
panel: closed
---

<!-- scene: open | view: verse=Genesis.1.1&zoom=4 | caption: Every square is a verse. -->

Narration for the first scene.
```

A scene is one of:

- `view: <URL query>` — the map in explore mode, as a link to it would open.
- `story: <story>/<stop>` — a guided story, scrolled to that stop.
- `do: click "…"; type "…"; press Key; wait 1s` — the interface used by hand.

Its settings:

| Setting | Does |
|---|---|
| `over: 2s` | Glides the camera from the scene before. Defaults to 1.5 s, so a scene that fades needs `over: 0s`. |
| `fade: 1s` | Dissolves from the picture before. Shorter than the scene. |
| `caption: …`, `caption-at: top` | Text on screen; bottom unless told. |
| `panel: closed\|search\|overlay` | The side panel. The top setting applies to every scene that names none. |
| `pan: dx,dy` | Drags the map this many pixels once the view arrives. |
| `map: hidden` | Only the map's title shows, for a title card. |
| `card-at: x,y`, `card-size: 1.5` | Where the pinned verse's card sits and how large. Without them it waits above a bottom caption. |

A pinned verse always centres itself; only `pan` moves it.
