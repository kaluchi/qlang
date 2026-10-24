import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { homeOfPath, problemsOfTestFile, titlesOfSource } from '../../../../scripts/test-homes.mjs';
import { marksOfTree } from '../../../../scripts/marks.mjs';
import { graphOfTree, reachOf } from '../../../../scripts/import-reach.mjs';
import { astrayBlocks, blocksReached, dossierOf, reachOfTree } from '../../../../scripts/dossier.mjs';

const context = { sections: new Set(['QSCLI#answer', 'QSHST#source']), heldByItsTests: name => name === 'D404' };
const titled = (...titles) => titles.map(title => `it('${title}', () => {});`).join('\n');
const problems = text => problemsOfTestFile('cli/test/QSCLI/answer.test.mjs', text, context).map(({ line, problem }) => [line, problem]);

describe('the home of a test file', () => {
  it('reads the section a test file stands in by its path, a part of it and the tests of a process of their own among them, and the record a test of a domain holds', () => {
    expect(homeOfPath('cli/test/QSCLI/answer.test.mjs')).toEqual({ section: 'QSCLI#answer' });
    expect(homeOfPath('cli/test/integration/QSCLI/answer.test.mjs')).toEqual({ section: 'QSCLI#answer' });
    expect(homeOfPath('core/test/unit/QSHST/source.loaders.test.mjs')).toEqual({ section: 'QSHST#source' });
    expect(homeOfPath('core/test/unit/D404.test.mjs')).toEqual({ record: 'D404' });
  });

  it('reads no home from a path that names no section, a file of a module and a file under no chapter among them', () => {
    for (const path of ['core/test/unit/parse.test.mjs', 'cli/test/QSCLI.test.mjs', 'core/test/unit/qscli/answer.test.mjs', 'core/test/conformance/QSCLI/answer.test.mjs']) expect(homeOfPath(path), path).toBeNull();
  });

  it('passes a test file at a section its chapter holds and at a record its tests hold, whose titles cite no rule', () => {
    expect(problemsOfTestFile('cli/test/QSCLI/answer.test.mjs', titled('reads -h as the query of the page'), context)).toEqual([]);
    expect(problemsOfTestFile('core/test/unit/D404.test.mjs', titled('reads a nest at once'), context)).toEqual([]);
  });

  it('refuses a test file at no section, at a section its chapter does not hold and at a record no test of a domain holds', () => {
    expect(problemsOfTestFile('cli/test/main.test.mjs', '', context)[0].problem).toContain('stands at no section');
    expect(problemsOfTestFile('cli/test/QSCLI/budget.test.mjs', '', context)[0].problem).toContain('QSCLI#budget, a section its chapter does not hold');
    expect(problemsOfTestFile('core/test/unit/D9999.test.mjs', '', context)[0].problem).toContain('D9999, no record in force');
  });

  it('refuses a line that cites the section its path names, a comment and a string alike, and leaves a citation of another', () => {
    const text = ['// The answer of a query [QSCLI#answer], its colour [QSCLI#colour].', "it('reads -h', () => expect('[QSCLI#answer]').toBeTruthy());"].join('\n');
    expect(problemsOfTestFile('cli/test/QSCLI/answer.test.mjs', text, context).map(({ line, problem }) => [line, problem])).toEqual([
      [1, 'cites [QSCLI#answer], which its path names'], [2, 'cites [QSCLI#answer], which its path names']]);
  });

  it('refuses a title that cites a rule, a section, a chapter or a record, wherever it stands in the title', () => {
    const text = titled('[QSCLI#answer] reads -h', 'reads -h [QSCLI]', 'reads a nest [D404]', 'reads -h as the page');
    expect(problemsOfTestFile('core/test/unit/QSHST/source.test.mjs', text, context).map(({ line, problem }) => [line, problem])).toEqual([
      [1, 'cites [QSCLI#answer] in its title, which its path names'], [2, 'cites [QSCLI] in its title, which its path names'], [3, 'cites [D404] in its title, which its path names']]);
  });
});

