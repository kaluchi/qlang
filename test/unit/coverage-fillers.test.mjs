// Targeted tests for coverage gaps in pre-existing modules that
// the rest of the suite does not exercise: arithmetic right-operand
// type checks, format.toPlain fallback for non-Map/Vec/Set values,
// vec.flat non-Vec elements, equality.deepEqual rejection branches,
// describeType for snapshots, dispatch invariant errors for variadic
// operand registration without meta.captured, and remaining branches
// in error-convert, eval, types, walk, and intro.

import { describe, it, expect } from 'vitest';
import { evalQuery, evalAst } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { deepEqual } from '../../src/equality.mjs';
import {
  describeType,
  makeSnapshot,
  makeConduit,
  makeErrorValue,
  keyword,
  isErrorValue
} from '../../src/types.mjs';
import {
  stateOpVariadic,
  higherOrderOpVariadic
} from '../../src/runtime/dispatch.mjs';
import { QlangInvariantError } from '../../src/errors.mjs';
import { createSession } from '../../src/session.mjs';
import { walkAst, bindingNamesVisibleAt, astNodeToMap, qlangMapToAst } from '../../src/walk.mjs';
import { makeState } from '../../src/state.mjs';
import { errorFromParse, errorFromForeign } from '../../src/error-convert.mjs';
import { makeFn } from '../../src/rule10.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { printValue } from '../../src/runtime/format.mjs';

describe('arith right-operand type checks', () => {
  it('sub with non-numeric right operand throws', async () => {
    expect(isErrorValue(await evalQuery('5 | sub("x")'))).toBe(true);
  });

  it('mul with non-numeric right operand throws', async () => {
    expect(isErrorValue(await evalQuery('5 | mul("x")'))).toBe(true);
  });

  it('div with non-numeric right operand throws', async () => {
    expect(isErrorValue(await evalQuery('5 | div("x")'))).toBe(true);
  });
});

describe('format toPlain fallback for unknown value classes', async () => {
  it('json on a function value falls back to String() rendering', async () => {
    // Function values are not numbers/strings/booleans/keywords/Vec/
    // Map/Set, so toPlain reaches the trailing `return String(v)`
    // branch. Output is opaque but the operand must not throw.
    const jsonOutput = await evalQuery('env | /count | json');
    expect(typeof jsonOutput).toBe('string');
  });
});

describe('vec.flat non-Vec elements', async () => {
  it('flat preserves non-Vec elements alongside Vec elements', async () => {
    expect(await evalQuery('[1 [2 3] 4] | flat')).toEqual([1, 2, 3, 4]);
  });
});

