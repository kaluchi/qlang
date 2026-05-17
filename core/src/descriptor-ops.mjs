// Shared shape helpers for builtin descriptor Maps.
//
// A "raw" builtin descriptor is what the env Map stores after
// `langRuntime` bootstrap: `{:kind :builtin :impl
// <FunctionValue> :category … :subject … …}`. The `reify` /
// `manifest` reflective operands in `runtime/reify-op.mjs`
// project a user-facing shape from this raw form (strip internals,
// stamp display fields). `reifyBuiltinDescriptor` lives here
// rather than next to its consumer so the dependency edge stays
// single-sourced — any future user-facing descriptor surface that
// wants the same projection imports from here without dragging
// `reify-op.mjs` into the graph.

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
