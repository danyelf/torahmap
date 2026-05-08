// CorpusFormat<T>: the contract every corpus's format module must satisfy.
// Each corpus implements its own; no shared schema-walking machinery.

export interface CorpusFormat<T> {
  /** Human-readable reference, e.g. "Genesis 1:1" or "Berakhot 17b:11". */
  format(id: T): string;
  /** URL-safe hash value, e.g. "Genesis:1:1" or "Berakhot:2a:1". */
  serializeHash(id: T): string;
  /** Parse a URL hash back to an identity, or null if malformed. */
  parseHash(hash: string): T | null;
}
