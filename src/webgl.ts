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

  out vec3 v_color;
  out vec3 v_color2;
  out vec3 v_color3;
  out vec3 v_color4;
  flat out int v_colorCount;
  out vec2 v_uv;

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
  out vec4 fragColor;

  // Simple hash for dithering noise and stipple selection
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 color;

    if (v_colorCount <= 1) {
      // Single color - use directly
      color = v_color;
    } else {
      // Multiple colors - use hash to pick one (stipple effect)
      float h = hash(gl_FragCoord.xy);
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

    // Add subtle dithering noise to break up moiré patterns
    float noise = (hash(gl_FragCoord.xy + 0.5) - 0.5) * 0.1;
    color = color + noise;

    fragColor = vec4(color, 1.0);
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
    },
    uniforms: {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      pan: gl.getUniformLocation(program, 'u_pan'),
      zoom: gl.getUniformLocation(program, 'u_zoom'),
    }
  };
}
