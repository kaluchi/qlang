// @kaluchi/qlang-core — the package root, free of `node:*` for the
// browser, and what a host builds on; `package.json#sideEffects` keeps
// the runtime modules, which bind their primitives as they load.

export { parse, ParseError } from './parse.mjs';
export { evalQuery } from './eval.mjs';
export { langRuntime } from './runtime/index.mjs';
export { createSession } from './session.mjs';
export {
  walkAst, findAstNodeAtOffset, findIdentifierOccurrences, writesTag,
  bindingNamesVisibleAt, VALUE_NAMESPACE, TAG_NAMESPACE,
  FORK_ISOLATING_AST_TYPES
} from './walk.mjs';
export { printQuoteSource } from './quote.mjs';
export { decorateAstWithEffectMarkers } from './effect-check.mjs';
export {
  printValue, toPlain, fromPlain, FromPlainNumberNotFiniteError
} from './runtime/format.mjs';
export { printAnswer } from './runtime/print.mjs';
export { elide, elideAnswer } from './elide.mjs';
export { tokenize } from './highlight.mjs';
export { isNameStart, isNameContinue } from './name-chars.mjs';
export { QlangTypeError } from './errors.mjs';
export {
  keyword, isKeyword, makeTagKeyword, isTagKeyword, isErrorValue,
  isVerb, bindingValueOf, makeErrorValue, errorFromKindDescriptor,
  TAG_HEADER_SYMBOL, stampTagHeader, typeKeyword
} from './types.mjs';
export {
  signatureSpecOf, slotLabelsOf, verbShownFor
} from './runtime/verb.mjs';
export { verbsReaching } from './runtime/nouns.mjs';
export {
  RUNTIME_LOCATOR_KEY, isTagBindingName, isModuleNamespaceKey,
  tagBindingKey, canonicalTagName
} from './env-keys.mjs';
