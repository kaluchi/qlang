// Edge-case unit tests covering error paths and rare branches
// that the conformance suite alone does not exercise. The goal is
// to push coverage to ≥95% on every src module.
//
// What lives here vs in per-source test files: edge-cases stays a
// staging ground for tests whose source module has no dedicated
// `<module>.test.mjs` (`types.mjs`, `state.mjs`, `rule10.mjs`,
// `runtime/arith.mjs`, `runtime/vec.mjs`, `runtime/map.mjs`,
// `runtime/set.mjs`, `runtime/setops.mjs`, `runtime/predicates.mjs`,
// `runtime/string.mjs`, `runtime/control.mjs`, `runtime/manifest-op.mjs`,
// dispatch helpers). When a `<module>.test.mjs` lands, its
// describe block migrates out of here. Blocks already migrated:
// `parse.mjs` (→ `parse.test.mjs`), `eval.mjs unknown node / unknown
// combinator / quoted-keyword identity` (→ `eval-smoke.test.mjs`),
// `runtime/format.mjs structural` (→ `print-value-extras.test.mjs`),
// `per-site error tag identity` (→ `error-operands.test.mjs`),
// `parser doc-comment attachment` (→ `parse.test.mjs`),
// `errors.mjs kind-tag survey` (covered by `errors.test.mjs`).

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import {
  ArityError,
  QlangTypeError
} from '../../src/errors.mjs';
import {
  keyword,
  describeType,
  isConduit,
  isFunctionValue,
  isKeyword,
  isQMap,
  isQSet,
  isVec,
  makeConduit
} from '../../src/types.mjs';
import { catchOriginalError, expectErrorCategory } from '../helpers/error-assertions.mjs';
import {
  makeState,
  envSet,
  envHas,
  envGet,
  envMerge
} from '../../src/state.mjs';
import {
  applyRule10,
  makeFn
} from '../../src/rule10.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';

describe('types.mjs', () => {
  it('interns keywords', () => {
    expect(keyword('foo')).toEqual(keyword('foo'));
    expect(keyword('foo')).not.toEqual(keyword('bar'));
  });

  it('describeType covers every value class', () => {
    expect(describeType(null)).toBe('Null');
    expect(describeType(undefined)).toBe('Null');
    expect(describeType(true)).toBe('Boolean');
    expect(describeType(42)).toBe('Number');
    expect(describeType('s')).toBe('String');
    expect(describeType(keyword('k'))).toBe('Keyword');
    expect(describeType([])).toBe('Vec');
    expect(describeType(new Map())).toBe('Map');
    expect(describeType(new Set())).toBe('Set');
    expect(describeType({ type: 'function', arity: 0, fn: () => {} })).toBe('Function');
    expect(describeType(makeConduit({ type: 'NumberLit', value: 1, text: '1' }))).toBe('Conduit');
    expect(describeType(Symbol('weird'))).toBe('Unknown');
  });

  it('value-class predicates', () => {
    expect(isConduit(makeConduit({ type: 'NumberLit', value: 1, text: '1' }))).toBe(true);
    expect(isConduit({ type: 'function' })).toBe(false);
    expect(isFunctionValue({ type: 'function', arity: 0, fn: () => {} })).toBe(true);
    expect(isFunctionValue(() => {})).toBe(false);
    expect(isKeyword(keyword('x'))).toBe(true);
    expect(isQMap(new Map())).toBe(true);
    expect(isQSet(new Set())).toBe(true);
    expect(isVec([])).toBe(true);
  });

  it('makeConduit stamps ::conduit on the Map JS-header and exposes body/source as fields', async () => {
    const { TAG_HEADER_SYMBOL, CONDUIT_TAG, typeKeyword } = await import('../../src/types.mjs');
    const bodyAst = { type: 'NumberLit', value: 1, text: '1' };
    const t = makeConduit(bodyAst);
    expect(t).toBeInstanceOf(Map);
    expect(t.has('kind')).toBe(false);
    expect(t[TAG_HEADER_SYMBOL]).toBe(CONDUIT_TAG);
    expect(typeKeyword(t)).toBe(CONDUIT_TAG);
    expect(t.get('body')).toBe(bodyAst);
    expect(t.get('source')).toBe('1');
  });
});

