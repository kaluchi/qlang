// The task sets of the benchmark [D142]: each written by a clean author
// who never saw the language, its answers computed by a script of the
// author's own, and run once fresh. A reading of what children missed
// marks the set seen, after which it serves the work and no longer
// measures it; the next measurement orders a new set.
//
// A set lives under `sets/<id>/`: `set.json` (who wrote it, whether it
// was seen), `tasks.json`, `inputs/`, the author's record under
// `author/`, and the runs under `runs/`, each named
// `<screen>~<mode>~<model>~<n>.json`.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { runChild } from './child.mjs';
import { screenText, screenHash } from './screens.mjs';

const benchDir = import.meta.dirname;
const repoRoot = join(benchDir, '..', '..');
const commandLine = join(repoRoot, 'cli', 'src', 'bin.mjs');
const setsDir = join(benchDir, 'sets');
const scratchRoot = join(tmpdir(), 'qlang-benchmark');

const setDirOf = setId => join(setsDir, setId);
const tasksOf = setId => JSON.parse(readFileSync(join(setDirOf(setId), 'tasks.json'), 'utf8'));
const inputNamesOf = setId => readdirSync(join(setDirOf(setId), 'inputs'));
const isTextInput = input => input !== null && !input.endsWith('.json');
const commitOf = () => execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();

function setRecordOf(setId) {
  return JSON.parse(readFileSync(join(setDirOf(setId), 'set.json'), 'utf8'));
}

function markSeen(setId, reason) {
  const record = setRecordOf(setId);
  if (record.seen) return;
  writeFileSync(join(setDirOf(setId), 'set.json'), JSON.stringify({ ...record, seen: true, seenBy: reason }, null, 1) + '\n');
}

// ── author ─────────────────────────────────────────────────────

// A clean author writes the set in a directory of its own, with the
// file tools and node alone; its inputs, tasks and generator are copied
// under `sets/<id>/`, the scratch directory lying on any drive.
export async function author(setId, model = 'sonnet') {
  if (existsSync(setDirOf(setId))) throw new Error(`set ${setId} exists`);
  const workDir = join(scratchRoot, 'author', setId);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  const prompt = readFileSync(join(benchDir, 'author-prompt.txt'), 'utf8').replace('{FIRST_ID}', `${setId}1`);
  const authorRecord = await new Promise(resolve => {
    const child = spawn('claude', ['-p', '--model', model, '--strict-mcp-config', '--system-prompt', 'You are a careful assistant.',
      '--tools', 'Bash,Write,Read', '--allowedTools', 'Write', 'Read', 'Bash(node:*)', 'Bash(ls:*)', 'Bash(cat:*)',
      '--output-format', 'json'], { cwd: workDir });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.on('close', () => resolve(output));
    child.stdin.end(prompt);
  });
  const setDir = setDirOf(setId);
  mkdirSync(join(setDir, 'inputs'), { recursive: true });
  mkdirSync(join(setDir, 'author'), { recursive: true });
  for (const name of readdirSync(workDir)) {
    const from = join(workDir, name);
    if (name === 'tasks.json') copyFileSync(from, join(setDir, 'tasks.json'));
    else if (/\.(c?js|mjs)$/.test(name)) copyFileSync(from, join(setDir, 'author', name));
    else copyFileSync(from, join(setDir, 'inputs', name));
  }
  writeFileSync(join(setDir, 'author', 'prompt.txt'), prompt);
  writeFileSync(join(setDir, 'author', 'record.json'), authorRecord);
  writeFileSync(join(setDir, 'set.json'), JSON.stringify({ id: setId, author: model, written: new Date().toISOString().slice(0, 10), seen: false }, null, 1) + '\n');
  console.log(`set ${setId}: ${tasksOf(setId).length} tasks, inputs ${inputNamesOf(setId).join(' ')}`);
}

// ── run ────────────────────────────────────────────────────────

const LINE_RULE = setId => `\`${setId}1: <query>\``;

