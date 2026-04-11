// Tests for the astNodeToMap / qlangMapToAst codec in walk.mjs —
// bidirectional conversion between the JS-object AST produced by
// parse() and its qlang-Map representation. This codec is the
// foundation for structured :trail, the forthcoming `parse` / `eval`
// reflective operands, and programmatic conduit body inspection.
//
// Two guarantees are under test:
//
//   1. Shape — astNodeToMap produces Maps whose :qlang/kind
//      discriminator, payload fields, and nested structure match the
//      AST-Map layout documented in walk.mjs.
//
//   2. Round-trip — qlangMapToAst ∘ astNodeToMap is structurally the
//      identity on any parse()-produced AST, modulo post-parse
//      decoration (.id / .parent) and root-level metadata (.source /
//      .uri / .parseId / .parsedAt / .schemaVersion) which the codec
//      intentionally does not carry.

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import { astNodeToMap, qlangMapToAst } from '../../src/walk.mjs';
import { keyword, isQMap, isVec } from '../../src/types.mjs';

// Interned discriminator and field keywords used by assertions below.
const KW_QLANG_KIND   = keyword('qlang/kind');
const KW_VALUE        = keyword('value');
const KW_NAME         = keyword('name');
const KW_KEYS         = keyword('keys');
const KW_ARGS         = keyword('args');
const KW_DOCS         = keyword('docs');
const KW_ELEMENTS     = keyword('elements');
const KW_ENTRIES      = keyword('entries');
const KW_KEY          = keyword('key');
const KW_STEPS        = keyword('steps');
const KW_COMBINATOR   = keyword('combinator');
const KW_STEP         = keyword('step');
const KW_LEADING_FAIL = keyword('leadingFail');
const KW_EFFECTFUL    = keyword('effectful');
const KW_PIPELINE     = keyword('pipeline');
const KW_CONTENT      = keyword('content');
const KW_TEXT         = keyword('text');
const KW_LOCATION     = keyword('location');
const KW_START        = keyword('start');
const KW_END          = keyword('end');
const KW_OFFSET       = keyword('offset');
const KW_LINE         = keyword('line');
const KW_COLUMN       = keyword('column');

// Decoration keys stamped by parse-time post-passes (.id from
// assignAstNodeIds, .parent from attachAstParents) and by the parse()
// wrapper on the root (.source / .uri / .parseId / .parsedAt /
// .schemaVersion). astNodeToMap does not round-trip these, so we
// strip them from both sides before structural comparison.
const DECORATION_KEYS = new Set([
  'parent', 'id', 'source', 'uri', 'parseId', 'parsedAt', 'schemaVersion'
]);

function stripDecoration(node) {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(stripDecoration);
  const clone = {};
  for (const [k, v] of Object.entries(node)) {
    if (DECORATION_KEYS.has(k)) continue;
    clone[k] = stripDecoration(v);
  }
  return clone;
}

// assertRoundTrip(source) — parses `source`, round-trips through the
// codec, and asserts structural equality modulo decoration. Returns
// the intermediate artifacts so individual tests can drill into the
// Map form for shape assertions.
function assertRoundTrip(source) {
  const originalAst = parse(source);
  const asMap = astNodeToMap(originalAst);
  const reconstructed = qlangMapToAst(asMap);
  expect(stripDecoration(reconstructed)).toEqual(stripDecoration(originalAst));
  return { originalAst, asMap, reconstructed };
}