describe('equality.deepEqual rejection branches', async () => {
  it('returns false when only one side is null', async () => {
    expect(deepEqual(null, 5)).toBe(false);
    expect(deepEqual(5, null)).toBe(false);
  });

  it('returns false when types differ', async () => {
    expect(deepEqual(1, '1')).toBe(false);
  });

  it('returns false when one side is array and the other is not', async () => {
    expect(deepEqual([1, 2], 'x')).toBe(false);
  });

  it('returns false when arrays have different length', async () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('returns false when one side is Set and the other is not', async () => {
    expect(deepEqual(new Set([1]), [1])).toBe(false);
  });

  it('returns false when Sets have different size', async () => {
    expect(deepEqual(new Set([1, 2]), new Set([1, 2, 3]))).toBe(false);
  });
});

describe('describeType for conduit and snapshot', async () => {
  it('describeType returns "snapshot" for a snapshot value', async () => {
    const snap = makeSnapshot(42, { name: 'x' });
    expect(describeType(snap)).toBe('snapshot');
  });

  it('describeType returns "conduit" for a conduit value', async () => {
    const conduit = makeConduit({ type: 'NumberLit', value: 1 }, { name: 'x' });
    expect(describeType(conduit)).toBe('conduit');
  });
});

describe('dispatch variadic registration invariants', async () => {
  it('stateOpVariadic without captured throws QlangInvariantError', async () => {
    expect(() => stateOpVariadic('badOp', 2, (s) => s)).toThrow(QlangInvariantError);
  });

  it('stateOpVariadic with null captured throws QlangInvariantError', async () => {
    expect(() => stateOpVariadic('badOp', 2, (s) => s, null)).toThrow(QlangInvariantError);
  });

  it('higherOrderOpVariadic without captured throws QlangInvariantError', async () => {
    expect(() => higherOrderOpVariadic('badOp', 2, (pv) => pv)).toThrow(QlangInvariantError);
  });

  it('higherOrderOpVariadic with null captured throws QlangInvariantError', async () => {
    expect(() => higherOrderOpVariadic('badOp', 2, (pv) => pv, null)).toThrow(QlangInvariantError);
  });
});

describe('setops bare-form non-Vec subject errors', async () => {
  it('union bare on non-Vec/non-Set throws UnionBareSubjectNotVec', async () => {
    expect(isErrorValue(await evalQuery('42 | union'))).toBe(true);
  });

  it('union bare on a Set (which is also non-Array) throws', async () => {
    expect(isErrorValue(await evalQuery('#{:a} | union'))).toBe(true);
  });

  it('minus bare on non-Vec throws MinusBareSubjectNotVec', async () => {
    expect(isErrorValue(await evalQuery('42 | minus'))).toBe(true);
  });

  it('inter bare on non-Vec throws InterBareSubjectNotVec', async () => {
    expect(isErrorValue(await evalQuery('42 | inter'))).toBe(true);
  });
});

describe('setops full form (two captured args)', async () => {
  it('minus full form computes left minus right via two captured pipelines', async () => {
    const result = await evalQuery('null | minus({:a 1 :b 2 :tmp 3}, #{:tmp})');
    expect(result).toBeInstanceOf(Map);
    expect(result.has(keyword('a'))).toBe(true);
    expect(result.has(keyword('b'))).toBe(true);
    expect(result.has(keyword('tmp'))).toBe(false);
  });

  it('inter full form computes left inter right via two captured pipelines', async () => {
    const result = await evalQuery('null | inter({:a 1 :b 2 :c 3}, #{:a :b})');
    expect(result).toBeInstanceOf(Map);
    expect(result.has(keyword('a'))).toBe(true);
    expect(result.has(keyword('b'))).toBe(true);
    expect(result.has(keyword('c'))).toBe(false);
  });

  it('union full form computes left union right via two captured pipelines', async () => {
    const result = await evalQuery('null | union({:a 1}, {:b 2})');
    expect(result).toBeInstanceOf(Map);
    expect(result.has(keyword('a'))).toBe(true);
    expect(result.has(keyword('b'))).toBe(true);
  });
});

describe('vec.min and vec.max on empty Vec', async () => {
  it('min on empty Vec returns null', async () => {
    expect(await evalQuery('[] | min')).toBeNull();
  });

  it('max on empty Vec returns null', async () => {
    expect(await evalQuery('[] | max')).toBeNull();
  });

  it('min on singleton Vec returns the only element', async () => {
    expect(await evalQuery('[42] | min')).toBe(42);
  });

  it('max on singleton Vec returns the only element', async () => {
    expect(await evalQuery('[42] | max')).toBe(42);
  });
});

describe('vec.sort with key on non-Vec subject', async () => {
  it('sort with key throws SortByKeySubjectNotVec', async () => {
    expect(isErrorValue(await evalQuery('42 | sort(/x)'))).toBe(true);
  });
});

describe('higherOrderOp / nullaryOp arity errors', async () => {
  it('nullaryOp called with captured args throws', async () => {
    expect(isErrorValue(await evalQuery('[1 2 3] | count(:foo)'))).toBe(true);
  });

  it('higherOrderOp filter called with zero captured args throws', async () => {
    // Variant-B: bare `filter` returns filter's descriptor Map for
    // REPL introspection since it has minCaptured > 0. Force actual
    // application with the empty-call form to trigger the arity
    // error from the higherOrderOp dispatch wrapper.
    expect(isErrorValue(await evalQuery('[1 2 3] | filter()'))).toBe(true);
  });
});

describe('format.toPlain non-keyword Map keys', async () => {
  it('json on a Map with string (non-keyword) keys uses String(k) fallback', async () => {
    // Inject a Map whose keys are plain strings, not interned keywords.
    // Construct via session.bind so we bypass the parser's
    // keyword-only Map literal syntax.
    const s = await createSession();
    const map = new Map();
    map.set('rawKey', 'rawValue');
    s.bind('rawMap', map);
    const out = (await s.evalCell('rawMap | json')).result;
    expect(typeof out).toBe('string');
    expect(out).toContain('rawKey');
    expect(out).toContain('rawValue');
  });

  it('table on a Vec of Maps with non-keyword keys still renders', async () => {
    const s = await createSession();
    const row = new Map();
    row.set('rawCol', 'rawCell');
    s.bind('rows', [row]);
    const out = (await s.evalCell('rows | table')).result;
    expect(typeof out).toBe('string');
    expect(out).toContain('rawCol');
    expect(out).toContain('rawCell');
  });
});

describe('intro.describeValueType for unknown types via bind', async () => {
  it('reify on a Symbol-bound value returns :unknown for the :type field', async () => {
    const s = await createSession();
    s.bind('weird', Symbol('weird'));
    const result = (await s.evalCell('reify(:weird) | /type')).result;
    expect(result).toEqual(keyword('unknown'));
  });
});

describe('deepEqual Set vs non-Set non-Array', async () => {
  it('returns false when first is Set and second is plain object', async () => {
    expect(deepEqual(new Set([1]), {})).toBe(false);
  });

  it('returns false when same-size Sets contain different elements', async () => {
    expect(deepEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);
  });
});

describe('count and friends on a Map subject', async () => {
  it('count on a Map returns its size', async () => {
    expect(await evalQuery('{:a 1 :b 2 :c 3} | count')).toBe(3);
  });
});

describe('valueOp arity overflow', async () => {
  it('add with zero captured args throws ArityError', async () => {
    // Variant-B: bare `add` returns add's descriptor for REPL
    // introspection since its minCaptured is 1. The empty-call
    // form `add()` forces actual application with zero lambdas
    // and triggers ValueOpArityMismatch.
    expect(isErrorValue(await evalQuery('5 | add()'))).toBe(true);
  });
});

describe('error-convert.mjs — errorFromParse without uri', async () => {
  it('omits :uri from descriptor when ParseError has no .uri', async () => {
    const parseError = Object.assign(new Error('unexpected token'), { location: null });
    // no .uri property — tests the false arm of `if (parseError.uri)`
    const errVal = errorFromParse(parseError);
    expect(isErrorValue(errVal)).toBe(true);
    expect(errVal.descriptor.has(keyword('uri'))).toBe(false);
  });
});

describe('error-convert.mjs — coerce with QSet and errorValue', async () => {
  it('coerce passes through a QSet (JS Set) unchanged', async () => {
    const qset = new Set([1, 2, 3]);
    const err = Object.assign(new Error('foreign'), { mySet: qset });
    const errVal = errorFromForeign(err, null);
    expect(isErrorValue(errVal)).toBe(true);
    // coerce(qset) returns the Set as-is; the descriptor stores it directly
    expect(errVal.descriptor.get(keyword('mySet'))).toBe(qset);
  });

  it('coerce passes through an errorValue unchanged', async () => {
    const inner = makeErrorValue(new Map(), { originalError: new Error('inner') });
    const err = Object.assign(new Error('foreign'), { cause: null, myErr: inner });
    const errVal = errorFromForeign(err, null);
    expect(isErrorValue(errVal)).toBe(true);
    expect(errVal.descriptor.get(keyword('myErr'))).toBe(inner);
  });
});

describe('eval.mjs — errorFromForeign arm (non-QlangError thrown inside evalNode)', async () => {
  it('wraps a plain JS Error from an operand as a foreign error value', async () => {
    // Create a function value that throws a raw Error (not QlangError)
    const bombFn = makeFn('bomb', 1, () => { throw new Error('raw boom'); }, { captured: [0, 0] });
    const s = await createSession();
    s.bind('bomb', bombFn);
    const entry = await s.evalCell('42 | bomb');
    expect(isErrorValue(entry.result)).toBe(true);
    expect(entry.result.descriptor.get(keyword('origin'))).toEqual(keyword('host'));
    expect(entry.result.descriptor.get(keyword('kind'))).toEqual(keyword('foreign-error'));
  });
});

describe('eval.mjs — OperandCall node.docs missing (synthetic AST)', async () => {
  it('lambdas.docs falls back to [] when node has no .docs field', async () => {
    // Synthetic OperandCall without .docs — hits the `node.docs || []` false arm
    const ast = { type: 'OperandCall', name: 'count', args: null, location: null };
    const runtimeEnv = await langRuntime();
    const state = makeState([1, 2, 3], runtimeEnv);
    const evalResult = await evalAst(ast, state);
    const result = evalResult.pipeValue;
    expect(result).toBe(3);
  });
});

describe('types.mjs — appendTrailNode stores entries verbatim without shape assumptions', async () => {
  it('stores a synthetic entry exactly as passed on the trail head', async () => {
    // Under the structured-trail design appendTrailNode is entry-
    // shape-agnostic: it stamps whatever qlang value the caller
    // hands it onto the linked list head with no inspection. The
    // production callsites in eval.mjs pass AST-Maps produced by
    // walk.mjs::astNodeToMap, but the value-class module does not
    // enforce that. A hand-rolled synthetic entry (here a Scalar
    // string) round-trips through _trailHead → materializeTrail
    // unchanged, proving the storage is verbatim.
    const { appendTrailNode, materializeTrail } = await import('../../src/types.mjs');
    const errVal = makeErrorValue(new Map([[keyword('kind'), keyword('type-error')]]));
    const syntheticEntry = 'synthetic-trail-label';
    const trailed = appendTrailNode(errVal, syntheticEntry);
    expect(isErrorValue(trailed)).toBe(true);
    expect(trailed._trailHead.entry).toBe(syntheticEntry);
    expect(materializeTrail(trailed)).toEqual([syntheticEntry]);
  });
});

describe('walk.mjs — bindingNamesVisibleAt skips let with non-Keyword first arg', async () => {
  it('does not add binding when let first arg is not a Keyword AST node', async () => {
    // Synthetic AST: let(42, count) — non-Keyword first arg
    const loc = { start: { offset: 0 }, end: { offset: 10 } };
    const synAst = {
      type: 'OperandCall',
      name: 'let',
      args: [
        { type: 'NumberLit', value: 42, location: loc },
        { type: 'OperandCall', name: 'count', args: null, location: loc }
      ],
      location: loc
    };
    const names = bindingNamesVisibleAt(synAst, 999);
    expect(names.size).toBe(0);
  });
});

describe('intro.mjs — RunExamplesNoExamplesField with non-keyword :kind', async () => {
  it('uses "unknown" in error message when descriptor :kind is not a keyword', async () => {
    // Map with :kind = 42 (number, not keyword) and no :examples field
    const s = await createSession();
    const desc = new Map([[keyword('kind'), 42]]);
    s.bind('badDesc', desc);
    const entry = await s.evalCell('badDesc | runExamples');
    expect(isErrorValue(entry.result)).toBe(true);
    const msg = entry.result.descriptor.get(keyword('message'));
    expect(msg).toContain('unknown');
  });
});

describe('setops bare-form empty Vec', async () => {
  it('minus bare on empty Vec throws MinusBareEmpty', async () => {
    expect(isErrorValue(await evalQuery('[] | minus'))).toBe(true);
  });

  it('inter bare on empty Vec throws InterBareEmpty', async () => {
    expect(isErrorValue(await evalQuery('[] | inter'))).toBe(true);
  });

  it('union bare on empty Vec throws UnionBareEmpty', async () => {
    expect(isErrorValue(await evalQuery('[] | union'))).toBe(true);
  });
});

describe('conduit effect-laundering at call site', async () => {
  it('conduit with @-name called via clean alias triggers EffectLaunderingAtCall', async () => {
    const s = await createSession();
    // Declare an @-prefixed conduit, then shadow it under a clean name
    // via use, triggering the runtime safety net in applyConduit.
    await s.evalCell('let(:@effFn, count)');
    await s.evalCell('{:clean (env | /@effFn)} | use');
    const cell = await s.evalCell('[1 2 3] | clean');
    // EffectLaunderingAtCall produces an error value.
    expect(isErrorValue(cell.result)).toBe(true);
    expect(cell.result.originalError.name).toBe('EffectLaunderingAtCall');
  });
});

describe('conduit-parameter arity error', async () => {
  it('calling a conduit parameter with captured args throws ConduitParameterNoCapturedArgs', async () => {
    // Inside the body, `n` is a conduit-parameter proxy (nullary
    // function value). Calling it with captured args (n(42)) should
    // raise ConduitParameterNoCapturedArgs with structured context.
    const result = await evalQuery('let(:f, [:n], n(42)) | 0 | f(5)');
    expect(isErrorValue(result)).toBe(true);
    const e = result.originalError;
    expect(e.name).toBe('ConduitParameterNoCapturedArgs');
    expect(e.context.paramName).toBe('n');
    expect(e.context.actualCount).toBe(1);
  });
});

describe('runExamples on non-string example entry', async () => {
  it('returns ok=false for non-string entries in examples Vec', async () => {
    const s = await createSession();
    // Build a descriptor with a non-string example entry to exercise
    // the `typeof example !== string` branch in runExamples.
    await s.evalCell('{:kind :builtin :examples [42]} | use');
    const result = (await s.evalCell('{:kind :builtin :examples [42]} | runExamples | first | /ok')).result;
    expect(result).toBe(false);
  });
});

describe('reify on a snapshot bound directly via session.bind', async () => {
  it('reify(:name) returns a snapshot descriptor with :type and :value', async () => {
    const s = await createSession();
    s.bind('snap', makeSnapshot(42, { name: 'snap' }));
    const result = (await s.evalCell('reify(:snap)')).result;
    expect(result.get(keyword('kind'))).toEqual(keyword('snapshot'));
    expect(result.get(keyword('value'))).toBe(42);
    expect(result.get(keyword('type'))).toEqual(keyword('number'));
  });
});

describe('min/max subject type checks', async () => {
  it('min on a non-Vec throws MinSubjectNotVec', async () => {
    const result = await evalQuery('42 | min');
    expect(isErrorValue(result)).toBe(true);
    expect(result.originalError.name).toBe('MinSubjectNotVec');
  });

  it('max on a non-Vec throws MaxSubjectNotVec', async () => {
    const result = await evalQuery('"hello" | max');
    expect(isErrorValue(result)).toBe(true);
    expect(result.originalError.name).toBe('MaxSubjectNotVec');
  });
});

describe('runExamples branch coverage', async () => {
  it('demo-mode example (no :expected) with a parse-valid snippet → ok=true', async () => {
    // Demo mode parse-verifies the snippet only. An unresolved
    // identifier at runtime is irrelevant here — `unknownOp` is a
    // legal identifier at the grammar level, so the parse succeeds
    // and the entry is marked :ok true even though an assertion-mode
    // eval would have raised.
    const s = await createSession();
    const result = (await s.evalCell('{:kind :builtin :examples [{:doc "caller-bound ident" :snippet "42 | unknownOp"}]} | runExamples | first')).result;
    expect(result.get(keyword('ok'))).toBe(true);
    expect(result.get(keyword('expected')) ?? null).toBe(null);
    expect(result.get(keyword('error'))).toBe(null);
  });

  it('demo-mode example with an unparseable snippet → ok=false with parse-error message', async () => {
    const s = await createSession();
    const result = (await s.evalCell('{:kind :builtin :examples [{:doc "unparseable" :snippet "|||"}]} | runExamples | first')).result;
    expect(result.get(keyword('ok'))).toBe(false);
    expect(typeof result.get(keyword('error'))).toBe('string');
  });

  it('assertion-mode example with a failing snippet → ok=false with runtime error message', async () => {
    const s = await createSession();
    const result = (await s.evalCell('{:kind :builtin :examples [{:doc "type mismatch" :snippet "42 | count" :expected "42"}]} | runExamples | first')).result;
    expect(result.get(keyword('ok'))).toBe(false);
    expect(result.get(keyword('error'))).toMatch(/Vec, Set, or Map/);
  });

  it('assertion-mode example with an unparseable :expected → ok=false', async () => {
    const s = await createSession();
    const result = (await s.evalCell('{:kind :builtin :examples [{:doc "bad expected" :snippet "42" :expected "|||"}]} | runExamples | first')).result;
    expect(result.get(keyword('ok'))).toBe(false);
  });
});

describe('mergeFlat non-Vec element passthrough', async () => {
  it('>> passes non-Vec elements through unchanged', async () => {
    const result = await evalQuery('[1, [2, 3], 4] >> count');
    expect(result).toBe(4);
  });
});

describe('bindingNamesVisibleAt edge cases', async () => {
  it('bare let/as OperandCall with no args does not contribute names', async () => {
    // `count` at offset after the pipeline exercises the
    // bindingNamesVisibleAt path where an OperandCall named 'let'
    // has args=null (bare identifier, no parens).
    const ast = parse('let | count');
    const visible = bindingNamesVisibleAt(ast, ast.source.length);
    // 'let' here is a bare identifier (args=null), not a binding
    // declaration, so no names should be added.
    expect(visible.size).toBe(0);
  });

  it('binding inside a fork-isolating ancestor not containing offset is invisible', async () => {
    // The as(:x) inside the paren group is fork-isolated.
    // At offset past the paren group, :x should not be visible.
    const src = '(42 | as(:x)) | count';
    const ast = parse(src);
    const offsetAfterParen = src.indexOf('| count');
    const visible = bindingNamesVisibleAt(ast, offsetAfterParen);
    expect(visible.has('x')).toBe(false);
  });
});

import { deserializeSession, serializeSession } from '../../src/session.mjs';

describe('session deserialization edge cases', async () => {
  it('deserializes conduit binding without params field', async () => {
    const payload = {
      schemaVersion: 1,
      bindings: [{ kind: 'conduit', name: 'x', source: 'mul(2)', docs: [] }],
      cells: []
    };
    const s = await deserializeSession(payload);
    const r = await s.evalCell('5 | x');
    expect(r.result).toBe(10);
  });
});

describe('runExamples with parse error in example', async () => {
  it('reports ok=false for syntactically invalid example', async () => {
    // Build a fake descriptor Map with an invalid example
    const s = await createSession();
    await s.evalCell('let(:fakeOp, 42)');
    // Manually build descriptor with bad example via a pipeline:
    const r = await s.evalCell('{:kind :builtin :examples ["[[[invalid"]} | runExamples | first | /ok');
    expect(r.result).toBe(false);
  });

  it('reports error message for parse-error example', async () => {
    const s = await createSession();
    const r = await s.evalCell('{:kind :builtin :examples ["[[[invalid"]} | runExamples | first | /error');
    expect(typeof r.result).toBe('string');
    expect(r.result.length).toBeGreaterThan(0);
  });
});

describe('importSelectiveNamespace single keyword fallback', async () => {
  it('use(:ns, :singleKeyword) wraps keyword in array', async () => {
    const s = await createSession();
    const lib = new Map();
    lib.set(keyword('x'), 10);
    lib.set(keyword('y'), 20);
    s.bind('lib', lib);
    const r = await s.evalCell('use(:lib, :x) | x');
    expect(r.result).toBe(10);
  });
});


import {
  metaToVec, bindingName, capturedRange, categoryKeyword, errorMessageOf
} from '../../src/runtime/intro.mjs';

describe('extracted descriptor helpers', async () => {
  it('metaToVec on array returns copy', async () => {
    expect(metaToVec([1, 2])).toEqual([1, 2]);
  });
  it('metaToVec on null returns empty', async () => {
    expect(metaToVec(null)).toEqual([]);
  });
  it('metaToVec on undefined returns empty', async () => {
    expect(metaToVec(undefined)).toEqual([]);
  });

  it('bindingName prefers explicitName', async () => {
    expect(bindingName('explicit', { name: 'binding' })).toBe('explicit');
  });
  it('bindingName falls back to binding.name', async () => {
    expect(bindingName(null, { name: 'binding' })).toBe('binding');
  });
  it('bindingName returns null when both absent', async () => {
    expect(bindingName(null, {})).toBe(null);
    expect(bindingName(null, null)).toBe(null);
  });

  it('capturedRange from meta.captured', async () => {
    expect(capturedRange({ meta: { captured: [0, 1] } })).toEqual([0, 1]);
  });
  it('capturedRange returns null when absent', async () => {
    expect(capturedRange({ meta: {} })).toBe(null);
    expect(capturedRange({})).toBe(null);
  });

  it('categoryKeyword with category', async () => {
    expect(categoryKeyword({ category: 'arith' })).toEqual(keyword('arith'));
  });
  it('categoryKeyword without category', async () => {
    expect(categoryKeyword({})).toBe(null);
  });

  it('errorMessageOf with originalError', async () => {
    const ev = makeErrorValue(new Map(), { originalError: new Error('from JS') });
    expect(errorMessageOf(ev)).toBe('from JS');
  });
  it('errorMessageOf without originalError', async () => {
    const d = new Map();
    d.set(keyword('message'), 'from descriptor');
    const ev = makeErrorValue(d, {});
    expect(errorMessageOf(ev)).toBe('from descriptor');
  });
});

describe('reify descriptor branch coverage', async () => {
  it('reify value-level on conduit exposes name', async () => {
    const r = await evalQuery('let(:x, mul(2)) | env | /x | reify | /name');
    expect(r).toBe('x');
  });

  it('reify value-level on snapshot exposes name', async () => {
    // env | /val returns the snapshot wrapper; reify on it gives descriptor
    const r = await evalQuery('42 | as(:val) | reify(:val) | /name');
    expect(r).toBe('val');
  });

  it('reify named form on conduit', async () => {
    const r = await evalQuery('let(:x, mul(2)) | reify(:x) | /kind');
    expect(r).toEqual(keyword('conduit'));
  });

  it('reify named form on snapshot', async () => {
    const r = await evalQuery('42 | as(:v) | reify(:v) | /kind');
    expect(r).toEqual(keyword('snapshot'));
  });

  it('reify on plain value', async () => {
    const r = await evalQuery('42 | reify | /kind');
    expect(r).toEqual(keyword('value'));
  });

  it('runExamples on example without :expected', async () => {
    const r = await evalQuery('{:kind :builtin :examples [{:doc "Vec length" :snippet "[1 2 3] | count"}]} | runExamples | first | /ok');
    expect(r).toBe(true);
  });

  it('runExamples on example with mismatched result', async () => {
    const r = await evalQuery('{:kind :builtin :examples [{:doc "wrong answer" :snippet "42" :expected "99"}]} | runExamples | first | /ok');
    expect(r).toBe(false);
  });
});

// ── walk.mjs uncovered branches ────────────────────────────────
// Three defensive paths only reachable via direct codec API calls
// (not through parse() → eval()); exercised here so the codec
// contract is tested rather than silently untested.

describe('walk.mjs — locationToQlangMap(null) → null (line 397)', async () => {
  it('roundtrip through qlangMapToAst+astNodeToMap with :location null produces null location map entry', async () => {
    // Build a minimal NumberLit AST Map with :location explicitly null.
    // qlangMapToAst fires locationFromQlangMap(null) (line 405: !isQMap → null),
    // then astNodeToMap on the result fires locationToQlangMap(null) (line 397: !loc → null).
    const m = new Map();
    m.set(keyword('qlang/kind'), keyword('NumberLit'));
    m.set(keyword('value'), 42);
    m.set(keyword('location'), null);            // present but non-Map → fires 405
    const node = qlangMapToAst(m);
    expect(node.location).toBe(null);            // locationFromQlangMap(null) → null
    const back = astNodeToMap(node);
    // locationToQlangMap(null) → null; stampCommonFields sets :location null
    expect(back.get(keyword('location'))).toBe(null);  // fires 397
  });
});

describe('walk.mjs — qlangMapToAst with non-keyword :qlang/kind uses String() fallback (line 603)', async () => {
  it('throws AstMapKindUnknownError with String(kindKw) label when kind is not a keyword', async () => {
    const m = new Map();
    m.set(keyword('qlang/kind'), null);   // present but null → String(null) = "null"
    expect(() => qlangMapToAst(m)).toThrow('null');
  });
});

// ── intro.mjs uncovered branches ──────────────────────────────

describe('intro.mjs — UseNamespaceCollision (line 138)', async () => {
  it('keyword-keyed collision uses k.name in error context', async () => {
    // importUnorderedNamespaces — collision on a keyword key.
    // isKeyword(k) is true → k.name branch taken (existing coverage).
    const s = await createSession();
    s.bind('nsA', new Map([[keyword('shared'), 1]]));
    s.bind('nsB', new Map([[keyword('shared'), 2]]));
    const r = await s.evalCell('use(#{:nsA, :nsB})');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.name).toBe('UseNamespaceCollision');
  });

  it('non-keyword-keyed collision uses String(k) fallback in error context (line 138)', async () => {
    // Namespaces with raw string keys (non-keyword). isKeyword(k) is
    // false → String(k) branch fires on line 138.
    const s = await createSession();
    s.bind('nsC', new Map([['rawKey', 1]]));
    s.bind('nsD', new Map([['rawKey', 2]]));
    const r = await s.evalCell('use(#{:nsC, :nsD})');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.context.collidingName).toBe('rawKey');
  });
});

