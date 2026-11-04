import type { Overlay, UrlParamSpec } from './types.ts';
import { validateOverlayParams } from '@torahmap/link';

export type LinkParams = URLSearchParams | Readonly<Record<string, string | undefined>>;

/**
 * The settings a link's parameters name for an overlay, once validated against
 * its urlParams, with new colours chosen to avoid `taken`. An empty link names
 * its defaults.
 */
export function settingsFromLink<T, S>(
  overlay: Overlay<T, S>,
  raw: LinkParams,
  taken: readonly number[] = [],
): S {
  // An overlay without settings is handed undefined, as its S says.
  return overlay.settingsFromUrl?.(validateOverlayParams(overlay.urlParams, raw), taken) as S;
}

/** An overlay's settings as link parameters, with values at their default left out. */
export function settingsToLink<T, S>(overlay: Overlay<T, S>, settings: S): Record<string, string> {
  return withoutDefaults(overlay.urlParams, overlay.settingsToUrl?.(settings) ?? {});
}

function withoutDefaults(
  specs: readonly UrlParamSpec[] | undefined,
  params: Record<string, string>,
): Record<string, string> {
  const defaults = new Map(specs?.map((spec) => [spec.key, spec.default]));
  return Object.fromEntries(Object.entries(params).filter(([key, v]) => defaults.get(key) !== v));
}
