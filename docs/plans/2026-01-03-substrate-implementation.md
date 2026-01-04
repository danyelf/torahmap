# Torah Visual Substrate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render a WebGL visualization showing every verse of the Torah as a small square, organized with books as columns and chapters as rows.

**Architecture:** Static HTML page loads torah-structure.json, computes layout positions for all ~5,845 verses, renders them as WebGL quads. Mouse position maps to verse reference displayed on hover.

**Tech Stack:** Vanilla HTML/JS, WebGL2, no build tools

---

### Task 1: Project Skeleton

**Files:**
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/webgl.js`

**Step 1: Create index.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Torah Map</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a1a; overflow: hidden; }
    canvas { display: block; }
    #hover-info {
      position: fixed;
      top: 10px;
      left: 10px;
      color: #fff;
      font-family: monospace;
      font-size: 14px;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div id="hover-info"></div>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

**Step 2: Create src/main.js stub**

```javascript
// Torah Map - Main entry point
console.log('Torah Map loading...');
```

**Step 3: Create src/webgl.js stub**

```javascript
// WebGL utilities
export function initWebGL(canvas) {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 not supported');
  return gl;
}
```

**Step 4: Verify by opening in browser**

Open `index.html` in browser. Console should show "Torah Map loading..."

**Step 5: Commit**

```bash
git add index.html src/
git commit -m "feat: project skeleton with HTML and JS stubs"
```

---

### Task 2: Torah Structure Data

**Files:**
- Create: `data/torah-structure.json`

**Step 1: Create torah-structure.json**

The Torah has 5 books with the following chapter/verse structure:

```json
{
  "books": [
    {
      "name": "Genesis",
      "hebrewName": "בראשית",
      "chapters": [31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26]
    },
    {
      "name": "Exodus",
      "hebrewName": "שמות",
      "chapters": [22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38]
    },
    {
      "name": "Leviticus",
      "hebrewName": "ויקרא",
      "chapters": [17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34]
    },
    {
      "name": "Numbers",
      "hebrewName": "במדבר",
      "chapters": [54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,36,34,51,26,5]
    },
    {
      "name": "Deuteronomy",
      "hebrewName": "דברים",
      "chapters": [46,37,29,54,30,17,18,17,21,8,21,17,21,11,19,19,73,18,15,40,14,21,23,19,29,22,21,69,52]
    }
  ]
}
```

**Step 2: Verify JSON is valid**

```bash
python3 -m json.tool data/torah-structure.json > /dev/null && echo "Valid JSON"
```

**Step 3: Commit**

```bash
git add data/
git commit -m "feat: add Torah structure data (5 books, all chapter verse counts)"
```

---

### Task 3: Layout Algorithm

**Files:**
- Create: `src/layout.js`

**Step 1: Create layout.js with position computation**

```javascript
// Layout algorithm: compute (x, y) position for every verse

const VERSE_SIZE = 10;      // pixels per verse square
const CHAPTER_GAP = 3;      // gap between chapter rows
const BOOK_GAP = 20;        // gap between book columns

export function computeLayout(torahData) {
  const verses = [];
  let bookX = 0;

  for (const book of torahData.books) {
    let maxChapterWidth = 0;
    let chapterY = 0;

    for (let chapterIdx = 0; chapterIdx < book.chapters.length; chapterIdx++) {
      const verseCount = book.chapters[chapterIdx];

      for (let verseIdx = 0; verseIdx < verseCount; verseIdx++) {
        verses.push({
          book: book.name,
          chapter: chapterIdx + 1,
          verse: verseIdx + 1,
          x: bookX + verseIdx * VERSE_SIZE,
          y: chapterY,
          size: VERSE_SIZE
        });
      }

      maxChapterWidth = Math.max(maxChapterWidth, verseCount * VERSE_SIZE);
      chapterY += VERSE_SIZE + CHAPTER_GAP;
    }

    bookX += maxChapterWidth + BOOK_GAP;
  }

  return verses;
}

export function getLayoutBounds(verses) {
  let maxX = 0, maxY = 0;
  for (const v of verses) {
    maxX = Math.max(maxX, v.x + v.size);
    maxY = Math.max(maxY, v.y + v.size);
  }
  return { width: maxX, height: maxY };
}
```

**Step 2: Commit**

```bash
git add src/layout.js
git commit -m "feat: layout algorithm computing verse positions"
```

---

### Task 4: WebGL Renderer Setup

**Files:**
- Modify: `src/webgl.js`

**Step 1: Add shader sources and initialization**

```javascript
// WebGL utilities for rendering verse quads

