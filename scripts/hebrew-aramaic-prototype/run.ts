/**
 * Hebrew/Aramaic classifier prototype runner.
 *
 * Run with: npx tsx scripts/hebrew-aramaic-prototype/run.ts
 *
 * Stages:
 *   1. Run the classifier on two hand-labeled fixture sentences and report
 *      per-word accuracy + aggregate vs ground truth.
 *   2. Fetch the Wikisource Berakhot JSON (cached after first run).
 *   3. Sample a few segments and print per-word labels for inspection.
 *   4. Compute the aggregate over all of Berakhot and print the overall
 *      Aramaic / Hebrew / Neutral distribution.
 *
 * Optional flag:
 *   --no-fetch    Skip stages 2–4 (run only fixtures, no network).
 */

import {
  LexiconClassifier,
  SmoothedClassifier,
  tokenize,
  aggregate,
  packLabels,
  type Label,
  type LanguageClassifier,
} from "./classifier.ts";
import { fetchBerakhot, flattenBerakhot } from "./fetch-berakhot.ts";

// =============================================================================
// Hand-labeled ground truth fixtures
// =============================================================================

interface Fixture {
  name: string;
  text: string;
  // Hand-labeled per-word ground truth, in token order.
  expected: Label[];
}

// Labeling policy: a token is H or A if its morphology / lexical form is
// distinctively that language at this position, even if the root is shared.
// N is reserved for genuinely cross-language function words (אמר, את, או,
// prepositions). Hebrew nominal patterns inside a Hebrew quote are H.
const FIXTURES: Fixture[] = [
  {
    name: "two-switch (kelim, two languages)",
    text:
      "אִילֵּימָא לְמִבְטַל טוּמְאָתַהּ, תְּנֵינָא: כׇּל הַכֵּלִים יוֹרְדִין לִידֵי טוּמְאָתָן בְּמַחְשָׁבָה, וְאֵין עוֹלִין מִטּוּמְאָתָן אֶלָּא בְּשִׁינּוּי מַעֲשֶׂה.",
    //  אילימא למבטל טומאתה  תנינא  כל  הכלים יורדין לידי טומאתן במחשבה ואין עולין מטומאתן אלא  בשינוי מעשה
    expected: [
      "A", "A", "A", "A",
      "N", "H", "H", "N", "H", "H", "H", "H", "H", "H", "H", "H",
    ],
  },
  {
    name: "three-switch (gelalim, includes lo/la minimal pair)",
    text:
      "כִּכְלֵי גְלָלִים, כִּכְלֵי אֲדָמָה, וְאֵין מְקַבְּלִין טוּמְאָה – דְּאָמַר מָר: כְּלֵי אֲבָנִים וּכְלֵי גְלָלִים וּכְלֵי אֲדָמָה אֵין מְקַבְּלִין טוּמְאָה לֹא מִדִּבְרֵי תוֹרָה וְלֹא מִדִּבְרֵי סוֹפְרִים, אוֹ דִלְמָא לָא הָוֵי עִיכּוּל?",
    //  ככלי גללים ככלי אדמה ואין מקבלין טומאה  דאמר מר   כלי אבנים וכלי גללים וכלי אדמה אין מקבלין טומאה לא   מדברי תורה ולא   מדברי סופרים   או  דלמא לא  הוי עיכול
    expected: [
      "H", "H", "H", "H", "H", "H", "H",
      "A", "A",
      "H", "H", "H", "H", "H", "H", "H", "H", "H",
      "H", "H", "H", "H", "H", "H",
      "N", "A", "A", "A", "A",
    ],
  },
];

// =============================================================================
// Reporting helpers
// =============================================================================

const COLOR = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function colorLabel(label: Label): string {
  switch (label) {
    case "A": return COLOR.cyan + "A" + COLOR.reset;
    case "H": return COLOR.yellow + "H" + COLOR.reset;
    case "N": return COLOR.dim + "N" + COLOR.reset;
    case "?": return COLOR.red + "?" + COLOR.reset;
  }
}

function pad(s: string, width: number): string {
  // Hebrew chars are roughly the same width; pad on the right for alignment
  const visualLen = [...s].length;
  if (visualLen >= width) return s;
  return s + " ".repeat(width - visualLen);
}