describe('astNodeToMap — discriminator and shape', () => {
  it('stamps :qlang/kind on every produced Map', () => {
    const m = astNodeToMap(parse('42'));
    expect(isQMap(m)).toBe(true);
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('NumberLit'));
    expect(m.get(KW_VALUE)).toBe(42);
  });

  it('produces frozen Maps', () => {
    const m = astNodeToMap(parse('42'));
    expect(Object.isFrozen(m)).toBe(true);
  });

  it('preserves :text and :location on every node', () => {
    const m = astNodeToMap(parse('42'));
    expect(m.get(KW_TEXT)).toBe('42');
    const loc = m.get(KW_LOCATION);
    expect(isQMap(loc)).toBe(true);
    const start = loc.get(KW_START);
    expect(isQMap(start)).toBe(true);
    expect(start.get(KW_OFFSET)).toBe(0);
    expect(start.get(KW_LINE)).toBe(1);
    expect(start.get(KW_COLUMN)).toBe(1);
    const end = loc.get(KW_END);
    expect(isQMap(end)).toBe(true);
    expect(end.get(KW_OFFSET)).toBe(2);
  });

  it('encodes scalar literals by kind and value', () => {
    expect(astNodeToMap(parse('42')).get(KW_QLANG_KIND)).toBe(keyword('NumberLit'));
    expect(astNodeToMap(parse('"hi"')).get(KW_QLANG_KIND)).toBe(keyword('StringLit'));
    expect(astNodeToMap(parse('true')).get(KW_QLANG_KIND)).toBe(keyword('BooleanLit'));
    expect(astNodeToMap(parse('false')).get(KW_QLANG_KIND)).toBe(keyword('BooleanLit'));
    expect(astNodeToMap(parse('nil')).get(KW_QLANG_KIND)).toBe(keyword('NilLit'));
    expect(astNodeToMap(parse(':foo')).get(KW_QLANG_KIND)).toBe(keyword('Keyword'));
  });

  it('encodes Keyword :name as its source-form string', () => {
    expect(astNodeToMap(parse(':foo')).get(KW_NAME)).toBe('foo');
    expect(astNodeToMap(parse(':qlang/error')).get(KW_NAME)).toBe('qlang/error');
    expect(astNodeToMap(parse(':"foo bar"')).get(KW_NAME)).toBe('foo bar');
  });

  it('encodes VecLit :elements as a frozen Vec of nested AST-Maps', () => {
    const m = astNodeToMap(parse('[1 2 3]'));
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('VecLit'));
    const elems = m.get(KW_ELEMENTS);
    expect(isVec(elems)).toBe(true);
    expect(elems).toHaveLength(3);
    expect(Object.isFrozen(elems)).toBe(true);
    expect(elems[0].get(KW_QLANG_KIND)).toBe(keyword('NumberLit'));
    expect(elems[0].get(KW_VALUE)).toBe(1);
  });

  it('encodes SetLit :elements', () => {
    const m = astNodeToMap(parse('#{:a :b :c}'));
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('SetLit'));
    expect(m.get(KW_ELEMENTS)).toHaveLength(3);
  });

  it('encodes MapLit :entries with MapEntry wrappers', () => {
    const m = astNodeToMap(parse('{:name "a" :age 30}'));
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('MapLit'));
    const entries = m.get(KW_ENTRIES);
    expect(entries).toHaveLength(2);
    expect(entries[0].get(KW_QLANG_KIND)).toBe(keyword('MapEntry'));
    expect(entries[0].get(KW_KEY).get(KW_QLANG_KIND)).toBe(keyword('Keyword'));
    expect(entries[0].get(KW_KEY).get(KW_NAME)).toBe('name');
  });

  it('encodes ErrorLit with :ErrorLit kind and :entries payload', () => {
    const m = astNodeToMap(parse('!{:kind :oops}'));
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('ErrorLit'));
    expect(m.get(KW_ENTRIES)).toHaveLength(1);
  });

  it('encodes Projection :keys as a Vec of segment strings', () => {
    const m = astNodeToMap(parse('/a/b/c'));
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('Projection'));
    expect(m.get(KW_KEYS)).toEqual(['a', 'b', 'c']);
  });

  it('encodes OperandCall with null :args for bare identifiers', () => {
    const m = astNodeToMap(parse('count'));
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('OperandCall'));
    expect(m.get(KW_NAME)).toBe('count');
    expect(m.get(KW_ARGS)).toBe(null);
  });

  it('encodes OperandCall with Vec :args for called operands', () => {
    const m = astNodeToMap(parse('add(2, 3)'));
    expect(m.get(KW_NAME)).toBe('add');
    const args = m.get(KW_ARGS);
    expect(isVec(args)).toBe(true);
    expect(args).toHaveLength(2);
    expect(args[0].get(KW_VALUE)).toBe(2);
    expect(args[1].get(KW_VALUE)).toBe(3);
  });

  it('preserves OperandCall :effectful flag after decoration', () => {
    const m = astNodeToMap(parse('@callers'));
    expect(m.get(KW_EFFECTFUL)).toBe(true);
  });

  it('encodes Pipeline :steps as uniform PipelineStep wrappers', () => {
    const m = astNodeToMap(parse('[1 2 3] | count | add(1)'));
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('Pipeline'));
    const steps = m.get(KW_STEPS);
    expect(isVec(steps)).toBe(true);
    expect(steps).toHaveLength(3);
    for (const s of steps) {
      expect(isQMap(s)).toBe(true);
      expect(s.get(KW_QLANG_KIND)).toBe(keyword('PipelineStep'));
    }
    expect(steps[0].get(KW_COMBINATOR)).toBe(null);
    expect(steps[1].get(KW_COMBINATOR)).toBe('|');
    expect(steps[2].get(KW_COMBINATOR)).toBe('|');
    expect(m.get(KW_LEADING_FAIL)).toBe(false);
  });

  it('records :leadingFail true on fail-apply-prefixed pipelines', () => {
    // A leading !| forces the parser to emit a Pipeline node even for
    // a single step. filter's argument is such a context.
    const ast = parse('filter(!| /trail)');
    const filterCall = astNodeToMap(ast);
    expect(filterCall.get(KW_QLANG_KIND)).toBe(keyword('OperandCall'));
    const innerArg = filterCall.get(KW_ARGS)[0];
    expect(innerArg.get(KW_QLANG_KIND)).toBe(keyword('Pipeline'));
    expect(innerArg.get(KW_LEADING_FAIL)).toBe(true);
  });

  it('encodes ParenGroup :pipeline as a nested Pipeline Map', () => {
    const m = astNodeToMap(parse('(1 | add(2))'));
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('ParenGroup'));
    const inner = m.get(KW_PIPELINE);
    expect(inner.get(KW_QLANG_KIND)).toBe(keyword('Pipeline'));
  });

  it('encodes plain comments as standalone pipeline steps', () => {
    const m = astNodeToMap(parse('|~ rationale ~| [1 2 3] | count'));
    const steps = m.get(KW_STEPS);
    expect(steps[0].get(KW_STEP).get(KW_QLANG_KIND)).toBe(keyword('BlockPlainComment'));
    expect(steps[0].get(KW_STEP).get(KW_CONTENT)).toBe(' rationale ');
  });

  it('preserves OperandCall :docs on doc-attached bindings', () => {
    // A single-step pipeline collapses to the bare head per
    // grammar.peggy's Pipeline production, so the doc-attached
    // OperandCall sits at the root without a Pipeline wrapper.
    const m = astNodeToMap(parse('|~~| first remark\nlet(:double, mul(2))'));
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('OperandCall'));
    expect(m.get(KW_NAME)).toBe('let');
    const docs = m.get(KW_DOCS);
    expect(isVec(docs)).toBe(true);
    expect(docs).toContain(' first remark');
  });
});

