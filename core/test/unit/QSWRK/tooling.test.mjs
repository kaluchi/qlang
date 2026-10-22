import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { importsOfCore, cyclesOf } from '../../../../scripts/core-imports.mjs';
import * as core from '../../../src/index.mjs';
import { tokenize } from '../../../src/highlight.mjs';
import { evalQuery } from '../../../src/session.mjs';
import { makeTag } from '../../../src/types.mjs';
import { codeOf, exportsOf, namesReadFrom, namesWrittenBy, unreadExports } from '../../../../scripts/root-exports.mjs';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const ABOVE_THE_WORDS = new Set(['core/src/session.mjs', 'core/src/index.mjs']);
const isOfTheWords = path => path.startsWith('core/src/runtime/');
const OF_THE_PARSER = new Set(['core/src/parse.mjs', 'core/gen/grammar.mjs', 'core/src/walk.mjs']);

const reachesIntoTheWords = imports => [...imports].filter(([path]) => !isOfTheWords(path) && !ABOVE_THE_WORDS.has(path))
  .flatMap(([path, targets]) => targets.filter(isOfTheWords).map(target => `${path} → ${target}`));

describe('the imports of core/src', () => {
  const imports = importsOfCore(repoRoot);

  it('form no cycle, the parser and the modules its grammar imports among them', () => {
    expect(cyclesOf(imports)).toEqual([]);
    expect(imports.get('core/src/parse.mjs')).toContain('core/gen/grammar.mjs');
    expect(imports.get('core/gen/grammar.mjs')).toEqual(expect.arrayContaining(['core/src/steps.mjs', 'core/src/walk.mjs']));
  });

  it('reach the words and the root from the session and the root of the package alone', () => {
    expect(reachesIntoTheWords(imports)).toEqual([]);
    expect(imports.get('core/src/session.mjs')).toContain('core/src/runtime/index.mjs');
  });

  it('keep the records of the steps below the parser, reaching none of its modules', () => {
    const reached = new Set();
    const reach = path => imports.get(path).filter(target => !reached.has(target)).forEach(target => { reached.add(target); reach(target); });
    reach('core/src/steps.mjs');
    expect([...reached].filter(path => OF_THE_PARSER.has(path))).toEqual([]);
    expect(reached).toContain('core/src/types.mjs');
  });

  it('find a cycle and a reach into the words where a module writes one, the words and the session aside', () => {
    const written = new Map([
      ['core/src/a.mjs', ['core/src/b.mjs']],
      ['core/src/b.mjs', ['core/src/a.mjs', 'core/src/runtime/c.mjs']],
      ['core/src/runtime/c.mjs', ['core/src/runtime/d.mjs']],
      ['core/src/runtime/d.mjs', []],
      ['core/src/session.mjs', ['core/src/runtime/c.mjs']]
    ]);
    expect(cyclesOf(written)).toEqual([['core/src/a.mjs', 'core/src/b.mjs']]);
    expect(reachesIntoTheWords(written)).toEqual(['core/src/b.mjs → core/src/runtime/c.mjs']);
  });

  it('read the loaders the imports of the package map through every condition', () => {
    expect(imports.get('core/src/runtime/bootstrap.mjs')).toEqual(expect.arrayContaining(['core/host/load-source-node.mjs', 'core/src/load-source-web.mjs']));
  });

  const importsWritten = sources => {
    const tree = mkdtempSync(join(tmpdir(), 'qlang-imports-'));
    try {
      for (const [path, text] of Object.entries(sources)) {
        mkdirSync(dirname(join(tree, path)), { recursive: true });
        writeFileSync(join(tree, path), text);
      }
      return importsOfCore(tree);
    } finally {
      rmSync(tree, { recursive: true, force: true });
    }
  };

  it('read a cycle a module writes in double quotes, through the parser', () => {
    const written = importsWritten({
      'core/package.json': '{"imports":{}}',
      'core/src/a.mjs': 'import { b } from "./b.mjs";\n',
      'core/src/b.mjs': 'import "../gen/grammar.mjs";\n',
      'core/gen/grammar.mjs': '  const a = import("../src/a.mjs");\n',
      'core/host/load.mjs': ''
    });
    expect(cyclesOf(written)).toEqual([['core/gen/grammar.mjs', 'core/src/a.mjs', 'core/src/b.mjs']]);
  });

  it('read a cycle a module closes through a loader the imports of the package map, a name they map to no module naming none', () => {
    const written = importsWritten({
      'core/package.json': JSON.stringify({ imports: { '#load': { node: './host/load.mjs', default: './src/load.mjs' }, '#boot': './src/boot.mjs' } }),
      'core/src/boot.mjs': "import { load } from '#load';\nimport '#unmapped';\n",
      'core/src/load.mjs': '',
      'core/host/load.mjs': "import '#boot';\n",
      'core/gen/grammar.mjs': ''
    });
    expect(written.get('core/src/boot.mjs')).toEqual(['core/host/load.mjs', 'core/src/load.mjs']);
    expect(cyclesOf(written)).toEqual([['core/host/load.mjs', 'core/src/boot.mjs']]);
  });
});