function fmtPct(x: number): string {
  return (x * 100).toFixed(0).padStart(3) + "%";
}

// =============================================================================
// Stage 1: fixtures
// =============================================================================

function runFixtures(classifier: LanguageClassifier): void {
  console.log(`\n${COLOR.blue}=== Stage 1: hand-labeled fixtures ===${COLOR.reset}`);
  console.log(`Classifier: ${classifier.name} v${classifier.version}\n`);

  let totalCorrect = 0;
  let totalWords = 0;

  for (const fixture of FIXTURES) {
    console.log(`${COLOR.blue}--- ${fixture.name} ---${COLOR.reset}`);
    console.log(`${COLOR.dim}${fixture.text}${COLOR.reset}\n`);

    const tokens = tokenize(fixture.text);
    const result = classifier.classify(tokens);

    if (tokens.length !== fixture.expected.length) {
      console.log(
        `${COLOR.red}WARN${COLOR.reset}: tokenized to ${tokens.length} words, expected ${fixture.expected.length}.`,
      );
      console.log(
        `Tokens: ${tokens.map((t) => t.stripped).join(" / ")}`,
      );
      console.log();
      continue;
    }

    let correct = 0;
    console.log(`  #  got exp  word           evidence`);
    for (let i = 0; i < tokens.length; i++) {
      const got = result.labels[i];
      const exp = fixture.expected[i];
      const ok = got === exp;
      if (ok) correct++;
      const mark = ok ? `${COLOR.green}✓${COLOR.reset}` : `${COLOR.red}✗${COLOR.reset}`;
      const word = pad(tokens[i].raw, 14);
      const ev = result.evidence?.[i] ?? "";
      console.log(
        `  ${(i + 1).toString().padStart(2)} ${mark}  ${colorLabel(got)}  ${colorLabel(exp)}   ${word}  ${COLOR.dim}${ev}${COLOR.reset}`,
      );
    }
    const acc = correct / tokens.length;
    const agg = aggregate(result.labels);
    const expAgg = aggregate(fixture.expected);
    console.log(
      `\n  Per-word accuracy: ${correct}/${tokens.length} = ${fmtPct(acc)}`,
    );
    console.log(
      `  Aggregate (got):  A=${fmtPct(agg.A)} H=${fmtPct(agg.H)}  (voting=${agg.voting}/${agg.total})`,
    );
    console.log(
      `  Aggregate (exp):  A=${fmtPct(expAgg.A)} H=${fmtPct(expAgg.H)}  (voting=${expAgg.voting}/${expAgg.total})`,
    );
    console.log(`  Packed labels:    ${packLabels(result.labels)}`);
    console.log(`  Expected:         ${packLabels(fixture.expected)}`);
    console.log();

    totalCorrect += correct;
    totalWords += tokens.length;
  }

  console.log(
    `${COLOR.blue}Overall fixture accuracy: ${totalCorrect}/${totalWords} = ${fmtPct(totalCorrect / totalWords)}${COLOR.reset}\n`,
  );
}

// =============================================================================
// Stages 2–4: Berakhot corpus
// =============================================================================

