// Control-flow operands.
//
// A branch, a clause and an alternative is a quote the operand applies
// only when it is chosen, and the condition of `if` is a value computed
// at the call [D43]. Every quote is checked at the call, the ones never
// chosen included. A condition answers a boolean or fails at its slot
// [D14].
//
// Meta lives in lib/qlang/operand/control.qlang.

import {
  higherOrderOp,
  higherOrderOpVariadic,
  UNBOUNDED
} from './dispatch.mjs';
import { isNull, isErrorValue, typeKeyword, NULL } from '../types.mjs';
import { declareArityError, declareShapeError } from '../errors.mjs';
import { declareModifierError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { codeOfModifier } from '../eval.mjs';

const IfConditionNotBooleanError = declareModifierError('IfConditionNotBooleanError', 'if', 2, 'boolean');
const IfThenNotQuoteError        = declareModifierError('IfThenNotQuoteError',        'if', 3, 'quote');
const IfElseNotQuoteError        = declareModifierError('IfElseNotQuoteError',        'if', 4, 'quote');

// A variadic operand's refusal names the modifier by its index, from 1.
const variadicCodeRefusal = operand => ({ index, actualType }) =>
  `${operand} takes each modifier as a quote, modifier ${index} is ${actualType.name}`;
const CondClauseNotQuoteError = declareShapeError('CondClauseNotQuoteError',
  variadicCodeRefusal('cond'), { operand: 'cond', expectedType: 'quote' });
const CoalesceAlternativeNotQuoteError = declareShapeError('CoalesceAlternativeNotQuoteError',
  variadicCodeRefusal('coalesce'), { operand: 'coalesce', expectedType: 'quote' });
const CondConditionNotBooleanError = declareShapeError('CondConditionNotBooleanError',
  ({ index, actualType }) => `cond takes a boolean from each condition, the condition of modifier ${index} answered ${actualType.name}`,
  { operand: 'cond', expectedType: 'boolean' });

// The code of every modifier of a variadic operand.
async function codesOfModifiers(modifiers, subject, RefusalError) {
  const codes = [];
  for (let index = 0; index < modifiers.length; index++) {
    codes.push(await codeOfModifier(modifiers[index], subject, value =>
      new RefusalError({ index: index + 1, actualType: typeKeyword(value), actualValue: value })));
  }
  return codes;
}

const CoalesceNoAlternativesError = declareArityError('CoalesceNoAlternativesError',
  () => 'coalesce requires at least one alternative sub-pipeline',
  { operand: 'coalesce' }
);
const CondNoBranchesError = declareArityError('CondNoBranchesError',
  () => 'cond requires at least one (predicate, branch) pair plus an optional trailing default',
  { operand: 'cond' }
);

export const ifOp = higherOrderOp('if', 4,
  async (ifSubject, ifCondLambda, ifThenModifier, ifElseModifier) => {
    const ifThen = await codeOfModifier(ifThenModifier, ifSubject, v => new IfThenNotQuoteError(v));
    const ifElse = await codeOfModifier(ifElseModifier, ifSubject, v => new IfElseNotQuoteError(v));
    const ifCondition = await ifCondLambda(ifSubject);
    if (typeof ifCondition !== 'boolean') throw new IfConditionNotBooleanError(ifCondition);
    return ifCondition ? await ifThen(ifSubject) : await ifElse(ifSubject);
  });

// Returns the first alternative that resolves to a non-null,
// non-error value — both `null` (the "no value" sentinel) and
// `ErrorValue` (typically a strict-projection miss like `/missing`
// on a Map without the key) count as "skip and try next". The
// fall-back is `null` when every alternative fails or yields
// `null`. Treating ErrorValue as "try next" is what makes
// `coalesce ~(/a) ~(/b) ~("default")` continue past a missing-key error
// from `/a` — the operand's intent is "first defined value",
// strict projection turned "undefined" into an error, this catch
// restores the iteration semantics.
export const coalesce = higherOrderOpVariadic('coalesce',
  async (coalesceSubject, ...coalesceModifiers) => {
    if (coalesceModifiers.length === 0) {
      throw new CoalesceNoAlternativesError();
    }
    const coalesceLambdas = await codesOfModifiers(coalesceModifiers, coalesceSubject, CoalesceAlternativeNotQuoteError);
    for (const coalesceAlt of coalesceLambdas) {
      const coalesceVal = await coalesceAlt(coalesceSubject);
      if (isNull(coalesceVal) || isErrorValue(coalesceVal)) continue;
      return coalesceVal;
    }
    return NULL;
  }, [1, UNBOUNDED]);

export const cond = higherOrderOpVariadic('cond',
  async (condSubject, ...condModifiers) => {
    if (condModifiers.length < 2) {
      throw new CondNoBranchesError();
    }
    const condLambdas = await codesOfModifiers(condModifiers, condSubject, CondClauseNotQuoteError);
    let condIdx = 0;
    while (condIdx + 1 < condLambdas.length) {
      const condAnswer = await condLambdas[condIdx](condSubject);
      if (isErrorValue(condAnswer)) return condAnswer;
      if (typeof condAnswer !== 'boolean') {
        throw new CondConditionNotBooleanError({ index: condIdx + 1, actualType: typeKeyword(condAnswer), actualValue: condAnswer });
      }
      if (condAnswer) return await condLambdas[condIdx + 1](condSubject);
      condIdx += 2;
    }
    if (condIdx < condLambdas.length) {
      return await condLambdas[condIdx](condSubject);
    }
    return NULL;
  }, [2, UNBOUNDED]);

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
// `ifOp` is the JS-level identifier for the qlang `if` operand
// (because `if` is a JS reserved word).
bindPrim('if',          ifOp);
bindPrim('coalesce',    coalesce);
bindPrim('cond',        cond);
