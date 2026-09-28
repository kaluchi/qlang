// @kaluchi/qlang-core — the package root, free of `node:*` for the
// browser; the `host/` subpaths, which import it, stay out, and
// `package.json#sideEffects` keeps the runtime modules, which bind their
// primitives as they load.

import { parse, ParseError } from './parse.mjs';
import { evalAst, evalQuery } from './eval.mjs';
import { langRuntime } from './runtime/index.mjs';
import { signatureSpecOf, slotLabelsOf, verbShownFor } from './runtime/verb.mjs';
import { verbsReaching } from './runtime/nouns.mjs';
import { printAnswer } from './runtime/codeAsData.mjs';
import { elide, elideAnswer } from './elide.mjs';
import { createSession } from './session.mjs';
import {
  walkAst,
  astChildrenOf,
  isPureLiteralAst,
  assignAstNodeIds,
  attachAstParents,
  findAstNodeAtOffset,
  findIdentifierOccurrences,
  writesTag,
  bindingNamesVisibleAt,
  VALUE_NAMESPACE,
  TAG_NAMESPACE,
  FORK_ISOLATING_AST_TYPES,
  astNodeSpan,
  astNodeContainsOffset,
  triviaBetweenAstNodes
} from './walk.mjs';
import { quoteOfSource, printQuoteSource, astOfQuote } from './quote.mjs';
import {
  decorateAstWithEffectMarkers,
  findFirstEffectfulIdentifier
} from './effect-check.mjs';
import {
  printValue, toPlain, fromPlain, FromPlainNumberNotFiniteError
} from './runtime/format.mjs';
import { tokenize } from './highlight.mjs';
import {
  QlangError,
  QlangTypeError,
  ArityError,
  NumericDomainError,
  UnresolvedIdentifierError,
  EffectLaunderingError,
  EffectLaunderingAtBindStepParseError,
  EffectLaunderingAtCallError,
  EvaluationDepthExceededError,
  QlangInvariantError
} from './errors.mjs';
import { DivisionByZeroError } from './runtime/arith.mjs';
import { EVAL_DEPTH_LIMIT } from './state.mjs';
import { classifyEffect, EFFECT_MARKER_PREFIX } from './effect.mjs';
import {
  keyword,
  isKeyword,
  makeTagKeyword,
  isTagKeyword,
  isErrorValue,
  isQuote,
  isDoc,
  isVerb,
  bindingValueOf,
  makeErrorValue,
  errorFromKindDescriptor,
  makeQuote,
  makeDoc,
  TAG_HEADER_SYMBOL,
  stampTagHeader,
  makeTaggedInstance,
  BUILTIN_TAG,
  ERROR_TAG,
  PARSE_ERROR_TAG,
  BINDING_TAG,
  TAG_BINDING_TAG,
  describeType,
  typeKeyword
} from './types.mjs';
import {
  TAG_BINDING_PREFIX,
  MODULE_NAMESPACE_PREFIX,
  RUNTIME_LOCATOR_KEY,
  isTagBindingName,
  isModuleNamespaceKey,
  moduleNamespaceKey,
  tagBindingKey,
  canonicalTagName,
  stripTagBindingPrefix
} from './env-keys.mjs';

export {
  parse,
  ParseError,
  evalAst,
  evalQuery,
  langRuntime,
  createSession,
  walkAst,
  astChildrenOf,
  isPureLiteralAst,
  assignAstNodeIds,
  attachAstParents,
  findAstNodeAtOffset,
  findIdentifierOccurrences,
  writesTag,
  bindingNamesVisibleAt,
  VALUE_NAMESPACE,
  TAG_NAMESPACE,
  FORK_ISOLATING_AST_TYPES,
  astNodeSpan,
  astNodeContainsOffset,
  triviaBetweenAstNodes,
  quoteOfSource,
  printQuoteSource,
  astOfQuote,
  decorateAstWithEffectMarkers,
  findFirstEffectfulIdentifier,
  printValue,
  printAnswer,
  elide,
  elideAnswer,
  toPlain,
  fromPlain,
  FromPlainNumberNotFiniteError,
  tokenize,
  QlangError,
  QlangTypeError,
  ArityError,
  NumericDomainError,
  UnresolvedIdentifierError,
  DivisionByZeroError,
  EffectLaunderingError,
  EffectLaunderingAtBindStepParseError,
  EffectLaunderingAtCallError,
  EvaluationDepthExceededError,
  QlangInvariantError,
  EVAL_DEPTH_LIMIT,
  classifyEffect,
  EFFECT_MARKER_PREFIX,
  keyword,
  isKeyword,
  makeTagKeyword,
  isTagKeyword,
  isErrorValue,
  isQuote,
  isDoc,
  isVerb,
  bindingValueOf,
  makeErrorValue,
  errorFromKindDescriptor,
  makeQuote,
  makeDoc,
  TAG_HEADER_SYMBOL,
  stampTagHeader,
  makeTaggedInstance,
  BUILTIN_TAG,
  ERROR_TAG,
  PARSE_ERROR_TAG,
  BINDING_TAG,
  TAG_BINDING_TAG,
  describeType,
  typeKeyword,
  signatureSpecOf,
  slotLabelsOf,
  verbShownFor,
  verbsReaching,
  TAG_BINDING_PREFIX,
  MODULE_NAMESPACE_PREFIX,
  RUNTIME_LOCATOR_KEY,
  isTagBindingName,
  isModuleNamespaceKey,
  moduleNamespaceKey,
  tagBindingKey,
  canonicalTagName,
  stripTagBindingPrefix
};
