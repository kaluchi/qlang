// The benchmark of the first screen [D26], [D104]. A run hands a fresh
// model the first screen as its only prior, the tasks of
// `benchmark/tasks.mjs` and one tool, the command line, and its record
// under `benchmark/runs/` holds the calls each task cost and every
// friction met, each with its query, what was expected and what came.
// A sentence of the first screen is written to answer frictions a run
// records, the decision that writes it names them, and the next run
// tells whether they are gone.
//
// Usage:
//   node scripts/benchmark.mjs check    the references answer their tasks
//   node scripts/benchmark.mjs prompt   the prompt of a run, as a run hands it
//   node scripts/benchmark.mjs screen   the hash of the first screen
//   node scripts/benchmark.mjs report   the runs side by side

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { TASKS } from './benchmark/tasks.mjs';

const repoRoot = join(import.meta.dirname, '..');
const benchDir = join(repoRoot, 'scripts', 'benchmark');
const inputsDir = join(benchDir, 'inputs');
const runsDir = join(benchDir, 'runs');
const commandLine = join(repoRoot, 'cli', 'src', 'bin.mjs');

const shortHash = text => createHash('sha256').update(text).digest('hex').slice(0, 12);

function answerOf(query, task) {
  const flags = task.raw ? ['--raw', query] : [query];
  return execFileSync(process.execPath, [commandLine, ...flags],
    { input: readFileSync(join(inputsDir, task.input)), encoding: 'utf8' });
}

function check() {
  const wrong = TASKS.filter(task => !isDeepStrictEqual(JSON.parse(answerOf(task.reference, task)), JSON.parse(task.answer)));
  for (const task of wrong) console.log(`${task.id}: the reference answers ${answerOf(task.reference, task).trim()}, the task ${task.answer}`);
  if (wrong.length > 0) process.exit(1);
  console.log(`check:benchmark — ${TASKS.length} references answer their tasks`);
}

function firstScreen() {
  return execFileSync(process.execPath, [commandLine, '::qlang | docs | first | content'], { input: '', encoding: 'utf8' });
}

function prompt() {
  const taskLines = TASKS.map(task => `${task.id} (${task.input}${task.raw ? ', raw text' : ''}): ${task.question}`).join('\n');
  return `You are taking part in a usability experiment for a small pipeline query language called qlang. You have never seen it. Your only sources of knowledge are the language itself, queried through its command-line tool.

RULES (strict):
- Use ONLY the Bash tool, and ONLY to run the \`qlang\` command, from the directory ${inputsDir.replace(/\\/g, '/')}.
- Do NOT read, list, grep or open any file outside that directory, and no documentation, source or README of qlang. Do not use web search.
- You may \`cat\` the input files of that directory to see the data.
- Always pass stdin: either \`< file\` or \`< /dev/null\`. Use \`qlang --raw '<query>' < app.log\` for the text file. In Git Bash prefix a query that begins with \`/\` with MSYS_NO_PATHCONV=1.
- Start with \`qlang --help < /dev/null\` and \`qlang '::qlang | docs | first | content' < /dev/null\`, the language's own first screen, then explore the language by asking it.

TASKS (each answer is a single qlang query printing exactly the requested JSON):
${taskLines}

Budget: about 60 qlang invocations in total. A task that seems impossible: say so and why, and move on.

REPORT, plain text:
1. For each task: the final query, its output (abbreviated), and the invocations spent on it.
2. The total invocations, exploration included.
3. Every friction, each with the exact query run, what was expected and what came: wrong guesses of names, unhelpful errors, missing or misleading docs, surprising output. Be concrete and exhaustive.
4. What in the first screen helped, and what it should have said.`;
}

function report() {
  const runs = readdirSync(runsDir).filter(name => name.endsWith('.json')).sort()
    .map(name => JSON.parse(readFileSync(join(runsDir, name), 'utf8')));
  for (const run of runs) {
    const perTask = TASKS.map(task => `${task.id} ${run.tasks[task.id]?.calls ?? '–'}${run.tasks[task.id]?.solved ? '' : '✗'}`).join('  ');
    console.log(`${run.id}  ${run.date}  ${run.model}  screen ${run.screen}  calls ${run.calls}  ${perTask}`);
    for (const friction of run.frictions) {
      console.log(`  ${run.id}.${friction.id}  ${friction.task}  ${friction.kind}${friction.repairedBy ? `  repaired by ${friction.repairedBy}` : ''}`);
    }
  }
}

const COMMANDS = {
  check,
  prompt: () => console.log(prompt()),
  screen: () => console.log(shortHash(firstScreen())),
  report
};
(COMMANDS[process.argv[2] ?? 'check'] ?? (() => { console.error(`unknown command ${process.argv[2]}`); process.exit(2); }))();
