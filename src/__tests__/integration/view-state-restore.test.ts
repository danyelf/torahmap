import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseUrlState } from '../../urlState';
import { resolveViewState, cameraForView, type ViewState } from '../../viewState';
import {
  registerAllOverlays,
  getOverlay,
  configureCommentary,
  configureTrop,
  configureSearch,
} from '../../overlays/index';
import { SAMPLE_VERSES, SAMPLE_COMMENTARY_DATA, SAMPLE_VERSE_TEXTS } from '../helpers/fixtures';
import { mockFetch, mockHistory, mockWindowLocation, restoreAllMocks } from '../helpers/mocks';
import { overlayUrlParams } from '../helpers/overlayUrlParams';
import { createOverlaySettings } from '../../overlays/settings';

const DEFAULT_CAMERA = { x: -500, y: 40, zoom: 1 };

// The settings the app holds for each overlay, as main.ts holds them.
let settings = createOverlaySettings();

function viewFor(hash: string): ViewState {
  mockWindowLocation(`http://localhost:5173/${hash}`);
  return resolveViewState(
    parseUrlState(overlayUrlParams),
    DEFAULT_CAMERA,
    (id) => getOverlay(id) !== undefined,
  );
}

/** Where a view's settings leave an overlay's controls, drawn the way main.ts draws them. */
async function controlsAfter(hash: string): Promise<HTMLElement> {
  const view = viewFor(hash);
  const overlay = getOverlay(view.overlay);
  await overlay?.init?.();
  const container = document.createElement('div');
  if (overlay) {
    settings.restore(overlay, view.overlayParams);
    overlay.renderControls?.(container, settings.get(overlay), (update) =>
      settings.set(overlay, update(settings.get(overlay))),
    );
  }
  return container;
}

describe('restoring a link as one complete view', () => {
  beforeEach(() => {
    mockHistory('http://localhost:5173/');
    mockFetch({ '/data/overlays/commentary/counts.json': SAMPLE_COMMENTARY_DATA });
    registerAllOverlays();
    settings = createOverlaySettings();
    configureCommentary({ verses: SAMPLE_VERSES });
    configureTrop({ verseTexts: SAMPLE_VERSE_TEXTS });
    configureSearch({ verses: SAMPLE_VERSES, callbacks: { onVerseClick: vi.fn() } });
  });

  afterEach(() => {
    restoreAllMocks();
  });

  describe('which mode a link opens in', () => {
    it('opens a camera-only hash in Explore', () => {
      const view = viewFor('#zoom=3&x=0&y=0');

      expect(view.mode).toBe('explore');
      expect(view.camera).toEqual({ x: 0, y: 0, zoom: 3 });
    });

    it('opens an empty hash as the story, with Explore reset', () => {
      expect(viewFor('')).toEqual({
        mode: 'story',
        storyStop: null,
        overlay: 'none',
        overlayParams: {},
        verse: null,
        camera: DEFAULT_CAMERA,
      });
    });

    it('opens a hash naming a stop as the story at that stop', () => {
      const view = viewFor('#story=intro');

      expect(view.mode).toBe('story');
      expect(view.storyStop).toBe('intro');
    });
  });

  describe('fields the link leaves out', () => {
    it('holds no overlay and no verse when the link names neither', () => {
      const view = viewFor('#zoom=2');

      expect(view.overlay).toBe('none');
      expect(view.verse).toBeNull();
    });

    it('holds the default position when the link gives only a zoom', () => {
      expect(viewFor('#zoom=2').camera).toEqual({ ...DEFAULT_CAMERA, zoom: 2 });
    });

    it('holds no overlay for an overlay id nobody registered', () => {
      expect(viewFor('#overlay=nonexistent').overlay).toBe('none');
    });
  });

  it('centres the verse at the zoom the link asked for', () => {
    const view = viewFor('#verse=Genesis.1.1&zoom=8');
    const verse = SAMPLE_VERSES[0];
    const camera = cameraForView(view.camera, verse, { x: 500, y: 400 });

    const screenX = (verse.x + verse.size / 2 + camera.x) * camera.zoom;
    const screenY = (verse.y + verse.size / 2 + camera.y) * camera.zoom;
    expect(camera.zoom).toBe(8);
    expect(screenX).toBeCloseTo(500);
    expect(screenY).toBeCloseTo(400);
  });

  describe('controls drawn after the settings arrive', () => {
    it('shows Midrash in the commentary category dropdown', async () => {
      const controls = await controlsAfter('#overlay=commentary&category=Midrash');

      expect(controls.querySelector<HTMLSelectElement>('#category-select')?.value).toBe('Midrash');
    });

    it('returns the commentary dropdown to all links when the link names no category', async () => {
      await controlsAfter('#overlay=commentary&category=Midrash');
      const controls = await controlsAfter('#overlay=commentary');

      expect(controls.querySelector<HTMLSelectElement>('#category-select')?.value).toBe('total');
    });

    it('shows Sephardi in the haftarah custom dropdown', async () => {
      const controls = await controlsAfter('#overlay=haftarah&custom=sephardi');

      expect(controls.querySelector<HTMLSelectElement>('#custom-select')?.value).toBe('sephardi');
    });

    it('marks the trop button the link names', async () => {
      const controls = await controlsAfter('#overlay=trop&trop=tipcha');

      expect(controls.querySelector('button.selected')?.getAttribute('title')).toMatch(/^Tipcha/);
    });

    it('clears the trop selection when the link names no mark', async () => {
      await controlsAfter('#overlay=trop&trop=tipcha');
      const controls = await controlsAfter('#overlay=trop');

      expect(settings.toUrl(getOverlay('trop')!)).toEqual({});
      expect(controls.querySelector('button.selected')).toBeNull();
    });

    it('clears the search query when the link names none', async () => {
      await controlsAfter('#overlay=search&q=light');
      expect(settings.toUrl(getOverlay('search')!).q).toBe('light');

      await controlsAfter('#overlay=search');
      expect(settings.toUrl(getOverlay('search')!)).toEqual({});
    });
  });
});