describe('astNodeToMap — programmatic doc-comment nodes', () => {
  // LineDocComment and BlockDocComment do not survive as standalone
  // AST nodes through parse() — DocAttachedSequence folds their
  // .content into the docs Vec on the following OperandCall. But the
  // codec must still handle them symmetrically with the two plain
  // comment kinds, because a consumer that constructs AST nodes
  // programmatically (via the forthcoming `parse` / `eval` reflective
  // operand pair, or via session restore from an earlier AST-Map
  // snapshot) may produce these node shapes directly.

  it('encodes LineDocComment with :content and preserves round-trip', () => {
    const node = {
      type: 'LineDocComment',
      content: ' a line doc',
      text: '|~~| a line doc',
      location: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 15, line: 1, column: 16 }
      }
    };
    const m = astNodeToMap(node);
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('LineDocComment'));
    expect(m.get(KW_CONTENT)).toBe(' a line doc');
    const back = qlangMapToAst(m);
    expect(back.type).toBe('LineDocComment');
    expect(back.content).toBe(' a line doc');
    expect(back.text).toBe('|~~| a line doc');
    expect(back.location.start.offset).toBe(0);
  });

  it('encodes BlockDocComment with :content and preserves round-trip', () => {
    const node = {
      type: 'BlockDocComment',
      content: ' multi\n    line ',
      text: '|~~ multi\n    line ~~|',
      location: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 22, line: 2, column: 13 }
      }
    };
    const m = astNodeToMap(node);
    expect(m.get(KW_QLANG_KIND)).toBe(keyword('BlockDocComment'));
    expect(m.get(KW_CONTENT)).toBe(' multi\n    line ');
    const back = qlangMapToAst(m);
    expect(back.type).toBe('BlockDocComment');
    expect(back.content).toBe(' multi\n    line ');
  });
});

