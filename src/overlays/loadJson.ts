import { fetchData } from '../constants.ts';
import { reportError } from '../analytics.ts';

/**
 * Fetch and parse a JSON data file under public/data/, or log why not and
 * return null.
 *
 * `label` names the file in the error message when it should read as
 * something other than the raw path (e.g. "the commentary counts").
 */
export async function loadJson<T>(path: string, label: string = path): Promise<T | null> {
  try {
    const res = await fetchData(path);
    if (!res.ok) {
      reportError('loadJson', `Failed to load ${label}: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    reportError('loadJson', `Failed to load ${label}: ${e}`);
    return null;
  }
}
