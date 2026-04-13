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
async function evalCore() {
  const ast = parse(CORE_SOURCE, { uri: 'qlang/core' });
  const state = makeState(null, new Map());
  const evalResult = await evalAst(ast, state);
  return evalResult.pipeValue;
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

  it('holds exactly 69 entries — one per built-in operand', async () => {
    // 67 original + `parse` + `eval` (Step 10 — the code-as-data
    // ring closer) = 69 reflective-heavy total under Variant B.
    const coreEnv = await evalCore();
    expect(coreEnv.size).toBe(69);
  });

  it('every entry value is a Map with :qlang/kind :builtin', async () => {
    const coreEnv = await evalCore();
    const kindKw = keyword('qlang/kind');
    for (const [entryKey, entryVal] of coreEnv) {
      expect(isQMap(entryVal), `entry :${entryKey.name} value is not a Map`).toBe(true);
      expect(entryVal.get(kindKw), `entry :${entryKey.name} missing :qlang/kind :builtin`)
        .toBe(keyword('builtin'));
    }
  });

  it('every entry carries a :qlang/impl keyword in the qlang/prim/ namespace', async () => {
    const coreEnv = await evalCore();
    const implKw = keyword('qlang/impl');
    for (const [entryKey, entryVal] of coreEnv) {
      const impl = entryVal.get(implKw);
      expect(impl, `entry :${entryKey.name} missing :qlang/impl`).toBeDefined();
      expect(impl.type).toBe('keyword');
      expect(impl.name.startsWith('qlang/prim/'),
        `entry :${entryKey.name} :qlang/impl ${impl.name} not in qlang/prim/ namespace`
      ).toBe(true);
    }
  });

  it(':qlang/impl keyword name matches the entry name for every operand', async () => {
    // Convention: the entry :count has :qlang/impl :qlang/prim/count.
    // Catches copy-paste typos between the keyword handle and its
    // dispatch target at build-verification time instead of at
    // runtime dispatch time.
    const coreEnv = await evalCore();
    const implKw = keyword('qlang/impl');
    for (const [entryKey, entryVal] of coreEnv) {
      const impl = entryVal.get(implKw);
      expect(impl.name).toBe(`qlang/prim/${entryKey.name}`);
    }
  });
});

describe('lib/qlang/core.qlang — handoff into PRIMITIVE_REGISTRY', () => {
  it('every :qlang/impl keyword resolves to a live primitive', async () => {
    await primeRegistry();
    const coreEnv = await evalCore();
    const implKw = keyword('qlang/impl');
    for (const [entryKey, entryVal] of coreEnv) {
      const impl = entryVal.get(implKw);
      expect(PRIMITIVE_REGISTRY.has(impl),
        `entry :${entryKey.name} → :${impl.name} has no backing primitive`
      ).toBe(true);
      const fnValue = PRIMITIVE_REGISTRY.resolve(impl);
      expect(fnValue.type).toBe('function');
    }
  });

  it('spot-check — :add descriptor resolves to the add impl with arity 2', async () => {
    await primeRegistry();
    const coreEnv = await evalCore();
    const addDescriptor = coreEnv.get(keyword('add'));
    expect(isQMap(addDescriptor)).toBe(true);
    expect(addDescriptor.get(keyword('category'))).toBe(keyword('arith'));
    expect(addDescriptor.get(keyword('subject'))).toBe(keyword('number'));
    const impl = PRIMITIVE_REGISTRY.resolve(addDescriptor.get(keyword('qlang/impl')));
    expect(impl.name).toBe('add');
    expect(impl.arity).toBe(2);
  });

  it('spot-check — :filter is a higher-order vec-transformer', async () => {
    await primeRegistry();
    const coreEnv = await evalCore();
    const filterDescriptor = coreEnv.get(keyword('filter'));
    expect(filterDescriptor.get(keyword('category'))).toBe(keyword('vec-transformer'));
    expect(filterDescriptor.get(keyword('modifiers'))).toEqual([keyword('predicate-lambda')]);
    const impl = PRIMITIVE_REGISTRY.resolve(filterDescriptor.get(keyword('qlang/impl')));
    expect(impl.name).toBe('filter');
  });

  it('spot-check — :let / :as reflective operands land with :category :reflective', async () => {
    await primeRegistry();
    const coreEnv = await evalCore();
    expect(coreEnv.get(keyword('let')).get(keyword('category'))).toBe(keyword('reflective'));
    expect(coreEnv.get(keyword('as')).get(keyword('category'))).toBe(keyword('reflective'));
    // The JS-level identifiers are letOperand / asOperand but the
    // primitive keys and impl names carry the qlang spelling.
    const letImpl = PRIMITIVE_REGISTRY.resolve(coreEnv.get(keyword('let')).get(keyword('qlang/impl')));
    expect(letImpl.name).toBe('let');
    const asImpl = PRIMITIVE_REGISTRY.resolve(coreEnv.get(keyword('as')).get(keyword('qlang/impl')));
    expect(asImpl.name).toBe('as');
  });
});

