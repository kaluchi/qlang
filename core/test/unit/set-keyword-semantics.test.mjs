// A keyword equals every keyword of its name, made fresh or read from a
// literal: a set holds it once, `has` finds it, the algebra of sets and
// maps, equality, the one order, `groupBy` and `query` over a set read
// it so, and the printer writes it bare or quoted as it reads back.

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
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('#[:a :b :a]');
    expect(result.length).toBe(2);
  });
});

describe('the algebra of two sets of keywords', async () => {
  it('union deduplicates keywords across Sets', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#[:a :b] #[:b :c]] | union');
    expect(result.length).toBe(3);
  });

  it('minus removes keywords by name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#[:a :b :c] #[:b]] | minus');
    expect(result.length).toBe(2);
  });

  it('inter keeps keywords present in both', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#[:a :b :c] #[:b :d]] | inter');
    expect(result.length).toBe(1);
  });
});

describe('a keyword made fresh is a member of a set', async () => {
  it('has(:key) on Set finds keyword by name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('#[:a :b :c] | has :b')).toBe(true);
    expect(await evalQuery('#[:a :b :c] | has :z')).toBe(false);
  });

  it('deepEqual on Sets with keywords compares by name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const { deepEqual } = await import('../../src/equality.mjs');
    const s1 = await evalQuery('#[:x :y]');
    const s2 = await evalQuery('#[:x :y]');
    expect(deepEqual(s1, s2)).toBe(true);
    const s3 = await evalQuery('#[:x :z]');
    expect(deepEqual(s1, s3)).toBe(false);
  });

  it('Map×Set minus drops keys present in Set', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[{:a 1 :b 2 :c 3}, #[:b]] | minus');
    expect(result.size).toBe(2);
    expect(result.has('a')).toBe(true);
    expect(result.has('c')).toBe(true);
  });

  it('Map×Set inter keeps keys present in Set', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[{:a 1 :b 2 :c 3}, #[:a :c]] | inter');
    expect(result.size).toBe(2);
  });
});

describe('has over a set of values that are no keywords', async () => {
  it('finds number in Set', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('#[1 2 3] | has 2')).toBe(true);
    expect(await evalQuery('#[1 2 3] | has 9')).toBe(false);
  });
});

describe('two sets of different keywords are unequal', async () => {
  it('returns false when keyword names differ between Sets', async () => {
    const { keyword, makeSet } = await import('../../src/types.mjs');
    const { deepEqual } = await import('../../src/equality.mjs');
    const s1 = makeSet([keyword('a'), keyword('b')]);
    const s2 = makeSet([keyword('a'), keyword('c')]);
    expect(deepEqual(s1, s2)).toBe(false);
  });
});

describe('minus and inter over a set of keywords and other values', async () => {
  it('Map×Set minus refuses a member that names no key, under the verb of the fold [D352], [D355]', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[{:a 1 :b 2}, #[:a 42]] | minus !| type');
    expect(result.name).toBe('vec/minus/KeyKindNotTakenError');
  });

  it('Map×Set inter refuses a member that names no key, under the verb of the fold [D352], [D355]', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[{:a 1 :b 2 :c 3}, #[:b 99]] | inter !| type');
    expect(result.name).toBe('vec/inter/KeyKindNotTakenError');
  });
});

describe('the algebra of two sets of values that are no keywords', async () => {
  it('minus of number Sets', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#[1 2 3], #[2]] | minus');
    expect(result.length).toBe(2);
  });

  it('inter of number Sets', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#[1 2 3], #[2 3]] | inter');
    expect(result.length).toBe(2);
  });
});

// Keyword / tag ordering — sort / min / max / gt / lt / gte /
// lte pairwise comparability extends to identifier-shape pairs through
// lexicographic `.name` compare, the one order of `compareValues` in
// `ordering.mjs`; these tests cover its keyword and tag branches.
describe('the one order over keywords and tags', async () => {
  it('sort over a Vec of Keywords lexicographic by .name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[:y :a :m] | sort');
    expect(result.map(k => k.name)).toEqual(['a', 'm', 'y']);
  });

  it('sort over a Set of Keywords answers the vector of its order', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const { isSet } = await import('../../src/types.mjs');
    const result = await evalQuery('#[:y :a :m] | sort');
    expect(isSet(result)).toBe(false);
    expect(result.map(k => k.name)).toEqual(['a', 'm', 'y']);
  });

  it('sort over tag Vec lexicographic by .name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[::Beta ::Alpha ::Gamma] | sort');
    expect(result.map(k => k.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('min / max on a Keyword Vec', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect((await evalQuery('[:y :a :m] | min')).name).toBe('a');
    expect((await evalQuery('[:y :a :m] | max')).name).toBe('y');
  });

  it('gt / lt / gte / lte on Keywords compare by .name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery(':b | gt :a')).toBe(true);
    expect(await evalQuery(':a | gt :b')).toBe(false);
    expect(await evalQuery(':a | lt :b')).toBe(true);
    expect(await evalQuery(':a | gte :a')).toBe(true);
    expect(await evalQuery(':a | lte :a')).toBe(true);
  });

  it('gt / lt on tags compare by .name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('::B | gt ::A')).toBe(true);
    expect(await evalQuery('::A | lt ::B')).toBe(true);
  });

  it('sort with equal keyword neighbours hits the equal-by-name branch', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[:a :a :b] | sort');
    expect(result.map(k => k.name)).toEqual(['a', 'a', 'b']);
  });

  it('gte holds of a keyword and itself', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery(':a | gte :a')).toBe(true);
    expect(await evalQuery(':a | lte :a')).toBe(true);
  });
});

// `groupBy` files the elements of a set into buckets that are sets
// [QSCOL#group].
describe('groupBy over a set files sets', async () => {
  it('partitions a Set into Set buckets keyed by the classifier', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const { isSet } = await import('../../src/types.mjs');
    const result = await evalQuery('#[{:dept :eng :id 1} {:dept :sales :id 2} {:dept :eng :id 3}] | groupBy /dept');
    expect(result).toBeInstanceOf(Map);
    const engBucket = result.get('eng');
    expect(isSet(engBucket)).toBe(true);
    expect(engBucket.length).toBe(2);
  });
});

// `query` on a Set subject — a place in the one order, which a key
// names none of [QSPTH#value].
describe('query over a set', async () => {
  it('positive index returns the n-th-added element', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect((await evalQuery('#[:a :b :c] | query /0')).name).toBe('a');
    expect((await evalQuery('#[:a :b :c] | query /2')).name).toBe('c');
  });

  it('negative index counts from the end', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect((await evalQuery('#[:a :b :c] | query /-1')).name).toBe('c');
  });

  it('out-of-range index returns null', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('#[:a :b :c] | query /99')).toBe(null);
  });

  it('a key names no place of a set, and is refused read softly too', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const err = await evalQuery('#[:a :b] | query /x');
    expect(err.tag.name).toBe('path/IndexNotIntegerError');
  });
});
