// The pentimento audit [QSWRK#review]: clean readers, started at once
// as every run of the research starts them, read the texts that state what
// holds beyond the chapters, each a group of the tree, for the earlier layer
// that shows through them, a vestige, an archaism, a shim, a subordination,
// a pentimento or a drift, answering `scripts/pentimento-audit-prompt.txt`.
// An audit is called for by a record in force, which carries its fates,
// `--for Dnn`, and its run is named after it, `pentimento-audit/Dnn~1/`,
// numbered in the order the runs of that record ran; each report is written
// into the run, named after the units of its group, and the session writes
// its reading beside them, `reading.md`, every finding with its probe and
// its fate. The units are the texts the walk of the baseline cites, taken in
// the order the texts rank [QSWRK#documents]: the topic of the language;
// each source of the catalog with the modules of `core/src` that bind most
// of their addresses under its noun; the names of the cases and the titles
// of the tests, read by grep; the other code of the core with the grammar;
// the hosts; the tools with the configurations; and the seeds. Into each
// prompt go its group, the cycles of the imports of `core/src` and the first
// line of every open record.
//
// Usage: node scripts/pentimento-audit.mjs --for Dnn [--why "…"] [--groups N] [--dry]
// `--dry` prints the groups and the cycles and runs no reader.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { CITING_CODE_FILES, CITING_DOCUMENTS, citingCodeOf } from './baseline-walk.mjs';
import { importsOfCore, cyclesOf } from './core-imports.mjs';
import { JOURNAL, RESEARCH, isOpenText } from './decision-records.mjs';
import {
  allowedReading, headOf, holdTheRun, minuteOf, nextRunOf, packByWeight, refuseASecondRun, refuseNoRecordInForce,
  runLine, startReaders, stillTheTree, treeOfTheRun
} from './research-runs.mjs';

const repoRoot = join(import.meta.dirname, '..');
const repoPath = repoRoot.replaceAll('\\', '/');
const valueAfter = flag => {
  const at = process.argv.indexOf(flag);
  return at === -1 || at + 1 >= process.argv.length ? null : process.argv[at + 1];
};
const calledFor = valueAfter('--for');
const why = valueAfter('--why');
const groupCount = Number(valueAfter('--groups') ?? 6);
const auditsDir = join(repoRoot, RESEARCH, 'pentimento-audit');
const promptPath = join(repoRoot, 'scripts', 'pentimento-audit-prompt.txt');
const shown = path => relative(repoRoot, path).replaceAll('\\', '/');
const sizeOf = path => statSync(join(repoRoot, path)).size;
const read = path => readFileSync(join(repoRoot, path), 'utf8');

// The modules of `core/src` by the noun under which they bind most of their
// addresses, read from the calls that register their primitives in the table
// of `core/src/primitives.mjs`.
const code = citingCodeOf(repoRoot);
const coreModules = code.filter(path => path.startsWith('core/src/'));
const BOUND = /register(?:Primitive|StateReader|ReaderOfPassedTags)\(\s*(\[[^\]]*\]|'[^']*')/g;
const nounOf = new Map(coreModules.map(path => {
  const counts = new Map();
  for (const [, addresses] of read(path).matchAll(BOUND)) {
    for (const [, noun] of addresses.matchAll(/'([^'/]+)\//g)) counts.set(noun, (counts.get(noun) ?? 0) + 1);
  }
  const [noun] = [...counts].sort((left, right) => right[1] - left[1])[0] ?? [];
  return [path, noun];
}).filter(([, noun]) => noun !== undefined));

// A unit of the tree: its name, its files and its weight, a unit read by
// grep weighed by an eighth of its characters.
const unitOf = (name, files, byGrep = false) => ({ name, files, byGrep, weight: files.reduce((sum, path) => sum + sizeOf(path), 0) / (byGrep ? 8 : 1) });
const under = (...roots) => code.filter(path => roots.some(root => path.startsWith(`${root}/`)));
const sources = code.filter(path => /^core\/lib\/qlang\/[^/]+\.qlang$/.test(path));
const nounOfSource = path => posix.basename(path, '.qlang');
const placed = new Set();
const catalog = sources.map(source => {
  const modules = coreModules.filter(path => nounOf.get(path) === nounOfSource(source));
  for (const path of [source, ...modules]) placed.add(path);
  return unitOf(nounOfSource(source), [source, ...modules]);
});
const cases = readdirSync(join(repoRoot, 'core/test/conformance'), { recursive: true }).map(String)
  .filter(name => name.endsWith('.jsonl')).map(name => `core/test/conformance/${name.replaceAll('\\', '/')}`);
