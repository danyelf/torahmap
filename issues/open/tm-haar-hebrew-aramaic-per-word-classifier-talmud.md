---
id: tm-haar
status: open
priority: 2
type: feature
created: 2026-04-06
---

# Hebrew/Aramaic per-word classifier (Talmud)

Design and implement an offline per-word Hebrew/Aramaic classifier for Talmud text. Output is a per-token label sequence used for both aggregate per-line statistics ("this line is mostly Aramaic with some Hebrew") and occasional per-word visual overlays. Discovered while working on tm-7la (Talmud engine exploration).

## Status

- **Design doc:** `docs/plans/2026-04-06-hebrew-aramaic-classifier-design.md` — committed
- **Working prototype:** `scripts/hebrew-aramaic-prototype/` — committed; runs end-to-end against Wikisource Berakhot
- The design is approved. This issue tracks the remaining work to ship a real classifier.

## Reference test cases

Two hand-labeled sentences live in `scripts/hebrew-aramaic-prototype/run.ts` as ground truth:

1. **Two-switch (kelim):** Aramaic challenge → תְּנֵינָא citation formula → Hebrew Mishnah quotation. 16 tokens, 4 A + 12 H expected.
2. **Three-switch (gelalim):** Hebrew → Aramaic דְּאָמַר מָר formula → Hebrew quotation → Aramaic אוֹ דִלְמָא question. 29 tokens, includes the לֹא/לָא minimal pair *within the same sentence*.

## Architecture (locked in by the design doc)

Three contracts, everything else is implementation detail:

1. **Tokenizer contract:** `tokenize(line) → Token[]`. Each Token has both `raw` (with niqqud) and `stripped` (without). Owned separately so all classifiers see the same tokens.
2. **Classifier contract:** `LanguageClassifier { name, version, classify(tokens) → ClassifierResult }`. Hard labels (A/H/N/?) required, probabilities and evidence optional. Smoothing is a wrapper classifier (`SmoothedClassifier`), not part of the contract — so an HMM or n-gram classifier that does its own smoothing can plug in as a peer.
3. **Storage contract:** packed `lang` string (one char per token) + `classifier.{name,version}` for cache invalidation. Aggregate is a pure runtime function over the string, NOT stored.

The contracts mean we can swap LexiconClassifier → HmmClassifier → HaikuClassifier without touching consumers or storage format.

## v1 implementation (lexicon + smoother)

Prototype results on the two fixtures, after one quick lexicon-fix loop:

