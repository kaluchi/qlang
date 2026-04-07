// Reflective built-ins — operands that live on the state level
// instead of the value level.
//
// Both `env` and `use` read or write the full state pair, so
// they are built with `stateOp` (raw state transformer, no
// pipeValue extraction or result wrapping). Semantically they
// are ordinary entries in langRuntime; syntactically they are
// ordinary identifiers. They can be shadowed by `let` or `as`
// like any other name — the "reflectiveness" is a property of
// the value bound to the name, not of the grammar.

import { stateOp } from './dispatch.mjs';
import { makeState, withPipeValue, envMerge } from '../state.mjs';
import { isQMap, describeType } from '../types.mjs';
import { declareSubjectError } from './operand-errors.mjs';

const UseSubjectNotMap = declareSubjectError('UseSubjectNotMap', 'use', 'Map');

// env — replaces pipeValue with the current env Map. Inside a
// fork, returns the fork's current env (including any local `as`
// or `let` writes visible at this point).
export const env = stateOp('env', 1, (state, _lambdas) =>
  withPipeValue(state, state.env));

// use — merges the current pipeValue (a Map) into env. Returns
// a new state with the enlarged env; pipeValue is unchanged so
// the caller can chain further. Inside a paren-group / Vec /
// Map / Set fork the merged bindings evaporate when the fork
// closes, matching the documented fork rule.
export const use = stateOp('use', 1, (state, _lambdas) => {
  if (!isQMap(state.pipeValue)) {
    throw new UseSubjectNotMap(describeType(state.pipeValue), state.pipeValue);
  }
  return makeState(state.pipeValue, envMerge(state.env, state.pipeValue));
});
