// Operand-level formatter `json` (plain-JSON string render), plus
// the lossy plain-JSON value codec pair `toPlain` / `fromPlain` that
// bridges qlang runtime values with ordinary JS data structures.
//
// Canonical qlang-literal printing lives next door in
// `print-value.mjs`; `toPlain` routes through the shared
// `dispatchQlangValue` lookup-table walker so the per-value-class
// decision sits in one place. A rendering for a terminal is a view
// at a host's boundary, and the command line owns its `table`.

import { printQuoteSource } from '../quote.mjs';
import { nullaryOp } from './dispatch.mjs';
import { finiteNumberOrLift, TAG_HEADER_SYMBOL } from '../types.mjs';
import { declareInvariantError, declarePerSiteError } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { dispatchQlangValue, printValue } from './print-value.mjs';

export { printValue };

function dispatchPlainValue(v, handlers, path) {
  if (Array.isArray(v)) return handlers.array(v, path);
  if (v !== null && typeof v === 'object') return handlers.object(v, path);
  return handlers.scalar(v, path);
}

// `toPlain` lifts a qlang value to a JSON-serializable plain JS
// shape (Map → object with keyword-named string keys, Vec →
// array, Set → array, error → `{$error: …}`); `fromPlain` lifts a
// plain JS shape back into qlang (object → Map keyed by interned
// keywords, array → Vec, scalars pass through). Together they
// bridge the language with any external system that speaks JSON —
// the `parseJson` / `json` operands, the script-mode auto-pipe of
// stdin in the CLI, and any future host that bridges qlang values
// with plain-JS data structures.
//
// `toPlain` is exported for direct unit-level coverage of the
// exotic-value fallback path — the public `json` operand feeds
// this function from inside nullaryOp, but no qlang-level path
// reaches the `String(v)` branch because raw function values
// never enter pipeValue.
const TO_PLAIN_HANDLERS = {
  Null:           () => null,
  Number:         finiteNumberOrLift,
  String:         v => v,
  Boolean:        v => v,
  Keyword:        k => k.name,
  TagKeyword:     k => k.literal,
  Vec:            v => v.map(toPlain),
  Map:            qMapToPlainObject,
  // Snapshot wraps a captured value plus a :name / :docs / :location
  // bundle. Encode the wrapped value transparently — toPlain is the
  // lossy codec, the wrapper metadata is reachable through
  // `manifest` enumeration for callers that need it.
  Snapshot:       s => toPlain(s.get('payload')),
  // TaggedInstance: identity rides on the JS-header
  // TAG_HEADER_SYMBOL slot, payload shape varies (Array /
  // Map / opaque wrap-object). The envelope carries identity
  // through `$tag` and encodes the payload through `toPlain`
  // recursively — mirrors the symmetric `Error` envelope.
  // Conduit deliberately has no handler: its `:body` AST node
  // and `:envRef` holder are JS-opaque, and the bidirectional
  // codec for conduits is `serializeSession` /
  // `deserializeSession` (`session.mjs`), not `toPlain`. Falling
  // through to `toPlainFallback` flags the leak loudly through
  // `ToPlainUnencodableValueError` at the call site.
  TaggedInstance: t => {
    let inner;
    if (Array.isArray(t)) inner = [...t];
    else if (t instanceof Map) inner = new Map(t);
    else inner = t.payload;
    return { $tag: t[TAG_HEADER_SYMBOL].name, payload: toPlain(inner) };
  },
  Quote:          q => `~(${printQuoteSource(q)})`,
  Doc:            d => `|~~${d.content}~~|`,
  Set:            s => s.map(toPlain),
  // Error → `$error: {$tag, descriptor}` — the tag sits at the
  // head of the envelope so the lossy plain-JSON form carries
  // the identity slot explicitly. Round-trip is one-way at this
  // codec; `toTaggedJSON` is the bijective pair.
  Error:          e => ({ $error: { $tag: e.tag.name, descriptor: toPlain(e.descriptor) } })
};

export function toPlain(v) {
  return dispatchQlangValue(v, TO_PLAIN_HANDLERS, toPlainFallback);
}

// Fallback for values `describeType` classifies as `Unknown`. The
// only live consumer reaching this branch is the host-bound raw
// JS function slot (`:qlang/locator` and any embedder
// `session.bind(name, fn)` installs); those render as a
// host-marker string so `env | json` produces a parseable plain
// shape. `dispatchQlangValue` already routes qlang function-values
// (the `makeFn` shape) through `FunctionValueLeakedToPrintError`.
function toPlainFallback(v) {
  if (typeof v === 'function') return `<host-fn ${v.name}>`;
  throw new ToPlainUnencodableValueError({ actualType: typeof v, actualValue: v });
}

// `toPlain` refuses to silently coerce unknown shapes to garbage
// strings (the `String([object Object])` path the previous
// fallback took). Per-site class so a caller can recover by
// projecting around the offending slot or by using the
// lossless `toTaggedJSON` codec instead.
export const ToPlainUnencodableValueError = declareInvariantError(
  'ToPlainUnencodableValueError',
  ({ actualType }) => `toPlain: unencodable ${actualType} value — use toTaggedJSON for ` +
    'lossless JSON or project around the slot',
  { operand: 'json' }
);

function qMapToPlainObject(m) {
  const obj = {};
  for (const [k, val] of m) {
    obj[k] = toPlain(val);
  }
  return obj;
}

// JSON carries no NaN and no infinity, but `JSON.parse` reads a
// magnitude past the double range as one (`1e400` lifts to
// Infinity). The lift refuses it here so a piped document cannot
// seed the pipeline with a value the language does not admit.
// `:path` names the keys and indices walked to reach the refused
// scalar, so `!| /path` locates it inside a document of any depth —
// the reading a message string cannot carry.
export const FromPlainNumberNotFiniteError = declarePerSiteError(
  'FromPlainNumberNotFiniteError', 'codecError',
  () => 'fromPlain: a JSON number outside the finite-double domain cannot lift into a qlang Number'
);

const FROM_PLAIN_HANDLERS = {
  array:  (a, path) => a.map((element, index) => liftPlainValue(element, [...path, index])),
  object: plainObjectToQMap,
  scalar: liftPlainScalar
};

function liftPlainScalar(scalarValue, path) {
  if (typeof scalarValue === 'number' && !Number.isFinite(scalarValue)) {
    throw new FromPlainNumberNotFiniteError({ path: Object.freeze([...path]) });
  }
  return scalarValue;
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

export const json = nullaryOp('json', (subject) => JSON.stringify(toPlain(subject)));

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('json', json);
