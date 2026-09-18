// The one line that stands for the controls while the story is open: the
// overlay's name and what its own `summary` says it is showing.
import { escapeHtml } from './utils/html.ts';
import type { OverlaySummary } from './overlays/types.ts';

const MAX_SWATCHES = 6;

/** A gradient gets a strip: squeezed into a square it reads as one colour. */
function swatch(color: string): string {
  const shape = color.includes('gradient') ? ' strip' : '';
  return `<i class="summary-swatch${shape}" style="background: ${escapeHtml(color)}"></i>`;
}

export function summaryHtml(overlayName: string | undefined, summary: OverlaySummary): string {
  if (!overlayName) return '<span class="summary-name dim">No overlay</span>';

  let detail = (summary.terms ?? [])
    .map(
      ({ text, color }) => `<span class="summary-term">${swatch(color)}${escapeHtml(text)}</span>`,
    )
    .join('');
  if (summary.detail) {
    detail += `<span class="summary-detail">${escapeHtml(summary.detail)}</span>`;
  }
  const swatches = (summary.colors ?? []).slice(0, MAX_SWATCHES).map(swatch).join('');
  if (swatches) detail += `<span class="summary-swatches">${swatches}</span>`;

  return (
    `<span class="summary-name">${escapeHtml(overlayName)}</span>` +
    (detail ? `<span class="summary-sep">·</span>${detail}` : '')
  );
}
