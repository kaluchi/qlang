// Measures the tree between two refs for a retrospective, the count of
// the seventh condition of the aim among them, `docs/journal/AIM.md`: lines by area
// at both refs, the diff between them, the catalog's surface and the comment
// lines per code line. With
// --steps it prints instead the diff of every step of a stack by the
// areas a branch reports: core sources, catalog, documents, tests,
// tooling. Runs wherever the checkout is with the history it names.
//
// Usage:
//   node scripts/measure.mjs [<fromRef> [<toRef>]]   from the baseline to HEAD where none is named
//   node scripts/measure.mjs --steps <ref> <ref> [<ref>...]
// The decisions it exists for: [QSWRK#diff].
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { baselineOf } from './baseline-walk.mjs';

const repoRoot = join(import.meta.dirname, '..');
const git = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28 });

const FINE_AREAS = ['core sources', 'core catalog', 'core conformance', 'core unit tests', 'cli sources',
  'cli catalog', 'cli tests', 'lsp', 'vscode', 'site', 'scripts', 'spec', 'journal', 'other docs',
  'lockfile', 'rest'];
const COARSE_AREAS = ['core sources', 'catalog', 'documents', 'tests', 'tooling'];

function fineAreaOf(path) {
  if (path.startsWith('core/src/')) return 'core sources';
  if (path.startsWith('core/lib/')) return 'core catalog';
  if (path.startsWith('core/test/conformance/')) return 'core conformance';
  if (path.startsWith('core/test/')) return 'core unit tests';
  if (path.startsWith('cli/') && path.endsWith('.qlang')) return 'cli catalog';
  if (path.startsWith('cli/src/')) return 'cli sources';
  if (path.startsWith('cli/test/')) return 'cli tests';
  if (path.startsWith('docs/spec/')) return 'spec';
  if (path.startsWith('docs/journal/')) return 'journal';
  if (path.startsWith('docs/')) return 'other docs';
  if (path.endsWith('package-lock.json')) return 'lockfile';
  const top = path.split('/')[0];
  return ['lsp', 'vscode', 'site', 'scripts'].includes(top) ? top : 'rest';
}

function coarseAreaOf(path) {
  const fine = fineAreaOf(path);
  if (fine === 'core sources') return 'core sources';
  if (fine.endsWith('catalog')) return 'catalog';
  if (`/${path}`.includes('/test/')) return 'tests';
  if (['spec', 'journal', 'other docs'].includes(fine) || path.endsWith('.md')) return 'documents';
  return 'tooling';
}

function linesByArea(ref) {
  const lines = new Map();
  for (const row of git(['grep', '-I', '-c', '-e', '^', ref, '--', '.']).split('\n').filter(Boolean)) {
    const pathAndCount = row.slice(ref.length + 1);
    const cut = pathAndCount.lastIndexOf(':');
    const area = fineAreaOf(pathAndCount.slice(0, cut));
    lines.set(area, (lines.get(area) ?? 0) + Number(pathAndCount.slice(cut + 1)));
  }
  return lines;
}

function diffByArea(fromRef, toRef, areaOf) {
  const sums = new Map();
  for (const row of git(['diff', '--numstat', '--no-renames', fromRef, toRef]).split('\n').filter(Boolean)) {
    const [added, removed, path] = row.split('\t');
    if (added === '-') continue;
    const sum = sums.get(areaOf(path)) ?? { added: 0, removed: 0 };
    sum.added += Number(added);
    sum.removed += Number(removed);
    sums.set(areaOf(path), sum);
  }
  return sums;
}

// git grep exits 1 when nothing matches, which reads as a count of zero.
function matchingLines(ref, pattern, pathspec) {
  let matches;
  try { matches = git(['grep', '-I', '-c', '-E', '-e', pattern, ref, '--', pathspec]); } catch { return 0; }
  return matches.split('\n').filter(Boolean).reduce((total, row) => total + Number(row.slice(row.lastIndexOf(':') + 1)), 0);
}

const SURFACE = [
  ['core catalog bindings', '^:[A-Za-z]', 'core/lib'],
  ['core catalog tags', '^::[A-Za-z]', 'core/lib'],
  ['conformance cases', '^\\{', 'core/test/conformance'],
];

// The ratio of comment lines to code lines over the core, the command line
// and the language server, which falls on every branch [QSWRK#code].
const COMMENTED_SOURCES = ['core/src', 'cli/src', 'lsp/src'];
function commentRatio(ref) {
  const lines = pattern => COMMENTED_SOURCES.reduce((total, root) => total + matchingLines(ref, pattern, root), 0);
  const comments = lines('^[[:space:]]*//');
  return comments / (lines('[^[:space:]]') - comments);
}

const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

function printSummary(fromRef, toRef) {
  const [before, after] = [linesByArea(fromRef), linesByArea(toRef)];
  const diff = diffByArea(fromRef, toRef, fineAreaOf);
  const total = { before: 0, after: 0, added: 0, removed: 0 };
  console.log(`== ${fromRef} → ${toRef}, ${git(['rev-list', '--count', `${fromRef}..${toRef}`]).trim()} commits`);
  for (const area of FINE_AREAS) {
    const [linesBefore, linesAfter] = [before.get(area) ?? 0, after.get(area) ?? 0];
    const { added, removed } = diff.get(area) ?? { added: 0, removed: 0 };
    if (linesBefore === 0 && linesAfter === 0) continue;
    Object.assign(total, { before: total.before + linesBefore, after: total.after + linesAfter,
      added: total.added + added, removed: total.removed + removed });
    console.log(`${area.padEnd(17)}${String(linesBefore).padStart(6)} → ${String(linesAfter).padEnd(6)}` +
      `${signed(linesAfter - linesBefore).padEnd(7)} +${added} −${removed}`);
  }
  console.log(`${'total'.padEnd(17)}${String(total.before).padStart(6)} → ${String(total.after).padEnd(6)}` +
    `${signed(total.after - total.before).padEnd(7)} +${total.added} −${total.removed}`);
  for (const [label, pattern, pathspec] of SURFACE) {
    console.log(`${label}: ${matchingLines(fromRef, pattern, pathspec)} → ${matchingLines(toRef, pattern, pathspec)}`);
  }
  console.log(`comment lines per code line: ${commentRatio(fromRef).toFixed(3)} → ${commentRatio(toRef).toFixed(3)}`);
}

function printSteps(refs) {
  console.log(`== steps: ${COARSE_AREAS.join(' | ')}`);
  for (let index = 1; index < refs.length; index += 1) {
    const sums = diffByArea(refs[index - 1], refs[index], coarseAreaOf);
    const commits = git(['rev-list', '--count', `${refs[index - 1]}..${refs[index]}`]).trim();
    const cells = COARSE_AREAS.map(area => {
      const { added, removed } = sums.get(area) ?? { added: 0, removed: 0 };
      return `+${added} −${removed}`;
    });
    console.log(`${refs[index]} (${commits}): ${cells.join(' | ')}`);
  }
}

const args = process.argv.slice(2);
if (args[0] === '--steps') printSteps(args.slice(1));
else printSummary(args[0] ?? baselineOf(repoRoot), args[1] ?? 'HEAD');
