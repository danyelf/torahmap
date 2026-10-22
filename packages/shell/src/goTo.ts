// The Go to panel: a box for a reference, what the text completes it to, the
// place it names, quoting its first square, and examples to try.

import { escapeHtml } from '@torahmap/utils';
import type { GoTo, Reference } from './app/text.ts';
import { GO_TO_BOX_ID } from './goToBox.ts';
import { CONTROL, panelHtml } from './panel.ts';
import './styles/go-to.css';

const LIST_ID = 'goto-completions';
const optionId = (i: number) => `goto-completion-${i}`;

// The most completions the panel shows at once.
const COMPLETIONS = 10;

// Longer than any reference. Reading takes time that grows with the square of what is typed, so a
// pasted page would hang the tab.
const MOST_TYPED = 60;

export function goToPanelHtml(examples: readonly string[]): string {
  return panelHtml(
    'goto',
    `<input id="${GO_TO_BOX_ID}" class="goto-input ${CONTROL.input}" type="search" ` +
      `maxlength="${MOST_TYPED}" enterkeyhint="go" autocomplete="off" spellcheck="false" ` +
      `dir="auto" aria-label="Reference" role="combobox" aria-autocomplete="list" ` +
      `aria-expanded="false" aria-controls="${LIST_ID}">` +
      `<div id="${LIST_ID}" class="goto-completions" role="listbox"></div>` +
      `<div class="goto-answer" aria-live="polite"></div>` +
      `<div class="goto-examples">` +
      `<p class="goto-examples-label">For example</p>` +
      examples
        .map(
          (example) =>
            `<button type="button" class="${CONTROL.quiet} goto-example" dir="auto" ` +
            `data-example="${escapeHtml(example)}">${escapeHtml(example)}</button>`,
        )
        .join('') +
      `</div>`,
  );
}

/** What the panel asks of the map. */
export interface GoToHooks {
  /** The text of the place's first square, or null while its file is not in. */
  quote(found: Reference, typed: string): string | null;
  take(found: Reference, typed: string): void;
}

/** Wires the panel `goToPanelHtml` drew in `panel`. */
export function bindGoTo(
  panel: HTMLElement,
  goTo: GoTo,
  hooks: GoToHooks,
): { redraw(): void; focus(): void } {
  const box = panel.querySelector<HTMLInputElement>(`#${GO_TO_BOX_ID}`)!;
  const list = panel.querySelector<HTMLElement>(`#${LIST_ID}`)!;
  const answer = panel.querySelector<HTMLElement>('.goto-answer')!;
  const examples = panel.querySelector<HTMLElement>('.goto-examples')!;

  let completions: string[] = [];
  /** The completion the arrow keys are on, or -1. */
  let chosen = -1;

  function drawList(): void {
    list.innerHTML = completions
      .map(
        (name, i) =>
          `<button type="button" id="${optionId(i)}" class="${CONTROL.quiet} goto-completion" ` +
          `role="option" tabindex="-1" dir="auto" aria-selected="${i === chosen}" ` +
          `data-completion="${i}">${escapeHtml(name)}</button>`,
      )
      .join('');
    box.setAttribute('aria-expanded', String(completions.length > 0));
    examples.hidden = completions.length > 0;
    if (chosen >= 0) box.setAttribute('aria-activedescendant', optionId(chosen));
    else box.removeAttribute('aria-activedescendant');
  }

  /** The place the answer offers, if any. */
  let found: Reference | null = null;

  /** What the answer shows, kept so a redraw that changes nothing leaves its button alone. */
  let shown = '';

  function drawAnswer(): void {
    const typed = box.value;
    found = typed.trim() ? goTo.read(typed) : null;
    const html = answerHtml(typed);
    if (html === shown) return;
    shown = html;
    answer.innerHTML = html;
  }

  function answerHtml(typed: string): string {
    if (!typed.trim()) return '';
    // A name still being typed is not yet a miss.
    if (!found) return completions.length ? '' : `<p class="goto-none">Not found</p>`;
    return (
      `<button type="button" class="${CONTROL.button} goto-offer" data-take>` +
      `<span class="goto-ref">${escapeHtml(found.ref)}</span>` +
      `<span class="goto-quote" dir="auto">${escapeHtml(hooks.quote(found, typed) ?? '')}</span>` +
      `<kbd class="goto-key">Enter ↵</kbd>` +
      `</button>`
    );
  }

  function typed(value: string): void {
    box.value = value;
    completions = goTo.complete(value).slice(0, COMPLETIONS);
    chosen = -1;
    drawList();
    drawAnswer();
  }

  function complete(i: number): void {
    typed(`${completions[i]} `);
    box.focus();
  }

  function take(): void {
    if (!found) return;
    // The map takes the keys again, and a phone's keyboard goes down.
    box.blur();
    hooks.take(found, box.value.trim());
  }

  box.addEventListener('input', () => typed(box.value));
  box.addEventListener('keydown', (e) => {
    const showing = completions.length > 0;
    if (showing && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      // The arrows go round the list and back to the box, which counts as one past its end.
      const places = completions.length + 1;
      const at = chosen === -1 ? completions.length : chosen;
      const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + places) % places;
      chosen = next === completions.length ? -1 : next;
      drawList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (chosen >= 0) complete(chosen);
      else take();
    } else if (showing && e.key === 'Escape') {
      // Only the list closes, keeping what was typed, which a search box would clear; the next
      // Escape goes on to the map.
      e.preventDefault();
      e.stopPropagation();
      completions = [];
      chosen = -1;
      drawList();
    }
  });
  panel.addEventListener('click', (e) => {
    const target = e.target as Element;
    const completion = target.closest<HTMLElement>('[data-completion]');
    if (completion) return complete(Number(completion.dataset.completion));
    const example = target.closest<HTMLElement>('[data-example]');
    if (example) return typed(example.dataset.example!);
    if (target.closest('[data-take]')) take();
  });

  return {
    redraw: drawAnswer,
    focus: () => box.focus(),
  };
}
