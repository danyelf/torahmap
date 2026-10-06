import { describe, expect, it } from 'vitest';
import { createPopupHold } from '../../popupHold';

describe('the popup hold', () => {
  it('holds the popup until every hold is released', () => {
    const popup = createPopupHold();
    const release = popup.hold();
    const another = popup.hold();
    expect(popup.held()).toBe(true);

    release();
    expect(popup.held()).toBe(true);
    another();
    expect(popup.held()).toBe(false);
  });

  it('counts a hold released twice once', () => {
    const popup = createPopupHold();
    const release = popup.hold();
    const another = popup.hold();
    release();
    release();
    expect(popup.held()).toBe(true);
    another();
    expect(popup.held()).toBe(false);
  });
});
