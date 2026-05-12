// Tests for lib/qlang/core.qlang — the Variant-B langRuntime source.
//
// core.qlang is a single Map literal where every entry is a
// descriptor for one built-in operand, carrying :qlang/kind :builtin,
// :qlang/impl <:qlang/prim/*> keyword pointing into SHARED_REGISTRY,
// plus the authored metadata (category / subject / returns /
// modifiers / examples / throws) and doc-comment-prefix-attached
// :docs. langRuntime() evaluates the file once at startup, resolves
// every `:qlang/impl :qlang/prim/<name>` handle through the JS-side
// registry bound at module load, and seals the registry. This is
// the single source of truth for the bound env.
//
// Contract pinned here:
//
//   1. CORE_SOURCE parses to a Pipeline/MapLit AST without errors.
//   2. Evaluating it in an empty env produces a non-empty Map —
//      one entry per built-in operand.
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
import { keyword, isQMap, isVec, makeTagKeyword } from '../../src/types.mjs';
import { PRIMITIVE_REGISTRY } from '../../src/primitives.mjs';
import { CORE_SOURCE } from '../../gen/core.mjs';

// Evaluate core.qlang against a real langRuntime — CORE_SOURCE is a
// series of `def`-step bindings, each of which calls the `def`
// operand to land its descriptor in env. Reading the resolved env
// from langRuntime() returns the catalog as a Map keyed by operand
// name. Reserved housekeeping keys (`qlang/ast/<uri>`, anything
// without a `:qlang/kind :builtin` descriptor) are filtered so the
// returned Map matches the descriptor-only surface the rest of this
// suite was originally written against.
async function evalCore() {
  const { langRuntime } = await import('../../src/runtime/index.mjs');
  const fullEnv = await langRuntime();
  const catalog = new Map();
  for (const [k, v] of fullEnv) {
    if (k.startsWith('qlang/ast/')) continue;
    if (!isQMap(v)) continue;
    const kind = v.get('qlang/kind');
    if (!kind || kind.name !== 'builtin') continue;
    catalog.set(k, v);
  }
  return catalog;
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

  it('evaluates to a Map', async () => {
    const coreEnv = await evalCore();
    expect(isQMap(coreEnv)).toBe(true);
  });

  it('every entry has a unique keyword identifier and non-empty name', async () => {
    // Size is not pinned to a literal — the catalog grows as the
    // language gains operands, and hard-coding the count here would
    // force a churn-commit on every addition. What IS invariant: the
    // evaluated env is a non-empty Map whose keys are all keywords
    // with non-empty names, and keys are unique by Map contract.
    const coreEnv = await evalCore();
    expect(coreEnv.size).toBeGreaterThan(0);
    for (const entryKey of coreEnv.keys()) {
      expect(typeof entryKey === "string").toBe(true);
      expect(entryKey.length).toBeGreaterThan(0);
    }
  });

  it('every entry value is a Map with :qlang/kind :builtin', async () => {
    const coreEnv = await evalCore();
    
    for (const [entryKey, entryVal] of coreEnv) {
      expect(isQMap(entryVal), `entry :${entryKey} value is not a Map`).toBe(true);
      expect(entryVal.get('qlang/kind'), `entry :${entryKey} missing :qlang/kind :builtin`)
        .toEqual(keyword('builtin'));
    }
  });

  it('every entry carries a :qlang/impl function value resolved from PRIMITIVE_REGISTRY', async () => {
    // langRuntime() runs the resolution pass over every builtin
    // descriptor before returning, so :qlang/impl arrives at
    // user-side as the live function value (not a keyword handle).
    // The naming convention — function value's .name matches the
    // operand name — keeps the dispatch target identifiable.
    const coreEnv = await evalCore();

    for (const [entryKey, entryVal] of coreEnv) {
      const impl = entryVal.get('qlang/impl');
      expect(impl, `entry :${entryKey} missing :qlang/impl`).toBeDefined();
      expect(typeof impl).toBe('object');
      expect(impl.name, `entry :${entryKey} :qlang/impl resolves to function with mismatched name`)
        .toBe(entryKey);
    }
  });

});

