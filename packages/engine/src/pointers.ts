// Pointers: thin wedges from a square toward another square, drawn over the squares. A pointer
// can grow from its resting length to halfway, flaring in to a hairline as it goes, so that two
// pointing at each other meet as an hourglass, solid at both ends.

import type { Color } from '@torahmap/utils';
import { easingFunctions } from './interpolation.ts';
import { compileProgram } from './webgl.ts';

/** A tapered line from one map point toward another, `length` map units long at rest. */
export interface Pointer {
  from: { x: number; y: number };
  to: { x: number; y: number };
  length: number;
  color: Color;
}

/** A pointer grown to halfway, by its place in the list of pointers, drawn at `opacity`. */
export interface GrownPointer {
  index: number;
  opacity: number;
}

// Half widths in CSS pixels: a pointer where it leaves its square, at rest and grown, and the
// hairline a grown one narrows to, never to nothing.
const HALF_WIDTH = 0.9;
const HALF_WIDTH_GROWN = 1.4;
const HALF_WIDTH_HAIRLINE = 0.3;
// How far along a grown pointer reaches the hairline: a quarter of its length, at most so many
// CSS pixels.
const FLARE_MAX = 40;
// How long a pointer takes to grow all the way, or to shrink back.
const GROW_MS = 450;

const FLOATS_PER_POINTER = 8; // from, to, length, colour
const FLOATS_PER_STATE = 2; // grown, opacity

const VERTEX_SHADER = `#version 300 es
  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;
  // Half widths in device pixels: at rest, grown, the hairline; then the longest flare.
  uniform vec4 u_widths;
  // Which pass this is: the grown pointers, drawn over the rest, or the rest.
  uniform bool u_drawingGrown;

  in vec2 a_from;
  in vec2 a_to;
  in float a_length;
  in vec3 a_color;
  // How far it has grown, 0 at rest and 1 at halfway.
  in float a_grown;
  in float a_opacity;

  // A quad from the square to the tip, as wide as the widest the pointer gets.
  const vec2 CORNERS[6] = vec2[6](
    vec2(0, -1), vec2(1, -1), vec2(0, 1),
    vec2(0, 1), vec2(1, -1), vec2(1, 1)
  );

  // Along the pointer and across it, in device pixels.
  out vec2 v_place;
  flat out float v_reach;
  flat out float v_grown;
  flat out vec4 v_color;

  void main() {
    vec2 from = (a_from + u_pan) * u_zoom;
    vec2 to = (a_to + u_pan) * u_zoom;
    float d = length(to - from);
    if (d == 0.0 || (a_grown > 0.0) != u_drawingGrown) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec2 along = (to - from) / d;
    vec2 across = vec2(-along.y, along.x);
    float rest = min(a_length * u_zoom, d);
    v_reach = mix(rest, max(d * 0.5, rest), a_grown);
    v_grown = a_grown;
    v_color = vec4(a_color, a_opacity);
    // A pixel past each end and each side, to hold the antialiasing.
    vec2 corner = CORNERS[gl_VertexID];
    float halfWidth = max(u_widths.x, u_widths.y) + 1.0;
    v_place = vec2(mix(-1.0, v_reach + 1.0, corner.x), corner.y * halfWidth);
    vec2 pos = from + along * v_place.x + across * v_place.y;
    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  }
`;

const FRAGMENT_SHADER = `#version 300 es
  precision highp float;
  uniform vec4 u_widths;
  in vec2 v_place;
  flat in float v_reach;
  flat in float v_grown;
  flat in vec4 v_color;
  out vec4 fragColor;

  // How much of the span from a to b a pixel centred on p covers.
  float covered(float p, float a, float b) {
    return max(0.0, min(b, p + 0.5) - max(a, p - 0.5));
  }

  void main() {
    float s = v_place.x;
    // At rest, a wedge narrowing to its tip.
    float wedge = u_widths.x * max(0.0, 1.0 - s / v_reach);
    // Grown, it curves in to the hairline a short way out and runs on as one: the quadratic from
    // (0, full) through (0.3 flare, hairline) to (flare, hairline).
    float hair = u_widths.z;
    float flare = min(v_reach * 0.25, u_widths.w);
    float x = clamp(s / flare, 0.0, 1.0);
    float t = (-0.6 + sqrt(0.36 + 1.6 * x)) / 0.8;
    float grown = hair + (1.0 - t) * (1.0 - t) * (u_widths.y - hair);
    float halfWidth = mix(wedge, grown, smoothstep(0.0, 0.3, v_grown));
    float alpha = covered(v_place.y, -halfWidth, halfWidth) * covered(s, 0.0, v_reach);
    if (alpha <= 0.0) discard;
    fragColor = vec4(v_color.rgb, v_color.a * alpha);
  }
`;

