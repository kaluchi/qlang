import { it, expect } from 'vitest';
import { evalQuery, createNotebook } from '../../../src/notebook.mjs';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { viewsOfKinds } from '../../../src/runtime/print.mjs';

const viewsOf = async query => viewsOfKinds(await langRuntime())(await evalQuery(query));

it('reads the tag of the value first, then the views of the first kind of the walk of its tags that reveals any, a set those of vectors', async () => {
  expect(await viewsOf('#[3 1 2]')).toEqual([['tag', await evalQuery('::set')], ['count', 3], ['shape', await evalQuery('::shape#[::number]')], ['first', 1], ['last', 3]]);
});

it('reads the views of a map, a string and a trace, each by the verb it names', async () => {
  expect(await viewsOf('{:b 2 :a 1}')).toEqual([['tag', await evalQuery('::map')], ['count', 2], ['shape', await evalQuery('::shape{:b ::number :a ::number}')]]);
  expect(await viewsOf('"abc"')).toEqual([['tag', await evalQuery('::string')], ['count', 3]]);
  expect(await viewsOf('[1 "x" 3] | map ~(mul 2) !| trace')).toEqual([['tag', await evalQuery('::trace')], ['failed', await evalQuery('[~(mul 2) ~(map ~(mul 2))]')], ['subject', 'x'], ['paths', await evalQuery('[/1]')]]);
});

it('reads the tag alone of a value no kind of its walk reveals a view of', async () => {
  expect(await viewsOf('5')).toEqual([['tag', await evalQuery('::number')]]);
});

it('leaves out a view whose verb refuses the value, and one that names no verb', async () => {
  expect((await viewsOf('::trace[]')).map(([name]) => name)).toEqual(['tag', 'failed', 'paths']);
  const notebook = await createNotebook();
  const bag = await notebook.evalCell(':Bag |~~ A bag. ~~| (::kind | accepts |~~ The things. ~~| ::vec | reveals :size) | ::Bag[1 2]');
  expect((await viewsOfKinds(bag.scopeAfterCell)(bag.result)).map(([name]) => name)).toEqual(['tag']);
});