describe('lib/qlang/core.qlang — doc-prefix folded into :docs', () => {
  it('every entry has a non-empty :docs Vec of strings', async () => {
    const coreEnv = await evalCore();
    const docsKw = keyword('docs');
    for (const [entryKey, entryVal] of coreEnv) {
      const docs = entryVal.get(docsKw);
      expect(isVec(docs), `entry :${entryKey.name} has no :docs Vec`).toBe(true);
      expect(docs.length, `entry :${entryKey.name} :docs is empty`).toBeGreaterThan(0);
      for (const doc of docs) {
        expect(typeof doc).toBe('string');
      }
    }
  });

  it('spot-check — :count docs mention polymorphic and container kinds', async () => {
    const coreEnv = await evalCore();
    const countDocs = coreEnv.get(keyword('count')).get(keyword('docs'));
    const joined = countDocs.join(' ');
    expect(joined).toContain('number of elements');
    expect(joined).toContain('Polymorphic');
  });

  it('spot-check — :filter docs describe the predicate semantics', async () => {
    const coreEnv = await evalCore();
    const filterDocs = coreEnv.get(keyword('filter')).get(keyword('docs'));
    const joined = filterDocs.join(' ');
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

  it('bare `mul` returns reify-shaped descriptor Map', async () => {
    // mul has minCaptured 1, so bare lookup yields the reify-shaped
    // descriptor — :kind :builtin (not the internal :qlang/kind),
    // :captured and :effectful stamped from the resolved impl.
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('mul');
    expect(isQMap(evalResult)).toBe(true);
    expect(evalResult.get(keyword('kind'))).toBe(keyword('builtin'));
    expect(evalResult.get(keyword('category'))).toBe(keyword('arith'));
    expect(evalResult.has(keyword('qlang/kind'))).toBe(false);
    expect(evalResult.has(keyword('qlang/impl'))).toBe(false);
  });

  it('bare `filter` returns reify-shaped descriptor Map', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('filter');
    expect(isQMap(evalResult)).toBe(true);
    expect(evalResult.get(keyword('kind'))).toBe(keyword('builtin'));
    expect(evalResult.get(keyword('category'))).toBe(keyword('vec-transformer'));
  });

  it('bare `coalesce` returns coalesce\'s descriptor Map (minCaptured 1)', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('coalesce');
    expect(isQMap(evalResult)).toBe(true);
    expect(evalResult.get(keyword('category'))).toBe(keyword('control'));
  });

  it('bare `count` still fires because count is nullary', async () => {
    // count has minCaptured 0 — the nullary dispatch path still
    // applies bare lookup rather than substituting the descriptor.
    // This is what keeps `[1 2 3] | count` meaning "apply count to
    // the Vec" under the new dispatch.
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('[1 2 3] | count')).toBe(3);
  });

  it('bare `sort` still fires because sort overload includes nullary', async () => {
    // sort is overloaded at 0 or 1 captured args. overloadedOp
    // emits captured [0, 1], so minCaptured is 0 and bare sort
    // fires its nullary branch.
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('[3 1 2] | sort')).toEqual([1, 2, 3]);
  });
});

