// Rendering module - handles WebGL rendering state and operations

import { initWebGL, createProgram, createOutlineProgram, type OutlineProgram } from './webgl';
import { buildVerseGeometry, createBuffer } from './geometry';
import { buildOutlineGeometry } from './outline';
import { updateLabelPositions } from './labels';
import type { SpatialItem, VerseIdentity, ShaderProgram } from './types';
import type { Camera } from './camera';
import { HIGHLIGHT_CONSTANTS } from './constants';

/**
 * Immutable WebGL infrastructure created once at startup.
 * Contains the WebGL context and compiled shader programs.
 */
export interface RenderContext {
  gl: WebGL2RenderingContext;
  programs: {
    main: ShaderProgram;
    outline: OutlineProgram;
  };
  canvas: HTMLCanvasElement;
}

/**
 * Mutable rendering state that changes during application lifecycle.
 * Contains vertex buffers, verse data, and display settings.
 *
 * Generic over T (the identity shape) with default VerseIdentity so existing
 * Tanakh callers keep their type inference. T is opaque — only x/y/size are
 * read by the rendering code.
 */
export interface RenderState<T = VerseIdentity> {
  buffer: WebGLBuffer;
  outlineBuffer: WebGLBuffer | null;
  hoverOutlineBuffer: WebGLBuffer | null;
  verses: SpatialItem<T>[];
  dpr: number;
}

/**
 * Create the immutable WebGL rendering context.
 * Initializes WebGL and compiles shader programs.
 *
 * @param canvas - The canvas element to render to
 * @returns RenderContext with gl and programs
 */
export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  const gl = initWebGL(canvas);
  const programs = {
    main: createProgram(gl),
    outline: createOutlineProgram(gl),
  };

  return { gl, programs, canvas };
}

/**
 * Create initial render state with vertex buffers.
 * Builds geometry for all verses and uploads to GPU.
 *
 * @param gl - WebGL context
 * @param verses - Array of verses to render
 * @param dpr - Device pixel ratio for high-DPI displays
 * @returns RenderState with initialized buffers
 */
export function createRenderState<T>(
  gl: WebGL2RenderingContext,
  verses: SpatialItem<T>[],
  dpr: number
): RenderState<T> {
  const geometry = buildVerseGeometry(verses);
  const buffer = createBuffer(gl, geometry);

  return {
    buffer,
    outlineBuffer: null,
    hoverOutlineBuffer: null,
    verses,
    dpr,
  };
}

/**
 * Rebuild vertex geometry buffer with updated verse colors.
 * Call this after overlay changes or verse color updates.
 *
 * @param gl - WebGL context
 * @param state - Render state containing buffer and verses
 */
export function rebuildGeometry<T>(
  gl: WebGL2RenderingContext,
  state: RenderState<T>,
  colors?: ([number, number, number] | [number, number, number][])[]
): void {
  const geometry = buildVerseGeometry(state.verses, colors);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
}

/**
 * Render all verses to the canvas.
 * Main rendering function called every frame.
 *
 * @param context - Immutable render context (gl, programs, canvas)
 * @param state - Mutable render state (buffers, verses)
 * @param camera - Camera position and zoom
 * @param hoveredVerse - Currently hovered verse (or null)
 * @param pinnedVerse - Currently pinned verse (or null)
 */
