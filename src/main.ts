// Tanakh Map - Main entry point

declare const __GIT_BRANCH__: string;
declare const __SHOW_DRAFTS__: boolean;

import { computeLayout, getLayoutBounds } from './layout.ts';
import { mapPoint } from './mapPoint.ts';
import { createBookLabels, createSectionLabels, updateLabelPositions } from './labels.ts';
import { loadTanakhStructure, loadAllVerseTexts, getVerseText } from './verseTexts.ts';
import { buildSearchIndex, loadLexiconData } from './search.ts';
import { lookupForm } from './verseWords.ts';
import { meaningsInVerse, prefetchMorphology } from './search/dictionary.ts';
import { openWordMenu } from './wordMenu.ts';
import { initBookData } from './constants/books.ts';
import {
  DRAG_PX,
  STORY,
  exploreFrame,
  nextFrame,
  type Frame,
  type FrameEvent,
  PANEL_TITLES,
  isPanel,
} from './frame.ts';
import { CONTINUE_STORY, menuHtml, type StoryPlace } from './menu.ts';
import { storiesHtml, storyChosen, type StoryCard } from './storiesPanel.ts';
import { aboutHtml } from './aboutPanel.ts';
import { applyHebrewChoice, bindHebrewToggle } from './hebrewDisplay.ts';
import {
  configureAnalytics,
  trackOverlaySwitch,
  trackPageView,
  trackSefariaClick,
  trackStoryExit,
  trackStoryReturn,
  trackStoryStop,
  trackVerseClick,
  trackViewSettled,
  trackWordMenuOpen,
  trackWordSearch,
} from './analytics.ts';
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
  zoomAtPoint,
  centreForFocus,
  viewOffset,
  viewFocusedOn,
  animateCameraTo,
  type Camera,
  type ScreenPoint,
  type Viewport,
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
import { findItemAtPoint, findNearestItem } from './hitDetection.ts';
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
import { renderStoryPanel, resolveStops, stopLabel } from './scrollytelling/storyPanel';
import { listedStories, storyToOpen, type Story } from './scrollytelling/storyIndex';
import { STORIES } from './stories/index.ts';
import { computeInterpolatedState } from './scrollytelling/controller';
import { computeBlendedColors } from './scrollytelling/overlayBlender';
import { flatten, still, type ColorLayer } from './scrollytelling/colorBlending';
import type { Picture } from './geometry';
import { easingFunctions, lerpCamera } from './scrollytelling/interpolation';
import {
  REJOIN_EASE_MS,
  STORY_DRIVING,
  SWIPE_EASE_MS,
  colorSource,
  driverKind,
  readerTakesOver,
  rejoin,
  rejoinProgress,
  settle,
  storyScrolled,
  type Driver,
  type ReaderDriving,
  type StoryHasMap,
} from './scrollytelling/driver';
import {
  driverChangeEvent,
  stopAt,
  type ExitHow,
  type ReturnHow,
} from './telemetry/driverChange.ts';
import type { InterpolatedState, ResolvedStoryStop } from './scrollytelling/types';
import { summaryHtml } from './panelSummary.ts';
import { createMapTitle, updateMapTitlePosition, type MapTitle } from './mapTitle.ts';
import './styles/map-title.css';
import './styles/zoom-buttons.css';
import './styles/frame.css';
import './styles/verse-popup.css';

declare global {
  interface Window {
    bookLabels?: HTMLDivElement;
    mapTitle?: MapTitle;
  }
}

const STORY_FOLDED_KEY = 'torahMap.storyFolded';

// How far down a phone's map a verse brought into view is put. Halfway down,
// the verse lands behind the popup that sits just above the sheet.
const PHONE_STORY_FOCUS = 0.4;

