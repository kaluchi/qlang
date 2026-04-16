// Map operands. `has` is polymorphic across Map and Set subjects
// and therefore owns three distinct error classes — one for each
// branch of the type check.
//
// Map-entry matchers `byKey` / `byValue` live here alongside the
// Map-subject operands: they project the entry pair-Map that
// polymorphic `filter` / `every` / `any` construct per-entry when
// the container subject is a Map. The pair-Map uses namespaced
// `:qlang/key` / `:qlang/value` fields so user domain keys never
// collide — the qlang/ namespace is reserved for internal shape
// (see :qlang/kind, :qlang/impl, :qlang/body, :qlang/envRef in
// descriptor Maps).
//
// `kwName` lifts a Keyword's name to String — required for
// key-pattern filtering via `byKey(kwName | startsWith("..."))`
// and generally useful whenever a qlang pipeline needs to
// compare, render, or project a keyword's identifier text.
//
// Meta lives in lib/qlang/core.qlang.

import { nullaryOp, valueOp, higherOrderOp } from './dispatch.mjs';
import { isQMap, isQSet, isKeyword, describeType, keyword } from '../types.mjs';
import {
  declareSubjectError,
  declareModifierError,
  declareShapeError
} from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

// Namespaced entry-pair field keys — interned once, matching the
// KW_* convention in types.mjs / eval.mjs / intro.mjs. The pair-
// Map that polymorphic filter/every/any constructs per-entry
// carries these two fields; `byKey` / `byValue` project through
// them without the user having to spell `:qlang/key` at the
// filter call site.
export const KW_QLANG_KEY   = keyword('qlang/key');
export const KW_QLANG_VALUE = keyword('qlang/value');

const KeysSubjectNotMap    = declareSubjectError('KeysSubjectNotMap',    'keys',  'Map');
const ValsSubjectNotMap    = declareSubjectError('ValsSubjectNotMap',    'vals',  'Map');
const HasSubjectNotMapOrSet = declareSubjectError('HasSubjectNotMapOrSet', 'has',   'Map or Set');
const HasKeyNotKeyword     = declareModifierError('HasKeyNotKeyword',    'has',   2, 'Keyword (Map subject)');
const KwNameSubjectNotKeyword = declareSubjectError('KwNameSubjectNotKeyword', 'kwName', 'Keyword');

const ByKeySubjectNotMap = declareSubjectError('ByKeySubjectNotMap', 'byKey', 'Map');
const ByKeyMapNotFilterPair = declareShapeError('ByKeyMapNotFilterPair',
  ({ actualKeys }) =>
    `byKey requires a filter-constructed entry pair Map carrying :qlang/key; got Map with keys ${actualKeys}. byKey is a matcher for polymorphic filter/every/any over a Map container — it cannot be invoked on a user-constructed Map directly.`);

const ByValueSubjectNotMap = declareSubjectError('ByValueSubjectNotMap', 'byValue', 'Map');
const ByValueMapNotFilterPair = declareShapeError('ByValueMapNotFilterPair',
  ({ actualKeys }) =>
    `byValue requires a filter-constructed entry pair Map carrying :qlang/value; got Map with keys ${actualKeys}. byValue is a matcher for polymorphic filter/every/any over a Map container — it cannot be invoked on a user-constructed Map directly.`);

export const keys = nullaryOp('keys', (map) => {
  if (!isQMap(map)) throw new KeysSubjectNotMap(describeType(map), map);
  const result = new Set();
  for (const k of map.keys()) result.add(k);
  return result;
});

export const vals = nullaryOp('vals', (map) => {
  if (!isQMap(map)) throw new ValsSubjectNotMap(describeType(map), map);
  return [...map.values()];
});

export const has = valueOp('has', 2, (subject, key) => {
  if (isQMap(subject)) {
    if (!isKeyword(key)) throw new HasKeyNotKeyword(describeType(key), key);
    return subject.has(key);
  }
  if (isQSet(subject)) return subject.has(key);
  throw new HasSubjectNotMapOrSet(describeType(subject), subject);
});

// kwName — Keyword → String (the keyword's identifier name).
// Complements byKey(kwName | ...) key-pattern filtering: a pair-
// Map's :qlang/key is a keyword, but string-oriented predicates
// (startsWith, contains, endsWith, eq against a literal String)
// need the name text. `kwName` is the one-hop lift.
export const kwName = nullaryOp('kwName', (subject) => {
  if (!isKeyword(subject)) throw new KwNameSubjectNotKeyword(describeType(subject), subject);
  return subject.name;
});

// describeKeyList — render the keys of an offending user-Map as a
// comma-separated `:name` list for the byKey/byValue diagnostic.
// Keeps the error message self-sufficient for a reader who has
// the `!|` descriptor in hand but not the original subject. qlang
// Map keys are always keywords by contract, so no isKeyword
// fallback — if a JS-level embedder bypassed the contract the
// message degrades to a `:undefined` token, which is the
// diagnostic the ill-formed subject deserves.
function describeKeyList(mapSubject) {
  if (mapSubject.size === 0) return '(empty Map)';
  const parts = [];
  for (const mapKey of mapSubject.keys()) {
    parts.push(':' + mapKey.name);
  }
  return parts.join(', ');
}

// byKey(innerPred) — higher-order matcher. Subject is the entry
// pair-Map polymorphic filter/every/any constructs per-entry when
// the container is a Map. Projects :qlang/key, fires innerPred
// against it. Returns whatever innerPred returned (the caller
// truthifies). Two throw sites:
//
//   ByKeySubjectNotMap — subject is a scalar / Vec / Set / function,
//     not a Map. Indicates byKey was invoked outside a Map-filter
//     pred context (e.g. directly on pipeValue).
//
//   ByKeyMapNotFilterPair — subject is a Map but lacks the
//     namespaced :qlang/key field. Indicates byKey was invoked on
//     a user Map rather than on a filter-constructed pair-Map.
export const byKey = higherOrderOp('byKey', 2, async (pair, innerLambda) => {
  if (!isQMap(pair)) {
    throw new ByKeySubjectNotMap(describeType(pair), pair);
  }
  if (!pair.has(KW_QLANG_KEY)) {
    throw new ByKeyMapNotFilterPair({ actualKeys: describeKeyList(pair) });
  }
  return await innerLambda(pair.get(KW_QLANG_KEY));
});

// byValue(innerPred) — symmetric matcher projecting the entry's
// :qlang/value. Dispatch and diagnostics mirror byKey.
export const byValue = higherOrderOp('byValue', 2, async (pair, innerLambda) => {
  if (!isQMap(pair)) {
    throw new ByValueSubjectNotMap(describeType(pair), pair);
  }
  if (!pair.has(KW_QLANG_VALUE)) {
    throw new ByValueMapNotFilterPair({ actualKeys: describeKeyList(pair) });
  }
  return await innerLambda(pair.get(KW_QLANG_VALUE));
});

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/keys'),    keys);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/vals'),    vals);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/has'),     has);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/kwName'),  kwName);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/byKey'),   byKey);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/byValue'), byValue);