describe('astNodeToMap — defensive input handling', () => {
  it('returns null for null / undefined', () => {
    expect(astNodeToMap(null)).toBe(null);
    expect(astNodeToMap(undefined)).toBe(null);
  });

  it('returns null for non-AST values', () => {
    expect(astNodeToMap(42)).toBe(null);
    expect(astNodeToMap('hello')).toBe(null);
    expect(astNodeToMap({})).toBe(null);
    expect(astNodeToMap({ notType: 'foo' })).toBe(null);
  });

  it('throws AstNodeTypeUnknownError on unknown .type', () => {
    expect(() => astNodeToMap({ type: 'NotARealNodeType' }))
      .toThrow(/unknown AST node type 'NotARealNodeType'/);
  });
});

describe('qlangMapToAst — error shape', () => {
  it('returns null for null / undefined', () => {
    expect(qlangMapToAst(null)).toBe(null);
    expect(qlangMapToAst(undefined)).toBe(null);
  });

  it('throws AstMapMalformedError on non-Map input', () => {
    expect(() => qlangMapToAst(42)).toThrow(/expected a Map, got number/);
    expect(() => qlangMapToAst('hello')).toThrow(/expected a Map, got string/);
    expect(() => qlangMapToAst([])).toThrow(/expected a Map/);
  });

  it('throws AstMapMalformedError on Map without :qlang/kind', () => {
    const m = new Map();
    m.set(keyword('foo'), 'bar');
    expect(() => qlangMapToAst(m)).toThrow(/missing :qlang\/kind discriminator/);
  });

  it('throws AstMapKindUnknownError on unknown :qlang/kind keyword', () => {
    const m = new Map();
    m.set(KW_QLANG_KIND, keyword('NotARealKind'));
    expect(() => qlangMapToAst(m)).toThrow(/unknown :qlang\/kind 'NotARealKind'/);
  });

  it('throws AstMapMalformedError on non-Map pipeline step', () => {
    const m = new Map();
    m.set(KW_QLANG_KIND, keyword('Pipeline'));
    m.set(KW_STEPS, ['not-a-map']);
    m.set(KW_LEADING_FAIL, false);
    expect(() => qlangMapToAst(m)).toThrow(/Pipeline step at index 0 is not a Map/);
  });

  it('throws AstMapMalformedError on pipeline step Map without :PipelineStep kind', () => {
    const wrongStep = new Map();
    wrongStep.set(KW_QLANG_KIND, keyword('NumberLit'));
    wrongStep.set(KW_VALUE, 42);
    const m = new Map();
    m.set(KW_QLANG_KIND, keyword('Pipeline'));
    m.set(KW_STEPS, [wrongStep]);
    m.set(KW_LEADING_FAIL, false);
    expect(() => qlangMapToAst(m)).toThrow(/not a :PipelineStep Map/);
  });
});