describe('state.mjs', () => {
  it('envSet returns a new Map without mutating the original', () => {
    const initial = new Map();
    const extended = envSet(initial, 'foo', 42);
    expect(initial.size).toBe(0);
    expect(extended.size).toBe(1);
    expect(envGet(extended, 'foo')).toBe(42);
    expect(envHas(extended, 'foo')).toBe(true);
    expect(envHas(extended, 'bar')).toBe(false);
  });

  it('envMerge merges a Map into another, incoming wins on conflict', () => {
    const base    = envSet(envSet(new Map(), 'a', 1), 'shared', 'old');
    const incoming = envSet(envSet(new Map(), 'b', 2), 'shared', 'new');
    const merged = envMerge(base, incoming);
    expect(envGet(merged, 'a')).toBe(1);
    expect(envGet(merged, 'b')).toBe(2);
    expect(envGet(merged, 'shared')).toBe('new');
  });
});

describe('rule10.mjs', () => {
  it('rejects too many captured args', async () => {
    const fn = makeFn('mul', 2, (state) => state);
    const lambdas = [() => 1, () => 2, () => 3];
    const runtimeEnv = await langRuntime();
    await expect(applyRule10(fn, lambdas, makeState(null, runtimeEnv)))
      .rejects.toThrow(ArityError);
  });

  it('makeFn stores metadata on a frozen object', () => {
    const fn = makeFn('identity', 1, (state) => state);
    expect(fn.type).toBe('function');
    expect(fn.name).toBe('identity');
    expect(fn.arity).toBe(1);
    expect(typeof fn.fn).toBe('function');
    expect(Object.isFrozen(fn)).toBe(true);
  });

  it('makeFn carries no pseudo flag', () => {
    const fn = makeFn('identity', 1, (state) => state);
    expect('pseudo' in fn).toBe(false);
  });
});

describe('runtime/predicates.mjs ordering type errors', () => {
  it('gt rejects heterogeneous comparison', async () => {
    await expectErrorCategory('"a" | gt(5)', 'typeError');
  });
  it('lt rejects non-comparable subject', async () => {
    await expectErrorCategory('null | lt(5)', 'typeError');
  });
  it('min raises on mixed Vec', async () => {
    await expectErrorCategory('[1 "a"] | min', 'typeError');
  });
  it('max raises on non-comparable', async () => {
    await expectErrorCategory('[null null] | max', 'typeError');
  });
  it('sort raises on mixed-type Vec', async () => {
    await expectErrorCategory('[1 "a"] | sort', 'typeError');
  });
});

describe('runtime/arith.mjs error paths', () => {
  it('add rejects non-numeric subject', async () => {
    await expectErrorCategory('"x" | add(1)', 'typeError');
  });
  it('add rejects non-numeric modifier', async () => {
    await expectErrorCategory('1 | add("x")', 'typeError');
  });
  it('sub rejects non-numeric subject', async () => {
    await expectErrorCategory('"x" | sub(1)', 'typeError');
  });
  it('mul rejects non-numeric subject', async () => {
    await expectErrorCategory('"x" | mul(1)', 'typeError');
  });
  it('div rejects non-numeric subject', async () => {
    await expectErrorCategory('"x" | div(1)', 'typeError');
  });
});

