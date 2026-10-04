import { describe, it, expect, beforeAll, vi } from 'vitest';
import type { TanakhIdentity } from '../../types';
import {
  parseUrlState,
  updateUrl,
  subscribeToHistory,
  applyingExternalState,
  isApplyingExternalState,
} from '../../urlState';
import { readLink, writeLink } from '@torahmap/link';
import { mockHistory } from '../helpers/mocks';
import { setLink } from '../helpers/setLink';
import { registerAllOverlays, getAllOverlays } from '../../overlays/index';
import { overlayParamSpecs } from '@torahmap/overlay-catalog';
import { createOverlaySettings } from '../../overlays/settings';
import type { Overlay } from '../../overlays/types';

// The registry is where overlays come from — populate it the way the app does.
registerAllOverlays();

// Set up window object for tests
beforeAll(() => {
  if (typeof window === 'undefined') {
    (globalThis as any).window = {};
  }
});

describe('the address holds the view in its query string', () => {
  it('reads the view from the query string', () => {
    setLink('?verse=Genesis.1.1&overlay=commentary');
    expect(parseUrlState()).toMatchObject({ verse: 'Genesis.1.1', overlay: 'commentary' });
  });

  it('ignores a hash link', () => {
    history.replaceState(null, '', '/#verse=Genesis.1.1');
    expect(parseUrlState().verse).toBeUndefined();
  });

  it('writes the query string and drops any hash', () => {
    history.replaceState(null, '', '/#verse=Genesis.1.1');
    updateUrl({ verse: 'Exodus.2.3', overlayParams: {} });
    expect(window.location.search).toBe('?verse=Exodus.2.3');
    expect(window.location.hash).toBe('');
  });

  it('writes the bare pathname for an empty view', () => {
    setLink('?verse=Genesis.1.1');
    updateUrl({ overlayParams: {} });
    expect(window.location.search).toBe('');
  });

  it('drops a leftover hash even when the query itself is unchanged', () => {
    history.replaceState(null, '', '/?verse=Genesis.1.1#x');
    updateUrl({ verse: 'Genesis.1.1', overlayParams: {} });
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?verse=Genesis.1.1');
  });

  it('keeps the pathname', () => {
    history.replaceState(null, '', '/index.html?verse=Genesis.1.1');
    updateUrl({ verse: 'Exodus.2.3', overlayParams: {} });
    expect(window.location.pathname).toBe('/index.html');
  });

  it('adds no history entry for an unchanged view', () => {
    setLink('?verse=Genesis.1.1');
    const before = history.length;
    updateUrl({ verse: 'Genesis.1.1', overlayParams: {} }, true);
    expect(history.length).toBe(before);
  });

  it('hears Back and Forward', () => {
    const heard = vi.fn();
    subscribeToHistory(heard);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(heard).toHaveBeenCalledOnce();
  });
});

// A plausible value for each key an overlay declared.
function plausibleSettings(overlay: Overlay<TanakhIdentity>): Record<string, string> {
  const settings: Record<string, string> = {};
  for (const spec of overlay.urlParams ?? []) {
    settings[spec.key] = spec.allowed?.[0] ?? 'x';
  }
  return settings;
}

describe('what every overlay must hold to', () => {
  // An overlay that saves settings has to say which keys it uses, or
  // @torahmap/link will never read them back out of a link.
  getAllOverlays().forEach((overlay) => {
    // Declared, not inferred from a value: an overlay whose default settings
    // are undefined still saves settings if it implements settingsToUrl.
    const savesSettings = overlay.settingsToUrl !== undefined;

    it(`${overlay.id}: declares its keys if and only if it saves settings`, () => {
      if (savesSettings) {
        expect(overlay.urlParams, `${overlay.id} has no urlParams`).toBeDefined();
        expect(overlay.urlParams!.length).toBeGreaterThan(0);
      } else {
        expect(overlay.urlParams).toBeUndefined();
      }
    });

    it(`${overlay.id}: only reports settings under keys it declared`, () => {
      const declared = new Set((overlay.urlParams ?? []).map((spec) => spec.key));
      const store = createOverlaySettings();
      store.restore(overlay, plausibleSettings(overlay));
      const reported = Object.keys(store.toUrl(overlay));
      for (const key of reported) {
        expect(declared, `${overlay.id} reported undeclared "${key}"`).toContain(key);
      }
    });
  });
});

describe('the restore guard itself', () => {
  it('lets URL writes through normally', () => {
    const { replaceState } = mockHistory('http://localhost:5173/');

    updateUrl({ overlay: 'commentary', overlayParams: {} }, false);
    expect(replaceState).toHaveBeenCalled();
  });

  it('blocks them inside applyingExternalState, and only inside', () => {
    const { replaceState } = mockHistory('http://localhost:5173/');

    applyingExternalState(() => {
      expect(isApplyingExternalState()).toBe(true);
      updateUrl({ overlay: 'commentary', overlayParams: {} }, false);
    });
    expect(replaceState).not.toHaveBeenCalled();

    expect(isApplyingExternalState()).toBe(false);
    updateUrl({ overlay: 'commentary', overlayParams: {} }, false);
    expect(replaceState).toHaveBeenCalledTimes(1);
  });

  it('restores writes even when the restore throws', () => {
    expect(() =>
      applyingExternalState(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(isApplyingExternalState()).toBe(false);
  });
});

describe('whole links, parsed with the real overlay declarations', () => {
  const links: Array<[string, Record<string, string>]> = [
    ['?overlay=trop&trop=etnachta', { trop: 'etnachta' }],
    ['?overlay=commentary&category=Midrash', { category: 'Midrash' }],
    ['?overlay=commentary&category=Jewish%20Thought', { category: 'Jewish Thought' }],
  ];

  links.forEach(([query, expected]) => {
    it(`parses ${query}`, () => {
      const state = readLink(query, overlayParamSpecs);
      expect(state.overlayParams).toEqual(expected);
    });
  });

  it('keeps a full link intact through a parse and rebuild', () => {
    const query = '?overlay=commentary&verse=Exodus.20.1&zoom=3&category=Talmud';
    const rebuilt = writeLink(readLink(query, overlayParamSpecs));
    expect(rebuilt).toContain('overlay=commentary');
    expect(rebuilt).toContain('verse=Exodus.20.1');
    expect(rebuilt).toContain('zoom=3');
    expect(rebuilt).toContain('category=Talmud');
  });
});
