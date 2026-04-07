/**
 * Fetch and cache the Wikisource Talmud Bavli Berakhot JSON
 * from the public Sefaria-Export GCS bucket.
 */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BERAKHOT_URL =
  "https://storage.googleapis.com/sefaria-export/json/Talmud/Bavli/Seder%20Zeraim/Berakhot/Hebrew/Wikisource%20Talmud%20Bavli.json";

const CACHE_PATH = join(__dirname, "cache", "berakhot.json");

/**
 * Wikisource Talmud Bavli JSON shape (relevant subset):
 * {
 *   text: string[][],         // text[amudIndex][segmentIndex]
 *   sectionNames: ["Daf", "Line"],
 *   ...
 * }
 */
export interface WikisourceTalmud {
  text: string[][];
  sectionNames: string[];
  title?: string;
  versionTitle?: string;
}

export async function fetchBerakhot(): Promise<WikisourceTalmud> {
  try {
    await stat(CACHE_PATH);
    const cached = await readFile(CACHE_PATH, "utf-8");
    return JSON.parse(cached);
  } catch {
    // Cache miss — fetch
  }

  console.error(`Downloading ${BERAKHOT_URL}…`);
  const response = await fetch(BERAKHOT_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Berakhot: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, text, "utf-8");
  console.error(`Cached to ${CACHE_PATH} (${(text.length / 1024).toFixed(0)} KB)`);
  return JSON.parse(text);
}

/**
 * Flatten the Wikisource text array into a list of (daf, segment, text) records.
 * `text[amudIndex][segmentIndex]` — amudIndex 0 is daf 2a (Bavli starts on 2a, not 1).
 */
export interface BerakhotSegment {
  amudIndex: number;
  segmentIndex: number;
  daf: string; // e.g. "2a", "2b", "3a"
  text: string;
}

export function flattenBerakhot(data: WikisourceTalmud): BerakhotSegment[] {
  const out: BerakhotSegment[] = [];
  for (let amudIndex = 0; amudIndex < data.text.length; amudIndex++) {
    const amud = data.text[amudIndex];
    if (!Array.isArray(amud) || amud.length === 0) continue;
    // Wikisource pads indices 0–1 with empty arrays (no daf 1).
    // amudIndex 2 = daf 2a, 3 = 2b, 4 = 3a, 5 = 3b, …
    const dafNum = Math.floor(amudIndex / 2) + 1;
    const side = amudIndex % 2 === 0 ? "a" : "b";
    const daf = `${dafNum}${side}`;
    for (let segmentIndex = 0; segmentIndex < amud.length; segmentIndex++) {
      const text = amud[segmentIndex];
      if (typeof text !== "string" || text.length === 0) continue;
      out.push({ amudIndex, segmentIndex, daf, text });
    }
  }
  return out;
}
