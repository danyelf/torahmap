# Hebrew/Aramaic classifier — prototype

A throwaway test harness for the v1 lexicon classifier described in
[`docs/plans/2026-04-06-hebrew-aramaic-classifier-design.md`](../../docs/plans/2026-04-06-hebrew-aramaic-classifier-design.md).

The point is to exercise the contracts (Token / Classifier / Storage),
demonstrate the report-driven iteration loop, and surface lexicon gaps
against real Berakhot text. Not production code.

## Run it

```bash
node --experimental-strip-types scripts/hebrew-aramaic-prototype/run.ts
```

Stages:

1. **Fixtures** — runs two hand-labeled sentences (Hebrew quotation
   inside Aramaic discussion, and a three-language-switch sentence with
   the `לֹא`/`לָא` minimal pair). Reports per-word accuracy with
   evidence strings, plus aggregate vs. ground truth.
2. **Fetch** — downloads `Wikisource Talmud Bavli/Berakhot` (393 KB)
   from the Sefaria GCS bucket on first run, caches to `cache/`.
3. **Sample** — classifies the first segment of dapim 2a, 5a, 17b, 31a, 54a.
4. **Corpus aggregate** — runs the classifier over all 2,749 Berakhot
   segments, reports word-level distribution and segment-level dominance.

Skip the network with `--no-fetch` to run only stage 1.

## Files

| File | Role |
|---|---|
| `classifier.ts` | All three contracts, tokenizer, lexicon, `LexiconClassifier`, `SmoothedClassifier`, `aggregate()` |
| `fetch-berakhot.ts` | GCS download with on-disk cache |
| `run.ts` | Four-stage runner with hand-labeled fixtures |
| `cache/berakhot.json` | Cached Wikisource source (gitignored) |

## What the v1 reveals

Running once-through against Berakhot:

- ~67% of words vote (33% `?`/`N`)
- Of voting words: roughly 47% A / 53% H (real Talmud is closer to 60% A /
  40% H — the classifier is biased toward Hebrew)

Sources of bias visible in the report:

1. **Lexicon is small.** Most Aramaic content verbs/nouns get no signal
   and become `?`.
2. **`pfx-h` weak feature overfires.** Any 4+ letter word starting with
   `ה` votes Hebrew, currently at the same weight as a lexicon hit.
3. **Smoother window=4 too wide** for tightly-mixed prose. The fixtures
   show Hebrew quotations getting partially overwritten by Aramaic
   citation formulas (`דאמר מר`, `תנינא`).

These are exactly the items the iteration loop is designed to catch.
Each one is fixable in the same lexicon/feature/smoother layer without
touching the contracts or the storage format.

## Not used yet

- **Mishnah/Gemara structural markers** (`מתני׳`, `גמ׳`) embedded in the
  Wikisource text. The parallel Talmud-prototype worktree (tm-7la,
  `docs/plans/2026-04-06-talmud-exploration-design.md` §4) parses these
  for layout. They are also a strong language prior — every word between
  `מתני׳` and the next `גמ׳` is almost certainly Hebrew. Worth using as
  a structural override on top of any per-word classifier.
