# Run only the browser suites a change can break

**Status:** Decided, 2026-10-22; being built on branch `worktree-suites-by-change` (#408).

## The goal

On 2026-10-21 many small pull requests, none of them about loading, each ran the loading suite,
which throttles every download on purpose. With the suite lock they queued behind one another and
work slowed to a crawl. A pull request should run only the suites its files can break, and a
script, not judgment, should decide which.

## The plan

1. `packages/shell/src/loader.ts` runs the downloads: the loaded files, which are pending, begun,
   failed or closed, fetching a file at once, the staged downloads, load timing. `viewFiles.ts`
   holds which files what the reader sees needs, fetches them when it needs them, and says what
   each place shows while they are on their way. `main.ts` says what is shown, and hears when a
   file lands or fails and redraws.
2. Each text's file names (`firstFiles`, `timedFile`, `popupFile`) move from its `text.ts` to its
   own `files.ts`.
3. Each test moves to the suite whose files can break it (#408): the serving tests to vitest, the
   two analytics tests to the layout suite, the two Talmud loading tests to the loading suite.
4. `npm run test:browser` reads the files changed against `origin/main` and runs the suites they
   call for. The instructions point at it.

Not covered: what `main.ts` asks of the loader and `viewFiles`, which a comment above
`createLoader` marks as loading's.

## Open questions, assumptions, surprises

- Rejected: choosing suites by file without the refactor. `main.ts` mixes downloads with the
  interface, so it would have to count as loading, and the card's × (#420) would still have run
  the loading suite.
- The loading suite borrowed helpers from `test/layout/page.ts` and `app.ts`, which nearly every
  layout change touches, so each would have run both suites. What both suites read now lives in
  `test/browser/`, which runs both; the layout's own helpers run layout alone.
- `index.html` counts as layout's: the layout suite checks every element in it. The root
  `package.json` counts as neither: a dependency changes `package-lock.json`, which runs both.
- The first version left the view's files in `main.ts` (the opening view, the search's and the
  popup's fetches, the loading notices); the review found a change there would break the loading
  suite unseen, so they moved to `viewFiles.ts`. The calls that ask it to fetch, as the search
  changes or a popup opens, stay in `main.ts`: they are interface events, and no file rule sees
  one removed.
- The loading suite relies on interface hooks, such as `data-loading` in `mapLegend.ts` and the
  tour's stop ids. Renaming one breaks it while the script runs layout; that is the ordinary
  coupling of a test to a selector.
- Not covered, besides what `main.ts` asks of the loader and `viewFiles` (listed above
  `createLoader`): which files an overlay or the search asks for (its `data`, or the search's
  `filesNow`). Each text's `data.ts`, `verseTexts.ts` and `search/data.ts`, which name the files,
  run both suites; the tool's own module counts as layout's. A change there should run the
  loading suite by hand.
- The serving tests run in vitest against Vite's dev server started in the test (about 0.2 s),
  so a change to `vite.config.ts` or `pages.ts` is checked on every commit.
- Replayed through the rules, the merged pull requests since the suites moved under `test/`
  (#418–#434) run the loading suite only where they changed loading code or its tests: #418,
  #421, #432. The card's × (#420) runs layout alone.
