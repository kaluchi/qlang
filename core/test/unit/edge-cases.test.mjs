// Edge-case unit tests covering error paths and rare branches
// that the conformance suite alone does not exercise. The goal is
// to push coverage to ≥95% on every src module.
//
// What lives here vs in per-source test files: edge-cases stays a
// staging ground for tests whose source module has no dedicated
// `<module>.test.mjs` (`types.mjs`, `rule10.mjs`,
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
// `errors.mjs kind-tag survey` (covered by `errors.test.mjs`),
// `state.mjs` (→ `state.test.mjs`).

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
  isQuote,
  isVec,
  makeConduit,
  makeSet,
  makeTagKeyword,
  conduitBodyAst,
  conduitEnvRef,
  typeKeyword,
  TAG_HEADER_SYMBOL,
  CONDUIT_TAG
} from '../../src/types.mjs';
import { catchOriginalError, expectErrorCategory } from '../helpers/error-assertions.mjs';
import { printQuoteSource, astOfQuote } from '../../src/quote.mjs';
import { rootState } from '../../src/state.mjs';
import {
  applyRule10,
  makeFn
} from '../../src/rule10.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';

describe('types.mjs', () => {
  it('typeKeyword reads a value the language holds no literal for, a symbol of a host, as unknown', () => {
    expect(typeKeyword(Symbol('host'))).toEqual(makeTagKeyword('unknown'));
  });

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
    expect(describeType(makeSet([]))).toBe('Set');
    expect(describeType(makeFn('probe', 1, () => {}))).toBe('Function');
    expect(describeType(makeConduit({ type: 'NumberLit', value: 1, text: '1' }))).toBe('Conduit');
    expect(describeType(Symbol('weird'))).toBe('Unknown');
  });

  it('value-class predicates', () => {
    expect(isConduit(makeConduit({ type: 'NumberLit', value: 1, text: '1' }))).toBe(true);
    expect(isConduit(makeFn('probe', 1, () => {}))).toBe(false);
    expect(isFunctionValue(makeFn('probe', 1, () => {}))).toBe(true);
    expect(isFunctionValue(() => {})).toBe(false);
    expect(isKeyword(keyword('x'))).toBe(true);
    expect(isQMap(new Map())).toBe(true);
    expect(isQSet(makeSet([]))).toBe(true);
    expect(isQSet([])).toBe(false);
    expect(isVec([])).toBe(true);
  });

  it('makeConduit stamps ::conduit plus the body AST and envRef holder on JS-header slots', async () => {
    const bodyAst = { type: 'NumberLit', value: 1, text: '1' };
    const lexicalRef = { env: null };
    const doubleConduit = makeConduit(bodyAst, { name: 'double', envRef: lexicalRef });
    expect(doubleConduit).toBeInstanceOf(Map);
    expect(doubleConduit.has('kind')).toBe(false);
    expect(doubleConduit[TAG_HEADER_SYMBOL]).toBe(CONDUIT_TAG);
    expect(typeKeyword(doubleConduit)).toBe(CONDUIT_TAG);
    // Body AST and lexical anchor ride the slots; the data plane
    // enumerates qlang values alone.
    expect(conduitBodyAst(doubleConduit)).toBe(bodyAst);
    expect(conduitEnvRef(doubleConduit)).toBe(lexicalRef);
    expect(doubleConduit.has('body')).toBe(false);
    expect(doubleConduit.has('envRef')).toBe(false);
    expect(doubleConduit.has('location')).toBe(false);
    expect([...doubleConduit.keys()]).toEqual(['name', 'params', 'source', 'docs', 'effectful']);
    const sourceQuote = doubleConduit.get('source');
    expect(isQuote(sourceQuote)).toBe(true);
    expect(printQuoteSource(sourceQuote)).toBe('1');
    expect(astOfQuote(sourceQuote)).toBe(bodyAst);
  });
});