export function render<T>(
  context: RenderContext,
  state: RenderState<T>,
  camera: Camera,
  hoveredVerse: SpatialItem<T> | null,
  pinnedVerse: SpatialItem<T> | null,
  itemsEqual: (a: T | null, b: T | null) => boolean,
): void {
  const { gl, programs, canvas } = context;
  const { buffer, verses, dpr } = state;

  // Clear canvas
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Use main shader program
  gl.useProgram(programs.main.program);

  // Set uniforms - scale zoom by dpr for high-DPI displays
  gl.uniform2f(programs.main.uniforms.resolution, canvas.width, canvas.height);
  gl.uniform2f(programs.main.uniforms.pan, camera.x, camera.y);
  gl.uniform1f(programs.main.uniforms.zoom, camera.zoom * dpr);

  // Bind vertex buffer and configure attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  // Vertex layout: x, y, r1,g1,b1, r2,g2,b2, r3,g3,b3, r4,g4,b4, colorCount, u, v, seedX, seedY
  const stride = 19 * 4; // 19 floats * 4 bytes

  gl.enableVertexAttribArray(programs.main.attribs.position);
  gl.vertexAttribPointer(programs.main.attribs.position, 2, gl.FLOAT, false, stride, 0);

  gl.enableVertexAttribArray(programs.main.attribs.color);
  gl.vertexAttribPointer(programs.main.attribs.color, 3, gl.FLOAT, false, stride, 2 * 4);

  gl.enableVertexAttribArray(programs.main.attribs.color2);
  gl.vertexAttribPointer(programs.main.attribs.color2, 3, gl.FLOAT, false, stride, 5 * 4);

  gl.enableVertexAttribArray(programs.main.attribs.color3);
  gl.vertexAttribPointer(programs.main.attribs.color3, 3, gl.FLOAT, false, stride, 8 * 4);

  gl.enableVertexAttribArray(programs.main.attribs.color4);
  gl.vertexAttribPointer(programs.main.attribs.color4, 3, gl.FLOAT, false, stride, 11 * 4);

  gl.enableVertexAttribArray(programs.main.attribs.colorCount);
  gl.vertexAttribPointer(programs.main.attribs.colorCount, 1, gl.FLOAT, false, stride, 14 * 4);

  gl.enableVertexAttribArray(programs.main.attribs.uv);
  gl.vertexAttribPointer(programs.main.attribs.uv, 2, gl.FLOAT, false, stride, 15 * 4);

  gl.enableVertexAttribArray(programs.main.attribs.seed);
  gl.vertexAttribPointer(programs.main.attribs.seed, 2, gl.FLOAT, false, stride, 17 * 4);

  // Draw all verses
  gl.drawArrays(gl.TRIANGLES, 0, verses.length * 6);

  // Draw hover outline (if hovering and not same as pinned)
  if (hoveredVerse && !itemsEqual(hoveredVerse, pinnedVerse)) {
    // Use different color when hovering while another verse is pinned
    const hoverColor = pinnedVerse
      ? HIGHLIGHT_CONSTANTS.HOVER_WHILE_PINNED_OUTLINE_COLOR
      : HIGHLIGHT_CONSTANTS.HOVER_OUTLINE_COLOR;

    state.hoverOutlineBuffer = renderOutline(
      context,
      state,
      hoveredVerse,
      hoverColor,
      state.hoverOutlineBuffer,
      camera
    );
  }

  // Draw pinned outline on top
  if (pinnedVerse) {
    state.outlineBuffer = renderOutline(
      context,
      state,
      pinnedVerse,
      HIGHLIGHT_CONSTANTS.PINNED_OUTLINE_COLOR,
      state.outlineBuffer,
      camera
    );
  }

  // Update book label positions
  if (window.bookLabels) {
    updateLabelPositions(window.bookLabels, { x: camera.x, y: camera.y }, camera.zoom);
  }
}

/**
 * Render outline border for a verse.
 * Draws a colored border on top of the main verse geometry.
 *
 * @param context - Render context with gl and programs
 * @param state - Render state (not modified, but returned buffer may change)
 * @param verse - Verse to draw outline for
 * @param color - RGB color for the outline
 * @param buffer - Existing buffer to reuse (or null to create new)
 * @param camera - Camera position and zoom
 * @returns Updated or newly created buffer
 */
export function renderOutline<T>(
  context: RenderContext,
  state: RenderState<T>,
  verse: SpatialItem<T>,
  color: [number, number, number],
  buffer: WebGLBuffer | null,
  camera: Camera
): WebGLBuffer {
  const { gl, programs, canvas } = context;
  const { dpr } = state;

  // Build outline geometry for this verse
  const geometry = buildOutlineGeometry(
    {
      x: verse.x,
      y: verse.y,
      size: verse.size,
    },
    {
      thickness: 2,
      color: color,
    }
  );

  // Create or update outline buffer
  let currentBuffer = buffer;
  if (!currentBuffer) {
    currentBuffer = createBuffer(gl, geometry);
  } else {
    gl.bindBuffer(gl.ARRAY_BUFFER, currentBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
  }

  // Use outline shader
  gl.useProgram(programs.outline.program);

  // Set uniforms (same pan/zoom as main render)
  gl.uniform2f(programs.outline.uniforms.resolution, canvas.width, canvas.height);
  gl.uniform2f(programs.outline.uniforms.pan, camera.x, camera.y);
  gl.uniform1f(programs.outline.uniforms.zoom, camera.zoom * dpr);
  gl.uniform3f(programs.outline.uniforms.color, ...color);

  // Bind buffer and set position attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, currentBuffer);

  // Vertex layout for outline: x, y, ... (same 19-float structure as main)
  const stride = 19 * 4;
  gl.enableVertexAttribArray(programs.outline.attribs.position);
  gl.vertexAttribPointer(programs.outline.attribs.position, 2, gl.FLOAT, false, stride, 0);

  // Draw outline (4 borders * 6 vertices each = 24 vertices)
  gl.drawArrays(gl.TRIANGLES, 0, 24);

  return currentBuffer;
}