describe('lib/qlang/core.qlang — handoff into PRIMITIVE_REGISTRY', () => {
  it('every catalog operand has a backing primitive in PRIMITIVE_REGISTRY', async () => {
    await primeRegistry();
    const coreEnv = await evalCore();

    for (const entryKey of coreEnv.keys()) {
      expect(PRIMITIVE_REGISTRY.has(`qlang/prim/${entryKey}`),
        `entry :${entryKey} has no backing primitive at qlang/prim/${entryKey}`
      ).toBe(true);
    }
  });

  it('spot-check — :add descriptor resolves to the add impl with arity 2', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const resolved = await langRuntime();
    const addDescriptor = resolved.get('add');
    expect(isQMap(addDescriptor)).toBe(true);
    expect(addDescriptor.get('category')).toEqual(keyword('arith'));
    expect(addDescriptor.get('subject')).toEqual(keyword('number'));
    const impl = addDescriptor.get('qlang/impl');
    expect(impl.name).toBe('add');
    expect(impl.arity).toBe(2);
  });

  it('spot-check — :filter is a higher-order container-selector', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const resolved = await langRuntime();
    const filterDescriptor = resolved.get('filter');
    expect(filterDescriptor.get('category')).toEqual(keyword('container-selector'));
    expect(filterDescriptor.get('modifiers')).toEqual([keyword('predicate-lambda')]);
    const impl = filterDescriptor.get('qlang/impl');
    expect(impl.name).toBe('filter');
  });

  it('spot-check — :as reflective operand lands with :category :reflective', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const resolved = await langRuntime();
    expect(resolved.get('as').get('category')).toEqual(keyword('reflective'));
    const asImpl = resolved.get('as').get('qlang/impl');
    expect(asImpl.name).toBe('as');
  });
});

describe('lib/qlang/core.qlang — doc-prefix reachable through ~{:tag | docs} axis', () => {
  it('every cataloged binding has at least one Doc-value on the axis', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const coreEnv = await evalCore();
    for (const entryKey of coreEnv.keys()) {
      // Skip section-divider plain comments / non-binding env entries.
      if (!isQMap(coreEnv.get(entryKey))) continue;
      const docs = await evalQuery(`:"${entryKey}" | docs`);
      expect(docs.length, `entry :${entryKey} has no docs reachable via axis`).toBeGreaterThan(0);
      for (const doc of docs) {
        expect(typeof doc.content).toBe('string');
      }
    }
  });

  it('spot-check — :count docs mention polymorphic and container kinds', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const docs = await evalQuery(':count | docs');
    const joined = docs.map(d => d.content).join(' ');
    expect(joined).toContain('number of elements');
    expect(joined).toContain('Polymorphic');
  });

  it('spot-check — :filter docs describe the predicate semantics', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const docs = await evalQuery(':filter | docs');
    const joined = docs.map(d => d.content).join(' ');
    expect(joined).toContain('predicate');
    expect(joined).toContain('truthy');
  });
});

