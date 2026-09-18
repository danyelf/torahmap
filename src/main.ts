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
import { computeItemStates, applyItemColors } from './itemColoring.ts';
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
import { colorsForStop, computeBlendedColors } from './scrollytelling/overlayBlender';
import { blendColorArrays } from './scrollytelling/colorBlending';
import { easingFunctions, lerpCamera } from './scrollytelling/interpolation';
import {
  STORY_DRIVING,
  readerAsStop,
  readerTakesOver,
  rejoinNow,
  rejoinProgress,
  settle,
  storyScrolled,
  type Driver,
} from './scrollytelling/driver';
import type { CameraPosition, InterpolatedState, ResolvedStoryStop } from './scrollytelling/types';
import { drawnColors, summaryHtml } from './panelSummary.ts';
import './styles/zoom-buttons.css';
import './styles/right-panel.css';
import './styles/verse-popup.css';

declare global {
  interface Window {
    bookLabels?: HTMLDivElement;
  }
}

const STORY_FOLDED_KEY = 'torahMap.storyFolded';

function storyWasFolded(): boolean {
  try {
    return localStorage.getItem(STORY_FOLDED_KEY) === 'true';
  } catch {
    return false;
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

  function applyOverlay(): void {
    const verseStates = computeItemStates(
      verses,
      currentOverlay,
      mouseState.hoveredVerse,
      pinnedVerse,
      tanakhIdentitiesEqual,
    );
    const colors = applyItemColors(verseStates);

    rebuildGeometry(renderContext.gl, renderState, colors);
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
      // So the controls show what the map shows when the reader opens them.
      if (overlaySelect) overlaySelect.value = wantedOverlay;
    }

    applyOverlayParams(currentOverlay, stop.overlayParams ?? {});
    updateSummary();

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

  const touchState = createTouchState();

  const storyContent = document.getElementById('story-content')!;

  const panelControls = document.getElementById('panel-controls')!;
  const controlsToggle = document.getElementById('controls-toggle')!;
  const controlsSummary = document.getElementById('controls-summary')!;
  const storyStrip = document.getElementById('story-strip')!;
  const storyStripTitle = document.getElementById('story-strip-title')!;

  // The panel is an accordion: the story open and the controls folded to one
  // line, or the controls open and the story folded to its title. With the
  // story folded nothing moves the map but the reader.
  let storyOpen = true;

  function setStoryOpen(open: boolean): void {
    if (!open) storyStripTitle.textContent = currentStopTitle();
    storyOpen = open;
    document.body.classList.toggle('story-folded', !open);
    controlsToggle.setAttribute('aria-expanded', String(!open));
    storyStrip.setAttribute('aria-expanded', String(open));
    panelControls.inert = open;
    storyContent.inert = !open;
  }

  setStoryOpen(true);

  function currentStopTitle(): string {
    const state = currentStoryState();
    return (state.t > 0.5 ? state.toStop : state.fromStop).title;
  }

  function updateSummary(): void {
    controlsSummary.innerHTML = summaryHtml(
      currentOverlayId,
      currentOverlay?.name,
      currentOverlay?.getUrlParams?.() ?? {},
      // Search's term rows; its results list draws coloured dots too.
      drawnColors(overlayControlsContainer, '.term-swatch'),
      drawnColors(overlayLegendContainer),
    );
  }

  let driver: Driver = STORY_DRIVING;

  // Both ends of an ease-back, captured when it starts, so each frame blends
  // two arrays instead of re-running the overlays' colouring.
  let rejoin: {
    fromCamera: CameraPosition;
    fromColors: (Color | Color[])[];
    toColors: (Color | Color[])[];
  } | null = null;

  /** Anything the reader does that changes what the map shows hands them the map. */
  function takeOver(): void {
    if (!storyOpen || driver.by === 'reader') return;
    driver = readerTakesOver(storyContent.scrollTop);
    rejoin = null;
    saveUrlState(true);
  }

  // Track the story stop whose explore-mode state (overlay, params, pinnedVerse)
  // is currently synced. Used to skip redundant resyncs every scroll frame.
  // Reset whenever the story comes back, since the reader may have changed the
  // overlay or pin out from under it.
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

  // pinVerse, unpinVerse and zoomAt answer only the reader's gestures; the story
  // sets the view directly. So each takes the wheel.
  function pinVerse(verse: TanakhLayout, centerCamera: boolean = false): void {
    takeOver();
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
    takeOver();
    pinnedVerse = null;
    updateSidebarWrapper(null);
    applyOverlay();
    render();
    saveUrlState(true);
  }

  /** Zoom by `factor`, holding whatever is under (screenX, screenY) still. */
  function zoomAt(factor: number, screenX: number, screenY: number): void {
    takeOver();
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
      if (dx !== 0 || dy !== 0) takeOver();
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
    canvas.style.cursor = 'default';

    let overlayWantsRerender = false;
    if (currentOverlay?.setHoveredVerse) {
      overlayWantsRerender = currentOverlay.setHoveredVerse(null);
    }

    if (wasHovering || overlayWantsRerender) {
      applyOverlay();
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

      if (hoverChanged || overlayWantsRerender) {
        applyOverlay();
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
      updateSummary();
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
    updateSummary();
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

        takeOver();
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

  const panelFooter = document.getElementById('panel-footer');
  if (panelFooter) initHelp(panelFooter);

  const initialCamera = { x: camera.x, y: camera.y, zoom: camera.zoom };

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
    scheduleStoryFrame();
  }

  if (import.meta.hot) {
    import.meta.hot.on('story-update', () => {
      reloadStory();
    });
  }

  // Remembered only when the reader opens or closes a section themselves, not
  // when a shared link opens with the story folded.
  function rememberStoryFolded(folded: boolean): void {
    try {
      if (folded) localStorage.setItem(STORY_FOLDED_KEY, 'true');
      else localStorage.removeItem(STORY_FOLDED_KEY);
    } catch {
      // Storage can be unavailable; the story simply opens next time.
    }
  }

  function openControls(): void {
    driver = readerTakesOver(storyContent.scrollTop);
    rejoin = null;
    setStoryOpen(false);
    rememberStoryFolded(true);
    // The URL stops naming a story stop and names the overlay instead.
    saveUrlState(true);
  }

  const rightPanel = document.getElementById('right-panel')!;

  /**
   * Opening the story hands it the map at once, easing back as a deliberate
   * scroll would. The ease starts once the story has finished opening: where
   * the story is depends on how tall it is.
   */
  function openStory(): void {
    setStoryOpen(true);
    rememberStoryFolded(false);

    let started = false;
    const start = (): void => {
      if (started || !storyOpen) return;
      started = true;
      rightPanel.removeEventListener('transitionend', onTransitionEnd);
      driver = rejoinNow(performance.now());
      beginRejoin();
      scheduleStoryFrame();
    };
    const onTransitionEnd = (e: TransitionEvent): void => {
      if (e.target === rightPanel && e.propertyName === 'grid-template-rows') start();
    };
    rightPanel.addEventListener('transitionend', onTransitionEnd);
    // No transitionend without a transition, as with reduced motion.
    setTimeout(start, 400);
  }

  controlsToggle.addEventListener('click', () => (storyOpen ? openControls() : openStory()));
  storyStrip.addEventListener('click', openStory);

  // Scrolling is the only thing that moves the story on. While the reader
  // drives it only counts towards handing the map back.
  storyContent.addEventListener('scroll', () => {
    if (!storyOpen) return;

    const before = driver.by;
    driver = storyScrolled(driver, storyContent.scrollTop, performance.now());
    if (driver.by === 'reader') return;
    if (before === 'reader') beginRejoin();
    scheduleStoryFrame();
  });

  let storyFrame: number | null = null;

  /** Repaint from the story without counting as a scroll. */
  function scheduleStoryFrame(): void {
    if (storyFrame === null) storyFrame = requestAnimationFrame(paintStoryFrame);
  }

  function currentStoryState(): InterpolatedState {
    return computeInterpolatedState(
      resolvedStops,
      computeStopOffsets(stopElements),
      storyContent.scrollHeight,
      storyContent.scrollTop,
      storyData.defaults?.easing ?? 'ease-in-out',
      stopElements.map((el) => el.offsetHeight),
      storyContent.clientHeight,
    );
  }

  /** Start easing from whatever the reader has on screen to where the story is. */
  function beginRejoin(): void {
    const state = currentStoryState();
    const reader = readerAsStop(
      { x: camera.x, y: camera.y, zoom: camera.zoom },
      currentOverlayId,
      currentOverlay?.getUrlParams?.() ?? {},
    );
    // The reader's colours first: working out the story's hands its settings to
    // the overlay, which is where the ease-back ends anyway.
    const fromColors = colorsForStop(reader, verses);
    const toColors = computeBlendedColors(state.fromStop, state.toStop, state.t, verses);
    rejoin = { fromCamera: reader.camera, fromColors, toColors };
  }

  function paintStoryFrame(now: number): void {
    storyFrame = null;
    if (!storyOpen || driver.by === 'reader') return;

    if (driver.by === 'rejoining') {
      driver = settle(driver, now);
      if (driver.by === 'story') {
        // Done: the next lines re-sync the overlay, its settings and the pin.
        rejoin = null;
        lastSyncedStopId = null;
      }
    }

    const state = currentStoryState();

    if (driver.by === 'rejoining' && rejoin) {
      const t = easingFunctions['ease-in-out'](rejoinProgress(driver, now));
      Object.assign(camera, lerpCamera(rejoin.fromCamera, state.camera, t));
      rebuildGeometry(
        renderContext.gl,
        renderState,
        blendColorArrays(rejoin.fromColors, rejoin.toColors, t),
      );
      render();
      scheduleStoryFrame();
      return;
    }

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
      // Mid-scroll: blender paints interpolated colors directly to the GPU buffer.
      const blendedColors = computeBlendedColors(state.fromStop, state.toStop, state.t, verses);
      rebuildGeometry(renderContext.gl, renderState, blendedColors);
    }
    render();
    updateUrl({ story: dominantStop.id, overlayParams: {} }, false);
  }

  window.addEventListener('resize', scheduleStoryFrame);

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
      updateSummary();
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
      // Force the next settled scroll frame to apply the stop's state.
      lastSyncedStopId = null;
      driver = STORY_DRIVING;
      rejoin = null;
      setStoryOpen(true);
      storyContent.scrollTop = 0;
      const stopIndex = resolvedStops.findIndex((s) => s.id === urlState.story);
      if (stopIndex >= 0 && stopElements[stopIndex]) {
        stopElements[stopIndex].scrollIntoView();
      }
      return;
    }

    if (urlState.overlay || urlState.verse) {
      driver = readerTakesOver(storyContent.scrollTop);
      rejoin = null;
      setStoryOpen(false);
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

  // A link to a story stop always opens the story.
  if (storyOpen && !parseUrlState().story && storyWasFolded()) {
    driver = readerTakesOver(0);
    setStoryOpen(false);
  }

  subscribeToHashChange(() => {
    restoreFromUrl();
  });

  scheduleStoryFrame();

  prefetchMorphology();
}

main().catch(console.error);
