// Tests for MapEntry doc-comment attachment — the grammar extension
// in grammar.peggy (MapEntryDocPrefix), the eval-time fold in
// eval.mjs (foldEntryDocs / evalMapLit / evalErrorLit), and the
// round-trip preservation through walk.mjs (astNodeToMap /
// qlangMapToAst).
//
// This is the mechanism that preserves the `|~~ ... ~~|` writing
// experience for the Variant-B manifest migration: doc comments
// above a MapEntry attach to the entry's value Map as a :docs Vec,
// so manifest authors keep writing prose exactly as they did when
// the catalog was a sequence of `let(:name, {...})` calls, while
// the underlying storage becomes a single Map literal with docs
// folded in at eval time.

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import { evalQuery } from '../../src/eval.mjs';
import { astNodeToMap, qlangMapToAst } from '../../src/walk.mjs';
import { keyword, isQMap, isVec } from '../../src/types.mjs';

const KW_DOCS = keyword('docs');
const KW_QLANG_KIND = keyword('qlang/kind');

describe('grammar — MapEntry doc-comment prefix', () => {
  it('parses a MapEntry with no doc prefix and assigns docs: []', () => {
    const ast = parse('{:a 1}');
    expect(ast.type).toBe('MapLit');
    const entry = ast.entries[0];
    expect(entry.type).toBe('MapEntry');
    expect(entry.docs).toEqual([]);
  });

  it('captures a single line doc comment before an entry', () => {
    const source = '{\n|~~| field doc\n:a 1}';
    const ast = parse(source);
    expect(ast.entries[0].docs).toEqual([' field doc']);
  });

  it('captures a single block doc comment before an entry', () => {
    const source = '{\n|~~ multi\n    block ~~|\n:a 1}';
    const ast = parse(source);
    expect(ast.entries[0].docs).toEqual([' multi\n    block ']);
  });

  it('accumulates multiple doc comments in declaration order', () => {
    const source = '{\n|~~| first\n|~~| second\n|~~| third\n:a 1}';
    const ast = parse(source);
    expect(ast.entries[0].docs).toEqual([' first', ' second', ' third']);
  });

  it('mixes line and block doc forms in order', () => {
    const source = '{\n|~~| line doc\n|~~ block doc ~~|\n|~~| third\n:a 1}';
    const ast = parse(source);
    expect(ast.entries[0].docs).toEqual([' line doc', ' block doc ', ' third']);
  });

  it('docs on one entry do not leak into sibling entries', () => {
    const source = '{\n|~~| a doc\n:a 1\n|~~| b doc\n:b 2\n:c 3}';
    const ast = parse(source);
    expect(ast.entries).toHaveLength(3);
    expect(ast.entries[0].docs).toEqual([' a doc']);
    expect(ast.entries[1].docs).toEqual([' b doc']);
    expect(ast.entries[2].docs).toEqual([]);
  });

  it('accepts doc prefix on the first entry of a Map literal', () => {
    const source = '{|~~| first-entry doc\n:a 1}';
    const ast = parse(source);
    expect(ast.entries[0].docs).toEqual([' first-entry doc']);
  });

  it('attaches docs inside an ErrorLit entry with the same mechanism', () => {
    const source = '!{\n|~~| err-field doc\n:kind :oops}';
    const ast = parse(source);
    expect(ast.type).toBe('ErrorLit');
    expect(ast.entries[0].docs).toEqual([' err-field doc']);
  });

  it('handles nested Map literal with inner entry docs', () => {
    const source = '{:outer {\n|~~| inner doc\n:x 1}}';
    const ast = parse(source);
    const outerEntry = ast.entries[0];
    expect(outerEntry.docs).toEqual([]);
    // outerEntry.value is a Pipeline wrapping a MapLit OR a bare MapLit
    // depending on grammar; descend until we find the MapLit
    const innerMapLit = outerEntry.value.type === 'MapLit'
      ? outerEntry.value
      : outerEntry.value.steps?.[0] ?? outerEntry.value;
    expect(innerMapLit.type).toBe('MapLit');
    expect(innerMapLit.entries[0].docs).toEqual([' inner doc']);
  });
});

