// Edge-case unit tests covering error paths and rare branches
// that the conformance suite alone does not exercise. The goal is
// to push coverage to ≥95% on every src module.

import { describe, it, expect } from 'vitest';
import { evalQuery, evalAst } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import {
  QlangError,
  QlangTypeError,
  SubjectTypeError,
  ModifierTypeError,
  ElementTypeError,
  ComparabilityError,
  ProjectionError,
  CombinatorError,
  ApplicationError,
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
    const fn = makeFn('mul', 2, () => 0);
    expect(() => applyRule10(fn, [() => 1, () => 2, () => 3], 0))
      .toThrow(ArityError);
  });

  it('makeFn defaults pseudo=false', () => {
    const fn = makeFn('id', 1, () => 0);
    expect(fn.pseudo).toBe(false);
  });

  it('makeFn honours pseudo option', () => {
    const fn = makeFn('marker', 0, () => 0, { pseudo: true });
    expect(fn.pseudo).toBe(true);
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

describe('error subclasses carry structured context', () => {
  // Each test targets a specific error class so the diagnostic
  // context is asserted directly, not just the generic kind tag.

  it('SubjectTypeError on Vec operand', () => {
    let caught;
    try { evalQuery('42 | count'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(SubjectTypeError);
    expect(caught.context.operand).toBe('count');
    expect(caught.context.expectedType).toBe('Vec, Set, or Map');
    expect(caught.context.actualType).toBe('number');
    expect(caught.kind).toBe('type-error');
  });

  it('SubjectTypeError on Map operand', () => {
    let caught;
    try { evalQuery('42 | keys'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(SubjectTypeError);
    expect(caught.context.operand).toBe('keys');
    expect(caught.context.expectedType).toBe('Map');
  });

  it('ModifierTypeError on numeric arg', () => {
    let caught;
    try { evalQuery('"x" | add(1)'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ModifierTypeError);
    expect(caught.context.operand).toBe('add');
    expect(caught.context.position).toBe(1);
    expect(caught.context.expectedType).toBe('number');
    expect(caught.context.actualType).toBe('string');
  });

  it('ModifierTypeError on string arg', () => {
    let caught;
    try { evalQuery('"x" | prepend(42)'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ModifierTypeError);
    expect(caught.context.operand).toBe('prepend');
    expect(caught.context.position).toBe(2);
    expect(caught.context.expectedType).toBe('string');
  });

  it('ElementTypeError on sum of mixed Vec', () => {
    let caught;
    try { evalQuery('[1 "two" 3] | sum'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ElementTypeError);
    expect(caught.context.operand).toBe('sum');
    expect(caught.context.index).toBe(1);
    expect(caught.context.expectedType).toBe('number');
    expect(caught.context.actualType).toBe('string');
  });

  it('ComparabilityError on heterogeneous gt', () => {
    let caught;
    try { evalQuery('"a" | gt(5)'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ComparabilityError);
    expect(caught.context.operand).toBe('gt');
    expect(caught.context.leftType).toBe('string');
    expect(caught.context.rightType).toBe('number');
  });

  it('ProjectionError on non-Map', () => {
    let caught;
    try { evalQuery('42 | /name'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ProjectionError);
    expect(caught.context.key).toBe('name');
    expect(caught.context.actualType).toBe('number');
  });

  it('CombinatorError on distribute of non-Vec', () => {
    let caught;
    try { evalQuery('{:a 1} * add(1)'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(CombinatorError);
    expect(caught.context.combinator).toBe('*');
    expect(caught.context.expectedType).toBe('Vec');
    expect(caught.context.actualType).toBe('Map');
  });

  it('CombinatorError on merge of non-Vec', () => {
    let caught;
    try { evalQuery('42 >> count'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(CombinatorError);
    expect(caught.context.combinator).toBe('>>');
  });

  it('ApplicationError on calling a non-function', () => {
    let caught;
    try { evalQuery('let five = 5 | five(42)'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ApplicationError);
    expect(caught.context.name).toBe('five');
    expect(caught.context.actualType).toBe('number');
  });

  it('each type-error subclass still matches QlangTypeError', () => {
    for (const Cls of [
      SubjectTypeError, ModifierTypeError, ElementTypeError,
      ComparabilityError, ProjectionError, CombinatorError, ApplicationError
    ]) {
      const instance = new Cls('x', 'y', 'z', 'w');
      expect(instance).toBeInstanceOf(QlangTypeError);
      expect(instance).toBeInstanceOf(QlangError);
      expect(instance.kind).toBe('type-error');
    }
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
