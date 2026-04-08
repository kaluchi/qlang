// Effect-marker classification — single source of truth for the
// surface convention that side-effectful identifiers carry the
// `@` prefix in qlang source. The character literal lives in this
// file only; every other module reads the structured `.effectful`
// boolean field that this module computes from a name string.
//
// Convention rationale: qlang's host runtime exposes I/O-bound
// operands (`@callers`, `@refs`, `@hierarchy`, etc.) under names
// that visibly carry the side effect. The propagation rule —
// enforced by src/effect-check.mjs at parse time and by
// src/eval.mjs at call resolution time — is one-directional:
//
//   pure body  + clean name        → OK
//   pure body  + @-name            → OK (over-approximation, harmless)
//   effectful body + @-name        → OK
//   effectful body + clean name    → REJECTED (effect laundering)
//
// Performance note: `classifyEffect` is the only function in the
// runtime that inspects the source-token character of a name. It
// runs at:
//   - parse-time effect decoration (once per OperandCall, LetStep,
//     AsStep, Projection node — i.e. once per identifier in source)
//   - function-value construction (once per langRuntime registration)
//   - thunk/snapshot construction (once per `let`/`as` evaluation)
//
// The result is stored as a precomputed boolean on every node and
// runtime value. The hot path — eval.mjs::evalOperandCall — reads
// `resolved.effectful` and `classifyEffect(name)` only on the call
// resolution branch, not on every step of every pipeline. There is
// no substring inspection inside any loop body or fork iteration.

export const EFFECT_MARKER_PREFIX = '@';

// classifyEffect(name) → boolean
//
// True iff `name` is a string carrying the effect-marker prefix.
// Tolerates non-string input (returns false) so callers can pass
// thunk.name, function.name, or any other field that may be null
// without an extra defensive check at the call site.
export function classifyEffect(name) {
  return typeof name === 'string' && name.startsWith(EFFECT_MARKER_PREFIX);
}
