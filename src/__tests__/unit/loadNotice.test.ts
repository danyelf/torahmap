import { describe, it, expect, vi } from 'vitest';
import { loadNotice } from '../../loadNotice';

describe('loadNotice', () => {
  it('says a file is loading, with nothing to close', () => {
    const notice = loadNotice('loading', () => {});
    expect(notice.dataset.state).toBe('loading');
    expect(notice.querySelector('button')).toBeNull();
  });

  it('warns that a file failed, and closes when its × is pressed', () => {
    const onClose = vi.fn();
    const notice = loadNotice('failed', onClose);
    expect(notice.dataset.state).toBe('failed');
    expect(notice.getAttribute('role')).toBe('alert');
    notice.querySelector<HTMLButtonElement>('.load-notice-close')!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
