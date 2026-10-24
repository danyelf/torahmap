// The rabbis a reader can pick on the Talmud map, and who each name dating.json lists can be.
// Written by dating.ts beside dating.json.

import type { Rabbi, Reading, TalmudRabbis } from '@torahmap/talmud/rabbis.ts';
import { isAmbiguous, latestGeneration, type Facts } from './facts.ts';

/**
 * `slugs` is the Sefaria slug of each person in dating.json, in order. A rabbi is anyone with a
 * generation whom a listed name can mean, the candidates of a shared name included.
 */
export function rabbisFrom(facts: Facts, slugs: readonly string[]): TalmudRabbis {
  const { topics, candidates, periods } = facts;
  const dated = (slug: string) => latestGeneration(topics[slug]?.generation, periods) !== null;
  const meant = (slug: string) => (isAmbiguous(slug) ? (candidates[slug] ?? []) : [slug]);

  const ids = [...new Set(slugs.flatMap(meant).filter(dated))].sort();
  const placeOf = new Map(ids.map((id, i) => [id, i]));

  // A shared name can be said of each person it may mean.
  const sharedNames = new Map<string, string[]>();
  for (const [name, people] of Object.entries(candidates)) {
    for (const id of people) {
      sharedNames.set(id, [...(sharedNames.get(id) ?? []), ...(topics[name]?.names ?? [])]);
    }
  }

  const rabbis: Rabbi[] = ids.map((id) => ({
    id,
    en: topics[id].en ?? id,
    he: topics[id].he ?? '',
    gen: latestGeneration(topics[id].generation, periods)!,
    names: [...new Set([...topics[id].names, ...(sharedNames.get(id) ?? [])])].sort(),
  }));

  const readings = slugs.map((slug): Reading => {
    const people = meant(slug);
    const sure = !isAmbiguous(slug) || people.length === 1;
    return [sure ? 1 : 0, ...people.filter(dated).map((id) => placeOf.get(id)!)];
  });
  return { rabbis, readings };
}
