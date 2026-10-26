@AGENTS.md

# Torah Map

An interactive spatial visualization of the entire Tanakh (Hebrew Bible) where every verse has a fixed position, enabling analytical overlays to reveal patterns across the 39 books and 23,000+ verses.

The core design principle is **position stability**: each verse keeps its place whatever analysis
is shown, so patterns read through colour and density, analyses compare on the same ground, and
the ragged edge of each chapter shows its length.

Detail most tasks don't need — the packages one by one, the browser test suites, formatting
settings, telemetry and deployment, data sources — is in
[docs/working-in-the-repo.md](docs/working-in-the-repo.md).

## Features

What the map does is in [README.md](README.md). What an agent also needs:

- How a search term is matched — substring, whole word, or meanings — belongs
  to that term. Meanings mode resolves a written form to the dictionary words
  it can be.
- Text Dating is written and tested but off the menu on purpose: it is meant to
  come back as a mode of its own rather than a menu entry. Registering it again
  means moving its id, name and description into `OVERLAYS` in
  `packages/overlay-catalog`, then adding it to the table in
  `apps/tanakh/src/overlays/index.ts`; the typecheck points at whichever is missing.
- The stories are the Markdown files in `packages/stories/markdown/`, built
  into the page; each one's header sets its title, description, `order` and
  `draft`. The dev server hot-reloads them.

## Commands

```bash
npm install
npm run dev            # dev server at http://localhost:5173
npm run build
npm test               # vitest; test:watch, test:coverage
npm run typecheck
npm run format         # Prettier owns formatting; format:check reports only
npm run test:browser   # the browser suites the branch's changes can break; -- --list says which
```

Run `npm run test:browser` before opening or updating a PR: it reads the files changed since
`origin/main` and runs the layout suite (`test:layout`, a minute or two), the loading suite
(`test:loading`) or both, by the rules in `scripts/test-browser.ts`. While working, run only the
layout states a change touches (`npm run test:layout -- -g <name>`). Run the loading suite by hand
after changing what `main.ts` asks of the loader and `viewFiles.ts` (the comment above
`createLoader` lists it), or which files an overlay or the search asks for.
The two browser suites take turns across the machine, whichever checkout starts them: a run waits,
saying for whom, until the one before it ends. `SUITE_LOCK=off` skips the wait.

`.githooks/pre-commit` checks formatting, typechecks and runs the tests before every commit. After
cloning, run `git config core.hooksPath .githooks` and
`git config blame.ignoreRevsFile .git-blame-ignore-revs` once.

## Project Structure

- `apps/` — what runs: `tanakh`, `talmud`, `euaiact` (each text's map) and `worker` (the
  Cloudflare Worker that serves the site).
- `packages/` — shared code: `engine`, `shell`, `search`, `hebrew`, `link`, `site`, `stories`,
  `overlay-catalog`, `telemetry`, `utils`. A package or app imports only the packages its
  `package.json` lists, and only the Tanakh's app and the Worker import the Tanakh's own code
  (`test/package-imports.test.ts`).
- `index.html` — every text's page, filled by `vite.config.ts` at the address `pages.ts` gives it.
- `test/` — whole-repository checks, what the dev server sends, and the browser suites
  `test/layout/` and `test/loading/`, with what they share in `test/browser/`.
- `public/data/` — shipped data. `data/` — the sources behind it, largely gitignored.
- `scripts/` — tooling to regenerate the data, laid out to match `public/data/`.
- `docs/plans/` — design docs, one per feature, each dated and headed with its status.
- `experiments/`, `test-harness/`, `video/`, `scripts/print/` — prototypes, the search-UI
  harness, scripted video, wall prints.

## Architecture

A functional, modular design: pure functions over classes and mutation, one responsibility per
module, state kept at the level it belongs to, no circular dependencies.

- **main.ts** (`packages/shell`) is the app shell, `createApp(text)`: it orchestrates the modules and handles user interactions for whichever text it is given. Nothing it imports may be a text's own code; `test/package-imports.test.ts` holds that line
- **layout.ts** (`apps/tanakh`) computes fixed positions for all verses (Torah side-by-side, Nevi'im with prophets, Ketuvim with special groupings)
- **rendering.ts** (`packages/engine`) manages WebGL infrastructure (RenderContext = immutable, RenderState = mutable)
- **itemColoring.ts** (`packages/shell`) uses two-pass design: compute semantic state, then apply colors
- **overlays/** (`apps/tanakh/src/overlays/`) are pluggable and easy to add
- Any animated change to what the map shows goes through the renderer's
  picture cross-fade (`ColorLayer`, `rendering.ts`'s `fade` uniform) — the one
  story stops ease with. Don't add another animation path for it.
- Much of how the squares are drawn exists to avoid moiré, the light and dark
  bands a grid of tiny squares makes against the screen's pixels; the comments
  that mention it mark each piece. Before changing one, look at the map at zoom
  0.25 and 0.22 on screens of density 1.5 and 2, at rest and while panning.

## Interactions

The controls are listed once, in the About panel (`packages/shell/src/aboutPanel.ts`); keep
that list in step with the code.

The URL carries the search, the overlay and its settings, the pinned verse, the
camera and, while reading, the story and its stop (`@torahmap/link`, with the
browser half in `packages/shell/src/urlState.ts`), so any view can be linked to. *Share* in the menu
copies that link, or opens the share sheet on a touch screen; the tab's title
names the view (`describeLink`).

## Deployment

The map is live at [torahmap.org](https://torahmap.org). Cloudflare deploys every push to main;
there is no deploy command to run by hand.
