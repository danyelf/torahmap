/**
 * Hebrew/Aramaic classifier — v1 prototype.
 *
 * Implements the contracts from docs/plans/2026-04-06-hebrew-aramaic-classifier-design.md:
 *   - Tokenizer: niqqud-aware, splits on whitespace/punct/maqaf
 *   - LexiconClassifier: function-word lexicon + minimal pairs + weak suffix features
 *   - SmoothedClassifier: wraps any classifier, fills N/? from neighbors within a window
 *   - aggregate(): pure function over a packed lang string
 *
 * Single file for prototype compactness. The production version will split these.
 */

// =============================================================================
// Contracts
// =============================================================================

export type Label = "A" | "H" | "N" | "?";

export interface Token {
  raw: string;        // with niqqud, as it appears in source
  stripped: string;   // niqqud removed, ready for matching
  start: number;      // char offset in original line
  end: number;
}

export interface ClassifierResult {
  labels: Label[];                                                  // length === tokens.length
  probabilities?: Array<{ A: number; H: number; N: number }>;       // optional
  evidence?: string[];                                              // optional, for debugging
}

export interface LanguageClassifier {
  readonly name: string;
  readonly version: string;
  classify(tokens: Token[]): ClassifierResult;
}

// =============================================================================
// Tokenizer
// =============================================================================

// Hebrew niqqud (vowel marks + cantillation): U+0591–U+05C7
const NIQQUD_RE = /[\u0591-\u05C7]/g;

// Word characters: Hebrew letters U+05D0–U+05EA, plus final forms (already in range).
// Maqaf U+05BE is a word separator (treated as space).
const HEBREW_LETTER = /[\u05D0-\u05EA]/;

export function stripNiqqud(s: string): string {
  return s.normalize("NFKD").replace(NIQQUD_RE, "");
}

/**
 * Tokenize a Hebrew/Aramaic line into Token objects.
 * Strips HTML tags (Wikisource markup), splits on whitespace, punctuation, and maqaf.
 * Preserves niqqud in `raw` and provides niqqud-stripped `stripped` for matching.
 */
export function tokenize(line: string): Token[] {
  // Drop HTML tags first (Wikisource includes <big>, <small>, etc.)
  const cleaned = line.replace(/<[^>]+>/g, " ");

  const tokens: Token[] = [];
  let i = 0;
  while (i < cleaned.length) {
    // Skip non-word characters
    while (i < cleaned.length && !HEBREW_LETTER.test(cleaned[i])) {
      i++;
    }
    if (i >= cleaned.length) break;

    // Read a word: Hebrew letters + interspersed niqqud, until we hit
    // a non-letter/non-niqqud (whitespace, punctuation, maqaf, etc.)
    const start = i;
    while (
      i < cleaned.length &&
      (HEBREW_LETTER.test(cleaned[i]) || NIQQUD_RE.test(cleaned[i]))
    ) {
      // NIQQUD_RE has /g flag — reset lastIndex
      NIQQUD_RE.lastIndex = 0;
      i++;
    }
    const raw = cleaned.slice(start, i);
    const stripped = stripNiqqud(raw);
    if (stripped.length > 0) {
      tokens.push({ raw, stripped, start, end: i });
    }
  }
  return tokens;
}

// =============================================================================
// Lexicon — v0.1.0
// =============================================================================

/**
 * Function-word lexicon. Stripped (niqqud-free) keys.
 * Strong evidence: a hit here pins the label.
 */
const ARAMAIC_LEXICON_STRIPPED = new Set([
  // Discourse particles & question words
  "אילימא", "אלמא", "אי", "אילו",
  "מאי", "מאן", "מנא", "מנלן", "מנהני", "מנהמילי",
  "היכי", "היכא", "הכא", "התם", "הכי",
  "איכא", "ליכא", "לית", "אית",
  "קא", "קמא", "קמייתא",
  // Citation / discussion formulas
  "תנינא", "תנן", "תניא", "איתמר", "אמרינן", "אמרת",
  "דאמר", "דאמרי", "דאמרינן", "דתניא", "דתנן",
  "דלמא", "דילמא",
  // Pronouns / demonstratives
  "איהו", "איהי", "אנא", "אנן", "את", "אתון",
  "האי", "הני", "הנך", "ההוא", "ההיא", "הא",
  // Common verbs / nouns / titles
  "הוי", "הוה", "הואי", "ליהוי", "תיהוי",
  "מילתא", "גברא", "מר", "מרי", "רבנן", "רבא", "אביי",
  "נמי", "טפי", "מאד",
]);