describe('rule10.mjs', () => {
  it('rejects too many captured args', async () => {
    const fn = makeFn('mul', 2, (state) => state);
    const lambdas = [() => 1, () => 2, () => 3];
    const runtimeEnv = await langRuntime();
    await expect(applyRule10(fn, lambdas, rootState(null, runtimeEnv)))
      .rejects.toThrow(ArityError);
  });

  it('makeFn stores metadata on a frozen object', () => {
    const fn = makeFn('identity', 1, (state) => state);
    expect(isFunctionValue(fn)).toBe(true);
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
    await expectErrorCategory('"a" | gt 5', 'typeError');
  });
  it('lt rejects non-comparable subject', async () => {
    await expectErrorCategory('null | lt 5', 'typeError');
  });
});

describe('runtime/arith.mjs error paths', () => {
  it('add rejects non-numeric subject', async () => {
    await expectErrorCategory('"x" | add 1', 'typeError');
  });
  it('add rejects non-numeric modifier', async () => {
    await expectErrorCategory('1 | add "x"', 'typeError');
  });
  it('sub rejects non-numeric subject', async () => {
    await expectErrorCategory('"x" | sub 1', 'typeError');
  });
  it('mul rejects non-numeric subject', async () => {
    await expectErrorCategory('"x" | mul 1', 'typeError');
  });
  it('div rejects non-numeric subject', async () => {
    await expectErrorCategory('"x" | div 1', 'typeError');
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
    await expectErrorCategory('42 | filter ~(gt 1)', 'typeError');
  });
  it('take rejects non-numeric n', async () => {
    await expectErrorCategory('[1 2 3] | take "x"', 'typeError');
  });
  it('drop rejects non-numeric n', async () => {
    await expectErrorCategory('[1 2 3] | drop "x"', 'typeError');
  });
  it('sort with key', async () => {
    expect(await evalQuery('[{:n 3} {:n 1} {:n 2}] | sort ~(/n)'))
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
    await expectErrorCategory('42 | has :foo', 'typeError');
  });
  it('has on Map requires keyword-or-string key', async () => {
    await expectErrorCategory('{:k 1} | has 42', 'typeError');
  });
});

describe('runtime/setops.mjs Map×Map and errors', () => {
  it('union of Set with Map errors', async () => {
    await expectErrorCategory('#[:a] | union {:b 1}', 'typeError');
  });
  it('minus of Map by another Map (key-based)', async () => {
    const evalResult = await evalQuery('{:a 1 :b 2 :c 3} | minus {:b 99 :d 5}');
    expect(evalResult).toEqual(new Map([['a', 1], ['c', 3]]));
  });
  it('inter of Map by another Map', async () => {
    const evalResult = await evalQuery('{:a 1 :b 2 :c 3} | inter {:b 99 :d 5}');
    expect(evalResult).toEqual(new Map([['b', 2]]));
  });
  it('minus of Set by Map errors', async () => {
    await expectErrorCategory('#[:a] | minus {:a 1}', 'typeError');
  });
  it('inter of Set by Map errors', async () => {
    await expectErrorCategory('#[:a] | inter {:a 1}', 'typeError');
  });
});

describe('runtime/predicates.mjs deepEqual', () => {
  it('eq of Maps with same content', async () => {
    expect(await evalQuery('{:a 1 :b 2} | eq {:a 1 :b 2}')).toBe(true);
  });
  it('eq of Maps with different content', async () => {
    expect(await evalQuery('{:a 1} | eq {:a 2}')).toBe(false);
  });
  it('eq of Sets', async () => {
    expect(await evalQuery('#[:a :b] | eq #[:b :a]')).toBe(true);
  });
  it('eq of mismatched types', async () => {
    expect(await evalQuery('42 | eq "42"')).toBe(false);
  });
  it('eq with null', async () => {
    expect(await evalQuery('null | eq null')).toBe(true);
  });
  it('eq nested', async () => {
    expect(await evalQuery('[{:a 1}] | eq [{:a 1}]')).toBe(true);
  });
});

