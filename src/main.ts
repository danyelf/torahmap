// Tanakh Map - Main entry point

declare const __GIT_BRANCH__: string;

import { computeLayout, getLayoutBounds } from './layout.ts';
import { createBookLabels, updateLabelPositions } from './labels.ts';
import { loadAllVerseTexts, getVerseText } from './verseTexts.ts';
import { buildSearchIndex } from './search.ts';
import { initHelp } from './help.ts';
import {
  parseUrlState,
  parseVerseFromUrl,
  updateUrl,
  subscribeToHashChange,
  verseToUrlFormat,
  debounce,
  type UrlState,
} from './urlState.ts';
import {
  getSidebarElements,
  positionSidebar,
  updateSidebar,
} from './sidebar.ts';
import { createCamera, clampZoom, panForZoom, type Camera } from './camera.ts';
import { createMouseState, versesEqual, startDrag, stopDrag, setHoveredVerse, clearHover, type MouseState } from './mouseState.ts';
import { findVerseAtPoint } from './hitDetection.ts';
import { computeVerseStates, applyVerseColors } from './verseColoring.ts';
import { createRenderContext, createRenderState, rebuildGeometry, render as renderFrame, type RenderContext, type RenderState } from './rendering.ts';
import type { Verse, TorahData, Bounds, VerseState } from './types.ts';
import {
  registerOverlay,
  getOverlay,
  getAllOverlays,
  divineNamesOverlay,
  commentaryOverlay,
  configureCommentary,
  tropOverlay,
  configureTrop,
  searchOverlay,
  configureSearch,
  haftarahOverlay,
  type Overlay,
} from './overlays/index.ts';
import { HIGHLIGHT_CONSTANTS } from './constants.ts';

