import { describe, it, expect, vi } from 'vitest';
import { shareLink } from '../../share';

const url = 'https://torahmap.org/?verse=Genesis.12.1';

describe('shareLink', () => {
  it('copies on a screen without a share sheet', async () => {
    const writeText = vi.fn(async () => {});
    expect(await shareLink(url, 't', { writeText, coarsePointer: false })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it('copies with a mouse even where a share sheet exists', async () => {
    const share = vi.fn(async () => {});
    const writeText = vi.fn(async () => {});
    expect(await shareLink(url, 't', { share, writeText, coarsePointer: false })).toBe('copied');
    expect(share).not.toHaveBeenCalled();
  });

  it('opens the share sheet on a touch screen', async () => {
    const share = vi.fn(async () => {});
    expect(
      await shareLink(url, 'Genesis 12:1 · Torahmap', {
        share,
        writeText: vi.fn(),
        coarsePointer: true,
      }),
    ).toBe('share_sheet');
    expect(share).toHaveBeenCalledWith({ url, title: 'Genesis 12:1 · Torahmap' });
  });

  it('reports a share sheet the reader backed out of', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('', 'AbortError');
    });
    expect(await shareLink(url, 't', { share, writeText: vi.fn(), coarsePointer: true })).toBe(
      'cancelled',
    );
  });

  it('copies when the share sheet refuses', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('', 'NotAllowedError');
    });
    const writeText = vi.fn(async () => {});
    expect(await shareLink(url, 't', { share, writeText, coarsePointer: true })).toBe('copied');
  });

  it('fails when the copy fails', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    expect(await shareLink(url, 't', { writeText, coarsePointer: false })).toBe('failed');
  });

  it('fails when there is no Clipboard API to call, as outside a secure context', async () => {
    const insecureNavigator = {} as Navigator; // no `clipboard` property at all
    const writeText = (t: string) => insecureNavigator.clipboard.writeText(t);
    expect(await shareLink(url, 't', { writeText, coarsePointer: false })).toBe('failed');
  });
});
