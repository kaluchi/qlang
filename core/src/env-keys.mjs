// The keys of an env and the spelling of a tag in a refusal's facts. A
// name a declaration writes is its own key [D152]; the export map of a
// loaded module sits under `qlang/module/<path>` and the host's
// locator under `qlang/locator`, keys the runtime keeps for itself.

export const TAG_SIGIL               = '::';
export const MODULE_KEY_PREFIX = 'qlang/module/';
export const RUNTIME_LOCATOR_KEY     = 'qlang/locator';

// The name a tag goes by: a name under the language is written short,
// `::qlang/number` the tag `::number`, since the names without a prefix
// belong to the language [D23], [D62], [D152].
const LANGUAGE_PREFIX = 'qlang/';

export function canonicalTagName(tagName) {
  return tagName.startsWith(LANGUAGE_PREFIX) ? tagName.slice(LANGUAGE_PREFIX.length) : tagName;
}

// A tag as a refusal's facts spell it, a string the lift into values
// reads as a tag, `::number/add`.
export function tagLiteralOf(tagName) {
  return TAG_SIGIL + canonicalTagName(tagName);
}

export function isTagLiteral(name) {
  return typeof name === 'string' && name.startsWith(TAG_SIGIL);
}

export function tagNameOfLiteral(literal) {
  return literal.slice(TAG_SIGIL.length);
}

// The key of a loaded module's export map.
export function moduleKey(path) {
  return MODULE_KEY_PREFIX + path;
}

export function isModuleKey(name) {
  return typeof name === 'string' && name.startsWith(MODULE_KEY_PREFIX);
}

// A key the runtime keeps for itself, a module's exports or the
// host's locator, which names no binding.
export function isRuntimeKey(name) {
  return isModuleKey(name) || name === RUNTIME_LOCATOR_KEY;
}