function cliPrompt(setId, screen) {
  const tasks = tasksOf(setId);
  return [
    'You are taking part in a usability experiment for a small pipeline query language called qlang. You have never seen it. Below is the first page of its documentation, and you may run the `qlang` command to try queries and to ask the language about itself.',
    '', '<<<', screenText(screen), '>>>', '',
    'RULES: use the Bash tool only to run `qlang` and to `cat` or `head` the input files of the current directory; read nothing else. Always pass stdin: `qlang \'<query>\' < file.json` or `< /dev/null`; for a text file use `qlang --raw \'<query>\' < file.log`. In Git Bash prefix a query that begins with `/` with MSYS_NO_PATHCONV=1.',
    '', 'TASKS (each answer is one qlang query whose answer is the requested value; do not end it with `| json`):',
    ...tasks.map(task => `${task.id} (${task.input ?? 'no input'}): ${task.text}`),
    '', `When done, end your reply with exactly one line per task, ${LINE_RULE(setId)} and so on, the query alone on the line.`
  ].join('\n');
}

function blindPrompt(setId, screen) {
  const tasks = tasksOf(setId);
  return [
    'You are taking part in a usability experiment for a small pipeline query language called qlang. You have never seen it. Below is the first page of its documentation. You cannot run anything: write each query from the page alone, as your first and only attempt.',
    '', '<<<', screenText(screen), '>>>', '',
    'Each query runs with its input file as its subject: a JSON file arrives as the value it holds, a text file as one string. Do not end a query with `| json`.',
    '', 'TASKS:', ...tasks.map(task => `${task.id} (${task.input ?? 'no input'}): ${task.text}`),
    '', 'INPUT FILES:', ...inputNamesOf(setId).map(name => `--- ${name}\n${readFileSync(join(setDirOf(setId), 'inputs', name), 'utf8')}`),
    '', `End your reply with exactly one line per task, ${LINE_RULE(setId)} and so on, the query alone on the line.`
  ].join('\n');
}

// run(setId, { screen, mode, model, runs }) — the runs a record does not
// hold yet, in parallel; each record names the screen, its hash and the
// commit of the tree the children ran.
export async function run(setId, { screen, mode, model, runs }) {
  const runsDir = join(setDirOf(setId), 'runs');
  mkdirSync(runsDir, { recursive: true });
  const prompt = mode === 'cli' ? cliPrompt(setId, screen) : blindPrompt(setId, screen);
  const jobs = [];
  for (let runIndex = 1; runIndex <= runs; runIndex++) {
    const recordPath = join(runsDir, `${screen}~${mode}~${model}~${runIndex}.json`);
    if (existsSync(recordPath) && !JSON.parse(readFileSync(recordPath, 'utf8')).failed) continue;
    const workDir = join(scratchRoot, 'children', `${setId}-${screen}-${mode}-${model}-${runIndex}`);
    rmSync(workDir, { recursive: true, force: true });
    mkdirSync(workDir, { recursive: true });
    if (mode === 'cli') for (const name of inputNamesOf(setId)) copyFileSync(join(setDirOf(setId), 'inputs', name), join(workDir, name));
    jobs.push(runChild({ prompt, model, mode, workDir }).then(record => writeFileSync(recordPath, JSON.stringify({
      set: setId, screen, screenHash: screenHash(screen), mode, model, run: runIndex,
      date: new Date().toISOString().slice(0, 10), commit: commitOf(), ...record
    }, null, 1) + '\n')));
  }
  await Promise.all(jobs);
  console.log(`${setId} ${screen} ${mode} ${model}: ${jobs.length} runs`);
}

// ── grade ──────────────────────────────────────────────────────

// The final queries of a reply, one per task, by the number after the
// letter of the set, whatever letter the child wrote.
function finalQueriesOf(setId, reply) {
  const finals = new Map();
  for (const line of String(reply ?? '').split(/\r?\n/)) {
    const numbered = /^\s*[`*]*[A-Z](\d+)[`*]*:\s*`?(.+?)`?\s*$/.exec(line);
    if (numbered !== null) finals.set(`${setId}${numbered[1]}`, numbered[2]);
  }
  return finals;
}

