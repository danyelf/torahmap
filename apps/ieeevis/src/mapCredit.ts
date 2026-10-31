// Who made the map and where its program comes from, painted on the map under the last panel.

import { CREDIT_SIZE } from './layout.ts';
import { IEEEVIS_PAGE } from './page.ts';

const link = (href: string, text: string): string =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

/** The function returned moves the credit with the map. */
export function createMapCredit(
  corner: { x: number; y: number },
  container: HTMLElement,
): (offset: { x: number; y: number }, zoom: number) => void {
  const el = document.createElement('div');
  el.className = 'map-credit';
  el.style.lineHeight = String(CREDIT_SIZE.lineEm);
  el.innerHTML =
    `<div>by Danyel Fisher, ${link('https://danyelfisher.info', 'https://danyelfisher.info')}</div>` +
    `<div>Collected from ${link(IEEEVIS_PAGE.textUrl, 'IEEE VIS Program')} for November 2026 · ` +
    'Titles, authors, sessions and times</div>';
  container.append(el);

  return (offset, zoom) => {
    el.style.fontSize = `${CREDIT_SIZE.fontSize * zoom}px`;
    el.style.left = `${(corner.x + offset.x) * zoom}px`;
    el.style.top = `${(corner.y + offset.y) * zoom}px`;
  };
}
