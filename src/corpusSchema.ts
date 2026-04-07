// Corpus schema — runtime description of a corpus's identity hierarchy.
// Consumed by shared formatters, URL parsers, and comparators so they can
// work across corpora without per-corpus switch statements.

/**
 * Description of one level in a corpus's identity hierarchy.
 *
 * - "string" levels carry free-form names (e.g. book or tractate names).
 * - "number" levels carry positive integers (chapter, verse, daf, segment).
 * - "enum" levels carry one of a fixed list of values (e.g. amud = "a" | "b").
 *
 * When concatWithPrevious is true, this level is rendered joined to the
 * previous level with no separator. Used for Talmud's amud ("2a" not "2:a").
 */
export interface LevelDef {
  key: string;
  type: "string" | "number" | "enum";
  enum?: readonly string[];
  concatWithPrevious?: boolean;
}

/**
 * A corpus's identity schema. Array order matches hierarchy depth
 * (outermost → innermost).
 */
export interface CorpusSchema {
  kind: "tanakh" | "talmud";
  levels: readonly LevelDef[];
}

export const TANAKH_SCHEMA: CorpusSchema = {
  kind: "tanakh",
  levels: [
    { key: "book", type: "string" },
    { key: "chapter", type: "number" },
    { key: "verse", type: "number" },
  ],
};

export const TALMUD_SCHEMA: CorpusSchema = {
  kind: "talmud",
  levels: [
    { key: "tractate", type: "string" },
    { key: "daf", type: "number" },
    { key: "amud", type: "enum", enum: ["a", "b"], concatWithPrevious: true },
    { key: "segment", type: "number" },
  ],
};
