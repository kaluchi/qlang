// Edge-case unit tests covering error paths and rare branches
// that the conformance suite alone does not exercise. The goal is
// to push coverage to ≥95% on every src module.

import { describe, it, expect } from 'vitest';
import { evalQuery, evalAst } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import {
  TypeError as QTypeError,
  UnresolvedIdentifierError,
  DivisionByZeroError,
  ArityError,
  QlangError
} from '../../src/errors.mjs';
import {
  keyword,
  keywordsEqual,
  asKeywordName,
  describeType,
  isThunk,
  isFunction,
  isKeyword,
  isQMap,
  isQSet,
  isVec
} from '../../src/types.mjs';
import {
  makeState,
  withEnv,
  envSet,
  envHas,
  envGet,
  envMerge
} from '../../src/state.mjs';
import {
  applyRule10,
  makeFn,
  isFunctionValue,
  constLambda
} from '../../src/rule10.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';

describe('types.mjs', () => {
  it('interns keywords', () => {
    expect(keyword('foo')).toBe(keyword('foo'));
    expect(keyword('foo')).not.toBe(keyword('bar'));
  });

  it('keywordsEqual compares by name', () => {
    expect(keywordsEqual(keyword('a'), keyword('a'))).toBe(true);
    expect(keywordsEqual(keyword('a'), keyword('b'))).toBe(false);
    expect(keywordsEqual(keyword('a'), 'a')).toBe(false);
    expect(keywordsEqual('a', keyword('a'))).toBe(false);
  });

  it('asKeywordName resolves keyword or string', () => {
    expect(asKeywordName(keyword('x'))).toBe('x');
    expect(asKeywordName('x')).toBe('x');
    expect(asKeywordName(42)).toBe(null);
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
    expect(describeType({ type: 'thunk', expr: null })).toBe('thunk');
    expect(describeType(Symbol('weird'))).toBe('unknown');
  });

  it('predicates work on plain JS values', () => {
    expect(isThunk({ type: 'thunk', expr: null })).toBe(true);
    expect(isThunk({ type: 'function' })).toBe(false);
    expect(isFunction(() => {})).toBe(true);
    expect(isKeyword(keyword('x'))).toBe(true);
    expect(isQMap(new Map())).toBe(true);
    expect(isQSet(new Set())).toBe(true);
    expect(isVec([])).toBe(true);
  });
});

describe('state.mjs', () => {
  it('withEnv replaces env', () => {
    const s = makeState(1, new Map());
    const e2 = new Map([[keyword('x'), 99]]);
    const s2 = withEnv(s, e2);
    expect(s2.pipeValue).toBe(1);
    expect(s2.env).toBe(e2);
  });

  it('envSet returns a new Map', () => {
    const e = new Map();
    const e2 = envSet(e, 'foo', 42);
    expect(e.size).toBe(0);
    expect(e2.size).toBe(1);
    expect(envGet(e2, 'foo')).toBe(42);
    expect(envHas(e2, 'foo')).toBe(true);
    expect(envHas(e2, 'bar')).toBe(false);
  });

  it('envMerge merges another Map', () => {
    const a = envSet(new Map(), 'a', 1);
    const b = envSet(new Map(), 'b', 2);
    const merged = envMerge(a, b);
    expect(envGet(merged, 'a')).toBe(1);
    expect(envGet(merged, 'b')).toBe(2);
  });
});

describe('rule10.mjs', () => {
  it('rejects too many captured args', () => {
    const fn = makeFn('mul', 2, () => 0);
    expect(() => applyRule10(fn, [() => 1, () => 2, () => 3], 0))
      .toThrow(ArityError);
  });

  it('isFunctionValue identifies wrapped functions', () => {
    const fn = makeFn('id', 1, x => x);
    expect(isFunctionValue(fn)).toBe(true);
    expect(isFunctionValue(() => {})).toBe(false);
    expect(isFunctionValue(null)).toBe(false);
  });

  it('constLambda ignores its input', () => {
    const lam = constLambda(42);
    expect(lam('anything')).toBe(42);
    expect(lam(null)).toBe(42);
  });
});

