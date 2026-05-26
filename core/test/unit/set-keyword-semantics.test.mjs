// Keyword-aware Set semantics across `evalSetLit`, the setops
// family (`union` / `minus` / `inter` Set×Set, Map×Set), the
// `has` operand on Sets with non-keyword members, and the
// `deepEqual` Set comparator that all rely on the same
// name-based keyword identity. Plus two adjacent fixtures: the
// tagged-JSON codec's `$map` decoder accepting old-format
// `{$keyword: name}`-keyed entries, and the
// `canonicalKeywordLiteral` printer that mints the bare-vs-quoted
// form `printValue` and projection round-trip rely on.
//
// Grouping principle: every test here pins the
// `name`-equality-not-reference-equality invariant on the
// keyword identity surface — a freshly constructed
// `keyword('foo')` and an interned one must collapse to a single
// Set member, be findable by `has(:foo)`, and survive setops
// across heterogeneous-Set composition.

import { describe, it, expect } from 'vitest';

describe('keyword-literal.mjs — canonicalKeywordLiteral', async () => {
  it('returns bare form for identifier-safe names', async () => {
    const { canonicalKeywordLiteral } = await import('../../src/keyword-literal.mjs');
    expect(canonicalKeywordLiteral('foo')).toBe(':foo');
    expect(canonicalKeywordLiteral('qlang/error')).toBe(':qlang/error');
  });

  it('returns quoted form for names that need quoting', async () => {
    const { canonicalKeywordLiteral } = await import('../../src/keyword-literal.mjs');
    expect(canonicalKeywordLiteral('1')).toBe(':"1"');
    expect(canonicalKeywordLiteral('foo bar')).toBe(':"foo bar"');
    expect(canonicalKeywordLiteral('$ref')).toBe(':"$ref"');
    expect(canonicalKeywordLiteral('')).toBe(':""');
  });
});

describe('evalSetLit keyword dedup', async () => {
  it('deduplicates keywords by name in Set literals', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('#[:a :b :a]');
    expect(result.size).toBe(2);
  });
});

describe('setops Set×Set keyword-aware operations', async () => {
  it('union deduplicates keywords across Sets', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#[:a :b] #[:b :c]] | union');
    expect(result.size).toBe(3);
  });

  it('minus removes keywords by name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#[:a :b :c] #[:b]] | minus');
    expect(result.size).toBe(2);
  });

  it('inter keeps keywords present in both', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#[:a :b :c] #[:b :d]] | inter');
    expect(result.size).toBe(1);
  });
});

describe('Set keyword membership without interning', async () => {
  it('has(:key) on Set finds keyword by name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('#[:a :b :c] | has(:b)')).toBe(true);
    expect(await evalQuery('#[:a :b :c] | has(:z)')).toBe(false);
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

describe('has on Set with non-keyword values', async () => {
  it('finds number in Set', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('#[1 2 3] | has(2)')).toBe(true);
    expect(await evalQuery('#[1 2 3] | has(9)')).toBe(false);
  });
});

describe('codec $map with keyword-tagged keys decodes to string-keyed Map', async () => {
  it('decodes old-format $map entries with $keyword keys to string-keyed Maps', async () => {
    const { fromTaggedJSON } = await import('../../src/codec.mjs');
    const oldFormat = { $map: [[{$keyword: 'name'}, 'alice'], [{$keyword: 'age'}, 30]] };
    const result = fromTaggedJSON(oldFormat);
    expect(result.get('name')).toBe('alice');
    expect(result.get('age')).toBe(30);
  });
});

describe('deepEqual Set keyword mismatch', async () => {
  it('returns false when keyword names differ between Sets', async () => {
    const { keyword } = await import('../../src/types.mjs');
    const { deepEqual } = await import('../../src/equality.mjs');
    const s1 = new Set([keyword('a'), keyword('b')]);
    const s2 = new Set([keyword('a'), keyword('c')]);
    expect(deepEqual(s1, s2)).toBe(false);
  });
});

describe('setops keyword-aware minus/inter with mixed Set members', async () => {
  it('Map×Set minus with Set containing non-keyword members', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[{:a 1 :b 2}, #[:a 42]] | minus');
    expect(result.has('b')).toBe(true);
  });

  it('Map×Set inter with Set containing non-keyword members', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[{:a 1 :b 2 :c 3}, #[:b 99]] | inter');
    expect(result.has('b')).toBe(true);
  });
});

describe('setops Set×Set non-keyword elements', async () => {
  it('minus of number Sets', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#[1 2 3], #[2]] | minus');
    expect(result.size).toBe(2);
  });

  it('inter of number Sets', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[#[1 2 3], #[2 3]] | inter');
    expect(result.size).toBe(2);
  });
});

