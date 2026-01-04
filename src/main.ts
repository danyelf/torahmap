// Torah Map - Main entry point

import { initWebGL, createProgram } from './webgl.ts';
import { computeLayout, getLayoutBounds } from './layout.ts';
import { buildVerseGeometry, createBuffer } from './geometry.ts';
import { createBookLabels, updateLabelPositions } from './labels.ts';
import type { Verse, TorahData, Bounds, DivineNamesData, CommentaryData } from './types.ts';

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

async function main(): Promise<void> {
  // Load Torah structure, divine names, and commentary data in parallel
  const [torahResponse, divineNamesResponse, commentaryResponse] = await Promise.all([
    fetch('/data/torah-structure.json'),
    fetch('/data/divine-names.json'),
    fetch('/data/commentary-counts.json')
  ]);
  const torahData: TorahData = await torahResponse.json();
  const divineNames: DivineNamesData = await divineNamesResponse.json();
  const commentary: CommentaryData = await commentaryResponse.json();

  // Compute layout with divine names coloring
  const verses = computeLayout(torahData, divineNames);
  const bounds = getLayoutBounds(verses);
  console.log(`Loaded ${verses.length} verses, bounds: ${bounds.width}x${bounds.height}`);
  console.log('Commentary data loaded');

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

  // Current category for coloring
  let currentCategory = '';
  let buffer: WebGLBuffer;

  // Function to rebuild geometry with colors based on category
  function updateColors(category: string): void {
    currentCategory = category;

    if (category === '') {
      // Reset to default gray
      for (const v of verses) {
        v.color = undefined;
      }
    } else {
      // Calculate max value for this category to normalize colors
      let maxValue = 0;
      for (const v of verses) {
        const count = getCommentaryCount(commentary, v.book, v.chapter, v.verse, category);
        if (count > maxValue) maxValue = count;
      }
      // With log scale, we can use the actual max value
      const colorMax = maxValue;

      // Update legend with log-scale ticks
      const ticksContainer = document.getElementById('legend-ticks');
      if (ticksContainer) {
        ticksContainer.innerHTML = '';
        const logMax = Math.log(colorMax + 1);

        // Generate ticks at 0, 1, 10, 100, 1000, etc. up to max
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
          // Position based on log scale (0 is special case)
          const pos = val === 0 ? 0 : (Math.log(val + 1) / logMax) * 100;
          tick.style.left = `${pos}%`;
          tick.textContent = val >= 1000 ? `${val / 1000}k` : String(val);
          ticksContainer.appendChild(tick);
        }
      }

      // Apply colors
      for (const v of verses) {
        const count = getCommentaryCount(commentary, v.book, v.chapter, v.verse, category);
        v.color = heatmapColor(count, colorMax);
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

  // Hover detection with commentary info
  const hoverInfo = document.getElementById('hover-info');

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging && hoverInfo) {
      const verse = findVerseAtPoint(verses, pan, zoom, e.clientX, e.clientY);
      if (verse) {
        const verseData = commentary[verse.book]?.[String(verse.chapter)]?.[String(verse.verse)];
        let info = `${verse.book} ${verse.chapter}:${verse.verse}`;
        if (verseData) {
          if (currentCategory === 'total') {
            info += ` (${verseData.total} links)`;
          } else if (currentCategory && verseData.categories[currentCategory]) {
            info += ` (${verseData.categories[currentCategory]} ${currentCategory})`;
          } else if (currentCategory === '') {
            info += verseData.total > 0 ? ` (${verseData.total} links)` : '';
          }
        }
        hoverInfo.textContent = info;
      } else {
        hoverInfo.textContent = '';
      }
    }
  });

  // Category selector
  const categorySelect = document.getElementById('category-select') as HTMLSelectElement;
  const legend = document.getElementById('legend');

  categorySelect?.addEventListener('change', () => {
    const category = categorySelect.value;
    updateColors(category);
    render();

    // Show/hide legend
    if (legend) {
      legend.style.display = category === '' ? 'none' : 'block';
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
