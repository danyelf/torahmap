// Rendering module - handles WebGL rendering state and operations

import {
  initWebGL,
  createProgram,
  createOutlineProgram,
  type OutlineProgram,
  type ShaderProgram,
} from './webgl';
import {
  buildItemGeometry,
  createBuffer,
  VERSE_ATTRIBUTES,
  VERSE_OFFSETS,
  FLOATS_PER_VERSE,
} from './geometry';
import { buildOutlineGeometry } from './outline';
import { updateLabelPositions } from './labels';
import { updateMapTitlePosition } from './mapTitle';
import type { SpatialItem, TanakhIdentity } from './types';
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
  /** Points each per-verse attribute of the main program at its slice of `buffer`. */
  vertexArray: WebGLVertexArrayObject;
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
  context: RenderContext,
  verses: SpatialItem<T>[],
  dpr: number,
): RenderState<T> {
  const { gl, programs } = context;
  const geometry = buildItemGeometry(verses);
  const buffer = createBuffer(gl, geometry);

  const vertexArray = gl.createVertexArray();
  if (!vertexArray) throw new Error('Failed to create vertex array');
  gl.bindVertexArray(vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const stride = FLOATS_PER_VERSE * 4;
  for (const { name, size } of VERSE_ATTRIBUTES) {
    const location = programs.main.attribs[name];
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, VERSE_OFFSETS[name] * 4);
    // Advance once per verse rather than once per corner
    gl.vertexAttribDivisor(location, 1);
  }
  // Unbound, so the outline program's setup is not recorded into it
  gl.bindVertexArray(null);

  return {
    buffer,
    vertexArray,
    outlineBuffer: null,
    hoverOutlineBuffer: null,
    verses,
    dpr,
  };
}

/**
 * Refills the per-verse buffer with updated colors. Call after overlay changes.
 * The buffer object stays the same, so the vertex array still points at it.
 */
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
  const { vertexArray, verses, dpr } = state;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(programs.main.program);

  // Scale zoom by dpr for high-DPI displays
  gl.uniform2f(programs.main.uniforms.resolution, canvas.width, canvas.height);
  gl.uniform2f(programs.main.uniforms.pan, camera.x, camera.y);
  gl.uniform1f(programs.main.uniforms.zoom, camera.zoom * dpr);

  gl.bindVertexArray(vertexArray);
  // Six corners (two triangles) for each verse
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, verses.length);
  gl.bindVertexArray(null);

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

  const geometry = buildOutlineGeometry(verse, thickness);

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

  gl.enableVertexAttribArray(programs.outline.attribs.position);
  gl.vertexAttribPointer(programs.outline.attribs.position, 2, gl.FLOAT, false, 0, 0);

  // 4 borders * 6 vertices each = 24 vertices
  gl.drawArrays(gl.TRIANGLES, 0, 24);

  return currentBuffer;
}
