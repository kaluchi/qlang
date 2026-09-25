// The nouns a session can reach and the verbs that live on a kind
// [D61], [D62]: `::qlang | manifest`, `/verbs` on a noun's `spec`, and a
// tag name that no tag binds read as the address of a verb.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { makeTagKeyword, keyword } from '../../src/types.mjs';

describe('the nouns of the core', () => {
  it('the core answers the nouns beneath it, itself and its refusals apart', async () => {
    expect(await evalQuery('::qlang | manifest | filter ~(eq ::number) | count')).toBe(1);
    expect(await evalQuery('::qlang | manifest | filter ~(eq ::qlang) | count')).toBe(0);
    expect(await evalQuery('::qlang | manifest | filter ~(eq ::AddLeftNotNumberError) | count')).toBe(0);
  });

  it('a refusal the catalog declares with its category is no noun either', async () => {
    expect(await evalQuery('::qlang | manifest | has ::Error')).toBe(false);
    expect(await evalQuery('::qlang | manifest | has ::ForeignFailureError')).toBe(false);
  });

  it('a noun answers what lies below it, the nouns under its path and the verbs that live on it', async () => {
    const session = await createSession({
      locator: async nsName => (nsName === 'tests/shop'
        ? { source: '::shop/Order |~~ An order. ~~| | ::shop/Line |~~ A line. ~~| | env' }
        : null)
    });
    const cellEntry = await session.evalCell('use :tests/shop | ::shop | manifest');
    expect([...cellEntry.result]).toEqual([makeTagKeyword('shop/Line'), makeTagKeyword('shop/Order')]);
    expect(await evalQuery('::number | manifest | eq (::number | spec | /verbs)')).toBe(true);
    expect([...await evalQuery('::builtin | manifest')]).toEqual([]);
  });

  it('a tag the session declares is its own, beside the providers\' nouns', async () => {
    expect(await evalQuery('::Box |~~ A box. ~~| | ::qlang | manifest | filter ~(eq ::Box) | count')).toBe(0);
  });
});

describe('the verbs that live on a kind', () => {
  it('a kind lists by address the operands whose subject names it, and any value lists its own', async () => {
    expect(await evalQuery('::number | spec | /verbs | has ::number/add')).toBe(true);
    expect(await evalQuery('::qlang/any | spec | /verbs | has ::any/docs')).toBe(true);
    expect(await evalQuery('::string | spec | /verbs | has ::string/docs')).toBe(false);
  });

  it('an address the listing answers leads the axes to its verb', async () => {
    expect(await evalQuery('::number | spec | /verbs | every ~(spec | /subject | eq :number)')).toBe(true);
  });

  it('an address under a kind of the core goes by its short name', async () => {
    expect(await evalQuery('::qlang/vec/count')).toEqual(makeTagKeyword('vec/count'));
  });

  it('a verb of any tagged value lives beneath every kind', async () => {
    expect(await evalQuery('::qlang/any | spec | /verbs | has ::any/within')).toBe(true);
  });

  it('a verb that declares no subject takes any', async () => {
    const session = await createSession({
      locator: async nsName => (nsName === 'tests/bare'
        ? { source: ':shrug ::builtin{:impl :qlang/prim/count}' }
        : null)
    });
    const cellEntry = await session.evalCell('use :tests/bare | ::qlang/any | spec | /verbs | has ::any/shrug');
    expect(cellEntry.result).toBe(true);
  });

  it('a refusal and a tag the session declares carry no list of verbs', async () => {
    expect(await evalQuery('::AddLeftNotNumberError | spec | has :verbs')).toBe(false);
    expect(await evalQuery('::Box {} | ::Box | spec | has :verbs')).toBe(false);
  });
});

describe('a tag name that no tag binds addresses a verb', () => {
  it('an address with a kind reads the verb that lives on that kind', async () => {
    expect(await evalQuery('::qlang/vec/count | docs | count')).toBe(1);
    expect(await evalQuery('::vec/count | source | parse | startsWith ":count"')).toBe(true);
    expect(await evalQuery('::vec/count | examples | count | gt 0')).toBe(true);
    expect(await evalQuery('::vec/count | spec | /category')).toEqual(keyword('containerReducer'));
  });

  it('a verb has no address of its own, only through the noun it lives on', async () => {
    expect(await evalQuery('::count | docs !| type')).toEqual(makeTagKeyword('DocsBindingNotFoundError'));
  });

  it('an address reads the provider\'s verb whatever the scope binds under its name', async () => {
    expect(await evalQuery(':count 5 | ::vec/count | docs | first | /content | contains "number of elements"'))
      .toBe(true);
  });

  it('an address whose kind the verb does not live on names nothing', async () => {
    expect(await evalQuery('::string/count | docs !| type')).toEqual(makeTagKeyword('DocsBindingNotFoundError'));
    expect(await evalQuery('::nowhere/nothing | spec !| type')).toEqual(makeTagKeyword('SpecBindingNotFoundError'));
  });
});

describe('a name with a path calls the verb its address names', () => {
  it('calls past the bindings of the scope, with the modifiers the call takes', async () => {
    expect(await evalQuery(':count 5 | [1 2 3] | vec/count')).toBe(3);
    expect(await evalQuery('[1 2 3] | vec/filter ~(gt 1)')).toEqual([2, 3]);
    expect(await evalQuery('[1 2 3] | qlang/vec/count')).toBe(3);
  });

  it('an address that names no verb is refused with the address', async () => {
    expect(await evalQuery('[1 2 3] | vec/nothing !| /address')).toEqual(makeTagKeyword('vec/nothing'));
  });
});
