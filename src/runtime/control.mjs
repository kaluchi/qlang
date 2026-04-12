// Control-flow operands.
//
// Five pipeline-level selection primitives sharing one design
// principle: all branch arguments are captured sub-pipelines
// (lambdas), and only the branch(es) that need to fire actually
// evaluate against pipeValue. The `then`/`else`/`alt` slots are
// never eagerly resolved.
//
// Meta lives in lib/qlang/core.qlang.

import {
  higherOrderOp,
  higherOrderOpVariadic,
  UNBOUNDED
} from './dispatch.mjs';
import { isTruthy, isNull, NULL, keyword } from '../types.mjs';
import { declareArityError } from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

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
      if (!isNull(value)) return value;
    }
    return NULL;
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
    return NULL;
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
    return NULL;
  }, [1, UNBOUNDED]);

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
// `ifOp` is the JS-level identifier for the qlang `if` operand
// (because `if` is a JS reserved word).
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/if'),          ifOp);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/when'),        when);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/unless'),      unless);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/coalesce'),    coalesce);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/cond'),        cond);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/firstTruthy'), firstTruthy);
