// Map operands. `has` is polymorphic across Map and Set subjects
// and therefore owns three distinct error classes — one for each
// branch of the type check.
//
// Meta lives in lib/qlang/operand/mapOp.qlang.

import { nullaryOp, valueOp } from './dispatch.mjs';
import {
  keyword, isQSet, isKeyword, isQMap
} from '../types.mjs';
import { declareSubjectError, declareModifierError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { setHasStructurally } from '../equality.mjs';

const KeysSubjectNotMapError       = declareSubjectError('KeysSubjectNotMapError',       'keys', 'map');
const ValsSubjectNotMapError       = declareSubjectError('ValsSubjectNotMapError',       'vals', 'map');
const HasSubjectNotMapOrSetError   = declareSubjectError('HasSubjectNotMapOrSetError',   'has',  ['map', 'set']);
const HasKeyNotKeywordOrStringError = declareModifierError('HasKeyNotKeywordOrStringError', 'has', 2, ['keyword', 'string']);

// `keys` answers a map's keys as a Set of keywords and `vals` its
// values as a Vec.
export const keys = nullaryOp('keys', (map) => {
  if (!isQMap(map)) throw new KeysSubjectNotMapError(map);
  const result = new Set();
  for (const [k] of map) result.add(keyword(k));
  return result;
});

export const vals = nullaryOp('vals', (map) => {
  if (!isQMap(map)) throw new ValsSubjectNotMapError(map);
  const out = [];
  for (const [, v] of map) out.push(v);
  return out;
});

// `has` is a boolean lookup — no key-back-into-container roundtrip,
// so the captured-arg shape can be either Keyword or String over
// a map (both normalise to the storage-side String via `key.name`
// or identity). The `keys | first | as :k | src | has k` chain
// composes without a coercion. A Set subject
// keeps structural membership — Keyword elements compare by
// name, every other shape by ref/value.
export const has = valueOp('has', 2, (subject, key) => {
  if (isQMap(subject)) {
    let lookupKey;
    if (isKeyword(key)) lookupKey = key.name;
    else if (typeof key === 'string') lookupKey = key;
    else throw new HasKeyNotKeywordOrStringError(key);
    return subject.has(lookupKey);
  }
  if (isQSet(subject)) {
    // Structural membership mirrors `evalSetLit`'s dedup contract:
    // Keywords compare by name, Maps / Vecs / Sets / TaggedInstances
    // by structural equality (the `equality.mjs` value plane).
    // JS `Set.prototype.has` would lookup by reference identity and
    // miss freshly-built `[1 2]` / `{:a 1}` queries — composite-key
    // membership has to flow through the same primitive that built
    // the Set in the first place.
    return setHasStructurally(subject, key);
  }
  throw new HasSubjectNotMapOrSetError(subject);
});

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('keys', keys);
bindPrim('vals', vals);
bindPrim('has',  has);
