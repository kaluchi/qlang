// Runs the probes of a document against the tree. A probe is a line
// beginning with "> " inside a fenced block, followed by the answer the
// document records; under a fence marked `target` the answer is one the
// tree must not give yet. Answers compare as the printer writes them,
// because a probe records what was printed: a literal answer is read
// and printed again, an answer with … matches piece by piece in order,
// and a query that names an `@` operand runs on the command line, then
// in the core, which answers an `@` operand the query declares. A
// literal answer that prints alike and is another value is lossy: the
// printer dropped something the value had. A probe whose line begins
// with `$` is a record of the machine it ran on and is not run. Runs
// wherever the checkout is, CI included, through the core and the
// command line of the checkout.
//
// Usage: node scripts/sensors/run-probes.mjs [document ...]
// Without documents it reads the audit and the entrypoint.

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = join(import.meta.dirname, '..', '..');
const documents = process.argv.length > 2 ? process.argv.slice(2)
  : [join(repoRoot, 'docs', 'qlang-audit.md'), join(repoRoot, 'docs', 'qlang-entrypoint.md')];
const core = file => import(pathToFileURL(join(repoRoot, 'core', 'src', file)).href);
const { evalQuery } = await core('eval.mjs');
const { printValue } = await core('index.mjs');
const { parse } = await core('parse.mjs');
const { deepEqual } = await core('equality.mjs');
const squash = text => text.replace(/\s+/g, ' ').trim();

function probesOf(source) {
  const probes = [];
  let fence = null;
  let open = null;
  const close = () => {
    if (open?.answer.length) probes.push({ ...open, answer: squash(open.answer.join('\n')) });
    open = null;
  };
  source.split('\n').forEach((line, index) => {
    if (line.startsWith('```')) {
      close();
      fence = fence === null ? line.slice(3).trim() : null;
    } else if (fence !== null && line.startsWith('> ')) {
      close();
      open = { target: /\btarget\b/.test(fence), line: index + 1, query: line.slice(2).trim(), answer: [] };
    } else if (open && open.answer.length === 0 && line.startsWith('  ')) {
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
    return execFileSync(process.execPath, [join(repoRoot, 'cli', 'src', 'bin.mjs'), query], { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' });
  } catch (failed) {
    return `${failed.stdout ?? ''}${failed.stderr ?? ''}`;
  }
}

async function printedByCore(query) {
  try { return squash(printValue(await evalQuery(query))); } catch (thrown) { return `threw ${thrown.message}`; }
}

// An answer that is no literal, a raw string the command line printed,
// compares as the text the command line prints.
async function answersAsRecorded({ query, answer }) {
  if (answer.includes('…')) {
    const printed = squash(onCommandLine(query));
    let from = 0;
    for (const piece of answer.split(/\s*…\s*/).filter(Boolean)) {
      const at = printed.indexOf(piece, from);
      if (at < 0) return false;
      from = at + piece.length;
    }
    return true;
  }
  // An `@` operand the core lacks is the command line's; one a query
  // declares, `:@surround …`, the core answers as any other.
  if (/(^|\W)@\w/.test(query) && squash(onCommandLine(query)) === answer) return true;
  // A string prints raw, and its text may read as words of the command form.
  if (typeof await evalQuery(query) === 'string' && squash(onCommandLine(query)) === answer) return true;
  try { parse(answer); } catch { return squash(onCommandLine(query)) === answer; }
  if ((await printedByCore(query)) !== (await printedByCore(answer))) return false;
  try { return deepEqual(await evalQuery(query), await evalQuery(answer)) || 'lossy'; } catch { return 'lossy'; }
}

for (const documentPath of documents) {
  const shownPath = relative(repoRoot, documentPath).split(/[\\/]/).join('/');
  for (const probe of probesOf(readFileSync(documentPath, 'utf8').replace(/\r\n/g, '\n'))) {
    const agrees = await answersAsRecorded(probe);
    const verdict = agrees === 'lossy' ? 'LOSSY' : probe.target ? (agrees ? 'MET' : 'target') : (agrees ? 'ok' : 'STALE');
    console.log(`${verdict.padEnd(7)}${shownPath}:${probe.line}  ${probe.query.replace(/\n/g, ' ').slice(0, 70)}`);
  }
}
