import { describe, it, expect } from 'vitest';
import { falseMatchesOf, namesSharedByModules } from '../../../../scripts/grep-ergonomics.mjs';

describe('the names of the modules', () => {
  it('finds a name two modules bear across their kinds and their folders', () => {
    expect(namesSharedByModules(['core/lib/qlang/path.qlang', 'core/src/runtime/path.mjs', 'core/src/index.mjs', 'core/src/runtime/index.mjs', 'core/src/eval.mjs'])).toEqual([
      { name: 'index', paths: ['core/src/index.mjs', 'core/src/runtime/index.mjs'] },
      { name: 'path', paths: ['core/lib/qlang/path.qlang', 'core/src/runtime/path.mjs'] },
    ]);
  });

  it('leaves a test file and a configuration aside by their form, and the generated code, the vendored and the sets of the benchmark', () => {
    expect(namesSharedByModules([
      'core/test/unit/QSHST/notebook.test.mjs', 'playground/test/QSHST/notebook.test.mjs', 'core/vitest.config.mjs', 'playground/vitest.config.mjs',
      'core/gen/grammar.mjs', 'core/src/grammar.peggy', 'node_modules/a/index.js', 'scripts/benchmark/sets/W/index.mjs', 'core/src/index.mjs',
      'README.md', 'core/README.md',
    ])).toEqual([]);
  });
});

describe('the false matches of a name the core exports', () => {
  const texts = new Map([
    ['core/src/types.mjs', 'export function makeKeyword(name) {}\nexport const keyword = name => name;\n'],
    ['core/src/eval.mjs', "import { keyword } from './types.mjs';\nkeyword('a');\n"],
    ['core/src/index.mjs', "export { keyword } from './types.mjs';\n"],
    ['docs/spec/QSLIT-values.md', 'A keyword is a name.\nThe keyword `:a`.\n'],
    ['core/lib/qlang/string.qlang', 'makeKeyword\n'],
  ]);

  it('counts the files that hold a name as a word and neither define, import nor re-export it', () => {
    expect(falseMatchesOf(texts).find(({ name }) => name === 'keyword')).toEqual({ name: 'keyword', module: 'core/src/types.mjs', users: 3, falseFiles: 1, falseLines: 2 });
  });

  it('reads a name inside a longer one as no match, and puts the most false first', () => {
    expect(falseMatchesOf(texts).map(({ name, falseFiles }) => [name, falseFiles])).toEqual([['keyword', 1], ['makeKeyword', 1]]);
  });
});