describe('the package root', () => {
  it('parses a source and evaluates a query', async () => {
    expect([...core.parse('42')]).toEqual([42]);
    expect(await core.evalQuery('[1 2 3] | count')).toBe(3);
  });

  it('keeps a session whose cells share their names', async () => {
    const session = await core.createSession();
    await session.evalCell(':x 2');
    expect((await session.evalCell('x | add 1')).result).toBe(3);
  });

  it('prints a value as the literal that reads back as it', async () => {
    const value = await core.evalQuery('{:a #[1 2] :t ::Box[3]}');
    expect(await core.evalQuery(core.printValue(value))).toEqual(value);
  });
});

describe('the doors of the package', () => {
  it('opens its root, its errors, its painter and the sources of its catalog, and no other door', () => {
    const { exports } = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
    expect(Object.keys(exports)).toEqual(['.', './errors', './highlight', './lib/qlang.qlang', './lib/qlang/*.qlang']);
  });

  it('hands the tokens a painter paints by its light door alone', () => {
    expect(core.tokenize).toBeUndefined();
    expect(tokenize('[1] | count', new Set(['count'])).length).toBeGreaterThan(0);
  });
});

describe('the tests compare a value of the language by the tie of the one order', () => {
  it('tells a set and a value under a tag from the vector and the map of no tag', async () => {
    expect(await evalQuery('#[1 2]')).not.toEqual([1, 2]);
    expect(await evalQuery('::Box{:a 1}')).not.toEqual(new Map([['a', 1]]));
    expect(await evalQuery('[#[1]]')).not.toEqual([[1]]);
  });

  it('leaves a value of no kind and a container of one to vitest', () => {
    expect([{ start: 1 }]).toEqual([{ start: 1 }]);
    expect(makeTag('number')).toMatchObject({ name: 'number' });
  });
});

const PACKAGE = '@pkg/core';
const readBy = text => [...namesReadFrom(PACKAGE, text)].sort();

describe('the names a host reads from the package', () => {
  it('reads an import by the name the package exports it under, an alias aside, and a re-export by the name it takes', () => {
    expect(readBy(`import { a, b as c } from '${PACKAGE}'; export { d, e as f } from '${PACKAGE}';`)).toEqual(['a', 'b', 'd', 'e']);
  });

  it('reads the members a namespace of the package reads, imported or dynamic', () => {
    expect(readBy(`import * as core from '${PACKAGE}'; core.a(); other.b();`)).toEqual(['a']);
    expect(readBy(`const core = await import('${PACKAGE}'); core.c;`)).toEqual(['c']);
  });

  it('reads the names a dynamic import takes apart, awaited or in its `then`, the rest taking every name', () => {
    expect(readBy(`const { a } = await import('${PACKAGE}'); import('${PACKAGE}').then(({ b, c: d }) => d);`)).toEqual(['a', 'b', 'c']);
    expect(readBy(`const { a, ...rest } = await import('${PACKAGE}');`)).toEqual(['*', 'a']);
  });

  it('takes every name from a re-export of the whole package, and none from another package, a source that names the package alone parsed', () => {
    expect(readBy(`export * from '${PACKAGE}';`)).toEqual(['*']);
    expect(readBy(`import { a } from '@pkg/other'; import('${PACKAGE}');`)).toEqual([]);
    expect(readBy('interface Props { a: string }')).toEqual([]);
  });

  it('reads a source that requires as a module does, and the frontmatter of an Astro page', () => {
    expect(readBy(`const path = require('path'); import('${PACKAGE}').then(({ a }) => a);`)).toEqual(['a']);
    expect([...namesReadFrom(PACKAGE, codeOf('page.astro', `---\nimport { a } from '${PACKAGE}'\n---\n<p>{a}</p>`))]).toEqual(['a']);
    expect(codeOf('page.astro', '<p>no frontmatter</p>')).toBe('');
  });
});

describe('the surface of the root', () => {
  const rootText = "export { a, b } from './one.mjs';\nexport { c } from './door.mjs';\nexport const d = 1;\nexport * from './two.mjs';\n";

  it('reads each export by name with its module, and the line of every other export', () => {
    expect(exportsOf(rootText)).toEqual({ named: [{ name: 'a', from: './one.mjs' }, { name: 'b', from: './one.mjs' }, { name: 'c', from: './door.mjs' }], otherwise: [3, 4] });
  });

  it('refuses an export otherwise than by name, a name of a module another door opens, and a name no host reads and no page writes', () => {
    const found = unreadExports({ rootText, doorModules: new Set(['./door.mjs']), read: new Set(['a', 'c']), written: namesWrittenBy('`b(x)` and `::qlang`') });
    expect(found).toEqual([
      { line: 3, problem: 'exports otherwise than by name from a module of the core' },
      { line: 4, problem: 'exports otherwise than by name from a module of the core' },
      { name: 'c', problem: 'is re-exported from ./door.mjs, which a door of its own opens' }
    ]);
    expect(unreadExports({ rootText: "export { a } from './one.mjs';", doorModules: new Set(), read: new Set(), written: new Set() }))
      .toEqual([{ name: 'a', problem: 'is read by no host and written by no page of the package' }]);
    expect(unreadExports({ rootText: "export { a } from './one.mjs';", doorModules: new Set(), read: new Set(['*']), written: new Set() })).toEqual([]);
  });
});