const VERTEX_SHADER = `#version 300 es
  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;

  in vec2 a_position;
  in vec3 a_color;

  out vec3 v_color;

  void main() {
    vec2 pos = (a_position + u_pan) * u_zoom;
    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_color = a_color;
  }
`;

const FRAGMENT_SHADER = `#version 300 es
  precision mediump float;
  in vec3 v_color;
  out vec4 fragColor;

  void main() {
    fragColor = vec4(v_color, 1.0);
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
    },
    uniforms: {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      pan: gl.getUniformLocation(program, 'u_pan'),
      zoom: gl.getUniformLocation(program, 'u_zoom'),
    }
  };
}
```

**Step 2: Commit**

```bash
git add src/webgl.js
git commit -m "feat: WebGL shader setup with zoom/pan uniforms"
```

---

### Task 5: Verse Geometry Builder

**Files:**
- Create: `src/geometry.js`

**Step 1: Create geometry.js to build vertex buffers**

```javascript
// Build vertex buffer from verse layout

export function buildVerseGeometry(verses, baseColor = [0.6, 0.6, 0.6]) {
  // Each verse = 2 triangles = 6 vertices
  // Each vertex = x, y, r, g, b
  const floatsPerVertex = 5;
  const verticesPerQuad = 6;
  const data = new Float32Array(verses.length * verticesPerQuad * floatsPerVertex);

  let offset = 0;
  for (const v of verses) {
    const x0 = v.x;
    const y0 = v.y;
    const x1 = v.x + v.size - 1; // -1 for 1px gap
    const y1 = v.y + v.size - 1;
    const [r, g, b] = v.color || baseColor;

    // Triangle 1
    data[offset++] = x0; data[offset++] = y0; data[offset++] = r; data[offset++] = g; data[offset++] = b;
    data[offset++] = x1; data[offset++] = y0; data[offset++] = r; data[offset++] = g; data[offset++] = b;
    data[offset++] = x0; data[offset++] = y1; data[offset++] = r; data[offset++] = g; data[offset++] = b;

    // Triangle 2
    data[offset++] = x0; data[offset++] = y1; data[offset++] = r; data[offset++] = g; data[offset++] = b;
    data[offset++] = x1; data[offset++] = y0; data[offset++] = r; data[offset++] = g; data[offset++] = b;
    data[offset++] = x1; data[offset++] = y1; data[offset++] = r; data[offset++] = g; data[offset++] = b;
  }

  return data;
}

export function createBuffer(gl, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}
```

**Step 2: Commit**

```bash
git add src/geometry.js
git commit -m "feat: geometry builder for verse quads"
```

---

### Task 6: Main Integration

**Files:**
- Modify: `src/main.js`

**Step 1: Wire everything together**

```javascript
// Torah Map - Main entry point

import { initWebGL, createProgram } from './webgl.js';
import { computeLayout, getLayoutBounds } from './layout.js';
import { buildVerseGeometry, createBuffer } from './geometry.js';

async function main() {
  // Load Torah structure
  const response = await fetch('data/torah-structure.json');
  const torahData = await response.json();

  // Compute layout
  const verses = computeLayout(torahData);
  const bounds = getLayoutBounds(verses);
  console.log(`Loaded ${verses.length} verses, bounds: ${bounds.width}x${bounds.height}`);

  // Setup canvas
  const canvas = document.getElementById('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Init WebGL
  const gl = initWebGL(canvas);
  const prog = createProgram(gl);

  // Build geometry
  const geometry = buildVerseGeometry(verses);
  const buffer = createBuffer(gl, geometry);

  // Camera state
  let pan = { x: 50, y: 50 };
  let zoom = 1.0;

  // Render function
  function render() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog.program);

    // Set uniforms
    gl.uniform2f(prog.uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(prog.uniforms.pan, pan.x, pan.y);
    gl.uniform1f(prog.uniforms.zoom, zoom);

    // Bind buffer and set attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const stride = 5 * 4; // 5 floats * 4 bytes
    gl.enableVertexAttribArray(prog.attribs.position);
    gl.vertexAttribPointer(prog.attribs.position, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(prog.attribs.color);
    gl.vertexAttribPointer(prog.attribs.color, 3, gl.FLOAT, false, stride, 2 * 4);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, verses.length * 6);
  }

  render();

  // Handle resize
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
  });

  // Store for hover detection
  window.torahMap = { verses, pan, zoom, render, canvas, bounds };
}

main().catch(console.error);
```

