// The one line that stands for the controls while the story is open: the
// overlay's name, what it is set to, and its colours.
//
// Built from what every overlay already has — its name, its URL settings and
// the colours it has drawn into the panel — so no overlay needs to know the
// line exists.
import { escapeHtml } from './utils/html.ts';

const MAX_SWATCHES = 6;

// Haftarah's colours only tell one reading from the next; out of the map they
// say nothing, so its line is just its name.
const NAME_ONLY = new Set(['haftarah']);

/** The inline backgrounds drawn in a container, skipping any hidden swatch. */
export function drawnColors(container: Element | null, selector = '[style]'): string[] {
  if (!container) return [];
  const colors: string[] = [];
  for (const el of container.querySelectorAll<HTMLElement>(selector)) {
    if (el.style.visibility === 'hidden') continue;
    const background = el.style.background || el.style.backgroundImage || el.style.backgroundColor;
    if (background) colors.push(background);
  }
  return colors;
}

/** A gradient gets a strip: squeezed into a square it reads as one colour. */
function swatch(color: string): string {
  const shape = color.includes('gradient') ? ' strip' : '';
  return `<i class="summary-swatch${shape}" style="background: ${escapeHtml(color)}"></i>`;
}

/**
 * Search's terms are shown as words in their own colours: `termColors` are the
 * swatches of its non-empty term rows, which run in the same order as `q`.
 * Every other overlay shows its settings as text and its legend's colours.
 */
export function summaryHtml(
  overlayId: string,
  overlayName: string | undefined,
  params: Record<string, string>,
  termColors: string[],
  legendColors: string[],
): string {
  if (overlayId === 'none' || !overlayName) {
    return '<span class="summary-name dim">No overlay</span>';
  }
  if (NAME_ONLY.has(overlayId)) {
    return `<span class="summary-name">${escapeHtml(overlayName)}</span>`;
  }

  let detail = '';
  if (params.q) {
    detail = params.q
      .split(',')
      .map((term) => term.trim())
      .filter(Boolean)
      .map((term, i) => {
        const color = termColors[i];
        return `<span class="summary-term">${color ? swatch(color) : ''}${escapeHtml(term)}</span>`;
      })
      .join('');
  } else {
    const values = Object.values(params).filter(Boolean);
    if (values.length) {
      detail = `<span class="summary-detail">${escapeHtml(values.join(', '))}</span>`;
    }
    const swatches = legendColors.slice(0, MAX_SWATCHES).map(swatch).join('');
    if (swatches) detail += `<span class="summary-swatches">${swatches}</span>`;
  }

  return (
    `<span class="summary-name">${escapeHtml(overlayName)}</span>` +
    (detail ? `<span class="summary-sep">·</span>${detail}` : '')
  );
}
