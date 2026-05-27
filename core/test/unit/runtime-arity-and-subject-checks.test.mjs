// Per-site arity and subject-type checks across the runtime
// catalog plus the dispatch-wrapper registration invariants every
// `runtime/*.mjs` operand flows through. Each `describe` block
// names one runtime module and the specific arity / subject /
// shape branch it pins:
//
//   * dispatch.mjs — `stateOpVariadic` / `higherOrderOpVariadic`
//     refusing to mint a wrapper without a captured-range argument
//     (the JS-side invariant fires at module-load time, not at
//     dispatch).
//   * arith.mjs — right-operand type checks for `sub` / `mul` /
//     `div` (left-operand path is covered by the per-site error
//     factory tests; this file pins the right-operand sibling).
//   * vec.mjs — flat / min / max / sort behaviour on edge subjects
//     (empty Vec, non-Vec subject, non-Vec elements alongside Vec
//     elements, singleton Vec).
//   * setops.mjs — bare-form (non-Vec subject, empty Vec) and
//     full-form (two captured args) error / behaviour branches
//     for `union` / `minus` / `inter`.
//   * mapOp.mjs — `count` polymorphism over Map subject.
//   * Rule 10 dispatcher — `valueOp` arity overflow, `nullaryOp`
//     called with captured args, `higherOrderOp` called with zero
//     captured args.
//
// Topical happy-path semantics live in the per-operand test files
// (`arith.test.mjs`, `vec.test.mjs`, `setops.test.mjs`,
// `dispatch.test.mjs`, …). This file fills per-branch tails the
// language-spec walkthrough does not name on its own.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue } from '../../src/types.mjs';
import {
  stateOpVariadic,
  higherOrderOpVariadic
} from '../../src/runtime/dispatch.mjs';
import { QlangInvariantError } from '../../src/errors.mjs';

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

describe('vec.flat non-Vec elements', async () => {
  it('flat preserves non-Vec elements alongside Vec elements', async () => {
    expect(await evalQuery('[1 [2 3] 4] | flat')).toEqual([1, 2, 3, 4]);
  });
});

describe('dispatch variadic registration invariants', async () => {
  it('stateOpVariadic without captured throws QlangInvariantError', async () => {
    expect(() => stateOpVariadic('badOp', (s) => s)).toThrow(QlangInvariantError);
  });

  it('stateOpVariadic with null captured throws QlangInvariantError', async () => {
    expect(() => stateOpVariadic('badOp', (s) => s, null)).toThrow(QlangInvariantError);
  });

  it('higherOrderOpVariadic without captured throws QlangInvariantError', async () => {
    expect(() => higherOrderOpVariadic('badOp', (pv) => pv)).toThrow(QlangInvariantError);
  });

  it('higherOrderOpVariadic with null captured throws QlangInvariantError', async () => {
    expect(() => higherOrderOpVariadic('badOp', (pv) => pv, null)).toThrow(QlangInvariantError);
  });
});

describe('setops bare-form non-Vec subject errors', async () => {
  it('union bare on non-Vec/non-Set throws UnionBareSubjectNotVecError', async () => {
    expect(isErrorValue(await evalQuery('42 | union'))).toBe(true);
  });

  it('union bare on a Set (which is also non-Array) throws', async () => {
    expect(isErrorValue(await evalQuery('#[:a] | union'))).toBe(true);
  });

  it('minus bare on non-Vec throws MinusBareSubjectNotVecError', async () => {
    expect(isErrorValue(await evalQuery('42 | minus'))).toBe(true);
  });

  it('inter bare on non-Vec throws InterBareSubjectNotVecError', async () => {
    expect(isErrorValue(await evalQuery('42 | inter'))).toBe(true);
  });
});

describe('setops full form (two captured args)', async () => {
  it('minus full form computes left minus right via two captured pipelines', async () => {
    const result = await evalQuery('null | minus({:a 1 :b 2 :tmp 3}, #[:tmp])');
    expect(result).toBeInstanceOf(Map);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.has('tmp')).toBe(false);
  });

  it('inter full form computes left inter right via two captured pipelines', async () => {
    const result = await evalQuery('null | inter({:a 1 :b 2 :c 3}, #[:a :b])');
    expect(result).toBeInstanceOf(Map);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.has('c')).toBe(false);
  });

  it('union full form computes left union right via two captured pipelines', async () => {
    const result = await evalQuery('null | union({:a 1}, {:b 2})');
    expect(result).toBeInstanceOf(Map);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
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
  it('sort with key throws SortByKeySubjectNotSequenceError', async () => {
    expect(isErrorValue(await evalQuery('42 | sort(/x)'))).toBe(true);
  });
});

describe('higherOrderOp / nullaryOp arity errors', async () => {
  it('nullaryOp called with captured args throws', async () => {
    expect(isErrorValue(await evalQuery('[1 2 3] | count(:foo)'))).toBe(true);
  });

  it('higherOrderOp filter called with zero captured args throws', async () => {
    // Bare `filter` returns filter's descriptor Map for REPL
    // introspection because its minCaptured > 0. The empty-call
    // form `filter()` forces actual application with zero lambdas
    // and triggers the arity error inside the higherOrderOp
    // dispatch wrapper.
    expect(isErrorValue(await evalQuery('[1 2 3] | filter()'))).toBe(true);
  });
});

describe('count and friends on a Map subject', async () => {
  it('count on a Map returns its size', async () => {
    expect(await evalQuery('{:a 1 :b 2 :c 3} | count')).toBe(3);
  });
});

describe('valueOp arity overflow', async () => {
  it('add with zero captured args throws ArityError', async () => {
    // Bare `add` returns add's descriptor for REPL introspection
    // because its minCaptured is 1. The empty-call form `add()`
    // forces actual application with zero lambdas and triggers
    // ValueOpArityMismatchError.
    expect(isErrorValue(await evalQuery('5 | add()'))).toBe(true);
  });
});

describe('setops bare-form empty Vec', async () => {
  it('minus bare on empty Vec throws MinusBareEmptyError', async () => {
    expect(isErrorValue(await evalQuery('[] | minus'))).toBe(true);
  });

  it('inter bare on empty Vec throws InterBareEmptyError', async () => {
    expect(isErrorValue(await evalQuery('[] | inter'))).toBe(true);
  });

  it('union bare on empty Vec throws UnionBareEmptyError', async () => {
    expect(isErrorValue(await evalQuery('[] | union'))).toBe(true);
  });
});

describe('min/max subject type checks', async () => {
  it('min on a non-Vec-or-Set throws MinSubjectNotVecOrSetError', async () => {
    const result = await evalQuery('42 | min');
    expect(isErrorValue(result)).toBe(true);
    expect(result.originalError.name).toBe('MinSubjectNotVecOrSetError');
  });

  it('max on a non-Vec-or-Set throws MaxSubjectNotVecOrSetError', async () => {
    const result = await evalQuery('"hello" | max');
    expect(isErrorValue(result)).toBe(true);
    expect(result.originalError.name).toBe('MaxSubjectNotVecOrSetError');
  });
});

describe('mergeFlat non-Vec element passthrough', async () => {
  it('>> passes non-Vec elements through unchanged', async () => {
    const result = await evalQuery('[1, [2, 3], 4] >> count');
    expect(result).toBe(4);
  });
});