describe('round-trip — scalar literals', () => {
  it('number', () => assertRoundTrip('42'));
  it('negative number', () => assertRoundTrip('-3.14'));
  it('string', () => assertRoundTrip('"hello"'));
  it('empty string', () => assertRoundTrip('""'));
  it('string with escapes', () => assertRoundTrip('"line1\\nline2"'));
  it('true', () => assertRoundTrip('true'));
  it('false', () => assertRoundTrip('false'));
  it('nil', () => assertRoundTrip('nil'));
  it('bare keyword', () => assertRoundTrip(':foo'));
  it('namespaced keyword', () => assertRoundTrip(':qlang/error'));
  it('quoted keyword with space', () => assertRoundTrip(':"foo bar"'));
  it('quoted keyword with digit prefix', () => assertRoundTrip(':"123"'));
  it('empty quoted keyword', () => assertRoundTrip(':""'));
});

describe('round-trip — compound literals', () => {
  it('Vec', () => assertRoundTrip('[1 2 3]'));
  it('empty Vec', () => assertRoundTrip('[]'));
  it('nested Vec', () => assertRoundTrip('[[1 2] [3 4]]'));
  it('Map', () => assertRoundTrip('{:name "a" :age 30}'));
  it('empty Map', () => assertRoundTrip('{}'));
  it('nested Map', () => assertRoundTrip('{:nested {:deep 42}}'));
  it('Set', () => assertRoundTrip('#{:a :b :c}'));
  it('empty Set', () => assertRoundTrip('#{}'));
  it('Error literal', () => assertRoundTrip('!{:kind :oops :message "boom"}'));
  it('empty Error literal', () => assertRoundTrip('!{}'));
  it('heterogeneous Vec', () => assertRoundTrip('[1 "two" nil :three {:x 4}]'));
});

describe('round-trip — projections', () => {
  it('single segment', () => assertRoundTrip('/name'));
  it('nested segments', () => assertRoundTrip('/a/b/c'));
  it('quoted segment', () => assertRoundTrip('/"foo bar"'));
  it('namespaced keyword segment', () => assertRoundTrip('/:qlang/error'));
  it('mixed segments', () => assertRoundTrip('/outer/"inner key"/age'));
});

describe('round-trip — operand calls and pipelines', () => {
  it('bare identifier', () => assertRoundTrip('count'));
  it('nullary with parens', () => assertRoundTrip('count()'));
  it('unary partial', () => assertRoundTrip('filter(gt(5))'));
  it('binary full', () => assertRoundTrip('add(2, 3)'));
  it('higher-order', () => assertRoundTrip('sortWith(asc(/age))'));
  it('paren group', () => assertRoundTrip('(1 | add(2))'));
  it('paren group around pipeline', () => assertRoundTrip('([1 2 3] | count)'));

  it('simple pipeline', () => assertRoundTrip('[1 2 3] | count'));
  it('multi-step pipeline', () => assertRoundTrip('[1 2 3] | filter(gt(2)) | count'));
  it('distribute combinator', () => assertRoundTrip('[1 2 3] * add(10)'));
  it('merge combinator', () => assertRoundTrip('[[1 2] [3 4]] >> sort'));
  it('mixed combinators', () => assertRoundTrip('[1 2 3] | [filter(gt(1)), filter(lt(3))] >> count'));
});

describe('round-trip — let / as bindings', () => {
  it('zero-arity conduit', () => assertRoundTrip('let(:double, mul(2))'));
  it('parametric conduit', () =>
    assertRoundTrip('let(:@surround, [:pfx, :sfx], prepend(pfx) | append(sfx))'));
  it('as snapshot', () => assertRoundTrip('[1 2 3] | as(:nums) | nums | count'));
  it('multi-stage as', () =>
    assertRoundTrip('[1 2 3] | as(:a) | filter(gt(1)) | as(:b) | [a, b]'));
});

describe('round-trip — error track and fail-apply', () => {
  it('error literal', () => assertRoundTrip('!{:kind :oops :trail []}'));
  it('fail-apply on error literal', () => assertRoundTrip('!{:kind :oops} | count !| /kind'));
  it('deflect then fail-apply', () =>
    assertRoundTrip('"hello" | add(1) | mul(2) !| /trail'));
  it('filter with leading fail-apply predicate', () =>
    assertRoundTrip('[1 2 3] | filter(!| /kind | eq(:oops))'));
});

