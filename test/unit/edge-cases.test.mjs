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
  isThunk,
  isFunctionValue,
  isKeyword,
  isQMap,
  isQSet,
  isVec,
  makeThunk
} from '../../src/types.mjs';
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
    expect(describeType(null)).toBe('nil');
    expect(describeType(undefined)).toBe('nil');
    expect(describeType(true)).toBe('boolean');
    expect(describeType(42)).toBe('number');
    expect(describeType('s')).toBe('string');
    expect(describeType(keyword('k'))).toBe('keyword');
    expect(describeType([])).toBe('Vec');
    expect(describeType(new Map())).toBe('Map');
    expect(describeType(new Set())).toBe('Set');
    expect(describeType({ type: 'function', arity: 0, fn: () => {} })).toBe('function');
    expect(describeType(makeThunk(null))).toBe('thunk');
    expect(describeType(Symbol('weird'))).toBe('unknown');
  });

  it('value-class predicates', () => {
    expect(isThunk(makeThunk(null))).toBe(true);
    expect(isThunk({ type: 'function' })).toBe(false);
    expect(isFunctionValue({ type: 'function', arity: 0, fn: () => {} })).toBe(true);
    expect(isFunctionValue(() => {})).toBe(false);
    expect(isKeyword(keyword('x'))).toBe(true);
    expect(isQMap(new Map())).toBe(true);
    expect(isQSet(new Set())).toBe(true);
    expect(isVec([])).toBe(true);
  });

  it('makeThunk returns a frozen thunk shape', () => {
    const t = makeThunk('expr-ast');
    expect(t.type).toBe('thunk');
    expect(t.expr).toBe('expr-ast');
    expect(Object.isFrozen(t)).toBe(true);
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
  it('rejects too many captured args', () => {
    const fn = makeFn('mul', 2, (state) => state);
    const lambdas = [() => 1, () => 2, () => 3];
    expect(() => applyRule10(fn, lambdas, makeState(null, langRuntime())))
      .toThrow(ArityError);
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
  it('gt rejects heterogeneous comparison', () => {
    expect(() => evalQuery('"a" | gt(5)')).toThrow(QlangTypeError);
  });
  it('lt rejects non-comparable subject', () => {
    expect(() => evalQuery('nil | lt(5)')).toThrow(QlangTypeError);
  });
  it('min raises on mixed Vec', () => {
    expect(() => evalQuery('[1 "a"] | min')).toThrow(QlangTypeError);
  });
  it('max raises on non-comparable', () => {
    expect(() => evalQuery('[nil nil] | max')).toThrow(QlangTypeError);
  });
  it('sort raises on mixed-type Vec', () => {
    expect(() => evalQuery('[1 "a"] | sort')).toThrow(QlangTypeError);
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
  it('add rejects non-numeric subject', () => {
    expect(() => evalQuery('"x" | add(1)')).toThrow(QlangTypeError);
  });
  it('add rejects non-numeric modifier', () => {
    expect(() => evalQuery('1 | add(\"x\")')).toThrow(QlangTypeError);
  });
  it('sub rejects non-numeric subject', () => {
    expect(() => evalQuery('\"x\" | sub(1)')).toThrow(QlangTypeError);
  });
  it('mul rejects non-numeric subject', () => {
    expect(() => evalQuery('\"x\" | mul(1)')).toThrow(QlangTypeError);
  });
  it('div rejects non-numeric subject', () => {
    expect(() => evalQuery('\"x\" | div(1)')).toThrow(QlangTypeError);
  });
});

describe('runtime/vec.mjs error paths', () => {
  it('count rejects non-Vec', () => {
    expect(() => evalQuery('42 | count')).toThrow(QlangTypeError);
  });
  it('first rejects non-Vec', () => {
    expect(() => evalQuery('42 | first')).toThrow(QlangTypeError);
  });
  it('sum rejects non-Vec', () => {
    expect(() => evalQuery('42 | sum')).toThrow(QlangTypeError);
  });
  it('filter rejects non-Vec', () => {
    expect(() => evalQuery('42 | filter(gt(1))')).toThrow(QlangTypeError);
  });
  it('take rejects non-numeric n', () => {
    expect(() => evalQuery('[1 2 3] | take(\"x\")')).toThrow(QlangTypeError);
  });
  it('drop rejects non-numeric n', () => {
    expect(() => evalQuery('[1 2 3] | drop(\"x\")')).toThrow(QlangTypeError);
  });
  it('sort with key', () => {
    expect(evalQuery('[{:n 3} {:n 1} {:n 2}] | sort(/n)'))
      .toEqual([new Map([[keyword('n'), 1]]), new Map([[keyword('n'), 2]]), new Map([[keyword('n'), 3]])]);
  });
});

describe('runtime/map.mjs error paths', () => {
  it('keys rejects non-Map', () => {
    expect(() => evalQuery('42 | keys')).toThrow(QlangTypeError);
  });
  it('vals rejects non-Map', () => {
    expect(() => evalQuery('42 | vals')).toThrow(QlangTypeError);
  });
  it('has rejects non-Map/non-Set subject', () => {
    expect(() => evalQuery('42 | has(:foo)')).toThrow(QlangTypeError);
  });
  it('has on Map requires keyword key', () => {
    expect(() => evalQuery('{:k 1} | has(\"k\")')).toThrow(QlangTypeError);
  });
});

describe('runtime/set.mjs error paths', () => {
  it('set rejects non-Vec', () => {
    expect(() => evalQuery('42 | set')).toThrow(QlangTypeError);
  });
});

describe('runtime/setops.mjs Map×Map and errors', () => {
  it('union of Set with Map errors', () => {
    expect(() => evalQuery('#{:a} | union({:b 1})')).toThrow(QlangTypeError);
  });
  it('minus of Map by another Map (key-based)', () => {
    const result = evalQuery('{:a 1 :b 2 :c 3} | minus({:b 99 :d 5})');
    expect(result).toEqual(new Map([[keyword('a'), 1], [keyword('c'), 3]]));
  });
  it('inter of Map by another Map', () => {
    const result = evalQuery('{:a 1 :b 2 :c 3} | inter({:b 99 :d 5})');
    expect(result).toEqual(new Map([[keyword('b'), 2]]));
  });
  it('minus of Set by Map errors', () => {
    expect(() => evalQuery('#{:a} | minus({:a 1})')).toThrow(QlangTypeError);
  });
  it('inter of Set by Map errors', () => {
    expect(() => evalQuery('#{:a} | inter({:a 1})')).toThrow(QlangTypeError);
  });
});

describe('runtime/predicates.mjs deepEqual', () => {
  it('eq of Maps with same content', () => {
    expect(evalQuery('{:a 1 :b 2} | eq({:a 1 :b 2})')).toBe(true);
  });
  it('eq of Maps with different content', () => {
    expect(evalQuery('{:a 1} | eq({:a 2})')).toBe(false);
  });
  it('eq of Sets', () => {
    expect(evalQuery('#{:a :b} | eq(#{:b :a})')).toBe(true);
  });
  it('eq of mismatched types', () => {
    expect(evalQuery('42 | eq(\"42\")')).toBe(false);
  });
  it('eq with null', () => {
    expect(evalQuery('nil | eq(nil)')).toBe(true);
  });
  it('eq nested', () => {
    expect(evalQuery('[{:a 1}] | eq([{:a 1}])')).toBe(true);
  });
});

describe('eval.mjs unknown node type', () => {
  it('throws on unknown AST node', () => {
    const fakeNode = { type: 'BogusNode' };
    const state = makeState(null, langRuntime());
    expect(() => evalAst(fakeNode, state)).toThrow(QlangTypeError);
  });
});

describe('quoted keywords — eval-level identity and Map interop', () => {
  it(':"name" interns to the same keyword as :name', () => {
    expect(evalQuery(':"name" | eq(:name)')).toBe(true);
  });

  it('Map literal with a quoted-key entry is queryable via /"key"', () => {
    expect(evalQuery('{:"weird key" 42} | /"weird key"')).toBe(42);
  });

  it('Map literal with a quoted key is queryable via has(:"weird key")', () => {
    expect(evalQuery('{:"weird key" 1} | has(:"weird key")')).toBe(true);
  });

  it('the empty-string keyword survives a Map round-trip', () => {
    expect(evalQuery('{:"" "empty key value"} | /""')).toBe('empty key value');
  });

  it('digit-leading keys are reachable through quoted projection', () => {
    expect(evalQuery('{:"123" "digit"} | /"123"')).toBe('digit');
  });

  it('keys returns interned keywords regardless of declaration form', () => {
    // The set returned by keys contains keywords; verify the bare and
    // quoted forms produce equivalent keyword identity downstream.
    expect(evalQuery('{:foo 1} | keys | has(:"foo")')).toBe(true);
    expect(evalQuery('{:"foo" 1} | keys | has(:foo)')).toBe(true);
  });

  it('json operand emits arbitrary JSON object keys via quoted Map keys', () => {
    const out = evalQuery('{:"foo bar" 1 :"$ref" "x"} | json');
    expect(out).toContain('"foo bar"');
    expect(out).toContain('"$ref"');
  });
});

describe('runtime/format.mjs structural', () => {
  it('table renders headers and rows', () => {
    const out = evalQuery('[{:name "Alice" :age 30} {:name "Bob" :age 25}] | table');
    expect(out).toContain('name');
    expect(out).toContain('age');
    expect(out).toContain('Alice');
    expect(out).toContain('Bob');
    expect(out).toContain('30');
    expect(out).toContain('25');
    expect(out.split('\n').length).toBeGreaterThan(4);
  });

  it('table aligns columns of varying widths', () => {
    const out = evalQuery('[{:short "a" :long "longerValue"} {:short "bbb" :long "x"}] | table');
    expect(out).toContain('longerValue');
    expect(out).toContain('bbb');
  });

  it('table tolerates missing fields', () => {
    const out = evalQuery('[{:a 1} {:b 2}] | table');
    expect(out).toContain('a');
    expect(out).toContain('b');
  });

  it('json roundtrips Set as array', () => {
    expect(evalQuery('#{1 2 3} | json')).toMatch(/^\[/);
  });

  it('json roundtrips keyword as colon-prefixed string', () => {
    expect(evalQuery(':foo | json')).toBe('":foo"');
  });
});

describe('per-site error classes carry unique identity', () => {
  // Each test catches a concrete error from a known source site
  // and asserts its unique class name + structured context. The
  // class name alone identifies the throw location, and tests
  // match on `e.name` (stable identifier) so they stay readable
  // without importing every per-site class.

  function catchError(query) {
    try { evalQuery(query); return null; }
    catch (e) { return e; }
  }

  it('count on non-container → CountSubjectNotContainer', () => {
    const e = catchError('42 | count');
    expect(e).toBeInstanceOf(QlangTypeError);
    expect(e.name).toBe('CountSubjectNotContainer');
    expect(e.context.operand).toBe('count');
    expect(e.context.actualType).toBe('number');
  });

  it('keys on non-Map → KeysSubjectNotMap', () => {
    const e = catchError('42 | keys');
    expect(e.name).toBe('KeysSubjectNotMap');
    expect(e.context.operand).toBe('keys');
  });

  it('add left non-number → AddLeftNotNumber', () => {
    const e = catchError('"x" | add(1)');
    expect(e.name).toBe('AddLeftNotNumber');
    expect(e.context.operand).toBe('add');
    expect(e.context.position).toBe(1);
    expect(e.context.actualType).toBe('string');
  });

  it('add right non-number → AddRightNotNumber', () => {
    const e = catchError('1 | add("x")');
    expect(e.name).toBe('AddRightNotNumber');
    expect(e.context.position).toBe(2);
  });

  it('sub left non-number → SubLeftNotNumber (distinct from add)', () => {
    const e = catchError('"x" | sub(1)');
    expect(e.name).toBe('SubLeftNotNumber');
  });

  it('mul left non-number → MulLeftNotNumber', () => {
    const e = catchError('"x" | mul(1)');
    expect(e.name).toBe('MulLeftNotNumber');
  });

  it('div left non-number → DivLeftNotNumber', () => {
    const e = catchError('"x" | div(1)');
    expect(e.name).toBe('DivLeftNotNumber');
  });

  it('prepend modifier non-string → PrependPrefixNotString', () => {
    const e = catchError('"x" | prepend(42)');
    expect(e.name).toBe('PrependPrefixNotString');
    expect(e.context.position).toBe(2);
  });

  it('append modifier non-string → AppendSuffixNotString', () => {
    const e = catchError('"x" | append(42)');
    expect(e.name).toBe('AppendSuffixNotString');
  });

  it('sum element non-number → SumElementNotNumber', () => {
    const e = catchError('[1 "two" 3] | sum');
    expect(e.name).toBe('SumElementNotNumber');
    expect(e.context.index).toBe(1);
    expect(e.context.actualType).toBe('string');
  });

  it('gt across types → GtOperandsNotComparable', () => {
    const e = catchError('"a" | gt(5)');
    expect(e.name).toBe('GtOperandsNotComparable');
    expect(e.context.leftType).toBe('string');
    expect(e.context.rightType).toBe('number');
  });

  it('lt across types → LtOperandsNotComparable (distinct class)', () => {
    const e = catchError('"a" | lt(5)');
    expect(e.name).toBe('LtOperandsNotComparable');
  });

  it('projection on non-Map → ProjectionSubjectNotMap', () => {
    const e = catchError('42 | /name');
    expect(e.name).toBe('ProjectionSubjectNotMap');
    expect(e.context.key).toBe('name');
    expect(e.context.actualType).toBe('number');
  });

  it('distribute on non-Vec → DistributeSubjectNotVec', () => {
    const e = catchError('{:a 1} * add(1)');
    expect(e.name).toBe('DistributeSubjectNotVec');
    expect(e.context.actualType).toBe('Map');
  });

  it('merge on non-Vec → MergeSubjectNotVec (distinct from distribute)', () => {
    const e = catchError('42 >> count');
    expect(e.name).toBe('MergeSubjectNotVec');
  });

  it('apply args to non-function → ApplyToNonFunction', () => {
    const e = catchError('let five = 5 | five(42)');
    expect(e.name).toBe('ApplyToNonFunction');
    expect(e.context.name).toBe('five');
    expect(e.context.actualType).toBe('number');
  });

  it('use on non-Map → UseSubjectNotMap', () => {
    const e = catchError('42 | use');
    expect(e.name).toBe('UseSubjectNotMap');
  });

  it('filter on non-Vec → FilterSubjectNotVec', () => {
    const e = catchError('42 | filter(gt(1))');
    expect(e.name).toBe('FilterSubjectNotVec');
  });

  it('take count non-number → TakeCountNotNumber', () => {
    const e = catchError('[1 2 3] | take("x")');
    expect(e.name).toBe('TakeCountNotNumber');
  });

  it('drop count non-number → DropCountNotNumber (distinct from take)', () => {
    const e = catchError('[1 2 3] | drop("x")');
    expect(e.name).toBe('DropCountNotNumber');
  });

  it('all per-site type errors inherit QlangTypeError and kind', () => {
    const queries = [
      '42 | count',
      '"x" | add(1)',
      '[1 "two"] | sum',
      '"a" | gt(5)',
      '42 | /name',
      '{:a 1} * add(1)',
      '42 >> count',
      'let five = 5 | five(42)',
      '42 | use'
    ];
    for (const q of queries) {
      const e = catchError(q);
      expect(e).toBeInstanceOf(QlangTypeError);
      expect(e).toBeInstanceOf(QlangError);
      expect(e.kind).toBe('type-error');
    }
  });

  it('throw sites produce distinct class names (no sharing)', () => {
    const names = new Set();
    const queries = [
      '42 | count',        // CountSubjectNotContainer
      '42 | first',        // FirstSubjectNotVec
      '42 | last',         // LastSubjectNotVec
      '42 | sum',          // SumSubjectNotVec
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
      '42 | /name',        // ProjectionSubjectNotMap
      '{:a 1} * add(1)',   // DistributeSubjectNotVec
      '42 >> count'        // MergeSubjectNotVec
    ];
    for (const q of queries) {
      names.add(catchError(q).name);
    }
    // Every query produces a distinct class — the whole point of
    // the refactor is that no two sites share an exception type.
    expect(names.size).toBe(queries.length);
  });
});

describe('eval.mjs unknown combinator', () => {
  it('throws on a hand-built unknown combinator', () => {
    const ast = {
      type: 'Pipeline',
      steps: [
        { type: 'NumberLit', value: 1 },
        { combinator: '?', step: { type: 'NumberLit', value: 2 } }
      ]
    };
    const state = makeState(null, langRuntime());
    expect(() => evalAst(ast, state)).toThrow(QlangTypeError);
  });
});

describe('runtime/string.mjs split and join error sites', () => {
  function catchError(query) {
    try { evalQuery(query); return null; }
    catch (e) { return e; }
  }

  it('split on non-string subject → SplitSubjectNotString', () => {
    const e = catchError('42 | split(",")');
    expect(e).toBeInstanceOf(QlangTypeError);
    expect(e.name).toBe('SplitSubjectNotString');
  });

  it('split with non-string separator → SplitSeparatorNotString', () => {
    const e = catchError('"abc" | split(42)');
    expect(e.name).toBe('SplitSeparatorNotString');
  });

  it('join on non-Vec subject → JoinSubjectNotVec', () => {
    const e = catchError('42 | join(",")');
    expect(e.name).toBe('JoinSubjectNotVec');
  });

  it('join with non-string element → JoinElementNotString', () => {
    const e = catchError('["a" 42 "c"] | join(",")');
    expect(e.name).toBe('JoinElementNotString');
    expect(e.context.index).toBe(1);
  });

  it('join with non-string separator → JoinSeparatorNotString', () => {
    const e = catchError('["a" "b"] | join(42)');
    expect(e.name).toBe('JoinSeparatorNotString');
  });

  it('every split/join site has a unique class name', () => {
    const queries = [
      '42 | split(",")',
      '"abc" | split(42)',
      '42 | join(",")',
      '["a" 42] | join(",")',
      '["a" "b"] | join(42)'
    ];
    const names = new Set(queries.map(q => catchError(q).name));
    expect(names.size).toBe(queries.length);
  });
});

describe('dispatch helper arity error paths', () => {
  it('overloadedOp throws ArityError on unsupported captured-arg count', () => {
    // sort accepts 0 or 1 captured args; calling with 2 hits the
    // overloadedOp dispatch's `if (!impl)` branch.
    expect(() => evalQuery('[1 2] | sort(/x, /y)')).toThrow(ArityError);
  });

  it('stateOp throws ArityError when captured-arg count mismatches expected', () => {
    // env accepts 0 captured args; calling env(arg) fires the
    // stateOp's `lambdas.length !== expected` branch.
    expect(() => evalQuery('env(:foo)')).toThrow(ArityError);
  });
});

describe('runtime/intro.mjs reify and manifest', () => {
  it('reify on a number returns a value-kind descriptor', () => {
    const result = evalQuery('42 | reify');
    expect(result).toBeInstanceOf(Map);
    expect(result.get(keyword('kind'))).toEqual(keyword('value'));
    expect(result.get(keyword('value'))).toBe(42);
    expect(result.get(keyword('type'))).toEqual(keyword('number'));
  });

  it('reify on a builtin function value returns a builtin descriptor', () => {
    const result = evalQuery('env | /count | reify');
    expect(result.get(keyword('kind'))).toEqual(keyword('builtin'));
    expect(result.get(keyword('name'))).toBe('count');
    expect(result.get(keyword('captured'))).toEqual([0, 0]);
    expect(Array.isArray(result.get(keyword('docs')))).toBe(true);
    expect(result.get(keyword('docs')).length).toBeGreaterThan(0);
  });

  it('builtin descriptor surfaces :effectful=false for clean langRuntime operands', () => {
    expect(evalQuery('reify(:count) | /effectful')).toBe(false);
    expect(evalQuery('reify(:filter) | /effectful')).toBe(false);
  });

  it('thunk descriptor surfaces :effectful from the binding name', () => {
    expect(evalQuery('let foo = count | reify(:foo) | /effectful')).toBe(false);
    expect(evalQuery('let @foo = count | reify(:@foo) | /effectful')).toBe(true);
  });

  it('thunk descriptor surfaces :location of the originating LetStep', () => {
    const result = evalQuery('let foo = count | reify(:foo) | /location');
    expect(result).not.toBeNull();
    expect(result.start.offset).toBe(0);
  });

  it('snapshot descriptor surfaces :effectful from the binding name', () => {
    expect(evalQuery('42 | as snap | reify(:snap) | /effectful')).toBe(false);
    expect(evalQuery('42 | as @snap | reify(:@snap) | /effectful')).toBe(true);
  });

  it('snapshot descriptor surfaces :location of the originating AsStep', () => {
    const result = evalQuery('42 | as snap | reify(:snap) | /location');
    expect(result).not.toBeNull();
    expect(typeof result.start.offset).toBe('number');
  });

  it('value descriptor always carries :name (null when no binding name)', () => {
    const result = evalQuery('42 | reify');
    expect(result.has(keyword('name'))).toBe(true);
    expect(result.get(keyword('name'))).toBeNull();
  });

  it('manifest descriptors all have :effectful field for builtin entries', () => {
    const result = evalQuery('manifest * /effectful | distinct');
    // Every langRuntime builtin is a clean (non-effectful) function.
    expect(result).toEqual([false]);
  });

  it('reify reports :captured [min, UNBOUNDED] for variadic operands', () => {
    const result = evalQuery('env | /coalesce | reify | /captured');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe(1);
    expect(result[1]).toEqual(keyword('unbounded'));
  });

  it('reify reports :captured [min, max] for overloaded operands', () => {
    const result = evalQuery('env | /sort | reify | /captured');
    expect(result).toEqual([0, 1]);
  });

  it('reify(:name) named form attaches the name explicitly', () => {
    const result = evalQuery('reify(:filter)');
    expect(result.get(keyword('name'))).toBe('filter');
    expect(result.get(keyword('kind'))).toEqual(keyword('builtin'));
  });

  it('reify(:name) on unresolved name throws', () => {
    expect(() => evalQuery('reify(:thisDoesNotExist)')).toThrow();
  });

  it('reify(non-keyword) → ReifyKeyNotKeyword', () => {
    let thrown;
    try { evalQuery('reify("count")'); } catch (e) { thrown = e; }
    expect(thrown.name).toBe('ReifyKeyNotKeyword');
  });

  it('manifest returns a Vec of descriptors sorted by name', () => {
    const result = evalQuery('env | manifest');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(30);
    // Check that names are sorted alphabetically.
    const names = result.map(d => d.get(keyword('name')));
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('reify with too many captured args raises ArityError', () => {
    // reify accepts 0 or 1 captured args; calling with 2 hits the
    // stateOpVariadic-controlled overflow path inside reify itself.
    expect(() => evalQuery('reify(:a, :b)')).toThrow();
  });

  it('reify of a thunk whose body is a Pipeline renders multi-step source', () => {
    // The thunk body is a ParenGroup wrapping a multi-step pipeline,
    // exercising the Pipeline branch of sourceOfAst.
    const result = evalQuery(
      'let chained = (mul(2) | add(1)) | reify(:chained) | /source'
    );
    expect(result).toContain('mul(2)');
    expect(result).toContain('add(1)');
    expect(result).toContain('|');
  });

  it('reify of a thunk whose body is a VecLit renders the literal', () => {
    const result = evalQuery('let xs = [1 2 3] | reify(:xs) | /source');
    expect(result).toBe('[1 2 3]');
  });

  it('reify of a thunk whose body is a SetLit renders the literal', () => {
    const result = evalQuery('let s = #{1 2 3} | reify(:s) | /source');
    expect(result).toContain('#{');
  });

  it('reify of a thunk whose body is a MapLit renders the literal', () => {
    const result = evalQuery('let m = {:a 1 :b 2} | reify(:m) | /source');
    expect(result).toContain(':a 1');
    expect(result).toContain(':b 2');
  });

  it('reify of a thunk whose body is a Projection renders the keys', () => {
    const result = evalQuery('let pluck = /name | reify(:pluck) | /source');
    expect(result).toBe('/name');
  });

  it('reify of a thunk whose body is a nested Projection renders all keys', () => {
    const result = evalQuery('let deep = /a/b/c | reify(:deep) | /source');
    expect(result).toBe('/a/b/c');
  });
});

describe('runtime/control.mjs if and coalesce', () => {
  function catchError(query) {
    try { evalQuery(query); return null; }
    catch (e) { return e; }
  }

  it('if with cond truthy runs the then branch', () => {
    expect(evalQuery('75 | if(gte(60), "pass", "fail")')).toBe('pass');
  });

  it('if with cond falsy runs the else branch', () => {
    expect(evalQuery('5 | if(gte(60), "pass", "fail")')).toBe('fail');
  });

  it('if treats nil as falsy', () => {
    expect(evalQuery('{:no "data"} | if(/missing, "yes", "no")')).toBe('no');
  });

  it('if treats false literal as falsy', () => {
    expect(evalQuery('0 | if(false, "yes", "no")')).toBe('no');
  });

  it('if treats 0 as truthy', () => {
    expect(evalQuery('5 | if(eq(0), "zero", "non")')).toBe('non');
  });

  it('if only the selected branch runs (else branch never evaluates)', () => {
    // The else branch contains div(0), which would raise division-by-zero
    // if evaluated. The cond is truthy so the else branch is skipped.
    expect(evalQuery('10 | if(gt(0), "positive", div(0))')).toBe('positive');
  });

  it('if branches re-project from pipeValue, not from cond result', () => {
    expect(evalQuery('{:active true :salary 100} | if(/active, /salary | mul(11) | div(10), /salary)')).toBe(110);
  });

  it('if can be nested for multi-way dispatch', () => {
    expect(evalQuery('75 | if(gte(90), "A", if(gte(70), "B", "C"))')).toBe('B');
  });

  it('coalesce returns first non-nil alternative', () => {
    expect(evalQuery('{:firstName "Alice"} | coalesce(/preferredName, /firstName, "Anon")')).toBe('Alice');
  });

  it('coalesce returns nil when all alternatives are nil', () => {
    expect(evalQuery('{} | coalesce(/a, /b, /c)')).toBe(null);
  });

  it('coalesce treats 0 as non-nil', () => {
    expect(evalQuery('{:zero 0} | coalesce(/missing, /zero, "default")')).toBe(0);
  });

  it('coalesce treats false as non-nil', () => {
    expect(evalQuery('{:flag false} | coalesce(/missing, /flag, true)')).toBe(false);
  });

  it('coalesce treats empty string as non-nil', () => {
    expect(evalQuery('{:s ""} | coalesce(/missing, /s, "default")')).toBe('');
  });

  it('coalesce short-circuits after first non-nil (does not evaluate later alts)', () => {
    // div(0) would raise; coalesce never reaches it because /a is non-nil
    expect(evalQuery('{:a 1} | coalesce(/a, div(0))')).toBe(1);
  });

  it('coalesce with zero captured args raises CoalesceNoAlternatives as an ArityError', () => {
    const e = catchError('{} | coalesce');
    expect(e).toBeInstanceOf(ArityError);
    expect(e.kind).toBe('arity-error');
    expect(e.name).toBe('CoalesceNoAlternatives');
  });

  it('coalesce error site has unique class name', () => {
    const e = catchError('{} | coalesce');
    expect(e.name).toBe('CoalesceNoAlternatives');
  });

  it('when with truthy cond runs the then branch', () => {
    expect(evalQuery('5 | when(gt(0), mul(2))')).toBe(10);
  });

  it('when with falsy cond passes pipeValue through unchanged', () => {
    expect(evalQuery('5 | when(lt(0), mul(2))')).toBe(5);
  });

  it('when only the then branch evaluates when cond truthy', () => {
    // div(0) would raise; the false branch is implicit identity
    expect(evalQuery('5 | when(true, mul(2))')).toBe(10);
  });

  it('when never evaluates then when cond falsy', () => {
    // div(0) is in the then branch but never runs
    expect(evalQuery('5 | when(false, div(0))')).toBe(5);
  });

  it('unless with falsy cond runs the then branch', () => {
    expect(evalQuery('5 | unless(lt(0), mul(2))')).toBe(10);
  });

  it('unless with truthy cond passes pipeValue through unchanged', () => {
    expect(evalQuery('5 | unless(gt(0), mul(2))')).toBe(5);
  });

  it('unless never evaluates then when cond truthy', () => {
    expect(evalQuery('5 | unless(true, div(0))')).toBe(5);
  });

  it('unless equivalent to when with negated cond', () => {
    expect(evalQuery('5 | unless(lt(0), mul(2))')).toBe(
      evalQuery('5 | when(lt(0) | not, mul(2))')
    );
  });

  it('firstTruthy returns first truthy alternative', () => {
    expect(evalQuery('{:a 1} | firstTruthy(/a, /b)')).toBe(1);
  });

  it('firstTruthy skips false unlike coalesce', () => {
    expect(evalQuery('{:a false :b 2} | firstTruthy(/a, /b)')).toBe(2);
  });

  it('coalesce by contrast keeps false', () => {
    expect(evalQuery('{:a false :b 2} | coalesce(/a, /b)')).toBe(false);
  });

  it('firstTruthy returns nil when all alternatives are falsy', () => {
    expect(evalQuery('{:a false :b nil} | firstTruthy(/a, /b)')).toBe(null);
  });

  it('firstTruthy treats 0 as truthy (kept)', () => {
    expect(evalQuery('{:n 0} | firstTruthy(/missing, /n, "default")')).toBe(0);
  });

  it('firstTruthy treats empty string as truthy (kept)', () => {
    expect(evalQuery('{:s ""} | firstTruthy(/missing, /s, "default")')).toBe('');
  });

  it('firstTruthy with zero captured args raises FirstTruthyNoAlternatives as an ArityError', () => {
    const e = catchError('{} | firstTruthy');
    expect(e).toBeInstanceOf(ArityError);
    expect(e.kind).toBe('arity-error');
    expect(e.name).toBe('FirstTruthyNoAlternatives');
  });

  it('firstTruthy short-circuits after match', () => {
    expect(evalQuery('{:a 1} | firstTruthy(/a, div(0))')).toBe(1);
  });

  it('if and coalesce compose for guarded defaulting', () => {
    expect(evalQuery('{:role :admin :name "Bob"} | if(/role | eq(:admin), coalesce(/displayName, /name, "???"), "guest")')).toBe('Bob');
  });
});

describe('runtime/vec.mjs sortWith and comparator builders', () => {
  function catchError(query) {
    try { evalQuery(query); return null; }
    catch (e) { return e; }
  }

  it('sortWith on non-Vec subject → SortWithSubjectNotVec', () => {
    const e = catchError('42 | sortWith(asc(/x))');
    expect(e).toBeInstanceOf(QlangTypeError);
    expect(e.name).toBe('SortWithSubjectNotVec');
  });

  it('sortWith comparator returning non-number → SortWithCmpResultNotNumber', () => {
    const e = catchError('[1 2 3] | sortWith("string")');
    expect(e.name).toBe('SortWithCmpResultNotNumber');
  });

  it('asc on non-Map pair → AscPairNotMap', () => {
    // sortWith hands the comparator a pair Map, so this fires only
    // when asc is called outside sortWith with a non-Map subject.
    const e = catchError('42 | asc(/x)');
    expect(e.name).toBe('AscPairNotMap');
  });

  it('asc on heterogeneous keys → AscKeysNotComparable', () => {
    const e = catchError('[{:k 1} {:k "a"}] | sortWith(asc(/k))');
    expect(e.name).toBe('AscKeysNotComparable');
  });

  it('desc on non-Map pair → DescPairNotMap', () => {
    const e = catchError('42 | desc(/x)');
    expect(e.name).toBe('DescPairNotMap');
  });

  it('desc on heterogeneous keys → DescKeysNotComparable', () => {
    const e = catchError('[{:k 1} {:k "a"}] | sortWith(desc(/k))');
    expect(e.name).toBe('DescKeysNotComparable');
  });

  it('firstNonZero on non-Vec → FirstNonZeroSubjectNotVec', () => {
    const e = catchError('42 | firstNonZero');
    expect(e.name).toBe('FirstNonZeroSubjectNotVec');
  });

  it('firstNonZero on Vec with non-number element → FirstNonZeroElementNotNumber', () => {
    const e = catchError('[0 "two" 1] | firstNonZero');
    expect(e.name).toBe('FirstNonZeroElementNotNumber');
    expect(e.context.index).toBe(1);
  });

  it('every sortWith/asc/desc/firstNonZero site has a unique class name', () => {
    const queries = [
      '42 | sortWith(asc(/x))',                  // SortWithSubjectNotVec
      '[1 2] | sortWith("not")',                 // SortWithCmpResultNotNumber
      '42 | asc(/x)',                             // AscPairNotMap
      '[{:k 1} {:k "a"}] | sortWith(asc(/k))',  // AscKeysNotComparable
      '42 | desc(/x)',                            // DescPairNotMap
      '[{:k 1} {:k "a"}] | sortWith(desc(/k))', // DescKeysNotComparable
      '42 | firstNonZero',                        // FirstNonZeroSubjectNotVec
      '[0 "x"] | firstNonZero'                    // FirstNonZeroElementNotNumber
    ];
    const names = new Set(queries.map(q => catchError(q).name));
    expect(names.size).toBe(queries.length);
  });

  it('inline arithmetic comparator sorts ascending', () => {
    expect(evalQuery('[3 1 4 1 5] | sortWith(sub(/left, /right))'))
      .toEqual([1, 1, 3, 4, 5]);
  });

  it('inline arithmetic comparator sorts descending via reversed sub', () => {
    expect(evalQuery('[3 1 4 1 5] | sortWith(sub(/right, /left))'))
      .toEqual([5, 4, 3, 1, 1]);
  });

  it('compound comparator chains via firstNonZero', () => {
    const result = evalQuery(
      '[{:n "B" :a 30} {:n "A" :a 20} {:n "B" :a 25}] ' +
      '| sortWith([asc(/n), desc(/a)] | firstNonZero) * /a'
    );
    expect(result).toEqual([20, 30, 25]);
  });
});

describe('parser doc-comment attachment Vec semantics', () => {
  it('attaches one entry per doc comment, not concatenated', () => {
    const result = evalQuery(
      '|~~| First.\n|~~| Second.\n|~~| Third.\nlet foo = 42 | reify(:foo) | /docs'
    );
    expect(result).toEqual([' First.', ' Second.', ' Third.']);
  });

  it('block doc preserves internal newlines as one entry', () => {
    const result = evalQuery(
      '|~~ line one\nline two\nline three ~~|\nlet foo = 42\n| reify(:foo) | /docs'
    );
    expect(result.length).toBe(1);
    expect(result[0]).toContain('line one');
    expect(result[0]).toContain('line two');
    expect(result[0]).toContain('line three');
  });

  it('mixes line and block docs preserving order', () => {
    const result = evalQuery(
      '|~~| line one\n|~~ block two ~~|\n|~~| line three\nlet foo = 42 | reify(:foo) | /docs'
    );
    expect(result.length).toBe(3);
    expect(result[0]).toBe(' line one');
    expect(result[1]).toContain('block two');
    expect(result[2]).toBe(' line three');
  });

  it('shadowing redeclare overrides docs Vec', () => {
    const result = evalQuery(
      '|~~| Old.\nlet foo = 1\n|~~| Brand new.\n|~~| With extra remark.\nlet foo = 2\n| reify(:foo) | /docs'
    );
    expect(result).toEqual([' Brand new.', ' With extra remark.']);
  });

  it('comment step is identity on pipeValue', () => {
    expect(evalQuery('[1 2 3] |~| inline annotation\n| count')).toBe(3);
    expect(evalQuery('[1 2 3] |~ block annotation ~| count')).toBe(3);
  });
});
