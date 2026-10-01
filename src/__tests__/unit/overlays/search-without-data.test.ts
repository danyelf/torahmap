import { describe, it, expect } from 'vitest';
import { searchTool } from '../../../overlays/search/index';
import { hostOverlay } from '../../helpers/overlayHost';
import { realSearchData } from '../../helpers/searchData';

describe('the search panel without its data', () => {
  it('shows the terms as typed and their modes, and nothing looked up', () => {
    const host = hostOverlay(searchTool, null);
    host.restore({ search: 'עלה, light', mode: 'm,w' });
    const panel = host.renderControls();

    expect(panel.querySelector<HTMLInputElement>('.term-input')!.value).toBe('עלה');
    expect(panel.querySelector('.term-row[data-open="true"] .term-mode-option.on')).not.toBeNull();
    expect(panel.querySelectorAll('.meaning-row')).toHaveLength(0);
    expect([...panel.querySelectorAll('.term-count')].map((c) => c.textContent)).toEqual(['', '']);
    expect(panel.querySelector('#search-hit-caption')!.textContent).toBe('');
    expect(panel.querySelector('#search-results')!.classList.contains('visible')).toBe(false);
  });

  it('fills in the meanings, counts and results once it is handed the data', () => {
    const host = hostOverlay(searchTool, null);
    host.restore({ search: 'עלה' });
    const panel = host.renderControls();

    host.setData(realSearchData().files);

    expect(panel.querySelectorAll('.meaning-row').length).toBeGreaterThan(1);
    expect(panel.querySelector('.term-count')!.textContent).not.toBe('');
    expect(panel.querySelector('#search-results')!.classList.contains('visible')).toBe(true);
  });
});
