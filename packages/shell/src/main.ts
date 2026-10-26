// The app shell: the map, its panels, story, popup and links, for whichever text it is given.

import {
  mapPoint,
  clampZoom,
  zoomAtPoint,
  centreForFocus,
  viewFocusedOn,
  animateCameraTo,
  boxAround,
  cameraToFit,
  type Camera,
  type ScreenPoint,
  type Viewport,
  indexItems,
  sameItem,
  findItemAtPoint,
  findNearestItem,
  createRenderContext,
  createRenderState,
  rebuildGeometry,
  render as renderFrame,
  type RenderContext,
  getWebGL2,
  type MapItem,
  type ItemColor,
  type Picture,
  DEFAULT_EASING,
  flatten,
  still,
  type ColorLayer,
  easingFunctions,
  lerpCamera,
} from '@torahmap/engine';
import { debounce } from '@torahmap/utils';
import type { MapText, Reference, Site } from './app/text.ts';
import { SEARCH_BOX_ID } from './app/search.ts';
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
import { bindGoTo, goToPanelHtml } from './goTo.ts';
import { GO_TO_BOX_ID } from './goToBox.ts';
import { shareLink } from './share.ts';
import { storiesHtml, storyChosen, type StoryCard } from './storiesPanel.ts';
import { aboutHtml } from './aboutPanel.ts';
import { startingPointsHtml, startChosen, type StartChoice } from './startingPoints.ts';
import { hasVisited, rememberVisit } from './visits.ts';
import { overlayPanelHtml, searchPanelHtml } from './toolPanels.ts';
import { applyLanguageChoice, bindLanguageChoice, shownLanguages } from './languageChoice.ts';
import { ENGLISH, type TextLanguage } from './language.ts';
import {
  arrivedWith,
  configureAnalytics,
  driverChangeEvent,
  reportError,
  trackOverlaySwitch,
  trackPageView,
  trackSefariaOpen,
  trackShare,
  trackStoryExit,
  trackStoryReturn,
  trackStoryStop,
  trackGoTo,
  trackSquareClick,
  trackViewSettled,
  trackWebGLMissing,
  type ExitHow,
  type ReturnHow,
} from './analytics.ts';
import { linkKind, linkNamesAView, type LinkKeys, type UrlState } from '@torahmap/link';
import { parseUrlState, updateUrl, subscribeToHistory, applyingExternalState } from './urlState.ts';
import { resolveViewState, cameraForView, opensFolded, type ViewState } from './viewState.ts';
import { tabTitle } from './tabTitle.ts';
import { linkForScreen, pushes } from './linkForScreen.ts';
import { getSidebarElements, updateSidebar } from './sidebar.ts';
import { createMapGestures, escapeDoes, tapDoes } from './mapGestures.ts';
import { toolsPicture, layerToRecompute, fillDefaultColors } from './itemColoring.ts';
import { createOverlaySettings, settingsFromLink } from './overlays/settings.ts';
import { NO_OVERLAY, type Overlay, type Tools } from './overlays/types.ts';
import { toolsPicked, toolsShown, togglesSearch } from './tools.ts';
import { dataFor, loadFiles, type Loaded } from './dataFiles.ts';
import { filesFirst, staleAfterLanding, type LandingView, type OpeningView } from './downloads.ts';
import { createLoader } from './loader.ts';
import { createViewFiles } from './viewFiles.ts';
import { createPopupHold } from './popupHold.ts';
import { isPhone } from './phone.ts';
import { URL_UPDATE_DEBOUNCE_MS, SEARCH_NON_MATCH_DIM, MAP_FADE } from './constants.ts';
import { stopLabel } from './scrollytelling/storyPanel';
import { cameraSetting, listedStories, writeStopComment } from '@torahmap/stories';
import {
  createStoryColumn,
  nearerStop,
  placeIn,
  type StopPlace,
} from './scrollytelling/storyColumn.ts';
import { computeBlendedColors, stopTools, type TextTools } from './scrollytelling/overlayBlender';
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
import type { ResolvedStoryStop } from './scrollytelling/types';
import { showLegend, type LegendRow } from './mapLegend.ts';
import './styles/zoom-buttons.css';
import './styles/frame.css';
import './styles/popup.css';
import './styles/phone.css';

