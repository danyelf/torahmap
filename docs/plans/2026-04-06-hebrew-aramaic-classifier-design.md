# Hebrew/Aramaic Classifier — Design

**Date:** 2026-04-06
**Bead:** tm-7la (Talmud exploration)
**Status:** Design approved, ready for implementation plan

## Problem

The Talmud freely mixes Aramaic Gemara discussion with Hebrew Mishnaic and biblical quotations, often switching languages multiple times within a single line. To support both aggregate per-line statistics ("this line is 70% Aramaic with some Hebrew") and per-word overlay coloring, we need a classifier that:

- Labels each word as Aramaic, Hebrew, neutral, or unknown
- Is robust to mixed lines with multiple language switches
- Runs offline as a build step
- Can be replaced (e.g., with an HMM or n-gram model) without breaking consumers

### Reference test cases

**Two switches:**
> אִילֵּימָא לְמִבְטַל טוּמְאָתַהּ, תְּנֵינָא: כׇּל הַכֵּלִים יוֹרְדִין לִידֵי טוּמְאָתָן בְּמַחְשָׁבָה, וְאֵין עוֹלִין מִטּוּמְאָתָן אֶלָּא בְּשִׁינּוּי מַעֲשֶׂה.

Aramaic challenge → `תְּנֵינָא` ("we have learned") → Hebrew Mishnah quotation.

**Three switches:**
> כִּכְלֵי גְלָלִים, כִּכְלֵי אֲדָמָה, וְאֵין מְקַבְּלִין טוּמְאָה – דְּאָמַר מָר: כְּלֵי אֲבָנִים וּכְלֵי גְלָלִים וּכְלֵי אֲדָמָה אֵין מְקַבְּלִין טוּמְאָה לֹא מִדִּבְרֵי תוֹרָה וְלֹא מִדִּבְרֵי סוֹפְרִים, אוֹ דִלְמָא לָא הָוֵי עִיכּוּל?

Hebrew → Aramaic formula `דְּאָמַר מָר` → Hebrew quotation → Aramaic challenge `אוֹ דִלְמָא`. Surfaces the `לֹא`/`לָא` minimal pair *within the same sentence*.

## Approach

A per-word classifier is the primitive. Aggregates are derived from per-word labels. Classification runs offline; the runtime only reads pre-baked labels.

### Per-word label space

Four labels:

- `A` — Aramaic
- `H` — Hebrew
- `N` — neutral / shared (e.g. `אָמַר`, `אוֹ`, `אֶת`, `עַל`, prepositions, names) — does not vote in aggregates
- `?` — unknown (no signal at all)

### Scoring (lexicon classifier, v1)

Three signal sources, weighted from strongest to weakest:

| Signal | Weight | Examples |
|---|---|---|
| Function-word lexicon | strong | A: `דְּ`, `אִילֵּימָא`, `מַאי`, `דִלְמָא`, `הָוֵי`, `מָר`, `תְּנֵינָא`. H: `אֲשֶׁר`, `אֵין`, `יֵשׁ`, `אֶלָּא`, `שֶׁ־` |
| Decisive minimal pairs | strong | `לֹא`→H vs `לָא`→A; `הוּא`→H vs `אִיהוּ`→A |
| Morphological prefix/suffix | weak | leading `דְ` on a content word → A; `הַ/בַּ/לַ/כַּ` definite → H; trailing `־ָא` definite → A (only if word is not in Hebrew lexicon) |

The lexicon stays small and curated (~100–200 words per language to start), all high-frequency function words. Content words go through morphological features only.

**Anti-pattern to avoid:** the `־ִין` plural ending is *not* a reliable Aramaic tell. Mishnaic Hebrew freely uses it (`מְקַבְּלִין`). Suffix features must stay weighted well below lexicon hits.

### Smoothing

Two passes:

1. **Raw pass:** assign `A`/`H`/`N`/`?` per word from the scorer.
2. **Fill pass:** for each `N`/`?`, look at the nearest non-neutral neighbor on the left and right within a window of ~4 words. If both agree, take that label. If they disagree, take the closer one. If neither exists in the window, leave as `N`.

**Crucially:** do not smooth `A`/`H` into each other. The whole point is to detect short Hebrew quotations inside Aramaic. The Mishnah quote in test case 1 has plenty of strong Hebrew tells (`כל ה־`, `אֵין`, `אֶלָּא`, `בְּ`-definite) — those should stand even surrounded by Aramaic.

**Length-1 exception:** an isolated `H` word inside a long `A` run with no lexicon hit (only weak suffix evidence) flips to `A`. Same the other direction. Length-2+ runs are sacred.

## Contracts

There are three contracts. Everything else is implementation detail.

### Tokenizer contract

Owned separately from any classifier so all classifiers see the same tokens.

