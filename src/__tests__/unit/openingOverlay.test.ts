import { describe, it, expect } from 'vitest';
import type { Story, StoryStop } from '@torahmap/stories';
import { openingOverlay } from '../../viewState';

const stop = (id: string, overlay: string | null): StoryStop => ({
  id,
  text: '',
  camera: 'initial',
  overlay,
});
const tour: Story = {
  id: 'tour',
  data: {
    title: 'Tour',
    description: '',
    draft: false,
    stops: [stop('intro', null), stop('haftarot', 'haftarah')],
  },
};

describe('openingOverlay', () => {
  it('is none for a bare address opening a plain stop', () => {
    expect(openingOverlay({ overlayParams: {} }, tour)).toBeNull();
  });

  it('is none for a view that names no overlay, even with a search or a pinned verse', () => {
    const link = { overlayParams: {}, verse: 'Genesis.12.1', searchParams: { search: 'אור' } };
    expect(openingOverlay(link, tour)).toBeNull();
  });

  it('is the overlay a view names', () => {
    expect(openingOverlay({ overlay: 'commentary', overlayParams: {} }, tour)).toBe('commentary');
  });

  it('is the overlay of the stop a link opens', () => {
    expect(openingOverlay({ story: 'tour', stop: 'haftarot', overlayParams: {} }, tour)).toBe(
      'haftarah',
    );
  });
});