describe('Variant-B bare-non-nullary REPL introspection', () => {
  // The REPL ergonomic promised by the whole refactor: typing a
  // non-nullary operand name bare (no parens, no captured args)
  // returns its descriptor Map as pipeValue instead of firing an
  // arity error. Nullary operands (count, sort bare form, env,
  // etc.) still fire on bare lookup because their minCaptured is
  // 0 and bare application is their valid nullary form.

  it('bare ~{mul} returns reify-shaped descriptor Map', async () => {
    // mul has minCaptured 1, so bare lookup yields the reify-shaped
    // descriptor — :kind :builtin (not the internal :qlang/kind),
    // :captured and :effectful stamped from the resolved impl.
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('mul');
    expect(isQMap(evalResult)).toBe(true);
    expect(evalResult.get('kind')).toEqual(keyword('builtin'));
    expect(evalResult.get('category')).toEqual(keyword('arith'));
    expect(evalResult.has('qlang/kind')).toBe(false);
    expect(evalResult.has('qlang/impl')).toBe(false);
  });

  it('bare ~{filter} returns reify-shaped descriptor Map', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('filter');
    expect(isQMap(evalResult)).toBe(true);
    expect(evalResult.get('kind')).toEqual(keyword('builtin'));
    expect(evalResult.get('category')).toEqual(keyword('container-selector'));
  });

  it('bare ~{coalesce} returns coalesce\'s descriptor Map (minCaptured 1)', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('coalesce');
    expect(isQMap(evalResult)).toBe(true);
    expect(evalResult.get('category')).toEqual(keyword('control'));
  });

  it('bare ~{count} fires because count is nullary', async () => {
    // count has minCaptured 0, so the nullary dispatch path applies
    // bare lookup rather than substituting the descriptor. That is
    // what makes `[1 2 3] | count` mean "apply count to the Vec".
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('[1 2 3] | count')).toBe(3);
  });

  it('bare ~{sort} fires because sort overload includes nullary', async () => {
    // sort is overloaded at 0 or 1 captured args. overloadedOp
    // emits captured [0, 1], so minCaptured is 0 and bare sort
    // fires its nullary branch.
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('[3 1 2] | sort')).toEqual([1, 2, 3]);
  });
});

describe('function-value reify path (conduit parameter reflection)', () => {
  // Conduit parameters are the only function values that reach
  // env under Variant-B dispatch — they are minted at applyConduit
  // time by makeConduitParameter and live only for the duration of
  // the body fork. Reifying one inside a conduit body exercises
  // the isFunctionValue branch of describeBinding, which delegates
  // to buildBuiltinDescriptor to construct a descriptor Map from
  // the function-value's inline meta.

  it('reify on a conduit parameter yields a :kind :builtin descriptor', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    // The conduit body captures a param and calls reify(:p) to
    // get its descriptor. The param is a function value (not a
    // Map), so describeBinding takes the isFunctionValue path and
    // builds a descriptor via buildBuiltinDescriptor from the
    // inlined meta that makeConduitParameter stamps on the proxy.
    const evalResult = await evalQuery(':f [:p] reify(:p) | 42 | f(add(1))');
    expect(isQMap(evalResult)).toBe(true);
    expect(evalResult.get('kind')).toEqual(keyword('builtin'));
    expect(evalResult.get('category')).toEqual(keyword('conduit-parameter'));
    expect(evalResult.get('name')).toBe('p');
  });
});

describe('format.toPlain refuses a raw function value — round-trip invariant', () => {
  // Function values have no grammatical literal: emitting any string
  // for one would falsely round-trip through parse / eval into a
  // different value-class. toPlain shares this round-trip discipline
  // with printValue and raises FunctionValueLeakedToPrint when a
  // function surfaces — the leak surface (typically a JS-level
  // caller piping a raw makeFn product through toPlain instead of
  // wrapping it in a descriptor Map) gets named at the boundary.

  it('toPlain on a raw function value throws FunctionValueLeakedToPrint', async () => {
    const { toPlain } = await import('../../src/runtime/format.mjs');
    const { makeFn } = await import('../../src/rule10.mjs');
    const { FunctionValueLeakedToPrint } = await import('../../src/types.mjs');
    const fn = makeFn('exoticFn', 1, (state) => state, { captured: [0, 0] });
    expect(() => toPlain(fn)).toThrow(FunctionValueLeakedToPrint);
  });
});

