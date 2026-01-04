// WebGL utilities
export function initWebGL(canvas) {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 not supported');
  return gl;
}
