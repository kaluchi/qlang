// @kaluchi/qlang-core — the package root, free of `node:*` for the
// browser, and what a host builds on; `package.json#sideEffects` keeps
// the runtime modules, which register their primitives as they load.
// The rules it holds: [QSWRK#tooling].

export { parse, ParseError } from './parse.mjs';
export { answerKindsOf } from './eval.mjs';
export { langRuntime } from './runtime/index.mjs';
export { LANGUAGE_SOURCES } from './runtime/bootstrap.mjs';
export { createSession, evalQuery } from './session.mjs';
export {
  walkAst, findAstNodeAtOffset, findNameOccurrences, writesTag, readsItsSubject,
  bindingNamesVisibleAt, builtFrom, declaresKind, CALL_SPELLING, TAG_SPELLING,
  FORK_ISOLATING_AST_TYPES
} from './walk.mjs';
export { splitAddress } from './address.mjs';
export { printValue, printQuoteSource } from './print-value.mjs';
export {
  toPlain, fromPlain, fromJsonText, StringParseJsonNumberNotFiniteError
} from './runtime/json.mjs';
export { printAnswer, elideAnswer, caretOf } from './runtime/print.mjs';
export { isNameStart, isNameContinue } from './name-chars.mjs';
export {
  keyword, isKeyword, makeTag, isTag, isErrorValue,
  bindingValueOf, makeErrorValue,
  TAG_HEADER_SYMBOL, stampTagHeader, typeOf
} from './types.mjs';
export { verbsReaching, verbNames, nodeOf, nodeAddresses, bareNameReach, residencesOf, isLabel, isVerb, declaresVerb, ruleRefusalsOf, shownFor } from './nouns.mjs';
