// The benchmark of the first screen [D26], [D104], [D142]. A run hands a
// clean child a screen, the first page of the language as a tree printed
// it, and a set of tasks; the child answers blind or with the command
// line, and the tree grades the queries it wrote. The sets are written by
// a clean author who never saw the language, and a set measures once:
// reading what its children missed marks it seen, and the next
// measurement orders a new set. The set of `benchmark/tasks.mjs`, whose
// runs under `benchmark/runs/` a model read and wrote up, is the first
// screen's reading test of D104.
//
// Usage:
//   node scripts/benchmark.mjs check                  the references of tasks.mjs answer their tasks
//   node scripts/benchmark.mjs prompt                 the prompt of a run of tasks.mjs
//   node scripts/benchmark.mjs screen [--save NAME]   the hash of the first screen, or it saved under a name
//   node scripts/benchmark.mjs report                 the runs of tasks.mjs side by side
//   node scripts/benchmark.mjs author ID [--model M]  a clean author writes the set ID
//   node scripts/benchmark.mjs run ID --screen NAME --mode blind|cli --model M --runs N
//   node scripts/benchmark.mjs grade ID               every run of a set held against its answers
//   node scripts/benchmark.mjs misses ID RUN [TASK…]  what a run missed; marks the set seen
//   node scripts/benchmark.mjs frictions ID           what the calls of its runs failed with; marks the set seen
//   node scripts/benchmark.mjs predict --screen NAME --model M --runs N
//   node scripts/benchmark.mjs predictions            the predictions of conformance cases graded

import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { TASKS } from './benchmark/tasks.mjs';
import { firstScreen, saveScreen } from './benchmark/screens.mjs';
import { author, run, grade, misses, frictions } from './benchmark/sets.mjs';
import { predict, gradePredictions } from './benchmark/predict.mjs';

const repoRoot = join(import.meta.dirname, '..');
const benchDir = join(repoRoot, 'scripts', 'benchmark');
const inputsDir = join(benchDir, 'inputs');
const runsDir = join(benchDir, 'runs');
const commandLine = join(repoRoot, 'cli', 'src', 'bin.mjs');

const core = file => import(pathToFileURL(join(repoRoot, 'core', 'src', file)).href);
const { evalQuery } = await core('eval.mjs');
const { printValue } = await core('index.mjs');
const { deepEqual } = await core('equality.mjs');

const shortHash = text => createHash('sha256').update(text).digest('hex').slice(0, 12);

function answerOf(query, task) {
  const flags = task.raw ? ['--raw', query] : [query];
  return execFileSync(process.execPath, [commandLine, ...flags],
    { input: readFileSync(join(inputsDir, task.input)), encoding: 'utf8' });
}

// A task over an input answers JSON or text through the command line;
// a task of the language alone answers a value, held against the literal
// of its answer.
async function referenceHolds(task) {
  if (task.input === undefined) return deepEqual(await evalQuery(task.reference), await evalQuery(task.answer));
  return isDeepStrictEqual(JSON.parse(answerOf(task.reference, task)), JSON.parse(task.answer));
}

async function check() {
  const wrong = [];
  for (const task of TASKS) if (!(await referenceHolds(task))) wrong.push(task);
  for (const task of wrong) {
    const given = task.input === undefined ? printValue(await evalQuery(task.reference)) : answerOf(task.reference, task).trim();
    console.log(`${task.id}: the reference answers ${given}, the task ${task.answer}`);
  }
  if (wrong.length > 0) process.exit(1);
  console.log(`check:benchmark — ${TASKS.length} references answer their tasks`);
}

function prompt() {
  const whereOf = task => task.input === undefined ? 'no input, the answer a qlang value' : `${task.input}${task.raw ? ', raw text' : ''}`;
  const taskLines = TASKS.map(task => `${task.id} (${whereOf(task)}): ${task.question}`).join('\n');
  return `You are taking part in a usability experiment for a small pipeline query language called qlang. You have never seen it. Your only sources of knowledge are the language itself, queried through its command-line tool.

RULES (strict):
- Use ONLY the Bash tool, and ONLY to run the \`qlang\` command, from the directory ${inputsDir.replace(/\\/g, '/')}.
- Do NOT read, list, grep or open any file outside that directory, and no documentation, source or README of qlang. Do not use web search.
- You may \`cat\` the input files of that directory to see the data.
- Always pass stdin: either \`< file\` or \`< /dev/null\`. Use \`qlang --raw '<query>' < app.log\` for the text file. In Git Bash prefix a query that begins with \`/\` with MSYS_NO_PATHCONV=1.
- Start with \`qlang --help < /dev/null\` and \`qlang '::qlang | doc | content' < /dev/null\`, the language's own first screen, then explore the language by asking it.

TASKS (each answer is a single qlang query printing exactly the requested answer; a task with no input runs with \`< /dev/null\`):
${taskLines}

Budget: about 120 qlang invocations in total. A task that seems impossible: say so and why, and move on.

UNDERSTANDING (answer in your report, in your own words, from what the language told you, before and while solving):
U1. What is qlang, and what is it for?
U2. What is a value, a kind and a tag, and how are they related?
U3. How does a name in a query find the verb it runs?
U4. What happens when a step fails, and how does a query deal with it?
U5. How is the description of the language organized, and how do you move through it? Which queries did you use to read several pages at once?

REPORT, plain text:
1. For each task: the final query, its output (abbreviated), and the invocations spent on it.
2. The total invocations, exploration included.
3. Every friction, each with the exact query run, what was expected and what came: wrong guesses of names, unhelpful errors, missing or misleading docs, surprising output. Be concrete and exhaustive.
4. What in the first screen helped, and what it should have said.
5. The answers to U1–U5.`;
}

function report() {
  const runs = readdirSync(runsDir).filter(name => name.endsWith('.json')).sort()
    .map(name => JSON.parse(readFileSync(join(runsDir, name), 'utf8')));
  for (const run of runs) {
    const perTask = TASKS.filter(task => task.id in run.tasks)
      .map(task => `${task.id} ${run.tasks[task.id].calls}${run.tasks[task.id].solved ? '' : '✗'}`).join('  ');
    console.log(`${run.id}  ${run.date}  ${run.model}  screen ${run.screen}  calls ${run.calls}  ${perTask}`);
    for (const friction of run.frictions) {
      console.log(`  ${run.id}.${friction.id}  ${friction.task}  ${friction.kind}${friction.repairedBy ? `  repaired by ${friction.repairedBy}` : ''}`);
    }
  }
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
  prompt: () => console.log(prompt()),
  screen: () => (flags.save === undefined ? console.log(shortHash(firstScreen())) : saveScreen(flags.save)),
  report,
  author: () => author(positional[0], flags.model),
  run: () => run(positional[0], { screen: flags.screen, mode: flags.mode, model: flags.model, runs: Number(flags.runs ?? 1) }),
  grade: () => grade(positional[0]),
  misses: () => misses(positional[0], positional[1], positional.slice(2)),
  frictions: () => frictions(positional[0]),
  predict: () => predict({ screen: flags.screen, model: flags.model, runs: Number(flags.runs ?? 1) }),
  predictions: () => gradePredictions()
};
(COMMANDS[process.argv[2] ?? 'check'] ?? (() => { console.error(`unknown command ${process.argv[2]}`); process.exit(2); }))();
