// The legend on the map: a row for each tool that is on, each opening its panel.
import { summaryHtml } from './panelSummary.ts';
import type { OverlaySummary } from './overlays/types.ts';

export interface LegendRow {
  panel: 'search' | 'overlay';
  name: string;
  summary: OverlaySummary;
}

/** Show `rows` in the legend's own order, search above overlay; with none, hide the card. */
export function showLegend(legend: HTMLElement, rows: readonly LegendRow[]): void {
  for (const button of legend.querySelectorAll<HTMLElement>('.map-legend-row')) {
    const row = rows.find((r) => r.panel === button.dataset.panel);
    button.hidden = !row;
    if (row) {
      button.querySelector('.map-legend-summary')!.innerHTML = summaryHtml(row.name, row.summary);
    }
  }
  legend.hidden = rows.length === 0;
}
