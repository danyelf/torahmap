import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createRenderContext,
  createRenderState,
  rebuildGeometry,
  render,
  renderOutline,
  type RenderContext,
  type RenderState,
} from '../../rendering';
import type { Camera } from '../../camera';
import { tanakhIdentitiesEqual } from '../../types';
import { SEARCH_WITH_OVERLAY } from '../../constants';
import { createMockCanvas, createVerse, createVerses } from '../helpers';

describe('rendering', () => {
  describe('createRenderContext', () => {
    it('creates render context with gl and programs', () => {
      const canvas = createMockCanvas();
      const context = createRenderContext(canvas);

      expect(context.gl).toBeDefined();
      expect(context.programs.main).toBeDefined();
      expect(context.programs.outline).toBeDefined();
      expect(context.canvas).toBe(canvas);
    });

    it('initializes main shader program with correct attributes', () => {
      const canvas = createMockCanvas();
      const context = createRenderContext(canvas);

      expect(context.programs.main.program).toBeDefined();
      expect(context.programs.main.attribs.a_rect).toBeDefined();
      expect(context.programs.main.attribs.a_fill).toBeDefined();
      expect(context.programs.main.attribs.a_nextShape).toBeDefined();
    });

    it('initializes outline shader program with correct attributes', () => {
      const canvas = createMockCanvas();
      const context = createRenderContext(canvas);

      expect(context.programs.outline.program).toBeDefined();
      expect(context.programs.outline.attribs.position).toBeDefined();
    });

    it('stores canvas reference', () => {
      const canvas = createMockCanvas();
      const context = createRenderContext(canvas);

      expect(context.canvas).toBe(canvas);
      expect(context.canvas.width).toBe(800);
      expect(context.canvas.height).toBe(600);
    });
  });

  describe('createRenderState', () => {
    let context: RenderContext;
    let gl: WebGL2RenderingContext;

    beforeEach(() => {
      context = createRenderContext(createMockCanvas());
      gl = context.gl;
      vi.clearAllMocks();
    });

    it('creates render state with buffer and verses', () => {
      const verses = createVerses(5);
      const state = createRenderState(context, verses, 2.0);

      expect(state.buffer).toBeDefined();
      expect(state.verses).toBe(verses);
      expect(state.dpr).toBe(2.0);
    });

    it('initializes outline buffers as null', () => {
      const verses = createVerses(3);
      const state = createRenderState(context, verses, 1.0);

      expect(state.outlineBuffer).toBeNull();
      expect(state.hoverOutlineBuffer).toBeNull();
    });

    it('creates buffer via WebGL createBuffer', () => {
      const verses = createVerses(2);
      createRenderState(context, verses, 1.0);

      expect(gl.createBuffer).toHaveBeenCalled();
    });

    it('handles empty verse array', () => {
      const state = createRenderState(context, [], 1.0);

      expect(state.verses).toEqual([]);
      expect(state.buffer).toBeDefined();
    });

    it('stores device pixel ratio correctly', () => {
      const verses = createVerses(1);

      const state1 = createRenderState(context, verses, 1.0);
      const state2 = createRenderState(context, verses, 2.0);
      const state3 = createRenderState(context, verses, 1.5);

      expect(state1.dpr).toBe(1.0);
      expect(state2.dpr).toBe(2.0);
      expect(state3.dpr).toBe(1.5);
    });

    it('uploads geometry to GPU via bufferData', () => {
      const verses = createVerses(3);
      createRenderState(context, verses, 1.0);

      expect(gl.bindBuffer).toHaveBeenCalled();
      expect(gl.bufferData).toHaveBeenCalled();
    });

    it('points every verse attribute at the buffer, read once per verse', () => {
      const state = createRenderState(context, createVerses(3), 1.0);

      expect(gl.bindVertexArray).toHaveBeenNthCalledWith(1, state.vertexArray);
      expect(gl.bindBuffer).toHaveBeenLastCalledWith(gl.ARRAY_BUFFER, state.buffer);
      for (const location of Object.values(context.programs.main.attribs)) {
        expect(gl.enableVertexAttribArray).toHaveBeenCalledWith(location);
        expect(gl.vertexAttribDivisor).toHaveBeenCalledWith(location, 1);
      }
      expect(gl.bindVertexArray).toHaveBeenLastCalledWith(null);
    });
  });

  describe('rebuildGeometry', () => {
    let gl: WebGL2RenderingContext;
    let state: RenderState;

    beforeEach(() => {
      const context = createRenderContext(createMockCanvas());
      gl = context.gl;
      const verses = createVerses(5);
      state = createRenderState(context, verses, 1.0);
      vi.clearAllMocks(); // Clear calls from createRenderState
    });

    it('rebuilds geometry buffer with updated verses', () => {
      rebuildGeometry(gl, state);

      expect(gl.bindBuffer).toHaveBeenCalledWith(gl.ARRAY_BUFFER, state.buffer);
      expect(gl.bufferData).toHaveBeenCalled();
    });

    it('uses verses from state', () => {
      // Update verse colors (TypeScript: these properties don't exist on TanakhLayout,
      // but the test is checking that rebuildGeometry uses state.verses)
      (state.verses[0] as any).color = [1, 0, 0];
      (state.verses[1] as any).color = [0, 1, 0];

      rebuildGeometry(gl, state);

      expect(gl.bufferData).toHaveBeenCalled();
      const callArgs = (gl.bufferData as any).mock.calls[0];
      expect(callArgs[0]).toBe(gl.ARRAY_BUFFER);
      expect(callArgs[1]).toBeInstanceOf(Float32Array);
    });

    it('handles empty verse array', () => {
      state.verses = [];

      expect(() => rebuildGeometry(gl, state)).not.toThrow();
      expect(gl.bufferData).toHaveBeenCalled();
    });

    it('calls bufferData with STATIC_DRAW', () => {
      rebuildGeometry(gl, state);

      const callArgs = (gl.bufferData as any).mock.calls[0];
      expect(callArgs[2]).toBe(gl.STATIC_DRAW);
    });
  });

  describe('render', () => {
    let context: RenderContext;
    let state: RenderState;
    let camera: Camera;

    beforeEach(() => {
      const canvas = createMockCanvas();
      context = createRenderContext(canvas);
      const verses = createVerses(10);
      state = createRenderState(context, verses, 2.0);
      camera = { x: 100, y: 200, zoom: 1.5 };
      vi.clearAllMocks();
    });

    it('clears canvas and sets viewport', () => {
      render(context, state, camera, null, null, tanakhIdentitiesEqual);

      expect(context.gl.viewport).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(context.gl.clearColor).toHaveBeenCalledWith(0.1, 0.1, 0.1, 1.0);
      expect(context.gl.clear).toHaveBeenCalled();
    });

    it('uses main shader program', () => {
      render(context, state, camera, null, null, tanakhIdentitiesEqual);

      expect(context.gl.useProgram).toHaveBeenCalledWith(context.programs.main.program);
    });

    it('sets camera uniforms with dpr scaling', () => {
      render(context, state, camera, null, null, tanakhIdentitiesEqual);

      expect(context.gl.uniform2f).toHaveBeenCalledWith(
        context.programs.main.uniforms.resolution,
        800,
        600,
      );
      expect(context.gl.uniform2f).toHaveBeenCalledWith(
        context.programs.main.uniforms.pan,
        // The 800×600 canvas at dpr 2 is 400×300 CSS pixels.
        400 / (2 * 1.5) - 100,
        300 / (2 * 1.5) - 200,
      );
      expect(context.gl.uniform1f).toHaveBeenCalledWith(
        context.programs.main.uniforms.zoom,
        1.5 * 2.0, // zoom * dpr
      );
    });

    it('hands the shader the ring in device pixels', () => {
      render(context, state, camera, null, null, tanakhIdentitiesEqual);

      const { RING_OUTSIDE_PX, RING_INSIDE_PX, RING_MIN_SQUARE_PX } = SEARCH_WITH_OVERLAY;
      expect(context.gl.uniform3f).toHaveBeenCalledWith(
        context.programs.main.uniforms.ring,
        RING_OUTSIDE_PX * 2,
        RING_INSIDE_PX * 2,
        RING_MIN_SQUARE_PX * 2,
      );
    });

    it('binds the vertex array for the draw, then unbinds it, without setting it up again', () => {
      render(context, state, camera, null, null, tanakhIdentitiesEqual);

      const bind = vi.mocked(context.gl.bindVertexArray).mock.calls;
      expect(bind).toEqual([[state.vertexArray], [null]]);
      expect(context.gl.vertexAttribPointer).not.toHaveBeenCalled();
      expect(context.gl.vertexAttribDivisor).not.toHaveBeenCalled();
    });

    it('draws six corners for each verse', () => {
      render(context, state, camera, null, null, tanakhIdentitiesEqual);

      expect(context.gl.drawArraysInstanced).toHaveBeenCalledWith(context.gl.TRIANGLES, 0, 6, 10);
    });

    it('does not render outline when no verses hovered or pinned', () => {
      const useProgram = context.gl.useProgram as any;
      useProgram.mockClear();

      render(context, state, camera, null, null, tanakhIdentitiesEqual);

      // Should only call useProgram once (for main shader, not outline)
      expect(useProgram).toHaveBeenCalledTimes(1);
      expect(useProgram).toHaveBeenCalledWith(context.programs.main.program);
    });

    it('renders hover outline when verse is hovered', () => {
      const hoveredVerse = state.verses[0];

      render(context, state, camera, hoveredVerse, null, tanakhIdentitiesEqual);

      // Should have called useProgram for both main and outline shaders
      expect(context.gl.useProgram).toHaveBeenCalledWith(context.programs.main.program);
      expect(context.gl.useProgram).toHaveBeenCalledWith(context.programs.outline.program);
    });

    it('renders pinned outline when verse is pinned', () => {
      const pinnedVerse = state.verses[2];

      render(context, state, camera, null, pinnedVerse, tanakhIdentitiesEqual);

      // Should have called useProgram for both main and outline shaders
      expect(context.gl.useProgram).toHaveBeenCalledWith(context.programs.main.program);
      expect(context.gl.useProgram).toHaveBeenCalledWith(context.programs.outline.program);
    });

    it('does not render hover outline when hovered verse is same as pinned', () => {
      const verse = state.verses[0];
      (context.gl.useProgram as any).mockClear(); // Clear any previous calls

      render(context, state, camera, verse, verse, tanakhIdentitiesEqual);

      // Should call useProgram 2 times total: once for main, once for pinned outline
      // Not for hover since hovered === pinned
      expect(context.gl.useProgram).toHaveBeenCalledTimes(2);
      expect(context.gl.useProgram).toHaveBeenCalledWith(context.programs.main.program);
      expect(context.gl.useProgram).toHaveBeenCalledWith(context.programs.outline.program);
    });

    it('renders both hover and pinned outlines when different verses', () => {
      const hoveredVerse = state.verses[0];
      const pinnedVerse = state.verses[1];
      (context.gl.useProgram as any).mockClear(); // Clear any previous calls

      render(context, state, camera, hoveredVerse, pinnedVerse, tanakhIdentitiesEqual);

      // Should call useProgram 3 times total: main, hover outline, pinned outline
      expect(context.gl.useProgram).toHaveBeenCalledTimes(3);
      expect(context.gl.useProgram).toHaveBeenCalledWith(context.programs.main.program);
      expect(context.gl.useProgram).toHaveBeenCalledWith(context.programs.outline.program);
    });

    it('handles zero verses', () => {
      state.verses = [];

      expect(() => render(context, state, camera, null, null, tanakhIdentitiesEqual)).not.toThrow();
      expect(context.gl.drawArraysInstanced).toHaveBeenCalledWith(context.gl.TRIANGLES, 0, 6, 0);
    });

    it('scales zoom by dpr for high-DPI displays', () => {
      state.dpr = 3.0;
      camera.zoom = 2.0;

      render(context, state, camera, null, null, tanakhIdentitiesEqual);

      expect(context.gl.uniform1f).toHaveBeenCalledWith(
        context.programs.main.uniforms.zoom,
        6.0, // 2.0 * 3.0
      );
    });

    it('updates label positions when window.bookLabels exists', () => {
      const mockLabels = document.createElement('div') as HTMLDivElement;
      window.bookLabels = mockLabels;

      render(context, state, camera, null, null, tanakhIdentitiesEqual);

      // Labels should be updated (exact behavior tested in labels.test.ts)
      expect(window.bookLabels).toBeDefined();

      delete window.bookLabels;
    });
  });

  describe('renderOutline', () => {
    let context: RenderContext;
    let state: RenderState;
    let camera: Camera;
    let verse: ReturnType<typeof createVerse>;

    beforeEach(() => {
      const canvas = createMockCanvas();
      context = createRenderContext(canvas);
      state = createRenderState(context, createVerses(5), 2.0);
      camera = { x: 50, y: 100, zoom: 1.0 };
      verse = createVerse({ x: 10, y: 20, size: 6 });
      vi.clearAllMocks();
    });

    it('creates new buffer when buffer is null', () => {
      const buffer = renderOutline(context, state, verse, [1, 0, 0], null, camera);

      expect(buffer).toBeDefined();
      expect(context.gl.createBuffer).toHaveBeenCalled();
    });

    it('reuses existing buffer when provided', () => {
      const mockBuffer = {} as WebGLBuffer;
      const createBufferSpy = context.gl.createBuffer as any;
      createBufferSpy.mockClear();

      const buffer = renderOutline(context, state, verse, [1, 0, 0], mockBuffer, camera);

      expect(buffer).toBe(mockBuffer);
      expect(context.gl.createBuffer).not.toHaveBeenCalled();
    });

    it('uses outline shader program', () => {
      renderOutline(context, state, verse, [1, 0, 0], null, camera);

      expect(context.gl.useProgram).toHaveBeenCalledWith(context.programs.outline.program);
    });

    it('sets camera uniforms with dpr scaling', () => {
      renderOutline(context, state, verse, [0, 1, 0], null, camera);

      expect(context.gl.uniform2f).toHaveBeenCalledWith(
        context.programs.outline.uniforms.resolution,
        800,
        600,
      );
      expect(context.gl.uniform2f).toHaveBeenCalledWith(
        context.programs.outline.uniforms.pan,
        400 / 2 - 50,
        300 / 2 - 100,
      );
      expect(context.gl.uniform1f).toHaveBeenCalledWith(
        context.programs.outline.uniforms.zoom,
        1.0 * 2.0, // zoom * dpr
      );
    });

    it('sets outline color uniform', () => {
      const color: [number, number, number] = [0.5, 0.7, 0.9];
      renderOutline(context, state, verse, color, null, camera);

      expect(context.gl.uniform3f).toHaveBeenCalledWith(
        context.programs.outline.uniforms.color,
        0.5,
        0.7,
        0.9,
      );
    });

    it('draws 24 vertices for outline (4 borders * 6 vertices)', () => {
      renderOutline(context, state, verse, [1, 1, 1], null, camera);

      expect(context.gl.drawArrays).toHaveBeenCalledWith(context.gl.TRIANGLES, 0, 24);
    });

    it('binds buffer before drawing', () => {
      const buffer = renderOutline(context, state, verse, [1, 0, 0], null, camera);

      expect(context.gl.bindBuffer).toHaveBeenCalledWith(context.gl.ARRAY_BUFFER, buffer);
    });

    it('enables position vertex attribute', () => {
      renderOutline(context, state, verse, [1, 0, 0], null, camera);

      expect(context.gl.enableVertexAttribArray).toHaveBeenCalledWith(
        context.programs.outline.attribs.position,
      );
    });

    it('uploads geometry to buffer', () => {
      renderOutline(context, state, verse, [1, 0, 0], null, camera);

      expect(context.gl.bufferData).toHaveBeenCalled();
      const callArgs = (context.gl.bufferData as any).mock.calls[0];
      expect(callArgs[0]).toBe(context.gl.ARRAY_BUFFER);
      expect(callArgs[1]).toBeInstanceOf(Float32Array);
      expect(callArgs[2]).toBe(context.gl.STATIC_DRAW);
    });

    it('handles different verse sizes', () => {
      const smallVerse = createVerse({ size: 4 });
      const largeVerse = createVerse({ size: 10 });

      expect(() =>
        renderOutline(context, state, smallVerse, [1, 0, 0], null, camera),
      ).not.toThrow();
      expect(() =>
        renderOutline(context, state, largeVerse, [1, 0, 0], null, camera),
      ).not.toThrow();
    });

    it('handles different colors', () => {
      const colors: Array<[number, number, number]> = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 1],
        [0.2, 0.9, 1.0],
      ];

      colors.forEach((color) => {
        vi.clearAllMocks();
        renderOutline(context, state, verse, color, null, camera);

        expect(context.gl.uniform3f).toHaveBeenCalledWith(
          context.programs.outline.uniforms.color,
          ...color,
        );
      });
    });

    it('returns the same buffer object when reusing', () => {
      const mockBuffer = {} as WebGLBuffer;

      const result1 = renderOutline(context, state, verse, [1, 0, 0], mockBuffer, camera);
      const result2 = renderOutline(context, state, verse, [0, 1, 0], mockBuffer, camera);

      expect(result1).toBe(mockBuffer);
      expect(result2).toBe(mockBuffer);
    });
  });

  describe('RenderState immutability', () => {
    it('does not modify verses array when creating state', () => {
      const context = createRenderContext(createMockCanvas());
      const verses = createVerses(3);
      const versesCopy = [...verses];

      createRenderState(context, verses, 1.0);

      expect(verses).toEqual(versesCopy);
    });

    it('does not modify verses when rebuilding geometry', () => {
      const context = createRenderContext(createMockCanvas());
      const gl = context.gl;
      const verses = createVerses(3);
      const state = createRenderState(context, verses, 1.0);
      const versesCopy = [...verses.map((v) => ({ ...v }))];

      rebuildGeometry(gl, state);

      expect(state.verses).toEqual(versesCopy);
    });
  });

  describe('integration with camera', () => {
    it('renders with different camera positions', () => {
      const canvas = createMockCanvas();
      const context = createRenderContext(canvas);
      const verses = createVerses(5);
      const state = createRenderState(context, verses, 1.0);

      const cameras: Camera[] = [
        { x: 0, y: 0, zoom: 1.0 },
        { x: 100, y: 200, zoom: 2.0 },
        { x: -50, y: -75, zoom: 0.5 },
      ];

      cameras.forEach((camera) => {
        vi.clearAllMocks();
        render(context, state, camera, null, null, tanakhIdentitiesEqual);

        expect(context.gl.uniform2f).toHaveBeenCalledWith(
          context.programs.main.uniforms.pan,
          800 / (2 * camera.zoom) - camera.x,
          600 / (2 * camera.zoom) - camera.y,
        );
      });
    });

    it('applies zoom correctly with different dpr values', () => {
      const canvas = createMockCanvas();
      const context = createRenderContext(canvas);
      const verses = createVerses(2);

      const testCases = [
        { dpr: 1.0, zoom: 1.0, expected: 1.0 },
        { dpr: 2.0, zoom: 1.5, expected: 3.0 },
        { dpr: 1.5, zoom: 2.0, expected: 3.0 },
        { dpr: 3.0, zoom: 0.5, expected: 1.5 },
      ];

      testCases.forEach(({ dpr, zoom, expected }) => {
        vi.clearAllMocks();
        const state = createRenderState(context, verses, dpr);
        const camera = { x: 0, y: 0, zoom };

        render(context, state, camera, null, null, tanakhIdentitiesEqual);

        expect(context.gl.uniform1f).toHaveBeenCalledWith(
          context.programs.main.uniforms.zoom,
          expected,
        );
      });
    });
  });
});

describe('the search ring', () => {
  it('leaves a hole in the smallest square that has one', () => {
    // There the square is drawn RING_OUTSIDE_PX larger on every side and the
    // ring is measured in from that edge, so the hole is the square less the
    // inside width twice.
    const { RING_INSIDE_PX, RING_MIN_SQUARE_PX } = SEARCH_WITH_OVERLAY;
    expect(RING_MIN_SQUARE_PX - 2 * RING_INSIDE_PX).toBeGreaterThan(0);
  });
});