describe('legacy function-value reify path (conduit parameter reflection)', () => {
  // Conduit parameters are the only function values that still
  // end up in env under Variant B — they are created at
  // applyConduit time by makeConduitParameter and live only for
  // the duration of the body fork. Reifying one inside a conduit
  // body exercises the isFunctionValue branch of describeBinding,
  // which delegates to buildBuiltinDescriptor to construct a
  // descriptor Map from the function-value's inline meta.

  it('reify on a conduit parameter yields a :kind :builtin descriptor', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    // The conduit body captures a param and calls reify(:p) to
    // get its descriptor. The param is a function value (not a
    // Map), so describeBinding takes the isFunctionValue path and
    // builds a descriptor via buildBuiltinDescriptor from the
    // inlined meta that makeConduitParameter stamps on the proxy.
    const evalResult = await evalQuery('let(:f, [:p], reify(:p)) | 42 | f(add(1))');
    expect(isQMap(evalResult)).toBe(true);
    expect(evalResult.get(keyword('kind'))).toBe(keyword('builtin'));
    expect(evalResult.get(keyword('category'))).toBe(keyword('conduit-parameter'));
    expect(evalResult.get(keyword('name'))).toBe('p');
  });
});

describe('format.toPlain exotic-value fallback', () => {
  // toPlain's String(v) fallback covers qlang values that do not
  // match the known shapes (scalar / keyword / Vec / Map / Set /
  // error). Under Variant-B dispatch, no qlang-level path ever
  // reaches this branch — raw function values never enter
  // pipeValue, so user code cannot feed one to the json operand.
  // The branch remains as a safety net for JS-level callers that
  // might construct exotic objects (makeFn frozen values, host
  // closures injected via session.bind) and pipe them through
  // toPlain. Direct unit exercise keeps the line covered.

  it('String(v) fallback on a raw function value', async () => {
    const { toPlain } = await import('../../src/runtime/format.mjs');
    const { makeFn } = await import('../../src/rule10.mjs');
    const fn = makeFn('exoticFn', 1, (state) => state, { captured: [0, 0] });
    const plain = toPlain(fn);
    // Frozen function-value objects stringify to "[object Object]"
    // under the default toString; the fallback returns that verbatim.
    expect(typeof plain).toBe('string');
    expect(plain).toBe('[object Object]');
  });
});

describe('lib/qlang/core.qlang — data-level projections across the full catalog', () => {
  it('groupBy category — full catalog is addressable as data', async () => {
    // A miniature exercise of the self-describing nature: run a
    // qlang query against the catalog itself to count operands per
    // category. Under Variant B this is what `env | manifest | ...`
    // will produce; for now we just pin the shape by iterating the
    // evaluated Map directly.
    const coreEnv = await evalCore();
    const categories = new Map();
    for (const [, entryVal] of coreEnv) {
      const cat = entryVal.get(keyword('category'));
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
    expect(categories.get('reflective')).toBe(9);  // env use reify manifest runExamples as let parse eval
    expect(categories.get('error')).toBe(2);
    const sum = [...categories.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(69);
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
    expect(evalResult.get(keyword('qlang/kind'))).toBe(keyword('NumberLit'));
    expect(evalResult.get(keyword('value'))).toBe(42);
  });

  it('parse lifts an OperandCall into an AST-Map with :name / :args', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"add(1, 2)" | parse');
    expect(evalResult.get(keyword('qlang/kind'))).toBe(keyword('OperandCall'));
    expect(evalResult.get(keyword('name'))).toBe('add');
    expect(isVec(evalResult.get(keyword('args')))).toBe(true);
    expect(evalResult.get(keyword('args'))).toHaveLength(2);
  });

  it('parse errors on non-string subject', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('42 | parse !| /thrown');
    expect(evalResult).toEqual(keyword('ParseSubjectNotString'));
  });

  it('eval takes a hand-assembled AST-Map and runs it', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('{:qlang/kind :NumberLit :value 42} | eval');
    expect(evalResult).toBe(42);
  });

  it('eval errors on non-Map subject', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const evalResult = await evalQuery('"not-a-map" | eval !| /thrown');
    expect(evalResult).toEqual(keyword('EvalSubjectNotMap'));
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
