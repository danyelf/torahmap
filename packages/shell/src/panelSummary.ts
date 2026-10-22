// A legend row: the overlay's name and what its own `summary` says it is
// showing.
import { escapeHtml } from '@torahmap/utils';
import type { OverlaySummary } from './overlays/types.ts';

const MAX_SWATCHES = 6;

function swatch(color: string, shape = ''): string {
  return `<i class="summary-swatch${shape}" style="background: ${escapeHtml(color)}"></i>`;
}

/** A gradient gets a strip: squeezed into a square it reads as one colour. */
function strip({ gradient, ends }: NonNullable<OverlaySummary['strip']>): string {
  const [low, high] = ends.map((end) => `<span class="summary-end">${escapeHtml(end)}</span>`);
  return low + swatch(gradient, ' strip') + high;
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
  const squares = (summary.colors ?? []).slice(0, MAX_SWATCHES).map((color) => swatch(color));
  const swatches = (summary.strip ? strip(summary.strip) : '') + squares.join('');
  if (swatches) detail += `<span class="summary-swatches">${swatches}</span>`;

  return (
    `<span class="summary-name">${escapeHtml(overlayName)}</span>` +
    (detail ? `<span class="summary-sep">·</span>${detail}` : '')
  );
}
