// @kaluchi/qlang — public entry point.
//
// Re-exports the full embedder surface so consumers can import
// everything they need from the package root. Subpath imports
// (`@kaluchi/qlang/walk`, `@kaluchi/qlang/session`, `@kaluchi/qlang/codec`,
// `@kaluchi/qlang/errors`, `@kaluchi/qlang/parse`, `@kaluchi/qlang/eval`,
// `@kaluchi/qlang/runtime`) remain available through the package.json
// exports map for tree-shaking-sensitive bundles. The package declares
// `sideEffects: false` so unused subpaths drop out.
//
// Surface groups:
//   parse / evaluate           — parse, evalAst, evalQuery, langRuntime
//   session lifecycle          — createSession, serializeSession,
//                                deserializeSession
//   AST traversal              — walkAst, astChildrenOf,
//                                findAstNodeAtOffset,
//                                findIdentifierOccurrences,
//                                bindingNamesVisibleAt,
//                                astNodeSpan, astNodeContainsOffset,
//                                triviaBetweenAstNodes
//   value codec                — toTaggedJSON, fromTaggedJSON
//   error hierarchy            — QlangError, QlangTypeError, ArityError,
//                                UnresolvedIdentifierError,
//                                DivisionByZeroError, ParseError,
//                                EffectLaunderingError,
//                                EffectLaunderingAtLetParse,
//                                EffectLaunderingAtCall,
//                                QlangInvariantError
//   effect-marker classification — classifyEffect, EFFECT_MARKER_PREFIX
//   keyword interning          — keyword (every call with the same name
//                                returns the same interned object, so
//                                a Map keyed by qlang keywords is
//                                lookable from JS via `m.get(keyword(name))`)

import { parse, ParseError } from './parse.mjs';
import { evalAst, evalQuery } from './eval.mjs';
import { langRuntime } from './runtime/index.mjs';
import {
  createSession,
  serializeSession,
  deserializeSession
} from './session.mjs';
import {
  walkAst,
  astChildrenOf,
  assignAstNodeIds,
  attachAstParents,
  findAstNodeAtOffset,
  findIdentifierOccurrences,
  bindingNamesVisibleAt,
  FORK_ISOLATING_AST_TYPES,
  astNodeSpan,
  astNodeContainsOffset,
  triviaBetweenAstNodes,
  astNodeToMap,
  qlangMapToAst
} from './walk.mjs';
import {
  decorateAstWithEffectMarkers,
  findFirstEffectfulIdentifier
} from './effect-check.mjs';
import { toTaggedJSON, fromTaggedJSON } from './codec.mjs';
import { printValue } from './runtime/format.mjs';
import {
  QlangError,
  QlangTypeError,
  ArityError,
  UnresolvedIdentifierError,
  DivisionByZeroError,
  EffectLaunderingError,
  EffectLaunderingAtLetParse,
  EffectLaunderingAtCall,
  QlangInvariantError
} from './errors.mjs';
import { classifyEffect, EFFECT_MARKER_PREFIX } from './effect.mjs';
import {
  keyword,
  isErrorValue,
  makeErrorValue,
  appendTrailNode,
  materializeTrail
} from './types.mjs';

export {
  parse,
  ParseError,
  evalAst,
  evalQuery,
  langRuntime,
  createSession,
  serializeSession,
  deserializeSession,
  walkAst,
  astChildrenOf,
  assignAstNodeIds,
  attachAstParents,
  findAstNodeAtOffset,
  findIdentifierOccurrences,
  bindingNamesVisibleAt,
  FORK_ISOLATING_AST_TYPES,
  astNodeSpan,
  astNodeContainsOffset,
  triviaBetweenAstNodes,
  astNodeToMap,
  qlangMapToAst,
  decorateAstWithEffectMarkers,
  findFirstEffectfulIdentifier,
  toTaggedJSON,
  fromTaggedJSON,
  printValue,
  QlangError,
  QlangTypeError,
  ArityError,
  UnresolvedIdentifierError,
  DivisionByZeroError,
  EffectLaunderingError,
  EffectLaunderingAtLetParse,
  EffectLaunderingAtCall,
  QlangInvariantError,
  classifyEffect,
  EFFECT_MARKER_PREFIX,
  keyword,
  isErrorValue,
  makeErrorValue,
  appendTrailNode,
  materializeTrail
};
