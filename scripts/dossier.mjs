// The dossier of a section, what a reader handed it reads: its text, the
// records in transit over it, its cases, its test files by their path, the
// code its tests import, the blocks its marks cover, each with the sections
// whose tests reach it, and the code its tests alone reach; and the blocks
// marked astray, whose mark names a section no test of which reaches them
// through its imports while the tests of another do. A test reaches the code
// its imports read, the runner of the cases reaching it for each section that
// holds cases, since a case runs its query through the evaluator [QSREQ#marks].
//
// Usage:
//   node scripts/dossier.mjs QSNAM#scope   the dossier of a section, or of a record its tests hold
//   node scripts/dossier.mjs --astray      the blocks whose mark names a section no test of which reaches them

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { graphOfTree, reachOf } from './import-reach.mjs';
import { marksOfTree } from './marks.mjs';
import { homeOfPath, testsOfSource } from './test-homes.mjs';
import { recordsInTransit } from './reconciliation.mjs';
import { readText } from './tree-reads.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const RUNNER_OF_THE_CASES = 'core/test/unit/QSREQ/cases.test.mjs';
const lsFiles = (root, ...patterns) => execFileSync('git', ['ls-files', ...patterns], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

// The section a file of the cases holds.
const sectionOfCases = path => /^core\/test\/conformance\/(QS[A-Z]{3})\/([a-z][a-z-]*)\.jsonl$/.exec(path)?.slice(1).join('#') ?? null;

// The code a block holds: a file of a workspace past the tests and their
// helpers, whose marks a test file sets by its path.
const isCode = path => homeOfPath(path) === null && !/(^|\/)test\//.test(path);

// reachOfTree(root) → `{ modules, holders }`: the modules of the tree and,
// for each declaration a test reaches by `<path>:<line>`, the sections and
// records whose tests reach it.
export function reachOfTree(root = repoRoot) {
  const modules = graphOfTree(root);
  const withCases = lsFiles(root, 'core/test/conformance').map(sectionOfCases).filter(Boolean);
  const holders = new Map();
  for (const path of modules.keys()) {
    const home = homeOfPath(path);
    if (home === null) continue;
    const names = [home.section ?? home.record, ...(path === RUNNER_OF_THE_CASES ? withCases : [])];
    for (const key of reachOf(modules, path).keys()) {
      if (!holders.has(key)) holders.set(key, new Set());
      for (const name of names) holders.get(key).add(name);
    }
  }
  return { modules, holders };
}

// The sections a mark names, a record in transit standing for the sections
// it overrides.
const namedBy = (names, transit) => new Set([...names].flatMap(name => [name, ...(transit.get(name) ?? [])]));

// blocksReached(root, reach) → each block a mark covers in the code with the
// sections it names and the sections and records whose tests reach a
// declaration in it, `{ path, from, to, names, holders }`.
export function blocksReached(root = repoRoot, { modules, holders } = reachOfTree(root)) {
  const transit = recordsInTransit(root);
  const blocks = [];
  for (const [path, fileBlocks] of marksOfTree(root).blocks) {
    const module = modules.get(path);
    if (module === undefined || !isCode(path)) continue;
    for (const { from, to, names } of fileBlocks) {
      const reaching = new Set();
      for (const declaration of module.declarations) {
        if (declaration.from < from || declaration.from > to) continue;
        for (const name of holders.get(`${path}:${declaration.from}`) ?? []) reaching.add(name);
      }
      blocks.push({ path, from, to, names: namedBy(names, transit), holders: reaching });
    }
  }
  return blocks;
}

// astrayBlocks(blocks) → the blocks whose mark names a section none of whose
// tests reach them, while the tests of another do.
export const astrayBlocks = blocks => blocks.filter(({ names, holders }) => holders.size > 0 && ![...names].some(name => holders.has(name)));

// The text of a section in its chapter, the lines from its heading to the
// next, or the text of a record.
function textOf(root, name) {
  const [chapter, section] = name.split('#');
  if (section === undefined) {
    const path = `docs/journal/${name}.md`;
    return existsSync(join(root, path)) ? { path, from: 1, lines: readText(join(root, path)).split(/\r?\n/) } : null;
  }
  const file = readdirSync(join(root, 'docs', 'spec')).find(entry => entry.startsWith(`${chapter}-`));
  if (file === undefined) return null;
  const lines = readText(join(root, 'docs', 'spec', file)).split(/\r?\n/);
  const from = lines.indexOf(`## ${section}`);
  if (from === -1) return null;
  const next = lines.findIndex((line, at) => at > from && line.startsWith('## '));
  return { path: `docs/spec/${file}`, from: from + 1, lines: lines.slice(from, next === -1 ? undefined : next) };
}

// dossierOf(root, name, reach?) → the dossier of a section or of a record its
// tests hold: `{ name, text, transit, cases, tests, imports, blocks, alone }`.
export function dossierOf(root, name, reach = reachOfTree(root)) {
  const { modules, holders } = reach;
  const transit = [...recordsInTransit(root)].filter(([, overridden]) => overridden.includes(name)).map(([record]) => record);
  const casesPath = lsFiles(root, 'core/test/conformance').find(path => sectionOfCases(path) === name);
  const cases = casesPath === undefined ? null : {
    path: casesPath,
    names: readText(join(root, casesPath)).split(/\r?\n/).filter(line => line.trim() !== '' && !line.trim().startsWith('//')).map(line => JSON.parse(line).name)
  };
  const testPaths = [...modules.keys()].filter(path => { const home = homeOfPath(path); return (home?.section ?? home?.record) === name; });
  const tests = testPaths.map(path => ({ path, ...testsOfSource(readText(join(root, path))) }));
  const imports = new Map();
  const importsOf = (path, seen = new Set()) => {
    if (seen.has(path)) return;
    seen.add(path);
    for (const [, { module, name: imported }] of modules.get(path)?.imports ?? []) {
      if (/(^|\/)test\/helpers\//.test(module)) importsOf(module, seen);
      else if (isCode(module)) {
        if (!imports.has(module)) imports.set(module, new Set());
        imports.get(module).add(imported);
      }
    }
  };
  for (const path of testPaths) importsOf(path);
  const reached = blocksReached(root, reach);
  const marked = new Set([name, ...transit]);
  const blocks = reached.filter(({ names }) => [...names].some(named => marked.has(named)));
  const alone = [];
  for (const [key, reaching] of holders) {
    if (reaching.size !== 1 || !reaching.has(name)) continue;
    const [path, line] = [key.slice(0, key.lastIndexOf(':')), Number(key.slice(key.lastIndexOf(':') + 1))];
    if (!isCode(path)) continue;
    const block = reached.find(candidate => candidate.path === path && candidate.from <= line && line <= candidate.to);
    const declaration = modules.get(path).declarations.find(({ from }) => from === line);
    alone.push({ path, from: line, to: declaration.to, names: block?.names ?? new Set() });
  }
  alone.sort((a, b) => a.path.localeCompare(b.path) || a.from - b.from);
  return { name, text: textOf(root, name), transit, cases, tests, imports, blocks, alone };
}

const spanOf = ({ from, to }) => `${from}-${to === Infinity ? 'end' : to}`;
const listed = names => [...names].sort().join(', ');

function printDossier({ name, text, transit, cases, tests, imports, blocks, alone }) {
  console.log(`${name}, the dossier of a section [QSREQ#marks]`);
  console.log(`\nthe text  ${text === null ? 'none: no chapter holds the section and no record bears the name' : `${text.path}:${text.from}-${text.from + text.lines.length - 1}`}`);
  for (const line of text?.lines ?? []) console.log(`  ${line}`);
  if (transit.length > 0) console.log(`\nthe records in transit over it  ${transit.join(' ')}`);
  console.log(`\nthe cases  ${cases === null ? 'none' : `${cases.path}, ${cases.names.length}`}`);
  for (const caseName of cases?.names ?? []) console.log(`  ${caseName}`);
  console.log(`\nthe tests  ${tests.length === 0 ? 'none' : tests.map(({ path, tests: titled }) => `${path}, ${titled.length}`).join(' · ')}`);
  for (const { path, tests: titled, groups } of tests) {
    console.log(`  ${path}`);
    const groupAt = line => [...groups].reverse().find(group => group.line < line);
    let shown = null;
    for (const { line, title } of titled) {
      const group = groupAt(line) ?? null;
      if (group !== shown && group !== null) console.log(`    ${group.title}`);
      shown = group;
      console.log(`${group === null ? '    ' : '      '}${title}`);
    }
  }
  console.log(`\nthe code its tests import${imports.size === 0 ? '  none' : ''}`);
  for (const [path, names] of [...imports].sort()) console.log(`  ${path}  ${[...names].sort().join(' ')}`);
  if (cases !== null) console.log(`  and every module of the core through the evaluator, which its cases run their queries by`);
  console.log(`\nthe blocks that cite it${blocks.length === 0 ? '  none' : ''}`);
  for (const block of blocks) {
    const reached = block.holders.has(name) || transit.some(record => block.holders.has(record));
    console.log(`  ${block.path}:${spanOf(block)}  ${reached ? 'reached by its tests' : block.holders.size === 0 ? 'reached by no test' : `reached by the tests of ${listed(block.holders)} alone`}`);
  }
  console.log(`\nthe code its tests alone reach${alone.length === 0 ? '  none' : ''}`);
  for (const declaration of alone) console.log(`  ${declaration.path}:${spanOf(declaration)}  marked ${declaration.names.size === 0 ? 'by nothing' : listed(declaration.names)}`);
}

const [command] = process.argv.slice(2);
if (process.argv[1]?.endsWith('dossier.mjs')) {
  if (command === '--astray') {
    const astray = astrayBlocks(blocksReached(repoRoot));
    for (const { path, from, to, names, holders } of astray) console.log(`${path}:${spanOf({ from, to })}  marked ${listed(names)}, reached by the tests of ${listed(holders)}`);
    console.log(`astray: ${astray.length} blocks whose mark names a section no test of which reaches them, while the tests of another do [QSREQ#marks]`);
  } else if (/^(?:QS[A-Z]{3}#[a-z][a-z-]*|[DE]\d+)$/.test(command ?? '')) {
    printDossier(dossierOf(repoRoot, command));
  } else {
    console.log('usage: node scripts/dossier.mjs <section> | --astray');
    process.exitCode = 2;
  }
}