const HEBREW_LEXICON_STRIPPED = new Set([
  // Function words
  "אשר", "ש", "אין", "יש", "אם", "אך", "גם", "רק", "אכן",
  "אלא", // primarily Mishnaic Hebrew "rather/but"
  "ואין", "ויש", "ולא", // ולא is ambiguous with Aramaic ולא; minimal pair below disambiguates with niqqud
  // Decisive Mishnaic markers
  "אלו", "הללו",
  // Common Hebrew verbs/nouns that don't appear in Aramaic in the same form
  "היה", "היתה", "היו", "תהיה", "יהיה",
  "אמרו", "אמרתי", "אמרת",
  "לפיכך", "אבל",
]);

/**
 * Words used in both languages with no reliable distinction.
 * These get label N (neutral) and don't vote in aggregates.
 */
const NEUTRAL_LEXICON_STRIPPED = new Set([
  "אמר", "אמרו", "אמרה",
  "או", "אז", "עם", "עד", "על", "אל", "את", "בין", "ל", "ב", "כ", "מ", "ו",
  "כל", "כלם", "כולם", "כלן",
  "לא", // ambiguous when stripped; minimal pair below uses niqqud
  "זה", "זאת", "אלה",
  "רב", "רבי", "ר",
  "תורה", "מצוה", "מצוות",
]);

/**
 * Minimal pairs that need niqqud to disambiguate. Keyed by `raw` (with niqqud).
 * If a word matches one of these in raw form, it overrides the stripped lookup.
 */
const MINIMAL_PAIRS: Record<string, Label> = {
  // לא: Hebrew לֹא vs Aramaic לָא
  "לֹא": "H",
  "וְלֹא": "H",
  "לָא": "A",
  "וְלָא": "A",
  // הוא: Hebrew הוּא vs Aramaic אִיהוּ (different word, but listed for completeness)
  "הוּא": "H",
  "אִיהוּ": "A",
  // אני vs אנא
  "אֲנִי": "H",
  "אֲנָא": "A",
};

// =============================================================================
// LexiconClassifier
// =============================================================================

export class LexiconClassifier implements LanguageClassifier {
  readonly name = "lexicon";
  readonly version = "0.1.0";

  classify(tokens: Token[]): ClassifierResult {
    const labels: Label[] = [];
    const evidence: string[] = [];

    for (const tok of tokens) {
      const { label, why } = this.scoreToken(tok);
      labels.push(label);
      evidence.push(why);
    }

    return { labels, evidence };
  }

  private scoreToken(tok: Token): { label: Label; why: string } {
    // 1. Minimal pair (niqqud-bearing) — highest priority
    if (MINIMAL_PAIRS[tok.raw] !== undefined) {
      return { label: MINIMAL_PAIRS[tok.raw], why: `pair:${tok.raw}` };
    }

    // 2. Lexicon hit on stripped form
    if (ARAMAIC_LEXICON_STRIPPED.has(tok.stripped)) {
      return { label: "A", why: `lex-A:${tok.stripped}` };
    }
    if (HEBREW_LEXICON_STRIPPED.has(tok.stripped)) {
      return { label: "H", why: `lex-H:${tok.stripped}` };
    }
    if (NEUTRAL_LEXICON_STRIPPED.has(tok.stripped)) {
      return { label: "N", why: `lex-N:${tok.stripped}` };
    }

    // 3. Weak morphological features
    const s = tok.stripped;

    // Leading דְ on a longer word → Aramaic relative/genitive
    // (Don't fire on standalone דְ — that's handled by lexicon as bare ד not present.)
    if (s.length >= 4 && s.startsWith("ד") && !s.startsWith("דב") && !s.startsWith("דע")) {
      // Heuristic: ד-prefix on a 4+ letter word is usually Aramaic.
      // Excludes common Hebrew words starting with ד (דבר, דעת, ...).
      return { label: "A", why: `pfx-d:${s}` };
    }

    // Definite ה־ on a longer word → Hebrew (Aramaic uses suffix א instead)
    if (s.length >= 4 && s.startsWith("ה") && !s.startsWith("הו") && !s.startsWith("הי")) {
      return { label: "H", why: `pfx-h:${s}` };
    }

    // No signal
    return { label: "?", why: "none" };
  }
}

