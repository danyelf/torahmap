// The one place a data file is downloaded, parsed and its failure handled.
// Paths are under public/data/; what a file means belongs to whoever names it.
import { fetchData } from './constants.ts';

/** What has arrived, by path. A file that failed is absent. */
export type Loaded = ReadonlyMap<string, unknown>;

/** Download each path once. A failure is warned about and leaves that path missing. */
export async function loadFiles(paths: Iterable<string>): Promise<Loaded> {
  const unique = [...new Set(paths)];
  const contents = await Promise.all(unique.map(loadFile));
  return new Map(
    unique.flatMap((path, i) => (contents[i] === undefined ? [] : [[path, contents[i]] as const])),
  );
}

async function loadFile(path: string): Promise<unknown> {
  try {
    const response = await fetchData(path);
    if (!response.ok) {
      console.warn(`Could not load ${path}: ${response.status}`);
      return undefined;
    }
    return await response.json();
  } catch (e) {
    console.warn(`Could not load ${path}:`, e);
    return undefined;
  }
}

/** Each named file's contents under its name, or null until every one is in. */
export function filesFor<D>(files: Readonly<Record<string, string>>, loaded: Loaded): D | null {
  const named = Object.entries(files);
  if (!named.every(([, path]) => loaded.has(path))) return null;
  return Object.fromEntries(named.map(([name, path]) => [name, loaded.get(path)])) as D;
}