// What the tree answers for a query over the input of its task, as JSON,
// or null when it fails.
function answerOf(setId, task, query) {
  try {
    const flags = isTextInput(task.input) ? ['--raw'] : [];
    const input = task.input === null ? '' : readFileSync(join(setDirOf(setId), 'inputs', task.input));
    const printed = execFileSync(process.execPath, [commandLine, ...flags, `(${query}) | json`], { input, encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    let answer = JSON.parse(printed);
    if (typeof answer === 'string') { try { answer = JSON.parse(answer); } catch { /* the answer is a string */ } }
    return { answer };
  } catch {
    return null;
  }
}

function sameJson(one, other) {
  if (typeof one === 'number' && typeof other === 'number') return Math.abs(one - other) < 1e-9;
  if (Array.isArray(one) || Array.isArray(other)) {
    return Array.isArray(one) && Array.isArray(other) && one.length === other.length && one.every((item, index) => sameJson(item, other[index]));
  }
  if (one && other && typeof one === 'object' && typeof other === 'object') {
    const keys = Object.keys(one);
    return keys.length === Object.keys(other).length && keys.every(key => key in other && sameJson(one[key], other[key]));
  }
  return one === other;
}

function runRecordsOf(setId) {
  const runsDir = join(setDirOf(setId), 'runs');
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir).filter(name => name.endsWith('.json')).sort()
    .map(name => ({ name, record: JSON.parse(readFileSync(join(runsDir, name), 'utf8')) }));
}

// grade(setId) — every run held against the answers, by the tree of the
// checkout that grades, which the line names.
export function grade(setId) {
  const tasks = tasksOf(setId);
  const { seen } = setRecordOf(setId);
  console.log(`set ${setId}, ${seen ? 'seen' : 'fresh'}, graded by ${commitOf()}`);
  for (const { name, record } of runRecordsOf(setId)) {
    const finals = finalQueriesOf(setId, record.result);
    const solved = tasks.filter(task => {
      const answered = finals.has(task.id) ? answerOf(setId, task, finals.get(task.id)) : null;
      return answered !== null && sameJson(answered.answer, task.expected);
    }).map(task => task.id);
    const missed = tasks.map(task => task.id).filter(taskId => !solved.includes(taskId));
    console.log(`${name.padEnd(30)} solved ${String(solved.length).padStart(2)}/${tasks.length}  turns ${String(record.turns ?? '').padStart(3)}  missed ${missed.join(' ')}`);
  }
}

// ── reading the runs ───────────────────────────────────────────

// misses(setId, runName, taskIds) — the task, the expected answer, the
// child's query and what the tree answers for it; reading them marks
// the set seen.
export function misses(setId, runName, taskIds) {
  markSeen(setId, `misses ${runName}`);
  const tasks = tasksOf(setId);
  const { record } = runRecordsOf(setId).find(entry => entry.name === runName || entry.name === `${runName}.json`);
  const finals = finalQueriesOf(setId, record.result);
  for (const task of tasks.filter(candidate => taskIds.length === 0 || taskIds.includes(candidate.id))) {
    const query = finals.get(task.id) ?? null;
    let printed = '(no query)';
    if (query !== null) {
      try {
        const input = task.input === null ? '' : readFileSync(join(setDirOf(setId), 'inputs', task.input));
        printed = execFileSync(process.execPath, [commandLine, ...(isTextInput(task.input) ? ['--raw'] : []), query], { input, encoding: 'utf8', timeout: 30000 });
      } catch (failure) {
        printed = `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
      }
    }
    console.log(`== ${task.id} (${task.input})\n${task.text}\nEXPECTED ${JSON.stringify(task.expected)}\nQUERY ${query}\nGOT ${printed.replace(/\s+/g, ' ').slice(0, 400)}\n`);
  }
}

// frictions(setId) — what the calls of the command line answered across
// the runs of the set, the failures by tag with an example of each;
// reading them marks the set seen.
export function frictions(setId) {
  markSeen(setId, 'frictions');
  const byAnswer = new Map();
  for (const { name, record } of runRecordsOf(setId)) {
    for (const call of record.calls ?? []) {
      if (call.answered === 'value') continue;
      if (!byAnswer.has(call.answered)) byAnswer.set(call.answered, []);
      byAnswer.get(call.answered).push(`${name}: ${call.command.slice(0, 160)}`);
    }
  }
  for (const [answered, examples] of [...byAnswer].sort((left, right) => right[1].length - left[1].length)) {
    console.log(`${String(examples.length).padStart(4)}  ${answered}`);
    for (const example of examples.slice(0, 3)) console.log(`        ${example}`);
  }
}
