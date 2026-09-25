// Computes every move a branch made on the requirements and on the
// gates against its baseline [D59]: the conformance cases it removed,
// rewrote, marked as targets or moved to other decisions, the targets
// it met, the targets and cases it added, the records of decisions it
// added or rewrote, the gates it touched, and the implementation lines
// that spell a target it met. A clean diff, a green CI and the targets
// carried out in the listing say a branch silenced its signal by work;
// a finding marks what the review reads first. A branch can edit this
// file, so the review runs the baseline's copy:
//
//   git show master:scripts/gate-diff.mjs > gate-diff.mjs
//   node gate-diff.mjs --task D41
//
// Usage: node scripts/gate-diff.mjs [--base <ref>] [--head <ref>] [--task D<n>[,D<n>...]]

import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 }).replace(/\r\n/g, '\n');
const optionOf = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? fallback : process.argv[at + 1];
};
const head = optionOf('head', 'HEAD');
const base = optionOf('base', git('merge-base', 'master', head).trim());
const task = new Set(optionOf('task', '').split(',').filter(Boolean));

// The gates: the runner and the judge it compares with, the scripts of
// the focus and of this diff, the configuration of CI, of the tests and
// of the linter, the instructions of the sessions and the agents, and
// the entrypoint's sensors.
const GATES = [
  /^core\/test\/unit\/conformance\.test\.mjs$/,
  /^core\/src\/equality\.mjs$/,
  /^scripts\//,
  /^\.github\//,
  /(^|\/)vitest\.config\.[cm]?js$/,
  /(^|\/)eslint\.config\.[cm]?js$/,
  /(^|\/)package\.json$/,
  /^CLAUDE\.md$/,
  /^\.claude\//,
  /^docs\/qlang-entrypoint\.md$/,
];

// The cases of a revision by file and name; a line that opens with `//`
// holds no case, as the runner reads it.
function casesAt(revision) {
  const cases = new Map();
  const caseFiles = git('ls-tree', '-r', '--name-only', revision, '--', 'core/test/conformance')
    .split('\n').filter(path => path.endsWith('.jsonl'));
  for (const path of caseFiles) {
    for (const line of git('show', `${revision}:${path}`).split('\n')) {
      if (line.trim() === '' || line.trim().startsWith('//')) continue;
      const conformanceCase = JSON.parse(line);
      cases.set(`${path.replace('core/test/conformance/', '')}#${conformanceCase.name}`, conformanceCase);
    }
  }
  return cases;
}

const decisionsOf = conformanceCase => [conformanceCase.decision ?? []].flat().sort();
const outsideTheTask = conformanceCase => task.size > 0 && decisionsOf(conformanceCase).length > 0
  && !decisionsOf(conformanceCase).some(decision => task.has(decision));

const findings = [];
const notes = [];
const metTargets = [];
const baseCases = casesAt(base);
const headCases = casesAt(head);

for (const [key, before] of baseCases) {
  const after = headCases.get(key);
  if (after === undefined) {
    findings.push(`case removed: ${key}`);
    continue;
  }
  const sameText = after.query === before.query && after.expect === before.expect;
  if (!sameText) findings.push(`case rewritten: ${key}`);
  if (before.target !== true && after.target === true) findings.push(`case marked as a target: ${key}`);
  if (decisionsOf(before).join() !== decisionsOf(after).join()) findings.push(`case moved to other decisions: ${key}`);
  if (before.target === true && after.target !== true && sameText) {
    metTargets.push(after);
    if (outsideTheTask(after)) findings.push(`target met outside the task: ${key} (${decisionsOf(after).join(' ')})`);
    else notes.push(`target met: ${key} (${decisionsOf(after).join(' ')})`);
  }
}
for (const [key, added] of headCases) {
  if (baseCases.has(key)) continue;
  if (added.target === true) findings.push(`target added: ${key}`);
  else if (outsideTheTask(added)) findings.push(`case added outside the task: ${key} (${decisionsOf(added).join(' ')})`);
  else notes.push(`case added: ${key}`);
}

// A record lands once; the one change it takes is the sentence that
// names the record replacing it, with the definitions of its links.
for (const line of git('diff', '--name-status', base, head, '--', 'docs/decisions').split('\n').filter(Boolean)) {
  const [status, path] = line.split('\t');
  if (status === 'A') { findings.push(`record added: ${path}`); continue; }
  if (status !== 'M') { findings.push(`record ${status === 'D' ? 'deleted' : 'moved'}: ${path}`); continue; }
  if (path.endsWith('README.md')) { findings.push(`guide of the records changed: ${path}`); continue; }
  const hunks = git('diff', '-U0', base, head, '--', path).split(/\n(?=@@ )/).slice(1).map(hunk => hunk.split('\n').slice(1));
  const replacementOnly = hunks.every(hunkLines => {
    const changed = hunkLines.filter(changedLine => changedLine !== '');
    return changed.every(changedLine => changedLine.startsWith('+'))
      && (/^\+Replaced (in part )?by \[D\d+\]/.test(changed[0]) || changed.every(added => /^\+\[D\d+\]: D\d+\.md$/.test(added)));
  });
  if (replacementOnly) notes.push(`record replaced: ${path}`);
  else findings.push(`record rewritten: ${path}`);
}

const changedPaths = git('diff', '--name-only', base, head).split('\n').filter(Boolean);
for (const path of changedPaths) {
  if (GATES.some(gate => gate.test(path))) findings.push(`gate touched: ${path}`);
}

// The focus reads the milestones of the audit's route.
function routeAt(revision) {
  const auditText = git('show', `${revision}:docs/qlang-audit.md`);
  const start = auditText.indexOf('\n## The route\n');
  const end = auditText.indexOf('\n## ', start + 1);
  return start < 0 ? '' : auditText.slice(start, end < 0 ? auditText.length : end);
}
if (routeAt(base) !== routeAt(head)) findings.push('route of the audit changed: the focus reads its milestones');

// An implementation that spells a target it met answers the case, not
// the rule.
const implementationAdded = git('diff', '-U0', base, head, '--', 'core/src', 'core/lib', 'cli/src', 'cli/lib', 'lsp/src')
  .split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).join('\n');
for (const met of metTargets) {
  const spellings = [met.query, ...(met.expect.length >= 6 ? [met.expect] : [])];
  if (spellings.some(spelling => implementationAdded.includes(spelling))) {
    findings.push(`implementation spells a target it met: ${met.name}`);
  }
}

const codePaths = changedPaths.filter(path => !GATES.some(gate => gate.test(path))
  && !path.startsWith('core/test/conformance/') && !path.startsWith('docs/decisions/'));
console.log(`gate-diff ${base.slice(0, 7)}..${head}${task.size > 0 ? ` · task ${[...task].join(' ')}` : ''}`);
for (const note of notes) console.log(`  ${note}`);
if (codePaths.length > 0) console.log(`  other files changed: ${codePaths.length}`);
for (const finding of findings) console.log(`! ${finding}`);
console.log(findings.length === 0 ? 'clean' : `${findings.length} finding${findings.length === 1 ? '' : 's'}`);
process.exitCode = findings.length === 0 ? 0 : 1;
