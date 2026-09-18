// Tanakh Map - Main entry point

declare const __GIT_BRANCH__: string;

import { computeLayout, getLayoutBounds } from './layout.ts';
import { createBookLabels, updateLabelPositions } from './labels.ts';
import { loadTanakhStructure, loadAllVerseTexts, getVerseText } from './verseTexts.ts';
import { buildSearchIndex, loadLexiconData } from './search.ts';
import { lookupForm } from './verseWords.ts';
import { meaningsInVerse, prefetchMorphology } from './search/dictionary.ts';
import { openWordMenu } from './wordMenu.ts';
import { initBookData } from './constants/books.ts';
import { initHelp } from './help.ts';
import { trackOverlaySwitch, trackVerseClick, trackZoomLevel } from './analytics.ts';
import {
  parseUrlState,
  parseVerseFromUrl,
  updateUrl,
  subscribeToHashChange,
  applyingExternalState,
  verseToUrlFormat,
  type UrlState,
} from './urlState.ts';
import { debounce } from './utils/debounce.ts';
import { getSidebarElements, updateSidebar, setWordClickHandler } from './sidebar.ts';
import {
  createCamera,
  clampZoom,
  panForZoom,
  panToCenter,
  viewCenteredOn,
  animateCameraTo,
} from './camera.ts';
import {
  createMouseState,
  startDrag,
  stopDrag,
  setHoveredVerse,
  clearHover,
} from './mouseState.ts';
import {
  createTouchState,
  trackTouch,
  releaseTouch,
  getPinchDistance,
  getPinchCenter,
  resetTouchState,
} from './touchState.ts';
import {
  tanakhIdentitiesEqual,
  findTanakhItem,
  nextTanakhItem,
  prevTanakhItem,
  tanakhKey,
} from './types.ts';
import { findItemAtPoint } from './hitDetection.ts';
import { computeItemStates, applyItemColors, overlayColorsFor } from './itemColoring.ts';
import {
  createRenderContext,
  createRenderState,
  rebuildGeometry,
  render as renderFrame,
} from './rendering.ts';
import type { TanakhLayout } from './types.ts';
import {
  registerAllOverlays,
  applyOverlayParams,
  getOverlay,
  getAllOverlays,
  configureCommentary,
  configureTrop,
  configureSearch,
  configureVerseLength,
  type Overlay,
  type Color,
} from './overlays/index.ts';
import { searchForMeaning, canAddTerm } from './overlays/search/index.ts';
import {
  ZOOM_OUT_FACTOR,
  ZOOM_IN_FACTOR,
  DEFAULT_ZOOM,
  URL_UPDATE_DEBOUNCE_MS,
} from './constants/app.ts';
import {
  loadStoryData,
  renderStoryPanel,
  computeStopOffsets,
  resolveStops,
} from './scrollytelling/storyPanel';
import { computeInterpolatedState } from './scrollytelling/controller';
import { computeBlendedColors } from './scrollytelling/overlayBlender';
import { switchToExplore, switchToStory } from './scrollytelling/modeSwitch';
import type { AppMode } from './scrollytelling/modeSwitch';
import type { ResolvedStoryStop } from './scrollytelling/types';
import './styles/zoom-buttons.css';
import './styles/right-panel.css';
import './styles/verse-popup.css';

declare global {
  interface Window {
    bookLabels?: HTMLDivElement;
  }
}

