import { fetchData } from '../constants.ts';

/**
 * Fetch and parse a JSON data file under public/data/. Throws if the file does
 * not download or does not parse.
 *
 * `label` names the file in the error message when it should read as
 * something other than the raw path (e.g. "the commentary counts").
 */
export async function loadJson<T>(path: string, label: string = path): Promise<T> {
  const res = await fetchData(path);
  if (!res.ok) throw new Error(`Failed to load ${label}: ${res.status}`);
  return (await res.json()) as T;
}