describe('errors.mjs', () => {
  it('all error subclasses carry kind tags', () => {
    expect(new QTypeError('msg').kind).toBe('type-error');
    expect(new UnresolvedIdentifierError('foo').kind).toBe('unresolved-identifier');
    expect(new UnresolvedIdentifierError('foo').identifierName).toBe('foo');
    expect(new DivisionByZeroError().kind).toBe('division-by-zero');
    expect(new ArityError('arity').kind).toBe('arity-error');
    expect(new QlangError('generic', 'custom').kind).toBe('custom');
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
    expect(() => evalQuery('"x" | add(1)')).toThrow(QTypeError);
  });
  it('add rejects non-numeric modifier', () => {
    expect(() => evalQuery('1 | add(\"x\")')).toThrow(QTypeError);
  });
  it('sub rejects non-numeric subject', () => {
    expect(() => evalQuery('\"x\" | sub(1)')).toThrow(QTypeError);
  });
  it('mul rejects non-numeric subject', () => {
    expect(() => evalQuery('\"x\" | mul(1)')).toThrow(QTypeError);
  });
  it('div rejects non-numeric subject', () => {
    expect(() => evalQuery('\"x\" | div(1)')).toThrow(QTypeError);
  });
});

describe('runtime/vec.mjs error paths', () => {
  it('count rejects non-Vec', () => {
    expect(() => evalQuery('42 | count')).toThrow(QTypeError);
  });
  it('first rejects non-Vec', () => {
    expect(() => evalQuery('42 | first')).toThrow(QTypeError);
  });
  it('sum rejects non-Vec', () => {
    expect(() => evalQuery('42 | sum')).toThrow(QTypeError);
  });
  it('filter rejects non-Vec', () => {
    expect(() => evalQuery('42 | filter(gt(1))')).toThrow(QTypeError);
  });
  it('take rejects non-numeric n', () => {
    expect(() => evalQuery('[1 2 3] | take(\"x\")')).toThrow(QTypeError);
  });
  it('drop rejects non-numeric n', () => {
    expect(() => evalQuery('[1 2 3] | drop(\"x\")')).toThrow(QTypeError);
  });
  it('sort with key', () => {
    expect(evalQuery('[{:n 3} {:n 1} {:n 2}] | sort(/n)'))
      .toEqual([new Map([[keyword('n'), 1]]), new Map([[keyword('n'), 2]]), new Map([[keyword('n'), 3]])]);
  });
});

describe('runtime/map.mjs error paths', () => {
  it('keys rejects non-Map', () => {
    expect(() => evalQuery('42 | keys')).toThrow(QTypeError);
  });
  it('vals rejects non-Map', () => {
    expect(() => evalQuery('42 | vals')).toThrow(QTypeError);
  });
  it('has rejects non-Map/non-Set subject', () => {
    expect(() => evalQuery('42 | has(:foo)')).toThrow(QTypeError);
  });
  it('has on Map requires keyword key', () => {
    expect(() => evalQuery('{:k 1} | has(\"k\")')).toThrow(QTypeError);
  });
});

describe('runtime/set.mjs error paths', () => {
  it('set rejects non-Vec', () => {
    expect(() => evalQuery('42 | set')).toThrow(QTypeError);
  });
});

describe('runtime/setops.mjs Map×Map and errors', () => {
  it('union of Set with Map errors', () => {
    expect(() => evalQuery('#{:a} | union({:b 1})')).toThrow(QTypeError);
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
    expect(() => evalQuery('#{:a} | minus({:a 1})')).toThrow(QTypeError);
  });
  it('inter of Set by Map errors', () => {
    expect(() => evalQuery('#{:a} | inter({:a 1})')).toThrow(QTypeError);
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
    expect(() => evalAst(fakeNode, state)).toThrow(QTypeError);
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
    expect(() => evalAst(ast, state)).toThrow(QTypeError);
  });
});
