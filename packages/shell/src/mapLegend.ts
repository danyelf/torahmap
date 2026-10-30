// The legend on the map: a row for each tool that is on, each opening its
// panel, with a × that turns it off.
import { summaryHtml } from './panelSummary.ts';
import type { OverlaySummary } from './overlays/types.ts';
import type { FrontTool } from './frame.ts';

export interface LegendRow {
  panel: FrontTool;
  name: string;
  summary: OverlaySummary;
  /** The tool is picked but its files are on their way. */
  loading?: boolean;
}

const closeLabel = (row: LegendRow): string =>
  row.panel === 'search' ? 'Clear the search' : `Turn off ${row.name}`;

const ROW_BUTTONS =
  '<button class="map-legend-open" type="button">' +
  '<span class="map-legend-summary"></span><span class="chevron" aria-hidden="true"></span>' +
  '</button><button class="map-legend-close control-icon" type="button">×</button>';

/**
 * Show `rows` in the legend's own order, search above overlay, and
 * `warnings` under them; with neither, hide the card.
 */
export function showLegend(
  legend: HTMLElement,
  rows: readonly LegendRow[],
  warnings: readonly Node[],
): void {
  for (const element of legend.querySelectorAll<HTMLElement>('.map-legend-row')) {
    const row = rows.find((r) => r.panel === element.dataset.panel);
    element.hidden = !row;
    element.toggleAttribute('data-loading', !!row?.loading);
    if (row) {
      if (!element.firstChild) element.innerHTML = ROW_BUTTONS;
      element.querySelector('.map-legend-summary')!.innerHTML = summaryHtml(row.name, row.summary);
      element.querySelector('.map-legend-close')!.setAttribute('aria-label', closeLabel(row));
    }
  }
  const line = legend.querySelector<HTMLElement>('.map-legend-warning');
  if (line) {
    line.replaceChildren(...warnings);
    line.hidden = warnings.length === 0;
  }
  legend.hidden = rows.length === 0 && warnings.length === 0;
}
