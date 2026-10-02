import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as data from '../../../search/data';
import { searchTool } from '../../../overlays/search/index';
import { hostOverlay } from '../../helpers/overlayHost';
import { searchDataFor } from '../../helpers/searchData';
import { typeInSearch } from '../../helpers/searchOverlay';

vi.mock('../../../search/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../search/data')>();
  return {
    ...actual,
    textIndexOf: vi.fn(actual.textIndexOf),
    dictionaryOf: vi.fn(actual.dictionaryOf),
  };
});

const texts = { Genesis: { '1': { '1': { he: 'בראשית ברא', en: 'In the beginning' } } } };

describe('the search panel with its data', () => {
  beforeEach(() => {
    searchTool.destroy?.();
    vi.mocked(data.textIndexOf).mockClear();
    vi.mocked(data.dictionaryOf).mockClear();
  });

  it('builds neither the text index nor the dictionary while no word is typed', () => {
    const host = hostOverlay(searchTool, searchDataFor(texts));
    host.renderControls();

    expect(data.textIndexOf).not.toHaveBeenCalled();
    expect(data.dictionaryOf).not.toHaveBeenCalled();
  });

  it('builds them once a word is typed', () => {
    const host = hostOverlay(searchTool, searchDataFor(texts));
    const panel = host.renderControls();
    typeInSearch(panel, 'beginning');

    expect(data.textIndexOf).toHaveBeenCalled();
    expect(data.dictionaryOf).toHaveBeenCalled();
  });
});
