// Every overlay spreads its catalog entry (e.g. `...COMMENTARY`) rather than
// restating its id, name, description or link keys, so this checks that
// spread stayed in sync.
import { describe, it, expect } from 'vitest';
import { registerAllOverlays, getAllOverlays } from '../../../overlays/index';
import { OVERLAYS } from '@torahmap/overlay-catalog';

registerAllOverlays();

describe('every overlay matches its catalog entry', () => {
  getAllOverlays().forEach((overlay, i) => {
    it(`${overlay.id}: carries its catalog entry, including the link keys it owns`, () => {
      expect(overlay).toMatchObject(OVERLAYS[i]);
    });
  });
});