describe('round-trip — comments', () => {
  it('line plain comment as standalone step', () =>
    assertRoundTrip('[1 2 3] |~| short note\n| count'));
  it('block plain comment mid-pipeline', () =>
    assertRoundTrip('[1 2 3] |~ rationale ~| filter(gt(1))'));
  it('line doc comment attached to let', () =>
    assertRoundTrip('|~~| first remark\nlet(:double, mul(2))'));
  it('block doc comment attached to let', () =>
    assertRoundTrip('|~~ multi-line\n    block remark ~~|\nlet(:helper, add(1))'));
  it('multiple doc comments accumulating', () =>
    assertRoundTrip('|~~| first\n|~~| second\nlet(:x, 1)'));
  it('plain comment interleaved between docs', () =>
    assertRoundTrip('|~~| first\n|~ separator ~|\n|~~| second\nlet(:x, 1)'));
});

describe('round-trip — effect markers', () => {
  it('effectful bare identifier', () => assertRoundTrip('@callers'));
  it('effectful projection segment', () => assertRoundTrip('/some/@effectful'));
  it('effectful conduit binding', () =>
    assertRoundTrip('let(:@wrap, @callers | count)'));
});

describe('round-trip — realistic queries', () => {
  it('filter + reshape + sort pipeline', () =>
    assertRoundTrip('[{:age 20} {:age 40} {:age 30}] | filter(/age | gte(25)) | sort(/age) * /age'));

  it('groupBy + projection', () =>
    assertRoundTrip('[{:dept :eng} {:dept :sales}] | groupBy(/dept) | keys'));

  it('recursive tree walker via let', () =>
    assertRoundTrip('let(:walker, {:label /label :children /children * walker}) | walker'));

  it('sortWith compound comparator', () =>
    assertRoundTrip('nodes | sortWith([asc(/priority), desc(/timestamp)] | firstNonZero)'));

  it('control flow with nested branches', () =>
    assertRoundTrip('score | cond(gte(90), "A", gte(80), "B", "F")'));

  it('env introspection', () =>
    assertRoundTrip('env | keys | filter(/type | eq(:builtin)) | count'));
});

describe('AST-Map semantic properties for trail use', () => {
  it('every step inside a pipeline is individually addressable', () => {
    // This is the target shape for structured :trail: each deflected
    // step becomes an entry in the trail Vec, and downstream code
    // needs to read :name / :args / :location without knowing the
    // specific kind ahead of time.
    const m = astNodeToMap(parse('[1 2 3] | filter(gt(2)) | count'));
    const steps = m.get(KW_STEPS);
    for (const pipelineStep of steps) {
      const inner = pipelineStep.get(KW_STEP);
      expect(isQMap(inner)).toBe(true);
      expect(inner.has(KW_QLANG_KIND)).toBe(true);
    }
  });

  it('OperandCall in a step exposes :name and :args for filtering', () => {
    const m = astNodeToMap(parse('[1 2 3] | filter(gt(2))'));
    const filterStep = m.get(KW_STEPS)[1].get(KW_STEP);
    expect(filterStep.get(KW_QLANG_KIND)).toBe(keyword('OperandCall'));
    expect(filterStep.get(KW_NAME)).toBe('filter');
    expect(filterStep.get(KW_ARGS)).toHaveLength(1);
  });

  it('Projection step exposes :keys Vec for inspection', () => {
    const m = astNodeToMap(parse('{:a 1} | /a'));
    const projStep = m.get(KW_STEPS)[1].get(KW_STEP);
    expect(projStep.get(KW_QLANG_KIND)).toBe(keyword('Projection'));
    expect(projStep.get(KW_KEYS)).toEqual(['a']);
  });

  it('location on a trail-entry step is addressable as a nested Map', () => {
    const m = astNodeToMap(parse('[1 2 3] | count'));
    const countStep = m.get(KW_STEPS)[1].get(KW_STEP);
    const loc = countStep.get(KW_LOCATION);
    expect(isQMap(loc)).toBe(true);
    expect(loc.get(KW_START).get(KW_LINE)).toBe(1);
    expect(loc.get(KW_START).get(KW_COLUMN)).toBeGreaterThan(1);
  });
});
