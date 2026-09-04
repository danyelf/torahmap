// Tanakh Map - Main entry point

declare const __GIT_BRANCH__: string;

import { computeLayout, getLayoutBounds } from "./layout.ts";
import { createBookLabels, updateLabelPositions } from "./labels.ts";
import { loadTanakhStructure, loadAllVerseTexts, getVerseText } from "./verseTexts.ts";
import { buildSearchIndex, loadLemmaData } from "./search.ts";
import { initBookData } from "./constants/books.ts";
import { initHelp } from "./help.ts";
import {
  trackOverlaySwitch,
  trackVerseClick,
  trackZoomLevel,
} from "./analytics.ts";
import {
  parseUrlState,
  parseVerseFromUrl,
  updateUrl,
  subscribeToHashChange,
  validateOverlayParams,
  verseToUrlFormat,
  type UrlState,
} from "./urlState.ts";
import { debounce } from "./utils/debounce.ts";
import { getSidebarElements, updateSidebar } from "./sidebar.ts";
import { createCamera, clampZoom, panForZoom } from "./camera.ts";
import {
  createMouseState,
  startDrag,
  stopDrag,
  setHoveredVerse,
  clearHover,
} from "./mouseState.ts";
import {
  createTouchState,
  trackTouch,
  releaseTouch,
  getPinchDistance,
  getPinchCenter,
  resetTouchState,
} from "./touchState.ts";
import { tanakhIdentitiesEqual, nextTanakhItem, prevTanakhItem } from "./types.ts";
import { findItemAtPoint } from "./hitDetection.ts";
import { computeItemStates, applyItemColors } from "./itemColoring.ts";
import {
  createRenderContext,
  createRenderState,
  rebuildGeometry,
  render as renderFrame,
} from "./rendering.ts";
import type { TanakhLayout, Bounds } from "./types.ts";
import {
  ALL_OVERLAYS,
  registerOverlay,
  getOverlay,
  getAllOverlays,
  configureCommentary,
  configureTrop,
  configureSearch,
  configureVerseLength,
  type Overlay,
} from "./overlays/index.ts";
import {
  ZOOM_OUT_FACTOR,
  ZOOM_IN_FACTOR,
  DEFAULT_ZOOM,
  URL_UPDATE_DEBOUNCE_MS,
} from "./constants/app.ts";
import { loadStoryData, renderStoryPanel, computeStopOffsets, resolveStops } from "./scrollytelling/storyPanel";
import { computeInterpolatedState } from "./scrollytelling/controller";
import { computeBlendedColors } from "./scrollytelling/overlayBlender";
import { switchToExplore, switchToStory } from "./scrollytelling/modeSwitch";
import type { AppMode } from "./scrollytelling/modeSwitch";
import type { ResolvedStoryStop } from "./scrollytelling/types";
import "./styles/zoom-buttons.css";
import "./styles/right-panel.css";
import "./styles/verse-popup.css";

// Extend window for global state
declare global {
  interface Window {
    bookLabels?: HTMLDivElement;
    torahMap?: {
      verses: TanakhLayout[];
      pan: { x: number; y: number };
      zoom: number;
      render: () => void;
      canvas: HTMLCanvasElement;
      bounds: Bounds;
    };
  }
}

