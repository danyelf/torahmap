// Every overlay spreads its catalog entry (e.g. `...COMMENTARY`) rather than
// restating its id, name, description or link keys, so this checks that
// spread stayed in sync — including text-dating, which is not registered.
import { describe, it, expect } from 'vitest';
import { registerAllOverlays, getAllOverlays } from '../../../overlays/index';
import { textDatingOverlay } from '../../../overlays/text-dating';
import type { Overlay } from '../../../overlays/types';
import {
  overlayParamSpecs,
  COMMENTARY,
  TROP,
  HAFTARAH,
  VERSE_LENGTH,
  TEXT_DATING,
  type OverlayEntry,
} from '@torahmap/overlay-catalog';

registerAllOverlays();

const CATALOG_ENTRY: Record<string, OverlayEntry> = {
  commentary: COMMENTARY,
  trop: TROP,
  haftarah: HAFTARAH,
  'verse-length': VERSE_LENGTH,
  'text-dating': TEXT_DATING,
};

const overlays: Overlay[] = [...getAllOverlays(), textDatingOverlay];

describe('every overlay matches its catalog entry', () => {
  overlays.forEach((overlay) => {
    it(`${overlay.id}: carries its catalog entry, including the link keys it owns`, () => {
      const entry = CATALOG_ENTRY[overlay.id];
      expect(entry, `no catalog entry for ${overlay.id}`).toBeDefined();
      expect(overlay).toMatchObject(entry);
      expect(overlay.urlParams).toBe(overlayParamSpecs(overlay.id));
    });
  });
});
