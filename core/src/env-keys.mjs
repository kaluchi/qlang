// The keys of an env. A name a declaration writes is its own key; a tag
// binding is keyed `::Tag`, so a tag and a name of one stem never meet;
// the export map of a loaded module sits under `qlang/namespace/<name>`
// and the host's locator under `qlang/locator`, keys the runtime keeps
// for itself. Each prefix has one mint and one probe below.

export const TAG_BINDING_PREFIX     = '::';
export const MODULE_NAMESPACE_PREFIX = 'qlang/namespace/';
export const RUNTIME_LOCATOR_KEY    = 'qlang/locator';

// The name a tag goes by: a name under the core's noun is written short,
// `::qlang/number` the tag `::number`, since the names without a prefix
// belong to the core [D23], [D62].
const CORE_NOUN_PREFIX = 'qlang/';

export function canonicalTagName(tagName) {
  return tagName.startsWith(CORE_NOUN_PREFIX) ? tagName.slice(CORE_NOUN_PREFIX.length) : tagName;
}

// The key of a tag's binding, from its name written short or long.
export function tagBindingKey(tagName) {
  return TAG_BINDING_PREFIX + canonicalTagName(tagName);
}

export function isTagBindingName(name) {
  return typeof name === 'string' && name.startsWith(TAG_BINDING_PREFIX);
}

export function stripTagBindingPrefix(envKey) {
  return envKey.slice(TAG_BINDING_PREFIX.length);
}

// The key of a loaded module's export map.

export function moduleNamespaceKey(uri) {
  return MODULE_NAMESPACE_PREFIX + uri;
}

export function isModuleNamespaceKey(name) {
  return typeof name === 'string' && name.startsWith(MODULE_NAMESPACE_PREFIX);
}

// A key the runtime keeps for itself, a module's exports or the
// host's locator, which names no binding.
export function isRuntimeKey(name) {
  return isModuleNamespaceKey(name) || name === RUNTIME_LOCATOR_KEY;
}
