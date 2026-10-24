import { it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { anchorsTheTreeLacks } from '../../../../scripts/anchors.mjs';
import { recordsOverAProbe } from '../../../../scripts/probes-in-transit.mjs';

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const chapter = '# QSAAA · A\n\nThe head names `core/src/kept.mjs`.\n\n## one\n\nThe rule names `core/src/gone.mjs`.\n\n## two\n\nIt quotes “a word” (`core/src/kept.mjs`).\n';
const treeOf = (...overrides) => {
  const root = mkdtempSync(join(tmpdir(), 'qlang-anchors-'));
  roots.push(root);
  const files = {
    'core/src/kept.mjs': 'export const kept = 1;\n',
    'CLAUDE.md': 'Start at `core/src/kept.mjs`.\n',
    'docs/spec/QSAAA-a.md': chapter,
    'docs/journal/D1.md': ['# D1 · A record', '', 'Domain. Process.', ...(overrides.length === 0 ? [] : [`Overrides ${overrides.map(cited => `[${cited}]`).join(', ')}`]), ''].join('\n'),
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};
const broken = (...overrides) => anchorsTheTreeLacks(treeOf(...overrides), join(tmpdir(), 'qlang-no-sister')).map(({ file, anchor, problem }) => [file, anchor, problem.split(',')[0]]);

it('holds a path a chapter names to a file the tree holds, and a quote beside it to the words of that file', () => {
  expect(broken()).toEqual([
    ['docs/spec/QSAAA-a.md', 'core/src/gone.mjs', 'names a file the tree lacks'],
    ['docs/spec/QSAAA-a.md', 'core/src/kept.mjs', 'quotes “a word”'],
  ]);
});

it('leaves a section a record in transit overrides to its closeout, and the sections beside it held', () => {
  expect(broken('QSAAA#one')).toEqual([['docs/spec/QSAAA-a.md', 'core/src/kept.mjs', 'quotes “a word”']]);
});

it('leaves the head of a chapter to its closeout with a section a record in transit overrides', () => {
  const root = treeOf('QSAAA#two');
  writeFileSync(join(root, 'docs/spec/QSAAA-a.md'), chapter.replace('The head names `core/src/kept.mjs`.', 'The head names `core/src/head.mjs`.'));
  expect(anchorsTheTreeLacks(root, join(tmpdir(), 'qlang-no-sister')).map(({ file, anchor }) => [file, anchor])).toEqual([['docs/spec/QSAAA-a.md', 'core/src/gone.mjs']]);
});

it('leaves a chapter a record in transit overrides whole to its closeout, and holds the seed', () => {
  expect(broken('QSAAA')).toEqual([]);
  const root = treeOf('QSAAA');
  writeFileSync(join(root, 'CLAUDE.md'), 'Start at `core/src/gone.mjs`.\n');
  expect(anchorsTheTreeLacks(root, join(tmpdir(), 'qlang-no-sister')).map(({ file, anchor }) => [file, anchor])).toEqual([['CLAUDE.md', 'core/src/gone.mjs']]);
});

it('holds a changed probe of a chapter a record in transit overrides whole for its closeout, and one of a section by a probe of its query', () => {
  const transit = new Map([['D1', ['QSAAA']], ['D2', ['QSBBB#one']], ['D3', ['QSBBB#two']]]);
  const holdsTheQuery = (name, query) => name === 'D2' && query === 'held';
  expect([
    recordsOverAProbe(transit, 'QSAAA', { section: 'one', query: 'asked' }, holdsTheQuery),
    recordsOverAProbe(transit, 'QSBBB', { section: 'one', query: 'held' }, holdsTheQuery),
    recordsOverAProbe(transit, 'QSBBB', { section: 'one', query: 'asked' }, holdsTheQuery),
    recordsOverAProbe(transit, 'QSCCC', { section: 'one', query: 'asked' }, holdsTheQuery)
  ]).toEqual([
    { over: ['D1'], holding: undefined, whole: 'D1' },
    { over: ['D2'], holding: 'D2', whole: undefined },
    { over: ['D2'], holding: undefined, whole: undefined },
    { over: [], holding: undefined, whole: undefined }
  ]);
});
