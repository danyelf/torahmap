// The search's data is held back in this file until a test lets it in.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { searchTool, adoptLoadedMeanings } from '../../../overlays/search/index';
import { buildSearchIndex } from '../../../search';
import { ready } from '../../../dataLoading';
import { hostOverlay } from '../../helpers/overlayHost';
import { renderSearchControls, typeInSearch } from '../../helpers/searchOverlay';
import { SEARCH_RECORD_DELAY_MS } from '../../../search/constants';
import { configureAnalytics } from '../../../analytics.ts';

const search = hostOverlay(searchTool);

let letDataIn!: () => void;
vi.spyOn(searchTool, 'init').mockImplementation(() => new Promise<void>((r) => (letDataIn = r)));

afterEach(() => {
  vi.useRealTimers();
  configureAnalytics({ enabled: false });
  search.restore({ search: '' });
});

describe('the search panel before its data arrives', () => {
  it('shows no count, rather than one of nothing', () => {
    const container = renderSearchControls(search);
    typeInSearch(container, 'אור');

    expect(container.querySelector('#search-hit-caption')!.textContent).toBe('');
    expect(container.querySelector('.term-count')!.textContent).toBe('');
  });

  it('records a word typed early once the data is in, with what it finds', async () => {
    const send = vi.fn<(body: string) => void>();
    configureAnalytics({ enabled: true, send });
    vi.useFakeTimers();
    const container = renderSearchControls(search);
    typeInSearch(container, 'אור');
    vi.advanceTimersByTime(SEARCH_RECORD_DELAY_MS);
    expect(send).not.toHaveBeenCalled();

    const arrived = ready(searchTool);
    buildSearchIndex({
      Genesis: { 1: { 3: { he: 'ויאמר אלהים יהי אור', en: 'let there be light' } } },
    });
    letDataIn();
    await arrived;
    search.change(adoptLoadedMeanings);
    vi.advanceTimersByTime(SEARCH_RECORD_DELAY_MS);

    expect(send).toHaveBeenCalledTimes(1);
    const { fields } = JSON.parse(send.mock.calls[0][0]);
    expect(fields.term).toBe('אור');
    expect(fields.result_count).toBe(1);
  });
});
