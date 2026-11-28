#!/usr/bin/env tsx
/**
 * Answers the batches `model-pilot.ts` writes, through `claude -p` on Danyel's subscription:
 * each `without-list-*.md` or `choose-*.md` in the folder without its `.json` is sent as one
 * request, and the JSON answer is written beside it. What is answered already is skipped, so
 * a stopped run picks up where it left off. The first failure stops the run.
 *
 *   npx tsx scripts/talmud/model-answer.ts <folder> [--limit N] [--parallel N] [--model M]
 *
 * The request carries a one-line system prompt and no tools, settings, MCP servers or session
 * file, so it is the batch and little else. It runs in an empty folder, away from any CLAUDE.md.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    limit: { type: 'string' },
    parallel: { type: 'string', default: '4' },
    model: { type: 'string', default: 'haiku' },
  },
});
const [folder] = positionals;
if (!folder) throw new Error('Usage: model-answer.ts <folder> [--limit N] [--parallel N]');

const SYSTEM = 'Follow the instructions in the message. Answer with the JSON object only.';
const cwd = mkdtempSync(join(tmpdir(), 'model-answer-'));

const files = new Set(readdirSync(folder));
const pending = [...files]
  .filter((f) => /^(without-list|choose)-\d+\.md$/.test(f))
  .filter((f) => !files.has(f.replace(/\.md$/, '.json')))
  .sort()
  .slice(0, values.limit ? Number(values.limit) : undefined);

interface Reply {
  is_error: boolean;
  result: string;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
  };
}

function ask(prompt: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      [
        '-p',
        ...['--model', values.model!],
        ...['--system-prompt', SYSTEM],
        ...['--tools', ''],
        ...['--setting-sources', ''],
        '--strict-mcp-config',
        '--no-session-persistence',
        ...['--output-format', 'json'],
      ],
      { cwd, stdio: ['pipe', 'pipe', 'inherit'] },
    );
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error(`claude exited ${code}: ${out.slice(0, 500)}`));
      }
    });
    child.stdin.end(prompt);
  });
}

/** The answer's JSON object, with any fence or words around it taken off. */
function answerOf(text: string): unknown {
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

let done = 0;
let failed: Error | undefined;
const tokens = { input: 0, output: 0 };
async function worker() {
  while (!failed) {
    const file = pending.shift();
    if (!file) return;
    try {
      const reply = await ask(readFileSync(join(folder, file), 'utf8'));
      if (reply.is_error) throw new Error(reply.result);
      const answer = answerOf(reply.result);
      writeFileSync(join(folder, file.replace(/\.md$/, '.json')), JSON.stringify(answer));
      const u = reply.usage;
      tokens.input += u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens;
      tokens.output += reply.usage.output_tokens;
      console.log(`${++done} ${file}`);
    } catch (e) {
      failed = new Error(`${file}: ${(e as Error).message}`);
    }
  }
}

await Promise.all(Array.from({ length: Number(values.parallel) }, worker));
console.log(`${done} answered; ${tokens.input} tokens in, ${tokens.output} out.`);
if (failed) throw failed;
