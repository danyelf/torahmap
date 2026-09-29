// WebGL utilities for rendering verse quads

import {
  BAND_OFFSET,
  MULTICOLOR_GROWTH,
  VERSE_ATTRIBUTES,
  type VerseAttributeName,
} from './geometry.ts';

export interface ShaderProgram {
  program: WebGLProgram;
  attribs: Record<VerseAttributeName, number>;
  uniforms: {
    resolution: WebGLUniformLocation | null;
    pan: WebGLUniformLocation | null;
    zoom: WebGLUniformLocation | null;
    fade: WebGLUniformLocation | null;
    ring: WebGLUniformLocation | null;
  };
}

const GLSL_TYPES = { 1: 'float', 2: 'vec2', 3: 'vec3', 4: 'vec4' } as const;

const VERSE_INPUTS = VERSE_ATTRIBUTES.map((a) => `in ${GLSL_TYPES[a.size]} ${a.name};`).join(
  '\n  ',
);

const VERTEX_SHADER = `#version 300 es
  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;
  // How far each verse has gone from its first picture to its second.
  // Shared with the fragment shader, so its precision is stated in both.
  uniform highp float u_fade;
  // A ring's width outside the square and inside it, and the smallest square
  // that keeps a hole, in device pixels. Shared, like u_fade.
  uniform highp vec3 u_ring;

  ${VERSE_INPUTS}

  // The two triangles of a square, as fractions of the way across it. Every
  // verse is drawn from these six corners, picked by gl_VertexID.
  const vec2 CORNERS[6] = vec2[6](
    vec2(0, 0), vec2(1, 0), vec2(0, 1),
    vec2(0, 1), vec2(1, 0), vec2(1, 1)
  );

  flat out highp vec4 v_fill;
  flat out highp vec4 v_ring;
  flat out highp vec4 v_nextFill;
  flat out highp vec4 v_nextRing;
  // Stripe counts: this picture's fill and ring, then the next's. A ring of
  // no stripes is no ring.
  flat out ivec4 v_counts;
  // The drawn square's side in device pixels, growth included, or 0 when the
  // square is too small for a hole.
  flat out float v_side;
  out vec2 v_uv;
  out vec2 v_seed;

  // Bands slide apart along the cut; the quad reaches past the square to hold them.
  float bandReach(vec3 shape) {
    return shape.x > 1.0 || shape.z > 1.0 ? (max(shape.x, shape.z) - 1.0) * 0.5 * ${BAND_OFFSET.toFixed(4)} : 0.0;
  }

  // How far a picture's verse reaches past its square, in world units.
  float reach(vec3 shape, bool holes) {
    float grow = shape.y * ${MULTICOLOR_GROWTH.toFixed(4)};
    return shape.z > 0.0 && holes ? max(grow, u_ring.x / u_zoom) : grow;
  }

  void main() {
    vec2 uv = CORNERS[gl_VertexID];
    float side = (a_rect.z - a_rect.x) * u_zoom;
    bool holes = side >= u_ring.z;
    float grow = mix(reach(a_shape, holes), reach(a_nextShape, holes), u_fade);
    vec4 rect = a_rect + vec4(-grow, -grow, grow, grow);
    float pad = max(bandReach(a_shape), bandReach(a_nextShape));
    uv = mix(vec2(-pad), vec2(1.0 + pad), uv);
    vec2 world = mix(rect.xy, rect.zw, uv);
    vec2 pos = (world + u_pan) * u_zoom;
    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_fill = a_fill;
    v_ring = a_ring;
    v_nextFill = a_nextFill;
    v_nextRing = a_nextRing;
    v_counts = ivec4(a_shape.x, a_shape.z, a_nextShape.x, a_nextShape.z);
    v_side = holes ? (rect.z - rect.x) * u_zoom : 0.0;
    v_uv = uv;
    // The square's own corner, which zooming does not move, seeds its dithering noise
    v_seed = a_rect.xy;
  }
`;

