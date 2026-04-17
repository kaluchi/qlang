// Edge-case unit tests covering error paths and rare branches
// that the conformance suite alone does not exercise. The goal is
// to push coverage to ≥95% on every src module.

import { describe, it, expect } from 'vitest';
import { evalQuery, evalAst } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import {
  QlangError,
  QlangTypeError,
  UnresolvedIdentifierError,
  DivisionByZeroError,
  ArityError
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
  makeConduit,
  isErrorValue
} from '../../src/types.mjs';
import { expectErrorKind } from '../helpers/error-assertions.mjs';
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
    expect(keyword('foo')).toBe(keyword('foo'));
    expect(keyword('foo')).not.toBe(keyword('bar'));
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
    expect(describeType(makeConduit(null))).toBe('Conduit');
    expect(describeType(Symbol('weird'))).toBe('Unknown');
  });

  it('value-class predicates', () => {
    expect(isConduit(makeConduit(null))).toBe(true);
    expect(isConduit({ type: 'function' })).toBe(false);
    expect(isFunctionValue({ type: 'function', arity: 0, fn: () => {} })).toBe(true);
    expect(isFunctionValue(() => {})).toBe(false);
    expect(isKeyword(keyword('x'))).toBe(true);
    expect(isQMap(new Map())).toBe(true);
    expect(isQSet(new Set())).toBe(true);
    expect(isVec([])).toBe(true);
  });

  it('makeConduit returns a Variant-B conduit descriptor Map', () => {
    const t = makeConduit('expr-ast');
    expect(t).toBeInstanceOf(Map);
    expect(t.get(keyword('qlang/kind'))).toEqual(keyword('conduit'));
    expect(t.get(keyword('qlang/body'))).toBe('expr-ast');
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

  it('makeFn no longer carries a pseudo flag', () => {
    const fn = makeFn('identity', 1, (state) => state);
    expect('pseudo' in fn).toBe(false);
  });
});

describe('errors.mjs', () => {
  it('all error subclasses carry kind tags', () => {
    expect(new QlangTypeError('msg').kind).toBe('type-error');
    expect(new UnresolvedIdentifierError('foo').kind).toBe('unresolved-identifier');
    expect(new UnresolvedIdentifierError('foo').identifierName).toBe('foo');
    expect(new DivisionByZeroError().kind).toBe('division-by-zero');
    expect(new ArityError('arity').kind).toBe('arity-error');
    expect(new QlangError('generic', 'custom').kind).toBe('custom');
  });
});

describe('runtime/predicates.mjs ordering type errors', () => {
  it('gt rejects heterogeneous comparison', async () => {
    await expectErrorKind('"a" | gt(5)', 'type-error');
  });
  it('lt rejects non-comparable subject', async () => {
    await expectErrorKind('null | lt(5)', 'type-error');
  });
  it('min raises on mixed Vec', async () => {
    await expectErrorKind('[1 "a"] | min', 'type-error');
  });
  it('max raises on non-comparable', async () => {
    await expectErrorKind('[null null] | max', 'type-error');
  });
  it('sort raises on mixed-type Vec', async () => {
    await expectErrorKind('[1 "a"] | sort', 'type-error');
  });
});

describe('parse.mjs', () => {
  it('rethrows non-PeggySyntaxError as-is', () => {
    expect(() => parse(undefined)).toThrow(/string source/);
  });

  it('exposes ParseError with location', () => {
    try { parse('{:k}'); } catch (e) {
      expect(e.location).toBeTruthy();
    }
  });
});

describe('runtime/arith.mjs error paths', () => {
  it('add rejects non-numeric subject', async () => {
    await expectErrorKind('"x" | add(1)', 'type-error');
  });
  it('add rejects non-numeric modifier', async () => {
    await expectErrorKind('1 | add("x")', 'type-error');
  });
  it('sub rejects non-numeric subject', async () => {
    await expectErrorKind('"x" | sub(1)', 'type-error');
  });
  it('mul rejects non-numeric subject', async () => {
    await expectErrorKind('"x" | mul(1)', 'type-error');
  });
  it('div rejects non-numeric subject', async () => {
    await expectErrorKind('"x" | div(1)', 'type-error');
  });
});

