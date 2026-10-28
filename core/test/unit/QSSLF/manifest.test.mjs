import { it, expect } from 'vitest';
import { makeTag } from '../../../src/types.mjs';
import { makeSet } from '../../../src/ordering.mjs';
import { evalQuery, createNotebook } from '../../../src/notebook.mjs';

it('filter of maps lists under its address its predicate, its answer, the refusal of a verdict that is no boolean and the refusal of a predicate of none of its kinds', async () => {
  expect(await evalQuery('::map/filter | manifest')).toEqual(makeSet([makeTag('map/filter/ConditionKindNotTakenError'), makeTag('map/filter/PredicateKindNotTakenError'), makeTag('map/filter/answer'), makeTag('map/filter/predicate')]));
});

it('a noun answers the nodes declared one name under it', async () => {
  const notebook = await createNotebook({ sources: [{
    uri: 'shop',
    source: ':shop |~~ A shop. ~~|;\n:shop/Order |~~ An order. ~~|;\n:shop/Line |~~ A line. ~~|;\n:shop/Line/qty ~(1);'
  }] });
  expect([...(await notebook.evalCell('::shop | manifest')).result])
    .toEqual([makeTag('shop/Line'), makeTag('shop/Order')]);
  expect([...await evalQuery('::qlang/values | manifest')]).toEqual([]);
});