describe('runtime/string.mjs split and join error sites', () => {
  it('split on non-string subject → SplitSubjectNotStringError', async () => {
    const caughtErr = await catchOriginalError('42 | split ","');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('SplitSubjectNotStringError');
  });

  it('split with non-string separator → SplitSeparatorNotStringError', async () => {
    const caughtErr = await catchOriginalError('"abc" | split 42');
    expect(caughtErr.name).toBe('SplitSeparatorNotStringError');
  });

  it('join on non-Vec subject → JoinSubjectNotVecError', async () => {
    const caughtErr = await catchOriginalError('42 | join ","');
    expect(caughtErr.name).toBe('JoinSubjectNotVecError');
  });

  it('join with non-string element → JoinElementNotStringError', async () => {
    const caughtErr = await catchOriginalError('["a" 42 "c"] | join ","');
    expect(caughtErr.name).toBe('JoinElementNotStringError');
    expect(caughtErr.context.index).toBe(1);
  });

  it('join with non-string separator → JoinSeparatorNotStringError', async () => {
    const caughtErr = await catchOriginalError('["a" "b"] | join 42');
    expect(caughtErr.name).toBe('JoinSeparatorNotStringError');
  });

  it('every split/join site has a unique class name', async () => {
    const queries = [
      '42 | split ","',
      '"abc" | split 42',
      '42 | join ","',
      '["a" 42] | join ","',
      '["a" "b"] | join 42'
    ];
    const names = new Set();
    for (const q of queries) names.add((await catchOriginalError(q)).name);
    expect(names.size).toBe(queries.length);
  });
});

describe('runtime/string.mjs lines', () => {
  it('a newline ends a line, and a carriage return before it belongs to the ending', async () => {
    expect(await evalQuery('"a\\r\\n\\r\\nb" | lines')).toEqual(['a', '', 'b']);
  });

  it('a final newline closes the last line, and a lone one closes an empty line', async () => {
    expect(await evalQuery('"a\\n" | lines')).toEqual(['a']);
    expect(await evalQuery('"a\\n\\n" | lines')).toEqual(['a', '']);
    expect(await evalQuery('"\\n" | lines')).toEqual(['']);
  });

  it('the empty text has no lines, and a carriage return with no newline stays in its line', async () => {
    expect(await evalQuery('"" | lines')).toEqual([]);
    expect(await evalQuery('"a\\r" | lines')).toEqual(['a\r']);
  });

  it('lines on non-string subject → LinesSubjectNotStringError', async () => {
    const caughtErr = await catchOriginalError('42 | lines');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('LinesSubjectNotStringError');
  });
});

describe('dispatch helper arity error paths', () => {
  it('overloadedOp throws ArityError on unsupported captured-arg count', async () => {
    // sort accepts 0 or 1 captured args; calling with 2 hits the
    // overloadedOp dispatch's `if (!impl)` branch.
    await expectErrorCategory('[1 2] | sort ~(/x) /y', 'arityError');
  });

  it('stateOp throws ArityError when captured-arg count mismatches expected', async () => {
    // env accepts 0 captured args; calling env(arg) fires the
    // stateOp's `lambdas.length !== expected` branch.
    await expectErrorCategory('env :foo', 'arityError');
  });
});

describe('source axis on conduit / as / TagKeyword subjects', () => {
  // `:name | source` returns the quote of the declaring BindStep,
  // which `parse` prints as its text. Same axis covers value-namespace bindings
  // (Keyword subject) and tag-namespace bindings (TagKeyword subject).

  it('source on a conduit binding name returns the whole declaration', async () => {
    const source = await evalQuery(':double mul 2 | :double | source | parse');
    expect(source).toBe(':double mul 2');
  });

  it('source on a parametric conduit captures the params slot', async () => {
    const source = await evalQuery(':@surround [:pfx :sfx] (prepend pfx | append sfx) | :@surround | source | parse');
    expect(source).toBe(':@surround [:pfx :sfx] (prepend pfx | append sfx)');
  });

  it('source on an as binding name returns the as(:name) step', async () => {
    // `as(:snap)` is an OperandCall, not a BindStep — its record
    // holds the quote of that call as the declaration.
    const source = await evalQuery('42 | as :snap | :snap | source | parse');
    expect(source).toBe('as :snap');
  });
});

