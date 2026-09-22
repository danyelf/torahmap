// Rendering module - handles WebGL rendering state and operations

import { initWebGL, createProgram, createOutlineProgram, type OutlineProgram } from './webgl';
import { buildItemGeometry, createBuffer } from './geometry';
import { buildOutlineGeometry } from './outline';
import { updateLabelPositions } from './labels';
import { updateMapTitlePosition } from './mapTitle';
import type { SpatialItem, TanakhIdentity, ShaderProgram } from './types';
import type { Camera } from './camera';
import { HIGHLIGHT_CONSTANTS } from './constants';

/** Immutable WebGL infrastructure created once at startup. */
export interface RenderContext {
  gl: WebGL2RenderingContext;
  programs: {
    main: ShaderProgram;
    outline: OutlineProgram;
  };
  canvas: HTMLCanvasElement;
}

/**
 * Mutable rendering state that changes during the application's lifecycle.
 *
 * Generic over T (the identity shape) with default TanakhIdentity so existing
 * Tanakh callers keep their type inference. T is opaque — only x/y/size are
 * read by the rendering code.
 */
export interface RenderState<T = TanakhIdentity> {
  buffer: WebGLBuffer;
  outlineBuffer: WebGLBuffer | null;
  hoverOutlineBuffer: WebGLBuffer | null;
  verses: SpatialItem<T>[];
  dpr: number;
}

export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  const gl = initWebGL(canvas);
  const programs = {
    main: createProgram(gl),
    outline: createOutlineProgram(gl),
  };

  return { gl, programs, canvas };
}

export function createRenderState<T>(
  gl: WebGL2RenderingContext,
  verses: SpatialItem<T>[],
  dpr: number,
): RenderState<T> {
  const geometry = buildItemGeometry(verses);
  const buffer = createBuffer(gl, geometry);

  return {
    buffer,
    outlineBuffer: null,
    hoverOutlineBuffer: null,
    verses,
    dpr,
  };
}

/** Rebuilds the vertex geometry buffer with updated colors. Call after overlay changes. */
export function rebuildGeometry<T>(
  gl: WebGL2RenderingContext,
  state: RenderState<T>,
  colors?: ([number, number, number] | [number, number, number][])[],
): void {
  const geometry = buildItemGeometry(state.verses, colors);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
}

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

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(programs.main.program);

  // Scale zoom by dpr for high-DPI displays
  gl.uniform2f(programs.main.uniforms.resolution, canvas.width, canvas.height);
  gl.uniform2f(programs.main.uniforms.pan, camera.x, camera.y);
  gl.uniform1f(programs.main.uniforms.zoom, camera.zoom * dpr);

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

  gl.drawArrays(gl.TRIANGLES, 0, verses.length * 6);

  if (hoveredVerse && !itemsEqual(hoveredVerse, pinnedVerse)) {
    const hoverColor = pinnedVerse
      ? HIGHLIGHT_CONSTANTS.HOVER_WHILE_PINNED_OUTLINE_COLOR
      : HIGHLIGHT_CONSTANTS.HOVER_OUTLINE_COLOR;

    state.hoverOutlineBuffer = renderOutline(
      context,
      state,
      hoveredVerse,
      hoverColor,
      state.hoverOutlineBuffer,
      camera,
    );
  }

  // Pinned outline draws on top of the hover outline.
  if (pinnedVerse) {
    state.outlineBuffer = renderOutline(
      context,
      state,
      pinnedVerse,
      HIGHLIGHT_CONSTANTS.PINNED_OUTLINE_COLOR,
      state.outlineBuffer,
      camera,
      HIGHLIGHT_CONSTANTS.PINNED_OUTLINE_THICKNESS,
    );
  }

  if (window.bookLabels) {
    updateLabelPositions(window.bookLabels, { x: camera.x, y: camera.y }, camera.zoom);
  }
  if (window.mapTitle) {
    updateMapTitlePosition(window.mapTitle, camera);
  }
}

export function renderOutline<T>(
  context: RenderContext,
  state: RenderState<T>,
  verse: SpatialItem<T>,
  color: [number, number, number],
  buffer: WebGLBuffer | null,
  camera: Camera,
  thickness?: number,
): WebGLBuffer {
  const { gl, programs, canvas } = context;
  const { dpr } = state;

  const geometry = buildOutlineGeometry(
    {
      x: verse.x,
      y: verse.y,
      size: verse.size,
    },
    {
      thickness,
      color: color,
    },
  );

  let currentBuffer = buffer;
  if (!currentBuffer) {
    currentBuffer = createBuffer(gl, geometry);
  } else {
    gl.bindBuffer(gl.ARRAY_BUFFER, currentBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
  }

  gl.useProgram(programs.outline.program);

  // Same pan/zoom as the main render
  gl.uniform2f(programs.outline.uniforms.resolution, canvas.width, canvas.height);
  gl.uniform2f(programs.outline.uniforms.pan, camera.x, camera.y);
  gl.uniform1f(programs.outline.uniforms.zoom, camera.zoom * dpr);
  gl.uniform3f(programs.outline.uniforms.color, ...color);

  gl.bindBuffer(gl.ARRAY_BUFFER, currentBuffer);

  // Same 19-float vertex layout as the main render
  const stride = 19 * 4;
  gl.enableVertexAttribArray(programs.outline.attribs.position);
  gl.vertexAttribPointer(programs.outline.attribs.position, 2, gl.FLOAT, false, stride, 0);

  // 4 borders * 6 vertices each = 24 vertices
  gl.drawArrays(gl.TRIANGLES, 0, 24);

  return currentBuffer;
}
