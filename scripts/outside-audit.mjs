// The outside audit [QSWRK#review]: a clean Opus reads the tree at HEAD from a
// directory of its own, with no CLAUDE.md, no memory and no MCP server,
// runs `qlang`, and answers `scripts/outside-audit-prompt.txt`. An audit is
// called for by a record in force, `--for D327`, and named after it,
// numbered in the order the audits of that record ran,
// `outside-audit/D327~1.md`; the report opens with its head, what it is and
// the record that called for it, the tree it read and the baseline that tree
// stood on, when it ran and how, and the record holds the run under `Runs.`,
// why it ran given by `--why`. The session writes its reading beside it,
// `D327~1~reading.md`, the fate of each finding in it, and the audit leaves
// with its record at the move of the baseline unless a text in force cites
// it [QSWRK#baseline]. The start of the reader, the refusals, the number and
// the head are the ones every run of the research shares [QSWRK#review].
//
// Usage: node scripts/outside-audit.mjs --for Dnn [--why "…"]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RESEARCH } from './decision-records.mjs';
import {
  headOf, holdTheRun, minuteOf, nextRunOf, refuseASecondRun, refuseNoRecordInForce, runLine, startReaders, stillTheTree, treeOfTheRun
} from './research-runs.mjs';

const repoRoot = join(import.meta.dirname, '..');
const repoPath = repoRoot.replaceAll('\\', '/');
const auditsDir = join(repoRoot, RESEARCH, 'outside-audit');
const promptPath = join(repoRoot, 'scripts', 'outside-audit-prompt.txt');
const shown = path => relative(repoRoot, path).replaceAll('\\', '/');
const valueAfter = flag => {
  const at = process.argv.indexOf(flag);
  return at === -1 || at + 1 >= process.argv.length ? null : process.argv[at + 1];
};
const calledFor = valueAfter('--for');
const why = valueAfter('--why');

refuseNoRecordInForce(repoRoot, calledFor, 'an outside audit');
const { tree, baseline, date, onTheBaseline } = treeOfTheRun(repoRoot);
refuseASecondRun(auditsDir, calledFor, 'report', tree, shown);
const report = join(auditsDir, `${nextRunOf(auditsDir, calledFor, 'report')}.md`);

// The reader holds the tree as it stands: it reads the files and runs the
// language, and no git command is given to it.
console.log(`a clean Opus reads ${tree}`);
const [{ answer, started, ended }] = await startReaders(repoRoot, {
  prompts: [{ name: 'the audit', text: readFileSync(promptPath, 'utf8').replaceAll('{{repo}}', repoPath) }],
  allowed: ['Read', 'Grep', 'Glob', 'Bash(qlang:*)', 'Bash(MSYS_NO_PATHCONV=1 qlang:*)'],
  workPrefix: 'qlang-outside-audit-'
});
if (answer === null || !stillTheTree(repoRoot, tree)) process.exit(1);

mkdirSync(auditsDir, { recursive: true });
const what = `An outside audit of qlang for ${calledFor} by a clean Opus answering \`${shown(promptPath)}\`.`;
writeFileSync(report, `${headOf({ what, tree, onTheBaseline, date, started, ended, allowed: '`qlang`' })}\n\n${answer}\n`);
holdTheRun(repoRoot, calledFor, runLine({
  report: shown(report), kind: 'an outside audit of the tree by a clean reader with no instructions',
  tree, baseline, date, from: minuteOf(started), to: minuteOf(ended), why
}));

console.log(`${shown(report)}: its reading to stand beside it as ${shown(report).replace(/\.md$/, '~reading.md')}, every finding with its fate`);