describe('runtime/vec.mjs error paths', () => {
  it('count rejects non-Vec', async () => {
    await expectErrorKind('42 | count', 'type-error');
  });
  it('first rejects non-Vec', async () => {
    await expectErrorKind('42 | first', 'type-error');
  });
  it('sum rejects non-Vec', async () => {
    await expectErrorKind('42 | sum', 'type-error');
  });
  it('filter rejects non-Vec', async () => {
    await expectErrorKind('42 | filter(gt(1))', 'type-error');
  });
  it('take rejects non-numeric n', async () => {
    await expectErrorKind('[1 2 3] | take("x")', 'type-error');
  });
  it('drop rejects non-numeric n', async () => {
    await expectErrorKind('[1 2 3] | drop("x")', 'type-error');
  });
  it('sort with key', async () => {
    expect(await evalQuery('[{:n 3} {:n 1} {:n 2}] | sort(/n)'))
      .toEqual([new Map([[keyword('n'), 1]]), new Map([[keyword('n'), 2]]), new Map([[keyword('n'), 3]])]);
  });
});

describe('runtime/map.mjs error paths', () => {
  it('keys rejects non-Map', async () => {
    await expectErrorKind('42 | keys', 'type-error');
  });
  it('vals rejects non-Map', async () => {
    await expectErrorKind('42 | vals', 'type-error');
  });
  it('has rejects non-Map/non-Set subject', async () => {
    await expectErrorKind('42 | has(:foo)', 'type-error');
  });
  it('has on Map requires keyword key', async () => {
    await expectErrorKind('{:k 1} | has("k")', 'type-error');
  });
});

describe('runtime/set.mjs error paths', () => {
  it('set rejects non-Vec', async () => {
    await expectErrorKind('42 | set', 'type-error');
  });
});

