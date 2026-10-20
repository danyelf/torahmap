// The menu's go-to box: a reference typed there is offered as a place to go,
// quoting its first square, and Enter or a click on the offer goes there.

import { escapeHtml } from '@torahmap/utils';
import type { Reference } from './app/text.ts';
import { CONTROL } from './panel.ts';

export const GO_TO_BOX_ID = 'goto-input';

/** The action a click on the offer takes. */
export const GO_TO = 'goto';

/** The box, holding `typed`, with room under it for the offer. */
export function goToHtml(example: string, typed: string): string {
  return (
    `<div class="goto">` +
    `<label class="goto-label" for="${GO_TO_BOX_ID}">Go to</label>` +
    `<input id="${GO_TO_BOX_ID}" class="goto-input ${CONTROL.input}" type="search" enterkeyhint="go" ` +
    `autocomplete="off" spellcheck="false" placeholder="${escapeHtml(example)}" ` +
    `value="${escapeHtml(typed)}">` +
    `</div>` +
    `<div class="goto-answer" aria-live="polite"></div>`
  );
}

/** What the box answers: nothing while it is empty, the place it names, or that it names none. */
export interface GoToAnswer {
  typed: string;
  found: Reference | null;
  /** The text of the found place's first square, once its file is in. */
  quote: string | null;
}

export function drawGoToAnswer(container: HTMLElement, { typed, found, quote }: GoToAnswer): void {
  if (!typed.trim()) {
    container.replaceChildren();
    return;
  }
  if (!found) {
    container.innerHTML = `<p class="goto-none">Not found</p>`;
    return;
  }
  container.innerHTML =
    `<button type="button" class="goto-offer" data-action="${GO_TO}">` +
    `<span class="goto-ref">${escapeHtml(found.ref)}</span>` +
    `<span class="goto-quote" dir="auto">${escapeHtml(quote ?? '')}</span>` +
    `<kbd class="goto-key">Enter ↵</kbd>` +
    `</button>`;
}
