// The benchmark measures the first attempt of a fresh model by its sets
// alone, a run handing a clean child the first screen and the tasks a clean
// author wrote, the tree grading the queries the child wrote, while the
// references of `benchmark/tasks.mjs` run in the gate as `check:benchmark`
// and no child reads them [QSWRK#measure].
//
// Usage:
//   node scripts/benchmark.mjs check                  the references of tasks.mjs answer their tasks
//   node scripts/benchmark.mjs screen                 the hash of the first screen, the one a run fixes
//   node scripts/benchmark.mjs author ID [--model M]  a clean author writes the set ID
//   node scripts/benchmark.mjs run ID --decision DNNN --model M --runs N [--reason TEXT]
//   node scripts/benchmark.mjs verdict ID SCREEN [BASELINE]   the runs of a measurement beside a baseline, as they fixed them
//   node scripts/benchmark.mjs grade ID               every run of a set held against its answers
//   node scripts/benchmark.mjs misses ID RUN [TASK…]  what a run missed; marks the set seen
//   node scripts/benchmark.mjs frictions ID           what the calls of its runs failed with; marks the set seen

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { isDeepStrictEqual } from 'node:util';
import { TASKS } from './benchmark/tasks.mjs';
import { firstScreen, shortHash } from './benchmark/screens.mjs';
import { pipeEnv } from './pipe-env.mjs';
import { author, run, grade, misses, frictions } from './benchmark/sets.mjs';
import { verdict } from './benchmark/verdict.mjs';

const repoRoot = join(import.meta.dirname, '..');
const benchDir = join(repoRoot, 'scripts', 'benchmark');
const inputsDir = join(benchDir, 'inputs');

const core = file => import(pathToFileURL(join(repoRoot, 'core', 'src', file)).href);
const { evalQuery, printValue } = await core('index.mjs');
const { deepEqual } = await core('equality.mjs');
const { main } = await import(pathToFileURL(join(repoRoot, 'cli', 'src', 'main.mjs')).href);

// What the command line answers for a query over the data of its task,
// as JSON text, which `| json` writes [QSHST#answer], run in this process as
// `bin.mjs` runs it, its data handed as standard input.
async function answerOf(query, task) {
  const flags = task.raw ? ['--raw', `(${query}) | json`] : [`(${query}) | json`];
  let stdout = '';
  let stderr = '';
  const stdin = Readable.from([readFileSync(join(inputsDir, task.input))], { objectMode: false });
  const code = await main(flags, stdin, { write: written => { stdout += written; } }, { write: written => { stderr += written; } }, pipeEnv);
  if (code !== 0) throw new Error(`the command line exits ${code}: ${stderr}`);
  return stdout;
}

// A task over data answers JSON through the command line; a task of
// the language alone answers a value, held against the literal of its
// answer.
async function referenceHolds(task) {
  if (task.input === undefined) return deepEqual(await evalQuery(task.reference), await evalQuery(task.answer));
  return isDeepStrictEqual(JSON.parse(await answerOf(task.reference, task)), JSON.parse(task.answer));
}

async function check() {
  const wrong = [];
  for (const task of TASKS) if (!(await referenceHolds(task))) wrong.push(task);
  for (const task of wrong) {
    const given = task.input === undefined ? printValue(await evalQuery(task.reference)) : (await answerOf(task.reference, task)).trim();
    console.log(`${task.id}: the reference answers ${given}, the task ${task.answer}`);
  }
  if (wrong.length > 0) {
    console.log('a reference answers its task, or the task is written again with it [QSWRK#measure]');
    process.exit(1);
  }
  console.log(`check:benchmark — ${TASKS.length} references answer their tasks`);
}

// The flags of a command, `--name value`, and the words before them.
function argumentsOf(words) {
  const flags = {};
  const positional = [];
  for (let index = 0; index < words.length; index++) {
    if (words[index].startsWith('--')) flags[words[index].slice(2)] = words[++index];
    else positional.push(words[index]);
  }
  return { flags, positional };
}

const { flags, positional } = argumentsOf(process.argv.slice(3));
const COMMANDS = {
  check: () => check(),
  screen: () => console.log(shortHash(firstScreen())),
  author: () => author(positional[0], flags.model),
  run: () => run(positional[0], { decision: flags.decision, model: flags.model, runs: Number(flags.runs ?? 1), reason: flags.reason }),
  verdict: () => verdict(positional[0], positional[1], positional[2]),
  grade: () => grade(positional[0]),
  misses: () => misses(positional[0], positional[1], positional.slice(2)),
  frictions: () => frictions(positional[0])
};
(COMMANDS[process.argv[2] ?? 'check'] ?? (() => { console.error(`unknown command ${process.argv[2]}`); process.exit(2); }))();
