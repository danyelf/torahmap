// The app shell: the map, its panels, story, popup and links, for whichever text it is given.

import type { MapText } from './app/text.ts';
import { SEARCH_BOX_ID } from './app/search.ts';
import { mapPoint } from './mapPoint.ts';
import { TEXTS_FILE } from './verseTexts.ts';
import {
  DRAG_PX,
  STORY,
  frontToolAfter,
  landingFrame,
  nextFrame,
  type Frame,
  type FrameEvent,
  type FrontTool,
  PANEL_TITLES,
  isPanel,
} from './frame.ts';
import { CONTINUE_STORY, SHARE, menuHtml } from './menu.ts';
import { shareLink } from './share.ts';
import { storiesHtml, storyChosen, type StoryCard } from './storiesPanel.ts';
import { aboutHtml } from './aboutPanel.ts';
import { startingPointsHtml, startChosen, type StartChoice } from './startingPoints.ts';
import { hasVisited, rememberVisit } from './visits.ts';
import { overlayPanelHtml, searchPanelHtml } from './toolPanels.ts';
import { applyHebrewChoice, bindHebrewToggle } from './hebrewDisplay.ts';
import {
  arrivedWith,
  configureAnalytics,
  downloadKbps,
  trackLoadTiming,
  reportError,
  trackOverlaySwitch,
  trackPageView,
  trackSefariaClick,
  trackShare,
  trackStoryExit,
  trackStoryReturn,
  trackStoryStop,
  trackVerseClick,
  trackViewSettled,
  trackWebGLMissing,
} from './analytics.ts';
import { linkKind, linkNamesAView, DEFAULT_ZOOM, type UrlState } from '@torahmap/link';
import { NO_OVERLAY, overlayParamSpecs } from '@torahmap/overlay-catalog';
import { parseUrlState, updateUrl, subscribeToHistory, applyingExternalState } from './urlState.ts';
import { resolveViewState, cameraForView, opensFolded, type ViewState } from './viewState.ts';
import { debounce } from './utils/debounce.ts';
import { tabTitle } from './tabTitle.ts';
import { linkForScreen, pushes } from './linkForScreen.ts';
import { getSidebarElements } from './sidebar.ts';
import {
  clampZoom,
  zoomAtPoint,
  centreForFocus,
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
import { indexItems, sameItem } from './items.ts';
import { findItemAtPoint, findNearestItem } from './hitDetection.ts';
import { toolsPicture, layerToRecompute, fillDefaultColors } from './itemColoring.ts';
import {
  createRenderContext,
  createRenderState,
  rebuildGeometry,
  render as renderFrame,
  type RenderContext,
} from './rendering.ts';
import { getWebGL2 } from './webgl.ts';
import type { MapItem, VerseColor } from './types.ts';
import { createOverlaySettings, type Overlay } from './overlays/index.ts';
import type { Tools } from './overlays/types.ts';
import { prebuildCompleted } from './overlays/prebuild.ts';
import { toolsPicked, toolsShown, togglesSearch } from './tools.ts';
import { dataFor, downloadFiles, loadFiles, requiredFiles, type Loaded } from './dataFiles.ts';
import {
  downloadStages,
  filesFirst,
  staleAfterLanding,
  waitingOn,
  type LandingView,
  type OpeningView,
} from './downloads.ts';
import { LOADING, loadNotice } from './loadNotice.ts';
import { createPopupHold } from './popupHold.ts';
import { isPhone } from './phone.ts';
import type { Picture } from './geometry.ts';
import {
  ZOOM_OUT_FACTOR,
  ZOOM_IN_FACTOR,
  URL_UPDATE_DEBOUNCE_MS,
  SEARCH_WITH_OVERLAY,
  MAP_FADE,
} from './constants.ts';
import { stopLabel } from './scrollytelling/storyPanel';
import { DEFAULT_EASING, listedStories, writeStopComment } from '@torahmap/stories';
import { createStoryColumn, nearerStop, placeIn } from './scrollytelling/storyColumn.ts';
import { computeBlendedColors, stopTools, type StopTools } from './scrollytelling/overlayBlender';
import { flatten, still, type ColorLayer } from './scrollytelling/colorBlending';
import { easingFunctions, lerpCamera } from './scrollytelling/interpolation';
import {
  REJOIN_EASE_MS,
  STORY_DRIVING,
  SWIPE_EASE_MS,
  colorSource,
  type ColorSource,
  driverAfterLanding,
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
import { driverChangeEvent, type ExitHow, type ReturnHow } from './telemetry/driverChange.ts';
import type { ResolvedStoryStop } from './scrollytelling/types';
import { showLegend, type LegendRow } from './mapLegend.ts';
import './styles/map-title.css';
import './styles/zoom-buttons.css';
import './styles/frame.css';
import './styles/verse-popup.css';
import './styles/phone.css';

// How far down a phone's map a verse brought into view is put. Halfway down,
// the verse lands behind the popup that sits just above the sheet.
const PHONE_STORY_FOCUS = 0.4;

/**
 * Set the tab's title from the address rather than from any state built for
 * it, so it can never name a view the address does not hold — a write
 * suppressed by `applyingExternalState` leaves both unchanged.
 */
/** A story stop as telemetry names it: its id, and its place counted from one. */
type StopAt = { id: string; number: number };

function showTitle(): void {
  // Shortcut: the tab title and the link's overlay keys are the Tanakh's on every text.
  const title = tabTitle(parseUrlState(overlayParamSpecs), __LIVE__ ? null : __GIT_BRANCH__);
  if (document.title !== title) document.title = title;
}

function showCannotDraw(): void {
  document.body.classList.add('no-webgl');
  document.getElementById('no-webgl')!.hidden = false;
}

export async function createApp<I extends MapItem, S>(source: MapText<I, S>): Promise<void> {
  // Before the data loads, so the branch name shows from the start.
  showTitle();

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas not found');
  // Before any download: without WebGL 2 the map cannot draw at all.
  if (!getWebGL2(canvas)) {
    showCannotDraw();
    trackWebGLMissing();
    return;
  }
  // Everything but the text's first files loads behind the first frame (fileLanded).
  const firstFiles = loadFiles(source.firstFiles);
  // Compiled while the first files download. Some browsers with WebGL 2 still
  // fail to compile the shaders.
  let renderContext: RenderContext;
  try {
    renderContext = createRenderContext(canvas);
  } catch (error) {
    showCannotDraw();
    reportError('main', error, 'compiling the shaders');
    return;
  }

  let loaded: Loaded = await firstFiles;
  const text = source.open(loaded);
  const verses = text.items;
  const searchTool = text.search;
  const allOverlays: Overlay<I>[] = [searchTool, ...text.overlays];
  const getOverlay = (id: string): Overlay<I> | undefined =>
    text.overlays.find((overlay) => overlay.id === id);
  // What a story stop may name.
  const stopToolsOf: StopTools<I> = { search: searchTool, overlay: getOverlay };
  // Filled from the download stages once the opening view is known, before the first frame.
  const downloads = {
    pending: new Set<string>(),
    failed: new Set<string>(),
    closed: new Set<string>(),
  };

  // For load_timing (sendLoadTiming).
  let firstFrame = 0;
  let textsIn = 0;
  let searchReady = 0;
  let searchPrebuilt = false;
  let downloadsSettled = false;
  let downloadsStarted = false;
  let timingSent = false;

  const squares = indexItems(verses);
  const baseColors = verses.map((verse, i) => text.baseColor(verse, i));
  const base = (i: number): VerseColor => baseColors[i];
  // A picture with its holes filled with each square's base colour.
  const fill = (picture: Picture<VerseColor | null>): Picture<VerseColor> =>
    fillDefaultColors(picture, base);

  // Placed over the map; render() moves them with it.
  const labelLayer = document.createElement('div');
  labelLayer.id = 'map-labels';
  document.body.appendChild(labelLayer);
  const moveLabels = text.labels(labelLayer);

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
  // The window resizing is not the only thing that resizes the map: on a phone
  // it grows as the sheet lowers.
  new ResizeObserver(() => {
    canvasOrigin = canvas.getBoundingClientRect();
    resizeCanvas();
    render();
  }).observe(canvas);

  /** Where a pointer is on the map: the canvas need not start at the window's corner. */
  const onMap = (e: { clientX: number; clientY: number }): { x: number; y: number } =>
    mapPoint(e.clientX, e.clientY, canvasOrigin);

  const renderState = createRenderState(renderContext, verses, dpr);

  let currentOverlay: Overlay<I> | null = null;
  const currentOverlayId = (): string => currentOverlay?.id ?? NO_OVERLAY;

  // Every overlay's settings, kept while another overlay is showing.
  const overlaySettings = createOverlaySettings();

  function currentSettings(): unknown {
    return currentOverlay ? overlaySettings.get(currentOverlay) : undefined;
  }

  // The one colour layer on the map: either a settled overlay's colours or a
  // story transition's blend. The shader draws the hover on top of it
  // (render). A pin never recomputes it; a hover does only when the colours
  // depend on the hovered verse, which a blend's may.
  let colorLayer: ColorLayer<VerseColor | null> = still({ colors: [] });
  // What the verse buffer was last built from. A fade in progress changes only
  // its amount, so a frame that keeps these redraws without rebuilding.
  let built: unknown[] = [];

  const visited = hasVisited();
  const startsFolded = opensFolded(parseUrlState(), visited);
  let driver: Driver = startsFolded ? readerTakesOver(0) : STORY_DRIVING;
  configureAnalytics({ getMode: () => driverKind(driver) });

  function composite(): void {
    const { from, to, t } = colorLayer;
    renderState.fade = to ? t : 0;

    // The colour arrays, not the pictures: a story stop's are cached, while
    // the pictures around them are made afresh each frame.
    const inputs = [from.colors, from.growth, from.rings, to?.colors, to?.growth, to?.rings];
    if (inputs.every((input, i) => input === built[i])) return;
    built = inputs;

    rebuildGeometry(renderContext.gl, renderState, fill(from), to && fill(to));
  }

  function setColorLayer(next: ColorLayer<VerseColor | null>): void {
    colorLayer = next;
    composite();
  }

  /** The overlay and the search as they stand, each null while off. */
  function toolsNow(): Tools<I> {
    return toolsShown(
      currentOverlay,
      currentSettings(),
      searchTool,
      overlaySettings.get(searchTool),
      loaded,
    );
  }

  /** The overlay and the search as picked, whether or not their data is in. */
  function pickedTools(): Overlay<I>[] {
    return toolsPicked(currentOverlay, searchTool, overlaySettings.get(searchTool));
  }

  function searching(): boolean {
    return searchTool.isSearching(overlaySettings.get(searchTool));
  }

  /** The non-match dim a front tool rests at: search's own, or none for the overlay. */
  function dimFor(front: FrontTool): number {
    return front === 'search' ? SEARCH_WITH_OVERLAY.NON_MATCH_DIM : 1;
  }

  // Search or the overlay, whichever's panel opened last (src/frame.ts). Only
  // matters with both tools on, where it decides which one dims for the other.
  let frontTool: FrontTool = 'overlay';
  let fadeFrame: number | null = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function cancelFade(): void {
    if (fadeFrame !== null) {
      cancelAnimationFrame(fadeFrame);
      fadeFrame = null;
    }
  }

  function updateLegend(): void {
    const tools = toolsNow();
    const picked = { search: searching() ? searchTool : null, overlay: currentOverlay };
    const rows: LegendRow[] = [];
    const warnings: Node[] = [];
    for (const panel of ['search', 'overlay'] as const) {
      const on = tools[panel];
      const tool = picked[panel];
      if (on) {
        rows.push({
          panel,
          name: on.tool.name,
          summary: on.tool.summary?.(on.settings, on.data) ?? {},
        });
      } else if (tool) {
        // A picked tool without its data: its files are on their way, or one failed.
        const files = requiredFiles(tool);
        if (waitingOn(files, downloads) === 'loading') {
          rows.push({ panel, name: tool.name, summary: { detail: LOADING }, loading: true });
        } else {
          const notice = noticeFor(files);
          if (notice) warnings.push(notice);
        }
      }
    }
    showLegend(mapLegend, rows, warnings);
  }

  /** The map exploring shows: the tools as they stand, the front one in front. */
  function explorePicture(): Picture<VerseColor | null> {
    return toolsPicture(toolsNow(), verses, mouseState.hoveredVerse, base, dimFor(frontTool));
  }

  function applyTools(): void {
    cancelFade();
    setColorLayer(still(explorePicture()));
  }

  /**
   * Cross-fade the map from what it shows to `to` over MAP_FADE.DURATION_MS
   * through the renderer's own picture blend — the one a story ease uses —
   * then `settle` paints the picture it rests on. Snaps under reduced motion.
   */
  function fadeMap(to: Picture, settle: () => void): void {
    cancelFade();
    if (reducedMotion.matches) {
      settle();
      render();
      return;
    }
    // flatten collapses a fade already in progress to where it is, as a story
    // ease starting mid-blend does (beginEase).
    const from = flatten(withDefaults(colorLayer));
    const since = performance.now();
    const step = (now: number): void => {
      const raw = Math.min(1, (now - since) / MAP_FADE.DURATION_MS);
      fadeFrame = null;
      if (raw >= 1) {
        // The settled picture, not `to`: fillDefaultColors filled the holes a
        // real overlay leaves for an uncoloured match, which would hover
        // wrong (fillDefaultColors marks uncoloured only the holes it fills
        // itself) until the next repaint.
        settle();
      } else {
        setColorLayer({ from, to, t: easingFunctions[DEFAULT_EASING](raw) });
        fadeFrame = requestAnimationFrame(step);
      }
      render();
    };
    fadeFrame = requestAnimationFrame(step);
  }

  /** Move the front tool to `next`, fading the map; with only one tool on there is nothing to fade. */
  function setFrontTool(next: FrontTool): void {
    if (next === frontTool) return;
    frontTool = next;
    const tools = toolsNow();
    if (!tools.search || !tools.overlay) {
      applyTools();
      render();
      return;
    }
    fadeToTools();
  }

  function fadeToTools(): void {
    fadeMap(fill(explorePicture()), applyTools);
  }

  /** The story's blend between two stops, or null while it is not between them. */
  function blendColors(): ColorLayer | null {
    if (driver.by !== 'story' || !driver.blend) return null;
    const { from, to, t } = driver.blend;
    return computeBlendedColors(
      from,
      to,
      t,
      verses,
      mouseState.hoveredVerse,
      loaded,
      base,
      stopToolsOf,
    );
  }

  function blendTransition(): void {
    cancelFade();
    const colors = blendColors();
    if (colors) setColorLayer(colors);
  }

  /**
   * Repaint after the hovered or pinned verse changes. `hoveredBefore` is the
   * hover the colour layer was drawn for; a pin leaves the hover alone, so it
   * passes nothing and only composites.
   */
  function repaint(hoveredBefore: I | null = mouseState.hoveredVerse): void {
    const layer = layerToRecompute(
      colorSource(driver),
      toolsNow().overlay,
      hoveredBefore,
      mouseState.hoveredVerse,
    );
    if (layer === 'blend') blendTransition();
    else if (layer === 'overlay') applyTools();
    else composite();
    render();
  }

  /**
   * Sync explore-mode state (overlay, params, pinned verse) to a story stop.
   * Does NOT paint the buffer — caller decides (settled paints via applyTools,
   * mid-scroll lets the blender paint), so mid-scroll can keep
   * `currentOverlay`/`pinnedVerse` in sync with the stop the reader is heading
   * toward, for the sidebar and the hover text.
   *
   * The stop is external state, like a link, so URL writes are off throughout:
   * in story mode the URL is the stop id, and an explore-mode URL has no
   * business overwriting it.
   */
  function syncStoryStopState(stop: ResolvedStoryStop): void {
    applyingExternalState(() => syncStoryStopStateUnguarded(stop));
  }

  function syncStoryStopStateUnguarded(stop: ResolvedStoryStop): void {
    const wantedOverlay = stop.overlay ?? NO_OVERLAY;
    if (wantedOverlay !== currentOverlayId()) {
      activateOverlay(wantedOverlay);
    }

    if (currentOverlay) overlaySettings.restore(currentOverlay, stop.overlayParams ?? {});
    overlaySettings.restore(searchTool, stop.searchParams ?? {});
    searchChanged(true);
    overlayChanged(true);

    // A stop with a search puts search in front for it, whether or not the
    // reader has a panel open to see it (stops don't open panels).
    if (searching()) frontTool = 'search';

    // Sync pinnedVerse from stop (without going through pinVerse, which writes URL/telemetry)
    if (stop.verse) {
      const verse = squares.find(stop.verse);
      if (verse && !sameItem(pinnedVerse, verse)) {
        pinnedVerse = verse;
        updateSidebarWrapper(verse, true);
      }
    } else if (pinnedVerse) {
      pinnedVerse = null;
      updateSidebarWrapper(null);
    }
  }

  const camera = text.startCamera(mapViewport());

  let pinnedVerse: I | null = null;

  const mouseState = createMouseState<I>();

  // A scroll fires no pointer event, so the mid-scroll branch needs the last
  // known cursor position to re-run hit detection as the camera moves under it.
  let lastPointerPosition: { x: number; y: number } | null = null;

  const touchState = createTouchState();

  const storyContent = document.getElementById('story-content')!;

  const panel = document.getElementById('panel')!;
  const droppedMenu = document.getElementById('menu')!;
  const shareStatus = document.getElementById('share-status')!;
  const storyProgress = document.getElementById('story-progress')!;
  const storyProgressTitle = document.getElementById('story-progress-title')!;
  const toolsTitle = document.getElementById('tools-title')!;
  const panelBody = document.getElementById('panel-body')!;
  const storiesPanel = document.getElementById('stories-panel')!;
  const aboutPanel = document.getElementById('about-panel')!;
  document.getElementById('overlay-panel')!.innerHTML = overlayPanelHtml();
  document.getElementById('search-panel')!.innerHTML = searchPanelHtml();
  const mapLegend = document.getElementById('map-legend')!;
  const overlayDescription = document.getElementById('overlay-description')!;
  const menuToggle = document.getElementById('menu-toggle')!;

  // What the panel shows (src/frame.ts); the story is open while its mode is 'story'.
  let frame: Frame = STORY;

  // The layout last put on the page, so a resize can tell when it crosses over.
  let phone = isPhone();

  function showStory(): void {
    const previous = frame;
    frame = STORY;
    applyFrame(previous);
  }

  /** Closes the story, landing on `exploring`. */
  function closeStory(exploring: Frame): void {
    const previous = frame;
    if (frame.mode === 'story') {
      storyColumn.fold();
      frame = exploring;
    }
    applyFrame(previous);
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
      const { story, place } = storyColumn.where();
      droppedMenu.innerHTML = menuHtml({ ...place, title: story.data.title });
    }
    const opened = frame.open !== previous?.open;
    if (opened && frame.open === 'stories') drawStories();
    if (opened && frame.open === 'about') {
      // Shortcut: the About panel is the Tanakh's on every text.
      aboutPanel.innerHTML = aboutHtml(allOverlays);
      bindHebrewToggle(aboutPanel.querySelector<HTMLButtonElement>('#hebrew-toggle')!);
    }
    setFrontTool(frontToolAfter(frontTool, frame.open));
    measureSheet();
    // Hidden, the menu would drop focus to the top of the page.
    if (focusInMenu && !frame.menu) menuToggle.focus();
  }

  // An exploring phone's sheet is as tall as its content, or gone with nothing
  // open; the map, the legend and the verse popup make room for it. Full
  // height grows over the map instead.
  function measureSheet(): void {
    if (!phone || frame.full) return;
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
    const next = nextFrame(frame, event, phone);
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

  /** The stop the story is at, as a change of hands is told against it. */
  function storyAt(): StopAt {
    const { stop, place } = storyColumn.where();
    return { id: stop.id, number: place.number };
  }

  // Off until the page view is sent: who drives when the page opens is part of it.
  let recordingDriver = false;

  // Every change of driver goes through here, by way of handOver or keepDriving.
  /** `at` is the stop the change of hands is told against: by default where the story is. */
  function setDriver(next: Driver, how: ExitHow | ReturnHow | null, at?: StopAt): void {
    // The story taking the map back mid-fade would otherwise still get the
    // fade's later frames, painting a stale explore picture over its own.
    if (next.by !== 'reader') cancelFade();
    const event = recordingDriver ? driverChangeEvent(driver, next) : null;
    driver = next;
    if (!event) return;
    const stop = at ?? storyAt();
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
  function handOver(next: StoryHasMap, how: ReturnHow, at?: StopAt): void;
  function handOver(next: Driver, how: ExitHow | ReturnHow, at?: StopAt): void {
    setDriver(next, how, at);
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
    handOver(readerTakesOver(storyColumn.position()), how);
    applyTools();
  }

  // Track the story stop whose explore-mode state (overlay, params, pinnedVerse)
  // is currently synced. Used to skip redundant resyncs every scroll frame.
  // Reset whenever the story comes back, since the reader may have changed the
  // overlay or pin out from under it.
  let lastSyncedStopId: string | null = null;
  let pointerDownPos: { x: number; y: number; time: number } | null = null;
  const TAP_MAX_DURATION = 300; // max ms to count as tap

  function render(): void {
    const offset = renderFrame(
      renderContext,
      renderState,
      camera,
      mouseState.hoveredVerse,
      pinnedVerse,
    );
    moveLabels(offset, camera.zoom);
  }

  /** The cursor over `verse`, or over no verse: a pointer only over one while another is pinned. */
  function setCursorOver(verse: I | null): void {
    canvas.style.cursor = pinnedVerse && verse ? 'pointer' : 'default';
  }

  function centerOnVerse(verse: I): void {
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
  function glideToVerse(verse: I): void {
    cancelCameraGlide();

    const target = viewFocusedOn(verse, camera.zoom, RESULT_CLICK_ZOOM, mapFocus(), mapViewport());

    stopCameraGlide = animateCameraTo(camera, target, () => {
      render();
      debouncedCameraSettled();
    });
  }

  // pinVerse, unpinVerse and zoomAt answer only the reader's gestures; the story
  // sets the view directly. So each takes the wheel.
  function pinVerse(verse: I, centerCamera: boolean = false): void {
    takeOver('takeover');
    const tracked = text.track.verse(verse);
    trackVerseClick(tracked.book, tracked.chapter, tracked.verse);
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

      if (dx < DRAG_PX && dy < DRAG_PX && duration < TAP_MAX_DURATION) {
        const verse = findItemAtPoint(verses, camera, mapViewport(), p.x, p.y);
        if (verse) {
          if (sameItem(pinnedVerse, verse)) {
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

    if (wasDragging) setCursorOver(findItemAtPoint(verses, camera, mapViewport(), p.x, p.y));
  });

  canvas.addEventListener('pointerleave', () => {
    const previousHover = mouseState.hoveredVerse;
    clearHover(mouseState);
    lastPointerPosition = null;
    canvas.style.cursor = 'default';

    if (previousHover) repaint(previousHover);
  });

  const sidebarElements = getSidebarElements();
  const popupHold = createPopupHold();

  function buildOverlayParamsForUrl(): Record<string, string> {
    return currentOverlay ? overlaySettings.toUrl(currentOverlay) : {};
  }

  function buildCurrentUrlState(): UrlState {
    const state: UrlState = {
      overlayParams: {},
      searchParams: overlaySettings.toUrl(searchTool),
    };

    if (currentOverlay) {
      state.overlay = currentOverlay.id;
      state.overlayParams = buildOverlayParamsForUrl();
    }

    if (pinnedVerse) {
      state.verse = pinnedVerse.id;
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

  /** Write the URL for what is on screen; `push` asks for a history entry, for a discrete step rather than a pan or a scroll. */
  function syncUrl(push: boolean = false): void {
    const { story, stop } = storyColumn.where();
    const next = linkForScreen({
      mode: frame.mode,
      driver: driverKind(driver),
      story: { id: story.id, stop: stop.id },
      explore: buildCurrentUrlState,
    });
    updateUrl(next, pushes(parseUrlState(), next, push));
    showTitle();
  }

  // For a write asked every frame, as a story scroll does. It asks for no history
  // entry, so a late one loses none, and it reads the screen as it is when it fires.
  const syncUrlSoon = debounce(() => syncUrl(false), URL_UPDATE_DEBOUNCE_MS);

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
    const near = findNearestItem(verses, camera.x, camera.y);
    const where = near ? text.track.area(near) : { area: '', section: '' };
    trackViewSettled(where.area, where.section, camera.zoom);
  }, URL_UPDATE_DEBOUNCE_MS);

  function updateSidebarWrapper(verse: I | null, isPinned: boolean = false): void {
    const file = verse && text.popupFile(verse);
    if (file) fetchPopupFile(file);
    text.drawPopup(sidebarElements, verse, {
      loaded,
      notice: file ? noticeFor([file]) : null,
      ...toolsNow(),
      pinned: isPinned,
    });
  }

  /**
   * A square's text downloads when its popup first shows, unless it is in, on
   * its way or failed. Until the downloads start, the opening view's popup
   * file is left to their first stage (filesFirst).
   */
  function fetchPopupFile(path: string): void {
    if (!downloadsStarted) return;
    if (loaded.has(path) || downloads.pending.has(path) || downloads.failed.has(path)) return;
    downloads.pending.add(path);
    void downloadFiles([path], { landed: fileLanded, failed: fileFailed });
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

  /** Say in the search caption that search's files are loading or failed; search fills it once they are in. */
  function showSearchNotice(): void {
    const caption = searchControls.querySelector('#search-hit-caption');
    if (!caption) return;
    const notice = noticeFor(requiredFiles(searchTool));
    if (notice) caption.replaceChildren(notice);
    else caption.querySelector('.load-notice')?.remove();
  }

  /** What a place waiting on `paths` shows: a loading notice, a closable warning, or nothing. */
  function noticeFor(paths: readonly string[]): HTMLElement | null {
    const state = waitingOn(paths, downloads);
    return state && loadNotice(state, () => closeWarning(paths));
  }

  /** Redraw every place that says a file is loading or failed. */
  function showLoadState(): void {
    updateLegend();
    showSearchNotice();
    refreshVersePopup();
  }

  /** The reader closed a warning: it stays closed for those files. */
  function closeWarning(paths: readonly string[]): void {
    for (const path of paths) if (downloads.failed.has(path)) downloads.closed.add(path);
    showLoadState();
  }

  // A drag pans the map, and a mouse moving over it hovers. Two fingers pinch.
  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (touchState.activeTouches.size >= 2) return;
    const p = onMap(e);

    if (mouseState.isDragging) {
      const dx = p.x - mouseState.dragStart.x;
      const dy = p.y - mouseState.dragStart.y;
      if (dx !== 0 || dy !== 0) takeOver('takeover');
      camera.x -= dx / camera.zoom;
      camera.y -= dy / camera.zoom;
      mouseState.dragStart = { x: p.x, y: p.y };
      render();
      return;
    }
    if (e.pointerType === 'touch') return;

    lastPointerPosition = { x: p.x, y: p.y };
    const verse = findItemAtPoint(verses, camera, mapViewport(), p.x, p.y);
    const previousHover = mouseState.hoveredVerse;
    setHoveredVerse(mouseState, verse);
    setCursorOver(verse);
    if (!sameItem(previousHover, verse)) repaint(previousHover);
    // A pinned verse keeps the popup.
    if (!pinnedVerse) updateSidebarWrapper(verse);
  });

  sidebarElements.closeBtn?.addEventListener('click', () => {
    unpinVerse();
  });

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && frame.menu) {
      dispatch({ type: 'menu' });
      return;
    }
    if (e.key === 'Escape' && !pinnedVerse) {
      dispatch({ type: 'close' });
      return;
    }
    if (!pinnedVerse) return;

    if (e.key === 'Escape') {
      unpinVerse();
      return;
    }

    let targetVerse: I | null = null;

    if (e.key === 'ArrowRight') {
      targetVerse = squares.step(pinnedVerse, 1);
    } else if (e.key === 'ArrowLeft') {
      targetVerse = squares.step(pinnedVerse, -1);
    }

    if (targetVerse) {
      pinVerse(targetVerse, true);
    }
  });

  const overlaySelect = document.getElementById('overlay-select') as HTMLSelectElement;

  // After the "None" option the picker starts with, in the order
  // @torahmap/overlay-catalog offers them.
  for (const overlay of text.overlays) {
    const option = document.createElement('option');
    option.value = overlay.id;
    option.textContent = overlay.name;
    overlaySelect?.appendChild(option);
  }

  const overlayControlsContainer = document.getElementById('overlay-controls');
  const searchControls = document.getElementById('search-controls')!;
  const overlayLegendContainer = document.getElementById('overlay-legend');
  const overlayStarts = document.getElementById('overlay-starts')!;

  /** Switch the active overlay without drawing its UI, painting or writing the URL. */
  function activateOverlay(id: string): void {
    currentOverlay?.destroy?.();
    currentOverlay = getOverlay(id) ?? null;
  }

  function renderOverlayLegend(): void {
    if (overlayLegendContainer) {
      overlayLegendContainer.innerHTML = '';
      const overlay = currentOverlay;
      if (overlay) {
        overlay.renderLegend?.(overlayLegendContainer, currentSettings(), dataFor(overlay, loaded));
      }
    }
  }

  /** Draw the active overlay's controls into what is already there. */
  function renderOverlayControls(): void {
    const overlay = currentOverlay;
    if (!overlay || !overlayControlsContainer) return;
    overlay.renderControls?.(
      overlayControlsContainer,
      overlaySettings.get(overlay),
      (update) => changeSettings(overlay, update),
      dataFor(overlay, loaded),
    );
  }

  /**
   * Redraw everything that shows the active overlay or its settings. `fresh`
   * clears the controls first, for a different overlay or settings from
   * elsewhere; a reader's own edit redraws into them, keeping their focus.
   */
  function overlayChanged(fresh: boolean): void {
    drawOverlayPanel(fresh);
    updateLegend();
    refreshVersePopup();
  }

  function drawOverlayPanel(fresh: boolean): void {
    if (fresh) {
      if (overlaySelect) overlaySelect.value = currentOverlayId();
      if (overlayControlsContainer) overlayControlsContainer.innerHTML = '';
      overlayStarts.innerHTML = currentOverlay
        ? ''
        : startingPointsHtml(searchTool, text.overlays, listed);
    }
    renderOverlayControls();
    renderOverlayLegend();
    overlayDescription.textContent = currentOverlay?.description ?? '';
  }

  /**
   * Apply a change a reader asked for to the settings held for `overlay`. A
   * control left over from an overlay that is no longer showing still changes
   * that overlay's settings, but paints nothing.
   */
  function changeSettings<S>(overlay: Overlay<I, S>, update: (current: S) => S): void {
    overlaySettings.set(overlay, update(overlaySettings.get(overlay)));
    if (overlay !== currentOverlay) return;

    applyTools();
    overlayChanged(false);
    render();
    syncUrl(false);
  }

  /**
   * Redraw what shows the search. `fresh` clears the controls first, for
   * settings from a link or a story stop; a reader's own edit redraws into
   * them, keeping their focus.
   */
  function searchChanged(fresh: boolean): void {
    drawSearchPanel(fresh);
    updateLegend();
    refreshVersePopup();
  }

  function drawSearchPanel(fresh: boolean): void {
    if (fresh) {
      searchTool.destroy?.();
      searchControls.innerHTML = '';
      searchTool.telemetry.replaced(overlaySettings.get(searchTool), dataFor(searchTool, loaded));
    }
    searchTool.renderControls?.(
      searchControls,
      overlaySettings.get(searchTool),
      changeSearch,
      dataFor(searchTool, loaded),
    );
    showSearchNotice();
  }

  function changeSearch(update: (current: S) => S): void {
    const before = overlaySettings.get(searchTool);
    const after = update(before);
    overlaySettings.set(searchTool, after);
    searchTool.telemetry.readerChanged(after, dataFor(searchTool, loaded));
    applyTools();
    searchChanged(false);
    render();
    syncUrl(togglesSearch(searchTool, before, after));
  }

  function setOverlay(id: string): void {
    trackOverlaySwitch(id, currentOverlayId());
    activateOverlay(id);
    overlayChanged(true);
    applyTools();
    render();
    syncUrl(true);
  }

  // sendBeacon survives the page navigating away, so following the link to
  // Sefaria doesn't lose the event.
  sidebarElements.link?.addEventListener('click', () => {
    const verse = pinnedVerse ?? mouseState.hoveredVerse;
    if (!verse) return;
    const tracked = text.track.verse(verse);
    trackSefariaClick(tracked.book, tracked.chapter, tracked.verse, currentOverlayId());
  });

  overlaySelect?.addEventListener('change', () => {
    setOverlay(overlaySelect.value);
  });

  // Capture mode: Ctrl+Shift+C copies current camera state as a story stop comment
  if (import.meta.hot) {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        const params: Record<string, string> = {
          ...(currentOverlay && {
            overlay: currentOverlay.id,
            ...overlaySettings.toUrl(currentOverlay),
          }),
          ...overlaySettings.toUrl(searchTool),
        };
        if (pinnedVerse) {
          params.verse = pinnedVerse.id;
        }
        const comment = writeStopComment('STOP_ID', camera, params);
        navigator.clipboard.writeText(comment);
        console.log(`[capture] Copied to clipboard:\n${comment}`);
      }
    });
  }

  text.start?.({
    loaded: () => loaded,
    holdPopup: popupHold.hold,
    pinAndGlide: (verse) => {
      // A full-height sheet would hide the glide.
      if (frame.full) setFrame({ ...frame, full: false });
      pinVerse(verse);
      glideToVerse(verse);
    },
    searchSettings: () => overlaySettings.get(searchTool),
    changeSearch: (update) => {
      takeOver('takeover');
      changeSearch(update);
      if (frame.mode === 'explore' && frame.open !== 'search') {
        dispatch({ type: 'choose', panel: 'search' });
      }
    },
    storiesChanged: (list) => {
      listed = listedStories(list, !__LIVE__);
      storyColumn.storiesChanged(listed);
      // Whatever the edited stop holds is applied on the next frame.
      lastSyncedStopId = null;
      scheduleStoryFrame();
      drawOverlayPanel(true);
    },
  });
  searchChanged(true);

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
    const height = phone ? canvas.clientHeight * PHONE_STORY_FOCUS : canvas.clientHeight / 2;
    return { x: canvas.clientWidth / 2, y: height };
  }

  let listed = listedStories(text.stories.list, !__LIVE__);
  const storyColumn = createStoryColumn(
    { content: storyContent, progress: storyProgress, title: storyProgressTitle },
    listed,
    parseUrlState().story ?? null,
    (stops) =>
      text.stories.resolve(stops, initialCamera, verses, squares, mapFocus(), mapViewport()),
  );
  storyColumn.onMove(storyMoved);
  configureAnalytics({ getStory: () => storyColumn.where().story.id });
  applyFrame();

  window.addEventListener('resize', () => {
    // Crossing into or out of phone width turns the story from a column into a
    // row, or back, and moves where it centres verses.
    const relaid = isPhone() !== phone;
    if (relaid) {
      phone = !phone;
      if (!phone) document.documentElement.style.removeProperty('--sheet-shown');
      setFrame(nextFrame(frame, { type: 'layout-changed' }, phone));
    }
    storyColumn.resized();
    // The column's scroll back to its stop was ours, not the reader's.
    if (relaid && frame.mode === 'story' && driver.by === 'reader') {
      keepDriving(readerTakesOver(storyColumn.position()));
    }
    if (relaid || frame.mode === 'story') scheduleStoryFrame();
  });

  function leaveStory(exploring: Frame): void {
    takeOver('fold');
    // Exploring keeps only what a link carries, so a stop's highlight stays behind.
    if (currentOverlay) {
      overlaySettings.restore(currentOverlay, overlaySettings.toUrl(currentOverlay));
      applyTools();
    }
    closeStory(exploring);
    rememberVisit();
    render();
    syncUrl(true);
  }

  /**
   * Open the story at `stop` and hand it the map, easing from the reader's view
   * or cutting to the stop, as a link does.
   */
  /** Open the column at a stop (see StoryColumn.open) and hand it the map, easing there or cutting, as a link does. */
  function openStory(
    arrive: 'ease' | 'cut',
    how: ReturnHow,
    storyId?: string | null,
    stop?: string | null,
  ): void {
    showStory();
    const opened = storyColumn.open(storyId, stop);
    // Told against the stop opened, not wherever the column's scroll puts it.
    const at = { id: opened.stop.id, number: opened.place.number };
    if (arrive === 'ease') {
      handOver(beginEase(REJOIN_EASE_MS, performance.now()), how, at);
    } else {
      handOver(STORY_DRIVING, how, at);
      // Make the next frame apply the stop's overlay, settings and pin.
      lastSyncedStopId = null;
    }
    scheduleStoryFrame();
  }

  function readerOpensStory(storyId?: string, stop?: string | null): void {
    openStory('ease', 'open', storyId, stop);
    syncUrl(true);
  }

  /** Opens a story from the Stories panel: where it was left this visit, or its start. */
  function readStory(id: string, fromStart: boolean): void {
    readerOpensStory(id, fromStart ? null : undefined);
  }

  function takeStart(choice: StartChoice): void {
    if (choice.kind === 'story') return readStory(choice.id, false);
    if (choice.kind === 'search') {
      dispatch({ type: 'choose', panel: 'search' });
      document.getElementById(SEARCH_BOX_ID)?.focus();
      return;
    }
    setOverlay(choice.id);
  }

  function drawStories(): void {
    const cards = listed.map(({ id, data }): StoryCard => {
      const at = storyColumn.leftAt(id);
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
  async function onChromeClick(e: MouseEvent): Promise<void> {
    const target = e.target as Element;
    if (target.closest('.menu-button')) return dispatch({ type: 'menu' });
    if (target.closest('.panel-close')) return dispatch({ type: 'close' });
    if (target.closest('.story-leave'))
      return dispatch({
        type: 'choose',
        panel: searching() ? 'search' : 'overlay',
      });
    const chosen = storyChosen(target);
    if (chosen) return readStory(chosen.id, chosen.fromStart);
    const start = startChosen(target);
    if (start) return takeStart(start);
    const actionItem = target.closest<HTMLElement>('[data-action]');
    const action = actionItem?.dataset.action;
    if (action === CONTINUE_STORY) return dispatch({ type: 'story' });
    if (action === SHARE) {
      // A share already in flight ignores a second tap: sharing again would
      // double the clipboard write, or, mid share-sheet, throw InvalidStateError.
      if (actionItem!.dataset.sharePending) return;
      actionItem!.dataset.sharePending = 'true';
      try {
        await shareCurrentView(actionItem!);
      } finally {
        delete actionItem!.dataset.sharePending;
      }
      return;
    }
    // Menu items and the legend choose a panel; nothing else inside an open
    // panel does.
    const chooser = target.closest<HTMLElement>('.map-legend-row');
    const panelName = action ?? chooser?.dataset.panel;
    if (isPanel(panelName)) dispatch({ type: 'choose', panel: panelName });
  }

  /** A pan's debounced address write may not have landed yet, so it is brought current first. */
  async function shareCurrentView(item: HTMLElement): Promise<void> {
    // An unchanged live region doesn't reliably re-announce; clearing it here,
    // ahead of the await below, means even a repeated outcome starts from empty.
    shareStatus.textContent = '';
    syncUrl(false);
    const shared = parseUrlState(overlayParamSpecs);
    const outcome = await shareLink(location.href, document.title, {
      share: navigator.share?.bind(navigator),
      writeText: (t) => navigator.clipboard.writeText(t),
      coarsePointer: matchMedia('(pointer: coarse)').matches,
    });
    trackShare({
      how: outcome,
      what: linkKind(shared),
      story: shared.story ?? '',
      stop_id: shared.stop ?? '',
      overlay: shared.overlay ?? NO_OVERLAY,
      searching: shared.searchParams ? 1 : 0,
      pinned: shared.verse ? 1 : 0,
    });
    if (outcome === 'copied' || outcome === 'failed') {
      const label = outcome === 'copied' ? 'Link copied' : "Couldn't copy";
      item.innerHTML =
        outcome === 'copied' ? `${label} <span class="menu-confirm-mark">✓</span>` : label;
      shareStatus.textContent = label;
      // Reopening the menu redraws its items, detaching this one; a stale
      // timer must not then close whatever menu is open by the time it fires.
      setTimeout(() => {
        if (frame.menu && item.isConnected) dispatch({ type: 'menu' });
      }, 1500);
    } else if (frame.menu) {
      dispatch({ type: 'menu' });
    }
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

  // Moving the story is the only thing that moves it on. While the reader
  // drives it only counts towards handing the map back.
  function storyMoved(): void {
    if (frame.mode !== 'story') return;

    if (driver.by === 'reader') {
      const next = storyScrolled(driver, storyColumn.position());
      if (next !== 'rejoin') {
        keepDriving(next);
        return;
      }
      handOver(beginEase(REJOIN_EASE_MS, performance.now()), 'rejoin');
    }
    scheduleStoryFrame();
  }

  let storyFrame: number | null = null;
  // The layer the story last painted at rest, and the stop it was for.
  let restingLayer: typeof colorLayer | null = null;
  let restingStop: ResolvedStoryStop | null = null;

  /** Repaint from the story without counting as a scroll. */
  function scheduleStoryFrame(): void {
    if (storyFrame === null) storyFrame = requestAnimationFrame(paintStoryFrame);
  }

  /** `layer`, its null colours filled so a blend never mixes in mergePictures's placeholder. */
  function withDefaults(layer: ColorLayer<VerseColor | null>): ColorLayer {
    return {
      from: fill(layer.from),
      to: layer.to && fill(layer.to),
      t: layer.t,
    };
  }

  /**
   * The driver that eases the map over `duration` from what is on screen,
   * which may be partway through an earlier ease, to where the story is. The
   * caller hands it over or keeps driving with it.
   */
  function beginEase(duration: number, now: number): StoryHasMap {
    cancelCameraGlide();
    return rejoin(now, duration, camera, flatten(withDefaults(colorLayer)), storyPicture());
  }

  /** The story's picture where it is now. */
  function storyPicture(): Picture {
    const state = storyColumn.view();
    return flatten(
      computeBlendedColors(
        state.fromStop,
        state.toStop,
        state.t,
        verses,
        null,
        loaded,
        base,
        stopToolsOf,
      ),
    );
  }

  let firstStopId: string | null = null;

  // Reaching a stop is sent once per visit, however often the reader scrolls past it.
  function arriveAtStop(stop: ResolvedStoryStop): void {
    firstStopId ??= stop.id;
    if (stop.id !== firstStopId) rememberVisit();
    syncStoryStopState(stop);
    lastSyncedStopId = stop.id;
    const { place } = storyColumn.where();
    trackStoryStop(stop.id, place.number, place.total);
  }

  function paintStoryFrame(now: number): void {
    storyFrame = null;
    // The reader can take the map, or fold the story, between the scroll and this frame.
    if (frame.mode !== 'story' || driver.by === 'reader') return;

    if (driver.by === 'rejoining') {
      const next = settle(driver, now);
      keepDriving(next);
      // Done: the next lines re-sync the overlay, its settings and the pin.
      if (next.by === 'story') lastSyncedStopId = null;
    }

    const state = storyColumn.view();

    // A new page on a phone eases in rather than cutting to it.
    if (isPhone() && lastSyncedStopId !== null && state.toStop.id !== lastSyncedStopId) {
      keepDriving(beginEase(SWIPE_EASE_MS, now));
      // The controls and the popup move to the new stop as it starts.
      arriveAtStop(state.toStop);
    }

    if (driver.by === 'rejoining') {
      const t = easingFunctions[DEFAULT_EASING](rejoinProgress(driver, now));
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
    // Sync explore state to the nearer stop on every change, so hover events
    // mid-scroll find a consistent currentOverlay/pinnedVerse.
    const nearer = nearerStop(state);
    if (lastSyncedStopId !== nearer.id) arriveAtStop(nearer);

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
        applyTools();
        restingLayer = colorLayer;
        restingStop = state.fromStop;
      }
    } else {
      keepDriving({ by: 'story', blend: { from: state.fromStop, to: state.toStop, t: state.t } });
      blendTransition();
    }
    render();
    syncUrlSoon();
  }

  /** What the link or the story stop shows first. */
  function openingView(): OpeningView<I> {
    if (frame.mode !== 'story')
      return { tools: pickedTools(), popup: pinnedVerse && text.popupFile(pinnedVerse) };
    const { stop } = storyColumn.where();
    const verse = stop.verse ? squares.find(stop.verse) : null;
    return { tools: stopTools(stop, stopToolsOf), popup: verse && text.popupFile(verse) };
  }

  function landingView(): LandingView<I> {
    const shown = pinnedVerse ?? mouseState.hoveredVerse;
    let map = pickedTools();
    if (driver.by === 'story' && driver.blend) {
      map = [
        ...stopTools(driver.blend.from, stopToolsOf),
        ...stopTools(driver.blend.to, stopToolsOf),
      ];
    } else if (driver.by === 'rejoining') {
      const state = storyColumn.view();
      map = [...stopTools(state.fromStop, stopToolsOf), ...stopTools(state.toStop, stopToolsOf)];
    }
    return {
      source: colorSource(driver),
      map,
      panel: currentOverlay,
      search: searchTool,
      popup: shown && text.popupFile(shown),
    };
  }

  /** Bring the map up to date with data that just landed, the way it is being drawn. */
  function redrawMap(how: ColorSource): void {
    const next = driverAfterLanding(driver, how, storyPicture);
    if (next !== driver) {
      keepDriving(next);
      scheduleStoryFrame();
    } else if (how === 'overlay') {
      fadeToTools();
    } else if (how === 'blend') {
      const colors = blendColors();
      if (colors) fadeMap(flatten(colors), blendTransition);
    }
  }

  function fileLanded(path: string, content: unknown): void {
    // Shortcut: load timing measures the Tanakh's texts file.
    if (path === TEXTS_FILE) textsIn = performance.now();
    downloads.pending.delete(path);
    const before = loaded;
    loaded = new Map(before).set(path, content);
    // Before the redraws, so one that throws cannot hold back load timing.
    prebuildCompleted(allOverlays, before, loaded, prebuilt);
    const search = dataFor(searchTool, loaded);
    if (search && search !== dataFor(searchTool, before)) searchTool.telemetry.dataLoaded(search);
    const stale = staleAfterLanding(before, loaded, landingView());
    if (stale.map) redrawMap(stale.map);
    if (stale.overlayPanel) drawOverlayPanel(false);
    if (stale.searchPanel) drawSearchPanel(false);
    if (stale.overlayPanel || stale.searchPanel) updateLegend();
    if (stale.popup) refreshPopupAfterDownload();
  }

  function fileFailed(path: string): void {
    downloads.pending.delete(path);
    downloads.failed.add(path);
    updateLegend();
    showSearchNotice();
    refreshPopupAfterDownload();
  }

  function refreshPopupAfterDownload(): void {
    if (!popupHold.held()) refreshVersePopup();
  }

  function prebuilt(overlay: Overlay<I>, built: boolean): void {
    if (overlay !== searchTool) return;
    searchPrebuilt = true;
    if (built) searchReady = performance.now();
    sendLoadTiming();
  }

  /** Sends load_timing once its fields are known; src/telemetry/schema.ts says what each marks. */
  function sendLoadTiming(): void {
    if (timingSent || !downloadsSettled) return;
    if (dataFor(searchTool, loaded) && !searchPrebuilt) return;
    timingSent = true;
    const textsEntry = performance
      .getEntriesByType('resource')
      .find((e) => e.name.endsWith(`/${TEXTS_FILE}`)) as PerformanceResourceTiming | undefined;
    const connection = (navigator as { connection?: { effectiveType?: string } }).connection;
    trackLoadTiming({
      first_frame: Math.round(firstFrame),
      texts_in: Math.round(textsIn),
      search_ready: Math.round(searchReady),
      texts_kbps: downloadKbps(textsEntry),
      connection: connection?.effectiveType ?? '',
    });
  }

  // Everything this does came out of the URL, so nothing it does may write to
  // the URL — see applyingExternalState in urlState.ts.
  function restoreFromUrl(link: UrlState): void {
    const next = resolveViewState(
      link,
      { ...initialCamera, zoom: DEFAULT_ZOOM },
      (id) => getOverlay(id) !== undefined,
    );
    applyingExternalState(() => applyViewState(next));
    // The link moved the camera, not the reader.
    markViewSettled();
    showTitle();
  }

  /**
   * Replace the whole view with `next`, in an order where each step can rely on
   * the one before: settings before the controls that draw them, the verse
   * before the camera that centres on it.
   */
  function applyViewState(next: ViewState): void {
    if (next.mode === 'explore') {
      handOver(readerTakesOver(storyColumn.position()), 'fold');
      const open = next.searchParams.search ? 'search' : 'overlay';
      // Only for a story exit: a phone opens with no panel shown, so
      // applyFrame's own tracking of the open panel can't see it land here.
      // Any other link change (Back/Forward while already exploring) must
      // leave frontTool at whatever the reader last chose from the legend.
      if (frame.mode === 'story') frontTool = open;
      closeStory(landingFrame(phone, open, open === 'overlay' && next.overlay === NO_OVERLAY));
    }

    activateOverlay(next.overlay);
    if (currentOverlay) overlaySettings.restore(currentOverlay, next.overlayParams);
    overlaySettings.restore(searchTool, next.searchParams);
    searchChanged(true);
    overlayChanged(true);

    const verse = next.verse ? squares.find(next.verse) : null;
    pinnedVerse = verse;
    updateSidebarWrapper(verse, verse !== null);

    cancelCameraGlide();
    Object.assign(camera, cameraForView(next.camera, verse, mapFocus(), mapViewport()));

    applyTools();
    render();

    if (next.mode === 'story') {
      openStory('cut', 'link', next.story, next.stop);
    }
  }

  const link = parseUrlState(overlayParamSpecs);
  if (linkNamesAView(link)) {
    restoreFromUrl(link);
  }

  if (frame.mode === 'story' && startsFolded) {
    // A link that names nothing has opened the story and handed it the map.
    if (driver.by !== 'reader') handOver(readerTakesOver(0), 'fold');
    closeStory(landingFrame(phone, 'overlay', true));
    // No stop has drawn the overlay panel, so None's places to start are not in it yet.
    drawOverlayPanel(true);
  }

  const referrer = document.referrer ? new URL(document.referrer).hostname : '';
  trackPageView(
    link.story ?? '',
    link.stop ?? '',
    referrer === location.hostname ? '' : referrer,
    arrivedWith(
      link,
      (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)
        ?.type,
    ),
    visited,
  );
  recordingDriver = true;
  markViewSettled();

  subscribeToHistory(() => {
    restoreFromUrl(parseUrlState(overlayParamSpecs));
  });

  scheduleStoryFrame();

  const stages = downloadStages(filesFirst(openingView()), allOverlays, loaded);
  for (const path of stages.flat()) downloads.pending.add(path);
  downloadsStarted = true;

  // The loading tests wait on this; nothing in the app reads it.
  document.documentElement.dataset.firstFrame = '';
  firstFrame = performance.now();
  showLoadState();

  for (const stage of stages) {
    await downloadFiles(stage, { landed: fileLanded, failed: fileFailed });
  }
  // The layout tests, the video harness and the loading tests wait on this;
  // nothing in the app reads it.
  document.documentElement.dataset.loaded = '';
  downloadsSettled = true;
  sendLoadTiming();
}
