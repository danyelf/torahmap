// WebGL utilities for rendering verse quads

import type { ShaderProgram } from './types.ts';

const VERTEX_SHADER = `#version 300 es
  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;

  in vec2 a_position;
  in vec3 a_color;
  in vec3 a_color2;
  in vec3 a_color3;
  in vec3 a_color4;
  in float a_colorCount;
  in vec2 a_uv;
  in vec2 a_seed;

  out vec3 v_color;
  out vec3 v_color2;
  out vec3 v_color3;
  out vec3 v_color4;
  flat out int v_colorCount;
  out vec2 v_uv;
  out vec2 v_seed;

  void main() {
    vec2 pos = (a_position + u_pan) * u_zoom;
    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_color = a_color;
    v_color2 = a_color2;
    v_color3 = a_color3;
    v_color4 = a_color4;
    v_colorCount = int(a_colorCount);
    v_uv = a_uv;
    v_seed = a_seed;
  }
`;

const FRAGMENT_SHADER = `#version 300 es
  precision mediump float;
  in vec3 v_color;
  in vec3 v_color2;
  in vec3 v_color3;
  in vec3 v_color4;
  flat in int v_colorCount;
  in vec2 v_uv;
  in vec2 v_seed;
  out vec4 fragColor;

  // Simple hash for dithering noise and stipple selection
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Second hash with different coefficients for variety
  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(39.346, 11.135))) * 83758.5453);
  }

  uniform int u_multiStyle;
  uniform float u_bleed;
  uniform float u_alpha;
  uniform float u_curve;
  uniform float u_edgeUnits;

  vec3 pick(int idx) {
    if (idx == 0) return v_color;
    if (idx == 1) return v_color2;
    if (idx == 2) return v_color3;
    return v_color4;
  }

  // One wedge per color, clockwise from twelve o'clock.
  vec3 wedge() {
    vec2 p = v_uv - 0.5;
    float t = fract(atan(p.x, -p.y) / 6.2831853 + 1.0);
    return pick(int(floor(t * float(v_colorCount))));
  }

  // The square in the first color, each further color a solid ring around it,
  // sharing the growth past the edge (1.5 units; one UV unit is 4).
  vec3 rings() {
    vec2 out2 = max(-v_uv, v_uv - 1.0);
    float d = max(max(out2.x, out2.y), 0.0) * 4.0;
    if (d <= 0.0) return v_color;
    float band = 1.5 / float(v_colorCount - 1);
    return pick(min(1 + int(floor(d / band)), v_colorCount - 1));
  }

  // One band per color along the diagonal, so a split never looks like two
  // neighbouring verses.
  vec3 diagonalBands() {
    float d = clamp((v_uv.x + v_uv.y) * 0.5, 0.0, 0.999);
    return pick(int(floor(d * float(v_colorCount))));
  }

  // Which diagonal band of the whole grown square a UV point falls in.
  int grownBand(vec2 uv) {
    float b = u_bleed / 4.0;
    float d = clamp(((uv.x + uv.y) * 0.5 + b) / (1.0 + 2.0 * b), 0.0, 0.999);
    return int(floor(d * float(v_colorCount)));
  }

  // Every hit grows solid; several terms split it corner to corner.
  vec3 grownDiagonal() {
    return pick(grownBand(v_uv));
  }

  // A solid square split corner to corner, inside a coarse speckled edge
  // whose specks take the colour of the nearest part of the square.
  vec3 haloOrdered() {
    bool inSquare = v_uv == clamp(v_uv, 0.0, 1.0);
    if (inSquare) return diagonalBands();
    vec2 c = floor(v_uv * 4.0);
    if (hash(c + v_seed * 0.1) > 0.3) discard;
    vec2 nearest = clamp((c + 0.5) / 4.0, 0.0, 1.0);
    float d = clamp((nearest.x + nearest.y) * 0.5, 0.0, 0.999);
    return pick(int(floor(d * float(v_colorCount))));
  }

  // Colour of the square's diagonal band nearest a UV point.
  vec3 nearestBand(vec2 uv) {
    vec2 n = clamp(uv, 0.0, 1.0);
    float d = clamp((n.x + n.y) * 0.5, 0.0, 0.999);
    return pick(int(floor(d * float(v_colorCount))));
  }

  // World units from the square's edge, keeping its corners square.
  float distPastEdge() {
    vec2 o = max(max(-v_uv, v_uv - 1.0), 0.0);
    return max(o.x, o.y) * 4.0;
  }

  // A square split corner to corner, inside a translucent edge: flat at
  // u_alpha, or fading from u_alpha to nothing at the edge's outer limit.
  // u_curve above 1 holds the fade bright longer before it drops.
  vec4 glow(bool fade) {
    if (v_uv == clamp(v_uv, 0.0, 1.0)) return vec4(diagonalBands(), 1.0);
    float d = distPastEdge();
    if (d > u_bleed) discard;
    float a = fade ? u_alpha * (1.0 - pow(d / u_bleed, u_curve)) : u_alpha;
    return vec4(nearestBand(v_uv), a);
  }

  // A square split corner to corner, inside an edge a fixed number of screen
  // pixels wide (u_edgeUnits is that width in world units at this zoom),
  // fading from u_alpha to nothing.
  vec4 screenEdge() {
    if (v_uv == clamp(v_uv, 0.0, 1.0)) return vec4(diagonalBands(), 1.0);
    float w = min(u_edgeUnits, u_bleed);
    float d = distPastEdge();
    if (d > w) discard;
    return vec4(nearestBand(v_uv), u_alpha * (1.0 - d / w));
  }

  // A checkerboard whose cell count follows the zoom, keeping cells about
  // two screen pixels or more.
  vec3 screenChecker() {
    float px = 1.0 / max(fwidth(v_uv.x), 1e-5);
    float cells = clamp(floor(px / 2.0), 2.0, 4.0);
    vec2 c = floor(v_uv * cells);
    float rowStep = (v_colorCount == 4) ? 2.0 : 1.0;
    return pick(int(mod(c.x + c.y * rowStep, float(v_colorCount))));
  }

  // A pale centre in a frame, one side per color: top, right, bottom, left.
  vec3 pictureFrame() {
    vec2 p = v_uv - 0.5;
    if (max(abs(p.x), abs(p.y)) < 0.2) return vec3(0.95);
    int side = abs(p.y) >= abs(p.x) ? (p.y < 0.0 ? 0 : 2) : (p.x > 0.0 ? 1 : 3);
    return pick(side - (side / v_colorCount) * v_colorCount);
  }

  // Diagonal bands, plus a strip in the gap below with one segment per color.
  vec3 underline() {
    if (v_uv.x < 0.0 || v_uv.x > 1.0 || v_uv.y < 0.0) discard;
    float n = float(v_colorCount);
    if (v_uv.y > 1.0) return pick(int(min(floor(v_uv.x * n), n - 1.0)));
    return diagonalBands();
  }

  // Scattered cells: cellsPerUv sets the cell size (one UV unit is the
  // verse's 4-unit square), density the share of bleed cells drawn.
  vec3 scatterAt(float bleedCells, float innerCells, float density) {
    bool inBleedZone = v_uv.x < 0.0 || v_uv.x > 1.0 || v_uv.y < 0.0 || v_uv.y > 1.0;
    if (inBleedZone) {
      vec2 c = floor(v_uv * bleedCells) + v_seed * 0.1;
      if (hash(c) > density) discard;
      return pick(int(floor(hash2(c) * float(v_colorCount))));
    }
    vec2 c = floor(v_uv * innerCells + fract(v_seed * 0.0731) * innerCells);
    return pick(int(floor(hash(c + v_seed * 0.0137) * float(v_colorCount))));
  }

  void main() {
    vec3 color;
    float alpha = 1.0;

    if (u_multiStyle == 17) {
      vec4 e = screenEdge();
      color = e.rgb;
      alpha = e.a;
    } else if (u_multiStyle == 16) {
      color = v_colorCount <= 1 ? v_color : diagonalBands();
    } else if (u_multiStyle == 14 || u_multiStyle == 15) {
      vec4 g = glow(u_multiStyle == 15);
      color = g.rgb;
      alpha = g.a;
    } else if (u_multiStyle == 12) {
      color = grownDiagonal();
    } else if (u_multiStyle == 13) {
      color = haloOrdered();
    } else if (u_multiStyle == 11) {
      // Coarse halo around every hit; a single hit's square stays solid.
      color = v_colorCount <= 1 && v_uv == clamp(v_uv, 0.0, 1.0)
        ? v_color
        : scatterAt(4.0, 2.5, 0.3);
    } else if (v_colorCount <= 1) {
      // Single color - use directly
      color = v_color;
    } else if (u_multiStyle == 1 || u_multiStyle == 10) {
      color = scatterAt(4.0, 2.5, 0.3);
    } else if (u_multiStyle == 2) {
      color = scatterAt(8.0, 5.0, 0.7);
    } else if (u_multiStyle == 5) {
      color = rings();
    } else if (u_multiStyle == 6) {
      color = diagonalBands();
    } else if (u_multiStyle == 7) {
      color = screenChecker();
    } else if (u_multiStyle == 8) {
      color = pictureFrame();
    } else if (u_multiStyle == 9) {
      color = underline();
    } else if (u_multiStyle >= 3) {
      color = wedge();
    } else {
      // Multiple colors with bleed effect
      // UV < 0 or > 1 means we're in the bleed zone
      bool inBleedZone = v_uv.x < 0.0 || v_uv.x > 1.0 || v_uv.y < 0.0 || v_uv.y > 1.0;

      if (inBleedZone) {
        // In bleed zone: sparse scattered pixels
        // Use seed + UV to create unique pattern per verse
        vec2 scatterCoord = floor(v_uv * 8.0) + v_seed * 0.1;
        float scatter = hash(scatterCoord);
        float scatter2 = hash2(scatterCoord);

        // Only render ~30% of pixels in bleed zone (sparse scatter)
        if (scatter > 0.3) {
          discard;
        }

        // Pick a color from the available colors
        int idx = int(floor(scatter2 * float(v_colorCount)));
        if (idx == 0) {
          color = v_color;
        } else if (idx == 1) {
          color = v_color2;
        } else if (idx == 2) {
          color = v_color3;
        } else {
          color = v_color4;
        }
      } else {
        // Inside verse: use seed-varied stipple pattern
        // Combine UV with verse seed for unique pattern per verse
        // Use a 5x5 grid with per-verse offset for more organic feel
        vec2 blockCoord = floor(v_uv * 5.0 + fract(v_seed * 0.0731) * 5.0);
        float h = hash(blockCoord + v_seed * 0.0137);
        int idx = int(floor(h * float(v_colorCount)));

        // Select color based on hash
        if (idx == 0) {
          color = v_color;
        } else if (idx == 1) {
          color = v_color2;
        } else if (idx == 2) {
          color = v_color3;
        } else {
          color = v_color4;
        }
      }
    }

    // Add subtle dithering noise to break up moiré patterns (UV-based for zoom stability)
    vec2 noiseCoord = floor(v_uv * 12.0);
    float noise = (hash(noiseCoord + v_seed * 0.01) - 0.5) * 0.1;
    color = color + noise;

    fragColor = vec4(color, alpha);
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

export function initWebGL(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', { antialias: true });
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
    attribs: {
      position: gl.getAttribLocation(program, 'a_position'),
      color: gl.getAttribLocation(program, 'a_color'),
      color2: gl.getAttribLocation(program, 'a_color2'),
      color3: gl.getAttribLocation(program, 'a_color3'),
      color4: gl.getAttribLocation(program, 'a_color4'),
      colorCount: gl.getAttribLocation(program, 'a_colorCount'),
      uv: gl.getAttribLocation(program, 'a_uv'),
      seed: gl.getAttribLocation(program, 'a_seed'),
    },
    uniforms: {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      pan: gl.getUniformLocation(program, 'u_pan'),
      zoom: gl.getUniformLocation(program, 'u_zoom'),
      multiStyle: gl.getUniformLocation(program, 'u_multiStyle'),
      bleed: gl.getUniformLocation(program, 'u_bleed'),
      alpha: gl.getUniformLocation(program, 'u_alpha'),
      curve: gl.getUniformLocation(program, 'u_curve'),
      edgeUnits: gl.getUniformLocation(program, 'u_edgeUnits'),
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
