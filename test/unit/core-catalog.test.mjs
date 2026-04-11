// Tests for lib/qlang/core.qlang — the Variant-B langRuntime source.
//
// core.qlang is a single Map literal where every entry is a
// descriptor for one built-in operand, carrying :qlang/kind :builtin,
// :qlang/impl <:qlang/prim/*> keyword pointing into SHARED_REGISTRY,
// plus the authored metadata (category / subject / returns /
// modifiers / examples / throws) and doc-comment-prefix-attached
// :docs. Sub-commit A: the file exists and parses and evaluates
// into a 67-entry Map, but nothing yet wires it into the production
// langRuntime() — the old IMPLS-based bootstrap still drives
// evalOperandCall. Sub-commit B will cut the wiring over and delete
// the legacy pathway.
//
// Contract pinned here:
//
//   1. CORE_SOURCE parses to a Pipeline/MapLit AST without errors.
//   2. Evaluating it in an empty env produces a Map with exactly
//      67 entries — one per built-in operand.
//   3. Every entry is itself a Map with :qlang/kind :builtin and a
//      :qlang/impl keyword prefixed `qlang/prim/`.
//   4. Every :qlang/impl keyword resolves to a real primitive in
//      the live PRIMITIVE_REGISTRY (populated by runtime/*.mjs
//      module-load side effects from Step 3).
//   5. Doc-comment prefixes have folded into :docs Vecs on each
//      entry's value Map via grammar.peggy's MapEntryDocPrefix and
//      eval.mjs's foldEntryDocs.

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import { evalAst } from '../../src/eval.mjs';
import { makeState } from '../../src/state.mjs';
import { keyword, isQMap, isVec } from '../../src/types.mjs';
import { PRIMITIVE_REGISTRY } from '../../src/primitives.mjs';
import { CORE_SOURCE } from '../../gen/core.mjs';

// Evaluate core.qlang in a completely empty env — this is the
// Variant-B bootstrap contract. Map literals need no bindings to
// evaluate, so the only precondition is that CORE_SOURCE parses
// cleanly and contains nothing but a single Map literal plus its
// prefacing comment.
function evalCore() {
  const ast = parse(CORE_SOURCE, { uri: 'qlang/core' });
  const state = makeState(null, new Map());
  return evalAst(ast, state).pipeValue;
}

// Force runtime/*.mjs import so PRIMITIVE_REGISTRY gets populated
// before we cross-check :qlang/impl handles.
async function primeRegistry() {
  await import('../../src/runtime/index.mjs');
}

describe('lib/qlang/core.qlang — shape and content', () => {
  it('parses without errors', () => {
    const ast = parse(CORE_SOURCE, { uri: 'qlang/core' });
    expect(ast).toBeDefined();
    expect(ast.type).toBeDefined();
  });

  it('evaluates to a Map', () => {
    const env = evalCore();
    expect(isQMap(env)).toBe(true);
  });

  it('holds exactly 67 entries — one per built-in operand', () => {
    const env = evalCore();
    expect(env.size).toBe(67);
  });

  it('every entry value is a Map with :qlang/kind :builtin', () => {
    const env = evalCore();
    const kindKw = keyword('qlang/kind');
    for (const [k, v] of env) {
      expect(isQMap(v), `entry :${k.name} value is not a Map`).toBe(true);
      expect(v.get(kindKw), `entry :${k.name} missing :qlang/kind :builtin`)
        .toBe(keyword('builtin'));
    }
  });

  it('every entry carries a :qlang/impl keyword in the qlang/prim/ namespace', () => {
    const env = evalCore();
    const implKw = keyword('qlang/impl');
    for (const [k, v] of env) {
      const impl = v.get(implKw);
      expect(impl, `entry :${k.name} missing :qlang/impl`).toBeDefined();
      expect(impl.type).toBe('keyword');
      expect(impl.name.startsWith('qlang/prim/'),
        `entry :${k.name} :qlang/impl ${impl.name} not in qlang/prim/ namespace`
      ).toBe(true);
    }
  });

  it(':qlang/impl keyword name matches the entry name for every operand', () => {
    // Convention: the entry :count has :qlang/impl :qlang/prim/count.
    // Catches copy-paste typos between the keyword handle and its
    // dispatch target at build-verification time instead of at
    // runtime dispatch time.
    const env = evalCore();
    const implKw = keyword('qlang/impl');
    for (const [k, v] of env) {
      const impl = v.get(implKw);
      expect(impl.name).toBe(`qlang/prim/${k.name}`);
    }
  });
});