// Extend window for global state
declare global {
  interface Window {
    bookLabels?: HTMLDivElement;
    torahMap?: {
      verses: Verse[];
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

  // Load Tanakh structure and verse texts in parallel
  const [torahResponse, verseTexts] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/tanakh-structure.json`),
    loadAllVerseTexts()
  ]);

  if (!torahResponse.ok) {
    throw new Error(`Failed to load tanakh-structure.json: ${torahResponse.status}`);
  }

  let torahData: TorahData;
  try {
    torahData = await torahResponse.json();
  } catch (e) {
    throw new Error(`Failed to parse tanakh-structure.json: ${e}`);
  }

  // Compute layout
  const verses = computeLayout(torahData);
  const bounds = getLayoutBounds(verses);
  console.log(`Loaded ${verses.length} verses, bounds: ${bounds.width}x${bounds.height}`);

  // Build search index
  buildSearchIndex(verseTexts);

  // Register and initialize overlays
  registerOverlay(divineNamesOverlay);
  registerOverlay(commentaryOverlay);
  registerOverlay(tropOverlay);
  registerOverlay(searchOverlay);
  registerOverlay(haftarahOverlay);
  configureCommentary({ verses });
  configureTrop({ verseTexts });
  // Note: configureSearch is called later after updateSidebar is defined

  await Promise.all(getAllOverlays().map(o => o.init?.()));

  // Setup canvas with devicePixelRatio for crisp rendering on high-DPI displays
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas not found');
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
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
    const verseStates = computeVerseStates(
      verses,
      currentOverlay,
      mouseState.hoveredVerse,
      pinnedVerse
    );
    applyVerseColors(verses, verseStates);

    // Rebuild geometry buffer
    rebuildGeometry(renderContext.gl, renderState);
  }

  // Camera state - start at 1:1 zoom, centered
  const camera = createCamera(window.innerWidth, window.innerHeight, bounds);

  // Track pinned verse (click to persist)
  let pinnedVerse: Verse | null = null;

  // Mouse interaction state
  const mouseState = createMouseState();

  // Render function
  function render(): void {
    renderFrame(renderContext, renderState, camera, mouseState.hoveredVerse, pinnedVerse);
  }

  render();

  // Book labels
  window.bookLabels = createBookLabels(verses, document.body);
  updateLabelPositions(window.bookLabels, { x: camera.x, y: camera.y }, camera.zoom);

  // Smooth zooming with mouse wheel, centered on cursor
  canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = clampZoom(camera.zoom * zoomFactor);

    // Get mouse position in canvas coordinates
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Adjust pan so the world point under the mouse stays fixed
    const newPan = panForZoom({ x: camera.x, y: camera.y }, camera.zoom, newZoom, mouseX, mouseY);
    camera.x = newPan.x;
    camera.y = newPan.y;
    camera.zoom = newZoom;

    render();
    debouncedSaveUrlState();
  }, { passive: false });

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    startDrag(mouseState, e.clientX, e.clientY);
  });

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (mouseState.isDragging) {
      const dx = e.clientX - mouseState.dragStart.x;
      const dy = e.clientY - mouseState.dragStart.y;
      camera.x += dx / camera.zoom;
      camera.y += dy / camera.zoom;
      mouseState.dragStart = { x: e.clientX, y: e.clientY };
      render();
    }
  });

  canvas.addEventListener('mouseup', () => {
    if (mouseState.isDragging) {
      stopDrag(mouseState);
      debouncedSaveUrlState();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    const wasHovering = mouseState.hoveredVerse !== null;
    clearHover(mouseState);

    // Notify overlay of hover change
    let overlayWantsRerender = false;
    if (currentOverlay?.setHoveredVerse) {
      overlayWantsRerender = currentOverlay.setHoveredVerse(null);
    }

    // Re-render if we were hovering (to clear highlight) or overlay requested it
    if (wasHovering || overlayWantsRerender) {
      applyOverlay();
      render();
    }
  });

  // Sidebar for verse details
  const sidebarElements = getSidebarElements();
  const controlsPanel = document.getElementById('controls');

  // URL State Management
  // Build current state for URL
  function buildCurrentUrlState(): UrlState {
    const state: UrlState = {
      overlayParams: {},
    };

    // Overlay
    if (currentOverlay) {
      state.overlay = currentOverlay.id;
      // Get overlay-specific params
      const overlayParams = currentOverlay.getUrlParams?.() ?? {};
      if (overlayParams.trop) state.overlayParams.trop = overlayParams.trop;
      if (overlayParams.cat) state.overlayParams.category = overlayParams.cat;
      if (overlayParams.q) state.overlayParams.q = overlayParams.q;
    }

    // Pinned verse
    if (pinnedVerse) {
      state.verse = verseToUrlFormat(pinnedVerse.book, pinnedVerse.chapter, pinnedVerse.verse);
    }

    // Zoom (only if not default)
    if (camera.zoom !== 1.0) {
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
  const debouncedSaveUrlState = debounce(() => saveUrlState(false), 300);

  // Update sidebar with verse info - wrapper for the extracted module function
  function updateSidebarWrapper(verse: Verse | null, isPinned: boolean = false): void {
    updateSidebar(sidebarElements, verse, verseTexts, currentOverlay, getVerseText, isPinned);
    positionSidebar(sidebarElements.sidebar, controlsPanel);
  }

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (!mouseState.isDragging) {
      const verse = findVerseAtPoint(verses, camera, e.clientX, e.clientY);
      const previousHover = mouseState.hoveredVerse;
      setHoveredVerse(mouseState, verse);

      // Check if hover actually changed
      const hoverChanged = !versesEqual(previousHover, verse);

      // Notify overlay of hover change for cross-highlighting
      let overlayWantsRerender = false;
      if (currentOverlay?.setHoveredVerse) {
        overlayWantsRerender = currentOverlay.setHoveredVerse(verse);
      }

      // Re-render if hover changed (for base highlighting) or overlay requested it
      if (hoverChanged || overlayWantsRerender) {
        applyOverlay();
        render();
      }

      // Update sidebar (pinned takes precedence - no hover changes when pinned)
      if (pinnedVerse) {
        // Keep showing pinned verse, don't update on hover
      } else if (verse) {
        updateSidebarWrapper(verse, false);
      } else {
        updateSidebarWrapper(null);
      }
    }
  });

  // Click to pin/unpin verse
  canvas.addEventListener('click', (e: MouseEvent) => {
    const verse = findVerseAtPoint(verses, camera, e.clientX, e.clientY);
    if (verse) {
      // Toggle pin: if clicking same verse, unpin; otherwise pin new verse
      if (pinnedVerse &&
          pinnedVerse.book === verse.book &&
          pinnedVerse.chapter === verse.chapter &&
          pinnedVerse.verse === verse.verse) {
        pinnedVerse = null;
        updateSidebarWrapper(null);
        applyOverlay();
        render();
        saveUrlState(true);
      } else {
        pinnedVerse = verse;
        updateSidebarWrapper(verse, true);
        applyOverlay();
        render();
        saveUrlState(true);
      }
    } else if (pinnedVerse) {
      // Clicking empty space unpins
      pinnedVerse = null;
      updateSidebarWrapper(null);
      applyOverlay();
      render();
      saveUrlState(true);
    }
  });

  // Close button to unpin
  sidebarElements.closeBtn?.addEventListener('click', () => {
    pinnedVerse = null;
    updateSidebarWrapper(null);
    applyOverlay();
    render();
    saveUrlState(true);
  });

  // UI elements
  const overlaySelect = document.getElementById('overlay-select') as HTMLSelectElement;

  // Overlay controls container (will be populated by overlays)
  const overlayControlsContainer = document.getElementById('overlay-controls');
  const overlayLegendContainer = document.getElementById('overlay-legend');

  function setOverlay(id: string, fromUrlRestore: boolean = false): void {
    currentOverlay?.destroy?.();
    currentOverlay = getOverlay(id) ?? null;

    // Wire up update callback for dynamic overlays
    currentOverlay?.onUpdate?.(() => {
      applyOverlay();
      // Re-render legend when overlay updates (e.g., category changes)
      if (overlayLegendContainer) {
        overlayLegendContainer.innerHTML = '';
        currentOverlay?.renderLegend?.(overlayLegendContainer);
      }
      render();
      // Save URL state when overlay params change (replaceState)
      saveUrlState(false);
    });

    // Clear and render overlay's UI
    if (overlayControlsContainer) {
      overlayControlsContainer.innerHTML = '';
      currentOverlay?.renderControls?.(overlayControlsContainer);
    }
    if (overlayLegendContainer) {
      overlayLegendContainer.innerHTML = '';
      currentOverlay?.renderLegend?.(overlayLegendContainer);
    }

    applyOverlay();
    render();

    // Reposition sidebar after overlay controls are rendered
    requestAnimationFrame(() => positionSidebar(sidebarElements.sidebar, controlsPanel));

    // Update URL when overlay changes (unless restoring from URL)
    if (!fromUrlRestore) {
      saveUrlState(true);
    }
  }

  // Overlay selector
  overlaySelect?.addEventListener('change', () => {
    setOverlay(overlaySelect.value);
  });

  // Handle resize
  window.addEventListener('resize', () => {
    resizeCanvas();
    render();
  });

  // Store for hover detection
  window.torahMap = {
    verses,
    pan: { x: camera.x, y: camera.y },
    zoom: camera.zoom,
    render,
    canvas,
    bounds
  };

  // Wire up search overlay callbacks
  configureSearch({
    verses,
    callbacks: {
      onVerseClick: (verse: Verse) => {
        pinnedVerse = verse;
        updateSidebarWrapper(verse, true);
        applyOverlay();
        render();
        saveUrlState(true);
      },
    },
  });

  // Initialize help modal
  if (controlsPanel) {
    initHelp(controlsPanel);
  }

  // URL State Restoration
  function restoreFromUrl(): void {
    const urlState = parseUrlState();

    // Restore overlay
    if (urlState.overlay) {
      setOverlay(urlState.overlay, true);
      if (overlaySelect) {
        overlaySelect.value = urlState.overlay;
      }

      // Apply overlay-specific params
      if (currentOverlay?.applyUrlParams) {
        const params = new URLSearchParams();
        if (urlState.overlayParams.trop) params.set('trop', urlState.overlayParams.trop);
        if (urlState.overlayParams.category) params.set('cat', urlState.overlayParams.category);
        if (urlState.overlayParams.q) params.set('q', urlState.overlayParams.q);
        currentOverlay.applyUrlParams(params);
      }
    }

    // Restore zoom
    if (urlState.zoom !== undefined) {
      camera.zoom = urlState.zoom;
    }

    // Restore verse (and center on it)
    if (urlState.verse) {
      const parsed = parseVerseFromUrl(urlState.verse);
      if (parsed) {
        // Find the verse in our list
        const verse = verses.find(
          v => v.book === parsed.book && v.chapter === parsed.chapter && v.verse === parsed.verse
        );
        if (verse) {
          pinnedVerse = verse;
          updateSidebarWrapper(verse, true);

          // Center on the verse
          const cssWidth = window.innerWidth;
          const cssHeight = window.innerHeight;
          camera.x = cssWidth / 2 / camera.zoom - verse.x - verse.size / 2;
          camera.y = cssHeight / 2 / camera.zoom - verse.y - verse.size / 2;
        }
      }
    } else if (urlState.x !== undefined && urlState.y !== undefined) {
      // Restore pan position (only if no verse)
      camera.x = urlState.x;
      camera.y = urlState.y;
    }

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