const tests = under('core/test/unit', 'core/test/helpers', 'core/test/qlang', 'cli/test', 'lsp/test', 'site/test');
const units = [
  unitOf('qlang', ['core/lib/qlang.qlang']),
  ...catalog,
  unitOf('cases', [...cases, ...tests], true),
  unitOf('core', coreModules.filter(path => !placed.has(path))),
  ...['core/host', 'cli/src', 'cli/lib', 'lsp/src', 'vscode/src', 'site/src', 'site/scripts'].map(root => unitOf(root.replace('/', '-'), under(root))),
  unitOf('scripts', under('scripts', 'core/scripts')),
  unitOf('configurations', [...under('.github/workflows'), ...CITING_CODE_FILES.filter(path => existsSync(join(repoRoot, path)))]),
  unitOf('seeds', CITING_DOCUMENTS.filter(path => existsSync(join(repoRoot, path)))),
].filter(unit => unit.files.length > 0);
const groups = packByWeight(units, groupCount);

// The cycles of the imports of `core/src`, as their paths from it.
const cycles = cyclesOf(importsOfCore(repoRoot));
const cyclesText = cycles.length === 0 ? 'none' : cycles.map(component => component.map(path => posix.relative('core/src', path)).join(', ')).map(line => `[${line}]`).join('; ');

const nameOf = group => (group.length === 1 ? group[0].name : `${group[0].name}--${group.at(-1).name}`);
if (process.argv.includes('--dry')) {
  for (const group of groups) console.log(`${nameOf(group)}: ${group.map(unit => `${unit.name}${unit.byGrep ? ' (by grep)' : ''}`).join(' ')}`);
  console.log(`cycles: ${cyclesText}`);
  process.exit(0);
}
refuseNoRecordInForce(repoRoot, calledFor, 'a pentimento audit');

const { tree, baseline, date, onTheBaseline } = treeOfTheRun(repoRoot);
refuseASecondRun(auditsDir, calledFor, 'run', tree, shown);
const run = join(auditsDir, nextRunOf(auditsDir, calledFor, 'run'));

// The first line of every open record, what the readers count as known.
const openRecords = readdirSync(join(repoRoot, JOURNAL)).filter(name => /^D\d+\.md$/.test(name))
  .map(name => read(`${JOURNAL}/${name}`)).filter(isOpenText).map(text => `- ${text.split(/\r?\n/)[0].replace(/^# /, '')}`).join('\n');
const listed = group => group.map(unit => unit.files.map(path => `${path}${unit.byGrep ? ' (by grep)' : ''}`).join(', ')).join('; ');
const prompt = readFileSync(promptPath, 'utf8').replaceAll('{{repo}}', repoPath).replace('{{cycles}}', cyclesText).replace('{{open}}', openRecords);

console.log(`${groups.length} clean readers read ${tree} for the earlier layer`);
const firstStarted = new Date();
const answers = await startReaders(repoRoot, {
  prompts: groups.map(group => ({ name: nameOf(group), text: prompt.replace('{{group}}', listed(group)) })),
  allowed: allowedReading(repoPath),
  workPrefix: 'qlang-pentimento-audit-'
});
if (!stillTheTree(repoRoot, tree)) process.exit(1);

mkdirSync(run, { recursive: true });
for (const { name, answer, started, ended } of answers) {
  if (answer === null) continue;
  const report = join(run, `${name.replaceAll('/', '-')}.md`);
  mkdirSync(dirname(report), { recursive: true });
  const what = `A pentimento audit of ${name} for ${calledFor} by a clean Opus answering \`${shown(promptPath)}\`.`;
  writeFileSync(report, `${headOf({ what, tree, onTheBaseline, date, started, ended, allowed: '`qlang`, `grep` and `git ls-files`' })}\n\n${answer}\n`);
  console.log(`${name}: ${shown(report)}`);
}
if (answers.some(({ answer }) => answer !== null)) {
  holdTheRun(repoRoot, calledFor, runLine({
    report: `${shown(run)}/`, kind: 'a pentimento audit of the tree for it by clean readers, one for each group',
    tree, baseline, date, from: minuteOf(firstStarted), to: minuteOf(new Date()), why
  }));
  console.log(`${shown(run)}: its reading stands beside the reports, every finding with its probe and its fate`);
}
if (answers.some(({ answer }) => answer === null)) process.exitCode = 1;