describe('intro.mjs — UseNameNotExported (line 157)', async () => {
  it('selective use(:ns, :missing) produces an error when name is absent', async () => {
    const s = await createSession();
    s.bind('myNs', new Map([[keyword('x'), 99]]));
    const r = await s.evalCell('use(:myNs, :missing)');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.name).toBe('UseNameNotExported');
  });

  it('non-keyword selection uses String(name) fallback in error context (line 157)', async () => {
    // Pass a Vec with a number element as the selection — the number is
    // not a keyword, so isKeyword(name) is false → String(name) fires.
    const s = await createSession();
    s.bind('myNs2', new Map([[keyword('x'), 99]]));
    // use(:myNs2, [42]) — selection Vec contains number 42, not a keyword
    const r = await s.evalCell('use(:myNs2, [42])');
    expect(isErrorValue(r.result)).toBe(true);
    expect(r.result.originalError.context.exportName).toBe('42');
  });
});

describe('intro.mjs — describeValueType for error value (line 176)', async () => {
  it('reify on a directly-bound error value returns :error as :type', async () => {
    // describeValueType is called from buildValueDescriptor (reify value path).
    // An error value bound directly via session.bind reaches the
    // isErrorValue(v) branch since it is not a conduit, snapshot, or function.
    const s = await createSession();
    const errVal = makeErrorValue(new Map([[keyword('kind'), keyword('test')]]));
    s.bind('myErr', errVal);
    const r = await s.evalCell('reify(:myErr) | /type');
    expect(r.result).toEqual(keyword('error'));
  });
});