async function runBerakhot(classifier: LanguageClassifier): Promise<void> {
  console.log(`${COLOR.blue}=== Stage 2: fetch Berakhot ===${COLOR.reset}`);
  const data = await fetchBerakhot();
  const segments = flattenBerakhot(data);
  console.log(
    `Loaded ${segments.length} segments across ${data.text.length} amudim.\n`,
  );

  // Stage 3: sample some segments and print labels
  console.log(`${COLOR.blue}=== Stage 3: sample segments (first segment of dapim 2a, 5a, 17b, 31a, 54a) ===${COLOR.reset}\n`);
  const sampleDapim = ["2a", "5a", "17b", "31a", "54a"];
  for (const targetDaf of sampleDapim) {
    const seg = segments.find((s) => s.daf === targetDaf);
    if (!seg) {
      console.log(`  ${targetDaf}: not found`);
      continue;
    }
    const tokens = tokenize(seg.text);
    if (tokens.length === 0) continue;
    const result = classifier.classify(tokens);
    const agg = aggregate(result.labels);
    const dominantLang = agg.A > agg.H ? "Aramaic" : agg.H > agg.A ? "Hebrew" : "tied";

    // Truncate text for display
    const preview = seg.text.length > 80 ? seg.text.slice(0, 80) + "…" : seg.text;
    console.log(
      `  ${COLOR.blue}Daf ${seg.daf} seg ${seg.segmentIndex + 1}${COLOR.reset}  (${tokens.length} words)`,
    );
    console.log(`  ${COLOR.dim}${preview}${COLOR.reset}`);
    console.log(`  Labels:  ${packLabels(result.labels).split("").map(l => colorLabel(l as Label)).join("")}`);
    console.log(
      `  Aggregate: A=${fmtPct(agg.A)} H=${fmtPct(agg.H)} N+?=${fmtPct(agg.N)} → ${dominantLang}\n`,
    );
  }

  // Stage 4: corpus-wide aggregate
  console.log(`${COLOR.blue}=== Stage 4: corpus-wide distribution ===${COLOR.reset}\n`);
  let totalA = 0;
  let totalH = 0;
  let totalN = 0;
  let totalUnknown = 0;
  let totalWords = 0;
  let segmentsClassified = 0;
  // Per-segment dominant language histogram
  const dominant = { A: 0, H: 0, mixed: 0, neutral: 0 };

  for (const seg of segments) {
    const tokens = tokenize(seg.text);
    if (tokens.length === 0) continue;
    const result = classifier.classify(tokens);
    segmentsClassified++;
    for (const l of result.labels) {
      totalWords++;
      if (l === "A") totalA++;
      else if (l === "H") totalH++;
      else if (l === "N") totalN++;
      else totalUnknown++;
    }
    const agg = aggregate(result.labels);
    if (agg.voting === 0) {
      dominant.neutral++;
    } else if (agg.A >= 0.7) {
      dominant.A++;
    } else if (agg.H >= 0.7) {
      dominant.H++;
    } else {
      dominant.mixed++;
    }
  }

  const voting = totalA + totalH;
  console.log(`  Total segments classified: ${segmentsClassified}`);
  console.log(`  Total words:               ${totalWords}`);
  console.log(`  Voting words (A+H):        ${voting} (${fmtPct(voting / totalWords)})`);
  console.log();
  console.log(`  Word-level distribution:`);
  console.log(`    Aramaic    A: ${totalA.toString().padStart(6)}  ${fmtPct(totalA / totalWords)} of total, ${fmtPct(totalA / voting)} of voting`);
  console.log(`    Hebrew     H: ${totalH.toString().padStart(6)}  ${fmtPct(totalH / totalWords)} of total, ${fmtPct(totalH / voting)} of voting`);
  console.log(`    Neutral    N: ${totalN.toString().padStart(6)}  ${fmtPct(totalN / totalWords)} of total`);
  console.log(`    Unknown    ?: ${totalUnknown.toString().padStart(6)}  ${fmtPct(totalUnknown / totalWords)} of total`);
  console.log();
  console.log(`  Segment-level dominance (≥70% threshold):`);
  console.log(`    Aramaic-dominant:  ${dominant.A.toString().padStart(5)}  ${fmtPct(dominant.A / segmentsClassified)}`);
  console.log(`    Hebrew-dominant:   ${dominant.H.toString().padStart(5)}  ${fmtPct(dominant.H / segmentsClassified)}`);
  console.log(`    Mixed:             ${dominant.mixed.toString().padStart(5)}  ${fmtPct(dominant.mixed / segmentsClassified)}`);
  console.log(`    All neutral/unk:   ${dominant.neutral.toString().padStart(5)}  ${fmtPct(dominant.neutral / segmentsClassified)}`);
  console.log();
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const skipFetch = args.includes("--no-fetch");

  const classifier = new SmoothedClassifier(new LexiconClassifier(), 4);

  runFixtures(classifier);

  if (!skipFetch) {
    try {
      await runBerakhot(classifier);
    } catch (err) {
      console.error(
        `${COLOR.red}Failed to run Berakhot stage:${COLOR.reset}`,
        err instanceof Error ? err.message : err,
      );
      console.error(`(Use --no-fetch to skip the corpus stages.)`);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
