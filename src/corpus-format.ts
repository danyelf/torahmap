// Shared reference/URL formatters for any corpus described by CorpusSchema.
//
// - formatReference: human-readable ("Genesis 1:1" / "Berakhot 17b:11")
// - serializeToUrlHash: URL-safe, colon-separated ("Genesis:1:1" / "Berakhot:2a:1")
// - parseFromUrlHash: inverse of serializeToUrlHash, returns null on malformed input

import type { CorpusSchema } from "./corpusSchema.ts";

type LevelValue = string | number;

/**
 * Produce a human-readable reference like "Genesis 1:1" or "Berakhot 17b:11".
 *
 * Format rule: first level followed by a space, then subsequent levels
 * separated by ":" except where concatWithPrevious is true (no separator).
 */
export function formatReference<T>(
  id: T,
  schema: CorpusSchema,
): string {
  const parts: string[] = [];
  const idAny = id as Record<string, LevelValue>;
  for (let i = 0; i < schema.levels.length; i++) {
    const level = schema.levels[i];
    const value = String(idAny[level.key]);
    if (i === 0) {
      parts.push(value);
    } else if (level.concatWithPrevious) {
      parts[parts.length - 1] += value;
    } else if (i === 1) {
      parts.push(" " + value);
    } else {
      parts.push(":" + value);
    }
  }
  return parts.join("");
}

/**
 * Produce a URL-safe hash param value like "Genesis:1:1" or "Berakhot:2a:1".
 *
 * Format rule: all levels separated by ":" except where concatWithPrevious
 * is true (no separator).
 */
export function serializeToUrlHash<T>(
  id: T,
  schema: CorpusSchema,
): string {
  const parts: string[] = [];
  const idAny = id as Record<string, LevelValue>;
  for (let i = 0; i < schema.levels.length; i++) {
    const level = schema.levels[i];
    const value = String(idAny[level.key]);
    if (i === 0) {
      parts.push(value);
    } else if (level.concatWithPrevious) {
      parts[parts.length - 1] += value;
    } else {
      parts.push(":" + value);
    }
  }
  return parts.join("");
}

/**
 * Parse a URL hash string into an identity object, or null if malformed.
 *
 * The parser walks the schema levels, consuming one ":"-separated token per
 * non-concat level. A concat level is parsed by stripping its enum suffix
 * from the preceding token.
 */
export function parseFromUrlHash(
  hash: string,
  schema: CorpusSchema,
): Record<string, LevelValue> | null {
  if (!hash) return null;

  // Split by ":" — we'll need as many tokens as there are non-concat levels.
  const tokens = hash.split(":");
  const nonConcatLevelCount = schema.levels.filter(
    (l) => !l.concatWithPrevious,
  ).length;
  if (tokens.length !== nonConcatLevelCount) return null;

  const result: Record<string, LevelValue> = {};
  let tokenIdx = 0;

  for (let i = 0; i < schema.levels.length; i++) {
    const level = schema.levels[i];

    if (level.concatWithPrevious) {
      // Split the previous token into a numeric prefix and an enum suffix.
      // E.g. "2a" → previousLevel = 2, thisLevel = "a".
      const prevLevel = schema.levels[i - 1];
      if (!prevLevel || prevLevel.type !== "number") return null;
      const enumValues = level.enum;
      if (!enumValues) return null;

      const prevToken = String(result[prevLevel.key]);
      let matched: string | null = null;
      for (const e of enumValues) {
        if (prevToken.endsWith(e)) {
          matched = e;
          break;
        }
      }
      if (!matched) return null;

      const numericPart = prevToken.slice(0, -matched.length);
      if (!/^\d+$/.test(numericPart)) return null;
      result[prevLevel.key] = parseInt(numericPart, 10);
      result[level.key] = matched;
      continue;
    }

    const token = tokens[tokenIdx++];
    if (token === undefined) return null;

    if (level.type === "string") {
      if (token.length === 0) return null;
      result[level.key] = token;
    } else if (level.type === "number") {
      // Store as a string initially — may be post-processed by a concat level.
      result[level.key] = token;
    } else if (level.type === "enum") {
      if (!level.enum || !level.enum.includes(token)) return null;
      result[level.key] = token;
    }
  }

  // Post-process: any "number" level whose value is still a string and was
  // not consumed by a concat level needs to be converted to a number.
  for (const level of schema.levels) {
    if (level.type === "number" && typeof result[level.key] === "string") {
      const s = result[level.key] as string;
      if (!/^\d+$/.test(s)) return null;
      result[level.key] = parseInt(s, 10);
    }
  }

  return result;
}