describe('runtime/vec.mjs error paths', () => {
  it('count rejects non-Vec', async () => {
    await expectErrorCategory('42 | count', 'typeError');
  });
  it('first rejects non-Vec', async () => {
    await expectErrorCategory('42 | first', 'typeError');
  });
  it('sum rejects non-Vec', async () => {
    await expectErrorCategory('42 | sum', 'typeError');
  });
  it('filter rejects non-Vec', async () => {
    await expectErrorCategory('42 | filter(gt(1))', 'typeError');
  });
  it('take rejects non-numeric n', async () => {
    await expectErrorCategory('[1 2 3] | take("x")', 'typeError');
  });
  it('drop rejects non-numeric n', async () => {
    await expectErrorCategory('[1 2 3] | drop("x")', 'typeError');
  });
  it('sort with key', async () => {
    expect(await evalQuery('[{:n 3} {:n 1} {:n 2}] | sort(/n)'))
      .toEqual([new Map([['n', 1]]), new Map([['n', 2]]), new Map([['n', 3]])]);
  });
});

describe('runtime/map.mjs error paths', () => {
  it('keys rejects non-Map', async () => {
    await expectErrorCategory('42 | keys', 'typeError');
  });
  it('vals rejects non-Map', async () => {
    await expectErrorCategory('42 | vals', 'typeError');
  });
  it('has rejects non-Map/non-Set subject', async () => {
    await expectErrorCategory('42 | has(:foo)', 'typeError');
  });
  it('has on Map requires keyword key', async () => {
    await expectErrorCategory('{:k 1} | has("k")', 'typeError');
  });
});

describe('runtime/setops.mjs Map×Map and errors', () => {
  it('union of Set with Map errors', async () => {
    await expectErrorCategory('#[:a] | union({:b 1})', 'typeError');
  });
  it('minus of Map by another Map (key-based)', async () => {
    const evalResult = await evalQuery('{:a 1 :b 2 :c 3} | minus({:b 99 :d 5})');
    expect(evalResult).toEqual(new Map([['a', 1], ['c', 3]]));
  });
  it('inter of Map by another Map', async () => {
    const evalResult = await evalQuery('{:a 1 :b 2 :c 3} | inter({:b 99 :d 5})');
    expect(evalResult).toEqual(new Map([['b', 2]]));
  });
  it('minus of Set by Map errors', async () => {
    await expectErrorCategory('#[:a] | minus({:a 1})', 'typeError');
  });
  it('inter of Set by Map errors', async () => {
    await expectErrorCategory('#[:a] | inter({:a 1})', 'typeError');
  });
});

describe('runtime/predicates.mjs deepEqual', () => {
  it('eq of Maps with same content', async () => {
    expect(await evalQuery('{:a 1 :b 2} | eq({:a 1 :b 2})')).toBe(true);
  });
  it('eq of Maps with different content', async () => {
    expect(await evalQuery('{:a 1} | eq({:a 2})')).toBe(false);
  });
  it('eq of Sets', async () => {
    expect(await evalQuery('#[:a :b] | eq(#[:b :a])')).toBe(true);
  });
  it('eq of mismatched types', async () => {
    expect(await evalQuery('42 | eq("42")')).toBe(false);
  });
  it('eq with null', async () => {
    expect(await evalQuery('null | eq(null)')).toBe(true);
  });
  it('eq nested', async () => {
    expect(await evalQuery('[{:a 1}] | eq([{:a 1}])')).toBe(true);
  });
});

