import type { Overlay, UrlParamSpec } from './types.ts';
import { validateOverlayParams } from '@torahmap/link';

export type LinkParams = URLSearchParams | Readonly<Record<string, string | undefined>>;

/**
 * The settings the app holds for each overlay, by overlay id.
 *
 * An overlay nothing has set yet has its defaults. Setting or restoring one
 * overlay's settings leaves every other overlay's alone, so a reader who
 * switches away and back finds what they left.
 */
export interface OverlaySettings {
  get<T, S>(overlay: Overlay<T, S>): S;
  set<T, S>(overlay: Overlay<T, S>, next: S): void;
  /** Replace an overlay's settings with the ones a link or a story stop names. */
  restore(overlay: Overlay<unknown>, raw: LinkParams): void;
  /** An overlay's settings as link parameters, with values at their default left out. */
  toUrl(overlay: Overlay<unknown>): Record<string, string>;
}

export function createOverlaySettings(): OverlaySettings {
  const byId = new Map<string, unknown>();

  const store: OverlaySettings = {
    get<T, S>(overlay: Overlay<T, S>): S {
      if (!byId.has(overlay.id)) byId.set(overlay.id, settingsFromLink(overlay, {}));
      // The one assertion: only this overlay's own settings are stored under its id.
      return byId.get(overlay.id) as S;
    },

    set(overlay, next) {
      byId.set(overlay.id, next);
    },

    restore(overlay, raw) {
      store.set(overlay, settingsFromLink(overlay, raw));
    },

    toUrl(overlay) {
      return withoutDefaults(overlay.urlParams, overlay.settingsToUrl?.(store.get(overlay)) ?? {});
    },
  };
  return store;
}

/**
 * The settings a link's parameters name for an overlay, once validated against
 * its urlParams. An empty link names its defaults.
 */
export function settingsFromLink<T, S>(overlay: Overlay<T, S>, raw: LinkParams): S {
  // An overlay without settings is handed undefined, as its S says.
  return overlay.settingsFromUrl?.(validateOverlayParams(overlay.urlParams, raw)) as S;
}

function withoutDefaults(
  specs: readonly UrlParamSpec[] | undefined,
  params: Record<string, string>,
): Record<string, string> {
  const defaults = new Map(specs?.map((spec) => [spec.key, spec.default]));
  return Object.fromEntries(Object.entries(params).filter(([key, v]) => defaults.get(key) !== v));
}
