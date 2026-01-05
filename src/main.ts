// Tanakh Map - Main entry point

declare const __GIT_BRANCH__: string;

import { initWebGL, createProgram } from './webgl.ts';
import { computeLayout, getLayoutBounds } from './layout.ts';
import { buildVerseGeometry, createBuffer } from './geometry.ts';
import { createBookLabels, updateLabelPositions } from './labels.ts';
import { loadAllVerseTexts, getVerseText } from './verseTexts.ts';
import { buildTropIndex, getTropByFrequency, getRarityTier } from './trop.ts';
import type { Verse, TorahData, Bounds, DivineNamesData, CommentaryData, TropIndexEntry } from './types.ts';

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

// Heatmap color scale: dark blue -> light blue -> orange -> red (log scale)
function heatmapColor(value: number, maxValue: number): [number, number, number] {
  if (value === 0) return [0.15, 0.15, 0.2]; // Very dark for no commentary

  // Log scale: map 1..maxValue to 0..1 using natural log
  // log(1) = 0, log(maxValue) = max
  const logMax = Math.log(maxValue + 1);
  const t = Math.log(value + 1) / logMax;

  // Multi-stop gradient
  if (t < 0.25) {
    // Dark blue to blue
    const s = t / 0.25;
    return [0.1, 0.13 + s * 0.1, 0.18 + s * 0.2];
  } else if (t < 0.5) {
    // Blue to teal
    const s = (t - 0.25) / 0.25;
    return [0.1 + s * 0.1, 0.23 + s * 0.2, 0.38 - s * 0.05];
  } else if (t < 0.75) {
    // Teal to orange
    const s = (t - 0.5) / 0.25;
    return [0.2 + s * 0.7, 0.43 - s * 0.1, 0.33 - s * 0.2];
  } else {
    // Orange to red
    const s = (t - 0.75) / 0.25;
    return [0.9 + s * 0.1, 0.33 - s * 0.1, 0.13 + s * 0.05];
  }
}