// =============================================================================
// Smoothing
// =============================================================================

/**
 * Fill N/? labels from the nearest non-neutral neighbor within `window` words.
 * Does NOT smooth A/H into each other — short Hebrew quotations inside Aramaic
 * runs must survive.
 *
 * Length-1 exception: an isolated A or H run with no lexicon evidence
 * (only weak suffix evidence) flips to match its neighbors. Implemented by
 * accepting an optional `evidence` array — if a label has weak evidence and
 * is sandwiched between opposite labels, it flips.
 */
export function smooth(
  labels: Label[],
  window: number = 4,
  evidence?: string[],
): Label[] {
  const out: Label[] = [...labels];

  // Pass 1: fill N/? from neighbors
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== "N" && out[i] !== "?") continue;

    let leftLabel: Label | null = null;
    let leftDist = Infinity;
    for (let j = i - 1; j >= Math.max(0, i - window); j--) {
      if (labels[j] === "A" || labels[j] === "H") {
        leftLabel = labels[j];
        leftDist = i - j;
        break;
      }
    }

    let rightLabel: Label | null = null;
    let rightDist = Infinity;
    for (let j = i + 1; j <= Math.min(labels.length - 1, i + window); j++) {
      if (labels[j] === "A" || labels[j] === "H") {
        rightLabel = labels[j];
        rightDist = j - i;
        break;
      }
    }

    if (leftLabel && rightLabel) {
      out[i] = leftDist <= rightDist ? leftLabel : rightLabel;
    } else if (leftLabel) {
      out[i] = leftLabel;
    } else if (rightLabel) {
      out[i] = rightLabel;
    }
    // else: leave as N/?
  }

  // Pass 2: length-1 weak-evidence flip
  if (evidence) {
    for (let i = 1; i < out.length - 1; i++) {
      const cur = out[i];
      if (cur !== "A" && cur !== "H") continue;
      const opposite: Label = cur === "A" ? "H" : "A";
      if (out[i - 1] === opposite && out[i + 1] === opposite) {
        // Check evidence — only flip if weak (suffix-based, not lexicon)
        const ev = evidence[i] || "";
        if (ev.startsWith("pfx-") || ev === "none") {
          out[i] = opposite;
        }
      }
    }
  }

  return out;
}

export class SmoothedClassifier implements LanguageClassifier {
  readonly name: string;
  readonly version: string;
  private readonly inner: LanguageClassifier;
  private readonly window: number;

  constructor(inner: LanguageClassifier, window: number = 4) {
    this.inner = inner;
    this.window = window;
    this.name = `${inner.name}+smooth`;
    this.version = inner.version;
  }

  classify(tokens: Token[]): ClassifierResult {
    const raw = this.inner.classify(tokens);
    return {
      ...raw,
      labels: smooth(raw.labels, this.window, raw.evidence),
    };
  }
}

// =============================================================================
// Aggregation
// =============================================================================

/**
 * Compute the language ratio over a per-word label sequence.
 * N (neutral) and ? (unknown) are excluded from the denominator —
 * the ratio reflects only words that actually voted.
 */
export function aggregate(labels: Label[] | string): {
  A: number;
  H: number;
  N: number;
  total: number;
  voting: number;
} {
  const arr = typeof labels === "string" ? labels.split("") as Label[] : labels;
  let a = 0;
  let h = 0;
  let n = 0;
  let unknown = 0;
  for (const l of arr) {
    if (l === "A") a++;
    else if (l === "H") h++;
    else if (l === "N") n++;
    else unknown++;
  }
  const total = arr.length;
  const voting = a + h;
  return {
    A: voting === 0 ? 0 : a / voting,
    H: voting === 0 ? 0 : h / voting,
    N: total === 0 ? 0 : (n + unknown) / total,
    total,
    voting,
  };
}

/**
 * Pack a label array into a string (one char per token).
 */
export function packLabels(labels: Label[]): string {
  return labels.join("");
}
