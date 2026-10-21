// A keyword equals every keyword of its name, made fresh or read from a
// literal: a set holds it once, the algebra of a map and a set of its
// keys, the one order and `query` over a set read it so, and the printer
// writes it bare or quoted as it reads back.

import { describe, it, expect } from 'vitest';

describe('types.mjs — canonicalKeywordLiteral', async () => {
  it('returns bare form for identifier-safe names', async () => {
    const { canonicalKeywordLiteral } = await import('../../src/types.mjs');
    expect(canonicalKeywordLiteral('foo')).toBe(':foo');
    expect(canonicalKeywordLiteral('qlang/error')).toBe(':qlang/error');
    expect(canonicalKeywordLiteral('true')).toBe(':true');
    expect(canonicalKeywordLiteral('данные/х')).toBe(':данные/х');
  });

  it('returns quoted form for names that need quoting', async () => {
    const { canonicalKeywordLiteral } = await import('../../src/types.mjs');
    expect(canonicalKeywordLiteral('1')).toBe(':"1"');
    expect(canonicalKeywordLiteral('foo bar')).toBe(':"foo bar"');
    expect(canonicalKeywordLiteral('$ref')).toBe(':"$ref"');
    expect(canonicalKeywordLiteral('a/')).toBe(':"a/"');
    expect(canonicalKeywordLiteral('')).toBe(':""');
    expect(canonicalKeywordLiteral('a\nb')).toBe(':"a\\nb"');
  });
});

describe('a set literal holds a keyword once', async () => {
  it('deduplicates keywords by name in Set literals', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const result = await evalQuery('#[:a :b :a]');
    expect(result.length).toBe(2);
  });
});

describe('minus takes off a map the keys a set of keywords names', async () => {
  it('Map×Set minus drops keys present in Set', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const result = await evalQuery('[{:a 1 :b 2 :c 3}, #[:b]] | minus');
    expect(result.size).toBe(2);
    expect(result.has('a')).toBe(true);
    expect(result.has('c')).toBe(true);
  });
});

describe('has over a set of values that are no keywords', async () => {
  it('finds number in Set', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('#[1 2 3] | has 2')).toBe(true);
    expect(await evalQuery('#[1 2 3] | has 9')).toBe(false);
  });
});

describe('minus and inter over a set of keywords and other values', async () => {
  it('Map×Set minus refuses an element that names no key, under the verb of the fold [QSPTH#key]', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const result = await evalQuery('[{:a 1 :b 2}, #[:a true]] | minus !| type');
    expect(result.name).toBe('vec/minus/KeyKindNotTakenError');
  });

  it('Map×Set inter refuses an element that names no key, under the verb of the fold [QSPTH#key]', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const result = await evalQuery('[{:a 1 :b 2 :c 3}, #[:b true]] | inter !| type');
    expect(result.name).toBe('vec/inter/KeyKindNotTakenError');
  });
});

// Keyword / tag ordering — sort / min / max / gt / lt / gte /
// lte pairwise comparability extends to pairs of names through
// lexicographic `.name` compare, the one order of `compareValues` in
// `ordering.mjs`; these tests cover its keyword and tag branches.
describe('the one order over keywords and tags', async () => {
  it('min / max on a Keyword Vec', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect((await evalQuery('[:y :a :m] | min')).name).toBe('a');
    expect((await evalQuery('[:y :a :m] | max')).name).toBe('y');
  });

  it('gt / lt / gte / lte on Keywords compare by .name', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery(':a | gt :b')).toBe(false);
    expect(await evalQuery(':a | lt :b')).toBe(true);
    expect(await evalQuery(':a | gte :a')).toBe(true);
    expect(await evalQuery(':a | lte :a')).toBe(true);
  });

  it('lt on tags compares by .name', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('::A | lt ::B')).toBe(true);
  });

  it('sort keeps keywords of one name side by side', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const result = await evalQuery('[:a :a :b] | sort');
    expect(result.map(k => k.name)).toEqual(['a', 'a', 'b']);
  });
});

// `query` on a Set subject — an index in the one order, which a key
// names none of [QSPTH#query].
describe('query over a set', async () => {
  it('negative index counts from the end', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect((await evalQuery('#[:a :b :c] | query /-1')).name).toBe('c');
  });

  it('out-of-range index returns null', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('#[:a :b :c] | query /99')).toBe(null);
  });

  it('a key names no index of a set, and is refused read softly too', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const err = await evalQuery('#[:a :b] | query /x');
    expect(err.tag.name).toBe('path/IndexNotIntegerError');
  });
});
