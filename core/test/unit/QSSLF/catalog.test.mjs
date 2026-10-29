import { it, expect } from 'vitest';
import { platformLocator, LANGUAGE_SOURCES } from '../../../src/runtime/bootstrap.mjs';
import { declarationsOutOfOrder } from '../../../../scripts/catalog-order.mjs';
import { verdictOf } from '../../../../scripts/conventions-verdict.mjs';

it('a verb before one its name follows, a noun after a name under it and a name apart from the others under its noun are found, each beside the name it stands after or the noun it stands apart from', () => {
  const planted = [
    { path: 'box.qlang', text: ':Box |~~ A box. ~~|;\n:Box/wrap ~(1);\n:Box/open ~(2);\n' },
    { path: 'crate.qlang', text: ':Crate/lid ~(1);\n:Crate |~~ A crate. ~~|;\n' },
    { path: 'shelf.qlang', text: ':Shelf |~~ A shelf. ~~|;\n:Shelf/a ~(1);\n:vec/b ~(2);\n:Shelf/c ~(3);\n' }
  ];
  expect(declarationsOutOfOrder(planted)).toEqual([
    { path: 'box.qlang', line: 3, name: 'Box/open', problem: 'stands after ::Box/wrap' },
    { path: 'crate.qlang', line: 2, name: 'Crate', problem: 'stands after ::Crate/lid' },
    { path: 'shelf.qlang', line: 4, name: 'Shelf/c', problem: 'stands apart from the names under ::Shelf before it' }
  ]);
});

it('a noun before its names in the order of their names, the names under the noun of another source together after them, and a source of no declaration pass', () => {
  const planted = [
    { path: 'box.qlang', text: ':Box |~~ A box. ~~|;\n:Box/open ~(2);\n:Box/toVec ~(3);\n:Box/wrap ~(1);\n:vec/pack ~(4);\n:vec/stack ~(5);\n' },
    { path: 'value.qlang', text: '5' }
  ];
  expect(declarationsOutOfOrder(planted)).toEqual([]);
});

it('every source of the language declares in that order', async () => {
  const sources = await Promise.all(LANGUAGE_SOURCES.map(async uri => ({ path: uri, text: (await platformLocator(uri)).source })));
  expect(declarationsOutOfOrder(sources)).toEqual([]);
});

it('the check of the conventions fails on a declaration out of that order and names it, and passes on none', () => {
  expect(verdictOf({ catalogOrder: [] })).toEqual({ text: 'check:conventions — OK\n', failed: false });
  const { text, failed } = verdictOf({ catalogOrder: [{ path: 'box.qlang', line: 3, name: 'Box/open', problem: 'stands after ::Box/wrap' }] });
  expect(failed).toBe(true);
  expect(text).toContain('box.qlang:3  ::Box/open stands after ::Box/wrap');
});
