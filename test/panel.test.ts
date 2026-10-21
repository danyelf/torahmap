import { describe, it, expect } from 'vitest';
import { CONTROL, panelHtml } from '../packages/shell/src/panel.ts';
import { PANEL_TITLES, type Panel } from '../packages/shell/src/frame.ts';
import { storiesHtml } from '../packages/shell/src/storiesPanel.ts';
import { aboutHtml } from '../packages/shell/src/aboutPanel.ts';
import { tanakhSite } from '@torahmap/tanakh/site.ts';
import { overlayPanelHtml, searchPanelHtml } from '../packages/shell/src/toolPanels.ts';
import { goToPanelHtml } from '../packages/shell/src/goTo.ts';

function parse(html: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

const SHARED = Object.values(CONTROL).flatMap((names) => names.split(' '));

describe('panelHtml', () => {
  it('heads the body with the panel title', () => {
    const div = parse(panelHtml('stories', '<p>body</p>'));
    expect(div.firstElementChild?.matches('h2.panel-title')).toBe(true);
    expect(div.firstElementChild?.textContent).toBe(PANEL_TITLES.stories);
    expect(div.querySelector('p')?.textContent).toBe('body');
  });
});

describe('every panel is built by panelHtml, with shared controls', () => {
  const panels: [Panel, string][] = [
    ['goto', goToPanelHtml(['Genesis 2:2'])],
    ['overlay', overlayPanelHtml()],
    [
      'stories',
      storiesHtml([
        {
          id: 'tour',
          title: 'x',
          description: 'x',
          draft: false,
          place: { number: 1, total: 2, label: 'x' },
        },
      ]),
    ],
    ['about', aboutHtml(tanakhSite, [], true, ['Genesis 1'])],
  ];

  it('search opens with its title', () => {
    const first = parse(searchPanelHtml()).firstElementChild;
    expect(first?.matches('h2.panel-title')).toBe(true);
    expect(first?.textContent).toBe(PANEL_TITLES.search);
  });

  for (const [panel, html] of panels) {
    it(`${panel} opens with its title`, () => {
      const first = parse(html).firstElementChild;
      expect(first?.matches('h2.panel-title')).toBe(true);
      expect(first?.textContent).toBe(PANEL_TITLES[panel]);
    });

    it(`${panel}'s buttons and selects take a shared control class`, () => {
      const controls = [...parse(html).querySelectorAll('button, select')];
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(
          SHARED.some((name) => control.classList.contains(name)),
          control.outerHTML,
        ).toBe(true);
      }
    });
  }
});
