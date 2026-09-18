// Tanakh Map - Main entry point

declare const __GIT_BRANCH__: string;

import { computeLayout, getLayoutBounds } from './layout.ts';
import { createBookLabels, createSectionLabels, updateLabelPositions } from './labels.ts';
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
import { resolveViewState, cameraForView, type ViewState } from './viewState.ts';
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
import {
  computeItemStates,
  applyItemColors,
  overlayColorsFor,
  layerToRecompute,
  getDefaultColor,
} from './itemColoring.ts';
import {
  createRenderContext,
  createRenderState,
  rebuildGeometry,
  render as renderFrame,
} from './rendering.ts';
import type { TanakhIdentity, TanakhLayout } from './types.ts';
import {
  registerAllOverlays,
  createOverlaySettings,
  getOverlay,
  getAllOverlays,
  configureCommentary,
  configureTrop,
  configureSearch,
  configureVerseLength,
  type Overlay,
  type Color,
} from './overlays/index.ts';
import { searchOverlay, searchForMeaning, canAddTerm } from './overlays/search/index.ts';
import {
  ZOOM_OUT_FACTOR,
  ZOOM_IN_FACTOR,
  DEFAULT_ZOOM,
  URL_UPDATE_DEBOUNCE_MS,
} from './constants/app.ts';
import {
  loadStoryData,
  renderStoryPanel,
  resolveStops,
  stopLabel,
  type StoryFocus,
} from './scrollytelling/storyPanel';
import { computeInterpolatedState } from './scrollytelling/controller';
import { computeBlendedColors } from './scrollytelling/overlayBlender';
import { blendColorArrays } from './scrollytelling/colorBlending';
import { easingFunctions, lerpCamera } from './scrollytelling/interpolation';
import {
  REJOIN_EASE_MS,
  STORY_DRIVING,
  SWIPE_EASE_MS,
  colorSource,
  readerTakesOver,
  rejoin,
  rejoinProgress,
  settle,
  storyScrolled,
  type Driver,
} from './scrollytelling/driver';
import type { InterpolatedState, ResolvedStoryStop } from './scrollytelling/types';
import { summaryHtml } from './panelSummary.ts';
import './styles/zoom-buttons.css';
import './styles/right-panel.css';
import './styles/verse-popup.css';

declare global {
  interface Window {
    bookLabels?: HTMLDivElement;
  }
}

const STORY_FOLDED_KEY = 'torahMap.storyFolded';

// How far down a phone's map the story puts the verse it names. Halfway down,
// the verse lands behind the popup that sits just above the sheet.
const PHONE_STORY_FOCUS = 0.4;