```ts
interface Token {
  raw: string;        // with niqqud, as it appears in source
  stripped: string;   // niqqud removed, ready for matching
  start: number;      // char offset in original line
  end: number;
}

function tokenize(line: string): Token[]
```

Tokenization rules:
- Strip niqqud for matching, preserve `raw` for display
- Split on maqaf (`־`)
- Drop punctuation
- Drop empty tokens

### Classifier contract

```ts
type Label = 'A' | 'H' | 'N' | '?';

interface ClassifierResult {
  labels: Label[];                    // length === tokens.length  (REQUIRED)
  probabilities?: Array<              // OPTIONAL — for models that have them
    { A: number; H: number; N: number }
  >;
  evidence?: string[];                // OPTIONAL — for debugging/reports
}

interface LanguageClassifier {
  readonly name: string;              // "lexicon-v1", "hmm-v1", etc.
  readonly version: string;
  classify(tokens: Token[]): ClassifierResult;
}
```

Hard labels are required; probabilities and evidence are optional. Lexicon emits labels + evidence. A future HMM emits labels + Viterbi probabilities. Consumers that only need labels work with all of them.

**Smoothing is not in the contract.** It is a `LanguageClassifier` that wraps another:

```ts
class SmoothedClassifier implements LanguageClassifier {
  constructor(private inner: LanguageClassifier, private window: number) {}
  classify(tokens) {
    const raw = this.inner.classify(tokens);
    return { ...raw, labels: smooth(raw.labels, this.window) };
  }
}
```

The lexicon classifier is wrapped in a smoother. A future HMM classifier, which does its own smoothing via Viterbi, is not. Both satisfy the same interface and the build script is identical.

### Storage contract

This is the most important contract because it is what the runtime reads. It must be classifier-agnostic.

```json
{
  "text": "...",
  "tokens": [
    {"raw":"אִילֵּימָא","stripped":"אילימא","start":0,"end":9}
  ],
  "lang": "AAAHHHHHA",
  "classifier": {"name": "lexicon-v1", "version": "0.1.0"},
  "classifiedAt": "2026-04-06T..."
}
```

- `lang` is always a packed string of `A`/`H`/`N`/`?`, one char per token. Any classifier satisfying the classifier contract can produce it.
- `classifier.name` + `version` let the build script detect stale data and selectively re-run when implementations change.
- Probabilities are deliberately **not stored**. Adding them later as an optional field is backward-compatible.
- Aggregation is a pure runtime function over `lang`, not stored. Changing the aggregation rule does not require regenerating data.

```ts
function aggregate(lang: string): { A: number; H: number; N: number }
```

`N` and `?` are excluded from the denominator so the ratio reflects only words that actually voted.

## Build pipeline

```
data/talmud-source/*.json
  → scripts/classify-talmud.ts
       ├── tokenize
       ├── classify (LexiconClassifier wrapped in SmoothedClassifier)
       └── emit augmented JSON
  → public/data/talmud-classified.json
```

Supporting files:
- `data/talmud-lang-lexicon.json` — curated word lists, easy to hand-edit
- `data/talmud-lang-overrides.json` — manual `lang` patches for stubborn lines, applied as a final pass after the classifier

A single `npm run classify-talmud` re-runs the whole pipeline.

## Testing & iteration loop

- Hand-label the two reference sentences word-by-word as ground truth, plus ~10–20 more drawn from different tractates and registers (legal sugya, aggadah, biblical citations).
- Tests assert per-word accuracy and span-boundary accuracy against the ground truth set.
- Ground truth is `Token[] → Label[]`, identical to the classifier contract, so any classifier can be A/B-tested against the same fixtures.
- A `scripts/classify-talmud-report.ts` dumps the N most confidently-disagreeing words after each run, so the lexicon grows by reviewing real misclassifications instead of guessing.
- Target: ≥95% per-word accuracy on the hand-labeled set before shipping. First pass with a 100-word lexicon will likely hit 85–90%; the report-driven loop closes the gap fast.

## What this design buys

- **Swap classifiers freely.** `LexiconClassifier` → `HmmClassifier` → `NgramClassifier` → ensemble. Build script changes one line.
- **Same test set against any classifier.** Hand-labeled ground truth is classifier-agnostic.
- **Versioned data.** Ship `lexicon-v1` data now, swap to `hmm-v1` later; the runtime is unchanged.
- **Manual overrides stay simple.** Patches operate on `lang` strings.
- **No leaks.** The lexicon, the smoother window, a future HMM transition matrix, an n-gram order — none of those appear in any contract or any consumer. Each lives in exactly one file.

## Out of scope (for v1)

- HMM, n-gram, or neural classifiers (the contracts allow them; we're not building them yet)
- Runtime classification (the runtime only reads pre-baked labels)
- Languages beyond Hebrew and Aramaic
- Sub-word classification (e.g., classifying a prefix separately from its stem)
