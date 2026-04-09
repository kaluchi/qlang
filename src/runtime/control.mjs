// Control-flow operands.
//
// Five pipeline-level selection primitives sharing one design
// principle: all branch arguments are captured sub-pipelines
// (lambdas), and only the branch(es) that need to fire actually
// evaluate against pipeValue. The `then`/`else`/`alt` slots are
// never eagerly resolved.
//
// Meta lives in manifest.qlang.

import {
  higherOrderOp,
  higherOrderOpVariadic,
  UNBOUNDED
} from './dispatch.mjs';
import { isTruthy, isNil, NIL } from '../types.mjs';
import { declareArityError } from './operand-errors.mjs';

const CoalesceNoAlternatives = declareArityError('CoalesceNoAlternatives',
  () => 'coalesce requires at least one alternative sub-pipeline');
const FirstTruthyNoAlternatives = declareArityError('FirstTruthyNoAlternatives',
  () => 'firstTruthy requires at least one alternative sub-pipeline');
const CondNoBranches = declareArityError('CondNoBranches',
  () => 'cond requires at least one (predicate, branch) pair plus an optional trailing default');

export const ifOp = higherOrderOp('if', 4,
  (pipeValue, condLambda, thenLambda, elseLambda) => {
    return isTruthy(condLambda(pipeValue))
      ? thenLambda(pipeValue)
      : elseLambda(pipeValue);
  });

export const when = higherOrderOp('when', 3,
  (pipeValue, condLambda, thenLambda) => {
    return isTruthy(condLambda(pipeValue))
      ? thenLambda(pipeValue)
      : pipeValue;
  });

export const unless = higherOrderOp('unless', 3,
  (pipeValue, condLambda, thenLambda) => {
    return isTruthy(condLambda(pipeValue))
      ? pipeValue
      : thenLambda(pipeValue);
  });

export const coalesce = higherOrderOpVariadic('coalesce', 16,
  (pipeValue, ...lambdas) => {
    if (lambdas.length === 0) {
      throw new CoalesceNoAlternatives();
    }
    for (const lambda of lambdas) {
      const value = lambda(pipeValue);
      if (!isNil(value)) return value;
    }
    return NIL;
  }, [1, UNBOUNDED]);

export const cond = higherOrderOpVariadic('cond', 16,
  (pipeValue, ...lambdas) => {
    if (lambdas.length < 2) {
      throw new CondNoBranches();
    }
    let i = 0;
    while (i + 1 < lambdas.length) {
      const predLambda = lambdas[i];
      const branchLambda = lambdas[i + 1];
      if (isTruthy(predLambda(pipeValue))) {
        return branchLambda(pipeValue);
      }
      i += 2;
    }
    if (i < lambdas.length) {
      return lambdas[i](pipeValue);
    }
    return NIL;
  }, [2, UNBOUNDED]);

export const firstTruthy = higherOrderOpVariadic('firstTruthy', 16,
  (pipeValue, ...lambdas) => {
    if (lambdas.length === 0) {
      throw new FirstTruthyNoAlternatives();
    }
    for (const lambda of lambdas) {
      const value = lambda(pipeValue);
      if (isTruthy(value)) return value;
    }
    return NIL;
  }, [1, UNBOUNDED]);
