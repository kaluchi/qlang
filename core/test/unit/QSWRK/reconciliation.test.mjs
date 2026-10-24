import { it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { citableOf } from '../../../../scripts/reconciliation.mjs';

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const treeOf = files => {
  const root = mkdtempSync(join(tmpdir(), 'qlang-reconciliation-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};
const overriding = (...overrides) => citableOf(treeOf({
  'docs/spec/QSAAA-a.md': '# QSAAA · A\n\nThe head.\n\n## one\n\nA rule.\n',
  'docs/journal/D1.md': ['# D1 · A record', '', 'Domain. Process.', ...overrides.map(line => `Overrides ${line}`), ''].join('\n'),
}));

it('cites a chapter and a section the specification holds, and none it lacks', () => {
  const citable = overriding();
  expect([citable('QSAAA'), citable('QSAAA', 'one')]).toEqual([true, true]);
  expect([citable('QSAAA', 'two'), citable('QSBBB'), citable('QSBBB', 'one')]).toEqual([false, false, false]);
});

it('cites a section a record in transit brings into a chapter the specification holds, and no other the chapter lacks', () => {
  const citable = overriding('[QSAAA#two]');
  expect([citable('QSAAA', 'two'), citable('QSAAA', 'three')]).toEqual([true, false]);
});

it('cites a chapter a record in transit brings whole, and any section of it', () => {
  const citable = overriding('[QSAAA#one], [QSBBB]');
  expect([citable('QSBBB'), citable('QSBBB', 'any')]).toEqual([true, true]);
});

it('cites no section a chapter lacks where a record in transit overrides that chapter whole', () => {
  const citable = overriding('[QSAAA]');
  expect([citable('QSAAA', 'one'), citable('QSAAA', 'two')]).toEqual([true, false]);
});
