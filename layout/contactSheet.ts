import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

interface Cell {
  shot?: string;
  failures: string[];
  known: string[];
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A test's own errors carry ANSI colour codes from Playwright's terminal reporter.
const stripAnsi = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, '');

const sanitizeFilename = (s: string): string => s.replace(/[^A-Za-z0-9._-]/g, '-');

/** Writes every layout screenshot as a grid: states down, screen sizes across. */
export default class ContactSheet implements Reporter {
  private readonly dir: string;
  private readonly cells = new Map<string, Map<string, Cell>>();
  private readonly screens: string[] = [];

  // Playwright passes a reporter's options through as given, adding configDir;
  // a relative outputDir would otherwise resolve against the working directory.
  constructor(options: { outputDir: string; configDir: string }) {
    this.dir = resolve(options.configDir, options.outputDir);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // The rules project has no page and never attaches a screenshot.
    const screen = test.parent.project()!.name;
    if (screen === 'rules') return;

    const shot = result.attachments.find((a) => a.name === 'layout' && a.path);
    let file: string | undefined;
    if (shot?.path) {
      mkdirSync(join(this.dir, 'shots'), { recursive: true });
      file = `shots/${sanitizeFilename(test.title)}--${sanitizeFilename(screen)}.png`;
      copyFileSync(shot.path, join(this.dir, file));
    }

    // A passing check with no screenshot (the render and measurement checks)
    // has nothing to show; a failing one still belongs on the sheet, whether
    // or not it got as far as capturing one.
    if (!file && result.status === 'passed') return;
    if (!this.screens.includes(screen)) this.screens.push(screen);

    const failures = result.errors.map((e) => stripAnsi(e.message ?? '').split('\n')[0]);
    if (!file && failures.length > 0) failures.unshift('no screenshot: failed before capture');

    const row = this.cells.get(test.title) ?? new Map<string, Cell>();
    row.set(screen, {
      shot: file,
      failures,
      known: test.annotations
        .filter((a) => a.type === 'known layout defect')
        .map((a) => a.description ?? ''),
    });
    this.cells.set(test.title, row);
  }

  onEnd(): void {
    if (this.cells.size === 0) return;
    const head = this.screens.map((s) => `<th>${esc(s)}</th>`).join('');
    const rows = [...this.cells]
      .map(([state, row]) => {
        const tds = this.screens
          .map((s) => {
            const c = row.get(s);
            if (!c) return '<td></td>';
            const notes = [
              ...c.failures.map((f) => `<li class="fail">${esc(f)}</li>`),
              ...c.known.map((k) => `<li class="known">${esc(k)}</li>`),
            ].join('');
            const img = c.shot
              ? `<a href="${esc(c.shot)}"><img src="${esc(c.shot)}" loading="lazy"></a>`
              : '';
            return `<td>${img}<ul>${notes}</ul></td>`;
          })
          .join('');
        return `<tr><th>${esc(state)}</th>${tds}</tr>`;
      })
      .join('');
    writeFileSync(
      join(this.dir, 'index.html'),
      `<!doctype html><meta charset="utf-8"><title>Layout</title><style>
body{font:13px system-ui;background:#111;color:#ddd;margin:16px}
table{border-collapse:collapse}th,td{border:1px solid #333;padding:6px;vertical-align:top}
img{max-width:260px;max-height:320px;display:block}ul{margin:4px 0 0;padding-left:16px;max-width:260px}
.fail{color:#f77}.known{color:#aa8}
</style><table><tr><th></th>${head}</tr>${rows}</table>`,
    );
    console.log(`Contact sheet: ${join(this.dir, 'index.html')}`);
  }
}