describe('runtime/string.mjs split and join error sites', () => {
  it('split on non-string subject → SplitSubjectNotStringError', async () => {
    const caughtErr = await catchOriginalError('42 | split(",")');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('SplitSubjectNotStringError');
  });

  it('split with non-string separator → SplitSeparatorNotStringError', async () => {
    const caughtErr = await catchOriginalError('"abc" | split(42)');
    expect(caughtErr.name).toBe('SplitSeparatorNotStringError');
  });

  it('join on non-Vec subject → JoinSubjectNotVecError', async () => {
    const caughtErr = await catchOriginalError('42 | join(",")');
    expect(caughtErr.name).toBe('JoinSubjectNotVecError');
  });

  it('join with non-string element → JoinElementNotStringError', async () => {
    const caughtErr = await catchOriginalError('["a" 42 "c"] | join(",")');
    expect(caughtErr.name).toBe('JoinElementNotStringError');
    expect(caughtErr.context.index).toBe(1);
  });

  it('join with non-string separator → JoinSeparatorNotStringError', async () => {
    const caughtErr = await catchOriginalError('["a" "b"] | join(42)');
    expect(caughtErr.name).toBe('JoinSeparatorNotStringError');
  });

  it('every split/join site has a unique class name', async () => {
    const queries = [
      '42 | split(",")',
      '"abc" | split(42)',
      '42 | join(",")',
      '["a" 42] | join(",")',
      '["a" "b"] | join(42)'
    ];
    const names = new Set();
    for (const q of queries) names.add((await catchOriginalError(q)).name);
    expect(names.size).toBe(queries.length);
  });
});

describe('dispatch helper arity error paths', () => {
  it('overloadedOp throws ArityError on unsupported captured-arg count', async () => {
    // sort accepts 0 or 1 captured args; calling with 2 hits the
    // overloadedOp dispatch's `if (!impl)` branch.
    await expectErrorCategory('[1 2] | sort(/x, /y)', 'arityError');
  });

  it('stateOp throws ArityError when captured-arg count mismatches expected', async () => {
    // env accepts 0 captured args; calling env(arg) fires the
    // stateOp's `lambdas.length !== expected` branch.
    await expectErrorCategory('env(:foo)', 'arityError');
  });
});

