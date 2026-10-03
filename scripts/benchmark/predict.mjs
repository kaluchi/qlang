// The prediction of conformance cases [D142]: a clean child, blind,
// predicts what each query answers, with a screen or without one, and
// the runtime grades the prediction against the expected answer. The
// cases are drawn from the conformance suite by a hash of their query,
// the same draw on every run, and the draw is never printed, so the
// author of a page cannot read the cases it is measured on.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runChild } from './child.mjs';
import { screenText } from './screens.mjs';

const benchDir = import.meta.dirname;
const repoRoot = join(benchDir, '..', '..');
const commandLine = join(repoRoot, 'cli', 'src', 'bin.mjs');
const predictionsDir = join(benchDir, 'predictions');
const DRAWN = 200;
const CHUNK = 50;
const PARALLEL = 6;
const sha1 = text => createHash('sha1').update(text).digest('hex');

// The drawn cases: one-line queries of the suite with a printed answer,
// none of the axes that read the catalog, ordered by a hash of the query.
function drawnCases() {
  const conformanceDir = join(repoRoot, 'core', 'test', 'conformance');
  const eligible = new Map();
  for (const name of readdirSync(conformanceDir, { recursive: true }).filter(file => file.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(conformanceDir, name), 'utf8').split(/\r?\n/)) {
      let testCase;
      try { testCase = JSON.parse(line); } catch { continue; }
      if (testCase.target || typeof testCase.query !== 'string' || typeof testCase.expect !== 'string') continue;
      if (testCase.query.includes('\n') || /\b(doc|manifest|spec|links|open|laws|runLaws|explain|elide)\b/.test(testCase.query)) continue;
      eligible.set(testCase.query, testCase);
    }
  }
  return [...eligible.values()].sort((left, right) => sha1(`h${left.query}`).localeCompare(sha1(`h${right.query}`))).slice(0, DRAWN);
}

const PREDICTION_HEAD = [
  'Below are numbered queries written in qlang, a small pipeline language. For each query, predict the value it answers when run with no input.',
  '',
  "Reply with one line per query and nothing else: the number, a space, then the predicted value written as a literal in qlang's notation. If a query fails, answer the name of its failure as a tag, like ::SomeError. If you are unsure, give your best guess; never skip a number.",
  ''
].join('\n');

function promptOf(screen, chunk) {
  const page = screen === 'none' ? '' : ["This is the first page of qlang's documentation, as the language prints it:", '', '<<<', screenText(screen), '>>>', ''].join('\n');
  return page + PREDICTION_HEAD + chunk.map((testCase, index) => `${index + 1}. ${testCase.query}`).join('\n') + '\n';
}

async function pool(jobs) {
  let next = 0;
  await Promise.all(Array.from({ length: PARALLEL }, async () => { while (next < jobs.length) await jobs[next++](); }));
}

// predict({ screen, model, runs }) — the chunks of the draw each run
// does not hold yet.
export async function predict({ screen, model, runs }) {
  mkdirSync(predictionsDir, { recursive: true });
  const cases = drawnCases();
  const jobs = [];
  for (let runIndex = 1; runIndex <= runs; runIndex++) {
    for (let start = 0; start < cases.length; start += CHUNK) {
      const recordPath = join(predictionsDir, `${screen}~${model}~${start / CHUNK}~${runIndex}.json`);
      if (existsSync(recordPath) && !JSON.parse(readFileSync(recordPath, 'utf8')).failed) continue;
      const workDir = join(tmpdir(), 'qlang-benchmark', 'predictions', `${screen}-${model}-${start / CHUNK}-${runIndex}`);
      jobs.push(async () => {
        const record = await runChild({ prompt: promptOf(screen, cases.slice(start, start + CHUNK)), model, mode: 'blind', workDir });
        writeFileSync(recordPath, JSON.stringify({ screen, model, chunk: start / CHUNK, run: runIndex, date: new Date().toISOString().slice(0, 10), ...record }, null, 1) + '\n');
      });
    }
  }
  await pool(jobs);
  console.log(`predict ${screen} ${model}: ${jobs.length} children`);
}

function answersTrue(query) {
  return new Promise(resolve => {
    const child = execFile(process.execPath, [commandLine, query], { timeout: 30000 }, (failure, stdout) => resolve(!failure && stdout.trim() === 'true'));
    child.stdin.end();
  });
}

// gradePredictions() — the mean number of right predictions of each
// screen and model, and how many cases every run missed.
export async function gradePredictions() {
  const cases = drawnCases();
  const table = new Map();
  const jobs = [];
  for (const name of existsSync(predictionsDir) ? readdirSync(predictionsDir).filter(file => file.endsWith('.json')) : []) {
    const record = JSON.parse(readFileSync(join(predictionsDir, name), 'utf8'));
    if (record.failed) continue;
    const predicted = new Map();
    for (const line of String(record.result).split(/\r?\n/)) {
      const numbered = /^\s*(\d+)[.)]?\s+(.+?)\s*$/.exec(line);
      if (numbered !== null && !predicted.has(Number(numbered[1]))) predicted.set(Number(numbered[1]), numbered[2].replace(/^`(.*)`$/, '$1'));
    }
    const condition = `${record.screen}~${record.model}`;
    if (!table.has(condition)) table.set(condition, new Map());
    cases.slice(record.chunk * CHUNK, record.chunk * CHUNK + CHUNK).forEach((testCase, index) => {
      const answer = predicted.get(index + 1);
      const verdict = { run: record.run, right: false };
      const byCase = table.get(condition);
      if (!byCase.has(testCase.query)) byCase.set(testCase.query, []);
      byCase.get(testCase.query).push(verdict);
      if (answer === undefined) return;
      const check = /^\s*::[\w/]+!\{/.test(testCase.expect) ? `${testCase.expect} !| type | eq ${answer}` : `${testCase.expect} | eq ${answer}`;
      jobs.push(async () => { verdict.right = await answersTrue(check); });
    });
  }
  let next = 0;
  await Promise.all(Array.from({ length: 16 }, async () => { while (next < jobs.length) await jobs[next++](); }));
  for (const [condition, byCase] of [...table].sort()) {
    const verdicts = [...byCase.values()].flat();
    const runs = new Set(verdicts.map(verdict => verdict.run)).size;
    const right = verdicts.filter(verdict => verdict.right).length;
    const missedAlways = [...byCase.values()].filter(caseVerdicts => caseVerdicts.every(verdict => !verdict.right)).length;
    console.log(`${condition.padEnd(24)} mean right ${(right / runs).toFixed(1)} of ${cases.length}, runs ${runs}, missed in every run ${missedAlways}`);
  }
}
