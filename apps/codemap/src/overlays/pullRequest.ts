// What the pull request did to each line, as a whole or one commit at a time.

import type { UrlParamSpec } from '@torahmap/link';
import { swatchList } from '@torahmap/shell/overlays/swatchList.ts';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { CONTROL } from '@torahmap/shell/panel.ts';
import { colorToCss, hex, type Color } from '@torahmap/utils';
import { baseColor } from '../baseColor.ts';
import { STRUCTURE_DATA, type CodeStructure, type Marks, type StructureData } from '../data.ts';
import type { CodeItem } from '../layout.ts';

export const ADDED = hex('#3fb950');
export const CHANGED = hex('#e3b341');
export const REMOVED = hex('#f85149');

export interface PullRequestSettings {
  /** 1-based into the structure's commits; null for all of them. */
  readonly commit: number | null;
}

const PARAMS = [{ key: 'commit', kind: 'token' }] as const satisfies readonly UrlParamSpec[];

function marksOf(structure: CodeStructure, file: number, commit: number | null): Marks | null {
  const f = structure.files[file];
  return commit === null ? f.pr : (f.commits[commit - 1] ?? null);
}

function colorOf(item: CodeItem, structure: CodeStructure, commit: number | null) {
  if (item.deletedFile) return REMOVED;
  const marks = marksOf(structure, item.file, commit);
  if (!marks) return null;
  const mark = marks.marks[item.line - 1];
  const own = mark === 'a' ? ADDED : mark === 'c' ? CHANGED : null;
  // A removal after the last line is marked on the last line.
  const last = item.line === marks.marks.length;
  const below = marks.deletedBefore.some((n) => n === item.line || (last && n === item.line + 1));
  return below ? [REMOVED, own ?? baseColor(item)] : own;
}

export const pullRequestOverlay: Overlay<CodeItem, PullRequestSettings, StructureData> = {
  id: 'pr',
  name: 'Pull request',
  description:
    'Shows what the pull request did to each line: green added, amber changed, red where lines were removed. Step through its commits one at a time.',
  data: STRUCTURE_DATA,
  urlParams: PARAMS,
  settingsFromUrl: ({ commit }) => {
    const n = Number(commit);
    return { commit: Number.isInteger(n) && n > 0 ? n : null };
  },
  settingsToUrl: ({ commit }): Record<string, string> =>
    commit === null ? {} : { commit: String(commit) },

  colorsFor: ({ items, settings, data }) =>
    items.map((item) => colorOf(item, data.structure, settings.commit)),

  renderControls(container, { commit }, onChange, data) {
    const commits = data?.structure.commits ?? [];
    if (commits.length === 0) {
      container.textContent = 'This pull request has no commits to show.';
      return;
    }
    if (!container.querySelector('[data-step]')) {
      container.innerHTML =
        `<div class="${CONTROL.segments}" role="group" aria-label="Commits">` +
        `<button type="button" class="${CONTROL.segment}" data-step="all">All commits</button>` +
        `<button type="button" class="${CONTROL.segment}" data-step="-1" aria-label="Previous commit">‹</button>` +
        `<button type="button" class="${CONTROL.segment}" data-step="1" aria-label="Next commit">›</button>` +
        `</div><p class="pr-subject"></p>`;
      for (const button of container.querySelectorAll<HTMLButtonElement>('[data-step]')) {
        const step = button.dataset.step!;
        button.addEventListener('click', () =>
          onChange(({ commit }) => {
            if (step === 'all') return { commit: null };
            const next = (commit ?? 0) + Number(step);
            return { commit: next < 1 ? null : Math.min(next, commits.length) };
          }),
        );
      }
    }
    const button = (step: string) =>
      container.querySelector<HTMLButtonElement>(`[data-step="${step}"]`)!;
    button('all').classList.toggle('on', commit === null);
    button('all').setAttribute('aria-pressed', String(commit === null));
    button('-1').disabled = commit === null;
    button('1').disabled = commit !== null && commit >= commits.length;
    container.querySelector('.pr-subject')!.textContent =
      commit === null
        ? `${commits.length} commit${commits.length === 1 ? '' : 's'}`
        : `${commit} of ${commits.length}: ${commits[commit - 1]?.subject ?? ''}`;
  },

  renderLegend(container) {
    container.replaceChildren(
      ...swatchList([
        { color: ADDED, name: 'Added' },
        { color: CHANGED, name: 'Changed' },
        { color: REMOVED, name: 'Lines removed here' },
      ]),
    );
  },

  summary: ({ commit }, { structure }) => ({
    detail: commit === null ? undefined : structure.commits[commit - 1]?.subject,
    colors: [ADDED, CHANGED, REMOVED].map((c: Color) => colorToCss(c)),
  }),
};