- 84% per-word accuracy (started at 53%, fixed by removing אלא from the Aramaic lexicon — the design's report-driven loop in action)

Berakhot corpus stats from prototype (2,749 segments, 73,305 words):

- 67% of words vote (33% land in N or ?)
- Of voting words: 47% A / 53% H (real Talmud is closer to 60% A / 40% H — classifier is biased Hebrew, lexicon is too small)
- 30% of segments classified as Aramaic-dominant (≥70% A)
- 33% as Hebrew-dominant
- 27% mixed
- 10% all-neutral

Known v1 issues to fix in next iteration:

- Lexicon too small (~200 entries) — most Aramaic content verbs/nouns fall through to ?
- pfx-h weak feature overfires (any 4+ letter ה-word votes Hebrew at same weight as a lexicon hit)
- Smoother window=4 too wide for tightly-mixed prose; דאמר מר bleeds forward into the Hebrew quote that follows

## Three implementation paths (with cost numbers)

### Path A: Hand-grown lexicon classifier
- What we have. ~200 words, 84% accuracy on fixtures.
- Iterative: dump misclassifications from a corpus pass, hand-add to lexicon, repeat. The design's `scripts/classify-talmud-report.ts`.
- Cost: free.
- Quality ceiling: maybe 92-95% with effort, hits a wall on unknown content words.

### Path B: Claude Haiku 4.5 generates the lexicon (RECOMMENDED)
- Send each distinct **type** (not token) to Haiku, get back A/H/N label.
- Output is a JSON file `data/talmud-lang-lexicon-haiku-v1.json`.
- Runtime is just lexicon lookup — same speed and dependencies as Path A.
- LLM is build-time only. Same `LanguageClassifier` contract.

**Cost numbers (real, computed from Berakhot cache):**

- Berakhot tokens: 73,305
- Berakhot **distinct types**: 12,778 (5.7× reduction)
- Type/token ratio: 0.174 (Hebrew morphology is rich)

| Strategy | Calls | Cost (Berakhot) |
|---|---|---|
| Per-segment Haiku (naive) | 2,749 | $2.40 |
| Per-type Haiku, 1000/call | 13 | **$0.30** |
| Per-type Haiku, batch API | 13 | **$0.15** |

Output cost is the floor (~$0.19 minimum at $5/M output × ~3 tokens/label × 12,778 types). Bundling further is moot.

**Full Bavli scaling** (Heaps' law, β≈0.55, 2.7M tokens → ~80–100K types):

| Approach | Berakhot | Full Bavli |
|---|---|---|
| Per-type Haiku | $0.30 | ~$2 |
| Per-type Haiku, batch API | $0.15 | ~$1 |

So full-Bavli classification with Haiku is **a couple of dollars**, not a hundred. The marginal cost of a new tractate is just the new types not seen before — incremental updates are nearly free.

### Path C: Hybrid
- Run Path A first to seed obvious lexicon entries
- Use Path B for the long tail
- Use Path A's classifier with the merged lexicon at runtime

## How much to trust niqqud stripping

The big question that determines accuracy ceiling on unvocalized sources.

**~93–95% of tokens are unaffected by stripping** — Hebrew/Aramaic diagnostic features are mostly consonantal:

- Aramaic ־א definite suffix vs Hebrew הַ definite article: both consonantal
- דְ vs שֶׁ relative: both consonantal
- ־ין vs ־ים plural: consonantal
- אילימא, אין, יש, אלא, דלמא, מר, etc. — all unambiguous unstripped

**The remaining 5–7% has two failure modes:**

### 1. Minimal pairs (need vowels)

| Stripped form | Berakhot count | What you lose |
|---|---|---|
| לא | 873 | לֹא (H) vs לָא (A) |
| ולא | 390 | וְלֹא (H) vs וְלָא (A) |
| הוה | 138 | mostly Aramaic verb forms anyway |

**1,263 tokens (1.7% of Berakhot)** are forced to N when text is unvocalized, where they'd otherwise be H or A. These are also the minimal pairs the fixtures explicitly rely on.

### 2. Heterographs (different word, same consonants, possibly different language)

| Form | Berakhot count | Possibilities |
|---|---|---|
| אמר | 1,550 | אָמַר (H) / אֲמַר (A) — both languages, label as N |
| מר | 124 | מַר "bitter" (H) / מָר "master" (A) — almost always A in Talmud |
| דבר | 71 | דָּבָר "word" (H) / דְּבַר "of the" (A) |
| ספר | 11 | סֵפֶר "book" (H) / סְפַר (A) |

Sample of 11 ambiguous-when-stripped words covers **5.2% of Berakhot tokens**. Real number is probably 10–15% if exhaustive. Most heterographs resolve trivially in Talmud context (מר is always master), but the lexicon entries are technically corpus-conditional.

### Asymmetry by source

| Source | Niqqud | Stripping cost |
|---|---|---|
| Fixture sentences | Full | Zero |
| Tanakh, Davidson Talmud | Full | Zero |
| **Wikisource Berakhot** | None | ~2% forced to N + heterograph noise |

### Mitigations

1. **Smoother resolves most stripped-N tokens from neighbors.** The 1,263 `לא`s in Berakhot mostly become "same language as surrounding 4 words," right ~80% of the time.
2. **Bigram rules for famous pairs.** `כי לא` → H. `אי לא` → A. Half a dozen rules handle most לא without needing vowels. Cheap.
3. **Cross-vocalize from Davidson** (most decisive). Davidson and Wikisource have identical positional structure for Berakhot per the parallel Talmud-prototype design — `text[amud][segment]` lines up exactly. Build a one-time alignment that copies Davidson's niqqud onto Wikisource's text. Get the best of both: Wikisource's matnitin/gemara structural markers + Davidson's vowels. Eliminates the minimal-pair loss entirely.
4. **Haiku doesn't fix this.** An LLM looking at `לא` without vowels has the same ambiguity. It's better at using surrounding context, but it is still guessing at the vowels. Davidson cross-vocalization beats Haiku on this specific dimension.

## Recommended sequence

1. **Close the prototype loop.** Tighten the smoother (narrower window or iterative), grow the hand lexicon to ~500 entries, re-run the report, get fixture accuracy to ~95%. Cost: free.
2. **Pilot Haiku on Berakhot types.** $0.30. Diff against the hand lexicon. Hand-fix surprises. Ship as `data/talmud-lang-lexicon-haiku-v1.json`.
3. **Cross-vocalize Wikisource against Davidson** for Berakhot. One-time alignment script. Recovers the ~2% minimal-pair loss. Output goes into the same data directory.
4. **Add Mishnah/Gemara structural prior.** The parallel Talmud-prototype already parses `מתני׳`/`גמ׳` markers (per `docs/plans/2026-04-06-talmud-exploration-design.md` §4). Every word between `מתני׳` and the next `גמ׳` is almost certainly Hebrew. This is a structural override on top of the per-word classifier — cheap and decisive. Should be a hard prior, not a vote.
5. **Run Haiku on full Bavli.** ~$1–2. Ship the lexicon. Done.
6. **Eventually:** if accuracy demands it, build an HMM classifier that uses the Haiku lexicon as emission probabilities and learns transitions from the cross-vocalized Davidson data. The contracts already support it.

## Done when

- A `LanguageClassifier` implementation that satisfies the contract from the design doc, running over all of Berakhot, with ≥95% accuracy on the two fixture sentences.
- Per-segment labels stored in a build artifact (format per the storage contract: packed `lang` string per segment).
- A way to overlay per-word labels on the existing Talmud prototype (or a successor), and a way to read the aggregate ratio for any segment.

## Out of scope (file separately)

- Languages beyond Hebrew/Aramaic (Greek loanwords, Persian glosses)
- Sub-word classification (prefix vs stem)
- Runtime LLM classification — runtime stays pure lexicon lookup
- Yerushalmi (different Aramaic dialect, would need its own lexicon pass)

## Decisions still to make

- Do we ship the Haiku-generated lexicon (Path B) or stick with hand iteration (Path A) for v1? Recommendation: Path B, pilot first on Berakhot for $0.30 to validate quality.
- Whether to cross-vocalize Wikisource against Davidson before classifying, or after. Recommendation: before. The classifier sees vocalized text either way, and the alignment is content-free (just a position-based niqqud copy).
- Storage location for the generated lexicon: `data/` (with the Tanakh data) or somewhere Talmud-specific?
