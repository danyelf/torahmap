// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMON_COLUMNS, EVENTS, type EventName } from '../../../telemetry/schema.ts';

const dir = join(__dirname, '../../../../scripts/telemetry');
const queries = readdirSync(dir).filter((f) => f.endsWith('.sql'));

// An alias that reads one column across events where each holds a different field.
const ALIASES: Record<string, string[]> = { choice_or_verse: ['choice', 'verse'] };

function column(kind: string, n: number, event: EventName): string | undefined {
  if (kind === 'double') return EVENTS[event].doubles[n - 1];
  if (n <= COMMON_COLUMNS.length) return COMMON_COLUMNS[n - 1];
  return EVENTS[event].blobs[n - 1 - COMMON_COLUMNS.length];
}

function eventsRead(sql: string): EventName[] {
  const one = sql.match(/\bblob1\s*=\s*'(\w+)'/);
  const many = sql.match(/\bblob1\s+IN\s*\(([^)]*)\)/i);
  const names = one ? [one[1]] : (many?.[1].match(/\w+/g) ?? []);
  return names as EventName[];
}

function references(sql: string) {
  return [...sql.matchAll(/\b(blob|double)(\d+)\b(?:\s+AS\s+(\w+))?/gi)].map((m) => ({
    text: m[0],
    kind: m[1].toLowerCase(),
    n: Number(m[2]),
    alias: m[3],
  }));
}

describe('telemetry queries', () => {
  it.each(queries)('%s reads each column by the name schema.ts gives it', (file) => {
    const sql = readFileSync(join(dir, file), 'utf8');
    const events = eventsRead(sql);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) expect(EVENTS).toHaveProperty(event);
    expect(sql).toContain('{{SITE}}');

    for (const ref of references(sql)) {
      for (const event of events) {
        const actual = column(ref.kind, ref.n, event);
        const expected = ref.alias ? (ALIASES[ref.alias] ?? [ref.alias]) : ['event'];
        expect(expected, `${ref.text} in ${file} holds ${actual} for ${event}`).toContain(actual);
      }
    }
  });

  it('report.sh filters on the host column', () => {
    const script = readFileSync(join(dir, 'report.sh'), 'utf8');
    const refs = references(script);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(column(ref.kind, ref.n, 'page_view')).toBe('host');
  });
});
