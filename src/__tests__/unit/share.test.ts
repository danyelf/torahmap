import { describe, it, expect, vi } from 'vitest';
import { shareLink, closeAfterConfirming } from '../../share';

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

describe('closeAfterConfirming', () => {
  it('closes the menu once the confirmation has shown', () => {
    vi.useFakeTimers();
    const close = vi.fn();
    closeAfterConfirming(() => true, close, 1500);
    vi.advanceTimersByTime(1499);
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(close).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('leaves alone a menu the reader already closed', () => {
    vi.useFakeTimers();
    const close = vi.fn();
    closeAfterConfirming(() => false, close, 1500);
    vi.advanceTimersByTime(1500);
    expect(close).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('leaves alone a menu reopened since, even though it reports open, because its item is gone', () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const item = document.createElement('button');
    document.body.appendChild(item);
    const menuOpen = true;
    closeAfterConfirming(() => menuOpen && item.isConnected, close, 1500);
    item.remove(); // reopening the menu redraws it, detaching the confirmed item
    vi.advanceTimersByTime(1500);
    expect(close).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
