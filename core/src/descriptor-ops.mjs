// Shared shape primitives for builtin descriptor Maps.
//
// A raw builtin descriptor is what the env Map stores after
// `langRuntime` bootstrap: a Map carrying `:impl <FunctionValue>
// :category … :subject … :captured [min max] :effectful <boolean>`
// fields, with identity (`::builtin`) on the Map's JS-header
// `TAG_HEADER_SYMBOL` slot (stamped by the `::builtin{…}`
// constructor in `runtime/tagged.mjs`). The reader sites
// (`isBuiltinDescriptor` in `eval.mjs`, `runtime/use-op.mjs`
// snapshot-unwrap) probe the header — no `:kind` field on the
// raw env entry.
//
// `stampStructuralFacts(descriptor, fn)` is the single mint-site
// that backfills `:impl` / `:captured` / `:effectful` from a
// resolved function value plus the empty-fallback Vec for
// `:modifiers` / `:throws`. Both bootstrap surfaces — the
// langRuntime core-catalog pass in `runtime/index.mjs` and the
// `use`-locator namespace-resolution pass in `runtime/use-op.mjs`
// — go through here, so env entries carry the full runtime shape
// uniformly and the `spec` axis can return them without further
// projection.
//
// `manifestBuiltinDescriptor` wraps the raw form for the `manifest`
// reflective operand in `runtime/manifest-op.mjs`: it stamps the
// `:kind ::builtin` field as an explicit enum-bucket on the view-
// Map (the only place `:kind` lives as a field — identity itself
// stays on the header), adds a `:name` field, drops `:impl` (the
// resolved function value is dispatch-time internal — manifest's
// enumeration surface stays JSON-renderable), and passes every
// other structural fact through. Lives here so the projection
// edge is single-sourced; any future surface that wants the same
// manifest shape imports it without dragging `manifest-op.mjs`
// into the graph.

import { BUILTIN_TAG } from './types.mjs';

// stampStructuralFacts(descriptor, fn) → descriptor (mutated in place)
//
// Mint-site shared between every site that resolves a `::builtin{
// :impl :qlang/prim/<name>}` descriptor against a JS function
// value: swaps `:impl` for the callable, stamps `:captured` /
// `:effectful` straight off the resolved function's meta, and
// backfills empty `:modifiers` / `:throws` Vecs when the catalog
// author omitted them. The descriptor Map is a freshly-built
// JS-layer construction-site value at this point (still inside
// the bootstrap fill loop, not yet observable via any other env
// key), so direct `.set` ceremony is the qlang-side equivalent
// of stamping a fresh value at the factory boundary.
export function stampStructuralFacts(descriptor, fn) {
  descriptor.set('impl', fn);
  descriptor.set('captured', [...fn.meta.captured]);
  descriptor.set('effectful', fn.effectful);
  if (!descriptor.has('modifiers')) descriptor.set('modifiers', Object.freeze([]));
  if (!descriptor.has('throws'))    descriptor.set('throws',    Object.freeze([]));
  return descriptor;
}

// manifestBuiltinDescriptor(rawDescriptor, name?) → Map
//
// Builds the manifest-shape descriptor from a raw env descriptor.
// Strips internal `:impl`, stamps `:kind ::builtin` as an explicit
// enum-bucket field (so `manifest | filter(/kind | eq(::builtin))`
// partitions identically to `manifest | filter(type | eq(::builtin))`
// — the field is the view-Map's plain-JSON projection of the
// identity that rides on the env entry's JS-header slot), and
// copies every structural fact through (`:captured` / `:effectful`
// / `:category` / `:subject` / `:modifiers` / `:returns` /
// `:throws`, all stamped on the env entry at bootstrap).
export function manifestBuiltinDescriptor(rawDescriptor, name) {
  const result = new Map();
  result.set('kind', BUILTIN_TAG);
  if (name != null) result.set('name', name);
  for (const [fieldKey, fieldVal] of rawDescriptor) {
    if (fieldKey === 'impl') continue;
    result.set(fieldKey, fieldVal);
  }
  return result;
}