const ATTRIBUTES = {
  a_from: { size: 2, offset: 0 },
  a_to: { size: 2, offset: 2 },
  a_length: { size: 1, offset: 4 },
  a_color: { size: 3, offset: 5 },
} as const;

/**
 * Draws pointers with `gl`. The pointers are given once, at rest; `grow` says which of them grow to
 * halfway, and `draw` moves each a step toward that and says whether any is still moving.
 */
export function createPointerRenderer(gl: WebGL2RenderingContext) {
  const program = compileProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const uniforms = {
    resolution: uniform('u_resolution'),
    pan: uniform('u_pan'),
    zoom: uniform('u_zoom'),
    widths: uniform('u_widths'),
    drawingGrown: uniform('u_drawingGrown'),
  };
  const pointerBuffer = gl.createBuffer();
  const stateBuffer = gl.createBuffer();
  const vertexArray = gl.createVertexArray();
  if (!pointerBuffer || !stateBuffer || !vertexArray) throw new Error('Failed to create buffers');

  gl.bindVertexArray(vertexArray);
  const attribute = (name: string, size: number, stride: number, offset: number) => {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4);
    gl.vertexAttribDivisor(location, 1);
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, pointerBuffer);
  for (const [name, { size, offset }] of Object.entries(ATTRIBUTES)) {
    attribute(name, size, FLOATS_PER_POINTER, offset);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, stateBuffer);
  attribute('a_grown', 1, FLOATS_PER_STATE, 0);
  attribute('a_opacity', 1, FLOATS_PER_STATE, 1);
  gl.bindVertexArray(null);

  let count = 0;
  // Each pointer's progress toward grown before easing, where it is going, and its opacity grown:
  // fully opaque at rest, it reaches that opacity as it reaches halfway.
  let progress = new Float32Array(0);
  let progressTo = new Float32Array(0);
  let grownOpacity = new Float32Array(0);
  const upload = () => {
    const out = new Float32Array(count * FLOATS_PER_STATE);
    const ease = easingFunctions['ease-out'];
    for (let i = 0; i < count; i++) {
      out[i * FLOATS_PER_STATE] = ease(progress[i]);
      out[i * FLOATS_PER_STATE + 1] = 1 + (grownOpacity[i] - 1) * progress[i];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, stateBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, out, gl.DYNAMIC_DRAW);
  };
  let moving = false;
  let lastStep = 0;

  return {
    /** Replaces the pointers, every one at rest. */
    setPointers(pointers: readonly Pointer[]): void {
      count = pointers.length;
      const data = new Float32Array(count * FLOATS_PER_POINTER);
      pointers.forEach(({ from, to, length, color }, i) => {
        data.set([from.x, from.y, to.x, to.y, length, ...color], i * FLOATS_PER_POINTER);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, pointerBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      progress = new Float32Array(count);
      progressTo = new Float32Array(count);
      grownOpacity = new Float32Array(count).fill(1);
      upload();
      moving = false;
    },

    /** Grows `grown` and shrinks every other pointer back to rest; at once when `snap`. */
    grow(grown: readonly GrownPointer[], snap: boolean): void {
      progressTo.fill(0);
      for (const { index, opacity } of grown) {
        progressTo[index] = 1;
        grownOpacity[index] = opacity;
      }
      if (snap) {
        progress.set(progressTo);
        upload();
        moving = false;
        return;
      }
      if (!moving) lastStep = performance.now();
      moving = true;
    },

    /** Draws the pointers at the map's offset and zoom; true while some are still growing or shrinking. */
    draw(offset: { x: number; y: number }, zoom: number, dpr: number): boolean {
      if (count === 0) return false;
      if (moving) {
        const now = performance.now();
        const stepBy = (now - lastStep) / GROW_MS;
        lastStep = now;
        moving = false;
        for (let i = 0; i < count; i++) {
          const p = progress[i];
          const to = progressTo[i];
          if (p === to) continue;
          progress[i] = to > p ? Math.min(to, p + stepBy) : Math.max(to, p - stepBy);
          if (progress[i] !== to) moving = true;
        }
        upload();
      }

      const canvas = gl.canvas as HTMLCanvasElement;
      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.pan, offset.x, offset.y);
      gl.uniform1f(uniforms.zoom, zoom * dpr);
      gl.uniform4f(
        uniforms.widths,
        HALF_WIDTH * dpr,
        HALF_WIDTH_GROWN * dpr,
        HALF_WIDTH_HAIRLINE * dpr,
        FLARE_MAX * dpr,
      );
      gl.bindVertexArray(vertexArray);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      for (const grown of [false, true]) {
        gl.uniform1i(uniforms.drawingGrown, grown ? 1 : 0);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
      }
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
      return moving;
    },
  };
}

export type PointerRenderer = ReturnType<typeof createPointerRenderer>;
