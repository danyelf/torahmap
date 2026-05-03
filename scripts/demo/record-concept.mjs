#!/usr/bin/env node
// Record a ~30s clip of a torahmap dev server. Used to capture visual
// concepts living on demo/* branches into webms on the demo-gallery branch.
//
// Usage:
//   node scripts/demo/record-concept.mjs <name> [url]
//     <name>  output basename (e.g. "torah-rain")
//     [url]   defaults to http://localhost:5173
//
// Tunable env vars:
//   HOVER_SWEEP=1      Wander cursor across nearby verses to retrigger
//                      hover-driven effects (ripples, scatter, etc.)
//   ZOOM_TICKS=N       Wheel ticks during phase 2 (default 15 ≈ 4.2x;
//                      heat-shimmer used 24 ≈ 9.8x).
//   PHASE1_MS=N        Duration of zoomed-out phase (default 12000).
//   PHASE3_MS=N        Duration of zoomed-in hold (default 14250).
//
// Resolves Playwright from any worktree under .claude/worktrees/ that has
// it installed (each demo/* branch's worktree typically does). Writes to
// .claude/videos/<name>.webm.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const videosDir = join(repo, ".claude", "videos");
mkdirSync(videosDir, { recursive: true });

const name = process.argv[2];
if (!name) {
  console.error("usage: record-concept.mjs <name> [url]");
  process.exit(2);
}
const url = process.argv[3] || "http://localhost:5173/";
const outWebm = join(videosDir, `${name}.webm`);

// Find a worktree with Playwright installed and resolve from there.
const worktreesRoot = join(repo, ".claude", "worktrees");
const candidate = existsSync(worktreesRoot)
  ? readdirSync(worktreesRoot)
      .map((d) => join(worktreesRoot, d, "node_modules", "playwright"))
      .find((p) => existsSync(p))
  : undefined;
if (!candidate) {
  console.error(
    `No worktree under ${worktreesRoot} has playwright installed under node_modules/`,
  );
  process.exit(1);
}
const require = createRequire(join(candidate, "package.json"));
const { chromium } = require("playwright");

console.log(`recording ${url} → ${outWebm}`);

const stagingDir = join(videosDir, `.tmp-${name}-${Date.now()}`);
mkdirSync(stagingDir, { recursive: true });

const VIEWPORT = { width: 1920, height: 1080 };

const browser = await chromium.launch({
  headless: true,
  args: ["--headless=new", "--no-sandbox"],
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  recordVideo: { dir: stagingDir, size: VIEWPORT },
});

// Suppress the first-visit help modal (see src/help.ts STORAGE_KEY_SEEN).
await context.addInitScript(() => {
  try {
    localStorage.setItem("torahMap.helpSeen", "true");
  } catch {}
});

const page = await context.newPage();

await page.goto(url, { waitUntil: "domcontentloaded" });
// Give WebGL/canvases a moment to initialize before the demo begins.
await page.waitForTimeout(2000);

// Anchor the zoom on the Torah strip near the top of the viewport.
// Each wheel tick = 1.1x zoom (see src/constants/app.ts ZOOM_IN_FACTOR).
const cx = VIEWPORT.width / 2;
const torahY = Math.round(VIEWPORT.height * 0.18);
await page.mouse.move(cx, torahY);

// HOVER_SWEEP=1: between the zoom phases, wander the cursor across nearby
// verses on a regular cadence so hover-triggered effects (ripples, scatter,
// constellations, etc.) actually fire repeatedly instead of just once.
const hoverSweep = process.env.HOVER_SWEEP === "1";
async function sweep(durationMs, anchorY) {
  if (!hoverSweep) {
    await page.waitForTimeout(durationMs);
    return;
  }
  const interval = 1500;
  const ticks = Math.floor(durationMs / interval);
  for (let i = 0; i < ticks; i++) {
    const x = VIEWPORT.width * (0.2 + Math.random() * 0.6);
    const y = anchorY + (Math.random() - 0.5) * 80;
    await page.mouse.move(x, y, { steps: 8 });
    await page.waitForTimeout(interval);
  }
  // Park back at the anchor before zoom.
  await page.mouse.move(cx, anchorY);
}

