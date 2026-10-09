import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseUrlState } from '../../urlState';
import { resolveViewState, cameraForView, opensFolded, type ViewState } from '../../viewState';
import { worldToScreen } from '../helpers/worldToScreen';
import { registerAllOverlays, getOverlay } from '../../overlays/index';
import { configure as configureSearch } from '../../tanakh/search/index';
import { SAMPLE_VERSES, SAMPLE_LOADED } from '../helpers/fixtures';
import { dataFor } from '../../dataFiles';
import { mockHistory, mockWindowLocation, restoreAllMocks } from '../helpers/mocks';
import { LINK_KEYS } from '@torahmap/overlay-catalog';
import { readLink, writeLink } from '@torahmap/link';
import { indexItems } from '../../items';
import { createOverlaySettings } from '../../overlays/settings';
import { searchTool } from '../../tanakh/search/index';

const DEFAULT_CAMERA = { x: -500, y: 40, zoom: 1 };

// The settings the app holds for each overlay, as main.ts holds them.
let settings = createOverlaySettings();

function viewFor(link: string): ViewState {
  mockWindowLocation(`http://localhost:5173/${link}`);
  return resolveViewState(
    parseUrlState(LINK_KEYS),
    DEFAULT_CAMERA,
    (id) => getOverlay(id) !== undefined,
  );
}

/** Where a view's settings leave an overlay's controls, drawn the way main.ts draws them. */
function controlsAfter(link: string): HTMLElement {
  const view = viewFor(link);
  const overlay = getOverlay(view.overlay);
  const container = document.createElement('div');
  if (overlay) {
    settings.restore(overlay, view.overlayParams);
    overlay.renderControls?.(
      container,
      settings.get(overlay),
      (update) => settings.set(overlay, update(settings.get(overlay))),
      dataFor(overlay, SAMPLE_LOADED),
    );
  }
  return container;
}

