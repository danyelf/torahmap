// Every panel: its title, which a phone shows and a desktop leaves to the
// column's header, then its body. Controls in a panel take a shared class.
import './styles/controls.css';
import { PANEL_TITLES, type Panel } from './frame.ts';
import { escapeHtml } from './utils/html.ts';

/** The control classes every panel shares (src/styles/controls.css). */
export const CONTROL = {
  button: 'control-button',
  quiet: 'control-button quiet',
  toggle: 'control-toggle',
  icon: 'control-icon',
  select: 'control-select',
} as const;

export function panelHtml(panel: Panel, body: string): string {
  return `<h2 class="panel-title">${escapeHtml(PANEL_TITLES[panel])}</h2>${body}`;
}