describe('lib/qlang/core.qlang — data-level projections across the full catalog', () => {
  it('groupBy category — full catalog is addressable as data', async () => {
    // A miniature exercise of the self-describing nature: run a
    // qlang query against the catalog itself to count operands per
    // category. Under Variant B this is what `env | manifest | ...`
    // will produce; this test pins the shape by iterating the
    // evaluated Map directly — the same projection surface
    // `env | manifest | ...` exercises at the qlang level.
    const coreEnv = await evalCore();
    const categories = new Map();
    for (const [, entryVal] of coreEnv) {
      const cat = entryVal.get('category');
      categories.set(cat.name, (categories.get(cat.name) ?? 0) + 1);
    }
    expect(categories.get('container-reducer')).toBe(2);  // count + empty (polymorphic Vec/Set/Map)
    expect(categories.get('container-selector')).toBe(3);  // filter + every + any (polymorphic Vec/Set/Map)
    expect(categories.get('vec-reducer')).toBe(6);  // first, last, sum, min, max, firstNonZero
    expect(categories.get('indexed-access')).toBe(1);  // at (Vec + Map polymorphic)
    expect(categories.get('vec-transformer')).toBe(9);  // sort, sortWith, take, drop, distinct, reverse, flat, groupBy, indexBy
    expect(categories.get('comparator')).toBe(4);
    expect(categories.get('control')).toBe(6);
    expect(categories.get('map-op')).toBe(3);  // keys + vals + has
    expect(categories.get('set-op')).toBe(4);  // set + union + minus + inter
    expect(categories.get('arith')).toBe(4);
    expect(categories.get('string')).toBe(7);
    expect(categories.get('predicate')).toBe(8);  // not + eq + gt + lt + gte + lte + and + or
    expect(categories.get('type-classifier')).toBe(12);  // isString + isNumber + isVec + isMap + isSet + isKeyword + isBoolean + isNull + isQuote + isDoc + isJsonObject + isJsonArray
    expect(categories.get('type-conversion')).toBe(1);  // keyword
    expect(categories.get('format')).toBe(2);
    expect(categories.get('reflective')).toBe(8);  // env use reify manifest runExamples as parse eval
    expect(categories.get('error')).toBe(2);
    const sum = [...categories.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(coreEnv.size);
  });
});

describe('parse / eval — the code-as-data ring closer', () => {
  // Step 10 of the Variant-B refactor: the `parse` operand reads
  // a source string into the walk.mjs AST-Map form, `eval` takes
  // that AST-Map and runs it against the current state. Together
  // they round-trip source text → data → pipeValue without
  // leaving the language, and land the programmatic-query-
  // construction surface the whole refactor pointed at.

  it('parse lifts a scalar literal into an AST-Map', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"42" | parse');
    expect(isQMap(evalResult)).toBe(true);
    expect(evalResult.get('qlang/kind')).toEqual(keyword('NumberLit'));
    expect(evalResult.get('value')).toBe(42);
  });

  it('parse lifts an OperandCall into an AST-Map with :name / :args', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"add(1, 2)" | parse');
    expect(evalResult.get('qlang/kind')).toEqual(keyword('OperandCall'));
    expect(evalResult.get('name')).toBe('add');
    expect(isVec(evalResult.get('args'))).toBe(true);
    expect(evalResult.get('args')).toHaveLength(2);
  });

  it('parse errors on non-string subject', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('42 | parse !| /thrown');
    expect(evalResult).toEqual(makeTagKeyword('ParseSubjectNotStringOrQuote'));
  });

  it('eval takes a hand-assembled AST-Map and runs it', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('{:qlang/kind :NumberLit :value 42} | eval');
    expect(evalResult).toBe(42);
  });

  it('eval errors on non-Map subject', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"not-a-map" | eval !| /thrown');
    expect(evalResult).toEqual(makeTagKeyword('EvalSubjectNotMapOrQuote'));
  });

  it('round-trip — "source" | parse | eval is equivalent to evaluating the source', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('"42" | parse | eval')).toBe(42);
    expect(await evalQuery('"10 | add(3)" | parse | eval')).toBe(13);
    expect(await evalQuery('"[1 2 3] | filter(gt(1)) | count" | parse | eval')).toBe(2);
  });

  it('round-trip preserves projections and Map literals', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('"{:a 1 :b 2} | /a" | parse | eval')).toBe(1);
  });

  it('error values round-trip through parse | eval', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"!{:kind :oops} !| /kind" | parse | eval');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('parse errors on malformed source lift to fail-track', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"this is not qlang [" | parse !| /kind');
    expect(evalResult).toEqual(keyword('parse-error'));
  });
});
