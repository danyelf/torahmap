#!/usr/bin/env node
// Screenshot the meaning-filter prototype. Usage: node dicta-prototype/shots.mjs [port]
import { chromium } from "playwright";
import { mkdirSync, rmSync } from "fs";

const port = process.argv[2] || "5173";
const outDir = "dicta-prototype/shots";
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));

await page.goto(`http://localhost:${port}/dicta-prototype/`, { waitUntil: "load" });
await page.waitForFunction(() => !document.getElementById("map-caption").textContent.includes("loading"), { timeout: 60000 });
await page.waitForTimeout(600);

async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(name);
}

/** Click a scenario button by the caption printed under it. */
async function scenario(caption) {
  await page.evaluate((c) => {
    const b = [...document.querySelectorAll("#scenarios button")].find((x) => x.textContent.includes(c));
    if (!b) throw new Error("no scenario: " + c);
    b.click();
  }, caption);
  await page.waitForTimeout(700);
}

/** Report the numbers the page is actually showing, so the claims are checkable. */
async function numbers(tag) {
  const n = await page.evaluate(() => ({
    caption: document.getElementById("map-caption").innerText.replace(/\s+/g, " ").trim(),
    results: document.getElementById("results-head").innerText.split("·")[0].trim(),
    senses: [...document.querySelectorAll(".term")].map((t) => ({
      word: t.querySelector(".term-word")?.innerText,
      counts: t.querySelector(".term-counts")?.innerText,
      rows: [...t.querySelectorAll(".sense-row")].map(
        (r) => `${r.querySelector(".primary").innerText}=${r.querySelector(".count").innerText}${r.querySelector("input").checked ? "" : " [off]"}`
      ),
      hasControl: !!t.querySelector(".term-senses"),
    })),
  }));
  console.log(`\n--- ${tag}`);
  console.log("  map:", n.caption);
  console.log("  list:", n.results);
  for (const t of n.senses) {
    console.log(`  word ${t.word}: ${t.counts} | control shown: ${t.hasControl}`);
    for (const r of t.rows) console.log(`      ${r}`);
  }
}

// 1. a polysemous word, nothing excluded
await scenario("four meanings");
await numbers("alah, all four meanings");
await shot("1-alah-unfiltered");

// 2. the same word narrowed to one meaning — the corrected intersection
await scenario("narrowed to burnt offering");
await numbers("alah narrowed to burnt offering");
await shot("2-alah-burnt-offering-only");

// verify the bug is actually gone
const gen37 = await page.evaluate(() =>
  [...document.querySelectorAll(".result-row .ref")].some((r) => r.innerText === "Genesis 3:7")
);
console.log("\n  Genesis 3:7 (the fig leaf) present in results:", gen37, gen37 ? "<-- BUG STILL THERE" : "<-- correctly excluded");

// 3. narrowed word beside an unnarrowed one of similar size
await scenario("beside an unnarrowed one");
await numbers("alah[burnt offering] + zevach");
await shot("3-narrowed-beside-unnarrowed");

// 4. ten meanings, one colour
await scenario("ten meanings");
await numbers("shalem, ten meanings");
await shot("4-shalem-ten-meanings");

// 4b. shalem narrowed to the two sacrificial meanings
// The panel re-renders on every change, so untick everything with the "none"
// button and then tick the one meaning we want.
await page.evaluate(() => {
  [...document.querySelectorAll(".senses-head button")].find((b) => b.textContent === "none").click();
});
await page.waitForTimeout(300);
await page.evaluate(() => {
  const r = [...document.querySelectorAll(".sense-row")].find(
    (x) => x.querySelector(".primary").innerText === "peace offering"
  );
  r.querySelector("input").click();
});
await page.waitForTimeout(600);
await numbers("shalem narrowed to peace offering");
await shot("5-shalem-narrowed");

// 6. the ordinary case: one meaning, no control at all
await scenario("no control at all");
await numbers("erez, single meaning");
await shot("6-erez-no-control");

console.log("\nconsole errors:", errors.length ? errors : "(none)");
await browser.close();
