// Control-flow operands.
//
// Five pipeline-level selection primitives sharing one design
// principle: all branch arguments are captured sub-pipelines
// (lambdas), and only the branch(es) that need to fire actually
// evaluate against pipeValue. The `then`/`else`/`alt` slots are
// never eagerly resolved.
//
// Conditional family (cond → action):
//   if(cond, then, else)  — full two-sided conditional
//   when(cond, then)      — one-sided, identity on false
//   unless(cond, then)    — one-sided, identity on true (inverse of when)
//
// Selection family (first matching alternative):
//   coalesce(...alts)     — first non-nil
//   firstTruthy(...alts)  — first truthy
//
// `coalesce` and `firstTruthy` differ only on which falsy non-nil
// values they consider "missing": coalesce skips only nil, firstTruthy
// also skips false / 0 / "" / [] / {} / #{}. Use coalesce for config
// cascading where false is a meaningful explicit setting; use
// firstTruthy for display defaults where empty is also a sentinel.

import { higherOrderOp, higherOrderOpVariadic } from './dispatch.mjs';
import { isTruthy, isNil, NIL } from '../types.mjs';
import { declareArityError } from './operand-errors.mjs';

const CoalesceNoAlternatives = declareArityError('CoalesceNoAlternatives',
  () => 'coalesce requires at least one alternative sub-pipeline');
const FirstTruthyNoAlternatives = declareArityError('FirstTruthyNoAlternatives',
  () => 'firstTruthy requires at least one alternative sub-pipeline');

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

// `when` — one-sided conditional, identity on falsy cond.
//
//   pipeValue | when(cond, then)
//
// If `cond` evaluated against pipeValue is truthy, `then` is run
// against pipeValue and its result becomes the new pipeValue.
// Otherwise pipeValue passes through unchanged. The else branch
// is implicit identity, so unlike `if` there is no third argument.
//
// Use for "do something when condition holds, leave alone otherwise"
// patterns — guarded transformations, optional enrichment.
export const when = higherOrderOp('when', 3,
  (pipeValue, condLambda, thenLambda) => {
    return isTruthy(condLambda(pipeValue))
      ? thenLambda(pipeValue)
      : pipeValue;
  }, {
    category: 'control',
    subject: 'any',
    modifiers: ['cond sub-pipeline', 'then sub-pipeline'],
    returns: 'any (then result if cond truthy, otherwise pipeValue unchanged)',
    docs: ['One-sided conditional with implicit identity on the false branch. Evaluates the cond sub-pipeline against pipeValue; if truthy, evaluates the then sub-pipeline against pipeValue and returns its result. If cond is falsy, pipeValue passes through unchanged. Both arguments are captured sub-pipelines, so the then branch is only evaluated when the condition fires. Use for guarded transformations and optional enrichment patterns.'],
    examples: [
      'employee | when(/active, /salary | mul(11) | div(10))',
      'list | when(empty, ["<empty>"])',
      'value | when(eq(0), 1)'
    ],
    throws: []
  });

// `unless` — inverse of `when`, identity on truthy cond.
//
//   pipeValue | unless(cond, then)
//
// If `cond` evaluated against pipeValue is falsy, `then` is run
// against pipeValue and its result becomes the new pipeValue.
// Otherwise pipeValue passes through unchanged. Semantically
// equivalent to `when(cond | not, then)` but reads more naturally
// for guard-clause patterns.
export const unless = higherOrderOp('unless', 3,
  (pipeValue, condLambda, thenLambda) => {
    return isTruthy(condLambda(pipeValue))
      ? pipeValue
      : thenLambda(pipeValue);
  }, {
    category: 'control',
    subject: 'any',
    modifiers: ['cond sub-pipeline', 'then sub-pipeline'],
    returns: 'any (then result if cond falsy, otherwise pipeValue unchanged)',
    docs: ['One-sided conditional with implicit identity on the true branch. Inverse of when: evaluates the cond sub-pipeline against pipeValue; if falsy, evaluates the then sub-pipeline against pipeValue and returns its result. If cond is truthy, pipeValue passes through unchanged. Use for guard-clause patterns where the action only fires when the condition fails.'],
    examples: [
      'input | unless(empty, sort)',
      'config | unless(/validated, validate)',
      'result | unless(/ok, raiseAlarm)'
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

// `firstTruthy` — variadic captured sub-pipelines, returns the
// first truthy result.
//
//   pipeValue | firstTruthy(/preferredName, /firstName, "Anonymous")
//
// Symmetric with `coalesce` but checks truthiness instead of
// nil-ness. Each alternative is evaluated against pipeValue in
// order; the first one that produces a truthy value (anything
// other than nil or false) becomes the new pipeValue. If all
// alternatives produce falsy values (nil or false), the result
// is nil.
//
// **Differs from coalesce** in that `false` is also skipped:
// firstTruthy treats false as "no value", coalesce treats it as
// a real explicit setting. Note that 0, "", [], {}, #{} are
// truthy in qlang and so are NOT skipped by either operand.
//
// At least one captured arg is required.
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
  }, {
    category: 'control',
    subject: 'any',
    modifiers: ['1+ alternative sub-pipelines'],
    returns: 'any (first truthy result, or nil if all are falsy)',
    docs: ['Returns the first truthy result among the captured alternatives, evaluating each against pipeValue in order and short-circuiting on the first truthy value. Falsy values (nil and false) are skipped; non-nil non-false values (including 0, "", [], {}, #{}) are NOT skipped. If all alternatives produce falsy values, returns nil. Use for "give me anything meaningful" patterns where false is also a sentinel; use coalesce instead when false is a valid explicit setting.'],
    examples: [
      'person | firstTruthy(/preferredName, /firstName, /lastName, "Anonymous")',
      'flag | firstTruthy(/userValue, /default, false)',
      'lookup | firstTruthy(/match, /partial)'
    ],
    throws: ['FirstTruthyNoAlternatives']
  });
