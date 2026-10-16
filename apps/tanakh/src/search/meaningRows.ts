// The meanings of the open row's term, as checkboxes beneath its mode control,
// and what a collapsed row says about them.
import './meanings.css';
import type { SearchTerm } from '@torahmap/search';
import type { Dictionary, LexemeLanguage } from './search.ts';
import type { Meaning } from './dictionary.ts';
import {
  chosenAmong,
  effectiveMode,
  isNarrowed,
  meaningsOf,
  onlyMeaning,
  toggleMeaning,
} from './meanings.ts';

type Edit = (change: (terms: SearchTerm[]) => SearchTerm[]) => void;

/** ETCBC's parts of speech, short enough to sit beside a gloss. */
const POS_LABELS: Record<string, string> = {
  subs: 'n.',
  nmpr: 'n.pr.',
  verb: 'v.',
  adjv: 'adj.',
  advb: 'adv.',
  intj: 'interj.',
  prep: 'prep.',
  prps: 'pron.',
  inrg: 'interrog.',
  prde: 'dem.',
  conj: 'conj.',
  nega: 'neg.',
  prin: 'interrog.pron.',
  art: 'art.',
};

/**
 * The tag beside a meaning: its part of speech, and its language when that
 * isn't Hebrew — otherwise-identical Hebrew and Aramaic readings would look
 * like duplicates (see the dictionary seam in search/dictionary.ts).
 */
function meaningTag(pos: string, language: LexemeLanguage): string {
  const posLabel = POS_LABELS[pos] ?? pos;
  return language === 'arc' ? `(aram., ${posLabel})` : `(${posLabel})`;
}

function buildMeaningRow(
  term: SearchTerm,
  meaning: Meaning,
  dictionary: Dictionary,
  edit: Edit,
): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'meaning-row';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.addEventListener('change', () => {
    edit((terms) => toggleMeaning(dictionary, terms, term.id, meaning.keys));
  });
  row.appendChild(box);

  for (const [cls, text] of [
    ['meaning-form', meaning.form],
    ['meaning-tag', meaningTag(meaning.pos, meaning.language)],
    ['meaning-gloss', meaning.gloss],
  ] as const) {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text;
    row.appendChild(span);
  }

  // The legend's isolate gesture, on its own target so it is not competing
  // with the checkbox for what a click means.
  const only = document.createElement('button');
  only.className = 'meaning-only';
  only.type = 'button';
  only.textContent = 'only';
  only.title = `Show only ${meaning.gloss}`;
  only.addEventListener('click', (e) => {
    // The row is a label, so the click would otherwise reach the checkbox too.
    e.preventDefault();
    e.stopPropagation();
    edit((terms) => onlyMeaning(terms, term.id, meaning.keys));
  });
  row.appendChild(only);

  const count = document.createElement('span');
  count.className = 'meaning-count';
  count.textContent = String(meaning.verseCount);
  row.appendChild(count);

  return row;
}

/**
 * Which meanings the list shows — its structure, not which are ticked. The
 * boxes are then synced on every pass, so a refused toggle (unchecking the last
 * one) is put back rather than leaving the page disagreeing with the state.
 */
function meaningSignature(mode: string, rows: Meaning[]): string {
  if (mode !== 'meanings' || rows.length < 2) return '';
  return rows.map((m) => m.keys[0]).join(',');
}

/** The open row's meanings, drawn into its body below the mode control. */
export function renderMeanings(
  body: HTMLElement,
  term: SearchTerm,
  dictionary: Dictionary | null,
  edit: Edit,
): void {
  const rows = dictionary ? meaningsOf(dictionary, term) : [];
  const signature = meaningSignature(effectiveMode(dictionary, term), rows);

  if (body.dataset.meanings !== signature) {
    body.dataset.meanings = signature;
    body.querySelector('.term-meanings')?.remove();

    if (signature && dictionary) {
      const list = document.createElement('div');
      list.className = 'term-meanings';
      for (const meaning of rows) {
        list.appendChild(buildMeaningRow(term, meaning, dictionary, edit));
      }
      body.appendChild(list);
    }
  }

  if (!signature) return;

  const chosen = chosenAmong(rows, term);
  const boxes = body.querySelectorAll<HTMLInputElement>('.meaning-row input');
  rows.forEach((meaning, i) => {
    const box = boxes[i];
    if (!box) return;
    box.checked = chosen.includes(meaning);
    // Locked with a class rather than the disabled attribute: a disabled
    // checkbox is drawn grey, so the one meaning still chosen would look like
    // the least chosen one.
    const locked = box.checked && chosen.length === 1;
    box.closest('.meaning-row')?.classList.toggle('locked', locked);
    box.title = locked ? 'The last meaning cannot be unchecked' : '';
  });
}

/**
 * What a collapsed row in meanings mode says after the mode: how many meanings
 * it searches, or which ones it was narrowed to.
 *
 * Only a word with at least two meanings has anything to report. One meaning
 * is not a choice, and a word the dictionary does not know has none at all —
 * both of those are the rows that show no checkboxes either. Saying how many
 * there are rather than leaving the mode bare: meanings over a word with four
 * readings is searching for all four, and a row that said only "meanings" gave
 * no sign of it.
 */
export function meaningSummary(dictionary: Dictionary, term: SearchTerm): string | null {
  const rows = meaningsOf(dictionary, term);
  if (rows.length < 2) return null;
  if (!isNarrowed(dictionary, term)) return `all ${rows.length} meanings`;

  const chosen = chosenAmong(rows, term)
    .map((m) => m.gloss)
    .join(', ');
  return chosen || null;
}
