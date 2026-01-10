// Tanakh Map - Main entry point

declare const __GIT_BRANCH__: string;

import { initWebGL, createProgram } from './webgl.ts';
import { computeLayout, getLayoutBounds } from './layout.ts';
import { buildVerseGeometry, createBuffer } from './geometry.ts';
import { createBookLabels, updateLabelPositions } from './labels.ts';
import { loadAllVerseTexts, getVerseText } from './verseTexts.ts';
import { buildSearchIndex } from './search.ts';
import { seededRandom } from './utils/random.ts';
import { getCurrentUrl } from './urlState.ts';
import type { Verse, TorahData, Bounds } from './types.ts';
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
  type Overlay,
} from './overlays/index.ts';

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

  for (const v of verses) {
    if (worldX >= v.x && worldX < v.x + v.size &&
        worldY >= v.y && worldY < v.y + v.size) {
      return v;
    }
  }
  return null;
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

  // Current overlay state
  let currentOverlay: Overlay | null = null;
  let buffer: WebGLBuffer;

  // Function to apply overlay colors
  function applyOverlay(): void {
    verses.forEach((v, i) => {
      const color = currentOverlay?.getVerseColor(v) ?? null;
      if (color) {
        v.color = color;
      } else {
        const brightness = 0.4 + seededRandom(i * 3) * 0.4;
        v.color = [brightness, brightness, brightness];
      }
    });

    // Rebuild geometry buffer
    const geometry = buildVerseGeometry(verses, [0.6, 0.6, 0.6]);
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

    const stride = 7 * 4; // 7 floats * 4 bytes (x, y, r, g, b, u, v)
    gl.enableVertexAttribArray(prog.attribs.position);
    gl.vertexAttribPointer(prog.attribs.position, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(prog.attribs.color);
    gl.vertexAttribPointer(prog.attribs.color, 3, gl.FLOAT, false, stride, 2 * 4);

    gl.enableVertexAttribArray(prog.attribs.uv);
    gl.vertexAttribPointer(prog.attribs.uv, 2, gl.FLOAT, false, stride, 5 * 4);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, verses.length * 6);

    if (window.bookLabels) updateLabelPositions(window.bookLabels, pan, zoom);
  }

  render();

  // Book labels
  window.bookLabels = createBookLabels(verses, document.body);
  updateLabelPositions(window.bookLabels, pan, zoom);

  // Smooth zooming with mouse wheel
  canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoom = Math.max(0.1, Math.min(10, zoom * zoomFactor));
    render();
  }, { passive: false });

  // Pan with mouse drag
  let isDragging = false;
  let lastMouse = { x: 0, y: 0 };

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      pan.x += dx / zoom;
      pan.y += dy / zoom;
      lastMouse = { x: e.clientX, y: e.clientY };
      render();
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
  });

  // Sidebar for verse details
  const sidebar = document.getElementById('verse-sidebar');
  const sidebarRef = sidebar?.querySelector('.ref-text');
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

  // Track pinned verse (click to persist)
  let pinnedVerse: Verse | null = null;

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
    if (!isDragging) {
      const verse = findVerseAtPoint(verses, pan, zoom, e.clientX, e.clientY);

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
      } else {
        pinnedVerse = verse;
        updateSidebar(verse, true);
      }
    } else if (pinnedVerse) {
      // Clicking empty space unpins
      pinnedVerse = null;
      updateSidebar(null);
    }
  });

  // Close button to unpin
  sidebarCloseBtn?.addEventListener('click', () => {
    pinnedVerse = null;
    updateSidebar(null);
  });

  // UI elements
  const overlaySelect = document.getElementById('overlay-select') as HTMLSelectElement;

  // Overlay controls container (will be populated by overlays)
  const overlayControlsContainer = document.getElementById('overlay-controls');
  const overlayLegendContainer = document.getElementById('overlay-legend');

  function setOverlay(id: string): void {
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
      },
    },
  });

  // Copy Link button handler
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const copyLinkText = copyLinkBtn?.querySelector('span');
  copyLinkBtn?.addEventListener('click', async () => {
    const url = getCurrentUrl();
    await navigator.clipboard.writeText(url);

    // Visual feedback
    copyLinkBtn.classList.add('copied');
    if (copyLinkText) copyLinkText.textContent = 'Copied!';

    setTimeout(() => {
      copyLinkBtn.classList.remove('copied');
      if (copyLinkText) copyLinkText.textContent = 'Copy Link';
    }, 1500);
  });
}

main().catch(console.error);
