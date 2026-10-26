// A map that draws nothing, for checks of what surrounds the map. The page asks its canvas for a
// WebGL 2 context; this answers with one that accepts every call and draws nothing, so the page
// starts as it does with real WebGL, minus the software rendering that dominates the layout
// suite's time. A WebGL call that would throw in a real browser is not caught here.
import { test as base } from '@playwright/test';

/** Runs in the page before any of its scripts. */
function installFakeWebGL2(): void {
  const contexts = new WeakMap<HTMLCanvasElement, unknown>();
  let locations = 0;
  const fake = (canvas: HTMLCanvasElement): unknown => {
    const gl: unknown = new Proxy(
      { canvas },
      {
        get: (target, name) => {
          if (name in target) return target[name as keyof typeof target];
          const key = String(name);
          if (/^[A-Z_0-9]+$/.test(key)) return 1;
          if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
          if (key.endsWith('InfoLog')) return () => '';
          if (key === 'getAttribLocation') return () => locations++;
          if (/^(create|getUniformLocation)/.test(key)) return () => ({});
          return () => undefined;
        },
      },
    );
    return gl;
  };
  const getContext = HTMLCanvasElement.prototype.getContext as (
    this: HTMLCanvasElement,
    ...args: unknown[]
  ) => unknown;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
    if (args[0] !== 'webgl2') return getContext.apply(this, args);
    if (!contexts.has(this)) contexts.set(this, fake(this));
    return contexts.get(this);
  } as typeof HTMLCanvasElement.prototype.getContext;
  (window as unknown as { fakeMap: boolean }).fakeMap = true;
}

/**
 * `test` with the map faked unless `realMap` is set, by `test.use({ realMap: true })` for a check
 * that reads pixels or by SCREENSHOTS in the environment.
 */
export const test = base.extend<{ realMap: boolean }>({
  realMap: [!!process.env.SCREENSHOTS, { option: true }],
  context: async ({ context, realMap }, use) => {
    if (!realMap) await context.addInitScript(installFakeWebGL2);
    await use(context);
  },
});

/** Whether the page's map is the fake. */
export const isFake = (page: import('@playwright/test').Page): Promise<boolean> =>
  page.evaluate(() => 'fakeMap' in window);
