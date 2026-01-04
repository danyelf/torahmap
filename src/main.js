// Torah Map - Main entry point

import { initWebGL, createProgram } from './webgl.js';
import { computeLayout, getLayoutBounds } from './layout.js';
import { buildVerseGeometry, createBuffer } from './geometry.js';
import { createBookLabels, updateLabelPositions } from './labels.js';

function findVerseAtPoint(verses, pan, zoom, canvasX, canvasY) {
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

async function main() {
  // Load Torah structure
  const response = await fetch('data/torah-structure.json');
  const torahData = await response.json();

  // Compute layout
  const verses = computeLayout(torahData);
  const bounds = getLayoutBounds(verses);
  console.log(`Loaded ${verses.length} verses, bounds: ${bounds.width}x${bounds.height}`);

  // Setup canvas
  const canvas = document.getElementById('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Init WebGL
  const gl = initWebGL(canvas);
  const prog = createProgram(gl);

  // Build geometry
  const geometry = buildVerseGeometry(verses);
  const buffer = createBuffer(gl, geometry);

  // Camera state - center visualization
  let pan = {
    x: (canvas.width / 2 - bounds.width / 2),
    y: (canvas.height / 2 - bounds.height / 2)
  };
  let zoom = 1.0;

  // Enable alpha blending for anti-aliased edges
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Render function
  function render() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog.program);

    // Set uniforms
    gl.uniform2f(prog.uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(prog.uniforms.pan, pan.x, pan.y);
    gl.uniform1f(prog.uniforms.zoom, zoom);

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

  // Zoom with mouse wheel
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoom *= zoomFactor;
    zoom = Math.max(0.1, Math.min(10, zoom));
    render();
  }, { passive: false });

  // Pan with mouse drag
  let isDragging = false;
  let lastMouse = { x: 0, y: 0 };

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mousemove', (e) => {
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

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) {
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
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
  });

  // Store for hover detection
  window.torahMap = { verses, pan, zoom, render, canvas, bounds };
}

main().catch(console.error);
