import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import {
  parseUrlState,
  updateUrl,
  subscribeToHashChange,
  applyingExternalState,
  isApplyingExternalState,
} from '../../urlState';
import { RESERVED_KEYS, SEARCH_KEYS, readLink, writeLink, type UrlState } from '@torahmap/link';
import { mockHistory, mockWindowLocation } from '../helpers/mocks';
import { registerAllOverlays, getAllOverlays } from '../../overlays/index';
import { overlayUrlParams } from '../helpers/overlayUrlParams';
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

describe('parseUrlState', () => {
  beforeEach(() => {
    mockHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the current address', () => {
    mockWindowLocation('http://localhost:5173/#overlay=trop&trop=etnachta');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlay).toBe('trop');
    expect(state.overlayParams.trop).toBe('etnachta');
  });

  it('reads a story and its stop', () => {
    mockHistory('http://localhost:5173/#story=tour&stop=abraham_call');
    const state = parseUrlState();
    expect(state.story).toBe('tour');
    expect(state.stop).toBe('abraham_call');
  });
});

describe('updateUrl', () => {
  beforeEach(() => {
    mockHistory('http://localhost:5173/');
  });

  it('replaces state by default', () => {
    const state: UrlState = {
      overlay: 'commentary',
      overlayParams: {},
    };
    updateUrl(state);
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/#overlay=commentary');
    expect(history.pushState).not.toHaveBeenCalled();
  });

  it('pushes state when requested', () => {
    const state: UrlState = {
      verse: 'Genesis.1.1',
      overlayParams: {},
    };
    updateUrl(state, true);
    expect(history.pushState).toHaveBeenCalledWith(null, '', '/#verse=Genesis.1.1');
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('preserves pathname and search params', () => {
    mockWindowLocation('http://localhost:5173/index.html?debug=true');
    const state: UrlState = {
      overlay: 'trop',
      overlayParams: {},
    };
    updateUrl(state);
    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/index.html?debug=true#overlay=trop',
    );
  });

  it('removes hash when state is empty', () => {
    mockHistory('http://localhost:5173/#overlay=commentary');
    updateUrl({ overlayParams: {} });
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('leaves an unchanged URL alone, adding no history entry', () => {
    mockHistory('http://localhost:5173/#story=tour&stop=intro');
    updateUrl({ story: 'tour', stop: 'intro', overlayParams: {} }, true);
    expect(history.pushState).not.toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
  });
});

describe('subscribeToHashChange', () => {
  beforeEach(() => {
    if (typeof window === 'undefined') {
      (globalThis as any).window = {};
    }
    window.addEventListener = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes to popstate event', () => {
    const callback = vi.fn();
    subscribeToHashChange(callback);
    expect(window.addEventListener).toHaveBeenCalledWith('popstate', callback);
  });

  // Registering both popstate and hashchange made a single back/forward
  // navigation run the restore callback twice, since both fire when history
  // traversal changes the hash. Only popstate is needed — see the comment on
  // subscribeToHashChange.
  it('does not also subscribe to hashchange', () => {
    const callback = vi.fn();
    subscribeToHashChange(callback);
    expect(window.addEventListener).not.toHaveBeenCalledWith('hashchange', callback);
  });
});

// A plausible value for each key an overlay declared.
function plausibleSettings(overlay: Overlay): Record<string, string> {
  const settings: Record<string, string> = {};
  for (const spec of overlay.urlParams ?? []) {
    settings[spec.key] = spec.allowed?.[0] ?? 'x';
  }
  return settings;
}

describe('what every overlay must hold to', () => {
  // The point of the redesign: an overlay that saves settings has to say which
  // keys it uses, or urlState.ts will never read them back out of a link.
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

    it(`${overlay.id}: answers colorsFor, or the story's blend shows it grey`, () => {
      expect(overlay.colorsFor).toBeTypeOf('function');
    });

    it(`${overlay.id}: has a name, which is what the menu shows`, () => {
      // main.ts builds the overlay menu out of the registry, using this name.
      expect(overlay.name?.trim()).toBeTruthy();
    });

    it(`${overlay.id}: uses distinct keys that do not clash with the view state`, () => {
      const keys = (overlay.urlParams ?? []).map((spec) => spec.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) {
        expect(RESERVED_KEYS.has(key)).toBe(false);
        expect(SEARCH_KEYS.has(key)).toBe(false);
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
      const state = readLink(query, overlayUrlParams);
      expect(state.overlayParams).toEqual(expected);
    });
  });

  it('keeps a full link intact through a parse and rebuild', () => {
    const query = '?overlay=commentary&verse=Exodus.20.1&zoom=3&category=Talmud';
    const rebuilt = writeLink(readLink(query, overlayUrlParams));
    expect(rebuilt).toContain('overlay=commentary');
    expect(rebuilt).toContain('verse=Exodus.20.1');
    expect(rebuilt).toContain('zoom=3');
    expect(rebuilt).toContain('category=Talmud');
  });
});
