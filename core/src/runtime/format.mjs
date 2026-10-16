// The codec of JSON both ways [QSWRK#catalog], [QSPRN#json], `json` writing
// the JSON text of a value and `parseJson` reading one.

import { finiteNumberOrLift, TAG_HEADER_SYMBOL } from '../types.mjs';
import { declareRefusal, declareInvariantError } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { dispatchQlangValue, printValue, printRegex, printPath } from './print-value.mjs';

export { printValue };

function dispatchPlainValue(v, handlers, path) {
  if (Array.isArray(v)) return handlers.array(v, path);
  if (v !== null && typeof v === 'object') return handlers.object(v, path);
  return handlers.atom(v, path);
}

// `toPlain` writes a value in JSON's shape, for `json` and a host, and
// `fromPlain` reads that shape back as maps, vectors and the atoms, for a
// host.
const TO_PLAIN_HANDLERS = {
  null:    () => null,
  number:  finiteNumberOrLift,
  string:  v => v,
  boolean: v => v,
  keyword: k => k.name,
  tag:     k => k.literal,
  // A pattern writes its literal, which JSON has no form for [QSTXT#pattern].
  regex:   printRegex,
  // A path writes its literal [QSPTH#value].
  path:    printPath,
  vec:     v => v.map(toPlain),
  map:     qMapToPlainObject,
  // A value under a tag writes its tag as `$tag` beside its payload.
  underTag: t => {
    let inner;
    if (Array.isArray(t)) inner = [...t];
    else if (t instanceof Map) inner = new Map(t);
    else inner = t.payload;
    return { $tag: t[TAG_HEADER_SYMBOL].name, payload: toPlain(inner) };
  },
  // A quote and a doc write their prints [QSPRN#json].
  quote:   q => printValue(q),
  doc:     d => printValue(d),
  set:     s => s.map(toPlain),
  // A failure a host converts writes its tag beside its facts, which no
  // value of the pipe holds; its literal is the form that reads back.
  error:   e => ({ $error: { $tag: e.tag.name, facts: toPlain(e.descriptor) } })
};

export function toPlain(v) {
  return dispatchQlangValue(v, TO_PLAIN_HANDLERS, toPlainFallback);
}

// A value of none of the kinds of qlang: a function a host bound writes
// as `<host-fn name>`, so `env | json` stays plain JSON, and any other
// is refused.
function toPlainFallback(v) {
  if (typeof v === 'function') return `<host-fn ${v.name}>`;
  throw new BuiltinJsonValueNotEncodableError({ actualType: typeof v, actualValue: v });
}

export const BuiltinJsonValueNotEncodableError = declareInvariantError(
  'builtin/JsonValueNotEncodableError',
  ({ actualType }) => `toPlain: JSON has no form for a ${actualType} value a host put in the scope`);

// Each key is laid as a property of its own, so a key JavaScript reads as
// the prototype, `__proto__`, is written as any key is [QSPRN#json].
function qMapToPlainObject(m) {
  const obj = {};
  for (const [k, val] of m) {
    Object.defineProperty(obj, k, { value: toPlain(val), enumerable: true, writable: true, configurable: true });
  }
  return obj;
}

// A number of a JSON document past the doubles, which `JSON.parse` reads
// as an infinity, is refused at the `:path` of keys and indices to it.
export const StringParseJsonNumberNotFiniteError = declareRefusal('string/parseJson/NumberNotFiniteError');

const FROM_PLAIN_HANDLERS = {
  array:  (a, path) => a.map((element, index) => liftPlainValue(element, [...path, index])),
  object: plainObjectToQMap,
  atom:   liftPlainAtom
};

function liftPlainAtom(atom, path) {
  if (typeof atom === 'number' && !Number.isFinite(atom)) {
    throw new StringParseJsonNumberNotFiniteError({ path: Object.freeze([...path]) });
  }
  return atom;
}

function liftPlainValue(plainVal, path) {
  return dispatchPlainValue(plainVal, FROM_PLAIN_HANDLERS, path);
}

export function fromPlain(plainVal) {
  return liftPlainValue(plainVal, []);
}

function plainObjectToQMap(plainObj, path) {
  const qlangMap = new Map();
  for (const [plainKey, nestedVal] of Object.entries(plainObj)) {
    qlangMap.set(plainKey, liftPlainValue(nestedVal, [...path, plainKey]));
  }
  return qlangMap;
}

// fromJsonText(text) → the value a JSON text writes, read as a literal
// reads it: each object the map of its keys in the order the text writes
// them, which a plain object of JavaScript moves for a key that reads as an
// index, a key written twice standing in its first place with its last
// value, and a number past the doubles refused at its path [QSLIT#json]. The
// text is one `JSON.parse` has read.
export function fromJsonText(text) {
  let at = 0;
  const skipSpace = () => {
    while (at < text.length && (text[at] === ' ' || text[at] === '\t' || text[at] === '\n' || text[at] === '\r')) at += 1;
  };
  const stringAt = () => {
    const start = at;
    for (at += 1; text[at] !== '"'; at += 1) if (text[at] === '\\') at += 1;
    at += 1;
    return JSON.parse(text.slice(start, at));
  };
  const valueAt = path => {
    skipSpace();
    if (text[at] === '{') {
      const map = new Map();
      at += 1;
      skipSpace();
      while (text[at] !== '}') {
        const key = stringAt();
        skipSpace();
        at += 1;
        map.set(key, valueAt([...path, key]));
        skipSpace();
        if (text[at] === ',') at += 1;
        skipSpace();
      }
      at += 1;
      return map;
    }
    if (text[at] === '[') {
      const vec = [];
      at += 1;
      skipSpace();
      while (text[at] !== ']') {
        vec.push(valueAt([...path, vec.length]));
        skipSpace();
        if (text[at] === ',') at += 1;
        skipSpace();
      }
      at += 1;
      return vec;
    }
    if (text[at] === '"') return stringAt();
    const start = at;
    while (at < text.length && !',]} \t\n\r'.includes(text[at])) at += 1;
    return liftPlainAtom(JSON.parse(text.slice(start, at)), path);
  };
  return valueAt([]);
}

// `json` resides on `::any` and `parseJson` on `::string`, each a
// plain function over the value the walk served [QSQUO#modifier].
const StringParseJsonTextNotJsonError = declareRefusal('string/parseJson/TextNotJsonError');

bindPrim('any/json', subject => JSON.stringify(toPlain(subject)));
bindPrim('string/parseJson', subject => {
  try {
    JSON.parse(subject);
  } catch (jsParseError) {
    throw new StringParseJsonTextNotJsonError({ message: jsParseError.message });
  }
  return fromJsonText(subject);
});
