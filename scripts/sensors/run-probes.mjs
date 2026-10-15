// Runs the probes of a document against the tree. A probe is a line
// beginning with "> " inside a fenced block, followed by the answer the
// document records; under a fence marked `target` the answer is one the
// tree must not give yet, and a target that states none is met when its
// query answers no error. Answers compare as the printer writes them,
// because a probe records what was printed: a literal answer is read
// and printed again, an answer with … matches piece by piece in order,
// and a string, which prints raw, compares as the command line prints
// it. A literal answer that prints alike and is another value is lossy:
// the printer dropped something the value had. A probe whose line begins
// with `$` is a shell command. One that names the sister project, the
// sensors, which read the transcripts of a machine, or the environment
// is listed as `machine` and left to be run by hand; any other reads the
// repository alone and runs in bash from the root of the checkout, where
// its pipeline fails if any command of it fails and its list of files,
// `git ls-files`, carries `--error-unmatch`, so a file gone from under
// it reads as a failure and never as a repair. A block indented inside
// an item of a list is read as it stands. A probe whose answer changed,
// a target the tree meets, and a list of files without the flag fail the
// run, which `npm run ci` and the checks of a push make [QSWRK#probe]; a
// probe of a section a record in transit overrides is the record's, and an
// answer its work changed waits for the move where the record holds a
// probe of the same query [D300].
//
// Usage: node scripts/sensors/run-probes.mjs [document ...]
// Without documents it reads the open records, whose questions hold
// probes [QSWRK#journal], the records in transit, whose probes hold the
// answers their work changed [D300], and the
// chapters of the specification, whose sections show their rules by
// probes [QSWRK#spec].

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { pipeEnv } from '../pipe-env.mjs';
import { isOpenText, JOURNAL } from '../decision-records.mjs';
import { recordsInTransit } from '../baseline-walk.mjs';

const repoRoot = join(import.meta.dirname, '..', '..');
const recordsDir = join(repoRoot, JOURNAL);
const openRecords = readdirSync(recordsDir).filter(name => /^[DE]\d+\.md$/.test(name)).map(name => join(recordsDir, name))
  .filter(path => isOpenText(readFileSync(path, 'utf8')));
const transit = recordsInTransit(repoRoot);
const transitRecords = [...transit.keys()].map(name => join(recordsDir, `${name}.md`));
const specDir = join(repoRoot, 'docs', 'spec');
const chapters = readdirSync(specDir).filter(name => /^QS[A-Z]{3}-.+\.md$/.test(name)).map(name => join(specDir, name));
const documents = process.argv.length > 2 ? process.argv.slice(2)
  : [...new Set([...openRecords, ...transitRecords, ...chapters])];
const core = file => import(pathToFileURL(join(repoRoot, 'core', 'src', file)).href);
const { evalQuery } = await core('eval.mjs');
const { printValue } = await core('index.mjs');
const { parse } = await core('parse.mjs');
const { deepEqual } = await core('equality.mjs');
const { isErrorValue } = await core('types.mjs');
const squash = text => text.replace(/\s+/g, ' ').trim();

// The probes of a document, each under the section of its heading.
function probesOf(source) {
  const probes = [];
  let fence = null;
  let fenceIndent = 0;
  let open = null;
  let section = '';
  const close = () => {
    if (open?.answer.length || open?.target) probes.push({ ...open, answer: squash(open.answer.join('\n')) });
    open = null;
  };
  source.split('\n').forEach((rawLine, index) => {
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.slice(Math.min(indent, fence === null ? indent : fenceIndent));
    if (fence === null && line.startsWith('## ')) section = line.slice(3).trim();
    if (line.startsWith('```')) {
      close();
      fence = fence === null ? line.slice(3).trim() : null;
      fenceIndent = indent;
    } else if (fence !== null && (line.startsWith('> ') || line.startsWith('$ '))) {
      close();
      open = { shell: line.startsWith('$ '), target: /\btarget\b/.test(fence), section, line: index + 1, query: line.slice(2).trim(), answer: [] };
    } else if (open && !open.shell && open.answer.length === 0 && line.startsWith('  ')) {
      open.query += '\n' + line.trim();
    } else if (open && line.trim() === '') {
      close();
    } else if (open) {
      open.answer.push(line);
    }
  });
  close();
  return probes;
}