// Keyword / TagKeyword ordering — sort / min / max / gt / lt / gte /
// lte pairwise comparability extends to identifier-shape pairs through
// lexicographic `.name` compare. `checkComparable` /
// `compareScalars` in vec.mjs and `orderingCheck` / `compareOrdering`
// in predicates.mjs share the same contract; these tests cover the
// keyword-and-tag-keyword branches at both sites.
describe('keyword ordering — sort / min / max / gt-family', async () => {
  it('sort over a Vec of Keywords lexicographic by .name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[:y :a :m] | sort');
    expect(result.map(k => k.name)).toEqual(['a', 'm', 'y']);
  });

  it('sort over a Set of Keywords preserves the Set shape', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('#[:y :a :m] | sort');
    expect(result).toBeInstanceOf(Set);
    expect([...result].map(k => k.name)).toEqual(['a', 'm', 'y']);
  });

  it('sort over TagKeyword Vec lexicographic by .name', async () => {
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
    expect(await evalQuery(':b | gt(:a)')).toBe(true);
    expect(await evalQuery(':a | gt(:b)')).toBe(false);
    expect(await evalQuery(':a | lt(:b)')).toBe(true);
    expect(await evalQuery(':a | gte(:a)')).toBe(true);
    expect(await evalQuery(':a | lte(:a)')).toBe(true);
  });

  it('gt / lt on TagKeywords compare by .name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('::B | gt(::A)')).toBe(true);
    expect(await evalQuery('::A | lt(::B)')).toBe(true);
  });

  it('sort with equal keyword neighbours hits the equal-by-name branch', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('[:a :a :b] | sort');
    expect(result.map(k => k.name)).toEqual(['a', 'a', 'b']);
  });

  it('eq on equal keywords through compareScalars equality path', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery(':a | gte(:a)')).toBe(true);
    expect(await evalQuery(':a | lte(:a)')).toBe(true);
  });
});

// `groupBy` on a Set subject mints Set-typed buckets — the
// subject's uniqueness invariant carries into each bucket so the
// value-class signal survives partitioning.
describe('groupBy on a Set subject yields Set buckets', async () => {
  it('partitions a Set into Set buckets keyed by the classifier', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const result = await evalQuery('#[{:dept :eng :id 1} {:dept :sales :id 2} {:dept :eng :id 3}] | groupBy(/dept)');
    expect(result).toBeInstanceOf(Map);
    const engBucket = result.get('eng');
    expect(engBucket).toBeInstanceOf(Set);
    expect(engBucket.size).toBe(2);
  });
});

// `at` on a Set subject — insertion-order indexing through the
// polymorphic dispatch. Non-integer index pairs go through the
// shared `AtIndexNotIntegerError` site that the Vec branch already
// uses.
describe('at on a Set subject', async () => {
  it('positive index returns the n-th-added element', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect((await evalQuery('#[:a :b :c] | at(0)')).name).toBe('a');
    expect((await evalQuery('#[:a :b :c] | at(2)')).name).toBe('c');
  });

  it('negative index counts from the end', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect((await evalQuery('#[:a :b :c] | at(-1)')).name).toBe('c');
  });

  it('out-of-range index returns null', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('#[:a :b :c] | at(99)')).toBe(null);
  });

  it('non-integer index raises AtIndexNotIntegerError', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const err = await evalQuery('#[:a :b] | at(0.5)');
    expect(err.tag.name).toBe('AtIndexNotIntegerError');
  });
});