describe('lib/qlang/core.qlang — handoff into PRIMITIVE_REGISTRY', () => {
  it('every :qlang/impl keyword resolves to a live primitive', async () => {
    await primeRegistry();
    const env = evalCore();
    const implKw = keyword('qlang/impl');
    for (const [k, v] of env) {
      const impl = v.get(implKw);
      expect(PRIMITIVE_REGISTRY.has(impl),
        `entry :${k.name} → :${impl.name} has no backing primitive`
      ).toBe(true);
      const fnValue = PRIMITIVE_REGISTRY.resolve(impl);
      expect(fnValue.type).toBe('function');
    }
  });

  it('spot-check — :add descriptor resolves to the add impl with arity 2', async () => {
    await primeRegistry();
    const env = evalCore();
    const addDescriptor = env.get(keyword('add'));
    expect(isQMap(addDescriptor)).toBe(true);
    expect(addDescriptor.get(keyword('category'))).toBe(keyword('arith'));
    expect(addDescriptor.get(keyword('subject'))).toBe(keyword('number'));
    const impl = PRIMITIVE_REGISTRY.resolve(addDescriptor.get(keyword('qlang/impl')));
    expect(impl.name).toBe('add');
    expect(impl.arity).toBe(2);
  });

  it('spot-check — :filter is a higher-order vec-transformer', async () => {
    await primeRegistry();
    const env = evalCore();
    const filterDescriptor = env.get(keyword('filter'));
    expect(filterDescriptor.get(keyword('category'))).toBe(keyword('vec-transformer'));
    expect(filterDescriptor.get(keyword('modifiers'))).toEqual([keyword('predicate-lambda')]);
    const impl = PRIMITIVE_REGISTRY.resolve(filterDescriptor.get(keyword('qlang/impl')));
    expect(impl.name).toBe('filter');
  });

  it('spot-check — :let / :as reflective operands land with :category :reflective', async () => {
    await primeRegistry();
    const env = evalCore();
    expect(env.get(keyword('let')).get(keyword('category'))).toBe(keyword('reflective'));
    expect(env.get(keyword('as')).get(keyword('category'))).toBe(keyword('reflective'));
    // The JS-level identifiers are letOperand / asOperand but the
    // primitive keys and impl names carry the qlang spelling.
    const letImpl = PRIMITIVE_REGISTRY.resolve(env.get(keyword('let')).get(keyword('qlang/impl')));
    expect(letImpl.name).toBe('let');
    const asImpl = PRIMITIVE_REGISTRY.resolve(env.get(keyword('as')).get(keyword('qlang/impl')));
    expect(asImpl.name).toBe('as');
  });
});

describe('lib/qlang/core.qlang — doc-prefix folded into :docs', () => {
  it('every entry has a non-empty :docs Vec of strings', () => {
    const env = evalCore();
    const docsKw = keyword('docs');
    for (const [k, v] of env) {
      const docs = v.get(docsKw);
      expect(isVec(docs), `entry :${k.name} has no :docs Vec`).toBe(true);
      expect(docs.length, `entry :${k.name} :docs is empty`).toBeGreaterThan(0);
      for (const doc of docs) {
        expect(typeof doc).toBe('string');
      }
    }
  });

  it('spot-check — :count docs mention polymorphic and container kinds', () => {
    const env = evalCore();
    const countDocs = env.get(keyword('count')).get(keyword('docs'));
    const joined = countDocs.join(' ');
    expect(joined).toContain('number of elements');
    expect(joined).toContain('Polymorphic');
  });

  it('spot-check — :filter docs describe the predicate semantics', () => {
    const env = evalCore();
    const filterDocs = env.get(keyword('filter')).get(keyword('docs'));
    const joined = filterDocs.join(' ');
    expect(joined).toContain('predicate');
    expect(joined).toContain('truthy');
  });
});

describe('lib/qlang/core.qlang — data-level projections across the full catalog', () => {
  it('groupBy category — full catalog is addressable as data', () => {
    // A miniature exercise of the self-describing nature: run a
    // qlang query against the catalog itself to count operands per
    // category. Under Variant B this is what `env | manifest | ...`
    // will produce; for now we just pin the shape by iterating the
    // evaluated Map directly.
    const env = evalCore();
    const categories = new Map();
    for (const [, v] of env) {
      const cat = v.get(keyword('category'));
      categories.set(cat.name, (categories.get(cat.name) ?? 0) + 1);
    }
    expect(categories.get('vec-reducer')).toBe(10);
    expect(categories.get('vec-transformer')).toBe(10);  // set is :set-op in manifest taxonomy
    expect(categories.get('comparator')).toBe(4);
    expect(categories.get('control')).toBe(6);
    expect(categories.get('map-op')).toBe(3);
    expect(categories.get('set-op')).toBe(4);  // set + union + minus + inter
    expect(categories.get('arith')).toBe(4);
    expect(categories.get('string')).toBe(7);
    expect(categories.get('predicate')).toBe(8);  // not + eq + gt + lt + gte + lte + and + or
    expect(categories.get('format')).toBe(2);
    expect(categories.get('reflective')).toBe(7);
    expect(categories.get('error')).toBe(2);
    const sum = [...categories.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(67);
  });
});
