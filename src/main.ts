// Torah Map - Main entry point

import { initWebGL, createProgram } from './webgl.ts';
import { computeLayout, getLayoutBounds } from './layout.ts';
import { buildVerseGeometry, createBuffer } from './geometry.ts';
import { createBookLabels, updateLabelPositions } from './labels.ts';
import type { Verse, TorahData, Bounds, DivineNamesData } from './types.ts';

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
  // Load Torah structure and divine names data in parallel
  const [torahResponse, divineNamesResponse] = await Promise.all([
    fetch('/data/torah-structure.json'),
    fetch('/data/divine-names.json')
  ]);
  const torahData: TorahData = await torahResponse.json();
  const divineNames: DivineNamesData = await divineNamesResponse.json();

  // Compute layout with divine names coloring
  const verses = computeLayout(torahData, divineNames);
  const bounds = getLayoutBounds(verses);
  console.log(`Loaded ${verses.length} verses, bounds: ${bounds.width}x${bounds.height}`);

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

  // Build geometry
  const geometry = buildVerseGeometry(verses);
  const buffer = createBuffer(gl, geometry);

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

  // Hover detection
  const hoverInfo = document.getElementById('hover-info');

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging && hoverInfo) {
      const verse = findVerseAtPoint(verses, pan, zoom, e.clientX, e.clientY);
      if (verse) {
        hoverInfo.textContent = `${verse.book} ${verse.chapter}:${verse.verse}`;
      } else {
        hoverInfo.textContent = '';
      }
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