// How far down a phone's map a square brought into view is put. Halfway down,
// the square lands behind the popup that sits just above the sheet.
const PHONE_STORY_FOCUS = 0.4;

/**
 * Set the tab's title from the address rather than from any state built for
 * it, so it can never name a view the address does not hold — a write
 * suppressed by `applyingExternalState` leaves both unchanged.
 */
function showTitle({ site, link }: { site: Site; link: LinkKeys }): void {
  const title = tabTitle(site, parseUrlState(link), __LIVE__ ? null : __GIT_BRANCH__);
  if (document.title !== title) document.title = title;
}

function showCannotDraw(): void {
  document.body.classList.add('no-webgl');
  document.getElementById('no-webgl')!.hidden = false;
}

export async function createApp<I extends MapItem, S>(source: MapText<I, S>): Promise<void> {
  // Before the data loads, so the branch name shows from the start.
  showTitle(source);
  const zoomRange = source.link.zoom;
  const twoLanguages = source.languages.length > 1;

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas not found');
  // Before any download: without WebGL 2 the map cannot draw at all.
  if (!getWebGL2(canvas)) {
    showCannotDraw();
    trackWebGLMissing();
    return;
  }
  // Everything but the text's first files loads behind the first frame (fileLanded).
  const firstFiles = loadFiles(source.files.first);
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

  const first = await firstFiles;
  const text = source.open(first);
  const items = text.items;
  const searchTool = text.search;
  const allOverlays: Overlay<I>[] = [searchTool, ...text.overlays];
  const getOverlay = (id: string): Overlay<I> | undefined =>
    text.overlays.find((overlay) => overlay.id === id);
  // What a story stop may name.
  const textTools: TextTools<I> = { search: searchTool, overlay: getOverlay };
  // What main.ts asks of the loader and viewFiles is the loading suite's to
  // check: creating them, starting the downloads, asking for a fetch, what
  // showLoadState redraws, and what the map does as a file lands or fails.
  // npm run test:browser sees a change to this file as the interface's, so run
  // npm run test:loading after changing one of them.
  const loader = createLoader({
    loaded: first,
    overlays: allOverlays,
    search: searchTool,
    timed: source.files.timed,
    landed: fileLanded,
    failed: fileFailed,
  });

  const squares = indexItems(items);
  const baseColors = items.map((item, i) => text.baseColor(item, i));
  const base = (i: number): ItemColor => baseColors[i];
  const baseRings = text.baseRing && items.map((item, i) => text.baseRing!(item, i));
  // A picture with its holes filled with each square's base colour, and its base ring.
  const fill = (picture: Picture<ItemColor | null>): Picture<ItemColor> =>
    fillDefaultColors(picture, base, baseRings && ((i) => baseRings[i]));

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
  const onMap = (e: { clientX: number; clientY: number }): ScreenPoint =>
    mapPoint(e.clientX, e.clientY, canvasOrigin);

  const renderState = createRenderState(renderContext, items, dpr);

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
  // depend on the hovered square, which a blend's may.
  let colorLayer: ColorLayer<ItemColor | null> = still({ colors: [] });
  // What the square buffer was last built from. A fade in progress changes only
  // its amount, so a frame that keeps these redraws without rebuilding.
  let built: unknown[] = [];

  const visited = hasVisited();
  const startsFolded = opensFolded(parseUrlState(source.link), visited);
  let driver: Driver = startsFolded ? readerTakesOver(0) : STORY_DRIVING;
  configureAnalytics({ getMode: () => driverKind(driver) });

  function composite(): void {
    const { from, to, t } = colorLayer;
    renderState.fade = to ? t : 0;

    // The pictures' fields, not the pictures: a story stop's are cached, while
    // the pictures around them are made afresh each frame.
    const inputs = [from, to].flatMap((p) => (p ? Object.entries(p).flat() : [null]));
    if (inputs.length === built.length && inputs.every((input, i) => input === built[i])) return;
    built = inputs;

    rebuildGeometry(renderContext.gl, renderState, fill(from), to && fill(to));
  }

  function setColorLayer(next: ColorLayer<ItemColor | null>): void {
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
      loader.loaded(),
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
    return front === 'search' ? SEARCH_NON_MATCH_DIM : 1;
  }

  // Search or the overlay, whichever's panel opened last (frame.ts). Only
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
        const waiting = viewFiles.waitingTool(panel, tool);
        if (waiting && 'row' in waiting) rows.push(waiting.row);
        else if (waiting) warnings.push(waiting.warning);
      }
    }
    showLegend(mapLegend, rows, warnings);
  }

  /** The map exploring shows: the tools as they stand, the front one in front. */
  function explorePicture(): Picture<ItemColor | null> {
    return toolsPicture(
      toolsNow(),
      items,
      hoveredItem,
      base,
      dimFor(frontTool),
      text.searchKeepsBase,
    );
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
      items,
      hoveredItem,
      loader.loaded(),
      base,
      textTools,
      text.searchKeepsBase,
    );
  }

  function blendTransition(): void {
    cancelFade();
    const colors = blendColors();
    if (colors) setColorLayer(colors);
  }

  /**
   * Repaint after the hovered or pinned square changes. `hoveredBefore` is the
   * hover the colour layer was drawn for; a pin leaves the hover alone, so it
   * passes nothing and only composites.
   */
  function repaint(hoveredBefore: I | null = hoveredItem): void {
    const layer = layerToRecompute(
      colorSource(driver),
      toolsNow().overlay,
      hoveredBefore,
      hoveredItem,
    );
    if (layer === 'blend') blendTransition();
    else if (layer === 'overlay') applyTools();
    else composite();
    render();
  }

  /**
   * Sync explore-mode state (overlay, params, pinned square) to a story stop.
   * Does NOT paint the buffer — caller decides (settled paints via applyTools,
   * mid-scroll lets the blender paint), so mid-scroll can keep
   * `currentOverlay`/`pinnedItem` in sync with the stop the reader is heading
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

    // Sync pinnedItem from stop (without going through pinItem, which writes URL/telemetry)
    if (stop.pin) {
      const item = squares.find(stop.pin);
      if (item && !sameItem(pinnedItem, item)) {
        pinnedItem = item;
        updateSidebarWrapper(item, true);
      }
    } else if (pinnedItem) {
      pinnedItem = null;
      updateSidebarWrapper(null);
    }
  }

  const camera = text.startCamera(mapViewport());

  let pinnedItem: I | null = null;

  let hoveredItem: I | null = null;

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
  document.getElementById('goto-panel')!.innerHTML = goToPanelHtml(text.goTo.examples);
  document.getElementById('overlay-panel')!.innerHTML = overlayPanelHtml();
  document.getElementById('search-panel')!.innerHTML = searchPanelHtml();
  const mapLegend = document.getElementById('map-legend')!;
  const overlayDescription = document.getElementById('overlay-description')!;
  const menuToggle = document.getElementById('menu-toggle')!;

  // What the panel shows (frame.ts); the story is open while its mode is 'story'.
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
      droppedMenu.innerHTML = menuHtml(source.site, { ...place, title: story.data.title });
    }
    const opened = frame.open !== previous?.open;
    if (opened && frame.open === 'stories') drawStories();
    if (opened && frame.open === 'goto') goToPanel.redraw();
    if (opened && frame.open === 'about') {
      aboutPanel.innerHTML = aboutHtml(
        source.site,
        allOverlays,
        twoLanguages,
        text.goTo.examples[0],
      );
      bindLanguageChoice(aboutPanel, refreshPopup);
    }
    setFrontTool(frontToolAfter(frontTool, frame.open));
    measureSheet();
    // Hidden, the menu would drop focus to the top of the page.
    if (focusInMenu && !frame.menu) menuToggle.focus();
  }

  // An exploring phone's sheet is as tall as its content, or gone with nothing
  // open; the map, the legend and the popup make room for it. Full
  // height grows over the map instead.
  function measureSheet(): void {
    if (!phone || frame.full) return;
    document.documentElement.style.setProperty('--sheet-shown', `${panel.offsetHeight}px`);
  }
  // Watching the sheet alone misses a change: when a panel opens shorter than
  // the one before and grows back to its height within a frame, the observer
  // sees no change, though measureSheet has already recorded the shorter one.
  const sheetWatch = new ResizeObserver(measureSheet);
  for (const watched of [panel, ...panelBody.children]) sheetWatch.observe(watched);

  // On a phone the popup stacks above the legend, which grows a row for
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
    // On a phone it would raise the keyboard over the examples before they are read.
    if (event.type === 'choose' && frame.open === 'goto' && !phone) goToPanel.focus();
  }

  // Off until the page view is sent: who drives when the page opens is part of it.
  let recordingDriver = false;

  /**
   * Every change of driver goes through here, by way of handOver or
   * keepDriving. `at` is the stop the change of hands is told against: by
   * default, where the story is.
   */
  function setDriver(next: Driver, how: ExitHow | ReturnHow | null, at?: StopPlace): void {
    // The story taking the map back mid-fade would otherwise still get the
    // fade's later frames, painting a stale explore picture over its own.
    if (next.by !== 'reader') cancelFade();
    const event = recordingDriver ? driverChangeEvent(driver, next) : null;
    driver = next;
    if (!event) return;
    const { stop, place } = at ?? storyColumn.where();
    // handOver's overloads pair an exit with an ExitHow and a return with a ReturnHow.
    if (event === 'story_exit') {
      markViewSettled();
      trackStoryExit(stop.id, place.number, how as ExitHow);
    } else {
      trackStoryReturn(stop.id, how as ReturnHow);
    }
  }

  /** Give the map to `next`, which may pass it between the story and the reader, for the reason `how`. */
  function handOver(next: ReaderDriving, how: ExitHow): void;
  function handOver(next: StoryHasMap, how: ReturnHow, at?: StopPlace): void;
  function handOver(next: Driver, how: ExitHow | ReturnHow, at?: StopPlace): void {
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

  // Track the story stop whose explore-mode state (overlay, params, pinnedItem)
  // is currently synced. Used to skip redundant resyncs every scroll frame.
  // Reset whenever the story comes back, since the reader may have changed the
  // overlay or pin out from under it.
  let lastSyncedStopId: string | null = null;

  function render(): void {
    const offset = renderFrame(renderContext, renderState, camera, hoveredItem, pinnedItem);
    moveLabels(offset, camera.zoom);
  }

  function centerOnItem(item: I): void {
    Object.assign(camera, centreForFocus(item, camera.zoom, mapFocus(), mapViewport()));
  }

  // A square is six pixels across, so centring it while scaled out
  // moves the map and shows the reader nothing. Close enough to pick it out.
  const RESULT_CLICK_ZOOM = 2.5;

  let stopCameraGlide: (() => void) | null = null;

  /** Stop a glide in its tracks, for when the reader takes the map back. */
  function cancelCameraGlide(): void {
    stopCameraGlide?.();
    stopCameraGlide = null;
  }

  /**
   * Travel to a square rather than cutting to it, so the reader keeps their
   * bearings and can see where on the map the hit lives.
   *
   * Zooming in only when already further out: a reader who has zoomed past 2.5
   * has said what they want to see, and being pulled back would undo it.
   */
  function glideToItem(item: I): void {
    glideTo(
      viewFocusedOn(item, camera.zoom, RESULT_CLICK_ZOOM, mapFocus(), mapViewport(), zoomRange),
    );
  }

  /**
   * Fit `list` into the map above and below the focus, since its first square is
   * pinned and on a phone the popup covers the map below. No closer than a single
   * square is gone to, or a short chapter would be a few squares filling the map.
   */
  function glideToFit(list: readonly I[]): void {
    const view = mapViewport();
    const focus = mapFocus();
    const range = { ...zoomRange, max: Math.min(zoomRange.max, RESULT_CLICK_ZOOM) };
    const { zoom, x, y } = cameraToFit(boxAround(list), view.width, 2 * focus.y, range);
    glideTo({ zoom, ...centreForFocus({ x, y, size: 0 }, zoom, focus, view) });
  }

  function glideTo(target: Camera): void {
    cancelCameraGlide();
    stopCameraGlide = animateCameraTo(camera, target, () => {
      render();
      debouncedCameraSettled();
    });
  }

  /** The squares of a place, in reading order. */
  const squaresOf = (found: Reference): I[] =>
    found.ids.map((id) => squares.find(id)).filter((item) => item !== null);

  /**
   * A square's text in the first shown language whose file is in, fetching its files, or
   * null while none is in; the language the reference was typed in comes first.
   */
  function quoteOf(item: I, typed: string): string | null {
    viewFiles.fetchPopup(item);
    const said = text.popupText(item, loader.loaded(), null);
    const typedIn = text.goTo.languageOf(typed);
    const first = (language: TextLanguage) => Number(language === typedIn);
    // A language whose file is not in has no words yet.
    const languages = [...shownLanguages()].sort((a, b) => first(b) - first(a));
    for (const language of languages) {
      const words = language === ENGLISH ? said.english : said.hebrew;
      if (words) return words;
    }
    return null;
  }

  const goToPanel = bindGoTo(document.getElementById('goto-panel')!, text.goTo, {
    quote(found, typed) {
      const [first] = squaresOf(found);
      return first ? quoteOf(first, typed) : null;
    },
    // Pin the place's first square, and show all of it.
    take(found, typed) {
      const place = squaresOf(found);
      if (place.length === 0) return;
      trackGoTo(typed, found.ref, text.area(place[0]).area);
      // A full-height sheet would hide the glide.
      if (frame.full) setFrame({ ...frame, full: false });
      pinItem(place[0]);
      if (place.length === 1) glideToItem(place[0]);
      else glideToFit(place);
    },
    miss: (typed) => trackGoTo(typed, '', ''),
  });

  // pinItem, unpinItem and zoomAt answer only the reader's gestures; the story
  // sets the view directly. So each takes the wheel.
  function pinItem(item: I, centerCamera: boolean = false): void {
    takeOver('takeover');
    trackSquareClick(item.id, text.area(item).area);
    pinnedItem = item;
    updateSidebarWrapper(item, true);
    if (centerCamera) {
      centerOnItem(item);
    }
    repaint();
    syncUrl(true);
  }

  function unpinItem(): void {
    takeOver('takeover');
    pinnedItem = null;
    updateSidebarWrapper(null);
    repaint();
    syncUrl(true);
  }

  /** Zoom by `factor`, holding whatever is under `at` still. */
  function zoomAt(factor: number, at: ScreenPoint): void {
    takeOver('takeover');
    cancelCameraGlide();
    const newZoom = clampZoom(camera.zoom * factor, zoomRange);
    Object.assign(camera, zoomAtPoint(camera, newZoom, at, mapViewport()));
    render();
  }

  render();

  function setHover(square: I | null): void {
    const before = hoveredItem;
    hoveredItem = square;
    if (!sameItem(before, square)) repaint(before);
  }

  const gestures = createMapGestures<I>({
    canvas,
    zoomIn: document.getElementById('zoom-in'),
    zoomOut: document.getElementById('zoom-out'),
    onMap,
    squareUnder: (p) =>
      findItemAtPoint(items, camera, mapViewport(), p.x, p.y, renderState.standout),
    clickable: (square) => pinnedItem !== null && square !== null,
    direction: source.site.direction,
    intents: {
      grab() {
        // A touch on the map lifts the menu and folds a phone's sheet.
        dispatch({ type: 'map-touched' });
        // A hand on the map outranks a glide that is still running.
        cancelCameraGlide();
      },
      pan(dx, dy) {
        takeOver('takeover');
        camera.x -= dx / camera.zoom;
        camera.y -= dy / camera.zoom;
        render();
      },
      zoom: zoomAt,
      moveEnded: () => debouncedCameraSettled(),
      hover(square) {
        setHover(square);
        // A pinned square keeps the popup.
        if (!pinnedItem) updateSidebarWrapper(square);
      },
      leave: () => setHover(null),
      tap(square) {
        const does = tapDoes(square, pinnedItem);
        if (does === 'pin' && square) pinItem(square);
        else if (does === 'unpin') unpinItem();
      },
      step(by) {
        const next = pinnedItem && squares.step(pinnedItem, by);
        if (next) pinItem(next, true);
      },
      escape(inField) {
        const does = escapeDoes({ menu: frame.menu, pinned: pinnedItem !== null, inField });
        if (does === 'unpin') unpinItem();
        else dispatch({ type: does });
      },
    },
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

    if (pinnedItem) {
      state.square = pinnedItem.id;
    }

    state.zoom = camera.zoom;

    // Pan (only if no square - square auto-centers)
    if (!pinnedItem) {
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
    updateUrl(next, source.link, pushes(parseUrlState(source.link), next, push));
    showTitle(source);
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
    const near = findNearestItem(items, camera.x, camera.y);
    const where = near ? text.area(near) : { area: '', section: '' };
    trackViewSettled(where.area, where.section, camera.zoom);
  }, URL_UPDATE_DEBOUNCE_MS);

  function updateSidebarWrapper(item: I | null, isPinned: boolean = false): void {
    viewFiles.fetchPopup(item);
    const tools = toolsNow();
    updateSidebar(
      sidebarElements,
      item,
      (shown) => text.popupText(shown, loader.loaded(), tools.overlay),
      {
        waiting: item ? viewFiles.waitingLanguages(item) : {},
        wordsClickable: dataFor(searchTool, loader.loaded()) !== null,
        ...tools,
        pinned: isPinned,
      },
    );
  }

  /**
   * Redraw the popup for the square it shows, pinned or else hovered. It reads
   * the overlay's settings when drawn, so it goes stale when they change under
   * a square that stays put, as when two story stops pin the same square.
   */
  function refreshPopup(): void {
    if (pinnedItem) updateSidebarWrapper(pinnedItem, true);
    else if (hoveredItem) updateSidebarWrapper(hoveredItem, false);
  }

  /** Redraw every place that says a file is loading or failed. */
  function showLoadState(): void {
    updateLegend();
    viewFiles.showSearchNotice();
    refreshPopup();
  }

  sidebarElements.closeBtn?.addEventListener('click', () => {
    unpinItem();
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
  const viewFiles = createViewFiles({
    loader,
    files: source.files,
    search: searchTool,
    searchSettings: () => overlaySettings.get(searchTool),
    searchControls,
    closed: showLoadState,
  });
  const overlayLegendContainer = document.getElementById('overlay-legend');
  const overlayStarts = document.getElementById('overlay-starts')!;

  /** Switch the active overlay without drawing its UI, painting or writing the URL. */
  function activateOverlay(id: string): void {
    currentOverlay?.destroy?.();
    currentOverlay = getOverlay(id) ?? null;
    document.body.dataset.overlay = currentOverlay?.id ?? NO_OVERLAY;
  }

  function renderOverlayLegend(): void {
    if (overlayLegendContainer) {
      overlayLegendContainer.innerHTML = '';
      const overlay = currentOverlay;
      if (overlay) {
        overlay.renderLegend?.(
          overlayLegendContainer,
          currentSettings(),
          dataFor(overlay, loader.loaded()),
        );
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
      dataFor(overlay, loader.loaded()),
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
    refreshPopup();
  }

  function drawOverlayPanel(fresh: boolean): void {
    if (fresh) {
      if (overlaySelect) overlaySelect.value = currentOverlayId();
      if (overlayControlsContainer) overlayControlsContainer.innerHTML = '';
      overlayStarts.innerHTML = currentOverlay
        ? ''
        : startingPointsHtml(searchTool, text.overlays, storyColumn.listed());
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
    viewFiles.fetchSearch();
    drawSearchPanel(fresh);
    updateLegend();
    refreshPopup();
  }

  function drawSearchPanel(fresh: boolean): void {
    if (fresh) {
      searchTool.destroy?.();
      searchControls.innerHTML = '';
      searchTool.telemetry.replaced(
        overlaySettings.get(searchTool),
        dataFor(searchTool, loader.loaded()),
      );
    }
    searchTool.renderControls?.(
      searchControls,
      overlaySettings.get(searchTool),
      changeSearch,
      dataFor(searchTool, loader.loaded()),
    );
    viewFiles.showSearchNotice();
  }

  function changeSearch(update: (current: S) => S): void {
    const before = overlaySettings.get(searchTool);
    const after = update(before);
    overlaySettings.set(searchTool, after);
    searchTool.telemetry.readerChanged(after, dataFor(searchTool, loader.loaded()));
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
    const item = pinnedItem ?? hoveredItem;
    if (!item) return;
    trackSefariaOpen(item.id, text.area(item).area, currentOverlayId());
  });

  overlaySelect?.addEventListener('change', () => {
    setOverlay(overlaySelect.value);
  });

  // Capture mode: Ctrl+Shift+C copies current camera state as a story stop comment
  if (import.meta.hot) {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        const comment = writeStopComment(
          'STOP_ID',
          { camera: cameraSetting(camera), overlay: currentOverlay?.id, pin: pinnedItem?.id },
          {
            ...(currentOverlay && overlaySettings.toUrl(currentOverlay)),
            ...overlaySettings.toUrl(searchTool),
          },
        );
        navigator.clipboard.writeText(comment);
        console.log(`[capture] Copied to clipboard:\n${comment}`);
      }
    });
  }

  text.start?.({
    loaded: loader.loaded,
    holdPopup: popupHold.hold,
    pinAndGlide: (item) => {
      // A full-height sheet would hide the glide.
      if (frame.full) setFrame({ ...frame, full: false });
      pinItem(item);
      glideToItem(item);
    },
    openOverlay: (overlay, update) => {
      takeOver('takeover');
      if (currentOverlay?.id !== overlay.id) {
        overlaySettings.restore(overlay, {});
        setOverlay(overlay.id);
      }
      changeSettings(overlay, update);
      if (frame.mode === 'explore' && frame.open !== 'overlay') {
        dispatch({ type: 'choose', panel: 'overlay' });
      }
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
      storyColumn.storiesChanged(listedStories(list, !__LIVE__));
      // Whatever the edited stop holds is applied on the next frame.
      lastSyncedStopId = null;
      scheduleStoryFrame();
      drawOverlayPanel(true);
    },
  });
  searchChanged(true);

  applyLanguageChoice(source.languages);

  const initialCamera = { x: camera.x, y: camera.y, zoom: camera.zoom };

  function mapViewport(): Viewport {
    return { width: canvas.clientWidth, height: canvas.clientHeight };
  }

  /**
   * Where a square is put when the story, a link or the reader brings it into
   * view: the middle of the map, or on a phone higher up, clear of the popup
   * that sits above the sheet.
   */
  function mapFocus(): ScreenPoint {
    const height = phone ? canvas.clientHeight * PHONE_STORY_FOCUS : canvas.clientHeight / 2;
    return { x: canvas.clientWidth / 2, y: height };
  }

  const storyColumn = createStoryColumn(
    { content: storyContent, progress: storyProgress, title: storyProgressTitle },
    listedStories(text.stories.list, !__LIVE__),
    parseUrlState(source.link).story ?? null,
    (stops) =>
      text.stories.resolve(stops, initialCamera, items, squares, mapFocus(), mapViewport()),
  );
  storyColumn.onMove(storyMoved);
  configureAnalytics({ getStory: () => storyColumn.where().story.id });
  applyFrame();

  window.addEventListener('resize', () => {
    // Crossing into or out of phone width turns the story from a column into a
    // row, or back, and moves where it centres squares.
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
   * Open the column at a stop (see StoryColumn.open) and hand it the map,
   * easing from the reader's view or cutting to the stop, as a link does.
   */
  function openStory(
    arrive: 'ease' | 'cut',
    how: ReturnHow,
    storyId?: string | null,
    stop?: string | null,
  ): void {
    showStory();
    const was = storyColumn.where().story;
    const opened = storyColumn.open(storyId, stop);
    // No stop of another story has been applied to the map.
    if (storyColumn.where().story !== was) lastSyncedStopId = null;
    // Told against the stop opened, not wherever the column's scroll puts it.
    if (arrive === 'ease') {
      handOver(beginEase(REJOIN_EASE_MS, performance.now()), how, opened);
    } else {
      handOver(STORY_DRIVING, how, opened);
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
    const cards = storyColumn.listed().map(({ id, data }): StoryCard => {
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
    const closing = target.closest('.map-legend-close')?.closest<HTMLElement>('.map-legend-row')
      ?.dataset.panel;
    if (closing === 'search' || closing === 'overlay') return turnOff(closing);
    // Menu items and the legend choose a panel; nothing else inside an open
    // panel does.
    const chooser = target.closest('.map-legend-open')?.closest<HTMLElement>('.map-legend-row');
    const panelName = action ?? chooser?.dataset.panel;
    if (isPanel(panelName)) dispatch({ type: 'choose', panel: panelName });
  }

  /** A legend card's ×: what the search panel's Clear, or the overlay's None, does. */
  function turnOff(tool: FrontTool): void {
    takeOver('takeover');
    if (tool === 'search') changeSearch(() => settingsFromLink(searchTool, {}));
    else setOverlay(NO_OVERLAY);
    // The × went with its row, so focus moves to the row left, or else to the menu.
    (
      mapLegend.querySelector<HTMLElement>('.map-legend-row:not([hidden]) button') ?? menuToggle
    ).focus();
  }

  /** A pan's debounced address write may not have landed yet, so it is brought current first. */
  async function shareCurrentView(item: HTMLElement): Promise<void> {
    // An unchanged live region doesn't reliably re-announce; clearing it here,
    // ahead of the await below, means even a repeated outcome starts from empty.
    shareStatus.textContent = '';
    syncUrl(false);
    const shared = parseUrlState(source.link);
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
      pinned: shared.square ? 1 : 0,
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

  // Typing wants room for the words and their results. Go to's answer is one line, and
  // the map above it shows where it leads.
  panel.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && (t.type === 'text' || t.type === 'search')) {
      if (t.id === GO_TO_BOX_ID) return;
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
  function withDefaults(layer: ColorLayer<ItemColor | null>): ColorLayer {
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
        items,
        null,
        loader.loaded(),
        base,
        textTools,
        text.searchKeepsBase,
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
    // mid-scroll find a consistent currentOverlay/pinnedItem.
    const nearer = nearerStop(state);
    if (lastSyncedStopId !== nearer.id) arriveAtStop(nearer);

    // Not setHover: the render below draws the highlight.
    hoveredItem = gestures.squareUnderMouse();

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
    if (frame.mode !== 'story') return viewFiles.opening(pickedTools(), pinnedItem);
    const { stop } = storyColumn.where();
    const item = stop.pin ? squares.find(stop.pin) : null;
    return viewFiles.opening(stopTools(stop, textTools), item);
  }

  function landingView(): LandingView<I> {
    const shown = pinnedItem ?? hoveredItem;
    let map = pickedTools();
    if (driver.by === 'story' && driver.blend) {
      map = [...stopTools(driver.blend.from, textTools), ...stopTools(driver.blend.to, textTools)];
    } else if (driver.by === 'rejoining') {
      const state = storyColumn.view();
      map = [...stopTools(state.fromStop, textTools), ...stopTools(state.toStop, textTools)];
    }
    return viewFiles.landing(colorSource(driver), map, currentOverlay, shown);
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

  function fileLanded(before: Loaded, after: Loaded): void {
    const stale = staleAfterLanding(before, after, landingView());
    if (stale.map) redrawMap(stale.map);
    if (stale.overlayPanel) drawOverlayPanel(false);
    if (stale.searchPanel) drawSearchPanel(false);
    if (stale.overlayPanel || stale.searchPanel) updateLegend();
    if (stale.popup) refreshPopupAfterDownload();
    if (frame.open === 'goto') goToPanel.redraw();
  }

  function fileFailed(): void {
    updateLegend();
    viewFiles.showSearchNotice();
    refreshPopupAfterDownload();
  }

  function refreshPopupAfterDownload(): void {
    if (!popupHold.held()) refreshPopup();
  }

  // Everything this does came out of the URL, so nothing it does may write to
  // the URL — see applyingExternalState in urlState.ts.
  function restoreFromUrl(link: UrlState): void {
    const next = resolveViewState(
      link,
      { ...initialCamera, zoom: zoomRange.start },
      (id) => getOverlay(id) !== undefined,
    );
    applyingExternalState(() => applyViewState(next));
    // The link moved the camera, not the reader.
    markViewSettled();
    showTitle(source);
  }

  /**
   * Replace the whole view with `next`, in an order where each step can rely on
   * the one before: settings before the controls that draw them, the square
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

    const item = next.square ? squares.find(next.square) : null;
    pinnedItem = item;
    updateSidebarWrapper(item, item !== null);

    cancelCameraGlide();
    Object.assign(camera, cameraForView(next.camera, item, mapFocus(), mapViewport()));

    applyTools();
    render();

    if (next.mode === 'story') {
      openStory('cut', 'link', next.story, next.stop);
    }
  }

  const link = parseUrlState(source.link);
  if (linkNamesAView(link)) {
    restoreFromUrl(link);
  }

  if (frame.mode === 'story' && startsFolded) {
    // A link that names nothing has opened the story and handed it the map.
    if (driver.by !== 'reader') handOver(readerTakesOver(0), 'fold');
    closeStory(landingFrame(phone, 'overlay', true));
    // No stop has drawn the overlay panel, so None's places to start are not in it yet.
    drawOverlayPanel(true);
    // Nor its colours: a link that names no view never reaches restoreFromUrl, and
    // without an overlay no file landing repaints the map.
    applyTools();
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
    restoreFromUrl(parseUrlState(source.link));
  });

  scheduleStoryFrame();

  await loader.run(filesFirst(openingView()), showLoadState);
}
