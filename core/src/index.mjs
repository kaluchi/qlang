// @kaluchi/qlang-core — the package root, free of `node:*` for the
// browser, and what a host builds on; `package.json#sideEffects` keeps
// the runtime modules, which bind their primitives as they load.
// The decisions it exists for: [QSWRK#tooling].

export { parse, ParseError } from './parse.mjs';
export { evalQuery, answerKindsOf } from './eval.mjs';
export { langRuntime } from './runtime/index.mjs';
export { LANGUAGE_SOURCES } from './runtime/bootstrap.mjs';
export { createSession } from './session.mjs';
export {
  walkAst, findAstNodeAtOffset, findIdentifierOccurrences, writesTag, readsItsSubject,
  bindingNamesVisibleAt, builtFrom, declaresKind, CALL_SPELLING, TAG_SPELLING,
  FORK_ISOLATING_AST_TYPES
} from './walk.mjs';
export { splitAddress } from './address.mjs';
export { printQuoteSource } from './quote.mjs';
export {
  printValue, toPlain, fromPlain, StringParseJsonNumberNotFiniteError
} from './runtime/format.mjs';
export { printAnswer } from './runtime/print.mjs';
export { elide, alertOf, elideAnswer } from './elide.mjs';
export { tokenize } from './highlight.mjs';
export { isNameStart, isNameContinue } from './name-chars.mjs';
export {
  keyword, isKeyword, makeTag, isTag, isErrorValue,
  bindingValueOf, makeErrorValue,
  TAG_HEADER_SYMBOL, stampTagHeader, typeKeyword
} from './types.mjs';
export { shownFor } from './runtime/verb.mjs';
export { verbsReaching, verbNames, nodeOf, nodeAddresses, bareNameReach, residencesOf, isLabel, isWord, declaresWord, ruleRefusalsOf } from './runtime/nouns.mjs';