describe('eval — MapEntry docs fold into value Map', () => {
  it('folds a single doc-comment prefix into the value Map as :docs', async () => {
    const source = '{|~~| field doc\n:name {:kind :thing}}';
    const evalResult = await evalQuery(source);
    expect(isQMap(evalResult)).toBe(true);
    const inner = evalResult.get(keyword('name'));
    expect(isQMap(inner)).toBe(true);
    expect(inner.get(keyword('kind'))).toBe(keyword('thing'));
    const docs = inner.get(KW_DOCS);
    expect(isVec(docs)).toBe(true);
    expect(docs).toEqual([' field doc']);
  });

  it('folds multi-doc prefix as ordered Vec', async () => {
    const source = '{|~~| first\n|~~| second\n:x {:a 1}}';
    const evalResult = await evalQuery(source);
    const inner = evalResult.get(keyword('x'));
    expect(inner.get(KW_DOCS)).toEqual([' first', ' second']);
  });

  it('drops docs silently when the entry value is a scalar', async () => {
    const source = '{|~~| would-be doc\n:x 42}';
    const evalResult = await evalQuery(source);
    // 42 is not a Map, so :docs has nowhere to land — drop silently
    expect(evalResult.get(keyword('x'))).toBe(42);
  });

  it('drops docs silently when the entry value is a Vec', async () => {
    const source = '{|~~| would-be doc\n:x [1 2 3]}';
    const evalResult = await evalQuery(source);
    expect(evalResult.get(keyword('x'))).toEqual([1, 2, 3]);
  });

  it('overwrites any pre-existing :docs field on the value Map', async () => {
    // Entry-level comment wins over inline :docs by design: authors
    // who reach for the comment form do so precisely to avoid the
    // inline spelling, so the comment should be authoritative.
    const source = '{|~~| entry docs\n:x {:docs ["inline docs"]}}';
    const evalResult = await evalQuery(source);
    const inner = evalResult.get(keyword('x'));
    expect(inner.get(KW_DOCS)).toEqual([' entry docs']);
  });

  it('applies inside an ErrorLit descriptor as well', async () => {
    // Folding is symmetric: an ErrorLit entry with a doc prefix puts
    // docs on the inner Map value just like a MapLit does. The
    // containing error value wraps the descriptor, and `!| /x |
    // /docs` walks through it.
    const source = '!{|~~| nested doc\n:x {:kind :oops}} !| /x | /docs';
    const evalResult = await evalQuery(source);
    expect(evalResult).toEqual([' nested doc']);
  });

  it('leaves entries without a doc prefix untouched', async () => {
    const source = '{:a {:kind :plain} :b {:kind :other}}';
    const evalResult = await evalQuery(source);
    const aValue = evalResult.get(keyword('a'));
    const bValue = evalResult.get(keyword('b'));
    expect(aValue.has(KW_DOCS)).toBe(false);
    expect(bValue.has(KW_DOCS)).toBe(false);
  });

  it('supports per-entry docs on every sibling in a catalog-like Map', async () => {
    const source = `{
|~~| the count operand
:count {:kind :builtin :category :reducer}

|~~| the filter operand
:filter {:kind :builtin :category :transformer}

|~~| the sort operand
:sort {:kind :builtin :category :transformer}
}`;
    const evalResult = await evalQuery(source);
    expect(evalResult.get(keyword('count')).get(KW_DOCS))
      .toEqual([' the count operand']);
    expect(evalResult.get(keyword('filter')).get(KW_DOCS))
      .toEqual([' the filter operand']);
    expect(evalResult.get(keyword('sort')).get(KW_DOCS))
      .toEqual([' the sort operand']);
  });

  it('folds multi-line block doc comments as single-entry Vec', async () => {
    // A block doc with internal newlines produces ONE Vec entry,
    // matching the OperandCall behavior for let/as doc attachment.
    const source = `{|~~ line one
    line two
    line three ~~|
:x {:a 1}}`;
    const evalResult = await evalQuery(source);
    const docs = evalResult.get(keyword('x')).get(KW_DOCS);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toContain('line one');
    expect(docs[0]).toContain('line two');
    expect(docs[0]).toContain('line three');
  });
});