describe('runtime/control.mjs if and coalesce', () => {
  it('if with cond truthy runs the then branch', async () => {
    expect(await evalQuery('75 | if (gte 60) ~("pass") ~("fail")')).toBe('pass');
  });

  it('if with cond falsy runs the else branch', async () => {
    expect(await evalQuery('5 | if (gte 60) ~("pass") ~("fail")')).toBe('fail');
  });

  it('if refuses a null condition', async () => {
    expect(await evalQuery('{:no "data"} | if null ~("yes") ~("no") !| type')).toEqual(makeTagKeyword('IfConditionNotBooleanError'));
  });

  it('if treats false literal as falsy', async () => {
    expect(await evalQuery('0 | if false ~("yes") ~("no")')).toBe('no');
  });

  it('if treats 0 as truthy', async () => {
    expect(await evalQuery('5 | if (eq 0) ~("zero") ~("non")')).toBe('non');
  });

  it('if only the selected branch runs (else branch never evaluates)', async () => {
    // The else branch contains div(0), which would raise divisionByZero
    // if evaluated. The cond is truthy so the else branch is skipped.
    expect(await evalQuery('10 | if (gt 0) ~("positive") ~(div 0)')).toBe('positive');
  });

  it('if branches re-project from pipeValue, not from cond result', async () => {
    expect(await evalQuery('{:active true :salary 100} | if /active ~(/salary | mul 11 | div 10) ~(/salary)')).toBe(110);
  });

  it('if can be nested for multi-way dispatch', async () => {
    expect(await evalQuery('75 | if (gte 90) ~("A") ~(if (gte 70) ~("B") ~("C"))')).toBe('B');
  });

  it('coalesce returns first non-null alternative', async () => {
    expect(await evalQuery('{:firstName "Alice"} | coalesce ~(/preferredName) ~(/firstName) ~("Anon")')).toBe('Alice');
  });

  it('coalesce returns null when all alternatives are null', async () => {
    expect(await evalQuery('{} | coalesce ~(/a) ~(/b) ~(/c)')).toBe(null);
  });

  it('coalesce treats 0 as non-null', async () => {
    expect(await evalQuery('{:zero 0} | coalesce ~(/missing) ~(/zero) ~("default")')).toBe(0);
  });

  it('coalesce treats false as non-null', async () => {
    expect(await evalQuery('{:flag false} | coalesce ~(/missing) ~(/flag) ~(true)')).toBe(false);
  });

  it('coalesce treats empty string as non-null', async () => {
    expect(await evalQuery('{:s ""} | coalesce ~(/missing) ~(/s) ~("default")')).toBe('');
  });

  it('coalesce short-circuits after first non-null (does not evaluate later alts)', async () => {
    // div(0) would raise; coalesce never reaches it because /a is non-null
    expect(await evalQuery('{:a 1} | coalesce ~(/a) ~(div 0)')).toBe(1);
  });

  it('coalesce keeps false as a value', async () => {
    expect(await evalQuery('{:a false :b 2} | coalesce ~(/a) ~(/b)')).toBe(false);
  });

  it('if and coalesce compose for guarded defaulting', async () => {
    expect(await evalQuery('{:role :admin :name "Bob"} | if (/role | eq :admin) ~(coalesce ~(/displayName) ~(/name) ~("???")) ~("guest")')).toBe('Bob');
  });

  // Per-site coalesce arityError tag identity is
  // pinned by `error-operands.test.mjs`; the control-flow block
  // tests the operand semantics, not the per-site wiring.
  it('coalesce raises CoalesceNoAlternativesError on bare call', async () => {
    const caughtErr = await catchOriginalError('{} | coalesce');
    expect(caughtErr).toBeInstanceOf(ArityError);
  });

});

