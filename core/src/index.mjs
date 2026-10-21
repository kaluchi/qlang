// @kaluchi/qlang-core — the package root, free of `node:*` for the
// browser, and what a host builds on; `package.json#sideEffects` keeps
// the runtime modules, which register their primitives as they load.
// The rules it holds: [QSWRK#tooling].

export { parse, ParseError } from './parse.mjs';
export { langRuntime } from './runtime/index.mjs';
export { LANGUAGE_SOURCES } from './runtime/bootstrap.mjs';
export { createSession, evalQuery } from './session.mjs';
export {
  partOf, walkParts, partAtOffset, findNameOccurrences, tagWrittenBy, tagHeadEnd, readsItsSubject,
  bindingNamesVisibleAt, CALL_SPELLING, TAG_SPELLING
} from './walk.mjs';
export { isCallStep, isBindStep, isGroupStep, isFailStep, holdsALiteral, declaresKind } from './steps.mjs';
export { isVerbBody } from './chain.mjs';
export { splitAddress } from './address.mjs';
export { printValue } from './print-value.mjs';
export { kindsExpected } from './ordering.mjs';
export { toPlain, fromPlain, fromJsonText } from './runtime/json.mjs';
export { printAnswer, boundAnswer, caretOf } from './runtime/print.mjs';
export { ANSWER_BUDGET } from './elide.mjs';
export { readingState } from './primitives.mjs';
export { isNameStart, isNameContinue, NAME_REGEX } from './name-chars.mjs';
export { keyword, isKeyword, makeTag, isTag, isErrorValue, makeErrorValue, typeOf } from './types.mjs';
export {
  verbsReaching, verbNames, nodeOf, nodeAddresses, bareNameReach, residencesOf, isLabel, isVerb, declaresVerb, ruleRefusalsOf,
  shownFor, answerKindsOf, kindsOfWalk
} from './nouns.mjs';
export { servesTheSubject } from './dispatch.mjs';
