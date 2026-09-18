import type { Overlay } from './types.ts';
import { validateOverlayParams } from '../urlState.ts';

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
  restore(overlay: Overlay, raw: LinkParams): void;
  /** An overlay's settings as link parameters, with values at their default left out. */
  toUrl(overlay: Overlay): Record<string, string>;
}

export function createOverlaySettings(): OverlaySettings {
  const byId = new Map<string, unknown>();

  const store: OverlaySettings = {
    get<T, S>(overlay: Overlay<T, S>): S {
      if (!byId.has(overlay.id)) byId.set(overlay.id, overlay.defaultSettings?.());
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
      return overlay.settingsToUrl?.(store.get(overlay)) ?? {};
    },
  };
  return store;
}

/** The settings a link's parameters name for an overlay, once validated against its urlParams. */
export function settingsFromLink(overlay: Overlay, raw: LinkParams): unknown {
  return overlay.settingsFromUrl?.(validateOverlayParams(overlay.urlParams, raw));
}