it('marks a test file by the section its path names, its whole text, the rules a comment in it cites beside, and finds no orphan in it', () => {
  const tree = mkdtempSync(join(tmpdir(), 'qlang-marks-'));
  try {
    const files = {
      'cli/test/QSCLI/answer.test.mjs': "it('reads -h', () => {});\n",
      'cli/test/QSCLI/repl.test.mjs': "// The prompt is painted [QSCLI#colour].\nit('prompts', () => {});\n",
      'cli/test/helpers/streams.mjs': 'export const streams = {};\n'
    };
    for (const [path, text] of Object.entries(files)) { mkdirSync(dirname(join(tree, path)), { recursive: true }); writeFileSync(join(tree, path), text); }
    execFileSync('git', ['init', '-q'], { cwd: tree });
    execFileSync('git', ['add', '.'], { cwd: tree });
    const { marks, orphans, blocks } = marksOfTree(tree);
    expect(marks.map(({ path, name, line }) => `${path}:${line} ${name}`)).toEqual([
      'cli/test/QSCLI/answer.test.mjs:1 QSCLI#answer', 'cli/test/QSCLI/repl.test.mjs:1 QSCLI#repl', 'cli/test/QSCLI/repl.test.mjs:1 QSCLI#colour']);
    expect(blocks.get('cli/test/QSCLI/answer.test.mjs')).toEqual([{ from: 1, to: Infinity, names: new Set(['QSCLI#answer']) }]);
    expect(orphans).toEqual(['cli/test/helpers/streams.mjs']);
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
});

it('marks an artifact by the citations its comments hold, a citation in a string of its code naming nothing', () => {
  const tree = mkdtempSync(join(tmpdir(), 'qlang-marks-'));
  try {
    const files = {
      'core/src/hint.mjs': "// [QSNAM#scope]\nexport const hint = 'read [QSNAM#reach] for the rest';\n",
      'cli/test/QSCLI/answer.test.mjs': "it('reads -h', () => expect('[D900]').toBeTruthy());\n"
    };
    for (const [path, text] of Object.entries(files)) { mkdirSync(dirname(join(tree, path)), { recursive: true }); writeFileSync(join(tree, path), text); }
    execFileSync('git', ['init', '-q'], { cwd: tree });
    execFileSync('git', ['add', '.'], { cwd: tree });
    expect(marksOfTree(tree).marks.map(({ path, name, line }) => `${path}:${line} ${name}`)).toEqual(['cli/test/QSCLI/answer.test.mjs:1 QSCLI#answer', 'core/src/hint.mjs:1 QSNAM#scope']);
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
});

describe('the titles of the tests', () => {
  it('reads the title of a test from its string, its template and the call of a table, and none from a name', () => {
    const source = ["describe('a group', () => {", "  it('adds', () => {});", '  test(`adds ${1}`, () => {});',
      "  it.each([[1], [2]])('adds %s', () => {});", '  it(name, () => {});', '});'].join('\n');
    expect(titlesOfSource(source)).toEqual([{ line: 2, title: 'adds' }, { line: 3, title: 'adds ${…}' }, { line: 4, title: 'adds %s' }]);
  });

  it('reads no test from a call that hands no body after its title, nor from a member of a value named test', () => {
    const source = ["const check = test => test('adds');", "const words = test => test.name.replace('adds', () => '');", "it.todo('adds');"].join('\n');
    expect(titlesOfSource(source)).toEqual([{ line: 3, title: 'adds' }]);
  });

  it('refuses a title that names a binding its file imports from the code, as the whole title, before a dash or in the shape of a name of code, and a file of the code', () => {
    const text = ["import { main, parse, runQuery, EVAL_LIMIT, keyword } from '../../src/main.mjs';", "it('main', () => {});",
      "it('parse — error handling', () => {});", "it('answers as runQuery does', () => {});", "it('admits EVAL_LIMIT', () => {});",
      "it('reads types.mjs', () => {});", "it('writes a keyword bare', () => {});", "it('parse reads a text', () => {});"].join('\n');
    expect(problems(text)).toEqual([
      [2, 'names `main`, a binding it imports from the code: a title says its rule in the words of its section'],
      [3, 'names `parse`, a binding it imports from the code: a title says its rule in the words of its section'],
      [4, 'names `runQuery`, a binding it imports from the code: a title says its rule in the words of its section'],
      [5, 'names `EVAL_LIMIT`, a binding it imports from the code: a title says its rule in the words of its section'],
      [6, 'names types.mjs, a file of the code: a title says its rule in the words of its section']]);
  });

  it('reads the bindings a test takes apart from an import of its own as imported, and leaves a binding in backquotes and one of vitest or of the helpers of the tests', () => {
    const text = ["import { describe, it } from 'vitest';", "import { captureRepl } from '../helpers/scripted-repl.mjs';",
      "import { runRepl } from '../../src/repl.mjs';", "it('runs `runRepl` on a cell', () => {});", "it('answers as captureRepl writes', () => {});",
      "it('reads a cell', async () => { const { runCell } = await import('../../src/cell.mjs'); });", "it('answers as runCell does', () => {});",
      "it('it — the value itself', () => {});"].join('\n');
    expect(problems(text)).toEqual([[7, 'names `runCell`, a binding it imports from the code: a title says its rule in the words of its section']]);
  });

  it('reads the title of a group as the title of a test', () => {
    const text = ["import { tokenize } from '../../src/highlight.mjs';", "describe('tokenize — a quote [QSHST#tokens]', () => { it('a', () => {}); it('b', () => {}); });", "it('c', () => {});"].join('\n');
    expect(problems(text)).toEqual([[2, 'cites [QSHST#tokens] in its title, which its path names'],
      [2, 'names `tokenize`, a binding it imports from the code: a title says its rule in the words of its section']]);
  });
});

function planted(files, read) {
  const tree = mkdtempSync(join(tmpdir(), 'qlang-marks-'));
  try {
    for (const [path, text] of Object.entries(files)) { mkdirSync(dirname(join(tree, path)), { recursive: true }); writeFileSync(join(tree, path), text); }
    execFileSync('git', ['init', '-q'], { cwd: tree });
    execFileSync('git', ['add', '.'], { cwd: tree });
    return read(tree);
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
}

const lines = (...written) => [...written, ''].join('\n');
const TREE = {
  'core/package.json': JSON.stringify({ name: '@kaluchi/qlang-core', exports: { '.': { import: './src/index.mjs' } }, imports: { '#load': { node: './src/node.mjs', default: './src/web.mjs' } } }),
  'core/src/index.mjs': lines('// The root [QSNAM#scope].', "export * from './a.mjs';", "export { tool as namedTool } from './b.mjs';"),
  'core/src/a.mjs': lines('// The reading of a part [QSNAM#scope].', 'export function reads() { return helper() + { unreadKey: 1 }.unreadKey + table[keyOfTable]; }',
    'function helper() { return 1; }', "const keyOfTable = 'k';", 'const table = { k: 1 };', 'function unreadKey() { return 0; }',
    '// The writing of a part [QSNAM#reach].', 'export function writes() { return 2; }', 'export function takenApart() { return 3; }', 'export function readAsAMember() { return 4; }',
    '// A part no test reaches [QSNAM#scope].', 'export function unread() { return 5; }',
    '// A part read again [D900].', 'export function again() { return new Shelf().count; }', 'class Shelf { count = 6; }',
    '// The third rule [QSNAM#verb].', 'export function third() { return 7; }'),
  'core/src/b.mjs': lines('// A tool [QSNAM#scope], beside the example of a mark, `[QSNAM#reach]`.', 'export function tool() { return 8; }',
    '// What the module registers as it loads [QSNAM#reach].', "import '#load';", 'export const registered = [];', 'registered.push(9);',
    "if (process.argv[1]?.endsWith('b.mjs')) commandOfTheScript();", 'function commandOfTheScript() { return 10; }'),
  'core/src/node.mjs': lines('// Loaded by Node [QSNAM#reach].', 'export const loaded = [];', 'loaded.push(11);'),
  'core/src/web.mjs': lines('// Loaded by a browser [QSNAM#reach].', 'export const loaded = [];', 'loaded.push(12);'),
  'core/src/lent.js': lines('// Lent by require [QSNAM#reach].', 'function lend() { return 13; }', 'module.exports = { lend };'),
  'core/src/whole.mjs': lines('// A module read whole [QSNAM#reach].', "export * from './deep.mjs';", 'export function first() { return 14; }'),
  'core/src/deep.mjs': lines('// What a module read whole exports of another [QSNAM#reach].', 'export function deep() { return 15; }'),
  'core/test/helpers/reader.mjs': lines('// A reader the tests share [QSNAM#scope].', "import { helper } from '../../src/a.mjs';", 'export const readerOf = () => helper;'),
  'core/test/unit/QSNAM/scope.test.mjs': lines("import { reads, again } from '@kaluchi/qlang-core';", "import { readerOf } from '../../helpers/reader.mjs';", "it('reads', () => reads() + again() + readerOf());"),
  'core/test/unit/QSNAM/reach.test.mjs': lines("import * as core from '../../../src/index.mjs';", "import * as whole from '../../../src/whole.mjs';", "it('writes', async () => {", '  core.writes();', '  core.namedTool();',
    "  const { takenApart } = await import('../../../src/a.mjs');", "  return takenApart() + (await import('../../../src/a.mjs')).readAsAMember() + require('../../../src/lent.js').lend() + Object.keys(whole).length;", '});'),
  'core/test/unit/QSREQ/cases.test.mjs': lines("import { third } from '../../../src/a.mjs';", "it('runs the cases', () => third());"),
  'core/test/conformance/QSNAM/verb.jsonl': lines('{"name":"a-case-of-the-third-rule","query":"7","expect":"7"}'),
  'docs/spec/QSNAM-names.md': lines('# QSNAM · Names', '', '## scope', '', 'The first rule.', '', '## reach', '', 'The second rule.', '', '## verb', '', 'The third rule.'),
  'docs/journal/D900.md': lines('# D900 · A record in transit', '', 'Overrides [QSNAM#scope]')
};

const namesReached = (modules, entry) => [...reachOf(modules, entry).values()].filter(({ path }) => path.startsWith('core/src/'))
  .map(({ path, from }) => `${path.slice('core/src/'.length)} ${modules.get(path).declarations.find(declaration => declaration.from === from).names.join(',') || 'as it loads'}`).sort();

describe('the dossier of a section', () => {
  it('reaches the declarations the imports of a test read, through a door of a package and an import of its own for Node, the exports of another module, a member of a module taken whole and the imports its code runs, past the key of a property and the name of a member, and the code each module runs as it loads, the command line of a script aside', () => {
    planted(TREE, tree => {
      const modules = graphOfTree(tree);
      expect(namesReached(modules, 'core/test/unit/QSNAM/scope.test.mjs')).toEqual([
        'a.mjs Shelf', 'a.mjs again', 'a.mjs helper', 'a.mjs keyOfTable', 'a.mjs reads', 'a.mjs table', 'b.mjs as it loads', 'b.mjs registered', 'node.mjs as it loads', 'node.mjs loaded']);
      expect(namesReached(modules, 'core/test/unit/QSNAM/reach.test.mjs')).toEqual([
        'a.mjs readAsAMember', 'a.mjs takenApart', 'a.mjs writes', 'b.mjs as it loads', 'b.mjs registered', 'b.mjs tool', 'deep.mjs deep', 'lent.js as it loads', 'lent.js lend', 'node.mjs as it loads', 'node.mjs loaded', 'whole.mjs first']);
    });
  });

  it('lists a block whose mark names a section none of whose tests reach it while the tests of another do, a record in transit naming the sections it overrides, the runner of the cases reaching for each section that holds cases, and an example of a mark in backquotes naming nothing', () => {
    planted(TREE, tree => {
      const blocks = blocksReached(tree, reachOfTree(tree));
      expect(astrayBlocks(blocks).map(({ path, from, names, holders }) => [path, from, [...names], [...holders]])).toEqual([['core/src/b.mjs', 1, ['QSNAM#scope'], ['QSNAM#reach']]]);
      expect(blocks.find(({ path, from }) => path === 'core/src/a.mjs' && from === 13).names).toEqual(new Set(['D900', 'QSNAM#scope']));
      expect(blocks.find(({ path, from }) => path === 'core/src/a.mjs' && from === 16).holders).toEqual(new Set(['QSREQ#cases', 'QSNAM#verb']));
    });
  });

  it('hands a section with its text, its records in transit, its cases, its tests, the code its tests import, the blocks that cite it and the code its tests alone reach', () => {
    planted(TREE, tree => {
      const one = dossierOf(tree, 'QSNAM#scope');
      expect(one.text).toEqual({ path: 'docs/spec/QSNAM-names.md', from: 3, lines: ['## scope', '', 'The first rule.', ''] });
      expect(one.transit).toEqual(['D900']);
      expect(one.cases).toBeNull();
      expect(one.tests.map(({ path, tests }) => [path, tests.map(({ title }) => title)])).toEqual([['core/test/unit/QSNAM/scope.test.mjs', ['reads']]]);
      expect(one.imports).toEqual(new Map([['core/src/index.mjs', new Set(['reads', 'again'])], ['core/src/a.mjs', new Set(['helper'])]]));
      expect(one.blocks.map(({ path, from, holders }) => [path, from, [...holders].sort()])).toEqual([
        ['core/src/a.mjs', 1, ['QSNAM#scope']], ['core/src/a.mjs', 11, []], ['core/src/a.mjs', 13, ['QSNAM#scope']], ['core/src/b.mjs', 1, ['QSNAM#reach']], ['core/src/index.mjs', 1, []]]);
      expect(one.alone.map(({ path, from }) => `${path}:${from}`)).toEqual(['core/src/a.mjs:2', 'core/src/a.mjs:3', 'core/src/a.mjs:4', 'core/src/a.mjs:5', 'core/src/a.mjs:14', 'core/src/a.mjs:15']);
      expect(dossierOf(tree, 'QSNAM#verb').cases).toEqual({ path: 'core/test/conformance/QSNAM/verb.jsonl', names: ['a-case-of-the-third-rule'] });
      expect(dossierOf(tree, 'D900').text).toEqual({ path: 'docs/journal/D900.md', from: 1, lines: ['# D900 · A record in transit', '', 'Overrides [QSNAM#scope]', ''] });
    });
  });
});

describe('the groups of the tests', () => {
  it('refuses a group of one test and of none, a test of its own standing outside every group', () => {
    const text = ["describe('two', () => { it('a', () => {}); it('b', () => {}); });", "describe('one', () => { it('a', () => {}); });", "describe('none', () => {});"].join('\n');
    expect(problems(text)).toEqual([
      [2, 'groups one test: a group holds two tests or more, a test of its own standing outside every group'],
      [3, 'groups no test: a group holds two tests or more, a test of its own standing outside every group']]);
  });

  it('counts as many a test written in a loop, in a function a call hands on and in a table, and the tests of a group inside another', () => {
    const text = ["describe('a loop', () => { for (const n of [1, 2]) it(`reads ${n}`, () => {}); });",
      "describe('a function handed on', () => { [1, 2].forEach(n => it(`reads ${n}`, () => {})); });",
      "describe('a table', () => { it.each([[1], [2]])('reads %s', () => {}); });",
      "describe('a group of groups', () => { describe('inner', () => { it('a', () => {}); it('b', () => {}); }); });"].join('\n');
    expect(problems(text)).toEqual([]);
  });

  it('refuses a file whose tests stand in one group, the groups inside it among them, and passes one with a test outside it', () => {
    const lone = "describe('the answer', () => { it('a', () => {}); it('b', () => {}); });";
    const nested = "describe('the answer', () => { describe('a', () => { it('a', () => {}); it('b', () => {}); }); describe('b', () => { it('a', () => {}); it('b', () => {}); }); });";
    expect(problems(lone)).toEqual([[1, 'holds its tests in one group, which says again what its path names']]);
    expect(problems(nested)).toEqual([[1, 'holds its tests in one group, which says again what its path names']]);
    expect(problems(`${lone}\nit('c', () => {});`)).toEqual([]);
  });
});
