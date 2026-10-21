import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { homeOfPath, problemsOfTestFile, titlesOfSource } from '../../../../scripts/test-homes.mjs';
import { marksOfTree } from '../../../../scripts/marks.mjs';

// The sections and the record a planted tree holds: QSCLI#budget is a
// section its chapter does not hold, D9999 a record no journal holds.
const context = { sections: new Set(['QSCLI#answer', 'QSHST#source']), heldByItsTests: name => name === 'D404' };
const titled = (...titles) => titles.map(title => `it('${title}', () => {});`).join('\n');

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

describe('the marks of a tree', () => {
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
});
