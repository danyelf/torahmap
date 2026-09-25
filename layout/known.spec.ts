import { expect, test } from '@playwright/test';
import { STATES } from './app.ts';
import { RULES } from './check.ts';
import { KNOWN } from './known.ts';
import { SCREENS } from './screens.ts';

test('every known failure names a state, screen and rule that are checked', () => {
  const states = new Set(STATES.map((s) => s.name));
  const touch = new Map(SCREENS.map((s) => [s.name, Boolean(s.use?.hasTouch)]));
  for (const key of Object.keys(KNOWN)) {
    const [state, screen, rule] = key.split('/');
    expect(states.has(state), `${key}: no such state`).toBe(true);
    expect(touch.has(screen), `${key}: no such screen`).toBe(true);
    expect(RULES as readonly string[], `${key}: no such rule`).toContain(rule);
    if (rule === 'touch-targets') {
      expect(touch.get(screen), `${key}: touch targets are checked only on touch screens`).toBe(
        true,
      );
    }
  }
});
