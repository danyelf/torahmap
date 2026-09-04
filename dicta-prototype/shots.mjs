#!/usr/bin/env node
// Screenshot the faceted-search prototype. Usage: node dicta-prototype/shots.mjs [port]
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const port = process.argv[2] || "5173";
const outDir = "dicta-prototype/shots";
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

async function setWord(w) {
  await page.fill("#query", w);
  await page.waitForTimeout(900);
}

async function mode(v) {
  await page.check(`input[name="mode"][value="${v}"]`);
  await page.waitForTimeout(400);
}

// 1. everything on, one colour — the plain search
await setWord("עלה");
await shot("1-alah-all-on");

// 2. filter mode: turn off "go up" (5927) so only the sacrifice etc remain
await page.evaluate(() => {
  const rows = [...document.querySelectorAll("#meanings .facet-row")];
  const goUp = rows.find((r) => r.textContent.includes("go up"));
  if (goUp) goUp.querySelector("input").click();
});
await page.waitForTimeout(500);
await shot("2-alah-filtered-out-go-up");

// 3. colour by meaning, all senses back on
await page.click('[data-all="meanings"]');
await page.waitForTimeout(300);
await mode("colour-meaning");
await shot("3-alah-colour-by-meaning");

// 4. dim mode
await mode("emphasise");
await page.evaluate(() => {
  const rows = [...document.querySelectorAll("#meanings .facet-row")];
  const goUp = rows.find((r) => r.textContent.includes("go up"));
  if (goUp) goUp.querySelector("input").click();
});
await page.waitForTimeout(500);
await shot("4-alah-dimmed");

// 5. the twelve-sense word
await page.click('[data-all="meanings"]');
await mode("colour-meaning");
await setWord("שלם");
await shot("5-shalem-twelve-senses");

// 6. the ordinary case: one sense
await mode("filter");
await setWord("ארז");
await shot("6-erez-one-sense");

// 7. word-form colouring on a word with many forms
await setWord("ברך");
await mode("colour-form");
await shot("7-barakh-colour-by-form");

// 8. the one case the model clearly earns: isolate a sense with its own geography
await setWord("עלה");
await mode("filter");
await page.click('[data-none="meanings"]');
await page.evaluate(() => {
  const rows = [...document.querySelectorAll("#meanings .facet-row")];
  const burnt = rows.find((r) => r.textContent.includes("burnt offering"));
  if (burnt) burnt.querySelector("input").click();
});
await page.waitForTimeout(600);
await shot("8-alah-only-burnt-offering");

console.log("\nconsole errors:", errors.length ? errors : "(none)");
await browser.close();
