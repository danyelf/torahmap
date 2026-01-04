// WebGL utilities for rendering verse quads

const VERTEX_SHADER = `#version 300 es
  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;

  in vec2 a_position;
  in vec3 a_color;
  in vec2 a_uv;

  out vec3 v_color;
  out vec2 v_uv;

  void main() {
    vec2 pos = (a_position + u_pan) * u_zoom;
    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_color = a_color;
    v_uv = a_uv;
  }
`;

const FRAGMENT_SHADER = `#version 300 es
  precision mediump float;
  in vec3 v_color;
  in vec2 v_uv;
  out vec4 fragColor;

  void main() {
    // Compute distance from edge (0 at edge, 0.5 at center)
    vec2 edgeDist = min(v_uv, 1.0 - v_uv);
    float dist = min(edgeDist.x, edgeDist.y);

    // Use fwidth for screen-space anti-aliasing
    float fw = fwidth(dist);
    float alpha = smoothstep(0.0, fw * 1.5, dist);

    fragColor = vec4(v_color, alpha);
  }
`;

export function initWebGL(canvas) {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 not supported');
  return gl;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

export function createProgram(gl) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }

  return {
    program,
    attribs: {
      position: gl.getAttribLocation(program, 'a_position'),
      color: gl.getAttribLocation(program, 'a_color'),
      uv: gl.getAttribLocation(program, 'a_uv'),
    },
    uniforms: {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      pan: gl.getUniformLocation(program, 'u_pan'),
      zoom: gl.getUniformLocation(program, 'u_zoom'),
    }
  };
}
