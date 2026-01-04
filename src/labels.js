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
