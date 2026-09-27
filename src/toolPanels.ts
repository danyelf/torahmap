import { CONTROL, panelHtml } from './panel.ts';

/**
 * The picker, then whatever the chosen overlay draws. main.ts fills the picker
 * from the registry, after None: the registry is the only list of overlays.
 */
export function overlayPanelHtml(): string {
  return panelHtml(
    'overlay',
    `<div class="panel-picker">
      <label for="overlay-select">Overlay</label>
      <select id="overlay-select" class="${CONTROL.select}">
        <option value="none">None</option>
      </select>
      <p id="overlay-description"></p>
    </div>
    <div id="overlay-controls"></div>
    <div id="overlay-legend"></div>`,
  );
}
