// Tanakh Map - Main entry point

declare const __GIT_BRANCH__: string;

import { initWebGL, createProgram } from './webgl.ts';
import { computeLayout, getLayoutBounds } from './layout.ts';
import { buildVerseGeometry, createBuffer } from './geometry.ts';
import { createBookLabels, updateLabelPositions } from './labels.ts';
import { loadAllVerseTexts, getVerseText } from './verseTexts.ts';
import { buildSearchIndex, search, getMatchingVerseKeys, type SearchResult } from './search.ts';
import type { Verse, TorahData, Bounds } from './types.ts';
import {
  registerOverlay,
  getOverlay,
  getAllOverlays,
  divineNamesOverlay,
  commentaryOverlay,
  setCommentaryVerses,
  tropOverlay,
  setTropVerseTexts,
  getSelectedTrop,
  highlightTropInText,
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
    fetch('/data/tanakh-structure.json'),
    loadAllVerseTexts()
  ]);
  const torahData: TorahData = await torahResponse.json();

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
  setCommentaryVerses(verses);
  setTropVerseTexts(verseTexts);

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

  // Search state
  let hasActiveSearch = false;
  let currentSearchResults: SearchResult[] = [];

  // Seeded random for consistent gray variation
  function seededRandom(seed: number): number {
    const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

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
    const geometry = buildVerseGeometry(verses, [0.6, 0.6, 0.6], hasActiveSearch);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
  }

  // Function to update search highlights
  function updateSearchHighlights(results: SearchResult[]): void {
    // Clear all highlights
    for (const v of verses) {
      v.highlighted = false;
    }

    // Set highlights for matching verses
    if (results.length > 0) {
      const matchingKeys = getMatchingVerseKeys(results);
      for (const v of verses) {
        const key = `${v.book}:${v.chapter}:${v.verse}`;
        if (matchingKeys.has(key)) {
          v.highlighted = true;
        }
      }
    }

    // Rebuild geometry with current overlay + highlights
    const geometry = buildVerseGeometry(verses, [0.6, 0.6, 0.6], hasActiveSearch);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
    render();
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

  // Hover detection with overlay-aware info and sidebar
  const hoverInfo = document.getElementById('hover-info');
  const sidebar = document.getElementById('verse-sidebar');
  const sidebarRef = sidebar?.querySelector('.ref-text');
  const sidebarHebrew = sidebar?.querySelector('.verse-hebrew');
  const sidebarEnglish = sidebar?.querySelector('.verse-english');
  const sidebarLink = sidebar?.querySelector('.sefaria-link') as HTMLAnchorElement | null;
  const sidebarLinkSubtitle = sidebar?.querySelector('.link-subtitle');
  const sidebarCloseBtn = sidebar?.querySelector('.close-btn');

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
      } else {
        sidebarHebrew.textContent = hebrewText;
      }
    }
    if (sidebarEnglish) {
      sidebarEnglish.textContent = text?.en || 'Loading...';
    }
    if (sidebarLink) {
      sidebarLink.href = getSefariaUrl(verse.book, verse.chapter, verse.verse);
    }
    if (sidebarLinkSubtitle) {
      sidebarLinkSubtitle.textContent = '';
    }

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

      // Update hover info based on current overlay
      if (hoverInfo) {
        if (verse) {
          let info = `${verse.book} ${verse.chapter}:${verse.verse}`;
          const overlayInfo = currentOverlay?.getHoverInfo?.(verse);
          if (overlayInfo) {
            info += ` (${overlayInfo})`;
          }
          hoverInfo.textContent = info;
        } else {
          hoverInfo.textContent = '';
        }
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

  // Search UI
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const searchClear = document.getElementById('search-clear') as HTMLButtonElement;
  const searchResults = document.getElementById('search-results');
  const searchCount = document.getElementById('search-count');

  function renderSearchResults(results: SearchResult[]): void {
    if (!searchResults || !searchCount) return;

    // Clear previous results (except count)
    const existingResults = searchResults.querySelectorAll('.search-result');
    existingResults.forEach(el => el.remove());

    if (results.length === 0) {
      searchResults.classList.remove('visible');
      return;
    }

    // Update count
    searchCount.textContent = `${results.length}${results.length >= 100 ? '+' : ''} results`;

    // Show up to 10 results
    const displayResults = results.slice(0, 10);
    for (const result of displayResults) {
      const div = document.createElement('div');
      div.className = 'search-result';
      div.innerHTML = `
        <div class="ref">${result.book} ${result.chapter}:${result.verse}</div>
        <div class="snippet ${result.language === 'he' ? 'rtl' : ''}">${escapeAndHighlight(result.snippet, result.matchStart, result.matchEnd)}</div>
      `;
      div.addEventListener('click', () => {
        // Find the verse and show sidebar
        const verse = verses.find(v =>
          v.book === result.book &&
          v.chapter === result.chapter &&
          v.verse === result.verse
        );
        if (verse) {
          pinnedVerse = verse;
          updateSidebar(verse, true);
        }
      });
      searchResults.appendChild(div);
    }

    searchResults.classList.add('visible');
  }

  function escapeAndHighlight(text: string, start: number, end: number): string {
    const before = escapeHtml(text.slice(0, start));
    const match = escapeHtml(text.slice(start, end));
    const after = escapeHtml(text.slice(end));
    return `${before}<mark>${match}</mark>${after}`;
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function doSearch(query: string): void {
    if (query.length < 2) {
      hasActiveSearch = false;
      currentSearchResults = [];
      renderSearchResults([]);
      updateSearchHighlights([]);
      return;
    }

    hasActiveSearch = true;
    currentSearchResults = search(query);
    renderSearchResults(currentSearchResults);
    updateSearchHighlights(currentSearchResults);
  }

  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (searchClear) {
      searchClear.style.display = query ? 'block' : 'none';
    }
    doSearch(query);
  });

  searchClear?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchClear.style.display = 'none';
    }
    doSearch('');
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (searchResults && !searchResults.contains(e.target as Node) &&
        e.target !== searchInput && e.target !== searchClear) {
      searchResults.classList.remove('visible');
    }
  });

  // Re-show results when focusing input
  searchInput?.addEventListener('focus', () => {
    if (currentSearchResults.length > 0) {
      searchResults?.classList.add('visible');
    }
  });
}

main().catch(console.error);