describe('round-trip — MapEntry docs through the AST-Map codec', () => {
  function stripDecoration(node) {
    const DECORATION_KEYS = new Set([
      'parent', 'id', 'source', 'uri', 'parseId', 'parsedAt', 'schemaVersion'
    ]);
    if (node == null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(stripDecoration);
    const clone = {};
    for (const [k, v] of Object.entries(node)) {
      if (DECORATION_KEYS.has(k)) continue;
      clone[k] = stripDecoration(v);
    }
    return clone;
  }

  function assertRoundTrip(source) {
    const originalAst = parse(source);
    const asMap = astNodeToMap(originalAst);
    const reconstructed = qlangMapToAst(asMap);
    expect(stripDecoration(reconstructed)).toEqual(stripDecoration(originalAst));
    return { originalAst, asMap, reconstructed };
  }

  it('single-doc MapEntry', () => {
    assertRoundTrip('{|~~| single doc\n:x {:a 1}}');
  });

  it('multi-doc MapEntry', () => {
    assertRoundTrip('{|~~| first\n|~~| second\n:x {:a 1}}');
  });

  it('block-doc MapEntry', () => {
    assertRoundTrip('{|~~ block\n    doc ~~|\n:x {:a 1}}');
  });

  it('ErrorLit with entry docs', () => {
    assertRoundTrip('!{|~~| err field\n:kind :oops}');
  });

  it('nested Map literals with docs at different depths', () => {
    assertRoundTrip('{|~~| outer\n:o {|~~| inner\n:i 1}}');
  });

  it('mix of doc-attached and plain entries', () => {
    assertRoundTrip('{|~~| doc\n:a {:x 1} :b {:x 2} |~~| another\n:c {:x 3}}');
  });

  it('AST-Map form exposes :docs under the MapEntry for programmatic walks', () => {
    const { asMap } = assertRoundTrip('{|~~| field doc\n:x {:a 1}}');
    const mapLit = asMap;
    expect(mapLit.get(KW_QLANG_KIND)).toBe(keyword('MapLit'));
    const entryMap = mapLit.get(keyword('entries'))[0];
    expect(entryMap.get(KW_QLANG_KIND)).toBe(keyword('MapEntry'));
    expect(entryMap.get(KW_DOCS)).toEqual([' field doc']);
  });
});

describe('manifest-migration shape — what the Variant-B rewrite produces', () => {
  // Simulates the shape a core.qlang file will take under Variant B:
  // one big Map literal where each built-in entry carries its
  // descriptor Map as the value plus doc-comment metadata attached
  // to the entry, which the evaluator folds onto the descriptor as
  // :docs at eval time. These assertions exercise the full path end
  // to end on a representative-but-minimal catalog.

  const CATALOG_SOURCE = `{
|~~ Returns the number of elements. Polymorphic over
    Vec (length), Set (size), and Map (entry count). ~~|
:count {:qlang/kind :builtin
        :category :vec-reducer
        :subject [:vec :set :map]
        :returns :number
        :modifiers []
        :throws [:CountSubjectNotContainer]}

|~~ Keeps elements where the predicate sub-pipeline evaluates
    truthy. The predicate is applied to each element via fork. ~~|
:filter {:qlang/kind :builtin
         :category :vec-transformer
         :subject :vec
         :returns :vec
         :modifiers [:predicate-lambda]
         :throws [:FilterSubjectNotVec]}
}`;

  it('parses the catalog and stamps docs on each entry', () => {
    const ast = parse(CATALOG_SOURCE);
    expect(ast.type).toBe('MapLit');
    expect(ast.entries).toHaveLength(2);
    expect(ast.entries[0].docs[0]).toContain('Polymorphic');
    expect(ast.entries[1].docs[0]).toContain('predicate sub-pipeline');
  });

  it('evaluates the catalog into a Map where each entry is its descriptor', async () => {
    const catalog = await evalQuery(CATALOG_SOURCE);
    expect(isQMap(catalog)).toBe(true);
    const countEntry = catalog.get(keyword('count'));
    expect(isQMap(countEntry)).toBe(true);
    expect(countEntry.get(keyword('qlang/kind'))).toBe(keyword('builtin'));
    expect(countEntry.get(keyword('category'))).toBe(keyword('vec-reducer'));
    expect(countEntry.get(KW_DOCS)).toHaveLength(1);
    expect(countEntry.get(KW_DOCS)[0]).toContain('Polymorphic');
  });

  it('each descriptor is addressable as data through pipeline projection', async () => {
    // Under Variant B this is how `mul | /docs` will work at the REPL.
    // Here we simulate it with the miniature catalog by piping the
    // catalog Map → /count projection → /docs projection.
    const firstDoc = await evalQuery(CATALOG_SOURCE + ' | /count | /docs | first');
    expect(firstDoc).toContain('Polymorphic');
  });

  it('per-entry :throws field is addressable via the same mechanism', async () => {
    const throwsField = await evalQuery(CATALOG_SOURCE + ' | /filter | /throws');
    expect(throwsField).toEqual([keyword('FilterSubjectNotVec')]);
  });
});
