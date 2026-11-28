// Every panel: its title, which a phone shows and a desktop leaves to the
// column's header, then its body. Controls in a panel take a shared class.
import { escapeHtml } from '@torahmap/utils';
import './styles/controls.css';
import { PANEL_TITLES, type Panel } from './frame.ts';

/** The control classes every panel shares (styles/controls.css). */
export const CONTROL = {
  button: 'control-button',
  quiet: 'control-button quiet',
  segments: 'control-segments',
  segment: 'control-segment',
  icon: 'control-icon',
  select: 'control-select',
  input: 'control-input',
} as const;

/** A 16-pixel icon from one SVG path, hidden from screen readers. */
export const icon = (path: string): string =>
  `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${path}"/></svg>`;

export function panelHtml(panel: Panel, body: string): string {
  return `<h2 class="panel-title">${escapeHtml(PANEL_TITLES[panel])}</h2>${body}`;
}