function getCommentaryCount(
  commentary: CommentaryData,
  book: string,
  chapter: number,
  verse: number,
  category: string
): number {
  const verseData = commentary[book]?.[String(chapter)]?.[String(verse)];
  if (!verseData) return 0;
  if (category === 'total') return verseData.total;
  return verseData.categories[category] || 0;
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

function createTropChart(
  tropByFrequency: TropIndexEntry[],
  onSelect: (entry: TropIndexEntry | null) => void
): void {
  const chart = document.getElementById('trop-chart');
  const info = document.getElementById('trop-info');
  if (!chart) return;

  chart.innerHTML = '';
  let selectedButton: HTMLButtonElement | null = null;

  for (const entry of tropByFrequency) {
    const button = document.createElement('button');
    button.textContent = 'ב' + entry.unicode; // Show on a bet for visibility
    button.title = `${entry.name} (${entry.hebrewName})`;

    const tier = getRarityTier(entry.totalCount);
    if (tier === 'rare') {
      button.classList.add('rare');
    }

    button.addEventListener('mouseenter', () => {
      if (info) {
        const tierLabel = tier === 'rare' ? 'Rare' : tier === 'uncommon' ? 'Uncommon' : 'Common';
        info.textContent = `${entry.name} (${entry.hebrewName}) · ${entry.totalCount.toLocaleString()} occurrences · ${tierLabel}`;
      }
    });

    button.addEventListener('mouseleave', () => {
      if (info && !selectedButton) {
        info.textContent = '';
      } else if (info && selectedButton) {
        // Restore selected info
        const selEntry = tropByFrequency.find(e => e.unicode === selectedButton?.dataset.unicode);
        if (selEntry) {
          const selTier = getRarityTier(selEntry.totalCount);
          const tierLabel = selTier === 'rare' ? 'Rare' : selTier === 'uncommon' ? 'Uncommon' : 'Common';
          info.textContent = `${selEntry.name} (${selEntry.hebrewName}) · ${selEntry.totalCount.toLocaleString()} · ${tierLabel}`;
        }
      }
    });

    button.addEventListener('click', () => {
      // Toggle selection
      if (selectedButton === button) {
        button.classList.remove('selected');
        selectedButton = null;
        onSelect(null);
        if (info) info.textContent = '';
      } else {
        if (selectedButton) selectedButton.classList.remove('selected');
        button.classList.add('selected');
        selectedButton = button;
        onSelect(entry);
      }
    });

    button.dataset.unicode = entry.unicode;
    chart.appendChild(button);
  }
}

async function main(): Promise<void> {
  // Set page title with branch name
  document.title = `Tanakh Map [${__GIT_BRANCH__}]`;

  // Load Tanakh structure, divine names, commentary data, and verse texts in parallel
  const [torahResponse, divineNamesResponse, commentaryResponse, verseTexts] = await Promise.all([
    fetch('/data/tanakh-structure.json'),
    fetch('/data/divine-names.json'),
    fetch('/data/commentary-counts.json'),
    loadAllVerseTexts()
  ]);
  const torahData: TorahData = await torahResponse.json();
  const divineNames: DivineNamesData = await divineNamesResponse.json();
  const commentary: CommentaryData = await commentaryResponse.json();

  // Compute layout (without divine names coloring initially - starts as "none")
  const verses = computeLayout(torahData);
  const bounds = getLayoutBounds(verses);
  console.log(`Loaded ${verses.length} verses, bounds: ${bounds.width}x${bounds.height}`);
  console.log('Divine names and commentary data loaded');

  // Build trop index from verse texts
  const tropIndex = buildTropIndex(verseTexts);
  const tropByFrequency = getTropByFrequency(tropIndex);
  console.log(`Built trop index: ${tropByFrequency.length} marks found`);
  console.log('Rarest trop:', tropByFrequency.slice(0, 5).map(t => `${t.name} (${t.totalCount})`).join(', '));

  // Track selected trop
  let selectedTrop: TropIndexEntry | null = null;

  // Create trop chart
  createTropChart(tropByFrequency, (entry) => {
    selectedTrop = entry;
    if (currentOverlay === 'trop') {
      applyOverlay();
      render();
    }
  });

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
  let currentOverlay = 'none';
  let currentCategory = 'total';
  let buffer: WebGLBuffer;

  // Divine name colors
  const DIVINE_NAME_COLORS: { [code: number]: [number, number, number] } = {
    1: [0.3, 0.5, 0.9],  // YHWH only - Blue
    2: [0.9, 0.3, 0.3],  // Elohim only - Red
    3: [0.7, 0.3, 0.8],  // Both - Purple
  };

  // Seeded random for consistent gray variation
  function seededRandom(seed: number): number {
    const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  // Function to apply overlay colors
  function applyOverlay(): void {
    if (currentOverlay === 'none') {
      // Gray with brightness variation
      verses.forEach((v, i) => {
        const brightness = 0.4 + seededRandom(i * 3) * 0.4;
        v.color = [brightness, brightness, brightness];
      });
    } else if (currentOverlay === 'divine-names') {
      // Apply divine names colors
      verses.forEach((v, i) => {
        const bookData = divineNames[v.book];
        const code = bookData?.[v.chapter - 1]?.[v.verse - 1] ?? 0;
        if (code > 0 && DIVINE_NAME_COLORS[code]) {
          v.color = DIVINE_NAME_COLORS[code];
        } else {
          const brightness = 0.4 + seededRandom(i * 3) * 0.4;
          v.color = [brightness, brightness, brightness];
        }
      });
    } else if (currentOverlay === 'commentary') {
      // Calculate max value for this category
      let maxValue = 0;
      for (const v of verses) {
        const count = getCommentaryCount(commentary, v.book, v.chapter, v.verse, currentCategory);
        if (count > maxValue) maxValue = count;
      }
      const colorMax = maxValue;

      // Update legend ticks
      const ticksContainer = document.getElementById('legend-ticks');
      if (ticksContainer) {
        ticksContainer.innerHTML = '';
        const logMax = Math.log(colorMax + 1);
        const ticks = [0];
        let tickVal = 1;
        while (tickVal <= colorMax) {
          ticks.push(tickVal);
          tickVal *= 10;
        }
        if (ticks[ticks.length - 1] < colorMax) {
          ticks.push(colorMax);
        }
        for (const val of ticks) {
          const tick = document.createElement('span');
          tick.className = 'tick';
          const pos = val === 0 ? 0 : (Math.log(val + 1) / logMax) * 100;
          tick.style.left = `${pos}%`;
          tick.textContent = val >= 1000 ? `${val / 1000}k` : String(val);
          ticksContainer.appendChild(tick);
        }
      }

      // Apply heatmap colors
      for (const v of verses) {
        const count = getCommentaryCount(commentary, v.book, v.chapter, v.verse, currentCategory);
        v.color = heatmapColor(count, colorMax);
      }
    } else if (currentOverlay === 'trop') {
      if (!selectedTrop) {
        // No trop selected - show gray
        verses.forEach((v, i) => {
          const brightness = 0.4 + seededRandom(i * 3) * 0.4;
          v.color = [brightness, brightness, brightness];
        });
      } else {
        const tier = getRarityTier(selectedTrop.totalCount);

        // Build verse lookup for quick access
        const verseLookup = new Map<string, number>();
        for (const loc of selectedTrop.verses) {
          const key = `${loc.book}:${loc.chapter}:${loc.verse}`;
          verseLookup.set(key, loc.count);
        }

        if (tier === 'rare') {
          // Binary highlight: bright gold for matches, dim gray for non-matches
          verses.forEach((v) => {
            const key = `${v.book}:${v.chapter}:${v.verse}`;
            if (verseLookup.has(key)) {
              v.color = [1.0, 0.84, 0.0]; // Gold
            } else {
              v.color = [0.15, 0.15, 0.15]; // Very dim
            }
          });
        } else if (tier === 'uncommon') {
          // Gradient based on count (0 = dim, max = bright purple)
          const maxCount = Math.max(...selectedTrop.verses.map(v => v.count), 1);
          verses.forEach((v) => {
            const key = `${v.book}:${v.chapter}:${v.verse}`;
            const count = verseLookup.get(key) || 0;
            if (count === 0) {
              v.color = [0.12, 0.12, 0.15];
            } else {
              const t = count / maxCount;
              // Dim purple to bright purple
              v.color = [0.4 + t * 0.5, 0.2 + t * 0.2, 0.6 + t * 0.35];
            }
          });
        } else {
          // Common: full heatmap like commentary
          const maxCount = Math.max(...selectedTrop.verses.map(v => v.count), 1);
          verses.forEach((v) => {
            const key = `${v.book}:${v.chapter}:${v.verse}`;
            const count = verseLookup.get(key) || 0;
            // Reuse heatmap color function with purple tint
            if (count === 0) {
              v.color = [0.12, 0.1, 0.15];
            } else {
              const logMax = Math.log(maxCount + 1);
              const t = Math.log(count + 1) / logMax;
              // Purple spectrum: dark purple -> purple -> magenta -> pink
              if (t < 0.33) {
                const s = t / 0.33;
                v.color = [0.2 + s * 0.2, 0.1 + s * 0.1, 0.3 + s * 0.2];
              } else if (t < 0.66) {
                const s = (t - 0.33) / 0.33;
                v.color = [0.4 + s * 0.3, 0.2 + s * 0.1, 0.5 + s * 0.2];
              } else {
                const s = (t - 0.66) / 0.34;
                v.color = [0.7 + s * 0.25, 0.3 + s * 0.3, 0.7 + s * 0.2];
              }
            }
          });
        }
      }
    }

    // Rebuild geometry buffer
    const geometry = buildVerseGeometry(verses);
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

  // Hover detection with overlay-aware info and sidebar
  const hoverInfo = document.getElementById('hover-info');
  const sidebar = document.getElementById('verse-sidebar');
  const sidebarRef = sidebar?.querySelector('.ref-text');
  const sidebarHebrew = sidebar?.querySelector('.verse-hebrew');
  const sidebarEnglish = sidebar?.querySelector('.verse-english');
  const sidebarLink = sidebar?.querySelector('.sefaria-link') as HTMLAnchorElement | null;
  const sidebarLinkSubtitle = sidebar?.querySelector('.link-subtitle');
  const sidebarCloseBtn = sidebar?.querySelector('.close-btn');

  const DIVINE_NAME_LABELS: { [code: number]: string } = {
    0: '',
    1: 'YHWH',
    2: 'Elohim',
    3: 'YHWH + Elohim'
  };

  // Build Sefaria URL for a verse
  function getSefariaUrl(book: string, chapter: number, verse: number, category: string): string {
    const sefariaBook = book.replace(/ /g, '_');
    const baseUrl = `https://www.sefaria.org/${sefariaBook}.${chapter}.${verse}`;
    if (category && category !== 'total' && category !== '') {
      return `${baseUrl}?with=${encodeURIComponent(category)}`;
    }
    return baseUrl;
  }

  // Track pinned verse (click to persist)
  let pinnedVerse: Verse | null = null;

  // Highlight trop mark in Hebrew text
  function highlightTropInText(hebrewText: string, tropUnicode: string): string {
    // Wrap the trop mark in a span for highlighting
    // The trop is a combining character, so we highlight it with its base letter
    const result: string[] = [];
    let i = 0;

    while (i < hebrewText.length) {
      const char = hebrewText[i];

      // Check if this is the target trop mark
      if (char === tropUnicode) {
        // Find the base letter (previous non-combining character)
        // Wrap from the last base letter through this trop
        if (result.length > 0) {
          // Pop characters back to the base letter
          const highlighted: string[] = [];
          while (result.length > 0) {
            const last = result[result.length - 1];
            const lastCode = last.codePointAt(0) || 0;
            // Keep popping combining characters
            if (lastCode >= 0x0591 && lastCode <= 0x05C7) {
              highlighted.unshift(result.pop()!);
            } else {
              // This is the base letter
              highlighted.unshift(result.pop()!);
              break;
            }
          }
          highlighted.push(char);
          result.push(`<mark class="trop-highlight">${highlighted.join('')}</mark>`);
        } else {
          result.push(`<mark class="trop-highlight">${char}</mark>`);
        }
      } else {
        result.push(char);
      }
      i++;
    }

    return result.join('');
  }

  // Update sidebar with verse info
  function updateSidebar(verse: Verse | null, isPinned: boolean = false): void {
    if (!sidebar) return;

    if (!verse) {
      sidebar.classList.remove('visible');
      sidebar.classList.remove('pinned');
      return;
    }

    const text = getVerseText(verseTexts, verse.book, verse.chapter, verse.verse);
    const verseData = commentary[verse.book]?.[String(verse.chapter)]?.[String(verse.verse)];

    if (sidebarRef) {
      sidebarRef.textContent = `${verse.book} ${verse.chapter}:${verse.verse}`;
    }
    if (sidebarHebrew) {
      const hebrewText = text?.he || 'Loading...';
      if (currentOverlay === 'trop' && selectedTrop) {
        sidebarHebrew.innerHTML = highlightTropInText(hebrewText, selectedTrop.unicode);
      } else {
        sidebarHebrew.textContent = hebrewText;
      }
    }
    if (sidebarEnglish) {
      sidebarEnglish.textContent = text?.en || 'Loading...';
    }
    if (sidebarLink) {
      sidebarLink.href = getSefariaUrl(verse.book, verse.chapter, verse.verse, currentCategory);
    }
    if (sidebarLinkSubtitle) {
      if (verseData) {
        if (currentCategory === 'total') {
          sidebarLinkSubtitle.textContent = `${verseData.total} linked texts`;
        } else if (currentCategory && verseData.categories[currentCategory]) {
          sidebarLinkSubtitle.textContent = `${verseData.categories[currentCategory]} ${currentCategory} texts`;
        } else {
          sidebarLinkSubtitle.textContent = verseData.total > 0 ? `${verseData.total} linked texts` : '';
        }
      } else {
        sidebarLinkSubtitle.textContent = '';
      }
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

          if (currentOverlay === 'divine-names') {
            const bookData = divineNames[verse.book];
            const code = bookData?.[verse.chapter - 1]?.[verse.verse - 1] ?? 0;
            if (code > 0) {
              info += ` (${DIVINE_NAME_LABELS[code]})`;
            }
          } else if (currentOverlay === 'commentary') {
            const verseData = commentary[verse.book]?.[String(verse.chapter)]?.[String(verse.verse)];
            if (verseData) {
              if (currentCategory === 'total') {
                info += ` (${verseData.total} links)`;
              } else if (verseData.categories[currentCategory]) {
                info += ` (${verseData.categories[currentCategory]} ${currentCategory})`;
              }
            }
          } else if (currentOverlay === 'trop' && selectedTrop) {
            const loc = selectedTrop.verses.find(
              v => v.book === verse.book && v.chapter === verse.chapter && v.verse === verse.verse
            );
            if (loc) {
              info += ` (${selectedTrop.name} ×${loc.count})`;
            }
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
  const categorySelect = document.getElementById('category-select') as HTMLSelectElement;
  const commentaryControls = document.getElementById('commentary-controls');
  const legend = document.getElementById('legend');
  const divineNamesLegend = document.getElementById('divine-names-legend');
  const tropControls = document.getElementById('trop-controls');

  // Overlay selector
  overlaySelect?.addEventListener('change', () => {
    currentOverlay = overlaySelect.value;

    // Show/hide controls based on overlay
    if (commentaryControls) {
      commentaryControls.style.display = currentOverlay === 'commentary' ? 'block' : 'none';
    }
    if (legend) {
      legend.style.display = currentOverlay === 'commentary' ? 'block' : 'none';
    }
    if (divineNamesLegend) {
      divineNamesLegend.style.display = currentOverlay === 'divine-names' ? 'block' : 'none';
    }
    if (tropControls) {
      tropControls.style.display = currentOverlay === 'trop' ? 'block' : 'none';
    }

    applyOverlay();
    render();
  });

  // Category selector (for commentary overlay)
  categorySelect?.addEventListener('change', () => {
    currentCategory = categorySelect.value;
    if (currentOverlay === 'commentary') {
      applyOverlay();
      render();
    }
  });

  // Handle resize
  window.addEventListener('resize', () => {
    resizeCanvas();
    render();
  });

  // Store for hover detection
  window.torahMap = { verses, pan, zoom, render, canvas, bounds };
}

main().catch(console.error);
