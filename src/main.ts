// Tanakh Map - Main entry point

declare const __GIT_BRANCH__: string;

import { initWebGL, createProgram, createOutlineProgram } from './webgl.ts';
import { computeLayout, getLayoutBounds } from './layout.ts';
import { buildVerseGeometry, createBuffer } from './geometry.ts';
import { buildOutlineGeometry } from './outline.ts';
import { createBookLabels, updateLabelPositions } from './labels.ts';
import { loadAllVerseTexts, getVerseText } from './verseTexts.ts';
import { buildSearchIndex } from './search.ts';
import { seededRandom } from './utils/random.ts';
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
import type { Verse, TorahData, Bounds, VerseState } from './types.ts';
import {
  registerOverlay,
  getOverlay,
  getAllOverlays,
  divineNamesOverlay,
  commentaryOverlay,
  configureCommentary,
  getVerseLinkCount,
  tropOverlay,
  configureTrop,
  getSelectedTrop,
  highlightTropInText,
  searchOverlay,
  configureSearch,
  highlightSearchTerms,
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

/**
 * Mouse interaction state
 */
interface MouseState {
  isDragging: boolean;
  hoveredVerse: Verse | null;
  dragStart: { x: number; y: number };
}

/**
 * Check if two verses refer to the same verse.
 * Handles null comparison.
 */
function versesEqual(a: Verse | null, b: Verse | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;
}

function findVerseAtPoint(
  verses: Verse[],
  pan: { x: number; y: number },
  zoom: number,
  canvasX: number,
  canvasY: number
): Verse | null {
  // Convert screen coords to world coords
  const worldX = canvasX / zoom - pan.x;
  const worldY = canvasY / zoom - pan.y;

  // First, try exact hit detection
  for (const v of verses) {
    if (worldX >= v.x && worldX < v.x + v.size &&
        worldY >= v.y && worldY < v.y + v.size) {
      return v;
    }
  }

  // If no exact hit, find nearest verse within a fuzzy radius
  let nearestVerse: Verse | null = null;
  let nearestDistSq = HIGHLIGHT_CONSTANTS.FUZZY_RADIUS * HIGHLIGHT_CONSTANTS.FUZZY_RADIUS;

  for (const v of verses) {
    // Find center of verse square
    const centerX = v.x + v.size / 2;
    const centerY = v.y + v.size / 2;

    // Distance from mouse to verse center
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    const distSq = dx * dx + dy * dy;

    // If within fuzzy radius and closer than previous best
    if (distSq < nearestDistSq) {
      nearestVerse = v;
      nearestDistSq = distSq;
    }
  }

  return nearestVerse;
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

  // Init WebGL
  const gl = initWebGL(canvas);
  const prog = createProgram(gl);
  const outlineProg = createOutlineProgram(gl);

  // Current overlay state
  let currentOverlay: Overlay | null = null;
  let buffer: WebGLBuffer;
  let outlineBuffer: WebGLBuffer | null = null;

  /**
   * Get default gray color with brightness variation for a verse.
   * Uses seeded random to ensure consistent appearance.
   */
  function getDefaultColor(verseIndex: number): [number, number, number] {
    const brightness = HIGHLIGHT_CONSTANTS.MIN_BRIGHTNESS +
      seededRandom(verseIndex * 3) * HIGHLIGHT_CONSTANTS.BRIGHTNESS_RANGE;
    return [brightness, brightness, brightness];
  }

  /**
   * Get overlay-provided color for a verse, or null if overlay doesn't color it.
   */
  function getOverlayColor(
    overlay: Overlay | null,
    verse: Verse
  ): [number, number, number] | [number, number, number][] | null {
    return overlay?.getVerseColor(verse) ?? null;
  }

  /**
   * Apply hover highlighting to a verse color.
   * Second pass: modifies colors based on hover state.
   * - Verses with overlay color: brighten by 1.5x
   * - Verses without overlay color (background): replace with highlight color
   */
  function applyHoverHighlight(
    baseColor: [number, number, number] | [number, number, number][],
    hasOverlayColor: boolean
  ): [number, number, number] | [number, number, number][] {
    if (hasOverlayColor) {
      // Brighten overlay-colored verses by 1.5x
      if (Array.isArray(baseColor[0])) {
        // Array of colors (multi-color verse)
        return (baseColor as [number, number, number][]).map((c) => [
          Math.min(1, c[0] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
          Math.min(1, c[1] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
          Math.min(1, c[2] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
        ] as [number, number, number]);
      } else {
        // Single color
        const c = baseColor as [number, number, number];
        return [
          Math.min(1, c[0] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
          Math.min(1, c[1] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
          Math.min(1, c[2] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
        ];
      }
    } else {
      // Replace background verses with highlight color
      return HIGHLIGHT_CONSTANTS.HIGHLIGHT_COLOR;
    }
  }

  /**
   * Compute semantic state for all verses.
   * First pass: determine what is true about each verse (hasOverlayColor, baseColor, isHovered, isPinned)
   * Returns array parallel to verses array.
   */
  function computeVerseStates(
    verses: Verse[],
    overlay: Overlay | null,
    hoveredVerse: Verse | null,
    pinnedVerse: Verse | null
  ): VerseState[] {
    return verses.map((v, i) => {
      const overlayColor = getOverlayColor(overlay, v);
      const hasOverlayColor = overlayColor !== null;
      const baseColor = hasOverlayColor ? overlayColor : getDefaultColor(i);

      const isHovered = hoveredVerse !== null &&
        hoveredVerse.book === v.book &&
        hoveredVerse.chapter === v.chapter &&
        hoveredVerse.verse === v.verse;

      const isPinned = pinnedVerse !== null &&
        pinnedVerse.book === v.book &&
        pinnedVerse.chapter === v.chapter &&
        pinnedVerse.verse === v.verse;

      return {
        hasOverlayColor,
        baseColor,
        isHovered,
        isPinned,
      };
    });
  }

  // Function to apply overlay colors
  function applyOverlay(): void {
    // First pass: compute semantic state for all verses
    const verseStates = computeVerseStates(
      verses,
      currentOverlay,
      mouseState?.hoveredVerse ?? null,
      pinnedVerse ?? null
    );

    // Second pass: apply base colors, then hover highlighting
    verses.forEach((v, i) => {
      const state = verseStates[i];

      // Start with base color
      let finalColor = state.baseColor;

      // Apply hover highlighting if this verse is hovered
      if (state.isHovered) {
        finalColor = applyHoverHighlight(finalColor, state.hasOverlayColor);
      }

      v.color = finalColor;
    });

    // Rebuild geometry buffer
    const geometry = buildVerseGeometry(verses, HIGHLIGHT_CONSTANTS.OUTLINE_COLOR);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
  }

  // Build initial geometry
  const geometry = buildVerseGeometry(verses);
  buffer = createBuffer(gl, geometry);

  // Camera state - start at 1:1 zoom, centered
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;

  // Always start at 1:1 zoom to avoid moiré from fractional scaling
  let zoom = 1.0;

  // Center the visualization
  const pan = {
    x: (cssWidth / 2 - bounds.width / 2),
    y: (cssHeight / 2 - bounds.height / 2)
  };

  // Track pinned verse (click to persist)
  let pinnedVerse: Verse | null = null;

  // Render function
  function render(): void {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog.program);

    // Set uniforms - scale zoom by dpr to account for high-DPI canvas
    gl.uniform2f(prog.uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(prog.uniforms.pan, pan.x, pan.y);
    gl.uniform1f(prog.uniforms.zoom, zoom * dpr);

    // Bind buffer and set attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    // Vertex layout: x, y, r1,g1,b1, r2,g2,b2, r3,g3,b3, r4,g4,b4, colorCount, u, v, seedX, seedY
    const stride = 19 * 4; // 19 floats * 4 bytes
    gl.enableVertexAttribArray(prog.attribs.position);
    gl.vertexAttribPointer(prog.attribs.position, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(prog.attribs.color);
    gl.vertexAttribPointer(prog.attribs.color, 3, gl.FLOAT, false, stride, 2 * 4);

    gl.enableVertexAttribArray(prog.attribs.color2);
    gl.vertexAttribPointer(prog.attribs.color2, 3, gl.FLOAT, false, stride, 5 * 4);

    gl.enableVertexAttribArray(prog.attribs.color3);
    gl.vertexAttribPointer(prog.attribs.color3, 3, gl.FLOAT, false, stride, 8 * 4);

    gl.enableVertexAttribArray(prog.attribs.color4);
    gl.vertexAttribPointer(prog.attribs.color4, 3, gl.FLOAT, false, stride, 11 * 4);

    gl.enableVertexAttribArray(prog.attribs.colorCount);
    gl.vertexAttribPointer(prog.attribs.colorCount, 1, gl.FLOAT, false, stride, 14 * 4);

    gl.enableVertexAttribArray(prog.attribs.uv);
    gl.vertexAttribPointer(prog.attribs.uv, 2, gl.FLOAT, false, stride, 15 * 4);

    gl.enableVertexAttribArray(prog.attribs.seed);
    gl.vertexAttribPointer(prog.attribs.seed, 2, gl.FLOAT, false, stride, 17 * 4);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, verses.length * 6);

    // Draw outline for pinned verse on top
    renderOutline(pinnedVerse);

    if (window.bookLabels) updateLabelPositions(window.bookLabels, pan, zoom);
  }

  /**
   * Render outline border for the pinned verse.
   * Draws on top of the main verse geometry.
   */
  function renderOutline(verse: Verse | null): void {
    if (!verse) return;

    // Build outline geometry for this verse
    const geometry = buildOutlineGeometry({
      x: verse.x,
      y: verse.y,
      size: verse.size,
    });

    // Create or update outline buffer
    if (!outlineBuffer) {
      outlineBuffer = createBuffer(gl, geometry);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, outlineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
    }

    // Use outline shader
    gl.useProgram(outlineProg.program);

    // Set uniforms (same pan/zoom as main render)
    gl.uniform2f(outlineProg.uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(outlineProg.uniforms.pan, pan.x, pan.y);
    gl.uniform1f(outlineProg.uniforms.zoom, zoom * dpr);
    gl.uniform3f(outlineProg.uniforms.color, ...HIGHLIGHT_CONSTANTS.OUTLINE_COLOR);

    // Bind buffer and set position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, outlineBuffer);

    // Vertex layout for outline: just x, y at start (then other unused data)
    // Each vertex = x, y, r1,g1,b1, r2,g2,b2, r3,g3,b3, r4,g4,b4, colorCount, u, v, seedX, seedY
    const stride = 19 * 4; // Same as main shader
    gl.enableVertexAttribArray(outlineProg.attribs.position);
    gl.vertexAttribPointer(outlineProg.attribs.position, 2, gl.FLOAT, false, stride, 0);

    // Draw outline (4 borders * 6 vertices each = 24 vertices)
    gl.drawArrays(gl.TRIANGLES, 0, 24);
  }

  render();

  // Book labels
  window.bookLabels = createBookLabels(verses, document.body);
  updateLabelPositions(window.bookLabels, pan, zoom);

  // Smooth zooming with mouse wheel, centered on cursor
  canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, zoom * zoomFactor));

    // Get mouse position in canvas coordinates
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Adjust pan so the world point under the mouse stays fixed
    // Before: worldX = mouseX / zoom - pan.x
    // After:  worldX = mouseX / newZoom - newPan.x (same worldX)
    // Solving: newPan.x = pan.x + mouseX * (1/newZoom - 1/zoom)
    pan.x += mouseX * (1 / newZoom - 1 / zoom);
    pan.y += mouseY * (1 / newZoom - 1 / zoom);

    zoom = newZoom;
    render();
    debouncedSaveUrlState();
  }, { passive: false });

  // Mouse interaction state
  const mouseState: MouseState = {
    isDragging: false,
    hoveredVerse: null,
    dragStart: { x: 0, y: 0 },
  };

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    mouseState.isDragging = true;
    mouseState.dragStart = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (mouseState.isDragging) {
      const dx = e.clientX - mouseState.dragStart.x;
      const dy = e.clientY - mouseState.dragStart.y;
      pan.x += dx / zoom;
      pan.y += dy / zoom;
      mouseState.dragStart = { x: e.clientX, y: e.clientY };
      render();
    }
  });

  canvas.addEventListener('mouseup', () => {
    if (mouseState.isDragging) {
      mouseState.isDragging = false;
      debouncedSaveUrlState();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    const wasHovering = mouseState.hoveredVerse !== null;
    mouseState.isDragging = false;
    mouseState.hoveredVerse = null;

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
  const sidebar = document.getElementById('verse-sidebar');
  const sidebarRef = sidebar?.querySelector('.ref-text');
  const sidebarOverlayInfo = sidebar?.querySelector('.overlay-info');
  const sidebarHebrew = sidebar?.querySelector('.verse-hebrew');
  const sidebarEnglish = sidebar?.querySelector('.verse-english');
  const sidebarLink = sidebar?.querySelector('.sefaria-link') as HTMLAnchorElement | null;
  const sidebarLinkSubtitle = sidebar?.querySelector('.link-subtitle');
  const sidebarCloseBtn = sidebar?.querySelector('.close-btn');
  const controlsPanel = document.getElementById('controls');

  // Position sidebar below controls panel
  function positionSidebar(): void {
    if (!sidebar || !controlsPanel) return;
    const controlsRect = controlsPanel.getBoundingClientRect();
    (sidebar as HTMLElement).style.top = `${controlsRect.bottom + 10}px`;
  }

  // Build Sefaria URL for a verse
  function getSefariaUrl(book: string, chapter: number, verse: number): string {
    const sefariaBook = book.replace(/ /g, '_');
    return `https://www.sefaria.org/${sefariaBook}.${chapter}.${verse}`;
  }

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
    if (zoom !== 1.0) {
      state.zoom = zoom;
    }

    // Pan (only if no verse - verse auto-centers)
    if (!pinnedVerse) {
      state.x = pan.x;
      state.y = pan.y;
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

  // Update sidebar with verse info
  function updateSidebar(verse: Verse | null, isPinned: boolean = false): void {
    if (!sidebar) return;

    if (!verse) {
      sidebar.classList.remove('visible');
      sidebar.classList.remove('pinned');
      return;
    }

    const text = getVerseText(verseTexts, verse.book, verse.chapter, verse.verse);

    if (sidebarRef) {
      sidebarRef.textContent = `${verse.book} ${verse.chapter}:${verse.verse}`;
    }
    if (sidebarOverlayInfo) {
      // Get overlay-specific hover info (e.g., parshah name for Torah verses)
      const hoverInfo = currentOverlay?.getHoverInfo?.(verse);
      sidebarOverlayInfo.textContent = hoverInfo || '';
    }
    if (sidebarHebrew) {
      const hebrewText = text?.he || 'Loading...';
      const selectedTrop = getSelectedTrop();
      if (currentOverlay?.id === 'trop' && selectedTrop) {
        sidebarHebrew.innerHTML = highlightTropInText(hebrewText, selectedTrop.unicode);
      } else if (currentOverlay?.id === 'search') {
        sidebarHebrew.innerHTML = highlightSearchTerms(hebrewText, 'he');
      } else {
        sidebarHebrew.textContent = hebrewText;
      }
    }
    if (sidebarEnglish) {
      const englishText = text?.en || 'Loading...';
      if (currentOverlay?.id === 'search') {
        sidebarEnglish.innerHTML = highlightSearchTerms(englishText, 'en');
      } else {
        sidebarEnglish.textContent = englishText;
      }
    }
    if (sidebarLink) {
      sidebarLink.href = getSefariaUrl(verse.book, verse.chapter, verse.verse);
    }
    if (sidebarLinkSubtitle) {
      const linkCount = getVerseLinkCount(verse.book, verse.chapter, verse.verse);
      sidebarLinkSubtitle.textContent = linkCount ? `${linkCount} linked texts` : '';
    }

    positionSidebar();
    sidebar.classList.add('visible');
    if (isPinned) {
      sidebar.classList.add('pinned');
    } else {
      sidebar.classList.remove('pinned');
    }
  }

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (!mouseState.isDragging) {
      const verse = findVerseAtPoint(verses, pan, zoom, e.clientX, e.clientY);
      const previousHover = mouseState.hoveredVerse;
      mouseState.hoveredVerse = verse;

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
        updateSidebar(verse, false);
      } else {
        updateSidebar(null);
      }
    }
  });

  // Click to pin/unpin verse
  canvas.addEventListener('click', (e: MouseEvent) => {
    const verse = findVerseAtPoint(verses, pan, zoom, e.clientX, e.clientY);
    if (verse) {
      // Toggle pin: if clicking same verse, unpin; otherwise pin new verse
      if (pinnedVerse &&
          pinnedVerse.book === verse.book &&
          pinnedVerse.chapter === verse.chapter &&
          pinnedVerse.verse === verse.verse) {
        pinnedVerse = null;
        updateSidebar(null);
        saveUrlState(true);
      } else {
        pinnedVerse = verse;
        updateSidebar(verse, true);
        saveUrlState(true);
      }
    } else if (pinnedVerse) {
      // Clicking empty space unpins
      pinnedVerse = null;
      updateSidebar(null);
      saveUrlState(true);
    }
  });

  // Close button to unpin
  sidebarCloseBtn?.addEventListener('click', () => {
    pinnedVerse = null;
    updateSidebar(null);
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
    requestAnimationFrame(positionSidebar);

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
  window.torahMap = { verses, pan, zoom, render, canvas, bounds };

  // Wire up search overlay callbacks
  configureSearch({
    verses,
    callbacks: {
      onVerseClick: (verse: Verse) => {
        pinnedVerse = verse;
        updateSidebar(verse, true);
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
      zoom = urlState.zoom;
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
          updateSidebar(verse, true);

          // Center on the verse
          const cssWidth = window.innerWidth;
          const cssHeight = window.innerHeight;
          pan.x = cssWidth / 2 / zoom - verse.x - verse.size / 2;
          pan.y = cssHeight / 2 / zoom - verse.y - verse.size / 2;
        }
      }
    } else if (urlState.x !== undefined && urlState.y !== undefined) {
      // Restore pan position (only if no verse)
      pan.x = urlState.x;
      pan.y = urlState.y;
    }

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
