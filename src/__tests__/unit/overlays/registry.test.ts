import { describe, it, expect, afterEach } from 'vitest';
import type { TanakhIdentity } from '../../../types';
import { registerOverlay, clearOverlays, getOverlay } from '../../../overlays/registry';
import type { Overlay } from '../../../overlays/types';

function claiming(key: string): Overlay<TanakhIdentity> {
  return {
    id: `claims-${key}`,
    name: 'Claims',
    getVerseColor: () => null,
    colorsFor: (items) => items.map(() => null),
    urlParams: [{ key, kind: 'token' }],
    settingsFromUrl: (params) => params,
    settingsToUrl: () => ({}),
  };
}

describe('registerOverlay', () => {
  afterEach(() => clearOverlays());

  it.each(['search', 'mode', 'm'])("refuses an overlay that claims the search's %s", (key) => {
    expect(() => registerOverlay(claiming(key))).toThrow(key);
    expect(getOverlay(`claims-${key}`)).toBeUndefined();
  });

  it('takes an overlay whose keys are its own', () => {
    registerOverlay(claiming('category'));
    expect(getOverlay('claims-category')).toBeDefined();
  });
});
