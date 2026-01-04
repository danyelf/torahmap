// Build vertex buffer from verse layout

export function buildVerseGeometry(verses, baseColor = [0.6, 0.6, 0.6]) {
  // Each verse = 2 triangles = 6 vertices
  // Each vertex = x, y, r, g, b, u, v
  const floatsPerVertex = 7;
  const verticesPerQuad = 6;
  const data = new Float32Array(verses.length * verticesPerQuad * floatsPerVertex);

  let offset = 0;
  for (const v of verses) {
    const x0 = v.x;
    const y0 = v.y;
    const x1 = v.x + v.size - 1; // -1 for 1px gap
    const y1 = v.y + v.size - 1;
    const [r, g, b] = v.color || baseColor;

    // Triangle 1 (top-left, top-right, bottom-left)
    data[offset++] = x0; data[offset++] = y0; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = 0; data[offset++] = 0;
    data[offset++] = x1; data[offset++] = y0; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = 1; data[offset++] = 0;
    data[offset++] = x0; data[offset++] = y1; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = 0; data[offset++] = 1;

    // Triangle 2 (bottom-left, top-right, bottom-right)
    data[offset++] = x0; data[offset++] = y1; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = 0; data[offset++] = 1;
    data[offset++] = x1; data[offset++] = y0; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = 1; data[offset++] = 0;
    data[offset++] = x1; data[offset++] = y1; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = 1; data[offset++] = 1;
  }

  return data;
}

export function createBuffer(gl, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}
