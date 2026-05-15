// Env-key namespaces.
//
// The qlang env is a flat `Map<string, value>`. Three reserved
// string prefixes carve it into namespaces so identifier resolution,
// reflective listings (`manifest`), and runtime housekeeping can
// route past each other in a single startsWith probe — the only
// substring scan the runtime tolerates on env keys, justified by
// the flat-Map model.
//
// `TAG_BINDING_PREFIX` (`::`) — tag-namespace bindings declared via
//   `::Tag {descriptor}` BindStep. The env stores them under the
//   raw `::Tag` string so a value-namespace `:foo` lookup never
//   collides with a tag-namespace identifier of the same readable
//   stem.
//
// `MODULE_AST_PREFIX` (`qlang/ast/`) — Quote-values stamping the
//   verbatim source + pre-parsed AST of every loaded module under
//   `qlang/ast/<uri>`. Axis-operands (`source`, `docs`, `examples`)
//   walk every Quote at this prefix to find a binding's originating
//   `BindStep`. `manifest` filters these out — they are storage,
//   not user-facing bindings.
//
// `MODULE_NAMESPACE_PREFIX` (`qlang/namespace/`) — exports Map of a
//   loaded namespace under `qlang/namespace/<uri>`. Re-entrant
//   `use(:uri)` calls hit this cache instead of re-fetching the
//   source. Filtered alongside module-AST keys.
//
// `RUNTIME_LOCATOR_KEY` (`qlang/locator`) — singular env key
//   holding the host's `:qlang/locator` function. Filtered because
//   the locator is platform plumbing, not addressable through
//   identifier lookup.
//
// Each prefix gets a mint-site (`<X>Key`) that composes the
// prefix + name into the env-key string, plus a check predicate
// (`is<X>Key`) that asks "does this env key sit in this namespace?".
// Pairing factory and predicate per namespace keeps the prefix
// literal a single-source-of-truth string — every consumer imports
// the helpers, never re-types `'qlang/ast/'` or `'::'`.

export const TAG_BINDING_PREFIX     = '::';
export const MODULE_AST_PREFIX      = 'qlang/ast/';
export const MODULE_NAMESPACE_PREFIX = 'qlang/namespace/';
export const RUNTIME_LOCATOR_KEY    = 'qlang/locator';

// Tag-binding env-key mint and probes ──────────────────────────

// tagBindingKey(tagName) — `::Tag` env-lookup key from a raw tag
// name. The single mint site every reader that probes env for a
// tag binding uses. Renderers should pull the same literal off the
// TagKeyword value's `.literal` field (set once at TagKeyword
// construction in `types.mjs::makeTagKeyword`).
export function tagBindingKey(tagName) {
  return TAG_BINDING_PREFIX + tagName;
}

export function isTagBindingName(name) {
  return typeof name === 'string' && name.startsWith(TAG_BINDING_PREFIX);
}

export function stripTagBindingPrefix(envKey) {
  return envKey.slice(TAG_BINDING_PREFIX.length);
}

// Module-AST storage mint and probe ────────────────────────────

export function moduleAstKey(uri) {
  return MODULE_AST_PREFIX + uri;
}

export function isModuleAstKey(name) {
  return typeof name === 'string' && name.startsWith(MODULE_AST_PREFIX);
}

// Namespace-exports cache mint and probe ──────────────────────

export function moduleNamespaceKey(uri) {
  return MODULE_NAMESPACE_PREFIX + uri;
}

export function isModuleNamespaceKey(name) {
  return typeof name === 'string' && name.startsWith(MODULE_NAMESPACE_PREFIX);
}
