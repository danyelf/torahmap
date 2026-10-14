// The legend on the map: a row for each tool that is on, each opening its panel.
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

/**
 * Show `rows` in the legend's own order, search above overlay, and
 * `warnings` under them; with neither, hide the card.
 */
export function showLegend(
  legend: HTMLElement,
  rows: readonly LegendRow[],
  warnings: readonly Node[],
): void {
  for (const button of legend.querySelectorAll<HTMLElement>('.map-legend-row')) {
    const row = rows.find((r) => r.panel === button.dataset.panel);
    button.hidden = !row;
    button.toggleAttribute('data-loading', !!row?.loading);
    if (row) {
      button.querySelector('.map-legend-summary')!.innerHTML = summaryHtml(row.name, row.summary);
    }
  }
  const line = legend.querySelector<HTMLElement>('.map-legend-warning');
  if (line) {
    line.replaceChildren(...warnings);
    line.hidden = warnings.length === 0;
  }
  legend.hidden = rows.length === 0 && warnings.length === 0;
}
