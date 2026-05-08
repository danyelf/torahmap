import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startBackgroundPrefetch,
  resetPrefetchState,
} from "../../talmud/prefetch.ts";
import { resetTalmudDataCache } from "../../talmud/data.ts";

describe("prefetch onLoaded callback", () => {
  beforeEach(() => {
    resetPrefetchState();
    resetTalmudDataCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onLoaded once per tractate, in completion order", async () => {
    const completed: string[] = [];

    // Make the alphabetically-first tractate (Arakhin) finish AFTER the
    // alphabetically-second (Berakhot) by delaying its fetch. This proves
    // the callback fires in completion order, not declaration order.
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = String(url);
      const m = urlStr.match(/texts\/([^.]+)\.json/);
      const name = m?.[1] ?? "";
      const delay = name === "Arakhin" ? 50 : 0;
      await new Promise((r) => setTimeout(r, delay));
      return new Response(JSON.stringify({ name, amudim: [] }), {
        status: 200,
      });
    });

    await new Promise<void>((resolve, reject) => {
      let count = 0;
      const timeout = setTimeout(
        () => reject(new Error("onLoaded was not called twice")),
        2000,
      );
      startBackgroundPrefetch(["Arakhin", "Berakhot"], {
        concurrency: 2,
        onLoaded: (name) => {
          completed.push(name);
          count++;
          if (count === 2) {
            clearTimeout(timeout);
            resolve();
          }
        },
      });
    });

    // Berakhot finishes first despite being later in the queue
    expect(completed).toEqual(["Berakhot", "Arakhin"]);
  });

  it("does not throw when onLoaded is omitted", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        return new Response(JSON.stringify({ name: "Berakhot", amudim: [] }), {
          status: 200,
        });
      });

    // No callback registered — fetch still runs, no throw.
    startBackgroundPrefetch(["Berakhot"], { concurrency: 1 });
    // Wait a tick for the fetch to resolve.
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
