// The keys of an env and the spelling of a tag in a refusal's facts. A
// name a declaration writes is its own key [D153]; the root, the scope
// the host's sources declared, sits under a symbol, a key no name spells,
// beneath the names a reader writes.

export const TAG_SIGIL = '::';
export const ROOT_KEY  = Symbol('qlang/root');

// A tag as a refusal's facts spell it, a string the lift into values
// reads as a tag, `::number/add`.
export function tagLiteralOf(tagName) {
  return TAG_SIGIL + tagName;
}

export function isTagLiteral(name) {
  return typeof name === 'string' && name.startsWith(TAG_SIGIL);
}

export function tagNameOfLiteral(literal) {
  return literal.slice(TAG_SIGIL.length);
}
