// The plain-JSON codec both ways [QSWRK#catalog], `json` rendering a value and
// `parseJson` reading one, over the lossy value codec pair `toPlain` /
// `fromPlain` that bridges qlang runtime values with ordinary JS data
// structures.
//
// Canonical qlang-literal printing lives next door in `print-value.mjs`;
// `toPlain` routes through the shared `dispatchQlangValue` lookup-table walker
// so the choice of a writer by the form of a value sits in one place. A
// rendering for a terminal is a view at a host's boundary, and the command
// line owns its `table`.

import { printQuoteSource, docText } from '../quote.mjs';
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

// `toPlain` writes a value in JSON's shape and `fromPlain` reads that
// shape back as maps, vectors and the atoms, for `json`, `parseJson`,
// the command line's streams and a host that hands values across.
const TO_PLAIN_HANDLERS = {
  null:    () => null,
  number:  finiteNumberOrLift,
  string:  v => v,
  boolean: v => v,
  keyword: k => k.name,
  tag:     k => k.literal,
  // A pattern writes its literal, which JSON has no form for [QSTXT#pattern].
  regex:   printRegex,
  // A path writes its literal, JSON Pointer's form [QSPTH#value].
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
  quote:   q => `~(${printQuoteSource(q)})`,
  doc:     d => `|~~${docText(d)}~~|`,
  set:     s => s.map(toPlain),
  // An error writes its tag beside its facts [QSPRN#json]; the literal, not
  // JSON, is the form that reads back.
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

function qMapToPlainObject(m) {
  const obj = {};
  for (const [k, val] of m) {
    obj[k] = toPlain(val);
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

// `json` resides on `::any` and `parseJson` on `::string`, each a
// plain function over the value the walk served [QSQUO#modifier].
const StringParseJsonTextNotJsonError = declareRefusal('string/parseJson/TextNotJsonError');

bindPrim('any/json', subject => JSON.stringify(toPlain(subject)));
bindPrim('string/parseJson', subject => {
  let parsed;
  try {
    parsed = JSON.parse(subject);
  } catch (jsParseError) {
    throw new StringParseJsonTextNotJsonError({ message: jsParseError.message });
  }
  return fromPlain(parsed);
});
