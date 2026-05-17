// Shared shape helpers for builtin descriptor Maps.
//
// A raw builtin descriptor is what the env Map stores after
// `langRuntime` bootstrap: `{:kind ::builtin :impl <FunctionValue>
// :category … :subject … …}`. The `manifest` reflective operand in
// `runtime/manifest-op.mjs` projects a user-facing shape from this
// raw form (strip internals, stamp display fields).
// `manifestBuiltinDescriptor` lives here so the projection edge is
// single-sourced — any future surface that wants the same manifest
// shape imports it without dragging `manifest-op.mjs` into the graph.

import { keyword } from './types.mjs';

// manifestBuiltinDescriptor(rawDescriptor, implFn, name?) → Map
//
// Builds the manifest-shape descriptor from a raw env descriptor.
// Strips internal `:kind` and `:impl`, stamps `:kind :builtin` (plain
// Keyword for the user-facing surface) plus `:captured` and
// `:effectful` read from the resolved function value.
export function manifestBuiltinDescriptor(rawDescriptor, implFn, name) {
  const result = new Map();
  result.set('kind', keyword('builtin'));
  if (name != null) result.set('name', name);
  for (const [fieldKey, fieldVal] of rawDescriptor) {
    if (fieldKey === 'kind' || fieldKey === 'impl') continue;
    result.set(fieldKey, fieldVal);
  }
  result.set('captured', [...implFn.meta.captured]);
  result.set('effectful', implFn.effectful);
  return result;
}