**Step 2: Open in browser and verify**

Should see ~5,845 gray squares arranged in 5 columns (one per book), with ragged right edges showing chapter lengths.

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: main integration - renders all Torah verses"
```

---

### Task 7: Zoom and Pan

**Files:**
- Modify: `src/main.js`

**Step 1: Add mouse wheel zoom and drag pan**

Add this after the render() function definition:

```javascript
  // Zoom with mouse wheel
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoom *= zoomFactor;
    zoom = Math.max(0.1, Math.min(10, zoom));
    render();
  }, { passive: false });

  // Pan with mouse drag
  let isDragging = false;
  let lastMouse = { x: 0, y: 0 };

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      pan.x += dx / zoom;
      pan.y += dy / zoom;
      lastMouse = { x: e.clientX, y: e.clientY };
      render();
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
  });
```

**Step 2: Test zoom/pan in browser**

Mouse wheel should zoom in/out. Click and drag should pan.

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: zoom with mouse wheel, pan with drag"
```

---

### Task 8: Hover Detection

**Files:**
- Modify: `src/main.js`

**Step 1: Add hover detection logic**

Add this function before `main()`:

```javascript
function findVerseAtPoint(verses, pan, zoom, canvasX, canvasY) {
  // Convert screen coords to world coords
  const worldX = canvasX / zoom - pan.x;
  const worldY = canvasY / zoom - pan.y;

  for (const v of verses) {
    if (worldX >= v.x && worldX < v.x + v.size &&
        worldY >= v.y && worldY < v.y + v.size) {
      return v;
    }
  }
  return null;
}
```

Then add this event listener after the pan/zoom handlers:

```javascript
  // Hover detection
  const hoverInfo = document.getElementById('hover-info');

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) {
      const verse = findVerseAtPoint(verses, pan, zoom, e.clientX, e.clientY);
      if (verse) {
        hoverInfo.textContent = `${verse.book} ${verse.chapter}:${verse.verse}`;
      } else {
        hoverInfo.textContent = '';
      }
    }
  });
```

**Step 2: Test hover in browser**

Moving mouse over verses should show reference like "Genesis 3:15" in top-left.

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: hover shows verse reference"
```

---

### Task 9: Final Polish

**Files:**
- Modify: `src/main.js`

**Step 1: Center the visualization on load**

Update initial pan calculation after bounds are computed:

```javascript
  // Center visualization
  let pan = {
    x: (canvas.width / 2 - bounds.width / 2),
    y: (canvas.height / 2 - bounds.height / 2)
  };
```

**Step 2: Add book labels (optional enhancement)**

Create `src/labels.js`:

```javascript
// Render book labels as HTML overlays

export function createBookLabels(verses, container) {
  // Group verses by book to find column positions
  const books = {};
  for (const v of verses) {
    if (!books[v.book]) {
      books[v.book] = { minX: v.x, maxX: v.x + v.size };
    }
    books[v.book].maxX = Math.max(books[v.book].maxX, v.x + v.size);
  }

  const labels = document.createElement('div');
  labels.id = 'book-labels';
  labels.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;';

  for (const [name, pos] of Object.entries(books)) {
    const label = document.createElement('div');
    label.textContent = name;
    label.style.cssText = `
      position:absolute;
      color:#666;
      font-family:sans-serif;
      font-size:12px;
      transform:translateX(-50%);
    `;
    label.dataset.bookName = name;
    label.dataset.centerX = (pos.minX + pos.maxX) / 2;
    labels.appendChild(label);
  }

  container.appendChild(labels);
  return labels;
}

export function updateLabelPositions(labelsContainer, pan, zoom) {
  for (const label of labelsContainer.children) {
    const centerX = parseFloat(label.dataset.centerX);
    const screenX = (centerX + pan.x) * zoom;
    label.style.left = screenX + 'px';
    label.style.top = '30px';
  }
}
```

**Step 3: Test and commit**

```bash
git add src/
git commit -m "feat: center visualization and add book labels"
```

---

## Summary

After completing all tasks, you will have:
- WebGL visualization of all 5,845 Torah verses
- Books as columns, chapters as rows, verses as squares
- Zoom with mouse wheel
- Pan with mouse drag
- Hover shows verse reference
- Centered on load with book labels

The substrate is ready for color overlays in future work.