describe('printValue — qlang literal serialization', async () => {
  it('prints scalars', async () => {
    expect(printValue(null)).toBe('null');
    expect(printValue(undefined)).toBe('null');
    expect(printValue(true)).toBe('true');
    expect(printValue(false)).toBe('false');
    expect(printValue(42)).toBe('42');
    expect(printValue(3.14)).toBe('3.14');
    expect(printValue(-1)).toBe('-1');
  });

  it('prints strings with escapes', async () => {
    expect(printValue('hello')).toBe('"hello"');
    expect(printValue('a"b')).toBe('"a\\"b"');
    expect(printValue('a\nb')).toBe('"a\\nb"');
    expect(printValue('a\\b')).toBe('"a\\\\b"');
  });

  it('prints keywords', async () => {
    expect(printValue(keyword('name'))).toBe(':name');
    expect(printValue(keyword('qlang/error'))).toBe(':qlang/error');
  });

  it('prints Vec', async () => {
    expect(printValue([1, 2, 3])).toBe('[1 2 3]');
    expect(printValue([])).toBe('[]');
    expect(printValue(['a', 'b'])).toBe('["a" "b"]');
  });

  it('prints Set', async () => {
    expect(printValue(new Set([1, 2]))).toBe('#{1 2}');
  });

  it('prints small Map inline', async () => {
    const m = new Map([[keyword('a'), 1], [keyword('b'), 2]]);
    expect(printValue(m)).toBe('{:a 1 :b 2}');
  });

  it('pretty-prints Map with more than 2 entries', async () => {
    const m = new Map([
      [keyword('a'), 1],
      [keyword('b'), 2],
      [keyword('c'), 3]
    ]);
    const out = printValue(m);
    expect(out).toContain('\n');
    expect(out).toMatch(/^\{/);
    expect(out).toMatch(/\}$/);
    expect(out).toContain(':a 1');
    expect(out).toContain(':b 2');
    expect(out).toContain(':c 3');
  });

  it('prints error value with descriptor', async () => {
    const desc = new Map([[keyword('kind'), keyword('test')]]);
    const err = makeErrorValue(desc);
    const out = printValue(err);
    expect(out).toMatch(/^!\{/);
    expect(out).toContain(':kind :test');
  });

  it('pretty-prints error with many descriptor fields', async () => {
    const desc = new Map([
      [keyword('origin'), keyword('qlang/eval')],
      [keyword('kind'), keyword('type-error')],
      [keyword('message'), 'boom']
    ]);
    const err = makeErrorValue(desc);
    const out = printValue(err);
    expect(out).toContain('\n');
    expect(out).toContain(':origin :qlang/eval');
    expect(out).toContain(':message "boom"');
  });

  it('falls back to String() for exotic values', async () => {
    const out = printValue(Symbol('x'));
    expect(out).toBe('Symbol(x)');
  });
});

