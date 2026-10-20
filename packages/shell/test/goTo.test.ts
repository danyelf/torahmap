import { describe, it, expect } from 'vitest';
import { drawGoToAnswer, goToHtml, GO_TO, GO_TO_BOX_ID } from '../src/goTo.ts';

const found = { ref: 'I Samuel 3:17', ids: ['I.Samuel.3.17'] };

function answer(view: Parameters<typeof drawGoToAnswer>[1]): HTMLElement {
  const container = document.createElement('div');
  drawGoToAnswer(container, view);
  return container;
}

describe('the go-to box', () => {
  it('keeps what was typed in it', () => {
    const menu = document.createElement('div');
    menu.innerHTML = goToHtml('II Kings 17', '1 Sam "3"');
    expect(menu.querySelector<HTMLInputElement>(`#${GO_TO_BOX_ID}`)!.value).toBe('1 Sam "3"');
  });

  it('answers nothing while empty', () => {
    expect(answer({ typed: '  ', found: null, quote: null }).childElementCount).toBe(0);
  });

  it('offers the place it found, quoting its first square', () => {
    const offer = answer({ typed: '1 sam 3 17', found, quote: 'Then he asked' }).querySelector(
      `[data-action="${GO_TO}"]`,
    );
    expect(offer).not.toBeNull();
    expect(offer!.textContent).toContain(found.ref);
    expect(offer!.textContent).toContain('Then he asked');
  });

  it('offers nothing to take when it finds nothing', () => {
    const none = answer({ typed: 'Genesis 51', found: null, quote: null });
    expect(none.childElementCount).toBe(1);
    expect(none.querySelector(`[data-action="${GO_TO}"]`)).toBeNull();
  });
});