const FRAGMENT_SHADER = `#version 300 es
  precision mediump float;
  uniform highp float u_fade;
  uniform highp vec3 u_ring;
  flat in highp vec4 v_fill;
  flat in highp vec4 v_ring;
  flat in highp vec4 v_nextFill;
  flat in highp vec4 v_nextRing;
  flat in ivec4 v_counts;
  flat in float v_side;
  in vec2 v_uv;
  in vec2 v_seed;
  out vec4 fragColor;

  // Simple hash for dithering noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec3 unpack(highp float packed) {
    highp int c = int(packed);
    return vec3(float(c >> 16), float((c >> 8) & 255), float(c & 255)) / 255.0;
  }

  bool inSquare(vec2 p) {
    return all(greaterThanEqual(p, vec2(0))) && all(lessThan(p, vec2(1)));
  }

  // The ring is measured in from the drawn edge, so a grown verse's ring is
  // as thick as any other's.
  bool inHole(vec2 p) {
    float inset = u_ring.x + u_ring.y;
    vec2 px = p * v_side;
    return v_side > 0.0 &&
      all(greaterThanEqual(px, vec2(inset))) &&
      all(lessThan(px, vec2(v_side - inset)));
  }

  // Several colors split the square into bands running corner to corner, one
  // per color. A diagonal cut keeps a two-color verse from reading as two
  // neighbouring verses, as a vertical split does. Each band slides a little
  // along the cut, centred on the square, so the bands read as separate
  // pieces. hole: 0 anywhere, 1 outside the hole, 2 inside it. Alpha 0 where
  // no band covers p.
  vec4 stripes(highp vec4 colors, int count, vec2 p, int hole) {
    for (int k = 0; k < 4; k++) {
      if (k >= count && k > 0) break;
      float s = (float(k) - float(max(count, 1) - 1) * 0.5) * ${BAND_OFFSET.toFixed(4)};
      vec2 q = p - s * vec2(1.0, -1.0);
      if (!inSquare(q)) continue;
      if (hole == 1 && inHole(q)) continue;
      if (hole == 2 && !inHole(q)) continue;
      if (count > 1 && int(floor(min((q.x + q.y) * 0.5, 0.999) * float(count))) != k) continue;
      highp float c = k == 0 ? colors.x : k == 1 ? colors.y : k == 2 ? colors.z : colors.w;
      return vec4(unpack(c), 1.0);
    }
    return vec4(0.0);
  }

  // One picture here: its ring, if it has one, and its fill inside the hole.
  vec4 picture(highp vec4 fill, highp vec4 ring, int fillCount, int ringCount) {
    if (ringCount == 0) return stripes(fill, fillCount, v_uv, 0);
    vec4 r = stripes(ring, ringCount, v_uv, 1);
    return r.a > 0.0 ? r : stripes(fill, fillCount, v_uv, 2);
  }

  void main() {
    // Each picture is drawn whole and the two are faded, so neither's stripes
    // have to move to meet the other's. A band that has slid past the square
    // shows in one picture only, and the map does not blend, so it shows whole.
    vec4 a = picture(v_fill, v_ring, v_counts.x, v_counts.y);
    vec4 b = picture(v_nextFill, v_nextRing, v_counts.z, v_counts.w);
    if (a.a == 0.0 && b.a == 0.0) discard;
    vec3 color = a.a == 0.0 ? b.rgb : b.a == 0.0 ? a.rgb : mix(a.rgb, b.rgb, u_fade);

    // Add subtle dithering noise to break up moiré patterns (UV-based for zoom stability)
    vec2 noiseCoord = floor(v_uv * 12.0);
    float noise = (hash(noiseCoord + v_seed * 0.01) - 0.5) * 0.1;
    color = color + noise;

    fragColor = vec4(color, 1.0);
  }
`;

const OUTLINE_VERTEX_SHADER = `#version 300 es
  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;

  in vec2 a_position;

  void main() {
    vec2 pos = (a_position + u_pan) * u_zoom;
    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  }
`;

const OUTLINE_FRAGMENT_SHADER = `#version 300 es
  precision mediump float;
  uniform vec3 u_color;
  out vec4 fragColor;

  void main() {
    fragColor = vec4(u_color, 1.0);
  }
`;

/** The canvas's WebGL 2 context, or null in a browser without one. Asking again returns the same context. */
export function getWebGL2(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  return canvas.getContext('webgl2', { antialias: true });
}

export function initWebGL(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = getWebGL2(canvas);
  if (!gl) throw new Error('WebGL2 not supported');
  return gl;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
  }
  return shader;
}

export function createProgram(gl: WebGL2RenderingContext): ShaderProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Program linking failed');
  }

  return {
    program,
    attribs: Object.fromEntries(
      VERSE_ATTRIBUTES.map((a) => [a.name, gl.getAttribLocation(program, a.name)]),
    ) as ShaderProgram['attribs'],
    uniforms: {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      pan: gl.getUniformLocation(program, 'u_pan'),
      zoom: gl.getUniformLocation(program, 'u_zoom'),
      fade: gl.getUniformLocation(program, 'u_fade'),
      ring: gl.getUniformLocation(program, 'u_ring'),
    },
  };
}

export interface OutlineProgram {
  program: WebGLProgram;
  attribs: {
    position: number;
  };
  uniforms: {
    resolution: WebGLUniformLocation | null;
    pan: WebGLUniformLocation | null;
    zoom: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
  };
}

export function createOutlineProgram(gl: WebGL2RenderingContext): OutlineProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, OUTLINE_VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, OUTLINE_FRAGMENT_SHADER);

  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Program linking failed');
  }

  return {
    program,
    attribs: {
      position: gl.getAttribLocation(program, 'a_position'),
    },
    uniforms: {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      pan: gl.getUniformLocation(program, 'u_pan'),
      zoom: gl.getUniformLocation(program, 'u_zoom'),
      color: gl.getUniformLocation(program, 'u_color'),
    },
  };
}
