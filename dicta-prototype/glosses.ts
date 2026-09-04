// INVENTED DATA — for the meaning-filter prototype only.
//
// Torah Map has no dictionary of word meanings. Strong's numbers are the only
// meaning-like identifier on disk and they carry no readable label, so the
// labels below are hand-written by eye for a handful of demonstration words.
// They exist so an interface can be judged, and are fit for nothing else.
// ETCBC is the intended replacement for the identifier itself.
//
// Everything else in the prototype — which verses carry which meaning, how
// many, and which spellings occur — is computed from the real corpus.

export interface Gloss {
  label: string;
  note?: string;
}

export const INVENTED_GLOSSES: Record<string, Gloss> = {
  // --- עלה ---
  "5927": { label: "go up, ascend", note: "the ordinary motion verb" },
  "5930": { label: "burnt offering", note: "the sacrifice that goes up in smoke" },
  "5929": { label: "leaf, foliage" },
  "5931": { label: "pretext, occasion (Aramaic)" },

  // --- זבח ---
  "2077": { label: "a sacrifice" },
  "2076": { label: "to slaughter, sacrifice" },
  "2078": { label: "Zebah (name)" },

  // --- שלם ---
  "7965": { label: "peace, welfare" },
  "7999": { label: "repay, make whole" },
  "8002": { label: "peace offering" },
  "8003": { label: "complete, unblemished" },
  "7967": { label: "Shallum (name)" },
  "7966": { label: "recompense, bribe" },
  "8005": { label: "requital" },
  "8006": { label: "Shillem (name)" },
  "8004": { label: "Shillem, patronymic" },
  "8000": { label: "finish, deliver up (Aramaic)" },
  "8001": { label: "peace (Aramaic)" },

  // --- ברך ---
  "1288": { label: "bless" },
  "1290": { label: "knee" },
  "1289": { label: "kneel, bless (Aramaic)" },

  // --- ארז ---
  "730": { label: "cedar" },
};

export function glossFor(strongsNum: string): Gloss {
  return (
    INVENTED_GLOSSES[strongsNum] ?? {
      label: `meaning ${strongsNum}`,
      note: "no label written for this one — this is what every row looks like without a dictionary",
    }
  );
}

export interface Scenario {
  label: string;
  caption: string;
  terms: { word: string; only?: string[] }[];
}

/** One-click set-ups for the cases that carry the argument. */
export const SCENARIOS: Scenario[] = [
  {
    label: "עלה",
    caption: "four meanings, none excluded",
    terms: [{ word: "עלה" }],
  },
  {
    label: "עלה ↓",
    caption: "narrowed to burnt offering",
    terms: [{ word: "עלה", only: ["5930"] }],
  },
  {
    label: "עלה ↓ + זבח",
    caption: "a narrowed word beside an unnarrowed one",
    terms: [{ word: "עלה", only: ["5930"] }, { word: "זבח" }],
  },
  {
    label: "שלם",
    caption: "ten meanings, still one colour",
    terms: [{ word: "שלם" }],
  },
  {
    label: "ארז",
    caption: "one meaning: no control at all",
    terms: [{ word: "ארז" }],
  },
];