describe('runtime/setops.mjs Map×Map and errors', () => {
  it('union of Set with Map errors', async () => {
    await expectErrorKind('#{:a} | union({:b 1})', 'type-error');
  });
  it('minus of Map by another Map (key-based)', async () => {
    const evalResult = await evalQuery('{:a 1 :b 2 :c 3} | minus({:b 99 :d 5})');
    expect(evalResult).toEqual(new Map([[keyword('a'), 1], [keyword('c'), 3]]));
  });
  it('inter of Map by another Map', async () => {
    const evalResult = await evalQuery('{:a 1 :b 2 :c 3} | inter({:b 99 :d 5})');
    expect(evalResult).toEqual(new Map([[keyword('b'), 2]]));
  });
  it('minus of Set by Map errors', async () => {
    await expectErrorKind('#{:a} | minus({:a 1})', 'type-error');
  });
  it('inter of Set by Map errors', async () => {
    await expectErrorKind('#{:a} | inter({:a 1})', 'type-error');
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
    expect(await evalQuery('#{:a :b} | eq(#{:b :a})')).toBe(true);
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

describe('eval.mjs unknown node type', () => {
  it('throws on unknown AST node', async () => {
    const fakeNode = { type: 'BogusNode' };
    const runtimeEnv = await langRuntime();
    const state = makeState(null, runtimeEnv);
    await expect(evalAst(fakeNode, state)).rejects.toThrow(/unknown AST node type/);
  });
});

describe('quoted keywords — eval-level identity and Map interop', () => {
  it(':"name" interns to the same keyword as :name', async () => {
    expect(await evalQuery(':"name" | eq(:name)')).toBe(true);
  });

  it('Map literal with a quoted-key entry is queryable via /"key"', async () => {
    expect(await evalQuery('{:"weird key" 42} | /"weird key"')).toBe(42);
  });

  it('Map literal with a quoted key is queryable via has(:"weird key")', async () => {
    expect(await evalQuery('{:"weird key" 1} | has(:"weird key")')).toBe(true);
  });

  it('the empty-string keyword survives a Map round-trip', async () => {
    expect(await evalQuery('{:"" "empty key value"} | /""')).toBe('empty key value');
  });

  it('digit-leading keys are reachable through quoted projection', async () => {
    expect(await evalQuery('{:"123" "digit"} | /"123"')).toBe('digit');
  });

  it('keys returns interned keywords regardless of declaration form', async () => {
    // The set returned by keys contains keywords; verify the bare and
    // quoted forms produce equivalent keyword identity downstream.
    expect(await evalQuery('{:foo 1} | keys | has(:"foo")')).toBe(true);
    expect(await evalQuery('{:"foo" 1} | keys | has(:foo)')).toBe(true);
  });

  it('json operand emits arbitrary JSON object keys via quoted Map keys', async () => {
    const jsonOutput = await evalQuery('{:"foo bar" 1 :"$ref" "x"} | json');
    expect(jsonOutput).toContain('"foo bar"');
    expect(jsonOutput).toContain('"$ref"');
  });
});

describe('runtime/format.mjs structural', () => {
  it('table renders headers and rows', async () => {
    const tableOutput = await evalQuery('[{:name "Alice" :age 30} {:name "Bob" :age 25}] | table');
    expect(tableOutput).toContain('name');
    expect(tableOutput).toContain('age');
    expect(tableOutput).toContain('Alice');
    expect(tableOutput).toContain('Bob');
    expect(tableOutput).toContain('30');
    expect(tableOutput).toContain('25');
    expect(tableOutput.split('\n').length).toBeGreaterThan(4);
  });

  it('table aligns columns of varying widths', async () => {
    const tableOutput = await evalQuery('[{:short "a" :long "longerValue"} {:short "bbb" :long "x"}] | table');
    expect(tableOutput).toContain('longerValue');
    expect(tableOutput).toContain('bbb');
  });

  it('table tolerates missing fields', async () => {
    const tableOutput = await evalQuery('[{:a 1} {:b 2}] | table');
    expect(tableOutput).toContain('a');
    expect(tableOutput).toContain('b');
  });

  it('json roundtrips Set as array', async () => {
    expect(await evalQuery('#{1 2 3} | json')).toMatch(/^\[/);
  });

  it('json roundtrips keyword as colon-prefixed string', async () => {
    expect(await evalQuery(':foo | json')).toBe('":foo"');
  });
});

describe('per-site error classes carry unique identity', () => {
  // Each test catches a concrete error from a known source site
  // and asserts its unique class name + structured context. The
  // class name alone identifies the throw location, and tests
  // match on `e.name` (stable identifier) so they stay readable
  // without importing every per-site class.

  // Runtime errors are error values (5th type). Extract the
  // underlying QlangError via .originalError for structured inspection.
  async function catchError(query) {
    const evalResult = await evalQuery(query);
    return isErrorValue(evalResult) ? evalResult.originalError : null;
  }

  it('count on non-container → CountSubjectNotContainer', async () => {
    const caughtErr = await catchError('42 | count');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('CountSubjectNotContainer');
    expect(caughtErr.context.operand).toBe('count');
    expect(caughtErr.context.actualType).toBe('Number');
  });

  it('keys on non-Map → KeysSubjectNotMap', async () => {
    const caughtErr = await catchError('42 | keys');
    expect(caughtErr.name).toBe('KeysSubjectNotMap');
    expect(caughtErr.context.operand).toBe('keys');
  });

  it('add left non-number → AddLeftNotNumber', async () => {
    const caughtErr = await catchError('"x" | add(1)');
    expect(caughtErr.name).toBe('AddLeftNotNumber');
    expect(caughtErr.context.operand).toBe('add');
    expect(caughtErr.context.position).toBe(1);
    expect(caughtErr.context.actualType).toBe('String');
  });

  it('add right non-number → AddRightNotNumber', async () => {
    const caughtErr = await catchError('1 | add("x")');
    expect(caughtErr.name).toBe('AddRightNotNumber');
    expect(caughtErr.context.position).toBe(2);
  });

  it('sub left non-number → SubLeftNotNumber (distinct from add)', async () => {
    const caughtErr = await catchError('"x" | sub(1)');
    expect(caughtErr.name).toBe('SubLeftNotNumber');
  });

  it('mul left non-number → MulLeftNotNumber', async () => {
    const caughtErr = await catchError('"x" | mul(1)');
    expect(caughtErr.name).toBe('MulLeftNotNumber');
  });

  it('div left non-number → DivLeftNotNumber', async () => {
    const caughtErr = await catchError('"x" | div(1)');
    expect(caughtErr.name).toBe('DivLeftNotNumber');
  });

  it('prepend modifier non-string → PrependPrefixNotString', async () => {
    const caughtErr = await catchError('"x" | prepend(42)');
    expect(caughtErr.name).toBe('PrependPrefixNotString');
    expect(caughtErr.context.position).toBe(2);
  });

  it('append modifier non-string → AppendSuffixNotString', async () => {
    const caughtErr = await catchError('"x" | append(42)');
    expect(caughtErr.name).toBe('AppendSuffixNotString');
  });

  it('sum element non-number → SumElementNotNumber', async () => {
    const caughtErr = await catchError('[1 "two" 3] | sum');
    expect(caughtErr.name).toBe('SumElementNotNumber');
    expect(caughtErr.context.index).toBe(1);
    expect(caughtErr.context.actualType).toBe('String');
  });

  it('gt across types → GtOperandsNotComparable', async () => {
    const caughtErr = await catchError('"a" | gt(5)');
    expect(caughtErr.name).toBe('GtOperandsNotComparable');
    expect(caughtErr.context.leftType).toBe('String');
    expect(caughtErr.context.rightType).toBe('Number');
  });

  it('lt across types → LtOperandsNotComparable (distinct class)', async () => {
    const caughtErr = await catchError('"a" | lt(5)');
    expect(caughtErr.name).toBe('LtOperandsNotComparable');
  });

  it('projection on non-Map → ProjectionSubjectNotMap', async () => {
    const caughtErr = await catchError('42 | /name');
    expect(caughtErr.name).toBe('ProjectionSubjectNotMap');
    expect(caughtErr.context.key).toBe('name');
    expect(caughtErr.context.actualType).toBe('Number');
  });

  it('distribute on non-Vec → DistributeSubjectNotVec', async () => {
    const caughtErr = await catchError('{:a 1} * add(1)');
    expect(caughtErr.name).toBe('DistributeSubjectNotVec');
    expect(caughtErr.context.actualType).toBe('Map');
  });

  it('merge on non-Vec → MergeSubjectNotVec (distinct from distribute)', async () => {
    const caughtErr = await catchError('42 >> count');
    expect(caughtErr.name).toBe('MergeSubjectNotVec');
  });

  it('apply args to non-function → ApplyToNonFunction', async () => {
    // Use `as` to bind a raw value (snapshot), not a conduit.
    // Snapshot-unwrap produces a non-function, so captured args trigger
    // ApplyToNonFunction on the unwrapped value.
    const caughtErr = await catchError('5 | as(:five) | five(42)');
    expect(caughtErr.name).toBe('ApplyToNonFunction');
    expect(caughtErr.context.name).toBe('five');
    expect(caughtErr.context.actualType).toBe('Number');
  });

  it('use on non-Map → UseSubjectNotMap', async () => {
    const caughtErr = await catchError('42 | use');
    expect(caughtErr.name).toBe('UseSubjectNotMap');
  });

  it('filter on non-container → FilterSubjectNotContainer', async () => {
    const caughtErr = await catchError('42 | filter(gt(1))');
    expect(caughtErr.name).toBe('FilterSubjectNotContainer');
  });

  it('take count non-number → TakeCountNotNumber', async () => {
    const caughtErr = await catchError('[1 2 3] | take("x")');
    expect(caughtErr.name).toBe('TakeCountNotNumber');
  });

  it('drop count non-number → DropCountNotNumber (distinct from take)', async () => {
    const caughtErr = await catchError('[1 2 3] | drop("x")');
    expect(caughtErr.name).toBe('DropCountNotNumber');
  });

  it('all per-site type errors inherit QlangTypeError and kind', async () => {
    const queries = [
      '42 | count',
      '"x" | add(1)',
      '[1 "two"] | sum',
      '"a" | gt(5)',
      '42 | /name',
      '{:a 1} * add(1)',
      '42 >> count',
      '5 | as(:five) | five(42)',
      '42 | use'
    ];
    for (const q of queries) {
      const caughtErr = await catchError(q);
      expect(caughtErr).toBeInstanceOf(QlangTypeError);
      expect(caughtErr).toBeInstanceOf(QlangError);
      expect(caughtErr.kind).toBe('type-error');
    }
  });

  it('throw sites produce distinct class names (no sharing)', async () => {
    const names = new Set();
    const queries = [
      '42 | count',        // CountSubjectNotContainer
      '42 | first',        // FirstSubjectNotVec
      '42 | last',         // LastSubjectNotVec
      '42 | sum',          // SumSubjectNotVecOrSet
      '42 | reverse',      // ReverseSubjectNotVec
      '42 | distinct',     // DistinctSubjectNotVec
      '42 | sort',         // SortNaturalSubjectNotVec
      '42 | keys',         // KeysSubjectNotMap
      '42 | vals',         // ValsSubjectNotMap
      '"a" | add(1)',      // AddLeftNotNumber
      '"a" | sub(1)',      // SubLeftNotNumber
      '"a" | mul(1)',      // MulLeftNotNumber
      '"a" | div(1)',      // DivLeftNotNumber
      '"a" | gt(5)',       // GtOperandsNotComparable
      '"a" | lt(5)',       // LtOperandsNotComparable
      'null | /name',      // ProjectionSubjectNotMap (Null subject — neither Map nor Vec)
      '{:a 1} * add(1)',   // DistributeSubjectNotVec
      '42 >> count'        // MergeSubjectNotVec
    ];
    for (const q of queries) {
      names.add((await catchError(q)).name);
    }
    // Every query produces a distinct class — the whole point of
    // the refactor is that no two sites share an exception type.
    expect(names.size).toBe(queries.length);
  });
});

describe('eval.mjs unknown combinator', () => {
  it('throws on a hand-built unknown combinator', async () => {
    const ast = {
      type: 'Pipeline',
      steps: [
        { type: 'NumberLit', value: 1 },
        { combinator: '?', step: { type: 'NumberLit', value: 2 } }
      ]
    };
    const runtimeEnv = await langRuntime();
    const state = makeState(null, runtimeEnv);
    await expect(evalAst(ast, state)).rejects.toThrow(/unknown combinator/);
  });
});

describe('runtime/string.mjs split and join error sites', () => {
  async function catchError(query) {
    const evalResult = await evalQuery(query);
    return isErrorValue(evalResult) ? evalResult.originalError : null;
  }

  it('split on non-string subject → SplitSubjectNotString', async () => {
    const caughtErr = await catchError('42 | split(",")');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('SplitSubjectNotString');
  });

  it('split with non-string separator → SplitSeparatorNotString', async () => {
    const caughtErr = await catchError('"abc" | split(42)');
    expect(caughtErr.name).toBe('SplitSeparatorNotString');
  });

  it('join on non-Vec subject → JoinSubjectNotVec', async () => {
    const caughtErr = await catchError('42 | join(",")');
    expect(caughtErr.name).toBe('JoinSubjectNotVec');
  });

  it('join with non-string element → JoinElementNotString', async () => {
    const caughtErr = await catchError('["a" 42 "c"] | join(",")');
    expect(caughtErr.name).toBe('JoinElementNotString');
    expect(caughtErr.context.index).toBe(1);
  });

  it('join with non-string separator → JoinSeparatorNotString', async () => {
    const caughtErr = await catchError('["a" "b"] | join(42)');
    expect(caughtErr.name).toBe('JoinSeparatorNotString');
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
    for (const q of queries) names.add((await catchError(q)).name);
    expect(names.size).toBe(queries.length);
  });
});

describe('dispatch helper arity error paths', () => {
  it('overloadedOp throws ArityError on unsupported captured-arg count', async () => {
    // sort accepts 0 or 1 captured args; calling with 2 hits the
    // overloadedOp dispatch's `if (!impl)` branch.
    await expectErrorKind('[1 2] | sort(/x, /y)', 'arity-error');
  });

  it('stateOp throws ArityError when captured-arg count mismatches expected', async () => {
    // env accepts 0 captured args; calling env(arg) fires the
    // stateOp's `lambdas.length !== expected` branch.
    await expectErrorKind('env(:foo)', 'arity-error');
  });
});

describe('runtime/intro.mjs reify and manifest', () => {
  it('reify on a number returns a value-kind descriptor', async () => {
    const reifyResult = await evalQuery('42 | reify');
    expect(reifyResult).toBeInstanceOf(Map);
    expect(reifyResult.get(keyword('kind'))).toEqual(keyword('value'));
    expect(reifyResult.get(keyword('value'))).toBe(42);
    expect(reifyResult.get(keyword('type'))).toEqual(keyword('number'));
  });

  it('reify on a builtin descriptor Map returns a builtin descriptor', async () => {
    // Under Variant-B, env stores each built-in as a descriptor Map
    // directly. reify(:name) projects it through describeBinding
    // which substitutes :qlang/kind → :kind, drops :qlang/impl, and
    // stamps :captured / :effectful / :name from the resolved
    // primitive. The named form is the canonical spelling; bare
    // `env | /count | reify` omits :name because no explicit name
    // is in scope at the value-level reify branch.
    const reifyCountResult = await evalQuery('reify(:count)');
    expect(reifyCountResult.get(keyword('kind'))).toEqual(keyword('builtin'));
    expect(reifyCountResult.get(keyword('name'))).toBe('count');
    expect(reifyCountResult.get(keyword('captured'))).toEqual([0, 0]);
    expect(Array.isArray(reifyCountResult.get(keyword('docs')))).toBe(true);
    expect(reifyCountResult.get(keyword('docs')).length).toBeGreaterThan(0);
  });

  it('builtin descriptor surfaces :effectful=false for clean langRuntime operands', async () => {
    expect(await evalQuery('reify(:count) | /effectful')).toBe(false);
    expect(await evalQuery('reify(:filter) | /effectful')).toBe(false);
  });

  it('conduit descriptor surfaces :effectful from the binding name', async () => {
    expect(await evalQuery('let(:foo, count) | reify(:foo) | /effectful')).toBe(false);
    expect(await evalQuery('let(:@foo, count) | reify(:@foo) | /effectful')).toBe(true);
  });

  it('conduit descriptor surfaces :location of the body AST', async () => {
    const locationResult = await evalQuery('let(:foo, count) | reify(:foo) | /location');
    expect(locationResult).not.toBeNull();
  });

  it('snapshot descriptor surfaces :effectful from the binding name', async () => {
    expect(await evalQuery('42 | as(:snap) | reify(:snap) | /effectful')).toBe(false);
    expect(await evalQuery('42 | as(:@snap) | reify(:@snap) | /effectful')).toBe(true);
  });

  it('snapshot descriptor carries location from the as(:name) call site', async () => {
    const locationResult = await evalQuery('42 | as(:snap) | reify(:snap) | /location');
    expect(locationResult).not.toBeNull();
    expect(typeof locationResult.start.offset).toBe('number');
  });

  it('value descriptor always carries :name (null when no binding name)', async () => {
    const reifyValResult = await evalQuery('42 | reify');
    expect(reifyValResult.has(keyword('name'))).toBe(true);
    expect(reifyValResult.get(keyword('name'))).toBeNull();
  });

  it('manifest descriptors all have :effectful field for builtin entries', async () => {
    const effectfulResult = await evalQuery('manifest * /effectful | distinct');
    // Every langRuntime builtin is a clean (non-effectful) function.
    expect(effectfulResult).toEqual([false]);
  });

  it('reify reports :captured [min, UNBOUNDED] for variadic operands', async () => {
    const capturedResult = await evalQuery('env | /coalesce | reify | /captured');
    expect(Array.isArray(capturedResult)).toBe(true);
    expect(capturedResult[0]).toBe(1);
    expect(capturedResult[1]).toEqual(keyword('unbounded'));
  });

  it('reify reports :captured [min, max] for overloaded operands', async () => {
    const capturedResult = await evalQuery('env | /sort | reify | /captured');
    expect(capturedResult).toEqual([0, 1]);
  });

  it('reify(:name) named form attaches the name explicitly', async () => {
    const reifyFilterResult = await evalQuery('reify(:filter)');
    expect(reifyFilterResult.get(keyword('name'))).toBe('filter');
    expect(reifyFilterResult.get(keyword('kind'))).toEqual(keyword('builtin'));
  });

  it('reify(:name) on unresolved name throws', async () => {
    expect(isErrorValue(await evalQuery('reify(:thisDoesNotExist)'))).toBe(true);
  });

  it('reify(non-keyword) → ReifyKeyNotKeyword', async () => {
    const reifyStrResult = await evalQuery('reify("count")');
    expect(isErrorValue(reifyStrResult)).toBe(true);
    expect(reifyStrResult.originalError.name).toBe('ReifyKeyNotKeyword');
  });

  it('manifest returns a Vec of descriptors sorted by name', async () => {
    const manifestResult = await evalQuery('env | manifest');
    expect(Array.isArray(manifestResult)).toBe(true);
    expect(manifestResult.length).toBeGreaterThan(30);
    // Check that names are sorted alphabetically.
    const names = manifestResult.map(d => d.get(keyword('name')));
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('reify with too many captured args raises ArityError', async () => {
    // reify accepts 0 or 1 captured args; calling with 2 hits the
    // stateOpVariadic-controlled overflow path inside reify itself.
    expect(isErrorValue(await evalQuery('reify(:a, :b)'))).toBe(true);
  });

  it('reify of a conduit whose body is a Pipeline renders multi-step source', async () => {
    // The :source field exposes the parser-captured `.text` substring
    // of the conduit body verbatim, including the inner combinators.
    const sourceResult = await evalQuery(
      'let(:chained, mul(2) | add(1)) | reify(:chained) | /source'
    );
    expect(sourceResult).toContain('mul(2)');
    expect(sourceResult).toContain('add(1)');
    expect(sourceResult).toContain('|');
  });

  it('reify of a conduit whose body is a VecLit renders the literal', async () => {
    const sourceResult = await evalQuery('let(:xs, [1 2 3]) | reify(:xs) | /source');
    expect(sourceResult).toBe('[1 2 3]');
  });

  it('reify of a conduit whose body is a SetLit renders the literal', async () => {
    const sourceResult = await evalQuery('let(:s, #{1 2 3}) | reify(:s) | /source');
    expect(sourceResult).toContain('#{');
  });

  it('reify of a conduit whose body is a MapLit renders the literal', async () => {
    const sourceResult = await evalQuery('let(:m, {:a 1 :b 2}) | reify(:m) | /source');
    expect(sourceResult).toContain(':a 1');
    expect(sourceResult).toContain(':b 2');
  });

  it('reify of a conduit whose body is a Projection renders the keys', async () => {
    const sourceResult = await evalQuery('let(:pluck, /name) | reify(:pluck) | /source');
    expect(sourceResult).toBe('/name');
  });

  it('reify of a conduit whose body is a nested Projection renders all keys', async () => {
    const sourceResult = await evalQuery('let(:deep, /a/b/c) | reify(:deep) | /source');
    expect(sourceResult).toBe('/a/b/c');
  });
});

describe('runtime/control.mjs if and coalesce', () => {
  async function catchError(query) {
    const evalResult = await evalQuery(query);
    return isErrorValue(evalResult) ? evalResult.originalError : null;
  }

  it('if with cond truthy runs the then branch', async () => {
    expect(await evalQuery('75 | if(gte(60), "pass", "fail")')).toBe('pass');
  });

  it('if with cond falsy runs the else branch', async () => {
    expect(await evalQuery('5 | if(gte(60), "pass", "fail")')).toBe('fail');
  });

  it('if treats null as falsy', async () => {
    expect(await evalQuery('{:no "data"} | if(/missing, "yes", "no")')).toBe('no');
  });

  it('if treats false literal as falsy', async () => {
    expect(await evalQuery('0 | if(false, "yes", "no")')).toBe('no');
  });

  it('if treats 0 as truthy', async () => {
    expect(await evalQuery('5 | if(eq(0), "zero", "non")')).toBe('non');
  });

  it('if only the selected branch runs (else branch never evaluates)', async () => {
    // The else branch contains div(0), which would raise division-by-zero
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

  it('coalesce with zero captured args raises CoalesceNoAlternatives as an ArityError', async () => {
    const caughtErr = await catchError('{} | coalesce()');
    expect(caughtErr).toBeInstanceOf(ArityError);
    expect(caughtErr.kind).toBe('arity-error');
    expect(caughtErr.name).toBe('CoalesceNoAlternatives');
  });

  it('coalesce error site has unique class name', async () => {
    const caughtErr = await catchError('{} | coalesce()');
    expect(caughtErr.name).toBe('CoalesceNoAlternatives');
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

  it('firstTruthy with zero captured args raises FirstTruthyNoAlternatives as an ArityError', async () => {
    const caughtErr = await catchError('{} | firstTruthy()');
    expect(caughtErr).toBeInstanceOf(ArityError);
    expect(caughtErr.kind).toBe('arity-error');
    expect(caughtErr.name).toBe('FirstTruthyNoAlternatives');
  });

  it('firstTruthy short-circuits after match', async () => {
    expect(await evalQuery('{:a 1} | firstTruthy(/a, div(0))')).toBe(1);
  });

  it('if and coalesce compose for guarded defaulting', async () => {
    expect(await evalQuery('{:role :admin :name "Bob"} | if(/role | eq(:admin), coalesce(/displayName, /name, "???"), "guest")')).toBe('Bob');
  });
});

describe('runtime/vec.mjs sortWith and comparator builders', () => {
  async function catchError(query) {
    const evalResult = await evalQuery(query);
    return isErrorValue(evalResult) ? evalResult.originalError : null;
  }

  it('sortWith on non-Vec subject → SortWithSubjectNotVec', async () => {
    const e = await catchError('42 | sortWith(asc(/x))');
    expect(e).toBeInstanceOf(QlangTypeError);
    expect(e.name).toBe('SortWithSubjectNotVec');
  });

  it('sortWith comparator returning non-number → SortWithCmpResultNotNumber', async () => {
    const caughtErr = await catchError('[1 2 3] | sortWith("string")');
    expect(caughtErr.name).toBe('SortWithCmpResultNotNumber');
  });

  it('asc on non-Map pair → AscPairNotMap', async () => {
    const caughtErr = await catchError('42 | asc(/x)');
    expect(caughtErr.name).toBe('AscPairNotMap');
  });

  it('asc on heterogeneous keys → SortWithCmpResultNotNumber (error value from asc is non-numeric)', async () => {
    const caughtErr = await catchError('[{:k 1} {:k "a"}] | sortWith(asc(/k))');
    expect(caughtErr.name).toBe('SortWithCmpResultNotNumber');
  });

  it('desc on non-Map pair → DescPairNotMap', async () => {
    const caughtErr = await catchError('42 | desc(/x)');
    expect(caughtErr.name).toBe('DescPairNotMap');
  });

  it('desc on heterogeneous keys → SortWithCmpResultNotNumber (error value from desc is non-numeric)', async () => {
    const caughtErr = await catchError('[{:k 1} {:k "a"}] | sortWith(desc(/k))');
    expect(caughtErr.name).toBe('SortWithCmpResultNotNumber');
  });

  it('firstNonZero on non-Vec → FirstNonZeroSubjectNotVec', async () => {
    const caughtErr = await catchError('42 | firstNonZero');
    expect(caughtErr.name).toBe('FirstNonZeroSubjectNotVec');
  });

  it('firstNonZero on Vec with non-number element → FirstNonZeroElementNotNumber', async () => {
    const caughtErr = await catchError('[0 "two" 1] | firstNonZero');
    expect(caughtErr.name).toBe('FirstNonZeroElementNotNumber');
    expect(caughtErr.context.index).toBe(1);
  });

  it('every sortWith/asc/desc/firstNonZero site has a unique class name', async () => {
    const queries = [
      '42 | sortWith(asc(/x))',   // SortWithSubjectNotVec
      '[1 2] | sortWith("not")',  // SortWithCmpResultNotNumber
      '42 | asc(/x)',              // AscPairNotMap
      '42 | desc(/x)',             // DescPairNotMap
      '42 | firstNonZero',         // FirstNonZeroSubjectNotVec
      '[0 "x"] | firstNonZero'    // FirstNonZeroElementNotNumber
    ];
    const names = new Set();
    for (const q of queries) names.add((await catchError(q)).name);
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

describe('parser doc-comment attachment Vec semantics', () => {
  it('attaches one entry per doc comment, not concatenated', async () => {
    const docsResult = await evalQuery(
      '|~~| First.\n|~~| Second.\n|~~| Third.\nlet(:foo, 42) | reify(:foo) | /docs'
    );
    expect(docsResult).toEqual([' First.', ' Second.', ' Third.']);
  });

  it('block doc preserves internal newlines as one entry', async () => {
    const docsResult = await evalQuery(
      '|~~ line one\nline two\nline three ~~|\nlet(:foo, 42)\n| reify(:foo) | /docs'
    );
    expect(docsResult.length).toBe(1);
    expect(docsResult[0]).toContain('line one');
    expect(docsResult[0]).toContain('line two');
    expect(docsResult[0]).toContain('line three');
  });

  it('mixes line and block docs preserving order', async () => {
    const docsResult = await evalQuery(
      '|~~| line one\n|~~ block two ~~|\n|~~| line three\nlet(:foo, 42) | reify(:foo) | /docs'
    );
    expect(docsResult.length).toBe(3);
    expect(docsResult[0]).toBe(' line one');
    expect(docsResult[1]).toContain('block two');
    expect(docsResult[2]).toBe(' line three');
  });

  it('shadowing redeclare overrides docs Vec', async () => {
    const docsResult = await evalQuery(
      '|~~| Old.\nlet(:foo, 1)\n|~~| Brand new.\n|~~| With extra remark.\nlet(:foo, 2)\n| reify(:foo) | /docs'
    );
    expect(docsResult).toEqual([' Brand new.', ' With extra remark.']);
  });

  it('comment step is identity on pipeValue', async () => {
    expect(await evalQuery('[1 2 3] |~| inline annotation\n| count')).toBe(3);
    expect(await evalQuery('[1 2 3] |~ block annotation ~| count')).toBe(3);
  });
});
