import { NO_OVERLAY } from '@torahmap/overlay-catalog';
import { CONTROL, panelHtml } from './panel.ts';

/**
 * The picker, then whatever the chosen overlay draws, or with None the places
 * to start. main.ts fills the picker, after None, with the overlays
 * @torahmap/overlay-catalog offers.
 */
export function overlayPanelHtml(): string {
  return panelHtml(
    'overlay',
    `<div class="panel-picker">
      <label for="overlay-select">Overlay</label>
      <select id="overlay-select" class="${CONTROL.select}">
        <option value="${NO_OVERLAY}">None</option>
      </select>
      <p id="overlay-description"></p>
    </div>
    <div id="overlay-starts"></div>
    <div id="overlay-controls"></div>
    <div id="overlay-legend"></div>`,
  );
}

export function searchPanelHtml(): string {
  return panelHtml('search', '<div id="search-controls"></div>');
}
