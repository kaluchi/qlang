import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as core from '../../../src/index.mjs';
import { tokenize } from '../../../src/highlight.mjs';
import { codeOf, exportsOf, namesReadFrom, namesWrittenBy, unreadExports } from '../../../../scripts/root-exports.mjs';

describe('the package root', () => {
  it('parses a source and evaluates a query', async () => {
    expect([...core.parseSource('42')]).toEqual([42]);
    expect(await core.evalQuery('[1 2 3] | count')).toBe(3);
  });

  it('keeps a notebook whose cells share their names', async () => {
    const notebook = await core.createNotebook();
    await notebook.evalCell(':x 2');
    expect((await notebook.evalCell('x | add 1')).result).toBe(3);
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