async function main(): Promise<void> {
  // Set page title with branch name
  document.title = `Tanakh Map [${__GIT_BRANCH__}]`;

  // Load all data in parallel: structure, verse texts, and lemma index
  const [torahData, verseTexts] = await Promise.all([
    loadTanakhStructure(),
    loadAllVerseTexts(),
    loadLemmaData(),
  ]);

  // Initialize book metadata and compute layout
  initBookData(torahData);
  const verses = computeLayout(torahData);
  const bounds = getLayoutBounds(verses);
  console.log(
    `Loaded ${verses.length} verses, bounds: ${bounds.width}x${bounds.height}`,
  );

  // Build search index
  buildSearchIndex(verseTexts);

  // Register and initialize overlays
  ALL_OVERLAYS.forEach(registerOverlay);
  configureCommentary({ verses });
  configureTrop({ verseTexts });
  configureVerseLength({ verseTexts });
  // Note: configureSearch is called later after updateSidebar is defined

  await Promise.all(getAllOverlays().map((o) => o.init?.()));

  // Setup canvas with devicePixelRatio for crisp rendering on high-DPI displays
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  if (!canvas) throw new Error("Canvas not found");
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas(): void {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  resizeCanvas();

  // Init WebGL and rendering infrastructure
  const renderContext = createRenderContext(canvas);
  const renderState = createRenderState(renderContext.gl, verses, dpr);

  // Current overlay state
  let currentOverlay: Overlay | null = null;

  // Function to apply overlay colors
  function applyOverlay(): void {
    // Compute verse states and apply colors
    const verseStates = computeItemStates(
      verses,
      currentOverlay,
      mouseState.hoveredVerse,
      pinnedVerse,
      tanakhIdentitiesEqual,
    );
    const colors = applyItemColors(verseStates);

    // Rebuild geometry buffer with new colors
    rebuildGeometry(renderContext.gl, renderState, colors);
  }

  /**
   * Sync explore-mode state (overlay, params, pinned verse) to a story stop.
   * Does NOT paint the buffer — caller decides (settled paints via applyOverlay,
   * mid-scroll lets the blender paint). Pulled out of applyStoryStop so mid-scroll
   * can keep `currentOverlay`/`pinnedVerse` in sync with the stop the user is
   * heading toward; otherwise hover events fired during a transition would call
   * applyOverlay against a stale `currentOverlay` and clobber the blender's buffer.
   */
  function syncStoryStopState(stop: ResolvedStoryStop): void {
    const wantedOverlay = stop.overlay ?? 'none';
    if (wantedOverlay !== currentOverlayId) {
      activateOverlay(wantedOverlay);
    }

    if (currentOverlay?.applyUrlParams) {
      currentOverlay.applyUrlParams(
        validateOverlayParams(currentOverlay.urlParams, stop.overlayParams ?? {}),
      );
    }

    // Sync pinnedVerse from stop (without going through pinVerse, which writes URL/telemetry)
    if (stop.verse) {
      const parsed = parseVerseFromUrl(stop.verse);
      if (parsed) {
        const isAlreadyPinned =
          pinnedVerse &&
          pinnedVerse.book === parsed.book &&
          pinnedVerse.chapter === parsed.chapter &&
          pinnedVerse.verse === parsed.verse;
        if (!isAlreadyPinned) {
          const verse = verses.find(
            (v) =>
              v.book === parsed.book &&
              v.chapter === parsed.chapter &&
              v.verse === parsed.verse
          );
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

  // Camera state - start at 1:1 zoom, centered
  const camera = createCamera(window.innerWidth, window.innerHeight, bounds);

  // Track pinned verse (click to persist)
  let pinnedVerse: TanakhLayout | null = null;

  // Mouse interaction state
  const mouseState = createMouseState();

  const touchState = createTouchState();

  // Mode switching state (story vs explore)
  let appMode: AppMode = 'story';
  let lastStoryScrollTop = 0;
  // Track the story stop whose explore-mode state (overlay, params, pinnedVerse)
  // is currently synced. Used to skip redundant resyncs every scroll frame.
  // Reset on mode switches (explore may have changed overlay/pin out from under us).
  let lastSyncedStopId: string | null = null;
  // Track whether user manually zoomed/panned during story mode.
  // Cleared when the user scrolls the narrative, resuming scroll-driven camera.
  // Currently write-only; reserved for future UI hints (e.g., "scroll to resume").
  let manualOverride = false;
  void manualOverride; // satisfy noUnusedLocals

  // Tap detection for touch devices
  let pointerDownPos: { x: number; y: number; time: number } | null = null;
  const TAP_THRESHOLD = 10; // max px movement to count as tap
  const TAP_MAX_DURATION = 300; // max ms to count as tap

  // Render function
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

  // Helper: Center camera on a verse
  function centerOnVerse(verse: TanakhLayout): void {
    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;
    camera.x = cssWidth / 2 / camera.zoom - verse.x - verse.size / 2;
    camera.y = cssHeight / 2 / camera.zoom - verse.y - verse.size / 2;
  }

  // Helper: Pin a verse and update all dependent state
  function pinVerse(verse: TanakhLayout, centerCamera: boolean = false): void {
    trackVerseClick(verse.book, verse.chapter, verse.verse);
    pinnedVerse = verse;
    updateSidebarWrapper(verse, true);
    if (centerCamera) {
      centerOnVerse(verse);
    }
    applyOverlay();
    render();
    updateLabelPositions(
      window.bookLabels!,
      { x: camera.x, y: camera.y },
      camera.zoom,
    );
    saveUrlState(true);
  }

  // Helper: Unpin the current verse and update all dependent state
  function unpinVerse(): void {
    pinnedVerse = null;
    updateSidebarWrapper(null);
    applyOverlay();
    render();
    saveUrlState(true);
  }

  render();

  // Book labels
  const hebrewNames = Object.fromEntries(
    torahData.books.map((b) => [b.name, b.hebrewName]),
  );
  window.bookLabels = createBookLabels(verses, document.body, hebrewNames);
  updateLabelPositions(
    window.bookLabels,
    { x: camera.x, y: camera.y },
    camera.zoom,
  );

  // Smooth zooming with mouse wheel, centered on cursor
  canvas.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      e.preventDefault();
      if (appMode === "story") manualOverride = true;
      const zoomFactor = e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
      const newZoom = clampZoom(camera.zoom * zoomFactor);

      // Get mouse position in canvas coordinates
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // Adjust pan so the world point under the mouse stays fixed
      const newPan = panForZoom(
        { x: camera.x, y: camera.y },
        camera.zoom,
        newZoom,
        mouseX,
        mouseY,
      );
      camera.x = newPan.x;
      camera.y = newPan.y;
      camera.zoom = newZoom;

      render();
      updateLabelPositions(
        window.bookLabels!,
        { x: camera.x, y: camera.y },
        camera.zoom,
      );
      debouncedSaveUrlState();
      debouncedTrackZoom();
    },
    { passive: false },
  );

  const debouncedTrackZoom = debounce(() => trackZoomLevel(camera.zoom), 1000);

  // Zoom buttons
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');

  zoomInBtn?.addEventListener('click', () => {
    if (appMode === 'story') manualOverride = true;
    const centerX = canvas.clientWidth / 2;
    const centerY = canvas.clientHeight / 2;
    const newZoom = clampZoom(camera.zoom * ZOOM_IN_FACTOR);
    const newPan = panForZoom(
      { x: camera.x, y: camera.y },
      camera.zoom,
      newZoom,
      centerX,
      centerY
    );
    camera.x = newPan.x;
    camera.y = newPan.y;
    camera.zoom = newZoom;
    render();
    updateLabelPositions(window.bookLabels!, { x: camera.x, y: camera.y }, camera.zoom);
    debouncedSaveUrlState();
  });

  zoomOutBtn?.addEventListener('click', () => {
    if (appMode === 'story') manualOverride = true;
    const centerX = canvas.clientWidth / 2;
    const centerY = canvas.clientHeight / 2;
    const newZoom = clampZoom(camera.zoom * ZOOM_OUT_FACTOR);
    const newPan = panForZoom(
      { x: camera.x, y: camera.y },
      camera.zoom,
      newZoom,
      centerX,
      centerY
    );
    camera.x = newPan.x;
    camera.y = newPan.y;
    camera.zoom = newZoom;
    render();
    updateLabelPositions(window.bookLabels!, { x: camera.x, y: camera.y }, camera.zoom);
    debouncedSaveUrlState();
  });

  // Touch events for pinch-to-zoom
  canvas.addEventListener(
    "touchstart",
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
    "touchmove",
    (e: TouchEvent) => {
      for (const touch of e.changedTouches) {
        trackTouch(touchState, touch.identifier, touch.clientX, touch.clientY);
      }

      if (touchState.activeTouches.size >= 2) {
        const newDist = getPinchDistance(touchState);
        const center = getPinchCenter(touchState);
        if (newDist && center && touchState.lastPinchDistance) {
          const scale = newDist / touchState.lastPinchDistance;
          const newZoom = clampZoom(camera.zoom * scale);
          const newPan = panForZoom(
            { x: camera.x, y: camera.y },
            camera.zoom,
            newZoom,
            center.x,
            center.y,
          );
          camera.x = newPan.x;
          camera.y = newPan.y;
          camera.zoom = newZoom;
          render();
          updateLabelPositions(
            window.bookLabels!,
            { x: camera.x, y: camera.y },
            camera.zoom,
          );
        }
        touchState.lastPinchDistance = newDist;
      }
    },
    { passive: true },
  );

  canvas.addEventListener("touchend", (e: TouchEvent) => {
    for (const touch of e.changedTouches) {
      releaseTouch(touchState, touch.identifier);
    }
    if (touchState.activeTouches.size === 0) {
      debouncedSaveUrlState();
    }
  });

  canvas.addEventListener("touchcancel", () => {
    resetTouchState(touchState);
  });

  // Pointer events for pan/drag (works for both mouse and touch)
  canvas.addEventListener("pointerdown", (e: PointerEvent) => {
    startDrag(mouseState, e.clientX, e.clientY);
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture(e.pointerId);
    pointerDownPos = { x: e.clientX, y: e.clientY, time: Date.now() };
  });

  canvas.addEventListener("pointermove", (e: PointerEvent) => {
    if (mouseState.isDragging && touchState.activeTouches.size < 2) {
      if (appMode === 'story') manualOverride = true;
      const dx = e.clientX - mouseState.dragStart.x;
      const dy = e.clientY - mouseState.dragStart.y;
      camera.x += dx / camera.zoom;
      camera.y += dy / camera.zoom;
      mouseState.dragStart = { x: e.clientX, y: e.clientY };
      render();
      updateLabelPositions(
        window.bookLabels!,
        { x: camera.x, y: camera.y },
        camera.zoom,
      );
    }
  });

  canvas.addEventListener("pointerup", (e: PointerEvent) => {
    const wasDragging = mouseState.isDragging;
    if (wasDragging) {
      stopDrag(mouseState);
      debouncedSaveUrlState();
    }

    // Tap detection (works for both mouse and touch)
    if (pointerDownPos) {
      const dx = Math.abs(e.clientX - pointerDownPos.x);
      const dy = Math.abs(e.clientY - pointerDownPos.y);
      const duration = Date.now() - pointerDownPos.time;

      if (
        dx < TAP_THRESHOLD &&
        dy < TAP_THRESHOLD &&
        duration < TAP_MAX_DURATION
      ) {
        const verse = findItemAtPoint(
          verses,
          camera,
          e.clientX,
          e.clientY,
        );
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

    // Reset cursor
    if (wasDragging) {
      const verse = findItemAtPoint(
        verses,
        camera,
        e.clientX,
        e.clientY,
      );
      if (pinnedVerse && verse) {
        canvas.style.cursor = "pointer";
      } else {
        canvas.style.cursor = "default";
      }
    }
  });

  canvas.addEventListener("pointerleave", () => {
    const wasHovering = mouseState.hoveredVerse !== null;
    clearHover(mouseState);
    canvas.style.cursor = "default";

    let overlayWantsRerender = false;
    if (currentOverlay?.setHoveredVerse) {
      overlayWantsRerender = currentOverlay.setHoveredVerse(null);
    }

    if (wasHovering || overlayWantsRerender) {
      applyOverlay();
      render();
    }
  });

  // Sidebar for verse details
  const sidebarElements = getSidebarElements();

  // URL State Management
  // The overlay reports its own settings; we pass them straight through.
  function buildOverlayParamsForUrl(): Record<string, string> {
    return currentOverlay?.getUrlParams?.() ?? {};
  }

  // Build current state for URL
  function buildCurrentUrlState(): UrlState {
    const state: UrlState = {
      overlayParams: {},
    };

    // Overlay
    if (currentOverlay) {
      state.overlay = currentOverlay.id;
      state.overlayParams = buildOverlayParamsForUrl();
    }

    // Pinned verse
    if (pinnedVerse) {
      state.verse = verseToUrlFormat(
        pinnedVerse.book,
        pinnedVerse.chapter,
        pinnedVerse.verse,
      );
    }

    // Zoom (only if not default)
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

  // Save current state to URL
  function saveUrlState(pushHistory: boolean = false): void {
    const state = buildCurrentUrlState();
    updateUrl(state, pushHistory);
  }

  // Debounced version for pan/zoom (replaceState only)
  const debouncedSaveUrlState = debounce(
    () => saveUrlState(false),
    URL_UPDATE_DEBOUNCE_MS,
  );

  // Update sidebar with verse info - wrapper for the extracted module function
  function updateSidebarWrapper(
    verse: TanakhLayout | null,
    isPinned: boolean = false,
  ): void {
    updateSidebar(
      sidebarElements,
      verse,
      verseTexts,
      currentOverlay,
      getVerseText,
      isPinned,
    );
  }

  canvas.addEventListener("pointermove", (e: PointerEvent) => {
    // Skip hover logic on touch devices and during pinch
    if (e.pointerType === "touch" || touchState.activeTouches.size >= 2) return;

    if (!mouseState.isDragging) {
      const verse = findItemAtPoint(
        verses,
        camera,
        e.clientX,
        e.clientY,
      );
      const previousHover = mouseState.hoveredVerse;
      setHoveredVerse(mouseState, verse);

      const hoverChanged = !tanakhIdentitiesEqual(previousHover, verse);

      if (pinnedVerse && verse) {
        canvas.style.cursor = "pointer";
      } else if (mouseState.isDragging) {
        canvas.style.cursor = "grabbing";
      } else {
        canvas.style.cursor = "default";
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

  // Close button to unpin
  sidebarElements.closeBtn?.addEventListener("click", () => {
    unpinVerse();
  });

  // Keyboard navigation: arrow keys for next/previous verse, Escape to close
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (!pinnedVerse) return;

    if (e.key === "Escape") {
      unpinVerse();
      return;
    }

    let targetVerse: TanakhLayout | null = null;

    if (e.key === "ArrowRight") {
      targetVerse = nextTanakhItem(verses, pinnedVerse);
    } else if (e.key === "ArrowLeft") {
      targetVerse = prevTanakhItem(verses, pinnedVerse);
    }

    if (targetVerse) {
      pinVerse(targetVerse, true);
    }
  });

  // UI elements
  const overlaySelect = document.getElementById(
    "overlay-select",
  ) as HTMLSelectElement;

  // Overlay controls container (will be populated by overlays)
  const overlayControlsContainer = document.getElementById("overlay-controls");
  const overlayLegendContainer = document.getElementById("overlay-legend");

  let currentOverlayId = "none";

  // True only while settings read out of the URL are being applied, so that an
  // overlay reacting to them does not turn around and rewrite the URL.
  let restoringFromUrl = false;

  /**
   * Internal: switch the active overlay without painting/rendering or writing URL.
   * Used by both setOverlay (with side effects) and applyStoryStop (without).
   */
  function activateOverlay(id: string): void {
    currentOverlayId = id;
    currentOverlay?.destroy?.();
    currentOverlay = getOverlay(id) ?? null;

    // Wire up update callback for dynamic overlays
    currentOverlay?.onUpdate?.(() => {
      applyOverlay();
      // Re-render legend when overlay updates (e.g., category changes)
      if (overlayLegendContainer) {
        overlayLegendContainer.innerHTML = "";
        currentOverlay?.renderLegend?.(overlayLegendContainer);
      }
      render();
      // Save URL state when overlay params change (replaceState).
      // Skip during story mode — story owns URL state via story stop ID.
      // Skip while restoring — those settings came out of the URL, and writing
      // them straight back would have the restore fight the history entry.
      if (appMode !== 'story' && !restoringFromUrl) {
        saveUrlState(false);
      }
    });

    // Clear and render overlay's UI
    if (overlayControlsContainer) {
      overlayControlsContainer.innerHTML = "";
      currentOverlay?.renderControls?.(overlayControlsContainer);
    }
    if (overlayLegendContainer) {
      overlayLegendContainer.innerHTML = "";
      currentOverlay?.renderLegend?.(overlayLegendContainer);
    }
  }

  function setOverlay(
    id: string,
    opts: { fromUrlRestore?: boolean } = {}
  ): void {
    const { fromUrlRestore = false } = opts;
    if (!fromUrlRestore) {
      trackOverlaySwitch(id, currentOverlayId);
    }

    activateOverlay(id);

    applyOverlay();
    render();

    // Update URL when overlay changes (unless restoring from URL)
    if (!fromUrlRestore) {
      saveUrlState(true);
    }
  }

  // Overlay selector
  overlaySelect?.addEventListener("change", () => {
    setOverlay(overlaySelect.value);
  });

  // Handle resize
  window.addEventListener("resize", () => {
    resizeCanvas();
    render();
    updateLabelPositions(
      window.bookLabels!,
      { x: camera.x, y: camera.y },
      camera.zoom,
    );
  });

  // Store for hover detection
  window.torahMap = {
    verses,
    pan: { x: camera.x, y: camera.y },
    zoom: camera.zoom,
    render,
    canvas,
    bounds,
  };

  // Capture mode: Ctrl+Shift+C copies current camera state as a story stop comment
  if (import.meta.hot) {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        const x = Math.round(camera.x * 100) / 100;
        const y = Math.round(camera.y * 100) / 100;
        const zoom = Math.round(camera.zoom * 100) / 100;

        // Build optional parts
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

  // Wire up search overlay callbacks
  configureSearch({
    verses,
    callbacks: {
      onVerseClick: (verse: TanakhLayout) => {
        pinVerse(verse);
      },
    },
  });

  // Initialize help modal
  const rightPanel = document.getElementById('right-panel');
  if (rightPanel) {
    initHelp(rightPanel);
  }

  // Load story data and wire up scroll-driven camera
  const initialCamera = { x: camera.x, y: camera.y, zoom: camera.zoom };
  const storyContent = document.getElementById('story-content')!;

  let storyData = await loadStoryData();
  let resolvedStops = resolveStops(storyData.stops, initialCamera, verses, canvas.clientWidth, canvas.clientHeight);
  let stopElements = renderStoryPanel(storyContent, storyData.stops);

  async function reloadStory(): Promise<void> {
    const scrollTop = storyContent.scrollTop;
    storyData = await loadStoryData();
    resolvedStops = resolveStops(storyData.stops, initialCamera, verses, canvas.clientWidth, canvas.clientHeight);
    stopElements = renderStoryPanel(storyContent, storyData.stops);
    storyContent.scrollTop = scrollTop;
    // Force re-apply: stops may have changed (overlay/params/verse), and stop
    // object identities are fresh after re-resolving.
    lastSyncedStopId = null;
    storyContent.dispatchEvent(new Event('scroll'));
  }

  // Hot-reload story.md in dev mode
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
    // Re-trigger scroll handler to restore map state
    storyContent.dispatchEvent(new Event('scroll'));
  });

  let scrollRAF: number | null = null;
  storyContent.addEventListener('scroll', () => {
    if (appMode !== 'story') return;
    manualOverride = false;
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => {
      scrollRAF = null;
      const offsets = computeStopOffsets(stopElements);
      const heights = stopElements.map(el => el.offsetHeight);
      const totalHeight = storyContent.scrollHeight;
      const state = computeInterpolatedState(
        resolvedStops,
        offsets,
        totalHeight,
        storyContent.scrollTop,
        storyData.defaults?.easing ?? 'ease-in-out',
        heights,
        storyContent.clientHeight
      );

      // Apply interpolated camera
      camera.x = state.camera.x;
      camera.y = state.camera.y;
      camera.zoom = state.camera.zoom;

      const settled = state.fromStop === state.toStop;
      // Pick the stop whose state should be "current" — settled stop, or the
      // dominant transitioning stop. Sync explore state to it on every change
      // so hover events mid-scroll find a consistent currentOverlay/pinnedVerse.
      const dominantStop = settled
        ? state.fromStop
        : (state.t > 0.5 ? state.toStop : state.fromStop);
      if (lastSyncedStopId !== dominantStop.id) {
        syncStoryStopState(dominantStop);
        lastSyncedStopId = dominantStop.id;
      }

      if (settled) {
        // At rest: paint via the explore-mode color pipeline.
        applyOverlay();
      } else {
        // Mid-scroll: blender paints interpolated colors directly to the GPU buffer.
        const blendedColors = computeBlendedColors(
          state.fromStop,
          state.toStop,
          state.t,
          verses
        );
        rebuildGeometry(renderContext.gl, renderState, blendedColors);
      }
      render();
      updateUrl({ story: dominantStop.id, overlayParams: {} }, false);
    });
  });

  // Re-trigger scroll on resize to recompute story positions
  window.addEventListener('resize', () => {
    if (appMode === 'story') {
      storyContent.dispatchEvent(new Event('scroll'));
    }
  });

  // URL State Restoration
  // Restore overlay and its parameters from URL
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
    // Overlays announce a settings change by calling their onUpdate handler,
    // which also saves the URL — unwanted here, since these settings came from
    // the URL in the first place. So the save is suppressed for the duration of
    // the restore, and the legend is redrawn directly. (Controls are left
    // alone: each overlay updates its own inside applyUrlParams, and redrawing
    // them here would throw away what it just put there.)
    if (currentOverlay?.applyUrlParams) {
      restoringFromUrl = true;
      try {
        currentOverlay.applyUrlParams(
          validateOverlayParams(currentOverlay.urlParams, urlState.overlayParams),
        );
      } finally {
        restoringFromUrl = false;
      }
      if (overlayLegendContainer) {
        overlayLegendContainer.innerHTML = "";
        currentOverlay.renderLegend?.(overlayLegendContainer);
      }
    }
  }

  // Restore pinned verse from URL and center on it
  function restoreVerseFromUrl(urlState: UrlState): boolean {
    if (!urlState.verse) return false;

    const parsed = parseVerseFromUrl(urlState.verse);
    if (!parsed) return false;

    // Find the verse in our list
    const verse = verses.find(
      (v) =>
        v.book === parsed.book &&
        v.chapter === parsed.chapter &&
        v.verse === parsed.verse,
    );
    if (!verse) return false;

    // Pin without saveUrlState since we're restoring FROM the URL
    pinnedVerse = verse;
    updateSidebarWrapper(verse, true);
    centerOnVerse(verse);
    return true;
  }

  // Restore camera position from URL (zoom always, pan only if no verse)
  function restoreCameraFromUrl(urlState: UrlState, hasVerse: boolean): void {
    // Restore zoom
    if (urlState.zoom !== undefined) {
      camera.zoom = urlState.zoom;
    }

    // Restore pan position (only if no verse - verse auto-centers)
    if (!hasVerse && urlState.x !== undefined && urlState.y !== undefined) {
      camera.x = urlState.x;
      camera.y = urlState.y;
    }
  }

  function restoreFromUrl(): void {
    const urlState = parseUrlState((id) => getOverlay(id)?.urlParams);

    if (urlState.story) {
      // Restore story mode
      appMode = 'story';
      // Force the next settled scroll frame to apply the stop's state.
      lastSyncedStopId = null;
      switchToStory(storyPanel, explorePanel, storyContent, 0);
      const stopIndex = resolvedStops.findIndex(s => s.id === urlState.story);
      if (stopIndex >= 0 && stopElements[stopIndex]) {
        stopElements[stopIndex].scrollIntoView();
      }
      return;
    }

    // Explore mode
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

  // Restore state from URL on page load
  if (window.location.hash) {
    restoreFromUrl();
  }

  // Handle browser back/forward navigation
  subscribeToHashChange(() => {
    restoreFromUrl();
  });

  // Apply first stop's state (verse pin, overlay) on initial load
  if (appMode === 'story') {
    storyContent.dispatchEvent(new Event('scroll'));
  }
}

main().catch(console.error);
