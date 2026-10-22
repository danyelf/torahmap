// A legend row: the overlay's name and what its own `summary` says it is
// showing.
import { escapeHtml } from '@torahmap/utils';
import type { OverlaySummary } from './overlays/types.ts';

const MAX_SWATCHES = 6;

/** A gradient gets a strip: squeezed into a square it reads as one colour. */
function swatch(color: string): string {
  const shape = color.includes('gradient') ? ' strip' : '';
  return `<i class="summary-swatch${shape}" style="background: ${escapeHtml(color)}"></i>`;
}

export function summaryHtml(overlayName: string, summary: OverlaySummary): string {
  let detail = (summary.terms ?? [])
    .map(
      ({ text, color }) => `<span class="summary-term">${swatch(color)}${escapeHtml(text)}</span>`,
    )
    .join('');
  if (summary.detail) {
    detail += `<span class="summary-detail">${escapeHtml(summary.detail)}</span>`;
  }
  let swatches = (summary.colors ?? []).slice(0, MAX_SWATCHES).map(swatch).join('');
  if (summary.ends) {
    const [low, high] = summary.ends.map(
      (end) => `<span class="summary-end">${escapeHtml(end)}</span>`,
    );
    swatches = low + swatches + high;
  }
  if (swatches) detail += `<span class="summary-swatches">${swatches}</span>`;

  return (
    `<span class="summary-name">${escapeHtml(overlayName)}</span>` +
    (detail ? `<span class="summary-sep">·</span>${detail}` : '')
  );
}
