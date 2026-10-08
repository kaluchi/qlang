// The names of a scope [D153]: the nouns of the root and the reader's
// own, the nodes a name with a path declares under its noun, and the
// address that reads one.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { makeTagKeyword } from '../../src/types.mjs';

describe('the names of the scope', () => {
  it('env holds the nouns of the root, a verb of a kind apart', async () => {
    expect(await evalQuery('env | [(has :number) (has :qlang) (has :count) (has :number/AddLeftNotNumberError)]'))
      .toEqual([true, true, false, false]);
  });

  it('a kind the reader declares is a name of its scope', async () => {
    expect(await evalQuery(':Box |~~ A box. ~~| ::spec~() | env | has :Box')).toBe(true);
  });

  it('a noun answers the nodes declared one name under it', async () => {
    const session = await createSession({ sources: [{
      uri: 'shop',
      source: ':shop |~~ A shop. ~~|\n:shop/Order |~~ An order. ~~| ::spec~()\n:shop/Line |~~ A line. ~~| ::spec~()\n:shop/Line/qty ::verb~(1)'
    }] });
    expect([...(await session.evalCell('::shop | manifest')).result])
      .toEqual([makeTagKeyword('shop/Line'), makeTagKeyword('shop/Order')]);
    expect([...await evalQuery('::qlang/values | manifest')]).toEqual([]);
  });
});

describe('the verbs that live on a kind', () => {
  it('a kind lists by address the verbs declared under it, and any value lists its own', async () => {
    expect(await evalQuery('::number | manifest | has ::number/add')).toBe(true);
    expect(await evalQuery('::any | manifest | has ::any/doc')).toBe(true);
    expect(await evalQuery('::string | manifest | has ::string/doc')).toBe(false);
  });

  it('an address the listing answers leads the axes to its verb', async () => {
    expect(await evalQuery('[::number/add ::number/gt] * (spec | /subject) | every ~(eq ::number)')).toBe(true);
  });

  it('a verb of any tagged value lives on the kind of tagged values', async () => {
    expect(await evalQuery('::tagged | manifest | has ::tagged/within')).toBe(true);
  });

  it('a host verb declared under a kind serves its values beneath a tag', async () => {
    const session = await createSession({ sources: [{
      uri: 'tests/typed',
      source: ':string/shout ::verb~(::builtin{:impl :tests/typed/shout})',
      impls: { 'string/shout': text => text.toUpperCase() }
    }] });
    expect((await session.evalCell('::Box("hi") | shout')).result).toBe('HI');
  });

  it('a refusal and a tag the session declares carry no list of verbs', async () => {
    expect(await evalQuery('::number/AddLeftNotNumberError | spec | has :verbs')).toBe(false);
    expect(await evalQuery(':Box ::spec~() | ::Box | spec | has :verbs')).toBe(false);
  });
});

describe('an address reads the node its name declared', () => {
  it('an address with a kind reads the verb declared under that kind', async () => {
    expect(await evalQuery('::vec/count | doc | type')).toEqual(makeTagKeyword('doc'));
    expect(await evalQuery('::vec/count | source | parse | startsWith ":vec/count"')).toBe(true);
    expect(await evalQuery('::vec/count | doc | laws | count | gt 0')).toBe(true);
    expect(await evalQuery('::vec/count | spec | /subject')).toEqual(makeTagKeyword('vec'));
  });

  it('a verb has no address of its own, only through the noun it lives on', async () => {
    expect(await evalQuery('::count | doc !| type')).toEqual(makeTagKeyword('any/DocBindingNotFoundError'));
  });

  it('an address reads the root\'s verb whatever the scope binds under its last name', async () => {
    expect(await evalQuery(':count 5 | ::vec/count | doc | content | contains "number of elements"'))
      .toBe(true);
  });

  it('an address whose kind the verb does not live on names nothing', async () => {
    expect(await evalQuery('::string/sum | doc !| type')).toEqual(makeTagKeyword('any/DocBindingNotFoundError'));
    expect(await evalQuery('::nowhere/nothing | spec !| type')).toEqual(makeTagKeyword('any/SpecBindingNotFoundError'));
  });

  it('a value whose tag no node answers reads no page', async () => {
    expect((await evalQuery('::Box#[3 1] | doc')).tag.name).toBe('any/DocBindingNotFoundError');
  });
});

describe('a name with a path calls the verb its address names', () => {
  it('calls past the bare names of the scope, with the modifiers the call takes', async () => {
    expect(await evalQuery(':count 5 | [1 2 3] | vec/count')).toBe(3);
    expect(await evalQuery('[1 2 3] | vec/filter ~(gt 1)')).toEqual([2, 3]);
  });

  it('an address that names no verb is refused with the address', async () => {
    expect(await evalQuery('[1 2 3] | vec/nothing !| /address')).toEqual(makeTagKeyword('vec/nothing'));
  });
});
