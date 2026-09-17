import { fetchData } from '../constants/app.ts';

/**
 * Fetch and parse a JSON data file under public/data/. Logs and returns null
 * if the response isn't ok; a JSON parse failure is left to the caller's own
 * try/catch, since overlays react to that differently.
 *
 * `label` names the file in the error message when it should read as
 * something other than the raw path (e.g. "the commentary counts").
 */
export async function loadJson<T>(path: string, label: string = path): Promise<T | null> {
  const res = await fetchData(path);
  if (!res.ok) {
    console.error(`Failed to load ${label}: ${res.status}`);
    return null;
  }
  return (await res.json()) as T;
}