function storyWasFolded(): boolean {
  try {
    return localStorage.getItem(STORY_FOLDED_KEY) === 'true';
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  document.title = __GIT_BRANCH__ === 'main' ? 'Torahmap' : `Torahmap [${__GIT_BRANCH__}]`;

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

  // Every overlay's settings, kept while another overlay is showing.
  const overlaySettings = createOverlaySettings();

  function currentSettings(): unknown {
    return currentOverlay ? overlaySettings.get(currentOverlay) : undefined;
  }

  // The one colour layer on the map: either a settled overlay's colours or a
  // story transition's blend. composite() paints the hover and pin on top of
  // it. A pin never recomputes it; a hover does only when the colours depend
  // on the hovered verse, which a blend's may.
  let colorLayer: (Color | Color[] | null)[] = [];

  let driver: Driver = STORY_DRIVING;

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
    setColorLayer(
      overlayColorsFor(currentOverlay, verses, currentSettings(), mouseState.hoveredVerse),
    );
  }

  function blendTransition(): void {
    if (driver.by !== 'story' || !driver.blend) return;
    const { from, to, t } = driver.blend;
    setColorLayer(computeBlendedColors(from, to, t, verses, mouseState.hoveredVerse));
  }

  /**
   * Repaint after the hovered or pinned verse changes. `hoveredBefore` is the
   * hover the colour layer was drawn for; a pin leaves the hover alone, so it
   * passes nothing and only composites.
   */
  function repaint(hoveredBefore: TanakhLayout | null = mouseState.hoveredVerse): void {
    const layer = layerToRecompute(
      colorSource(driver),
      currentOverlay,
      currentSettings(),
      hoveredBefore,
      mouseState.hoveredVerse,
      tanakhIdentitiesEqual,
    );
    if (layer === 'blend') blendTransition();
    else if (layer === 'overlay') applyOverlay();
    else composite();
    render();
  }

  /**
   * Sync explore-mode state (overlay, params, pinned verse) to a story stop.
   * Does NOT paint the buffer — caller decides (settled paints via applyOverlay,
   * mid-scroll lets the blender paint). Pulled out of applyStoryStop so mid-scroll
   * can keep `currentOverlay`/`pinnedVerse` in sync with the stop the user is
   * heading toward, for the sidebar and the hover text.
   *
   * The stop is external state, like a link, so URL writes are off throughout:
   * in story mode the URL is the stop id, and an explore-mode URL has no
   * business overwriting it.
   */
  function syncStoryStopState(stop: ResolvedStoryStop): void {
    applyingExternalState(() => syncStoryStopStateUnguarded(stop));
  }

  function syncStoryStopStateUnguarded(stop: ResolvedStoryStop): void {
    const wantedOverlay = stop.overlay ?? 'none';
    if (wantedOverlay !== currentOverlayId) {
      activateOverlay(wantedOverlay);
    }

    if (currentOverlay) overlaySettings.restore(currentOverlay, stop.overlayParams ?? {});
    overlayChanged(true);

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

  // Where the story was when it folded. Folded, it has no height, and the stops
  // are spaced in fractions of its height, so its scroll collapses with it.
  let foldedPosition = 0;

  function setStoryOpen(open: boolean): void {
    if (!open && storyOpen) {
      storyStripTitle.textContent = currentStopLabel();
      foldedPosition = storyPosition();
    }
    storyOpen = open;
    document.body.classList.toggle('story-folded', !open);
    controlsToggle.setAttribute('aria-expanded', String(!open));
    storyStrip.setAttribute('aria-expanded', String(open));
    panelControls.inert = open;
    storyContent.inert = !open;
    updateSummaryShown();
  }

  // On a phone the sheet can also be lowered to its summary line, giving the
  // map the screen. Lowering hides the sheet without changing which section is
  // open, so raising it brings back what was there.
  const phoneLayout = window.matchMedia('(max-width: 768px)');
  let sheetDown = false;

  // On a phone the stops sit side by side and a swipe moves one; elsewhere
  // they stack and scroll. Either way the story is driven by how far along
  // that one axis it has been moved.
  function storyPosition(): number {
    return phoneLayout.matches ? storyContent.scrollLeft : storyContent.scrollTop;
  }

  function setStoryPosition(position: number): void {
    if (phoneLayout.matches) storyContent.scrollLeft = position;
    else storyContent.scrollTop = position;
  }

  function showStop(stop: HTMLElement | undefined): void {
    stop?.scrollIntoView(phoneLayout.matches ? { block: 'nearest', inline: 'center' } : undefined);
  }

  function setSheetDown(down: boolean): void {
    sheetDown = down;
    document.body.classList.toggle('sheet-down', down);
    const footer = document.getElementById('panel-footer');
    if (footer) footer.inert = down;
    storyStrip.inert = down;
    if (down) {
      panelControls.inert = true;
      storyContent.inert = true;
    } else {
      setStoryOpen(storyOpen);
    }
    updateSummaryShown();
  }

  // Crossing into or out of phone width turns the story from a column into a
  // row, or back, and moves where it centres verses; keep the reader's stop.
  phoneLayout.addEventListener('change', () => {
    if (!phoneLayout.matches && sheetDown) setSheetDown(false);
    resolvedStops = resolveStops(storyData.stops, initialCamera, verses, storyFocus());
    showStop(stopElements.find((el) => el.dataset.stopId === lastSyncedStopId));
    scheduleStoryFrame();
  });

  function currentStopLabel(): string {
    const state = currentStoryState();
    return stopLabel(state.t > 0.5 ? state.toStop : state.fromStop);
  }

  /**
   * On a phone, "No overlay" reads as the first thing to do, so while the
   * story drives with no overlay on the line is left out. It comes back once
   * the reader takes the map.
   */
  function updateSummaryShown(): void {
    const quiet = currentOverlayId === 'none' && storyOpen && !sheetDown && driver.by !== 'reader';
    document.body.classList.toggle('no-overlay-quiet', quiet);
  }

  /** Anything the reader does that changes what the map shows hands them the map. */
  function takeOver(): void {
    if (!storyOpen || driver.by === 'reader') return;
    driver = readerTakesOver(storyPosition());
    applyOverlay();
    updateSummaryShown();
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
    repaint();
    saveUrlState(true);
  }

  function unpinVerse(): void {
    takeOver();
    pinnedVerse = null;
    updateSidebarWrapper(null);
    repaint();
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
  const sections = new Map(torahData.books.map((b) => [b.name, b.section]));
  createSectionLabels(verses, window.bookLabels, (book) => sections.get(book) ?? 'neviim');
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
    // Any touch on a phone's map says the reader wants the map.
    if (phoneLayout.matches && !sheetDown) setSheetDown(true);
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
    const previousHover = mouseState.hoveredVerse;
    clearHover(mouseState);
    lastPointerPosition = null;
    canvas.style.cursor = 'default';

    if (previousHover) repaint(previousHover);
  });

  const sidebarElements = getSidebarElements();

  function buildOverlayParamsForUrl(): Record<string, string> {
    return currentOverlay ? overlaySettings.toUrl(currentOverlay) : {};
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
    updateSidebar(
      sidebarElements,
      verse,
      verseTexts,
      currentOverlay,
      currentSettings(),
      getVerseText,
      isPinned,
    );
  }

  /**
   * Redraw the popup for the verse it shows, pinned or else hovered. It reads
   * the overlay's settings when drawn, so it goes stale when they change under
   * a verse that stays put, as when two story stops pin the same verse.
   */
  function refreshVersePopup(): void {
    if (pinnedVerse) updateSidebarWrapper(pinnedVerse, true);
    else if (mouseState.hoveredVerse) updateSidebarWrapper(mouseState.hoveredVerse, false);
  }

  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerType === 'touch' || touchState.activeTouches.size >= 2) return;

    if (!mouseState.isDragging) {
      lastPointerPosition = { x: e.clientX, y: e.clientY };
      const verse = findItemAtPoint(verses, camera, e.clientX, e.clientY);
      const previousHover = mouseState.hoveredVerse;
      setHoveredVerse(mouseState, verse);

      if (pinnedVerse && verse) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }

      if (!tanakhIdentitiesEqual(previousHover, verse)) repaint(previousHover);

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

  /** Switch the active overlay without drawing its UI, painting or writing the URL. */
  function activateOverlay(id: string): void {
    currentOverlayId = id;
    currentOverlay?.destroy?.();
    currentOverlay = getOverlay(id) ?? null;
  }

  function renderOverlayLegend(): void {
    if (overlayLegendContainer) {
      overlayLegendContainer.innerHTML = '';
      currentOverlay?.renderLegend?.(overlayLegendContainer, currentSettings());
    }
  }

  /** Draw the active overlay's controls into what is already there. */
  function renderOverlayControls(): void {
    const overlay = currentOverlay;
    if (!overlay || !overlayControlsContainer) return;
    overlay.renderControls?.(overlayControlsContainer, overlaySettings.get(overlay), (update) =>
      changeSettings(overlay, update),
    );
  }

  /**
   * Redraw everything that shows the active overlay or its settings. `fresh`
   * clears the controls first, for a different overlay or settings from
   * elsewhere; a reader's own edit redraws into them, keeping their focus.
   */
  function overlayChanged(fresh: boolean): void {
    if (fresh) {
      if (overlaySelect) overlaySelect.value = currentOverlayId;
      if (overlayControlsContainer) overlayControlsContainer.innerHTML = '';
    }
    renderOverlayControls();
    renderOverlayLegend();
    controlsSummary.innerHTML = summaryHtml(
      currentOverlay?.name,
      currentOverlay?.summary?.(currentSettings()) ?? {},
    );
    updateSummaryShown();
    refreshVersePopup();
  }

  /**
   * Apply a change a reader asked for to the settings held for `overlay`. A
   * control left over from an overlay that is no longer showing still changes
   * that overlay's settings, but paints nothing.
   */
  function changeSettings<S>(overlay: Overlay<TanakhIdentity, S>, update: (current: S) => S): void {
    overlaySettings.set(overlay, update(overlaySettings.get(overlay)));
    if (overlay !== currentOverlay) return;

    applyOverlay();
    overlayChanged(false);
    render();
    saveUrlState(false);
  }

  function setOverlay(id: string): void {
    trackOverlaySwitch(id, currentOverlayId);
    activateOverlay(id);
    overlayChanged(true);
    applyOverlay();
    render();
    saveUrlState(true);
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
      paletteFull: !canAddTerm(overlaySettings.get(searchOverlay)),
      onChoose: (meaning) => {
        // Ask before anything is spent. setOverlay() takes the showing overlay
        // off the map, so a search that is going to be refused must be refused
        // first - otherwise the reader loses their Haftarah view and gains
        // nothing. The panel's own count was taken when it opened, and a
        // keyboard reader can add a word in between.
        if (!canAddTerm(overlaySettings.get(searchOverlay))) return;

        takeOver();
        if (currentOverlayId !== 'search') {
          setOverlay('search');
        }

        // Replaces the URL setOverlay just pushed rather than adding a second
        // history entry.
        changeSettings(
          searchOverlay,
          (current) => searchForMeaning(current, word, meaning?.keys ?? null) ?? current,
        );
      },
    });
  });

  overlaySelect?.addEventListener('change', () => {
    setOverlay(overlaySelect.value);
  });

  // The window resizing is not the only thing that resizes the map: on a phone
  // it grows as the sheet lowers.
  new ResizeObserver(() => {
    resizeCanvas();
    render();
  }).observe(canvas);

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
          for (const [key, value] of Object.entries(overlaySettings.toUrl(currentOverlay))) {
            extraParts += ` | ${key}: ${value}`;
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

  /**
   * Where on the map the story puts the verse a stop names: the middle, or on
   * a phone higher up, clear of the verse popup that sits above the sheet.
   */
  function storyFocus(): StoryFocus {
    const height = phoneLayout.matches
      ? canvas.clientHeight * PHONE_STORY_FOCUS
      : canvas.clientHeight / 2;
    return { x: canvas.clientWidth / 2, y: height };
  }

  let storyData = await loadStoryData();
  let resolvedStops = resolveStops(storyData.stops, initialCamera, verses, storyFocus());
  let stopElements = renderStoryPanel(storyContent, storyData.stops);

  async function reloadStory(): Promise<void> {
    const position = storyPosition();
    storyData = await loadStoryData();
    resolvedStops = resolveStops(storyData.stops, initialCamera, verses, storyFocus());
    stopElements = renderStoryPanel(storyContent, storyData.stops);
    setStoryPosition(position);
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
    takeOver();
    setStoryOpen(false);
    rememberStoryFolded(true);
    render();
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
      setStoryPosition(foldedPosition);
      beginEase(REJOIN_EASE_MS, performance.now());
      scheduleStoryFrame();
    };
    const onTransitionEnd = (e: TransitionEvent): void => {
      if (e.target === rightPanel && e.propertyName === 'grid-template-rows') start();
    };
    rightPanel.addEventListener('transitionend', onTransitionEnd);
    // No transitionend without a transition, as with reduced motion.
    setTimeout(start, 400);
  }

  controlsToggle.addEventListener('click', () => {
    if (sheetDown) setSheetDown(false);
    else if (storyOpen) openControls();
    else openStory();
  });
  storyStrip.addEventListener('click', openStory);
  document.getElementById('return-to-story')?.addEventListener('click', openStory);

  // Scrolling is the only thing that moves the story on. While the reader
  // drives it only counts towards handing the map back.
  storyContent.addEventListener('scroll', () => {
    if (!storyOpen) return;

    if (driver.by === 'reader') {
      const next = storyScrolled(driver, storyPosition());
      if (next !== 'rejoin') {
        driver = next;
        return;
      }
      beginEase(REJOIN_EASE_MS, performance.now());
    }
    scheduleStoryFrame();
  });

  let storyFrame: number | null = null;

  /** Repaint from the story without counting as a scroll. */
  function scheduleStoryFrame(): void {
    if (storyFrame === null) storyFrame = requestAnimationFrame(paintStoryFrame);
  }

  function currentStoryState(): InterpolatedState {
    // On a phone the story is at whichever page is showing. Moving between
    // pages is eased on a timer (beginEase), not tracked through the swipe.
    if (phoneLayout.matches) {
      const page = Math.round(storyContent.scrollLeft / Math.max(1, storyContent.clientWidth));
      const stop = resolvedStops[Math.min(resolvedStops.length - 1, Math.max(0, page))];
      return { camera: { ...stop.camera }, fromStop: stop, toStop: stop, t: 0 };
    }
    return computeInterpolatedState(
      resolvedStops,
      stopElements.map((el) => el.offsetTop),
      storyContent.scrollHeight,
      storyContent.scrollTop,
      storyData.defaults?.easing ?? 'ease-in-out',
      stopElements.map((el) => el.offsetHeight),
      storyContent.clientHeight,
    );
  }

  /**
   * Ease the map over `duration` from what is on screen, which may be partway
   * through an earlier ease, to where the story is.
   */
  function beginEase(duration: number, now: number): void {
    cancelCameraGlide();
    const state = currentStoryState();
    driver = rejoin(
      now,
      duration,
      camera,
      colorLayer.map((c, i) => c ?? getDefaultColor(i)),
      computeBlendedColors(state.fromStop, state.toStop, state.t, verses, null),
    );
    updateSummaryShown();
  }

  function paintStoryFrame(now: number): void {
    storyFrame = null;
    // The reader can take the map, or fold the story, between the scroll and this frame.
    if (!storyOpen || driver.by === 'reader') return;

    if (driver.by === 'rejoining') {
      driver = settle(driver, now);
      // Done: the next lines re-sync the overlay, its settings and the pin.
      if (driver.by === 'story') lastSyncedStopId = null;
    }

    const state = currentStoryState();
    // Nothing further to scroll to, so no cue to.
    document.body.classList.toggle(
      'story-at-end',
      state.toStop === resolvedStops[resolvedStops.length - 1],
    );

    // A new page on a phone eases in rather than cutting to it.
    if (phoneLayout.matches && lastSyncedStopId !== null && state.toStop.id !== lastSyncedStopId) {
      beginEase(SWIPE_EASE_MS, now);
      // The controls and the popup move to the new stop as it starts.
      syncStoryStopState(state.toStop);
      lastSyncedStopId = state.toStop.id;
    }

    if (driver.by === 'rejoining') {
      const t = easingFunctions['ease-in-out'](rejoinProgress(driver, now));
      Object.assign(camera, lerpCamera(driver.fromCamera, state.camera, t));
      setColorLayer(blendColorArrays(driver.fromColors, driver.toColors, t));
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

    // A scroll fires no pointer event, so re-run hit detection under the
    // last known cursor position now that the camera has moved.
    if (lastPointerPosition) {
      setHoveredVerse(
        mouseState,
        findItemAtPoint(verses, camera, lastPointerPosition.x, lastPointerPosition.y),
      );
    }

    if (settled) {
      // At rest: paint via the explore-mode color pipeline.
      driver = STORY_DRIVING;
      applyOverlay();
    } else {
      driver = { by: 'story', blend: { from: state.fromStop, to: state.toStop, t: state.t } };
      blendTransition();
    }
    render();
    updateUrl({ story: dominantStop.id, overlayParams: {} }, false);
  }

  window.addEventListener('resize', scheduleStoryFrame);

  // Everything this does came out of the URL, so nothing it does may write to
  // the URL — see applyingExternalState in urlState.ts.
  function restoreFromUrl(): void {
    const next = resolveViewState(
      parseUrlState((id) => getOverlay(id)?.urlParams),
      { ...initialCamera, zoom: DEFAULT_ZOOM },
      (id) => getOverlay(id) !== undefined,
    );
    applyingExternalState(() => applyViewState(next));
  }

  /**
   * Replace the whole view with `next`, in an order where each step can rely on
   * the one before: settings before the controls that draw them, the verse
   * before the camera that centres on it.
   */
  function applyViewState(next: ViewState): void {
    if (next.mode === 'story') {
      // Force the next settled story frame to apply the stop's state.
      lastSyncedStopId = null;
      driver = STORY_DRIVING;
      setStoryOpen(true);
      setStoryPosition(0);
    } else {
      driver = readerTakesOver(storyPosition());
      setStoryOpen(false);
    }

    activateOverlay(next.overlay);
    if (currentOverlay) overlaySettings.restore(currentOverlay, next.overlayParams);
    overlayChanged(true);

    const verse = next.verse ? (findTanakhItem(verses, next.verse) ?? null) : null;
    pinnedVerse = verse;
    updateSidebarWrapper(verse, verse !== null);

    cancelCameraGlide();
    Object.assign(camera, cameraForView(next.camera, verse, window.innerWidth, window.innerHeight));

    applyOverlay();
    render();

    // The story drives the map from its scroll position, so it takes over here.
    if (next.mode === 'story') {
      const stopIndex = resolvedStops.findIndex((s) => s.id === next.storyStop);
      showStop(stopElements[stopIndex]);
      scheduleStoryFrame();
    }
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
