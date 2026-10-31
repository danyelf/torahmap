// The map's title, painted on the map above the days: it grows and moves exactly as the squares do.

import { TITLE_CORNER, TITLE_HEIGHT } from './layout.ts';
import iconUrl from './vis2026_icon.svg?url';

const SVG = 'http://www.w3.org/2000/svg';

function svgElement(name: string, attributes: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
  return el;
}

/** Draws `name` beside IEEE VIS's icon into `container`; the function returned moves it with the map. */
export function createMapTitle(
  name: string,
  container: HTMLElement,
): (offset: { x: number; y: number }, zoom: number) => void {
  // The viewBox holds the icon and sets the scale; the name runs on past it.
  const svg = svgElement('svg', {
    viewBox: '0 0 100 100',
    overflow: 'visible',
    role: 'img',
    'aria-label': name,
  });
  svg.style.cssText = 'position:absolute;filter:drop-shadow(0 2px 7px #000)';
  const text = svgElement('text', {
    x: '122',
    y: '76',
    'font-size': '76',
    'font-weight': '700',
    fill: '#eee',
  });
  text.style.fontFamily = 'var(--heading-font)';
  text.textContent = name;
  svg.append(svgElement('image', { href: iconUrl, width: '100', height: '100' }), text);
  container.append(svg);

  return (offset, zoom) => {
    const size = String(TITLE_HEIGHT * zoom);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.style.left = `${(TITLE_CORNER.x + offset.x) * zoom}px`;
    svg.style.top = `${(TITLE_CORNER.y + offset.y) * zoom}px`;
  };
}
