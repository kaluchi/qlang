// Control-flow operands.
//
// `if` and `coalesce` are pipeline-level selection primitives.
// Both operate on the current pipeValue and use captured-arg
// sub-pipelines (lambdas) for their alternatives, evaluating only
// the necessary branch(es) lazily.
//
// `if` is the binary conditional: cond is evaluated against
// pipeValue, and depending on truthiness either the then or the
// else branch is executed (against the same pipeValue). Only one
// branch runs.
//
// `coalesce` takes 1+ alternative sub-pipelines and returns the
// first non-nil result, evaluating each in order and stopping as
// soon as a non-nil value is produced. The "default" pattern lives
// here — pass the desired default as the last alternative.

import { higherOrderOp, higherOrderOpVariadic } from './dispatch.mjs';
import { isTruthy, isNil, NIL } from '../types.mjs';
import { declareShapeError } from './operand-errors.mjs';

const CoalesceNoAlternatives = declareShapeError('CoalesceNoAlternatives',
  () => 'coalesce requires at least one alternative sub-pipeline');

// `if` — three captured sub-pipelines, lazy evaluation of the
// selected branch. Implementation file uses the JS-safe name
// `ifOp`; the language-level identifier is `if` (registered in
// runtime/index.mjs).
//
//   pipeValue | if(cond, then, else)
//
// `cond` runs against pipeValue. If its result is truthy (per
// language truthiness rules: nil and false are falsy, everything
// else including 0, "", [], {}, #{} is truthy), `then` runs against
// the same pipeValue and its result becomes the new pipeValue.
// Otherwise `else` runs.
//
// All three branches are captured sub-pipelines; only one of
// `then` / `else` is evaluated.
export const ifOp = higherOrderOp('if', 4,
  (pipeValue, condLambda, thenLambda, elseLambda) => {
    return isTruthy(condLambda(pipeValue))
      ? thenLambda(pipeValue)
      : elseLambda(pipeValue);
  }, {
    category: 'control',
    subject: 'any',
    modifiers: ['cond sub-pipeline', 'then sub-pipeline', 'else sub-pipeline'],
    returns: 'any (result of the selected branch)',
    docs: ['Conditional. Evaluates the cond sub-pipeline against pipeValue; if the result is truthy, evaluates the then branch against pipeValue and that result becomes the new pipeValue, otherwise evaluates the else branch. All three arguments are captured sub-pipelines and only the selected branch executes. Truthiness: nil and false are falsy, everything else (including 0, "", [], {}, #{}) is truthy.'],
    examples: [
      'score | if(gte(60), "pass", "fail")',
      'employee | if(/active, /salary | mul(1.1), /salary)',
      'list | if(empty, "<empty>", first)'
    ],
    throws: []
  });

// `coalesce` — variadic captured sub-pipelines, returns the first
// non-nil result.
//
//   person | coalesce(/preferredName, /firstName, "Anonymous")
//
// Each alternative is a captured sub-pipeline. Alternatives are
// evaluated in order against pipeValue. The first one that returns
// a non-nil value (anything other than nil/null/undefined) becomes
// the new pipeValue and remaining alternatives are skipped. If all
// alternatives produce nil, the result is nil.
//
// At least one captured arg is required.
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
  }, {
    category: 'control',
    subject: 'any',
    modifiers: ['1+ alternative sub-pipelines'],
    returns: 'any (first non-nil result, or nil if all are nil)',
    docs: ['Returns the first non-nil result among the captured alternatives, evaluating each against pipeValue in order and short-circuiting on the first non-nil value. If all alternatives produce nil, returns nil. Use as a default-fallback pattern: pass the default as the last alternative. Falsy non-nil values (false, 0, "", [], {}, #{}) are NOT skipped — only nil/null/undefined are.'],
    examples: [
      'person | coalesce(/preferredName, /firstName, "Anonymous")',
      'config | coalesce(/userOverride, /projectDefault, /globalDefault)',
      'lookup | coalesce(/cached, /computed)'
    ],
    throws: ['CoalesceNoAlternatives']
  });