async function main(): Promise<void> {
  document.title = `Tanakh Map [${__GIT_BRANCH__}]`;

  const [torahData, verseTexts] = await Promise.all([
    loadTanakhStructure(),
    loadAllVerseTexts(),
    loadLexiconData(),
  ]);

  initBookData(torahData);
  const verses = computeLayout(torahData);
  const bounds = getLayoutBounds(verses);
  console.log(`Loaded ${verses.length} verses, bounds: ${bounds.width}x${bounds.height}`);

  buildSearchIndex(verseTexts);

  registerAllOverlays();
  configureCommentary({ verses });
  configureTrop({ verseTexts });
  configureVerseLength({ verseTexts });

  await Promise.all(getAllOverlays().map((o) => o.init?.()));

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas not found');
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas(): void {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  resizeCanvas();

  const renderContext = createRenderContext(canvas);
  const renderState = createRenderState(renderContext.gl, verses, dpr);

  let currentOverlay: Overlay | null = null;

  // The one colour layer on the map: either a settled overlay's colours or a
  // story transition's blend. Hover and pin never touch it — composite()
  // paints them on top each time, so a hover re-render never re-asks an
  // overlay for anything.
  let colorLayer: (Color | Color[] | null)[] = [];

  function composite(): void {
    const verseStates = computeItemStates(
      verses,
      colorLayer,
      mouseState.hoveredVerse,
      pinnedVerse,
      tanakhIdentitiesEqual,
    );
    const colors = applyItemColors(verseStates);

    rebuildGeometry(renderContext.gl, renderState, colors);
  }

  function setColorLayer(next: (Color | Color[] | null)[]): void {
    colorLayer = next;
    composite();
  }

  function applyOverlay(): void {
    setColorLayer(overlayColorsFor(currentOverlay, verses));
  }

  /**
   * Sync explore-mode state (overlay, params, pinned verse) to a story stop.
   * Does NOT paint the buffer — caller decides (settled paints via applyOverlay,
   * mid-scroll lets the blender paint). Pulled out of applyStoryStop so mid-scroll
   * can keep `currentOverlay`/`pinnedVerse` in sync with the stop the user is
   * heading toward; otherwise hover events fired during a transition would call
   * applyOverlay against a stale `currentOverlay` and clobber the blender's buffer.
   *
   * The stop is external state, like a link, so URL writes are off throughout:
   * in story mode the URL is the stop id, and the explore-mode URL that an
   * overlay's update handler would write has no business overwriting it.
   */
  function syncStoryStopState(stop: ResolvedStoryStop): void {
    applyingExternalState(() => syncStoryStopStateUnguarded(stop));
  }

  function syncStoryStopStateUnguarded(stop: ResolvedStoryStop): void {
    const wantedOverlay = stop.overlay ?? 'none';
    if (wantedOverlay !== currentOverlayId) {
      activateOverlay(wantedOverlay);
    }

    applyOverlayParams(currentOverlay, stop.overlayParams ?? {});

    // Sync pinnedVerse from stop (without going through pinVerse, which writes URL/telemetry)
    if (stop.verse) {
      const parsed = parseVerseFromUrl(stop.verse);
      if (parsed) {
        if (!tanakhIdentitiesEqual(pinnedVerse, parsed)) {
          const verse = findTanakhItem(verses, parsed);
          if (verse) {
            pinnedVerse = verse;
            updateSidebarWrapper(verse, true);
          }
        }
      }
    } else if (pinnedVerse) {
      pinnedVerse = null;
      updateSidebarWrapper(null);
    }
  }

  const camera = createCamera(window.innerWidth, window.innerHeight, bounds);

  let pinnedVerse: TanakhLayout | null = null;

  const mouseState = createMouseState();

  // A scroll fires no pointer event, so the mid-scroll branch needs the last
  // known cursor position to re-run hit detection as the camera moves under it.
  let lastPointerPosition: { x: number; y: number } | null = null;

  const touchState = createTouchState();

  let appMode: AppMode = 'story';
  let lastStoryScrollTop = 0;
  // Track the story stop whose explore-mode state (overlay, params, pinnedVerse)
  // is currently synced. Used to skip redundant resyncs every scroll frame.
  // Reset on mode switches (explore may have changed overlay/pin out from under us).
  let lastSyncedStopId: string | null = null;
  let pointerDownPos: { x: number; y: number; time: number } | null = null;
  const TAP_THRESHOLD = 10; // max px movement to count as tap
  const TAP_MAX_DURATION = 300; // max ms to count as tap

  function render(): void {
    renderFrame(
      renderContext,
      renderState,
      camera,
      mouseState.hoveredVerse,
      pinnedVerse,
      tanakhIdentitiesEqual,
    );
  }

  function centerOnVerse(verse: TanakhLayout): void {
    Object.assign(camera, panToCenter(verse, camera.zoom, window.innerWidth, window.innerHeight));
  }

  // A verse is one square six pixels across, so centring it while scaled out
  // moves the map and shows the reader nothing. Close enough to pick it out.
  const RESULT_CLICK_ZOOM = 2.5;

  let stopCameraGlide: (() => void) | null = null;

  /** Stop a glide in its tracks, for when the reader takes the map back. */
  function cancelCameraGlide(): void {
    stopCameraGlide?.();
    stopCameraGlide = null;
  }

  /**
   * Travel to a verse rather than cutting to it, so the reader keeps their
   * bearings and can see where on the map the hit lives.
   *
   * Zooming in only when already further out: a reader who has zoomed past 2.5
   * has said what they want to see, and being pulled back would undo it.
   */
  function glideToVerse(verse: TanakhLayout): void {
    cancelCameraGlide();

    const target = viewCenteredOn(
      verse,
      camera.zoom,
      RESULT_CLICK_ZOOM,
      window.innerWidth,
      window.innerHeight,
    );

    stopCameraGlide = animateCameraTo(camera, target, () => {
      render();
      debouncedSaveUrlState();
    });
  }

  function pinVerse(verse: TanakhLayout, centerCamera: boolean = false): void {
    trackVerseClick(verse.book, verse.chapter, verse.verse);
    pinnedVerse = verse;
    updateSidebarWrapper(verse, true);
    if (centerCamera) {
      centerOnVerse(verse);
    }
    applyOverlay();
    render();
    saveUrlState(true);
  }

  function unpinVerse(): void {
    pinnedVerse = null;
    updateSidebarWrapper(null);
    applyOverlay();
    render();
    saveUrlState(true);
  }

  /** Zoom by `factor`, holding whatever is under (screenX, screenY) still. */
  function zoomAt(factor: number, screenX: number, screenY: number): void {
    const newZoom = clampZoom(camera.zoom * factor);
    const pan = panForZoom({ x: camera.x, y: camera.y }, camera.zoom, newZoom, screenX, screenY);
    camera.x = pan.x;
    camera.y = pan.y;
    camera.zoom = newZoom;
    render();
  }

  render();

  const hebrewNames = Object.fromEntries(torahData.books.map((b) => [b.name, b.hebrewName]));
  window.bookLabels = createBookLabels(verses, document.body, hebrewNames);
  updateLabelPositions(window.bookLabels, { x: camera.x, y: camera.y }, camera.zoom);

  canvas.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      cancelCameraGlide();
      const zoomFactor = e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
      zoomAt(zoomFactor, e.clientX, e.clientY);
      debouncedSaveUrlState();
      debouncedTrackZoom();
    },
    { passive: false },
  );

  const debouncedTrackZoom = debounce(() => trackZoomLevel(camera.zoom), 1000);

  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');

  zoomInBtn?.addEventListener('click', () => {
    zoomAt(ZOOM_IN_FACTOR, canvas.clientWidth / 2, canvas.clientHeight / 2);
    debouncedSaveUrlState();
  });

  zoomOutBtn?.addEventListener('click', () => {
    zoomAt(ZOOM_OUT_FACTOR, canvas.clientWidth / 2, canvas.clientHeight / 2);
    debouncedSaveUrlState();
  });

  canvas.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      for (const touch of e.changedTouches) {
        trackTouch(touchState, touch.identifier, touch.clientX, touch.clientY);
      }
      if (touchState.activeTouches.size === 2) {
        touchState.lastPinchDistance = getPinchDistance(touchState);
      }
    },
    { passive: true },
  );

  canvas.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      for (const touch of e.changedTouches) {
        trackTouch(touchState, touch.identifier, touch.clientX, touch.clientY);
      }

      if (touchState.activeTouches.size >= 2) {
        const newDist = getPinchDistance(touchState);
        const center = getPinchCenter(touchState);
        if (newDist && center && touchState.lastPinchDistance) {
          const scale = newDist / touchState.lastPinchDistance;
          zoomAt(scale, center.x, center.y);
        }
        touchState.lastPinchDistance = newDist;
      }
    },
    { passive: true },
  );

  canvas.addEventListener('touchend', (e: TouchEvent) => {
    for (const touch of e.changedTouches) {
      releaseTouch(touchState, touch.identifier);
    }
    if (touchState.activeTouches.size === 0) {
      debouncedSaveUrlState();
    }
  });

  canvas.addEventListener('touchcancel', () => {
    resetTouchState(touchState);
  });

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    // A hand on the map outranks a glide that is still running.
    cancelCameraGlide();
    startDrag(mouseState, e.clientX, e.clientY);
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(e.pointerId);
    pointerDownPos = { x: e.clientX, y: e.clientY, time: Date.now() };
  });

  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (mouseState.isDragging && touchState.activeTouches.size < 2) {
      const dx = e.clientX - mouseState.dragStart.x;
      const dy = e.clientY - mouseState.dragStart.y;
      camera.x += dx / camera.zoom;
      camera.y += dy / camera.zoom;
      mouseState.dragStart = { x: e.clientX, y: e.clientY };
      render();
    }
  });

  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    const wasDragging = mouseState.isDragging;
    if (wasDragging) {
      stopDrag(mouseState);
      debouncedSaveUrlState();
    }

    if (pointerDownPos) {
      const dx = Math.abs(e.clientX - pointerDownPos.x);
      const dy = Math.abs(e.clientY - pointerDownPos.y);
      const duration = Date.now() - pointerDownPos.time;

      if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD && duration < TAP_MAX_DURATION) {
        const verse = findItemAtPoint(verses, camera, e.clientX, e.clientY);
        if (verse) {
          if (pinnedVerse && tanakhIdentitiesEqual(pinnedVerse, verse)) {
            unpinVerse();
          } else {
            pinVerse(verse);
          }
        } else if (pinnedVerse) {
          unpinVerse();
        }
      }
      pointerDownPos = null;
    }

    if (wasDragging) {
      const verse = findItemAtPoint(verses, camera, e.clientX, e.clientY);
      if (pinnedVerse && verse) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
    }
  });

  canvas.addEventListener('pointerleave', () => {
    const wasHovering = mouseState.hoveredVerse !== null;
    clearHover(mouseState);
    lastPointerPosition = null;
    canvas.style.cursor = 'default';

    let overlayWantsRerender = false;
    if (currentOverlay?.setHoveredVerse) {
      overlayWantsRerender = currentOverlay.setHoveredVerse(null);
    }

    if (overlayWantsRerender) {
      // Haftarah's own colours depend on hover, so the layer itself is stale.
      setColorLayer(overlayColorsFor(currentOverlay, verses));
      render();
    } else if (wasHovering) {
      composite();
      render();
    }
  });

  const sidebarElements = getSidebarElements();

  function buildOverlayParamsForUrl(): Record<string, string> {
    return currentOverlay?.getUrlParams?.() ?? {};
  }

  function buildCurrentUrlState(): UrlState {
    const state: UrlState = {
      overlayParams: {},
    };

    if (currentOverlay) {
      state.overlay = currentOverlay.id;
      state.overlayParams = buildOverlayParamsForUrl();
    }

    if (pinnedVerse) {
      state.verse = verseToUrlFormat(pinnedVerse.book, pinnedVerse.chapter, pinnedVerse.verse);
    }

    if (camera.zoom !== DEFAULT_ZOOM) {
      state.zoom = camera.zoom;
    }

    // Pan (only if no verse - verse auto-centers)
    if (!pinnedVerse) {
      state.x = camera.x;
      state.y = camera.y;
    }

    return state;
  }

  function saveUrlState(pushHistory: boolean = false): void {
    const state = buildCurrentUrlState();
    updateUrl(state, pushHistory);
  }

  const debouncedSaveUrlState = debounce(() => saveUrlState(false), URL_UPDATE_DEBOUNCE_MS);

  function updateSidebarWrapper(verse: TanakhLayout | null, isPinned: boolean = false): void {
    updateSidebar(sidebarElements, verse, verseTexts, currentOverlay, getVerseText, isPinned);
  }

  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerType === 'touch' || touchState.activeTouches.size >= 2) return;

    if (!mouseState.isDragging) {
      lastPointerPosition = { x: e.clientX, y: e.clientY };
      const verse = findItemAtPoint(verses, camera, e.clientX, e.clientY);
      const previousHover = mouseState.hoveredVerse;
      setHoveredVerse(mouseState, verse);

      const hoverChanged = !tanakhIdentitiesEqual(previousHover, verse);

      if (pinnedVerse && verse) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }

      let overlayWantsRerender = false;
      if (currentOverlay?.setHoveredVerse) {
        overlayWantsRerender = currentOverlay.setHoveredVerse(verse);
      }

      if (overlayWantsRerender) {
        // Haftarah's own colours depend on hover, so the layer itself is stale.
        setColorLayer(overlayColorsFor(currentOverlay, verses));
        render();
      } else if (hoverChanged) {
        composite();
        render();
      }

      if (pinnedVerse) {
        // Keep showing pinned verse
      } else if (verse) {
        updateSidebarWrapper(verse, false);
      } else {
        updateSidebarWrapper(null);
      }
    }
  });

  sidebarElements.closeBtn?.addEventListener('click', () => {
    unpinVerse();
  });

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!pinnedVerse) return;

    if (e.key === 'Escape') {
      unpinVerse();
      return;
    }

    let targetVerse: TanakhLayout | null = null;

    if (e.key === 'ArrowRight') {
      targetVerse = nextTanakhItem(verses, pinnedVerse);
    } else if (e.key === 'ArrowLeft') {
      targetVerse = prevTanakhItem(verses, pinnedVerse);
    }

    if (targetVerse) {
      pinVerse(targetVerse, true);
    }
  });

  const overlaySelect = document.getElementById('overlay-select') as HTMLSelectElement;

  // Fill the overlay menu from the registry, after the "None" option the page
  // starts with. The registry is the only list of overlays; the menu follows it,
  // so adding an overlay to overlays/index.ts is enough to make it choosable.
  for (const overlay of getAllOverlays()) {
    const option = document.createElement('option');
    option.value = overlay.id;
    option.textContent = overlay.name;
    overlaySelect?.appendChild(option);
  }

  const overlayControlsContainer = document.getElementById('overlay-controls');
  const overlayLegendContainer = document.getElementById('overlay-legend');

  let currentOverlayId = 'none';

  /**
   * Internal: switch the active overlay without painting/rendering or writing URL.
   * Used by both setOverlay (with side effects) and applyStoryStop (without).
   */
  function activateOverlay(id: string): void {
    currentOverlayId = id;
    currentOverlay?.destroy?.();
    currentOverlay = getOverlay(id) ?? null;

    currentOverlay?.onUpdate?.(() => {
      applyOverlay();
      if (overlayLegendContainer) {
        overlayLegendContainer.innerHTML = '';
        currentOverlay?.renderLegend?.(overlayLegendContainer);
      }
      render();
      // Save URL state when overlay params change (replaceState).
      // No guard needed here: applyingExternalState() turns URL writes off
      // around every restore and every story stop, so an overlay announcing a
      // change it was just handed cannot write it back.
      saveUrlState(false);
    });

    if (overlayControlsContainer) {
      overlayControlsContainer.innerHTML = '';
      currentOverlay?.renderControls?.(overlayControlsContainer);
    }
    if (overlayLegendContainer) {
      overlayLegendContainer.innerHTML = '';
      currentOverlay?.renderLegend?.(overlayLegendContainer);
    }
  }

  function setOverlay(id: string, opts: { fromUrlRestore?: boolean } = {}): void {
    const { fromUrlRestore = false } = opts;
    if (!fromUrlRestore) {
      trackOverlaySwitch(id, currentOverlayId);
    }

    activateOverlay(id);

    applyOverlay();
    render();

    if (!fromUrlRestore) {
      saveUrlState(true);
    }
  }

  // Clicking a word in the verse popup.
  //
  // The panel is what makes this safe: switching to search destroys whichever
  // overlay is showing, and a click on a word is too ordinary a gesture to be
  // allowed to do that on its own.
  setWordClickHandler((click) => {
    const word = lookupForm(click.text);
    const meanings = meaningsInVerse(
      word,
      tanakhKey(click.book, click.chapter, click.verse),
      click.index,
    );

    openWordMenu({
      word: click.text,
      meanings,
      anchor: click.element,
      paletteFull: !canAddTerm(),
      onChoose: (meaning) => {
        // Ask before anything is spent. setOverlay() destroys the outgoing
        // overlay and its settings, so a search that is going to be refused
        // must be refused first - otherwise the reader loses their Haftarah
        // view and gains nothing. The panel's own count was taken when it
        // opened, and a keyboard reader can add a word in between.
        if (!canAddTerm()) return;

        if (currentOverlayId !== 'search') {
          setOverlay('search');
          if (overlaySelect) overlaySelect.value = 'search';
        }

        // No repaint here, and no second history entry: running the search
        // announces itself through the overlay's update callback, which paints
        // the map and writes the URL over whatever setOverlay just pushed.
        searchForMeaning(word, meaning?.keys ?? null);
      },
    });
  });

  overlaySelect?.addEventListener('change', () => {
    setOverlay(overlaySelect.value);
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
    render();
  });

  // Capture mode: Ctrl+Shift+C copies current camera state as a story stop comment
  if (import.meta.hot) {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        const x = Math.round(camera.x * 100) / 100;
        const y = Math.round(camera.y * 100) / 100;
        const zoom = Math.round(camera.zoom * 100) / 100;

        let extraParts = '';
        if (currentOverlay) {
          extraParts += ` | overlay: ${currentOverlay.id}`;
          const params = currentOverlay.getUrlParams?.();
          if (params) {
            for (const [key, value] of Object.entries(params)) {
              extraParts += ` | ${key}: ${value}`;
            }
          }
        }
        if (pinnedVerse) {
          const book = pinnedVerse.book.replace(/ /g, '.');
          extraParts += ` | verse: ${book}.${pinnedVerse.chapter}.${pinnedVerse.verse}`;
        }

        const comment = `<!-- stop: STOP_ID | camera: ${x},${y},${zoom}${extraParts} -->`;
        navigator.clipboard.writeText(comment);
        console.log(`[capture] Copied to clipboard:\n${comment}`);
      }
    });
  }

  configureSearch({
    verses,
    callbacks: {
      // Most hits are off screen, so travel to the verse as well as pinning it.
      onVerseClick: (verse: TanakhLayout) => {
        pinVerse(verse);
        glideToVerse(verse);
      },
    },
  });

  const rightPanel = document.getElementById('right-panel');
  if (rightPanel) {
    initHelp(rightPanel);
  }

  const initialCamera = { x: camera.x, y: camera.y, zoom: camera.zoom };
  const storyContent = document.getElementById('story-content')!;

  let storyData = await loadStoryData();
  let resolvedStops = resolveStops(
    storyData.stops,
    initialCamera,
    verses,
    canvas.clientWidth,
    canvas.clientHeight,
  );
  let stopElements = renderStoryPanel(storyContent, storyData.stops);

  async function reloadStory(): Promise<void> {
    const scrollTop = storyContent.scrollTop;
    storyData = await loadStoryData();
    resolvedStops = resolveStops(
      storyData.stops,
      initialCamera,
      verses,
      canvas.clientWidth,
      canvas.clientHeight,
    );
    stopElements = renderStoryPanel(storyContent, storyData.stops);
    storyContent.scrollTop = scrollTop;
    // Force re-apply: stops may have changed (overlay/params/verse), and stop
    // object identities are fresh after re-resolving.
    lastSyncedStopId = null;
    storyContent.dispatchEvent(new Event('scroll'));
  }

  if (import.meta.hot) {
    import.meta.hot.on('story-update', () => {
      reloadStory();
    });
  }

  const storyPanel = document.getElementById('story-panel')!;
  const explorePanel = document.getElementById('explore-panel')!;

  document.getElementById('exit-story')?.addEventListener('click', () => {
    lastStoryScrollTop = storyContent.scrollTop;
    appMode = 'explore';
    switchToExplore(storyPanel, explorePanel);
    // Update URL to explore mode (remove story param)
    saveUrlState(true);
  });

  document.getElementById('back-to-story')?.addEventListener('click', (e) => {
    e.preventDefault();
    appMode = 'story';
    // Reset settled tracker — explore mode may have changed overlay/pin, so
    // force the next settled frame to re-apply the resting stop's state.
    lastSyncedStopId = null;
    switchToStory(storyPanel, explorePanel, storyContent, lastStoryScrollTop);
    storyContent.dispatchEvent(new Event('scroll'));
  });

  let scrollRAF: number | null = null;
  storyContent.addEventListener('scroll', () => {
    if (appMode !== 'story') return;
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => {
      scrollRAF = null;
      const offsets = computeStopOffsets(stopElements);
      const heights = stopElements.map((el) => el.offsetHeight);
      const totalHeight = storyContent.scrollHeight;
      const state = computeInterpolatedState(
        resolvedStops,
        offsets,
        totalHeight,
        storyContent.scrollTop,
        storyData.defaults?.easing ?? 'ease-in-out',
        heights,
        storyContent.clientHeight,
      );

      camera.x = state.camera.x;
      camera.y = state.camera.y;
      camera.zoom = state.camera.zoom;

      const settled = state.fromStop === state.toStop;
      // Pick the stop whose state should be "current" — settled stop, or the
      // dominant transitioning stop. Sync explore state to it on every change
      // so hover events mid-scroll find a consistent currentOverlay/pinnedVerse.
      const dominantStop = settled ? state.fromStop : state.t > 0.5 ? state.toStop : state.fromStop;
      if (lastSyncedStopId !== dominantStop.id) {
        syncStoryStopState(dominantStop);
        lastSyncedStopId = dominantStop.id;
      }

      if (settled) {
        // At rest: paint via the explore-mode color pipeline.
        applyOverlay();
      } else {
        // A scroll fires no pointer event, so re-run hit detection under the
        // last known cursor position now that the camera has moved.
        if (lastPointerPosition) {
          setHoveredVerse(
            mouseState,
            findItemAtPoint(verses, camera, lastPointerPosition.x, lastPointerPosition.y),
          );
        }
        // Mid-scroll: the blender's interpolated colors become the layer, so a
        // hover mid-transition composites on top of them like any other frame.
        setColorLayer(
          computeBlendedColors(
            state.fromStop,
            state.toStop,
            state.t,
            verses,
            mouseState.hoveredVerse,
          ),
        );
      }
      render();
      updateUrl({ story: dominantStop.id, overlayParams: {} }, false);
    });
  });

  window.addEventListener('resize', () => {
    if (appMode === 'story') {
      storyContent.dispatchEvent(new Event('scroll'));
    }
  });

  function restoreOverlayFromUrl(urlState: UrlState): void {
    if (!urlState.overlay) return;

    setOverlay(urlState.overlay, { fromUrlRestore: true });
    if (overlaySelect) {
      overlaySelect.value = urlState.overlay;
    }

    // Hand the overlay back its own settings, already validated.
    //
    // activateOverlay drew the legend before this point, while the overlay was
    // still on its defaults, so it has to be redrawn once the settings land.
    // (Controls are left alone: each overlay updates its own inside
    // applyUrlParams, and redrawing them here would throw away what it just
    // put there.)
    if (currentOverlay?.applyUrlParams) {
      applyOverlayParams(currentOverlay, urlState.overlayParams);
      if (overlayLegendContainer) {
        overlayLegendContainer.innerHTML = '';
        currentOverlay.renderLegend?.(overlayLegendContainer);
      }
    }
  }

  function restoreVerseFromUrl(urlState: UrlState): boolean {
    if (!urlState.verse) return false;

    const parsed = parseVerseFromUrl(urlState.verse);
    if (!parsed) return false;

    const verse = findTanakhItem(verses, parsed);
    if (!verse) return false;

    // Pin without saveUrlState since we're restoring FROM the URL
    pinnedVerse = verse;
    updateSidebarWrapper(verse, true);
    centerOnVerse(verse);
    return true;
  }

  function restoreCameraFromUrl(urlState: UrlState, hasVerse: boolean): void {
    if (urlState.zoom !== undefined) {
      camera.zoom = urlState.zoom;
    }

    if (!hasVerse && urlState.x !== undefined && urlState.y !== undefined) {
      camera.x = urlState.x;
      camera.y = urlState.y;
    }
  }

  // Everything this does came out of the URL, so nothing it does may write to
  // the URL — see applyingExternalState in urlState.ts.
  function restoreFromUrl(): void {
    applyingExternalState(restoreFromUrlUnguarded);
  }

  function restoreFromUrlUnguarded(): void {
    const urlState = parseUrlState((id) => getOverlay(id)?.urlParams);

    if (urlState.story) {
      appMode = 'story';
      // Force the next settled scroll frame to apply the stop's state.
      lastSyncedStopId = null;
      switchToStory(storyPanel, explorePanel, storyContent, 0);
      const stopIndex = resolvedStops.findIndex((s) => s.id === urlState.story);
      if (stopIndex >= 0 && stopElements[stopIndex]) {
        stopElements[stopIndex].scrollIntoView();
      }
      return;
    }

    if (urlState.overlay || urlState.verse) {
      appMode = 'explore';
      switchToExplore(storyPanel, explorePanel);
    }

    restoreOverlayFromUrl(urlState);
    const hasVerse = restoreVerseFromUrl(urlState);
    restoreCameraFromUrl(urlState, hasVerse);

    applyOverlay();
    render();
  }

  if (window.location.hash) {
    restoreFromUrl();
  }

  subscribeToHashChange(() => {
    restoreFromUrl();
  });

  if (appMode === 'story') {
    storyContent.dispatchEvent(new Event('scroll'));
  }

  prefetchMorphology();
}

main().catch(console.error);
