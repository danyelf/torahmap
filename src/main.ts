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
  verseToUrlFormat,
  debounce,
  type UrlState,
} from "./urlState.ts";
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
import { versesEqual, nextVerse, prevVerse } from "./types.ts";
import { findItemAtPoint } from "./hitDetection.ts";
import { computeItemStates, applyItemColors } from "./itemColoring.ts";
import {
  createRenderContext,
  createRenderState,
  rebuildGeometry,
  render as renderFrame,
} from "./rendering.ts";
import type { VerseLayout, Bounds } from "./types.ts";
import {
  registerOverlay,
  getOverlay,
  getAllOverlays,
  commentaryOverlay,
  configureCommentary,
  tropOverlay,
  configureTrop,
  searchOverlay,
  configureSearch,
  haftarahOverlay,
  textDatingOverlay,
  verseLengthOverlay,
  configureVerseLength,
  type Overlay,
} from "./overlays/index.ts";
import {
  ZOOM_OUT_FACTOR,
  ZOOM_IN_FACTOR,
  DEFAULT_ZOOM,
  URL_UPDATE_DEBOUNCE_MS,
} from "./constants/app.ts";

// Extend window for global state
declare global {
  interface Window {
    bookLabels?: HTMLDivElement;
    torahMap?: {
      verses: VerseLayout[];
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
  registerOverlay(commentaryOverlay);
  registerOverlay(tropOverlay);
  registerOverlay(searchOverlay);
  registerOverlay(haftarahOverlay);
  registerOverlay(textDatingOverlay);
  registerOverlay(verseLengthOverlay);
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
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
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
      versesEqual,
    );
    const colors = applyItemColors(verseStates);

    // Rebuild geometry buffer with new colors
    rebuildGeometry(renderContext.gl, renderState, colors);
  }

  // Camera state - start at 1:1 zoom, centered
  const camera = createCamera(window.innerWidth, window.innerHeight, bounds);

  // Track pinned verse (click to persist)
  let pinnedVerse: VerseLayout | null = null;

  // Mouse interaction state
  const mouseState = createMouseState();

  const touchState = createTouchState();

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
      versesEqual,
    );
  }

  // Helper: Center camera on a verse
  function centerOnVerse(verse: VerseLayout): void {
    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;
    camera.x = cssWidth / 2 / camera.zoom - verse.x - verse.size / 2;
    camera.y = cssHeight / 2 / camera.zoom - verse.y - verse.size / 2;
  }

  // Helper: Pin a verse and update all dependent state
  function pinVerse(verse: VerseLayout, centerCamera: boolean = false): void {
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
          if (pinnedVerse && versesEqual(pinnedVerse, verse)) {
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
  const controlsPanel = document.getElementById("controls");

  // URL State Management
  // Extract overlay params for URL encoding
  function buildOverlayParamsForUrl(): Record<string, string> {
    if (!currentOverlay) return {};

    const overlayParams = currentOverlay.getUrlParams?.() ?? {};
    const result: Record<string, string> = {};

    if (overlayParams.trop) result.trop = overlayParams.trop;
    if (overlayParams.cat) result.category = overlayParams.cat;
    if (overlayParams.q) result.q = overlayParams.q;
    if (overlayParams.ww) result.ww = overlayParams.ww;
    if (overlayParams.hm) result.hm = overlayParams.hm;

    return result;
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
    verse: VerseLayout | null,
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

      const hoverChanged = !versesEqual(previousHover, verse);

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

  // Bottom sheet handle tap to dismiss
  const bottomSheetHandle = document.querySelector(".bottom-sheet-handle");
  bottomSheetHandle?.addEventListener("click", () => {
    unpinVerse();
  });

  // Keyboard navigation: arrow keys for next/previous verse, Escape to close
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (!pinnedVerse) return;

    if (e.key === "Escape") {
      unpinVerse();
      return;
    }

    let targetVerse: VerseLayout | null = null;

    if (e.key === "ArrowRight") {
      targetVerse = nextVerse(verses, pinnedVerse);
    } else if (e.key === "ArrowLeft") {
      targetVerse = prevVerse(verses, pinnedVerse);
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

  function setOverlay(id: string, fromUrlRestore: boolean = false): void {
    if (!fromUrlRestore) {
      trackOverlaySwitch(id, currentOverlayId);
    }
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
      // Save URL state when overlay params change (replaceState)
      saveUrlState(false);
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

  // Wire up search overlay callbacks
  configureSearch({
    verses,
    callbacks: {
      onVerseClick: (verse: VerseLayout) => {
        pinVerse(verse);
      },
    },
  });

  // Initialize help modal
  if (controlsPanel) {
    initHelp(controlsPanel);
  }

  // URL State Restoration
  // Restore overlay and its parameters from URL
  function restoreOverlayFromUrl(urlState: UrlState): void {
    if (!urlState.overlay) return;

    setOverlay(urlState.overlay, true);
    if (overlaySelect) {
      overlaySelect.value = urlState.overlay;
    }

    // Apply overlay-specific params
    if (currentOverlay?.applyUrlParams) {
      const params = new URLSearchParams();
      if (urlState.overlayParams.trop)
        params.set("trop", urlState.overlayParams.trop);
      if (urlState.overlayParams.category)
        params.set("cat", urlState.overlayParams.category);
      if (urlState.overlayParams.q) params.set("q", urlState.overlayParams.q);
      if (urlState.overlayParams.ww)
        params.set("ww", urlState.overlayParams.ww);
      if (urlState.overlayParams.hm)
        params.set("hm", urlState.overlayParams.hm);
      currentOverlay.applyUrlParams(params);
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
    const urlState = parseUrlState();

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
}

main().catch(console.error);
