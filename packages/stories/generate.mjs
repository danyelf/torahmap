// Compiles markdown/*.md into src/generated.ts, so that every tool that bundles
// this package (Vite, Vitest, Wrangler, tsc) sees the same plain module.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

export const MARKDOWN_DIR = fileURLToPath(new URL('./markdown/', import.meta.url));
const OUT = fileURLToPath(new URL('./src/generated.ts', import.meta.url));

export function generateStories() {
  const stories = Object.fromEntries(
    readdirSync(MARKDOWN_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => [f.slice(0, -3), readFileSync(MARKDOWN_DIR + f, 'utf8')]),
  );
  const text =
    '// Written by generate.mjs from markdown/*.md. Do not edit.\n' +
    "/** Each story's Markdown, by id: its file name without `.md`. */\n" +
    `export const STORY_MARKDOWN: Readonly<Record<string, string>> = ${JSON.stringify(stories, null, 2)};\n`;
  // Unchanged output is not rewritten, so the dev server does not reload for nothing.
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== text) writeFileSync(OUT, text);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generateStories();