describe('runtime/manifest-op.mjs manifest enumeration', () => {
  // `manifest` walks env, building a per-binding descriptor through
  // `describeBinding`. The descriptor `:effectful` field is the only
  // user-visible bit derived at enumeration time from the impl
  // function-value; everything else is read straight off the env
  // entry. For per-binding introspection (source / docs / examples
  // of a single name) reach for the axis trio instead — manifest
  // is the enumeration surface, not the navigation surface.

  it('manifest descriptors all have :effectful field for builtin entries', async () => {
    const effectfulResult = await evalQuery('manifest * /effectful | distinct');
    // Every langRuntime builtin is a clean (non-effectful) function.
    expect(effectfulResult).toEqual(new Set([false]));
  });

  it('manifest returns a Vec of descriptors sorted by name', async () => {
    const manifestResult = await evalQuery('env | manifest');
    expect(Array.isArray(manifestResult)).toBe(true);
    expect(manifestResult.length).toBeGreaterThan(30);
    // Check that names are sorted alphabetically.
    const names = manifestResult.map(d => d.get('name'));
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('host-bound raw function value surfaces as :kind ::value rather than crashing', async () => {
    // A function value landed in env through `session.bind(name, fn)`
    // without a descriptor-Map wrapper carries only the dispatch-
    // wrapper's `{ captured }` meta — no `category` / `subject` /
    // `returns` shape. `describeBinding` routes such entries to
    // `describeValue` (host-fn marker) rather than the conduit-
    // parameter proxy descriptor builder; conduitParameter proxies
    // are the only function values that stamp `meta.category
    // :conduitParameter` inline and therefore the only ones that
    // route through `describeConduitParameter`.
    const { createSession } = await import('../../src/session.mjs');
    const { nullaryOp } = await import('../../src/runtime/dispatch.mjs');
    const sessionInstance = await createSession();
    sessionInstance.bind('hostFn', nullaryOp('hostFn', async () => 42));
    const cellEntry = await sessionInstance.evalCell(
      'manifest | filter(/name | eq("hostFn")) | first');
    expect(cellEntry.result instanceof Map).toBe(true);
    expect(cellEntry.result.get('kind').name).toBe('value');
    expect(cellEntry.result.get('name')).toBe('hostFn');
  });

  it('conduit descriptor through manifest surfaces :source verbatim', async () => {
    // The :source field exposes the parser-captured `.text` slice of
    // the conduit body. Manifest stamps it via buildConduitDescriptor.
    // Per-binding access goes through the source axis (`:chained |
    // source | /source` returns the whole BindStep); manifest's
    // descriptor surface keeps the body-only slice for enumeration
    // composition.
    const sourceResult = await evalQuery(
      ':chained (mul(2) | add(1)) | manifest | filter(/name | eq("chained")) | first | /source'
    );
    expect(sourceResult).toContain('mul(2)');
    expect(sourceResult).toContain('add(1)');
    expect(sourceResult).toContain('|');
  });
});

describe('source axis on conduit / snapshot / TagKeyword subjects', () => {
  // `:name | source` returns a Quote carrying the verbatim source
  // slice of the declaring BindStep — the canonical "what did the
  // user write" answer. Same axis covers value-namespace bindings
  // (Keyword subject) and tag-namespace bindings (TagKeyword subject).

  it('source on a conduit binding name returns the full BindStep slice', async () => {
    const source = await evalQuery(':double mul(2) | :double | source | /source');
    expect(source).toBe(':double mul(2)');
  });

  it('source on a parametric conduit captures the params slot', async () => {
    const source = await evalQuery(':@surround [:pfx :sfx] (prepend(pfx) | append(sfx)) | :@surround | source | /source');
    expect(source).toContain('[:pfx :sfx]');
    expect(source).toContain('prepend(pfx)');
  });

  it('source on a snapshot binding name returns the as(:name) BindStep equivalent', async () => {
    // `as(:snap)` is an OperandCall, not a BindStep — the axis
    // walks both shapes and returns the OperandCall's verbatim
    // slice as the declaration source.
    const source = await evalQuery('42 | as(:snap) | :snap | source | /source');
    expect(source).toContain('as(:snap)');
  });
});

describe('runtime/control.mjs if and coalesce', () => {
  it('if with cond truthy runs the then branch', async () => {
    expect(await evalQuery('75 | if(gte(60), "pass", "fail")')).toBe('pass');
  });

  it('if with cond falsy runs the else branch', async () => {
    expect(await evalQuery('5 | if(gte(60), "pass", "fail")')).toBe('fail');
  });

  it('if treats null as falsy', async () => {
    expect(await evalQuery('{:no "data"} | if(null, "yes", "no")')).toBe('no');
  });

  it('if treats false literal as falsy', async () => {
    expect(await evalQuery('0 | if(false, "yes", "no")')).toBe('no');
  });

  it('if treats 0 as truthy', async () => {
    expect(await evalQuery('5 | if(eq(0), "zero", "non")')).toBe('non');
  });

  it('if only the selected branch runs (else branch never evaluates)', async () => {
    // The else branch contains div(0), which would raise divisionByZero
    // if evaluated. The cond is truthy so the else branch is skipped.
    expect(await evalQuery('10 | if(gt(0), "positive", div(0))')).toBe('positive');
  });

  it('if branches re-project from pipeValue, not from cond result', async () => {
    expect(await evalQuery('{:active true :salary 100} | if(/active, /salary | mul(11) | div(10), /salary)')).toBe(110);
  });

  it('if can be nested for multi-way dispatch', async () => {
    expect(await evalQuery('75 | if(gte(90), "A", if(gte(70), "B", "C"))')).toBe('B');
  });

  it('coalesce returns first non-null alternative', async () => {
    expect(await evalQuery('{:firstName "Alice"} | coalesce(/preferredName, /firstName, "Anon")')).toBe('Alice');
  });

  it('coalesce returns null when all alternatives are null', async () => {
    expect(await evalQuery('{} | coalesce(/a, /b, /c)')).toBe(null);
  });

  it('coalesce treats 0 as non-null', async () => {
    expect(await evalQuery('{:zero 0} | coalesce(/missing, /zero, "default")')).toBe(0);
  });

  it('coalesce treats false as non-null', async () => {
    expect(await evalQuery('{:flag false} | coalesce(/missing, /flag, true)')).toBe(false);
  });

  it('coalesce treats empty string as non-null', async () => {
    expect(await evalQuery('{:s ""} | coalesce(/missing, /s, "default")')).toBe('');
  });

  it('coalesce short-circuits after first non-null (does not evaluate later alts)', async () => {
    // div(0) would raise; coalesce never reaches it because /a is non-null
    expect(await evalQuery('{:a 1} | coalesce(/a, div(0))')).toBe(1);
  });

  it('when with truthy cond runs the then branch', async () => {
    expect(await evalQuery('5 | when(gt(0), mul(2))')).toBe(10);
  });

  it('when with falsy cond passes pipeValue through unchanged', async () => {
    expect(await evalQuery('5 | when(lt(0), mul(2))')).toBe(5);
  });

  it('when only the then branch evaluates when cond truthy', async () => {
    expect(await evalQuery('5 | when(true, mul(2))')).toBe(10);
  });

  it('when never evaluates then when cond falsy', async () => {
    expect(await evalQuery('5 | when(false, div(0))')).toBe(5);
  });

  it('unless with falsy cond runs the then branch', async () => {
    expect(await evalQuery('5 | unless(lt(0), mul(2))')).toBe(10);
  });

  it('unless with truthy cond passes pipeValue through unchanged', async () => {
    expect(await evalQuery('5 | unless(gt(0), mul(2))')).toBe(5);
  });

  it('unless never evaluates then when cond truthy', async () => {
    expect(await evalQuery('5 | unless(true, div(0))')).toBe(5);
  });

  it('unless equivalent to when with negated cond', async () => {
    expect(await evalQuery('5 | unless(lt(0), mul(2))')).toBe(
      await evalQuery('5 | when(lt(0) | not, mul(2))')
    );
  });

  it('firstTruthy returns first truthy alternative', async () => {
    expect(await evalQuery('{:a 1} | firstTruthy(/a, /b)')).toBe(1);
  });

  it('firstTruthy skips false unlike coalesce', async () => {
    expect(await evalQuery('{:a false :b 2} | firstTruthy(/a, /b)')).toBe(2);
  });

  it('coalesce by contrast keeps false', async () => {
    expect(await evalQuery('{:a false :b 2} | coalesce(/a, /b)')).toBe(false);
  });

  it('firstTruthy returns null when all alternatives are falsy', async () => {
    expect(await evalQuery('{:a false :b null} | firstTruthy(/a, /b)')).toBe(null);
  });

  it('firstTruthy treats 0 as truthy (kept)', async () => {
    expect(await evalQuery('{:n 0} | firstTruthy(/missing, /n, "default")')).toBe(0);
  });

  it('firstTruthy treats empty string as truthy (kept)', async () => {
    expect(await evalQuery('{:s ""} | firstTruthy(/missing, /s, "default")')).toBe('');
  });

  it('firstTruthy short-circuits after match', async () => {
    expect(await evalQuery('{:a 1} | firstTruthy(/a, div(0))')).toBe(1);
  });

  it('if and coalesce compose for guarded defaulting', async () => {
    expect(await evalQuery('{:role :admin :name "Bob"} | if(/role | eq(:admin), coalesce(/displayName, /name, "???"), "guest")')).toBe('Bob');
  });

  // Per-site coalesce / firstTruthy arityError tag identity is
  // pinned by `error-operands.test.mjs`; the control-flow block
  // tests the operand semantics, not the per-site wiring.
  it('coalesce raises CoalesceNoAlternativesError on bare call', async () => {
    const caughtErr = await catchOriginalError('{} | coalesce()');
    expect(caughtErr).toBeInstanceOf(ArityError);
  });

  it('firstTruthy raises FirstTruthyNoAlternativesError on bare call', async () => {
    const caughtErr = await catchOriginalError('{} | firstTruthy()');
    expect(caughtErr).toBeInstanceOf(ArityError);
  });
});

describe('runtime/vec.mjs sortWith and comparator builders', () => {
  it('sortWith on non-Vec subject → SortWithSubjectNotSequenceError', async () => {
    const e = await catchOriginalError('42 | sortWith(asc(/x))');
    expect(e).toBeInstanceOf(QlangTypeError);
    expect(e.name).toBe('SortWithSubjectNotSequenceError');
  });

  it('sortWith comparator returning non-number → SortWithCmpResultNotNumberError', async () => {
    const caughtErr = await catchOriginalError('[1 2 3] | sortWith("string")');
    expect(caughtErr.name).toBe('SortWithCmpResultNotNumberError');
  });

  it('asc on non-Map pair → AscPairNotMapError', async () => {
    const caughtErr = await catchOriginalError('42 | asc(/x)');
    expect(caughtErr.name).toBe('AscPairNotMapError');
  });

  it('asc on heterogeneous keys → SortWithCmpResultNotNumberError (error value from asc is non-numeric)', async () => {
    const caughtErr = await catchOriginalError('[{:k 1} {:k "a"}] | sortWith(asc(/k))');
    expect(caughtErr.name).toBe('SortWithCmpResultNotNumberError');
  });

  it('desc on non-Map pair → DescPairNotMapError', async () => {
    const caughtErr = await catchOriginalError('42 | desc(/x)');
    expect(caughtErr.name).toBe('DescPairNotMapError');
  });

  it('desc on heterogeneous keys → SortWithCmpResultNotNumberError (error value from desc is non-numeric)', async () => {
    const caughtErr = await catchOriginalError('[{:k 1} {:k "a"}] | sortWith(desc(/k))');
    expect(caughtErr.name).toBe('SortWithCmpResultNotNumberError');
  });

  it('firstNonZero on non-Vec → FirstNonZeroSubjectNotVecError', async () => {
    const caughtErr = await catchOriginalError('42 | firstNonZero');
    expect(caughtErr.name).toBe('FirstNonZeroSubjectNotVecError');
  });

  it('firstNonZero on Vec with non-number element → FirstNonZeroElementNotNumberError', async () => {
    const caughtErr = await catchOriginalError('[0 "two" 1] | firstNonZero');
    expect(caughtErr.name).toBe('FirstNonZeroElementNotNumberError');
    expect(caughtErr.context.index).toBe(1);
  });

  it('every sortWith/asc/desc/firstNonZero site has a unique class name', async () => {
    const queries = [
      '42 | sortWith(asc(/x))',   // SortWithSubjectNotSequenceError
      '[1 2] | sortWith("not")',  // SortWithCmpResultNotNumberError
      '42 | asc(/x)',              // AscPairNotMapError
      '42 | desc(/x)',             // DescPairNotMapError
      '42 | firstNonZero',         // FirstNonZeroSubjectNotVecError
      '[0 "x"] | firstNonZero'    // FirstNonZeroElementNotNumberError
    ];
    const names = new Set();
    for (const q of queries) names.add((await catchOriginalError(q)).name);
    expect(names.size).toBe(queries.length);
  });

  it('inline arithmetic comparator sorts ascending', async () => {
    expect(await evalQuery('[3 1 4 1 5] | sortWith(sub(/left, /right))'))
      .toEqual([1, 1, 3, 4, 5]);
  });

  it('inline arithmetic comparator sorts descending via reversed sub', async () => {
    expect(await evalQuery('[3 1 4 1 5] | sortWith(sub(/right, /left))'))
      .toEqual([5, 4, 3, 1, 1]);
  });

  it('compound comparator chains via firstNonZero', async () => {
    const sortedResult = await evalQuery(
      '[{:n "B" :a 30} {:n "A" :a 20} {:n "B" :a 25}] ' +
      '| sortWith([asc(/n), desc(/a)] | firstNonZero) * /a'
    );
    expect(sortedResult).toEqual([20, 30, 25]);
  });
});
