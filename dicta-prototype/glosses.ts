// INVENTED DATA — for the Dicta-style facet prototype only.
//
// Torah Map has no dictionary of word senses. Strong's numbers are the only
// sense-like identifier on disk, and they carry no English or Hebrew gloss.
// So the labels below are hand-written by eye for three demonstration words.
// They are good enough to judge an interface by and are not fit for any
// other purpose. Nothing here should ever be merged into the real app.
//
// Everything else in the prototype (which verses match, which written forms
// occur, how many of each) is computed from the real corpus.

export interface Gloss {
  /** Short label shown in the facet row. */
  label: string;
  /** Longer description shown on hover. */
  note?: string;
}

export const INVENTED_GLOSSES: Record<string, Gloss> = {
  // --- עלה ---
  "5927": { label: "go up, ascend", note: "the ordinary motion verb" },
  "5930": { label: "burnt offering", note: "the sacrifice that goes up in smoke" },
  "5929": { label: "leaf, foliage" },
  "5922": { label: "upon, over (Aramaic)" },
  "5931": { label: "pretext, occasion (Aramaic)" },

  // --- שלם ---
  "7965": { label: "peace, welfare" },
  "7999": { label: "repay, make whole" },
  "8003": { label: "complete, unblemished" },
  "8002": { label: "peace offering" },
  "7966": { label: "recompense, bribe" },
  "8005": { label: "requital" },
  "7967": { label: "Shallum (name)" },
  "8006": { label: "Shillem (name)" },
  "8004": { label: "Shillem, patronymic" },
  "8001": { label: "peace (Aramaic)" },
  "8000": { label: "finish, deliver up (Aramaic)" },
  "3824": { label: "heart, mind", note: "reached through a shared written form, not a shared sense" },

  // --- ברך ---
  "1288": { label: "bless" },
  "1290": { label: "knee" },
  "1289": { label: "kneel, bless (Aramaic)" },
  "1293": { label: "a blessing" },
  "1295": { label: "pool, reservoir" },
  "1263": { label: "Baruch (name)" },
};

/** Words the prototype offers as one-click demonstrations. */
export const DEMO_WORDS: { word: string; caption: string }[] = [
  { word: "עלה", caption: "five senses, one of them a sacrifice" },
  { word: "שלם", caption: "twelve senses, several of them names" },
  { word: "ברך", caption: "bless / knee / pool" },
  { word: "ארז", caption: "a typical word: one sense" },
];

export function glossFor(strongsNum: string): Gloss {
  return (
    INVENTED_GLOSSES[strongsNum] ?? {
      label: `sense ${strongsNum}`,
      note: "no gloss written for this one — this is what every row would look like if the app shipped the facet column without a dictionary",
    }
  );
}
