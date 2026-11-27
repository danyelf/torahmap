// The folders' boxes and the files' shades behind the bars, and the folder and file names over
// them, held to a size on screen. Over a file, its box and the folders that hold it light up and
// their names show, whatever the zoom.

import type { ScreenPoint, WorldBox } from '@torahmap/engine';
import type { Focus } from '@torahmap/shell/overlays/types.ts';
import type { CodeItem, CodeLayout, FolderBox } from './layout.ts';
import { placeNames, type Name } from './names.ts';
import { edgeWidth } from './zoomedOut.ts';

const FOLDER_TINT = '150,170,205';
const FILE_SHADE = 'rgba(190,205,230,0.075)';
const FILE_LIT = 'rgba(190,205,230,0.2)';
const EDGE_LIT = 'rgba(205,220,245,0.95)';
const NAME_BACKGROUND = 'rgba(40,46,56,0.92)';
const NAME_PAD = 4; // pixels either side of a name's text

const folderFont = (depth: number) => (depth <= 1 ? 15 : depth === 2 ? 13 : 11);
const FILE_FONT = 10;
const nameHeight = (fontSize: number) => Math.round(fontSize * 1.4);

const tint = (alpha: number) => `rgba(${FOLDER_TINT},${alpha})`;
const edgeColor = (depth: number) => tint(depth === 1 ? 0.45 : 0.3);

function boxElement(css: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;box-sizing:border-box;${css}`;
  return el;
}

function nameElement(text: string, fontSize: number, css: string): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position:absolute;
    padding:0 ${NAME_PAD}px;
    font:${fontSize}px/${nameHeight(fontSize)}px var(--text-font);
    white-space:nowrap;
    ${css}
  `;
  return el;
}

function place(el: HTMLElement, box: WorldBox, zoom: number): void {
  el.style.left = `${box.minX * zoom}px`;
  el.style.top = `${box.minY * zoom}px`;
  el.style.width = `${(box.maxX - box.minX) * zoom}px`;
  el.style.height = `${(box.maxY - box.minY) * zoom}px`;
}

const holds = (outer: WorldBox, inner: WorldBox) =>
  outer.minX <= inner.minX &&
  outer.minY <= inner.minY &&
  outer.maxX >= inner.maxX &&
  outer.maxY >= inner.maxY;

export function createCodeLabels(
  { folders, files }: CodeLayout,
  container: HTMLElement,
): (pan: ScreenPoint, zoom: number, focus: Focus<CodeItem>) => void {
  const layer = document.createElement('div');
  layer.id = 'codemap-labels';

  const folderBoxes = folders.map((folder) => {
    const fill = folder.depth === 1 ? 0.07 : 0.05;
    const el = boxElement(`background:${tint(fill)};border:1px solid ${edgeColor(folder.depth)}`);
    const tab = boxElement(`left:0;right:0;top:0;background:${tint(0.06)}`);
    el.append(tab);
    return { el, tab, folder };
  });
  const shades = files.map((file) => ({ el: boxElement(`background:${FILE_SHADE}`), box: file }));
  const boxOfFile = new Map(files.map((box, i) => [box.file, i]));

  const named = [
    ...folders.map((folder) => {
      const fontSize = folderFont(folder.depth);
      const el = nameElement(
        `${folder.name}/`,
        fontSize,
        `font-weight:600;color:${folder.depth === 1 ? '#eef0f3' : '#c9cfd8'};background:${NAME_BACKGROUND}`,
      );
      el.className = 'folder-name';
      const name: Omit<Name, 'width'> = {
        x: folder.minX,
        y: folder.minY,
        dy: 0,
        height: nameHeight(fontSize),
        minY: folder.minY,
        maxX: folder.maxX,
        maxY: folder.maxY,
        moves: true,
      };
      return { el, fontSize, weight: 600, name };
    }),
    ...files.map((file) => {
      const el = nameElement(file.name, FILE_FONT, `color:#aeb5bf;background:${NAME_BACKGROUND}`);
      el.className = 'file-name';
      const height = nameHeight(FILE_FONT);
      const name: Omit<Name, 'width'> = {
        x: file.minX,
        y: file.minY,
        dy: 0,
        height,
        minY: file.minY,
        maxX: file.maxX,
        maxY: file.maxY,
        moves: false,
      };
      return { el, fontSize: FILE_FONT, weight: 400, name };
    }),
  ];

  layer.append(
    ...folderBoxes.map((b) => b.el),
    ...shades.map((s) => s.el),
    ...named.map((n) => n.el),
  );
  container.append(layer);

  // Measured in the labels' font, and again once it has loaded: in the fallback face a name is
  // the wrong length.
  let names: Name[] = [];
  function measure(): void {
    const context = document.createElement('canvas').getContext('2d')!;
    const family = getComputedStyle(container).getPropertyValue('--text-font');
    names = named.map(({ el, fontSize, weight, name }) => {
      context.font = `${weight} ${fontSize}px ${family}`;
      return { ...name, width: context.measureText(el.textContent ?? '').width + 2 * NAME_PAD };
    });
    placedAt = NaN;
  }
  let placedAt = NaN;
  let tops: (number | null)[] = [];
  measure();
  document.fonts.addEventListener('loadingdone', measure);

  /** The file box under the focus and the folders that hold it, outermost first, as places in `named`. */
  function pathOf(item: CodeItem | null): number[] {
    const at = item && boxOfFile.get(item.file);
    if (at === undefined || at === null) return [];
    const box = files[at];
    const outer = folders.flatMap((folder: FolderBox, i) => (holds(folder, box) ? [i] : []));
    return [...outer, folders.length + at];
  }

  function showName(i: number, top: number | null, zoom: number): void {
    const { el } = named[i];
    el.style.display = top === null ? 'none' : '';
    if (top === null) return;
    el.style.left = `${names[i].x * zoom}px`;
    el.style.top = `${top}px`;
  }

  let lit: number[] = [];
  function light(path: number[], on: boolean, zoom: number): void {
    for (const i of path) {
      if (i < folders.length) {
        const { el, folder } = folderBoxes[i];
        el.style.borderColor = on ? EDGE_LIT : edgeColor(folder.depth);
      } else {
        shades[i - folders.length].el.style.background = on ? FILE_LIT : FILE_SHADE;
      }
      if (!on) showName(i, tops[i], zoom);
    }
    if (!on) return;
    // Each name on the path below the one above it, so the path reads top to bottom.
    let below = -Infinity;
    for (const i of path) {
      const top = Math.max(names[i].y * zoom, below);
      showName(i, top, zoom);
      named[i].el.style.zIndex = '1';
      below = top + names[i].height;
    }
  }

  return (pan, zoom, { hovered, pinned }) => {
    layer.style.transform = `translate(${pan.x * zoom}px, ${pan.y * zoom}px)`;
    const path = pathOf(hovered ?? pinned);
    const moved = zoom !== placedAt;
    if (!moved && path.join() === lit.join()) return;
    light(lit, false, zoom);
    for (const i of lit) named[i].el.style.zIndex = '';
    if (moved) {
      placedAt = zoom;
      for (const { el, tab, folder } of folderBoxes) {
        place(el, folder, zoom);
        tab.style.height = `${folder.strip * zoom}px`;
        el.style.borderWidth = `${edgeWidth(folder.depth, zoom)}px`;
      }
      for (const { el, box } of shades) place(el, box, zoom);
      tops = placeNames(names, zoom);
      tops.forEach((top, i) => showName(i, top, zoom));
    }
    light(path, true, zoom);
    lit = path;
  };
}