describe('restoring a link as one complete view', () => {
  beforeEach(() => {
    mockHistory('http://localhost:5173/');
    registerAllOverlays();
    settings = createOverlaySettings();
    configureSearch({ verses: SAMPLE_VERSES, callbacks: { onVerseClick: vi.fn() } });
  });

  afterEach(() => {
    restoreAllMocks();
  });

  describe('which mode a link opens in', () => {
    it('opens an old search link with no search and no overlay', () => {
      const view = viewFor('?overlay=search&q=light');
      expect(view.mode).toBe('explore');
      expect(view.overlay).toBe('none');
      expect(view.searchParams).toEqual({});
    });

    it('opens a link that only searches in Explore, with its search', () => {
      const view = viewFor('?search=light');
      expect(view.mode).toBe('explore');
      expect(view.overlay).toBe('none');
      expect(view.searchParams).toEqual({ search: 'light' });
    });

    it('keeps the search whatever overlay the link names', () => {
      expect(viewFor('?search=light&overlay=trop').searchParams).toEqual({ search: 'light' });
    });

    it('opens a camera-only link in Explore', () => {
      const view = viewFor('?zoom=3&x=0&y=0');

      expect(view.mode).toBe('explore');
      expect(view.camera).toEqual({ x: 0, y: 0, zoom: 3 });
    });

    it('opens an empty link as the story, with Explore reset', () => {
      expect(viewFor('')).toEqual({
        mode: 'story',
        story: null,
        stop: null,
        overlay: 'none',
        overlayParams: {},
        searchParams: {},
        verse: null,
        camera: DEFAULT_CAMERA,
      });
    });

    it('opens a link naming a story and stop as that story at that stop', () => {
      const view = viewFor('?story=tour&stop=intro');

      expect(view.mode).toBe('story');
      expect(view.story).toBe('tour');
      expect(view.stop).toBe('intro');
    });

    it('opens an old single-story link as a story, naming no stop', () => {
      const view = viewFor('?story=abraham_call');

      expect(view.mode).toBe('story');
      expect(view.story).toBe('abraham_call');
      expect(view.stop).toBeNull();
    });

    it('opens a stop without a story as the story, at that stop', () => {
      const view = viewFor('?stop=abraham_zoom');

      expect(view.mode).toBe('story');
      expect(view.story).toBeNull();
      expect(view.stop).toBe('abraham_zoom');
    });

    it('opens a stop link by its stop alone, as writeLink writes it', () => {
      expect(viewFor('?stop=abraham_zoom&verse=Genesis.1.1&overlay=trop&zoom=3')).toEqual(
        viewFor('?stop=abraham_zoom'),
      );
    });
  });

  describe('fields the link leaves out', () => {
    it('holds no overlay and no verse when the link names neither', () => {
      const view = viewFor('?zoom=2');

      expect(view.overlay).toBe('none');
      expect(view.verse).toBeNull();
    });

    it('carries the linked verse as the id it names', () => {
      expect(viewFor('?verse=I.Samuel.1.5').verse).toBe('I.Samuel.1.5');
    });

    it('pins a verse through a written link and back', () => {
      const square = SAMPLE_VERSES[3];
      const view = viewFor(writeLink({ square: square.id, overlayParams: {} }, LINK_KEYS));
      expect(indexItems(SAMPLE_VERSES).find(view.verse ?? '')).toBe(square);
    });

    it('pins nothing for a verse the map does not hold, and keeps the camera', () => {
      for (const ref of ['Genesis.01.1', 'genesis.1.1', 'Genesis.1.999']) {
        const view = viewFor(`?verse=${ref}&zoom=3`);
        expect(indexItems(SAMPLE_VERSES).find(view.verse ?? '')).toBeNull();
        expect(view.camera.zoom).toBe(3);
      }
    });

    it('holds the default position when the link gives only a zoom', () => {
      expect(viewFor('?zoom=2').camera).toEqual({ ...DEFAULT_CAMERA, zoom: 2 });
    });

    it('holds no overlay for an overlay id nobody registered', () => {
      expect(viewFor('?overlay=nonexistent').overlay).toBe('none');
    });
  });

  it('centres the verse at the zoom the link asked for', () => {
    const view = viewFor('?verse=Genesis.1.1&zoom=8');
    const verse = SAMPLE_VERSES[0];
    const viewport = { width: 1000, height: 800 };
    const camera = cameraForView(view.camera, verse, { x: 500, y: 300 }, viewport);

    const middle = { x: verse.x + verse.size / 2, y: verse.y + verse.size / 2 };
    const screen = worldToScreen(middle, camera, viewport);
    expect(camera.zoom).toBe(8);
    expect(screen.x).toBeCloseTo(500);
    expect(screen.y).toBeCloseTo(300);
  });

  describe('controls drawn after the settings arrive', () => {
    it('shows Midrash in the commentary category dropdown', () => {
      const controls = controlsAfter('?overlay=commentary&category=Midrash');

      expect(controls.querySelector<HTMLSelectElement>('#category-select')?.value).toBe('Midrash');
    });

    it('returns the commentary dropdown to all links when the link names no category', () => {
      controlsAfter('?overlay=commentary&category=Midrash');
      const controls = controlsAfter('?overlay=commentary');

      expect(controls.querySelector<HTMLSelectElement>('#category-select')?.value).toBe('total');
    });

    it('shows Sephardi in the haftarah custom dropdown', () => {
      const controls = controlsAfter('?overlay=haftarah&custom=sephardi');

      expect(controls.querySelector<HTMLSelectElement>('#custom-select')?.value).toBe('sephardi');
    });

    it('marks the trop button the link names', () => {
      const controls = controlsAfter('?overlay=trop&trop=tipcha');

      expect(controls.querySelector('button.selected')?.getAttribute('title')).toMatch(/^Tipcha/);
    });

    it('clears the trop selection when the link names no mark', () => {
      controlsAfter('?overlay=trop&trop=tipcha');
      const controls = controlsAfter('?overlay=trop');

      expect(settings.toUrl(getOverlay('trop')!)).toEqual({});
      expect(controls.querySelector('button.selected')).toBeNull();
    });

    it('clears the search when the link names none', () => {
      settings.restore(searchTool, viewFor('?search=light').searchParams);
      expect(settings.toUrl(searchTool).search).toBe('light');

      settings.restore(searchTool, viewFor('?overlay=trop').searchParams);
      expect(settings.toUrl(searchTool)).toEqual({});
    });
  });
});

describe('a returning reader', () => {
  it('opens folded for a view or for no link', () => {
    expect(opensFolded(readLink('?verse=Genesis.1.1', LINK_KEYS), true)).toBe(true);
    expect(opensFolded(readLink('', LINK_KEYS), true)).toBe(true);
  });

  it('opens unfolded for a stop link, with or without its story', () => {
    expect(opensFolded(readLink('?story=tour&stop=abraham_zoom', LINK_KEYS), true)).toBe(false);
    expect(opensFolded(readLink('?stop=abraham_zoom', LINK_KEYS), true)).toBe(false);
  });

  it('opens unfolded when the story was never folded', () => {
    expect(opensFolded(readLink('?verse=Genesis.1.1', LINK_KEYS), false)).toBe(false);
  });
});