function storyWasFolded(): boolean {
  try {
    return sessionStorage.getItem(STORY_FOLDED_KEY) === 'true';
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

  // Where the canvas starts, read when it resizes rather than per pointer
  // event: reading it then forces a layout on every hover and drag.
  let canvasOrigin = canvas.getBoundingClientRect();
  new ResizeObserver(() => {
    canvasOrigin = canvas.getBoundingClientRect();
  }).observe(canvas);

  /** Where a pointer is on the map: the canvas need not start at the window's corner. */
  const onMap = (e: { clientX: number; clientY: number }): { x: number; y: number } =>
    mapPoint(e.clientX, e.clientY, canvasOrigin);

  const renderContext = createRenderContext(canvas);
  const renderState = createRenderState(renderContext, verses, dpr);

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
  let colorLayer: ColorLayer<Color | Color[] | null> = still({ colors: [] });
  // What the verse buffer was last built from. A fade in progress changes only
  // its amount, so a frame that keeps these redraws without rebuilding.
  let built: unknown[] = [];

  // A story folded earlier in the session opens folded, unless the link names a story.
  const opensFolded = !parseUrlState().story && storyWasFolded();
  let driver: Driver = opensFolded ? readerTakesOver(0) : STORY_DRIVING;
  configureAnalytics({ getMode: () => driverKind(driver) });

  function composite(): void {
    const { from, to, t } = colorLayer;
    renderState.fade = to ? t : 0;

    // The colour arrays, not the pictures: a story stop's are cached, while
    // the pictures around them are made afresh each frame.
    const inputs = [
      from.colors,
      from.growth,
      to?.colors,
      to?.growth,
      mouseState.hoveredVerse,
      pinnedVerse,
    ];
    if (inputs.every((input, i) => input === built[i])) return;
    built = inputs;

    const shown = (picture: Picture<Color | Color[] | null>): Picture => ({
      colors: applyItemColors(
        computeItemStates(
          verses,
          picture.colors,
          mouseState.hoveredVerse,
          pinnedVerse,
          tanakhIdentitiesEqual,
        ),
      ),
      growth: picture.growth,
    });
    rebuildGeometry(renderContext.gl, renderState, shown(from), to && shown(to));
  }

  function setColorLayer(next: ColorLayer<Color | Color[] | null>): void {
    colorLayer = next;
    composite();
  }

  function applyOverlay(): void {
    setColorLayer(
      still({
        colors: overlayColorsFor(
          currentOverlay,
          verses,
          currentSettings(),
          mouseState.hoveredVerse,
        ),
      }),
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

  const camera = createCamera(mapViewport(), bounds);

  let pinnedVerse: TanakhLayout | null = null;

  const mouseState = createMouseState();

  // A scroll fires no pointer event, so the mid-scroll branch needs the last
  // known cursor position to re-run hit detection as the camera moves under it.
  let lastPointerPosition: { x: number; y: number } | null = null;

  const touchState = createTouchState();

  const storyContent = document.getElementById('story-content')!;

  const panel = document.getElementById('panel')!;
  const droppedMenu = document.getElementById('menu')!;
  const storyProgress = document.getElementById('story-progress')!;
  const storyProgressFill = document.getElementById('story-progress-fill')!;
  const toolsTitle = document.getElementById('tools-title')!;
  const panelBody = document.getElementById('panel-body')!;
  const storiesPanel = document.getElementById('stories-panel')!;
  const aboutPanel = document.getElementById('about-panel')!;
  const mapLegend = document.getElementById('map-legend')!;
  const mapLegendSummary = mapLegend.querySelector<HTMLElement>('.map-legend-summary')!;
  const overlayDescription = document.getElementById('overlay-description')!;
  const menuToggle = document.getElementById('menu-toggle')!;

  // What the panel shows (src/frame.ts); the story is open while its mode is 'story'.
  let frame: Frame = STORY;

  // The stop the story is at while it cannot be scrolled there: hidden, it has
  // no height. Null while its scroll says where it is.
  let heldStop: number | null = null;

  function storyStopIndex(): number {
    if (heldStop !== null) return heldStop;
    const state = currentStoryState();
    return resolvedStops.indexOf(state.t > 0.5 ? state.toStop : state.fromStop);
  }

  const phoneLayout = window.matchMedia('(max-width: 768px)');

  /** Opens or closes the story; closing it lands on `exploring`. */
  function setStoryOpen(open: boolean, exploring = exploreFrame(phoneLayout.matches)): void {
    if (!open && frame.mode === 'story') heldStop = storyStopIndex();
    const previous = frame;
    if (open) frame = STORY;
    else if (frame.mode === 'story') frame = exploring;
    applyFrame(previous);
  }

  function placeIn(stops: readonly { id: string }[], index: number): StoryPlace {
    return { number: stopAt(stops, index).number, total: stops.length };
  }

  function storyPlace(): StoryPlace {
    return placeIn(resolvedStops, storyStopIndex());
  }

  /**
   * Puts the frame on the page. The stylesheet reads the attributes; the menu
   * and the panels are drawn as they open, and left alone while they stay open.
   */
  function applyFrame(previous: Frame | null = null): void {
    const body = document.body;
    body.dataset.mode = frame.mode;
    if (frame.open) body.dataset.open = frame.open;
    else delete body.dataset.open;
    body.toggleAttribute('data-menu', frame.menu);
    body.toggleAttribute('data-full', frame.full);
    const focusInMenu = droppedMenu.contains(document.activeElement);
    droppedMenu.hidden = !frame.menu;
    menuToggle.setAttribute('aria-expanded', String(frame.menu));
    storyContent.inert = frame.menu;
    panelBody.inert = frame.menu;
    toolsTitle.textContent = frame.open ? PANEL_TITLES[frame.open] : '';
    if (frame.menu && !previous?.menu) {
      droppedMenu.innerHTML = menuHtml({ ...storyPlace(), title: story.data.title });
    }
    const opened = frame.open !== previous?.open;
    if (opened && frame.open === 'stories') drawStories();
    if (opened && frame.open === 'about') {
      aboutPanel.innerHTML = aboutHtml(getAllOverlays());
      bindHebrewToggle(aboutPanel.querySelector<HTMLButtonElement>('#hebrew-toggle')!);
    }
    measureSheet();
    // Hidden, the menu would drop focus to the top of the page.
    if (focusInMenu && !frame.menu) menuToggle.focus();
  }

  // An exploring phone's sheet is as tall as its content, or gone with nothing
  // open; the map, the legend and the verse popup make room for it. Full
  // height grows over the map instead.
  function measureSheet(): void {
    if (!phoneLayout.matches || frame.full) return;
    document.documentElement.style.setProperty('--sheet-shown', `${panel.offsetHeight}px`);
  }
  new ResizeObserver(measureSheet).observe(panel);

  // On a phone the verse popup stacks above the legend, which grows a row for
  // each thing on the map.
  new ResizeObserver(() => {
    const height = mapLegend.offsetHeight;
    document.documentElement.style.setProperty('--legend-shown', `${height ? height + 8 : 0}px`);
  }).observe(mapLegend);

  const sameFrame = (a: Frame, b: Frame): boolean =>
    a.mode === b.mode && a.open === b.open && a.menu === b.menu && a.full === b.full;

  function setFrame(next: Frame): void {
    // Every touch on the map arrives here; most change nothing, and redrawing
    // an open panel mid-click would lose what was clicked.
    if (sameFrame(next, frame)) return;
    const previous = frame;
    frame = next;
    applyFrame(previous);
  }

  /** Every control that changes the panel comes through here. */
  function dispatch(event: FrameEvent): void {
    const next = nextFrame(frame, event, phoneLayout.matches);
    if (frame.mode === 'explore' && next.mode === 'story') {
      readerOpensStory();
      return;
    }
    if (frame.mode === 'story' && next.mode === 'explore') leaveStory(next);
    setFrame(next);
    // Opened from the keyboard or not, the ☰ hands focus to the menu's first item.
    if (event.type === 'menu' && frame.menu) {
      droppedMenu.querySelector<HTMLElement>('.menu-item')?.focus();
    }
  }

  // On a phone the stops sit side by side and a swipe moves one; elsewhere
  // they stack and scroll. Either way the story is driven by how far along
  // that one axis it has been moved. The axis is read from the story's layout,
  // so the script cannot disagree with the stylesheet about it.
  function storyIsSideways(): boolean {
    return getComputedStyle(storyContent).display === 'flex';
  }

  function storyPosition(): number {
    return storyIsSideways() ? storyContent.scrollLeft : storyContent.scrollTop;
  }

  function setStoryPosition(position: number): void {
    if (storyIsSideways()) storyContent.scrollLeft = position;
    else storyContent.scrollTop = position;
  }

  function showStop(stop: HTMLElement | undefined): void {
    // Centred, where the story holds a stop still; top-aligned, a stop shorter
    // than the story settles partway into the next.
    stop?.scrollIntoView(
      storyIsSideways() ? { block: 'nearest', inline: 'center' } : { block: 'center' },
    );
  }

  // Off until the page view is sent: who drives when the page opens is part of it.
  let recordingDriver = false;

  // Every change of driver goes through here, by way of handOver or keepDriving.
  function setDriver(next: Driver, how: ExitHow | ReturnHow | null): void {
    const event = recordingDriver ? driverChangeEvent(driver, next) : null;
    driver = next;
    if (!event) return;
    const stop = stopAt(resolvedStops, storyStopIndex());
    // handOver's overloads pair an exit with an ExitHow and a return with a ReturnHow.
    if (event === 'story_exit') {
      markViewSettled();
      trackStoryExit(stop.id, stop.number, how as ExitHow);
    } else {
      trackStoryReturn(stop.id, how as ReturnHow);
    }
  }

  /** Give the map to `next`, which may pass it between the story and the reader, for the reason `how`. */
  function handOver(next: ReaderDriving, how: ExitHow): void;
  function handOver(next: StoryHasMap, how: ReturnHow): void;
  function handOver(next: Driver, how: ExitHow | ReturnHow): void {
    setDriver(next, how);
  }

  /** A change that leaves the same one driving. */
  function keepDriving(next: Driver): void {
    if (import.meta.env.DEV && driverKind(next) !== driverKind(driver)) {
      throw new Error(`keepDriving passed the map from ${driver.by} to ${next.by}; use handOver`);
    }
    setDriver(next, null);
  }

  /** Anything the reader does that changes what the map shows hands them the map. */
  function takeOver(how: ExitHow): void {
    if (frame.mode !== 'story' || driver.by === 'reader') return;
    handOver(readerTakesOver(storyPosition()), how);
    applyOverlay();
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
    Object.assign(camera, centreForFocus(verse, camera.zoom, mapFocus(), mapViewport()));
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

    const target = viewFocusedOn(verse, camera.zoom, RESULT_CLICK_ZOOM, mapFocus(), mapViewport());

    stopCameraGlide = animateCameraTo(camera, target, () => {
      render();
      debouncedCameraSettled();
    });
  }

  // pinVerse, unpinVerse and zoomAt answer only the reader's gestures; the story
  // sets the view directly. So each takes the wheel.
  function pinVerse(verse: TanakhLayout, centerCamera: boolean = false): void {
    takeOver('takeover');
    trackVerseClick(verse.book, verse.chapter, verse.verse);
    pinnedVerse = verse;
    updateSidebarWrapper(verse, true);
    if (centerCamera) {
      centerOnVerse(verse);
    }
    repaint();
    syncUrl(true);
  }

  function unpinVerse(): void {
    takeOver('takeover');
    pinnedVerse = null;
    updateSidebarWrapper(null);
    repaint();
    syncUrl(true);
  }

  /** Zoom by `factor`, holding whatever is under (screenX, screenY) still. */
  function zoomAt(factor: number, screenX: number, screenY: number): void {
    takeOver('takeover');
    const newZoom = clampZoom(camera.zoom * factor);
    Object.assign(camera, zoomAtPoint(camera, newZoom, { x: screenX, y: screenY }, mapViewport()));
    render();
  }

  render();

  const hebrewNames = Object.fromEntries(torahData.books.map((b) => [b.name, b.hebrewName]));
  window.bookLabels = createBookLabels(verses, document.body, hebrewNames);
  const sections = new Map(torahData.books.map((b) => [b.name, b.section]));
  createSectionLabels(verses, window.bookLabels, (book) => sections.get(book) ?? 'neviim');
  const offset = viewOffset(camera, mapViewport());
  updateLabelPositions(window.bookLabels, offset, camera.zoom);
  window.mapTitle = createMapTitle(verses, document.body, (book) => sections.get(book) === 'torah');
  updateMapTitlePosition(window.mapTitle, offset, camera.zoom);

  canvas.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      cancelCameraGlide();
      const zoomFactor = e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
      const p = onMap(e);
      zoomAt(zoomFactor, p.x, p.y);
      debouncedCameraSettled();
    },
    { passive: false },
  );

  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');

  zoomInBtn?.addEventListener('click', () => {
    zoomAt(ZOOM_IN_FACTOR, canvas.clientWidth / 2, canvas.clientHeight / 2);
    debouncedCameraSettled();
  });

  zoomOutBtn?.addEventListener('click', () => {
    zoomAt(ZOOM_OUT_FACTOR, canvas.clientWidth / 2, canvas.clientHeight / 2);
    debouncedCameraSettled();
  });

  canvas.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      for (const touch of e.changedTouches) {
        const p = onMap(touch);
        trackTouch(touchState, touch.identifier, p.x, p.y);
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
        const p = onMap(touch);
        trackTouch(touchState, touch.identifier, p.x, p.y);
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
      debouncedCameraSettled();
    }
  });

  canvas.addEventListener('touchcancel', () => {
    resetTouchState(touchState);
  });

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    // A touch on the map lifts the menu and folds a phone's sheet.
    dispatch({ type: 'map-touched' });
    // A hand on the map outranks a glide that is still running.
    cancelCameraGlide();
    const p = onMap(e);
    startDrag(mouseState, p.x, p.y);
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(e.pointerId);
    pointerDownPos = { x: p.x, y: p.y, time: Date.now() };
  });

  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (mouseState.isDragging && touchState.activeTouches.size < 2) {
      const p = onMap(e);
      const dx = p.x - mouseState.dragStart.x;
      const dy = p.y - mouseState.dragStart.y;
      if (dx !== 0 || dy !== 0) takeOver('takeover');
      camera.x -= dx / camera.zoom;
      camera.y -= dy / camera.zoom;
      mouseState.dragStart = { x: p.x, y: p.y };
      render();
    }
  });

  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    const p = onMap(e);
    const wasDragging = mouseState.isDragging;
    if (wasDragging) {
      stopDrag(mouseState);
      debouncedCameraSettled();
    }

    if (pointerDownPos) {
      const dx = Math.abs(p.x - pointerDownPos.x);
      const dy = Math.abs(p.y - pointerDownPos.y);
      const duration = Date.now() - pointerDownPos.time;

      if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD && duration < TAP_MAX_DURATION) {
        const verse = findItemAtPoint(verses, camera, mapViewport(), p.x, p.y);
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
      const verse = findItemAtPoint(verses, camera, mapViewport(), p.x, p.y);
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

  /**
   * Write the URL for what is on screen. While the story is open it names the
   * stop alone, whoever is driving, so reloading puts a lost reader back on the
   * story; folded, it describes the reader's view. `push` adds a history entry,
   * for a discrete step rather than a pan or a scroll.
   */
  function syncUrl(push: boolean = false): void {
    const state: UrlState =
      frame.mode === 'story'
        ? { story: story.id, stop: resolvedStops[storyStopIndex()].id, overlayParams: {} }
        : buildCurrentUrlState();
    updateUrl(state, push);
  }

  // The camera when the reader took the map or last sent view_settled. Every
  // pointer up settles, a click included, so only a camera that has left it is sent.
  let settledCamera: Camera = { ...camera };
  function markViewSettled(): void {
    settledCamera = { ...camera };
  }
  const debouncedCameraSettled = debounce(() => {
    syncUrl(false);
    if (driver.by !== 'reader') return;
    const last = settledCamera;
    if (last.x === camera.x && last.y === camera.y && last.zoom === camera.zoom) return;
    markViewSettled();
    const book = findNearestItem(verses, camera.x, camera.y)?.book ?? '';
    trackViewSettled(book, sections.get(book) ?? '', camera.zoom);
  }, URL_UPDATE_DEBOUNCE_MS);

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
      const p = onMap(e);
      lastPointerPosition = { x: p.x, y: p.y };
      const verse = findItemAtPoint(verses, camera, mapViewport(), p.x, p.y);
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
    if (e.key === 'Escape' && frame.menu) {
      dispatch({ type: 'menu' });
      return;
    }
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

  // A legend entry marked with `data-hover-verse` hovers that verse, colouring
  // the map as the cursor over it would; the popup stays shut.
  function hoverFromLegend(e: PointerEvent): void {
    if (e.pointerType === 'touch') return;
    const target =
      e.type === 'pointerleave' ? null : (e.target as Element).closest('[data-hover-verse]');
    const ref = target instanceof HTMLElement ? target.dataset.hoverVerse : undefined;
    const parsed = ref ? parseVerseFromUrl(ref) : null;
    const verse = parsed ? (findTanakhItem(verses, parsed) ?? null) : null;

    const previousHover = mouseState.hoveredVerse;
    if (tanakhIdentitiesEqual(previousHover, verse)) return;
    setHoveredVerse(mouseState, verse);
    repaint(previousHover);
  }
  overlayLegendContainer?.addEventListener('pointerover', hoverFromLegend);
  overlayLegendContainer?.addEventListener('pointerleave', hoverFromLegend);

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
    overlayDescription.textContent = currentOverlay?.description ?? '';
    mapLegend.hidden = !currentOverlay;
    if (currentOverlay) {
      mapLegendSummary.innerHTML = summaryHtml(
        currentOverlay.name,
        currentOverlay.summary?.(currentSettings()) ?? {},
      );
    }
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
    syncUrl(false);
  }

  function setOverlay(id: string): void {
    trackOverlaySwitch(id, currentOverlayId);
    activateOverlay(id);
    overlayChanged(true);
    applyOverlay();
    render();
    syncUrl(true);
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

    const ref = `${click.book} ${click.chapter}:${click.verse}`;
    const paletteFull = !canAddTerm(overlaySettings.get(searchOverlay));
    trackWordMenuOpen(click.text, ref, meanings.length, paletteFull);

    openWordMenu({
      word: click.text,
      meanings,
      anchor: click.element,
      paletteFull,
      onChoose: (meaning) => {
        // Ask before anything is spent. setOverlay() takes the showing overlay
        // off the map, so a search that is going to be refused must be refused
        // first - otherwise the reader loses their Haftarah view and gains
        // nothing. The panel's own count was taken when it opened, and a
        // keyboard reader can add a word in between.
        if (!canAddTerm(overlaySettings.get(searchOverlay))) return;

        trackWordSearch(click.text, meaning ? `${meaning.form} ${meaning.gloss}` : 'exact', ref);

        takeOver('takeover');
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

  // sendBeacon survives the page navigating away, so following the link to
  // Sefaria doesn't lose the event.
  sidebarElements.link?.addEventListener('click', () => {
    const verse = pinnedVerse ?? mouseState.hoveredVerse;
    if (verse) trackSefariaClick(verse.book, verse.chapter, verse.verse, currentOverlayId);
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
        // A full-height sheet would hide the glide.
        if (frame.full) setFrame({ ...frame, full: false });
        pinVerse(verse);
        glideToVerse(verse);
      },
    },
  });

  applyHebrewChoice();

  const initialCamera = { x: camera.x, y: camera.y, zoom: camera.zoom };

  function mapViewport(): Viewport {
    return { width: canvas.clientWidth, height: canvas.clientHeight };
  }

  /**
   * Where a verse is put when the story, a link or the reader brings it into
   * view: the middle of the map, or on a phone higher up, clear of the verse
   * popup that sits above the sheet.
   */
  function mapFocus(): ScreenPoint {
    const height = phoneLayout.matches
      ? canvas.clientHeight * PHONE_STORY_FOCUS
      : canvas.clientHeight / 2;
    return { x: canvas.clientWidth / 2, y: height };
  }

  let listed = listedStories(STORIES, __SHOW_DRAFTS__);
  // Where each story other than the current one was left, this visit.
  const places = new Map<string, number>();

  let story = storyToOpen(listed, parseUrlState().story ?? null);
  configureAnalytics({ getStory: () => story.id });
  const resolveStory = (): ResolvedStoryStop[] =>
    resolveStops(story.data.stops, initialCamera, verses, mapFocus(), {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    });
  let resolvedStops: ResolvedStoryStop[] = [];
  let stopElements: HTMLElement[] = [];

  /** Puts `next` in the story column, with no stop yet applied to the map. */
  function loadStory(next: Story): void {
    story = next;
    resolvedStops = resolveStory();
    stopElements = renderStoryPanel(storyContent, story.data.stops);
    lastSyncedStopId = null;
  }

  loadStory(story);
  applyFrame();

  // Crossing into or out of phone width turns the story from a column into a
  // row, or back, and moves where it centres verses; keep the reader's stop.
  // By the time this runs the story is laid out on its new axis, so its scroll
  // no longer says which stop it was at; the last stop synced does.
  phoneLayout.addEventListener('change', () => {
    if (!phoneLayout.matches) document.documentElement.style.removeProperty('--sheet-shown');
    setFrame(nextFrame(frame, { type: 'layout-changed' }, phoneLayout.matches));
    resolvedStops = resolveStory();
    if (heldStop === null) {
      showStop(stopElements.find((el) => el.dataset.stopId === lastSyncedStopId));
      // That scroll was ours, not the reader's.
      if (driver.by === 'reader') keepDriving(readerTakesOver(storyPosition()));
    }
    scheduleStoryFrame();
  });

  /** Makes `next` the current story, remembering where the one it replaces was left. */
  function switchStory(next: Story): void {
    if (next.id === story.id) return;
    places.set(story.id, storyStopIndex());
    places.delete(next.id);
    loadStory(next);
    // A stop held for the old story means nothing in this one.
    if (heldStop !== null) heldStop = 0;
  }

  /** The stop `id` was left at this visit; undefined if it has not been opened. */
  function leftAt(id: string): number | undefined {
    return id === story.id ? storyStopIndex() : places.get(id);
  }

  function reloadStory(): void {
    const position = storyPosition();
    loadStory(storyToOpen(listed, story.id));
    setStoryPosition(position);
    scheduleStoryFrame();
  }

  // An edited story reloads in place on the dev server, keeping the reader's scroll.
  if (import.meta.hot) {
    import.meta.hot.accept('./stories/index.ts', (module) => {
      if (!module) return;
      listed = listedStories(module.STORIES as Story[], __SHOW_DRAFTS__);
      reloadStory();
    });
  }

  // Kept for the tab's session: a reload leaves the reader where they were,
  // but a new visit starts in the story rather than on controls with nothing
  // chosen. Written only when the reader opens or closes a section, not when
  // a shared link opens with the story folded.
  function rememberStoryFolded(folded: boolean): void {
    try {
      if (folded) sessionStorage.setItem(STORY_FOLDED_KEY, 'true');
      else sessionStorage.removeItem(STORY_FOLDED_KEY);
    } catch {
      // Storage can be unavailable; the story simply opens next time.
    }
  }

  function leaveStory(exploring?: Frame): void {
    takeOver('fold');
    setStoryOpen(false, exploring);
    rememberStoryFolded(true);
    render();
    syncUrl(true);
  }

  /**
   * Open the story at `stop` and hand it the map, easing from the reader's view
   * or cutting to the stop, as a link does.
   */
  function openStory(stop: number, arrive: 'ease' | 'cut', how: ReturnHow): void {
    heldStop = stop;
    setStoryOpen(true);
    resolvedStops = resolveStory();
    showStop(stopElements[stop]);
    // Handed over while the stop is still held, so the return names `stop`
    // rather than wherever the story's scroll has got to.
    if (arrive === 'ease') {
      handOver(beginEase(REJOIN_EASE_MS, performance.now()), how);
    } else {
      handOver(STORY_DRIVING, how);
      // Make the next frame apply the stop's overlay, settings and pin.
      lastSyncedStopId = null;
    }
    heldStop = null;
    scheduleStoryFrame();
  }

  function readerOpensStory(stop = storyStopIndex()): void {
    openStory(stop, 'ease', 'open');
    rememberStoryFolded(false);
    syncUrl(true);
  }

  /** Opens a story from the Stories panel: where it was left this visit, or its start. */
  function readStory(id: string, fromStart: boolean): void {
    const left = leftAt(id) ?? 0;
    switchStory(storyToOpen(listed, id));
    readerOpensStory(fromStart ? 0 : left);
  }

  function drawStories(): void {
    const cards = listed.map(({ id, data }): StoryCard => {
      const at = leftAt(id);
      return {
        id,
        draft: data.draft,
        title: data.title,
        description: data.description,
        place:
          at === undefined
            ? null
            : { ...placeIn(data.stops, at), label: stopLabel(data.stops[at]) },
      };
    });
    storiesPanel.innerHTML = storiesHtml(cards);
  }

  // Delegated: the menus and panels are redrawn as they open.
  function onChromeClick(e: MouseEvent): void {
    const target = e.target as Element;
    if (target.closest('.menu-button')) return dispatch({ type: 'menu' });
    if (target.closest('.story-leave')) return dispatch({ type: 'choose', panel: 'overlay' });
    const chosen = storyChosen(target);
    if (chosen) return readStory(chosen.id, chosen.fromStart);
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === CONTINUE_STORY) return dispatch({ type: 'story' });
    // Menu items and the legend choose a panel; nothing else inside an open
    // panel does.
    const chooser = target.closest<HTMLElement>('.map-legend-row');
    const panelName = action ?? chooser?.dataset.panel;
    if (isPanel(panelName)) dispatch({ type: 'choose', panel: panelName });
  }
  for (const id of ['panel', 'menu-toggle', 'menu', 'map-legend']) {
    document.getElementById(id)!.addEventListener('click', onChromeClick);
  }

  // On a phone the grabber takes the open sheet to full height and back on a
  // tap, and a vertical drag does the same or folds it, judged on release.
  const grabber = document.getElementById('sheet-grabber')!;
  let dragFrom: number | null = null;
  let dragged = false;
  grabber.addEventListener('pointerdown', (e) => {
    dragFrom = e.clientY;
    dragged = false;
    grabber.setPointerCapture(e.pointerId);
  });
  grabber.addEventListener('pointerup', (e) => {
    if (dragFrom === null) return;
    const dy = e.clientY - dragFrom;
    dragFrom = null;
    if (Math.abs(dy) < DRAG_PX) return;
    dragged = true;
    dispatch({ type: 'drag', dy });
  });
  grabber.addEventListener('pointercancel', () => {
    dragFrom = null;
  });
  grabber.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dragged) {
      dragged = false;
      return;
    }
    dispatch({ type: 'drag', dy: frame.full ? DRAG_PX : -DRAG_PX });
  });

  // Typing wants room for the words and their results.
  panel.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && (t.type === 'text' || t.type === 'search')) {
      dispatch({ type: 'typing' });
    }
  });

  // Scrolling is the only thing that moves the story on. While the reader
  // drives it only counts towards handing the map back.
  storyContent.addEventListener('scroll', () => {
    if (frame.mode !== 'story' || heldStop !== null) return;

    if (driver.by === 'reader') {
      const next = storyScrolled(driver, storyPosition());
      if (next !== 'rejoin') {
        keepDriving(next);
        return;
      }
      handOver(beginEase(REJOIN_EASE_MS, performance.now()), 'rejoin');
    }
    scheduleStoryFrame();
  });

  let storyFrame: number | null = null;
  // The layer the story last painted at rest, and the stop it was for.
  let restingLayer: typeof colorLayer | null = null;
  let restingStop: ResolvedStoryStop | null = null;

  /** Repaint from the story without counting as a scroll. */
  function scheduleStoryFrame(): void {
    if (storyFrame === null) storyFrame = requestAnimationFrame(paintStoryFrame);
  }

  function currentStoryState(): InterpolatedState {
    // On a phone the story is at whichever page is showing. Moving between
    // pages is eased on a timer (beginEase), not tracked through the swipe.
    if (storyIsSideways()) {
      const page = Math.round(storyContent.scrollLeft / Math.max(1, storyContent.clientWidth));
      const stop = resolvedStops[Math.min(resolvedStops.length - 1, Math.max(0, page))];
      return { camera: { ...stop.camera }, fromStop: stop, toStop: stop, t: 0 };
    }
    return computeInterpolatedState(
      resolvedStops,
      stopElements.map((el) => el.offsetTop),
      storyContent.scrollHeight,
      storyContent.scrollTop,
      story.data.easing,
      stopElements.map((el) => el.offsetHeight),
      storyContent.clientHeight,
    );
  }

  /**
   * The driver that eases the map over `duration` from what is on screen,
   * which may be partway through an earlier ease, to where the story is. The
   * caller hands it over or keeps driving with it.
   */
  function withDefaults(layer: ColorLayer<Color | Color[] | null>): ColorLayer {
    const fill = (p: Picture<Color | Color[] | null>): Picture => ({
      colors: p.colors.map((c, i) => c ?? getDefaultColor(i)),
      growth: p.growth,
    });
    return { from: fill(layer.from), to: layer.to && fill(layer.to), t: layer.t };
  }

  function beginEase(duration: number, now: number): StoryHasMap {
    cancelCameraGlide();
    const state = currentStoryState();
    return rejoin(
      now,
      duration,
      camera,
      flatten(withDefaults(colorLayer)),
      flatten(computeBlendedColors(state.fromStop, state.toStop, state.t, verses, null)),
    );
  }

  // Reaching a stop is sent once per visit, however often the reader scrolls past it.
  function arriveAtStop(stop: ResolvedStoryStop): void {
    syncStoryStopState(stop);
    lastSyncedStopId = stop.id;
    const { number } = stopAt(resolvedStops, resolvedStops.indexOf(stop));
    storyProgressFill.style.width = `${(number / resolvedStops.length) * 100}%`;
    storyProgress.setAttribute('aria-valuenow', String(number));
    storyProgress.setAttribute('aria-valuemax', String(resolvedStops.length));
    trackStoryStop(stop.id, number, resolvedStops.length);
  }

  function paintStoryFrame(now: number): void {
    storyFrame = null;
    // The reader can take the map, or fold the story, between the scroll and this frame.
    if (frame.mode !== 'story' || heldStop !== null || driver.by === 'reader') return;

    if (driver.by === 'rejoining') {
      const next = settle(driver, now);
      keepDriving(next);
      // Done: the next lines re-sync the overlay, its settings and the pin.
      if (next.by === 'story') lastSyncedStopId = null;
    }

    const state = currentStoryState();
    // Nothing further to scroll to, so no cue to.
    document.body.classList.toggle(
      'story-at-end',
      state.toStop === resolvedStops[resolvedStops.length - 1],
    );

    // A new page on a phone eases in rather than cutting to it.
    if (storyIsSideways() && lastSyncedStopId !== null && state.toStop.id !== lastSyncedStopId) {
      keepDriving(beginEase(SWIPE_EASE_MS, now));
      // The controls and the popup move to the new stop as it starts.
      arriveAtStop(state.toStop);
    }

    if (driver.by === 'rejoining') {
      const t = easingFunctions['ease-in-out'](rejoinProgress(driver, now));
      Object.assign(camera, lerpCamera(driver.fromCamera, state.camera, t));
      setColorLayer({ from: driver.fromPicture, to: driver.toPicture, t });
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
      arriveAtStop(dominantStop);
    }

    // A scroll fires no pointer event, so re-run hit detection under the
    // last known cursor position now that the camera has moved.
    if (lastPointerPosition) {
      setHoveredVerse(
        mouseState,
        findItemAtPoint(
          verses,
          camera,
          mapViewport(),
          lastPointerPosition.x,
          lastPointerPosition.y,
        ),
      );
    }

    if (settled) {
      // At rest: paint via the explore-mode color pipeline, once per stop.
      // Scrolling within a stop changes nothing on the map, and anything else
      // that repaints replaces the layer, so it is painted again next frame.
      keepDriving(STORY_DRIVING);
      if (colorLayer !== restingLayer || state.fromStop !== restingStop) {
        applyOverlay();
        restingLayer = colorLayer;
        restingStop = state.fromStop;
      }
    } else {
      keepDriving({ by: 'story', blend: { from: state.fromStop, to: state.toStop, t: state.t } });
      blendTransition();
    }
    render();
    syncUrl();
  }

  // A stop's camera places its verse, or fits its region, against the map's
  // size, which the window sets. Outside the story the map's height is not the
  // story's, so the stops wait for openStory to resolve them.
  window.addEventListener('resize', () => {
    if (frame.mode !== 'story') return;
    resolvedStops = resolveStory();
    scheduleStoryFrame();
  });

  // Everything this does came out of the URL, so nothing it does may write to
  // the URL — see applyingExternalState in urlState.ts.
  function restoreFromUrl(): void {
    const next = resolveViewState(
      parseUrlState((id) => getOverlay(id)?.urlParams),
      { ...initialCamera, zoom: DEFAULT_ZOOM },
      (id) => getOverlay(id) !== undefined,
    );
    applyingExternalState(() => applyViewState(next));
    // The link moved the camera, not the reader.
    markViewSettled();
  }

  /**
   * Replace the whole view with `next`, in an order where each step can rely on
   * the one before: settings before the controls that draw them, the verse
   * before the camera that centres on it.
   */
  function applyViewState(next: ViewState): void {
    if (next.mode === 'explore') {
      handOver(readerTakesOver(storyPosition()), 'fold');
      setStoryOpen(false);
    }

    activateOverlay(next.overlay);
    if (currentOverlay) overlaySettings.restore(currentOverlay, next.overlayParams);
    overlayChanged(true);

    const verse = next.verse ? (findTanakhItem(verses, next.verse) ?? null) : null;
    pinnedVerse = verse;
    updateSidebarWrapper(verse, verse !== null);

    cancelCameraGlide();
    Object.assign(camera, cameraForView(next.camera, verse, mapFocus(), mapViewport()));

    applyOverlay();
    render();

    if (next.mode === 'story') {
      switchStory(storyToOpen(listed, next.story));
      const stop = resolvedStops.findIndex((s) => s.id === next.stop);
      openStory(Math.max(0, stop), 'cut', 'link');
    }
  }

  if (window.location.hash) {
    restoreFromUrl();
  }

  // A link to a story stop always opens the story.
  if (frame.mode === 'story' && opensFolded) {
    // A link that names nothing has opened the story and handed it the map.
    if (driver.by !== 'reader') handOver(readerTakesOver(0), 'fold');
    setStoryOpen(false);
  }

  const referrer = document.referrer ? new URL(document.referrer).hostname : '';
  const opened = parseUrlState();
  trackPageView(
    opened.story ?? '',
    opened.stop ?? '',
    referrer === location.hostname ? '' : referrer,
  );
  recordingDriver = true;
  markViewSettled();

  subscribeToHashChange(() => {
    restoreFromUrl();
  });

  scheduleStoryFrame();

  // Layout tests wait on this; nothing in the app reads it.
  document.documentElement.dataset.mapReady = '';

  prefetchMorphology();
}

main().catch(console.error);
