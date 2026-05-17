// Shared shape helpers for builtin descriptor Maps.
//
// A raw builtin descriptor is what the env Map stores after
// `langRuntime` bootstrap: `{:kind ::builtin :impl <FunctionValue>
// :category … :subject … :captured [min max] :effectful <boolean>}`.
// The bootstrap impl-resolution pass in `runtime/index.mjs`
// backfills `:captured` and `:effectful` from the resolved function
// value at the same site it swaps the `:impl` keyword for the
// callable, so env entries carry the full runtime shape and the
// `spec` axis can return them without further projection.
//
// The `manifest` reflective operand in `runtime/manifest-op.mjs`
// wraps the raw form with a `:name` field and drops `:impl` (the
// resolved function value is dispatch-time internal — manifest's
// enumeration surface stays JSON-renderable). `manifestBuiltinDescriptor`
// lives here so the projection edge is single-sourced — any future
// surface that wants the same manifest shape imports it without
// dragging `manifest-op.mjs` into the graph.

import { makeTagKeyword } from './types.mjs';

// manifestBuiltinDescriptor(rawDescriptor, name?) → Map
//
// Builds the manifest-shape descriptor from a raw env descriptor.
// Strips internal `:impl`, re-stamps `:kind ::builtin` (TagKeyword,
// matching the env-side shape so `manifest | first | type` reads
// `::builtin` identically to `env | /:name | type`), copies every
// other field through (including `:captured` / `:effectful` /
// `:category` / `:subject` / `:modifiers` / `:returns` / `:throws`,
// all stamped on the env entry at bootstrap).
export function manifestBuiltinDescriptor(rawDescriptor, name) {
  const result = new Map();
  result.set('kind', makeTagKeyword('builtin'));
  if (name != null) result.set('name', name);
  for (const [fieldKey, fieldVal] of rawDescriptor) {
    if (fieldKey === 'kind' || fieldKey === 'impl') continue;
    result.set(fieldKey, fieldVal);
  }
  return result;
}
