// Value type predicates and shape helpers.
//
// The language has four value types — Scalar, Vec, Map, Set — plus
// functions. JavaScript representations:
//
//   Scalar     → number, string, boolean, null (for nil)
//                Keywords are { type: 'keyword', name: string }
//   Vec        → JS Array
//   Map        → JS Map (insertion-ordered, keys are keyword objects)
//   Set        → JS Set
//   Function   → JS function with metadata fields
//   Thunk      → { type: 'thunk', expr, capturedAt }  (for `let`)

export const NIL = null;

export function isNil(v) { return v === null || v === undefined; }
export function isBoolean(v) { return typeof v === 'boolean'; }
export function isNumber(v) { return typeof v === 'number'; }
export function isString(v) { return typeof v === 'string'; }
export function isKeyword(v) { return v !== null && typeof v === 'object' && v.type === 'keyword'; }
export function isVec(v) { return Array.isArray(v); }
export function isQMap(v) { return v instanceof Map; }
export function isQSet(v) { return v instanceof Set; }
export function isFunction(v) { return typeof v === 'function'; }
export function isThunk(v) { return v !== null && typeof v === 'object' && v.type === 'thunk'; }

// Truthiness rules from the spec: nil and false are falsy;
// everything else is truthy (including 0, "", [], {}, #{}).
export function isTruthy(v) {
  return v !== null && v !== undefined && v !== false;
}

// Construct a keyword value. Interned: two calls with the same
// name return the same object, so JS Map identity works as a key.
const KEYWORD_INTERN = new Map();
export function keyword(name) {
  let cached = KEYWORD_INTERN.get(name);
  if (cached) return cached;
  cached = Object.freeze({ type: 'keyword', name });
  KEYWORD_INTERN.set(name, cached);
  return cached;
}

// Compare two keywords by name (used as Map keys).
export function keywordsEqual(a, b) {
  return isKeyword(a) && isKeyword(b) && a.name === b.name;
}

// Resolve a keyword from any of: a keyword object, or a bare string
// (allowed as shorthand in helper APIs only — never in user input).
export function asKeywordName(k) {
  if (isKeyword(k)) return k.name;
  if (typeof k === 'string') return k;
  return null;
}

// describeType(value) — short label used in error messages.
export function describeType(v) {
  if (isNil(v)) return 'nil';
  if (isBoolean(v)) return 'boolean';
  if (isNumber(v)) return 'number';
  if (isString(v)) return 'string';
  if (isKeyword(v)) return 'keyword';
  if (isVec(v)) return 'Vec';
  if (isQMap(v)) return 'Map';
  if (isQSet(v)) return 'Set';
  if (isFunction(v)) return 'function';
  if (isThunk(v)) return 'thunk';
  if (v !== null && typeof v === 'object' && v.type === 'function') return 'function';
  return 'unknown';
}
