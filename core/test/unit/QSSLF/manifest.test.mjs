import { describe, it, expect } from 'vitest';
import { makeTag } from '../../../src/types.mjs';
import { makeSet } from '../../../src/ordering.mjs';
import { evalQuery, createSession } from '../../../src/session.mjs';

describe('the chain of `filter` as a query reads it', () => {
  it('filter of maps lists under its address its predicate, its answer and the refusal of a verdict that is no boolean', async () => {
    expect(await evalQuery('::map/filter | manifest')).toEqual(makeSet([makeTag('map/filter/ConditionKindNotTakenError'), makeTag('map/filter/answer'), makeTag('map/filter/predicate')]));
  });
});

describe('the names of the scope', () => {
  it('a noun answers the nodes declared one name under it', async () => {
    const session = await createSession({ sources: [{
      uri: 'shop',
      source: ':shop |~~ A shop. ~~|\n:shop/Order |~~ An order. ~~|\n:shop/Line |~~ A line. ~~|\n:shop/Line/qty ~(1)'
    }] });
    expect([...(await session.evalCell('::shop | manifest')).result])
      .toEqual([makeTag('shop/Line'), makeTag('shop/Order')]);
    expect([...await evalQuery('::qlang/values | manifest')]).toEqual([]);
  });
});
