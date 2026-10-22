# Run only the browser suites a change can break

**Status:** Decided, 2026-10-22; being built on branch `worktree-suites-by-change` (#408).

## The goal

On 2026-10-21 many small pull requests, none of them about loading, each ran the loading suite,
which throttles every download on purpose. With the suite lock they queued behind one another and
work slowed to a crawl. A pull request should run only the suites its files can break, and a
script, not judgment, should decide which.

## The plan

1. `packages/shell/src/loader.ts` runs the downloads: the loaded files, which are pending, begun,
   failed or closed, fetching a file at once, the staged downloads, load timing. `main.ts` hears
   when a file lands or fails and redraws.
2. Each text's file names (`firstFiles`, `timedFile`, `popupFile`) move from its `text.ts` to its
   own `files.ts`.
3. Each test moves to the suite whose files can break it (#408): the serving tests to vitest, the
   two analytics tests to the layout suite, the two Talmud loading tests to the loading suite.
4. `npm run test:browser` reads the files changed against `origin/main` and runs the suites they
   call for. The instructions point at it.

Not covered: what the map does once a file lands stays in `main.ts`'s landing callback, which a
comment there marks as loading's.

## Open questions, assumptions, surprises

- Rejected: choosing suites by file without the refactor. `main.ts` mixes downloads with the
  interface, so it would have to count as loading, and the card's × (#420) would still have run
  the loading suite.
