// Runtime data loading for the Talmud map.
// Loads public/data/talmud/structure.json eagerly at startup and per-tractate
// text files lazily with in-memory caching.

import { fetchData } from "../constants/app.ts";

export interface TalmudAmud {
  daf: number;
  amud: "a" | "b";
  segmentCount: number;
  perekIdx: number;
  perekBoundaryAt?: number;
  mishnahMask: boolean[];
}

export interface TalmudPerek {
  hebrewName: string;
  startAmudIdx: number;
  endAmudIdx: number;
  startSegmentInFirstAmud: number;
  endSegmentInLastAmud: number;
}

export interface TalmudTractate {
  name: string;
  hebrewName: string;
  seder: string;
  firstDaf: number;
  amudim: TalmudAmud[];
  perakim: TalmudPerek[];
}

export interface TalmudStructure {
  tractates: TalmudTractate[];
}

export interface TalmudTractateText {
  name: string;
  amudim: string[][];
}

/**
 * Load the all-tractates structure file. Called once at page load.
 */
export async function loadTalmudStructure(): Promise<TalmudStructure> {
  const res = await fetchData("talmud/structure.json");
  if (!res.ok) {
    throw new Error(`Failed to load talmud/structure.json: ${res.status}`);
  }
  return res.json() as Promise<TalmudStructure>;
}

// ============================================================================
// Per-tractate text cache
// ============================================================================

const textCache = new Map<string, TalmudTractateText | Promise<TalmudTractateText>>();

/**
 * Get the Hebrew text for a tractate. Returns cached text if loaded,
 * awaits an in-flight fetch if one exists, otherwise starts a new fetch.
 * Dedupes concurrent callers automatically.
 */
export async function getTractateText(
  name: string,
): Promise<TalmudTractateText> {
  const existing = textCache.get(name);
  if (existing) {
    return await existing;
  }
  const promise = (async () => {
    const res = await fetchData(`talmud/texts/${name}.json`);
    if (!res.ok) {
      throw new Error(`Failed to load ${name}: ${res.status}`);
    }
    return res.json() as Promise<TalmudTractateText>;
  })();
  textCache.set(name, promise);
  const result = await promise;
  textCache.set(name, result); // replace promise with resolved value
  return result;
}

/**
 * True when a tractate's text is already fully loaded (not just in flight).
 */
export function hasTractateText(name: string): boolean {
  const entry = textCache.get(name);
  return entry !== undefined && !(entry instanceof Promise);
}

/**
 * Clear the cache. Test-only.
 */
export function resetTalmudDataCache(): void {
  textCache.clear();
}

/**
 * Look up whether a specific segment is Mishnah or Gemara.
 * Returns false if the tractate/daf/amud/segment is unknown.
 */
export function isSegmentMishnah(
  structure: TalmudStructure,
  tractateName: string,
  daf: number,
  amud: "a" | "b",
  segment: number,
): boolean {
  const tractate = structure.tractates.find((t) => t.name === tractateName);
  if (!tractate) return false;
  const amudIdx = (daf - tractate.firstDaf) * 2 + (amud === "b" ? 1 : 0);
  const amudEntry = tractate.amudim[amudIdx];
  if (!amudEntry) return false;
  return amudEntry.mishnahMask[segment - 1] ?? false;
}
