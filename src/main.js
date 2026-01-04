// Torah Map - Main entry point

import { initWebGL, createProgram } from './webgl.js';
import { computeLayout, getLayoutBounds } from './layout.js';
import { buildVerseGeometry, createBuffer } from './geometry.js';

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

  // Camera state
  let pan = { x: 50, y: 50 };
  let zoom = 1.0;

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

    const stride = 5 * 4; // 5 floats * 4 bytes
    gl.enableVertexAttribArray(prog.attribs.position);
    gl.vertexAttribPointer(prog.attribs.position, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(prog.attribs.color);
    gl.vertexAttribPointer(prog.attribs.color, 3, gl.FLOAT, false, stride, 2 * 4);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, verses.length * 6);
  }

  render();

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
