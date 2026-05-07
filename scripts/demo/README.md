# Demo Recording Tooling

Captures ~30s 1080p webm recordings of the visual concepts living on the
`demo/*` branches. The recordings themselves are stored on the orphan
[`demo-gallery`](../../tree/demo-gallery) branch.

## Workflow

1. Each `demo/<name>` branch is checked out as a worktree under
   `.claude/worktrees/agent-<hash>/`. The worktree must have working
   `node_modules` (specifically `vite` and `playwright`).
2. `record-concept.mjs` launches Playwright headlessly, navigates to the
   running dev server, drives a scripted camera + cursor path, then
   2-pass re-encodes the captured webm to a higher bitrate via Playwright's
   bundled ffmpeg. Output: `.claude/videos/<name>.webm`.
3. `record-all.sh` walks every concept, starts/stops vite per worktree,
   and applies a per-concept env recipe so each effect actually shows up
   (subtle ones like heat-shimmer need deeper zoom; hover-driven ones
   need cursor sweeping).

## Usage

```bash
# Whole gallery
./scripts/demo/record-all.sh

# Single concept (vite must be running on :5173)
node scripts/demo/record-concept.mjs torah-rain
HOVER_SWEEP=1 node scripts/demo/record-concept.mjs ripple-words
PHASE1_MS=3000 ZOOM_TICKS=24 PHASE3_MS=20000 \
    node scripts/demo/record-concept.mjs heat-shimmer
```

## Tunables

| Env | Default | Notes |
|---|---|---|
| `HOVER_SWEEP` | `0` | `1` = wander cursor every 1.5s during phases 1+3. Needed for hover-driven effects. |
| `ZOOM_TICKS` | `15` | Wheel ticks during phase 2. Each tick = ×1.1 zoom. |
| `PHASE1_MS` | `12000` | Time held at default zoom. |
| `PHASE3_MS` | `14250` | Time held after zoom. |

## Notes

- Recordings are 1920×1080 at 25fps. The 2-pass libvpx re-encode targets
  10 Mbps with relaxed quantizer bounds and a 1s keyframe interval —
  needed because animated content breaks libvpx's still-frame heuristics
  and the default rate becomes ~880 kbps which crushes subtle effects.
- The recorder reuses Playwright from whichever worktree has it under
  `node_modules/`, so you don't need a project-level Playwright install.
- Headless chromium runs the WebGL shaders correctly (verified by
  pixel-diffing two screenshots 2s apart on heat-shimmer); the only
  visibility issue at 1.0× zoom is compression flattening sub-10%
  brightness deltas, which the deep-zoom recipe works around.
