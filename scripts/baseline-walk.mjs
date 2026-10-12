// The walk of the audit's baseline [D225], [D226], [D227], read once for
// the conventions, which fail on what it finds, and for the screen of the
// work, which shows it. The audit is held against a commit, its
// baseline. A record of the language that the baseline's tree holds is
// held by a case or closed by the line of its fate; the records written
// since wait for the walk no longer than a working day of them; the lines
// that replace a record in part only fall; and the code, the tests and
// the cases cite the records in force, the documents that hold the work
// those in force or waiting on a target.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readDecisionRecords, replacedWhole, isBeingDecided, isHeld } from './decision-records.mjs';

export const RECORDS_A_WALK_TAKES = 20;
const CITING_CODE_ROOTS = ['core/src', 'core/host', 'core/test/unit', 'cli/src', 'cli/test', 'lsp/src', 'lsp/test', 'vscode/src', 'vscode/test', 'site/src', 'scripts'];
const CITING_DOCUMENTS = ['docs/qlang-audit.md', 'docs/qlang-entrypoint.md', 'CLAUDE.md', '.claude/agents/qlang-review.md', 'README.md', 'core/README.md', 'cli/README.md', 'lsp/README.md', 'vscode/README.md', 'site/README.md'];
const CODE_FILE = /\.(mjs|js|ts|astro|peggy)$/;
const UNCITING_FOLDERS = new Set(['node_modules', 'gen', 'dist', '.astro', 'sets', 'runs']);
const CITATION = /\[((?:[DE]\d+)(?:,\s*[DE]\d+)*)\]|\bdecisions? ((?:[DE]\d+)(?:(?:,\s*| and )[DE]\d+)*)/g;

function filesUnder(repoRoot, dir, pattern) {
  const absolute = join(repoRoot, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return UNCITING_FOLDERS.has(entry.name) ? [] : filesUnder(repoRoot, `${dir}/${entry.name}`, pattern);
    return pattern.test(entry.name) ? [`${dir}/${entry.name}`] : [];
  });
}

function citationsIn(text) {
  const cited = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const match of line.matchAll(CITATION)) {
      for (const name of (match[1] ?? match[2]).split(/,\s*| and /)) cited.push({ name, line: index + 1 });
    }
  });
  return cited;
}

function stateOf(record) {
  if (replacedWhole(record)) return `closed by ${record.replacedBy.join(', ')}`;
  return isBeingDecided(record) ? 'which no case holds' : 'which a target alone holds';
}

const git = (repoRoot, ...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

// walkOfBaseline(repoRoot) → { baseline, since, partialNow, partialThen,
// violations }: the baseline the audit names, the records written since
// it, the lines that replace a record in part now and at the baseline,
// and every breach of the walk, each `{ where, problem }`.
export function walkOfBaseline(repoRoot) {
  const audit = readFileSync(join(repoRoot, 'docs', 'qlang-audit.md'), 'utf8').replace(/\s+/g, ' ');
  const baseline = /holds it against commit `([0-9a-f]+)`/.exec(audit)?.[1];
  const walk = { baseline, since: [], partialNow: 0, partialThen: 0, violations: [] };
  if (baseline === undefined) {
    walk.violations.push({ where: 'docs/qlang-audit.md', problem: 'names no baseline commit' });
    return walk;
  }
  let listed;
  try {
    listed = git(repoRoot, 'ls-tree', '-r', '--name-only', baseline, 'docs/decisions/');
  } catch {
    walk.violations.push({ where: 'docs/qlang-audit.md', problem: `names the baseline ${baseline}, which the history lacks` });
    return walk;
  }
  const atBaseline = new Set(listed.split('\n').map(path => /([DE]\d+)\.md$/.exec(path)?.[1]).filter(Boolean));
  const records = readDecisionRecords(repoRoot);
  for (const [name, record] of records) {
    if (atBaseline.has(name) && isBeingDecided(record)) {
      walk.violations.push({ where: `docs/decisions/${name}.md`, problem: `outlived the baseline ${baseline}: no case names it and no line gives its fate` });
    }
  }
  walk.since = [...records.keys()].filter(name => !atBaseline.has(name));
  if (walk.since.length > RECORDS_A_WALK_TAKES) {
    walk.violations.push({ where: 'docs/qlang-audit.md', problem: `${walk.since.length} records since the baseline ${baseline}, from ${walk.since[0]}: the walk is due` });
  }
  const partialLines = text => (text.match(/^Replaced in part by/gm) ?? []).length;
  walk.partialNow = [...records.values()].reduce((sum, record) => sum + partialLines(readFileSync(record.path, 'utf8')), 0);
  // `git grep` ends with 1 where no line matches, a baseline that held none.
  try {
    walk.partialThen = git(repoRoot, 'grep', '-c', '^Replaced in part by', baseline, '--', 'docs/decisions')
      .split('\n').filter(Boolean).reduce((sum, line) => sum + Number(line.split(':').pop()), 0);
  } catch {
    walk.partialThen = 0;
  }
  if (walk.partialNow > walk.partialThen) {
    walk.violations.push({ where: 'docs/decisions', problem: `${walk.partialNow} lines replace a record in part, more than the ${walk.partialThen} of the baseline ${baseline}: prune the part a newer record takes` });
  }
  const notClosed = record => !replacedWhole(record) && !isBeingDecided(record);
  for (const file of CITING_CODE_ROOTS.flatMap(root => filesUnder(repoRoot, root, CODE_FILE))) {
    for (const { name, line } of citationsIn(readFileSync(join(repoRoot, file), 'utf8'))) {
      const record = records.get(name);
      if (record !== undefined && !isHeld(record)) walk.violations.push({ where: `${file}:${line}`, problem: `cites ${name}, ${stateOf(record)}` });
    }
  }
  for (const file of filesUnder(repoRoot, 'core/test/conformance', /\.jsonl$/)) {
    readFileSync(join(repoRoot, file), 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (line.trim() === '' || line.trim().startsWith('//')) return;
      for (const name of [JSON.parse(line).decision ?? []].flat()) {
        const record = records.get(name);
        if (record !== undefined && !notClosed(record)) walk.violations.push({ where: `${file}:${index + 1}`, problem: `names ${name}, ${stateOf(record)}` });
      }
    });
  }
  for (const file of CITING_DOCUMENTS.filter(path => existsSync(join(repoRoot, path)))) {
    for (const { name, line } of citationsIn(readFileSync(join(repoRoot, file), 'utf8'))) {
      const record = records.get(name);
      if (record !== undefined && !notClosed(record)) walk.violations.push({ where: `${file}:${line}`, problem: `cites ${name}, ${stateOf(record)}` });
    }
  }
  return walk;
}
