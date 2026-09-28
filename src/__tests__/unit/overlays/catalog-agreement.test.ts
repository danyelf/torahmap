// Every overlay spreads its catalog entry (e.g. `...COMMENTARY`) rather than
// restating its id, name, description or link keys, so this checks that
// spread stayed in sync.
import { describe, it, expect } from 'vitest';
import { registerAllOverlays, getAllOverlays } from '../../../overlays/index';
import { overlayParamSpecs, OVERLAYS } from '@torahmap/overlay-catalog';

registerAllOverlays();

describe('every overlay matches its catalog entry', () => {
  it('registers the catalog overlays, in its order', () => {
    expect(getAllOverlays().map((o) => o.id)).toEqual(OVERLAYS.map((e) => e.id));
  });

  getAllOverlays().forEach((overlay, i) => {
    it(`${overlay.id}: carries its catalog entry, including the link keys it owns`, () => {
      expect(overlay).toMatchObject(OVERLAYS[i]);
      expect(overlay.urlParams).toBe(overlayParamSpecs(overlay.id));
    });
  });
});
