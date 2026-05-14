// Control-flow operands.
//
// Five pipeline-level selection primitives sharing one design
// principle: all branch arguments are captured sub-pipelines
// (lambdas), and only the branch(es) that need to fire actually
// evaluate against pipeValue. The `then`/`else`/`alt` slots are
// never eagerly resolved.
//
// Meta lives in lib/qlang/operand/control.qlang.

import {
  higherOrderOp,
  higherOrderOpVariadic,
  UNBOUNDED
} from './dispatch.mjs';
import { isTruthy, isNull, isErrorValue, NULL } from '../types.mjs';
import { declareArityError } from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

const CoalesceNoAlternativesError = declareArityError('CoalesceNoAlternativesError',
  () => 'coalesce requires at least one alternative sub-pipeline');
const FirstTruthyNoAlternativesError = declareArityError('FirstTruthyNoAlternativesError',
  () => 'firstTruthy requires at least one alternative sub-pipeline');
const CondNoBranchesError = declareArityError('CondNoBranchesError',
  () => 'cond requires at least one (predicate, branch) pair plus an optional trailing default');

export const ifOp = higherOrderOp('if', 4,
  async (ifSubject, ifCondLambda, ifThenLambda, ifElseLambda) => {
    return isTruthy(await ifCondLambda(ifSubject))
      ? await ifThenLambda(ifSubject)
      : await ifElseLambda(ifSubject);
  });

export const when = higherOrderOp('when', 3,
  async (whenSubject, whenCondLambda, whenThenLambda) => {
    return isTruthy(await whenCondLambda(whenSubject))
      ? await whenThenLambda(whenSubject)
      : whenSubject;
  });

export const unless = higherOrderOp('unless', 3,
  async (unlessSubject, unlessCondLambda, unlessThenLambda) => {
    return isTruthy(await unlessCondLambda(unlessSubject))
      ? unlessSubject
      : await unlessThenLambda(unlessSubject);
  });

// Returns the first alternative that resolves to a non-null,
// non-error value — both `null` (the "no value" sentinel) and
// `ErrorValue` (typically a strict-projection miss like `/missing`
// on a Map without the key) count as "skip and try next". The
// fall-back is `null` when every alternative fails or yields
// `null`. Treating ErrorValue as "try next" is what makes
// `coalesce(/a, /b, "default")` continue past a missing-key error
// from `/a` — the operand's intent is "first defined value",
// strict projection turned "undefined" into an error, this catch
// restores the iteration semantics.
export const coalesce = higherOrderOpVariadic('coalesce', 16,
  async (coalesceSubject, ...coalesceLambdas) => {
    if (coalesceLambdas.length === 0) {
      throw new CoalesceNoAlternativesError();
    }
    for (const coalesceAlt of coalesceLambdas) {
      const coalesceVal = await coalesceAlt(coalesceSubject);
      if (isNull(coalesceVal) || isErrorValue(coalesceVal)) continue;
      return coalesceVal;
    }
    return NULL;
  }, [1, UNBOUNDED]);

export const cond = higherOrderOpVariadic('cond', 16,
  async (condSubject, ...condLambdas) => {
    if (condLambdas.length < 2) {
      throw new CondNoBranchesError();
    }
    let condIdx = 0;
    while (condIdx + 1 < condLambdas.length) {
      const condPredLambda = condLambdas[condIdx];
      const condBranchLambda = condLambdas[condIdx + 1];
      if (isTruthy(await condPredLambda(condSubject))) {
        return await condBranchLambda(condSubject);
      }
      condIdx += 2;
    }
    if (condIdx < condLambdas.length) {
      return await condLambdas[condIdx](condSubject);
    }
    return NULL;
  }, [2, UNBOUNDED]);

// Same skip-on-error rule as `coalesce` (see comment above) — an
// ErrorValue from an alternative counts as falsy and the iteration
// moves to the next.
export const firstTruthy = higherOrderOpVariadic('firstTruthy', 16,
  async (firstTruthySubject, ...firstTruthyLambdas) => {
    if (firstTruthyLambdas.length === 0) {
      throw new FirstTruthyNoAlternativesError();
    }
    for (const truthyAlt of firstTruthyLambdas) {
      const truthyVal = await truthyAlt(firstTruthySubject);
      if (isErrorValue(truthyVal)) continue;
      if (isTruthy(truthyVal)) return truthyVal;
    }
    return NULL;
  }, [1, UNBOUNDED]);

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
// `ifOp` is the JS-level identifier for the qlang `if` operand
// (because `if` is a JS reserved word).
PRIMITIVE_REGISTRY.bind('qlang/prim/if',          ifOp);
PRIMITIVE_REGISTRY.bind('qlang/prim/when',        when);
PRIMITIVE_REGISTRY.bind('qlang/prim/unless',      unless);
PRIMITIVE_REGISTRY.bind('qlang/prim/coalesce',    coalesce);
PRIMITIVE_REGISTRY.bind('qlang/prim/cond',        cond);
PRIMITIVE_REGISTRY.bind('qlang/prim/firstTruthy', firstTruthy);
