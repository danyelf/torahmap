// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { columns, EVENTS, type EventName } from '../../../telemetry/schema.ts';

const dir = join(__dirname, '../../../../scripts/telemetry');
const queries = readdirSync(dir).filter((f) => f.endsWith('.sql'));

// An alias other than the column's schema name, and the field it reads for each event.
const ALIASES: Record<string, Partial<Record<EventName, string>>> = {
  choice_or_verse: { word_menu_open: 'verse', word_search: 'choice' },
  driver: { page_view: 'mode' },
};

function eventsRead(sql: string): string[] {
  const equal = [...sql.matchAll(/\bblob1\s*=\s*'(\w+)'/gi)].map((m) => m[1]);
  const lists = [...sql.matchAll(/\bblob1\s+IN\s*\(([^)]*)\)/gi)].flatMap(
    (m) => m[1].match(/\w+/g) ?? [],
  );
  return [...equal, ...lists];
}

function references(sql: string) {
  return [...sql.matchAll(/\b(blob|double)(\d+)\b(?:\s+AS\s+(\w+))?/gi)].map((m) => ({
    text: m[0],
    kind: m[1].toLowerCase() === 'blob' ? ('blobs' as const) : ('doubles' as const),
    n: Number(m[2]),
    alias: m[3],
  }));
}

describe('telemetry queries', () => {
  it.each(queries)('%s reads each column by the name schema.ts gives it', (file) => {
    const sql = readFileSync(join(dir, file), 'utf8');
    const events = eventsRead(sql);
    expect(events.length).toBeGreaterThan(0);
    expect(sql).toContain('{{SITE}}');

    for (const event of events) {
      expect(EVENTS).toHaveProperty(event);
      for (const ref of references(sql)) {
        const actual = columns(event as EventName)[ref.kind][ref.n - 1];
        const expected = ref.alias
          ? (ALIASES[ref.alias]?.[event as EventName] ?? ref.alias)
          : 'event';
        expect(actual, `${ref.text} in ${file} for ${event}`).toBe(expected);
      }
    }
  });

  it('report.sh expands {{SITE}} to rows whose host column equals the site', () => {
    const script = readFileSync(join(dir, 'report.sh'), 'utf8');
    const host = columns('page_view').blobs.indexOf('host') + 1;
    expect(host).toBeGreaterThan(0);
    expect(script).toMatch(new RegExp(`\\bsite="blob${host} = '[^']+'`));
    expect(script).toContain('s/{{SITE}}/$site/g');
  });
});
