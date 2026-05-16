// Shared shape helpers for builtin descriptor Maps.
//
// A "raw" builtin descriptor is what the env Map stores after
// `langRuntime` bootstrap: `{:kind :builtin :impl
// <FunctionValue> :category … :subject … …}`. Several consumers
// need to project the user-facing reify-shape from it (strip
// internals, stamp display fields) without going through the full
// reify dispatch path:
//
//   * `eval.mjs::applyBuiltinDescriptor` — bare non-nullary lookup
//     returns the reify-shape as the new pipeValue, matching the
//     reify(:name) output for the same binding.
//
//   * `runtime/reify-op.mjs::describeBinding` — both `reify` and
//     `manifest` route every value-namespace builtin through here.
//
// Living in a third-party module keeps the dependency edge
// directed: eval.mjs and reify-op.mjs both import this file,
// neither depends on the other for this purpose.

import { keyword } from './types.mjs';

// reifyBuiltinDescriptor(rawDescriptor, implFn, name?) → Map
//
// Builds a user-facing reify-shape descriptor from a raw env
// descriptor. Strips internal :kind and :impl, stamps
// :kind :builtin plus :captured and :effectful read from the
// resolved function value.
export function reifyBuiltinDescriptor(rawDescriptor, implFn, name) {
  const reified = new Map();
  reified.set('kind', keyword('builtin'));
  if (name != null) reified.set('name', name);
  for (const [fieldKey, fieldVal] of rawDescriptor) {
    if (fieldKey === 'kind' || fieldKey === 'impl') continue;
    reified.set(fieldKey, fieldVal);
  }
  reified.set('captured', [...implFn.meta.captured]);
  reified.set('effectful', implFn.effectful);
  return reified;
}
