// The folders' boxes and the files' shades behind the bars, and the folder and file names over
// them, held to a size on screen.

import type { ScreenPoint, WorldBox } from '@torahmap/engine';
import { NAME_STRIP, SHADE_REACH, FILE_GAP, tabHeight } from './constants.ts';
import type { CodeLayout } from './layout.ts';
import { placeNames, type Name } from './names.ts';

const FOLDER_TINT = '150,170,205';
const FILE_SHADE = 'rgba(190,205,230,0.075)';
const NAME_BACKGROUND = 'rgba(40,46,56,0.92)';
const NAME_PAD = 4; // pixels either side of a name's text

const folderFont = (depth: number) => (depth <= 1 ? 15 : depth === 2 ? 13 : 11);
const FILE_FONT = 10;
const nameHeight = (fontSize: number) => Math.round(fontSize * 1.4);

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

export function createCodeLabels(
  { folders, files }: CodeLayout,
  container: HTMLElement,
): (pan: ScreenPoint, zoom: number) => void {
  const layer = document.createElement('div');
  layer.id = 'codemap-labels';

  const folderBoxes = folders.map((folder) => {
    const tint = (alpha: number) => `rgba(${FOLDER_TINT},${alpha})`;
    const fill = folder.depth === 1 ? 0.07 : 0.05;
    const el = boxElement(
      `background:${tint(fill)};border:1px solid ${tint(folder.depth === 1 ? 0.45 : 0.3)}`,
    );
    const tab = boxElement(`left:0;right:0;top:0;background:${tint(0.06)}`);
    el.append(tab);
    return { el, tab, folder };
  });
  const shades = files.map((file) => ({
    el: boxElement(`background:${FILE_SHADE}`),
    box: {
      minX: file.minX - SHADE_REACH,
      minY: file.minY - NAME_STRIP - SHADE_REACH,
      maxX: file.maxX + SHADE_REACH,
      maxY: file.maxY + SHADE_REACH,
    },
  }));

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
      const el = nameElement(file.name, FILE_FONT, 'color:#aeb5bf');
      el.className = 'file-name';
      const height = nameHeight(FILE_FONT);
      const name: Omit<Name, 'width'> = {
        x: file.minX,
        y: file.minY,
        dy: -height,
        height,
        minY: file.minY - NAME_STRIP,
        maxX: file.maxX + FILE_GAP,
        maxY: file.minY,
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
  measure();
  document.fonts.addEventListener('loadingdone', measure);

  return (pan, zoom) => {
    layer.style.transform = `translate(${pan.x * zoom}px, ${pan.y * zoom}px)`;
    if (zoom === placedAt) return;
    placedAt = zoom;
    for (const { el, tab, folder } of folderBoxes) {
      place(el, folder, zoom);
      tab.style.height = `${tabHeight(folder.depth) * zoom}px`;
    }
    for (const { el, box } of shades) place(el, box, zoom);
    const tops = placeNames(names, zoom);
    named.forEach(({ el }, i) => {
      const top = tops[i];
      el.style.display = top === null ? 'none' : '';
      if (top === null) return;
      el.style.left = `${names[i].x * zoom}px`;
      el.style.top = `${top}px`;
    });
  };
}