function onCommandLine(query) {
  try {
    return execFileSync(process.execPath, [join(repoRoot, 'cli', 'src', 'bin.mjs'), query], { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe', env: pipeEnv });
  } catch (failed) {
    return `${failed.stdout ?? ''}${failed.stderr ?? ''}`;
  }
}

const readsTheRepositoryAlone = command => !/\bjdt\b|scripts\/sensors|^env\b|\$[A-Z]/.test(command);

function printedByShell(command) {
  const commandLine = join(repoRoot, 'cli', 'src', 'bin.mjs').split('\\').join('/');
  try {
    return execFileSync('bash', ['-c', `set -o pipefail\nqlang() { node "${commandLine}" "$@"; }\n${command}`],
      { cwd: repoRoot, encoding: 'utf8', input: '', env: { ...pipeEnv, MSYS_NO_PATHCONV: '1' } });
  } catch (failed) {
    return `${failed.stdout ?? ''}${failed.stderr ?? ''}`;
  }
}

const listsFilesUnguarded = command => /\bgit ls-files\b(?![^|]*--error-unmatch)/.test(command);

function shellVerdict({ query, answer }) {
  if (!readsTheRepositoryAlone(query)) return 'machine';
  if (listsFilesUnguarded(query)) return 'UNGUARDED';
  return squash(printedByShell(query)) === answer ? 'ok' : 'STALE';
}

async function printedByCore(query) {
  try { return squash(printValue(await evalQuery(query))); } catch (thrown) { return `threw ${thrown.message}`; }
}

// The print of an error begins with its literal, `::Tag!{` or `!{`, a
// failure's under the line that says it was raised [QSERR#rest].
const readsAsError = text => /^(\|~\| raised, and no !\| caught it\s+)?(::[\w/.-]+)?!\{/.test(text);

// An answer that is no literal, a raw string the command line printed,
// compares as the text the command line prints. An answer with … holds
// only where the print is an error exactly when the answer is one, so
// the words of a page do not match inside the error that carries the
// page as its subject [QSWRK#probe].
async function answersAsRecorded({ query, answer }) {
  if (answer === '') return !isErrorValue(await evalQuery(query));
  if (answer.includes('…')) {
    const printed = squash(onCommandLine(query));
    if (readsAsError(printed) !== readsAsError(answer)) return false;
    let from = 0;
    for (const piece of answer.split(/\s*…\s*/).filter(Boolean)) {
      const at = printed.indexOf(piece, from);
      if (at < 0) return false;
      from = at + piece.length;
    }
    return true;
  }
  // A string prints raw, and its text may read as words of the command form.
  if (typeof await evalQuery(query) === 'string' && squash(onCommandLine(query)) === answer) return true;
  try { parse(answer); } catch { return squash(onCommandLine(query)) === answer; }
  if ((await printedByCore(query)) !== (await printedByCore(answer))) return false;
  try { return deepEqual(await evalQuery(query), await evalQuery(answer)) || 'lossy'; } catch { return 'lossy'; }
}

const textOf = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// The records in transit over the section of a chapter's probe, and the
// one of them that holds a probe of its query, whose answer the move
// writes into the section [D300].
function holdersOf(chapter, probe) {
  const over = [...transit].filter(([, sections]) => sections.some(cited => cited === chapter || cited === `${chapter}#${probe.section}`)).map(([name]) => name);
  const holding = over.find(name => probesOf(textOf(join(recordsDir, `${name}.md`))).some(held => squash(held.query) === squash(probe.query)));
  return { over, holding };
}

for (const documentPath of documents) {
  const shownPath = relative(repoRoot, documentPath).split(/[\\/]/).join('/');
  const chapter = /(?:^|[\\/])(QS[A-Z]{3})-[^\\/]+\.md$/.exec(documentPath)?.[1];
  for (const probe of probesOf(textOf(documentPath))) {
    let verdict;
    let note = '';
    if (probe.shell) verdict = shellVerdict(probe);
    else {
      const agrees = await answersAsRecorded(probe);
      verdict = agrees === 'lossy' ? 'LOSSY' : probe.target ? (agrees ? 'MET' : 'target') : (agrees ? 'ok' : 'STALE');
    }
    if (verdict === 'STALE' && chapter !== undefined) {
      const { over, holding } = holdersOf(chapter, probe);
      if (holding !== undefined) [verdict, note] = ['waits', `  [${holding} holds its answer until the move]`];
      else if (over.length > 0) note = `  [${over.join(', ')} overrides ${chapter}#${probe.section} and holds no probe of this query]`;
    }
    console.log(`${verdict.padEnd(8)}${shownPath}:${probe.line}  ${probe.query.replace(/\n/g, ' ').slice(0, 70)}${note}`);
    if (['STALE', 'MET', 'UNGUARDED'].includes(verdict)) process.exitCode = 1;
  }
}
if (process.exitCode === 1) console.log('a probe whose answer changed is held until the move by the record in transit over its section, a probe of the same query in the record [D300]; a met target drops its mark, and a probe that lists files fails where one is missing [QSWRK#probe], [QSWRK#target]');