// Phase durations are tunable via env. Defaults give ~30s total.
const phase1Ms = parseInt(process.env.PHASE1_MS ?? "12000", 10);
const phase3Ms = parseInt(process.env.PHASE3_MS ?? "14250", 10);

console.log(`phase 1: zoomed out (${(phase1Ms / 1000).toFixed(2)}s)${hoverSweep ? " + hover sweep" : ""}`);
await sweep(phase1Ms, torahY);

const zoomTicks = parseInt(process.env.ZOOM_TICKS ?? "15", 10);
const tickInterval = 250;
const phase2Ms = zoomTicks * tickInterval;
console.log(`phase 2: zooming in (${zoomTicks} ticks, ${(phase2Ms / 1000).toFixed(2)}s)`);
for (let i = 0; i < zoomTicks; i++) {
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(tickInterval);
}

console.log(`phase 3: zoomed in (${(phase3Ms / 1000).toFixed(2)}s)${hoverSweep ? " + hover sweep" : ""}`);
await sweep(phase3Ms, torahY);

await page.close();
await context.close();
await browser.close();

const produced = readdirSync(stagingDir).filter((f) => f.endsWith(".webm"));
if (produced.length !== 1) {
  console.error(`expected 1 webm in ${stagingDir}, got ${produced.length}`);
  process.exit(1);
}
if (existsSync(outWebm)) rmSync(outWebm);
renameSync(join(stagingDir, produced[0]), outWebm);
rmSync(stagingDir, { recursive: true, force: true });

console.log(`saved → ${outWebm}`);

// 2-pass re-encode at higher VP8 bitrate. Playwright's bundled ffmpeg is
// stripped (VP8 only — no H.264) but does the job. Animated content (rain,
// fades, shimmer) needs the higher bitrate + relaxed quantizer bounds + 1s
// keyframe interval — the encoder's still-frame heuristics under-allocate
// otherwise.
const ffmpeg = join(
  process.env.HOME,
  "Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac",
);
if (existsSync(ffmpeg)) {
  const tmpHq = join(videosDir, `.hq-${name}-${Date.now()}.webm`);
  const passLogPrefix = join(videosDir, `.passlog-${name}-${Date.now()}`);

  const sharedArgs = [
    "-hide_banner",
    "-loglevel", "warning",
    "-y",
    "-i", outWebm,
    "-c:v", "libvpx",
    "-b:v", "10M",
    "-maxrate", "14M",
    "-bufsize", "20M",
    "-qmin", "0",
    "-qmax", "50",
    "-quality", "best",
    "-cpu-used", "0",
    "-g", "25",
    "-passlogfile", passLogPrefix,
    "-an",
  ];

  console.log("re-encoding webm @ 10 Mbps VP8 (2-pass)...");
  const pass1 = spawnSync(
    ffmpeg,
    [...sharedArgs, "-pass", "1", "-f", "webm", "/dev/null"],
    { stdio: "inherit" },
  );
  let pass2Status = -1;
  if (pass1.status === 0) {
    const pass2 = spawnSync(
      ffmpeg,
      [...sharedArgs, "-pass", "2", tmpHq],
      { stdio: "inherit" },
    );
    pass2Status = pass2.status ?? -1;
  }

  for (const suffix of ["-0.log", "-0.log.mbtree"]) {
    const p = `${passLogPrefix}${suffix}`;
    if (existsSync(p)) rmSync(p);
  }

  if (pass1.status === 0 && pass2Status === 0 && existsSync(tmpHq)) {
    rmSync(outWebm);
    renameSync(tmpHq, outWebm);
    console.log(`upgraded → ${outWebm}`);
  } else {
    if (existsSync(tmpHq)) rmSync(tmpHq);
    console.warn(
      `ffmpeg pass1=${pass1.status} pass2=${pass2Status} — keeping original webm`,
    );
  }
} else {
  console.warn("bundled ffmpeg not found — skipping re-encode");
}
