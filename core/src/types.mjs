import { canonicalKeywordLiteral } from './keyword-literal.mjs';
import {
  declareInvariantError,
  declareShapeError
} from './errors.mjs';
import { TAG_BINDING_PREFIX, canonicalTagName } from './env-keys.mjs';
import { compareValues } from './ordering.mjs';

// Function values (`makeFn` output) are runtime-internal: a catalog
// descriptor carries its callable on the `BUILTIN_IMPL_SLOT`
// JS-header slot. They have no grammatical literal — the only
// candidate render form (`:qlang/prim/${name}`) parses back as a
// keyword value when read back. Surfacing a function value in
// pipeValue therefore violates printValue's round-trip theorem. The
// invariant fires at render time, so a host binding mounted through
// `session.bind` carrying a raw callable surfaces by name and routes
// through the locator's `impls` map instead.
export const FunctionValueLeakedToPrintError = declareInvariantError(
  'FunctionValueLeakedToPrintError',
  () => 'printValue/toPlain: function value reached render — function values must not ' +
    'surface in pipeValue. Install a host operand through a locator returning ' +
    "{ source, impls } so the namespace pass stamps the callable onto the descriptor's " +
    'BUILTIN_IMPL_SLOT (see cli/src/cli-locator.mjs); a raw callable handed to ' +
    'session.bind carries no qlang literal.',
  { operand: '::qlang' }
);

// A qlang Number is a finite double (see `### number` in
// qlang-spec.md). Source cannot mint an infinity or a NaN — the
// parser refuses the literal and every arithmetic site lifts a
// numericDomain error — but a host can, through `session.bind` or
// through the `{ source, impls }` locator contract. Render and codec
// are where such a value becomes observable: `printValue` would
// answer `Infinity`, which no production reads back, and the JSON
// boundary would answer `null`. Each of those seams reads this
// guard, the same shape `FunctionValueLeakedToPrintError` gives the
// other value with no literal.
export const NumberNotFiniteLeakedToPrintError = declareInvariantError(
  'NumberNotFiniteLeakedToPrintError',
  ({ actualValue }) => `render: ${actualValue} is outside the finite-double domain a ` +
    "qlang Number lives in — a host installed it through session.bind or a locator's " +
    'impls map, where source cannot mint one',
  { operand: '::qlang' }
);

// Reads the guard at every seam where a Number becomes observable.
export function finiteNumberOrLift(numberValue) {
  if (!Number.isFinite(numberValue)) throw new NumberNotFiniteLeakedToPrintError({ actualValue: String(numberValue) });
  return numberValue;
}

export const NULL = null;

// ── value-class brand ──────────────────────────────────────────
//
// Keyword / TagKeyword / Doc / Error / Function / the opaque
// TaggedInstance wrap are JS plain objects. Identity rides on a
// non-enumerable Symbol — the channel TAG_HEADER_SYMBOL uses too — so
// data carrying `{"type":"doc"}` cannot forge `isDoc`.
export const VALUE_CLASS_TAG = Symbol('qlang/valueClass');

export function brandValueClass(target, valueClass) {
  Object.defineProperty(target, VALUE_CLASS_TAG, {
    value: valueClass, enumerable: false, configurable: false, writable: false
  });
  return target;
}

export function isValueClass(v, valueClass) {
  return v !== null && typeof v === 'object' && v[VALUE_CLASS_TAG] === valueClass;
}

// ── primitive type predicates ──────────────────────────────────

export function isNull(v) { return v === null || v === undefined; }
export function isBoolean(v) { return typeof v === 'boolean'; }
export function isNumber(v) { return typeof v === 'number'; }
export function isString(v) { return typeof v === 'string'; }
export function isKeyword(v) {
  return isValueClass(v, 'keyword');
}
export function isVec(v) {
  return Array.isArray(v);
}
export function isQMap(v) {
  return v instanceof Map;
}
// The set is the vector in the one order without duplicates, under
// the `::set` tag [D16], so every operand that reads a vector reads a
// set: `isVec` holds for it, and this predicate tells it apart.
export function isQSet(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === SET_TAG_NAME;
}

// ── language value-class predicates ────────────────────────────

export function isFunctionValue(v) {
  return isValueClass(v, 'function');
}

export function isErrorValue(v) {
  return isValueClass(v, 'error');
}

// ── keyword value factory ─────────────────────────────────────
// Keyword objects are pipeline VALUES — for type-level display
// distinction from strings. Map keys are STRINGS; keyword objects
// never serve as Map keys. `.literal` carries the canonical qlang
// source form computed once via the grammar.

export function keyword(name) {
  return Object.freeze(brandValueClass({ name, literal: canonicalKeywordLiteral(name) }, 'keyword'));
}

// TagKeyword — `::tag` reference value. Tagged-instance Maps
// stamp `:kind` with a TagKeyword so the discriminator
// reads as "this is an instance of ::tag" — a tighter
// classification than the plain-keyword `:tag` symbol carries.
// `.name` mirrors the keyword shape so a single
// `kind.name === '<discriminator>'` check reads both Keyword
// (`:builtin`, `:tag` declarative kinds) and TagKeyword
// (`::binding`, user-defined ::tag instances) uniformly.

export function makeTagKeyword(tag) {
  const name = canonicalTagName(tag);
  return Object.freeze(brandValueClass({ name, literal: TAG_BINDING_PREFIX + name }, 'tagKeyword'));
}

export function isTagKeyword(v) {
  return isValueClass(v, 'tagKeyword');
}

// Env-key namespaces live in `./env-keys.mjs`. The TagKeyword
// factory above stamps `TAG_BINDING_PREFIX + tag` onto every
// `::tag` literal, which is the only place value-class code needs
// the prefix; every other env-keys-aware consumer imports from
// `env-keys.mjs` directly.

// ── binding / quote predicates ────────────────────────────────

// The record a declaration writes into its scope [D63]: the name, the
// docs of its slot, the value, the quote of the declaring step
// and the module it came from, under the kind `::binding`. A binding
// with no declaration behind it, a value `use` or a host bound, holds
// no source.
export function isBinding(v) {
  return v instanceof Map && v[TAG_HEADER_SYMBOL]?.name === BINDING_TAG_NAME;
}

export function makeBinding({ name, docs = [], value, source = null, module = null }) {
  const record = new Map();
  record.set('name', name);
  record.set('docs', Object.freeze(docs.map(content => makeDoc(content))));
  record.set('value', value);
  record.set('source', source);
  record.set('module', module);
  stampTagHeader(record, BINDING_TAG);
  return record;
}

// What a name of the scope holds: the value of its record; a value a
// host bound as it is, and a key of the runtime's own as they lie.
export function bindingValueOf(entry) {
  return isBinding(entry) ? entry.get('value') : entry;
}

// TaggedInstance — value carrying a TagKeyword on its JS-header
// `TAG_HEADER_SYMBOL` slot. `makeTaggedInstance` mints two value
// shapes: Array / Map clones with the header stamped, or
// an opaque frozen `{type, tag, payload}` wrapper for non-
// extensible payloads (scalar, Keyword, Doc, Error, already-tagged
// composite, a quote and a set among them). A value under the
// reserved tag name `::builtin` is no tagged instance:
// `isBuiltinDescriptor` answers for it, and a descriptor prints as its
// bare map.
export function isTaggedInstance(v) {
  if (v === null || typeof v !== 'object') return false;
  const tag = v[TAG_HEADER_SYMBOL];
  if (tag === undefined) return false;
  return tag.name !== BUILTIN_TAG_NAME;
}

export function isQuote(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === QUOTE_TAG_NAME;
}

// Quote — a vector of steps under the code tag `::quote`, so every
// container operand reads it as the tagged vector it is. A holder on
// the `QUOTE_AST_SLOT` carries the tree the quote runs through: the
// parser's own node for a quote read from text, filled on the first
// run for a quote assembled from data (see `quote.mjs::astOfQuote`).
// Every quote is minted here, `makeTaggedInstance` included, so the
// holder is always in place.
export const QUOTE_TAG_NAME = 'quote';
export const QUOTE_AST_SLOT = Symbol('qlang/quoteAst');

export function makeQuote(steps, ast = undefined) {
  const quote = [...steps];
  stampTagHeader(quote, QUOTE_TAG);
  stampSlot(quote, QUOTE_AST_SLOT, { ast });
  return Object.freeze(quote);
}

// A quote written as a modifier carries the environment of its call
// [D43] on a JS-internal slot, so code handed to another pipeline sees
// the names of its author wherever it is applied; a quote held as data
// carries none and runs in the environment where it is applied.
const QUOTE_ENV_SLOT = Symbol('qlang/quoteEnv');

export function quoteInEnv(quote, env) {
  const carried = [...quote];
  stampTagHeader(carried, QUOTE_TAG);
  stampSlot(carried, QUOTE_AST_SLOT, quote[QUOTE_AST_SLOT]);
  stampSlot(carried, QUOTE_ENV_SLOT, env);
  return Object.freeze(carried);
}

export function envToRun(quote, envWhereApplied) {
  return quote[QUOTE_ENV_SLOT] ?? envWhereApplied;
}

// Set — the vector in the one order without duplicates, under the
// `::set` tag [D16]. Its elements sort by `compareValues`, and an
// element the order ranks alike with the one before it leaves: the
// order ranks two values alike exactly when they are equal. Every set
// is minted here, `makeTaggedInstance` included.
export const SET_TAG_NAME = 'set';
export const BINDING_TAG_NAME = 'binding';
export const VERB_TAG_NAME = 'verb';
const BUILTIN_TAG_NAME = 'builtin';

export function makeSet(elements) {
  const ordered = [...elements].sort(compareValues);
  const set = ordered.filter((element, index) => index === 0 || compareValues(ordered[index - 1], element) !== 0);
  stampTagHeader(set, SET_TAG);
  return Object.freeze(set);
}

// The step an error literal leaves in a quote: an error value of the
// tag written before its bang, or of the kind of errors [D86], whose
// fields hold the steps that compute them, `:kind` and `:trail` among
// them, as written, and an empty `:trail` where the literal writes
// none, as every error holds one, so the error its fields build is the
// step [D42]. It never passes through `makeErrorValue`, whose invariant
// on `:trail` speaks of the error a step produces.
export function makeErrorLiteralStep(fieldSteps, tag = ERROR_TAG) {
  const descriptor = fieldSteps.has('trail') ? fieldSteps : new Map(fieldSteps).set('trail', Object.freeze([]));
  return Object.freeze(brandValueClass({
    tag, descriptor, location: null, originalError: null
  }, 'error'));
}

// Doc — frozen object carrying `.content`, the text of a `|~~ … ~~|`
// or `|~~|` form with its line breaks read as one, whatever bytes the
// source wrote; a doc literal and the doc of a binding both mint it here.
export function isDoc(v) {
  return isValueClass(v, 'doc');
}

export function makeDoc(content) {
  return Object.freeze(brandValueClass({ content: content.replace(/\r\n?/g, '\n') }, 'doc'));
}

// ── tag-header symbol — Map identity slot ────────────────────
//
// Non-enumerable Symbol key under which a Map carries its
// identity TagKeyword: invisible to Map iteration (`for (const [k, v] of m)`), to `m.get('kind')`,
// to JSON serialization, and to the manifest enumeration
// surface. Every identity-bearing value-class — binding record, TaggedInstance, catalog `::builtin` descriptor,
// materialized error — stamps the slot through `stampTagHeader`
// and reads it through `typeKeyword`'s header branch in one
// property access, leaving the data plane untouched.

export const TAG_HEADER_SYMBOL = Symbol('qlang/tag');

export function stampTagHeader(m, tag) {
  stampSlot(m, TAG_HEADER_SYMBOL, tag);
}

// ── JS-internal slots — the data plane stays qlang-only ───────
//
// The resolved JS function value a catalog `::builtin` descriptor
// dispatches through rides a non-enumerable Symbol slot — the channel
// `TAG_HEADER_SYMBOL` uses too — so `keys`, `/key` projection,
// `printValue`, `toPlain`, and `toTaggedJSON` see the `:impl
// :qlang/prim/<name>` handle keyword the catalog author wrote. The
// accessors below are the only readers: a dispatch site that reaches
// for `descriptor.get('impl')` gets the author's handle keyword, and
// `builtinImplOf` gets the callable.

export const BUILTIN_IMPL_SLOT     = Symbol('qlang/builtinImpl');

function stampSlot(target, slot, value) {
  Object.defineProperty(target, slot, {
    value, enumerable: false, configurable: false, writable: false
  });
}

// Resolved function value of a catalog `::builtin` descriptor,
// stamped by `stampStructuralFacts` at bootstrap (and by the
// `use`-locator namespace pass for host-supplied impls).
export function builtinImplOf(descriptor) {
  return descriptor[BUILTIN_IMPL_SLOT];
}

export function stampBuiltinImpl(descriptor, fn) {
  stampSlot(descriptor, BUILTIN_IMPL_SLOT, fn);
}

// Pre-computed TagKeyword constants for runtime-internal
// identities — Map JS-header tags, error defaults, and the
// manifest view-Map discriminators. Each constant is the single
// source of truth for its tag; factories, printers, and
// manifest paths all reach for the shared instance instead of
// minting a fresh TagKeyword on every call. Listed alphabetically.

export const BINDING_TAG     = makeTagKeyword(BINDING_TAG_NAME);
export const BUILTIN_TAG     = makeTagKeyword(BUILTIN_TAG_NAME);
export const ERROR_TAG       = makeTagKeyword('error');
export const PARSE_ERROR_TAG = makeTagKeyword('ParseError');
export const QUOTE_TAG       = makeTagKeyword(QUOTE_TAG_NAME);
export const SET_TAG         = makeTagKeyword(SET_TAG_NAME);
export const SPEC_TAG        = makeTagKeyword('spec');
export const TAG_BINDING_TAG = makeTagKeyword('tag');
export const VERB_TAG        = makeTagKeyword(VERB_TAG_NAME);

// The kind of every value without a tag of its own, the one its
// literal implies [D32]; `type` answers it, and a tag name's kind is
// the tag `::tag` a tag binding's view carries.
export const CORE_KIND = Object.freeze({
  null:    makeTagKeyword('null'),
  boolean: makeTagKeyword('boolean'),
  number:  makeTagKeyword('number'),
  string:  makeTagKeyword('string'),
  keyword: makeTagKeyword('keyword'),
  tag:     TAG_BINDING_TAG,
  vec:     makeTagKeyword('vec'),
  map:     makeTagKeyword('map'),
  set:     SET_TAG,
  quote:   QUOTE_TAG,
  doc:     makeTagKeyword('doc')
});

// The tags of a quote's steps [D47]: the records of what computes,
// and the wrappers a step takes on the fail track, under `*`, or in
// parentheses.
export const CALL_TAG   = makeTagKeyword('call');
export const PROJ_TAG   = makeTagKeyword('proj');
export const BIND_TAG   = makeTagKeyword('bind');
export const TAGGED_TAG = makeTagKeyword('tagged');
export const EACH_TAG   = makeTagKeyword('each');
export const FAIL_TAG   = makeTagKeyword('fail');
export const GROUP_TAG  = makeTagKeyword('group');

// ── tagged-instance factory ──────────────────────────────────
//
// Identity overlay on a payload value. The TagKeyword rides on
// the payload's JS-header `TAG_HEADER_SYMBOL` slot — Array and
// Map carry symbol-keyed non-enumerable properties natively,
// so the tag stays invisible to iteration, `m.get(…)`,
// `arr[idx]`, JSON serialization. Operands routed
// through `isVec` / `isQMap` predicates see the same
// shape they always see — `::Tag[1 2 3] | /1` indexes the
// underlying Array, `::Tag{:a 1} | keys` lists the underlying
// Map keys. `typeKeyword` reads the header first so identity comes
// through `result | type`. The reserved header tag `::builtin`
// is matched against in `isTaggedInstance` so the dedicated
// render and dispatch paths of a descriptor stay disjoint from the
// generic TaggedInstance.
//
// Payload shapes:
//
//   Untagged Vec / Map — clone and stamp header. The
//     clone keeps the payload's native shape so isVec /
//     isQMap and every shape-preserving operand work without
//     unwrap; under the code tag a vector mints as a quote, under
//     `::set` as a set. Flat-merging the Map payload's fields onto the
//     tagged Map (rather than nesting under `:payload`) makes
//     `tagged | keys` / `/field` / `vals` read identical to an
//     untagged Map literal. `:kind` fields stay as ordinary Map
//     data; identity rides on the JS-header alone, so a `:kind`
//     slot on user payload coexists with the instance's identity
//     without collision.
//
//   Scalar / Keyword / TagKeyword / Doc / Error /
//     already-tagged composite, a quote, a set and a binding record
//     among them — wrap in a Map carrying the payload under `:payload` slot,
//     stamp the header on the wrapper. JS scalars cannot carry
//     symbol-keyed properties (they are immutable primitives);
//     frozen value-class objects (Doc / Error) refuse
//     `defineProperty` after freeze; nested tagged composites
//     already own the header slot and re-stamping would
//     overwrite the inner identity. The wrap branch covers all
//     three concerns uniformly. `tagged | payload` recovers
//     the wrapped value through the operand's dedicated branch.

export function makeTaggedInstance(tag, payload) {
  // Untagged composite — overlay header on a clone of the
  // payload, native shape preserved.
  if (Array.isArray(payload) && payload[TAG_HEADER_SYMBOL] === undefined) {
    if (tag.name === QUOTE_TAG_NAME) return makeQuote(payload);
    if (tag.name === SET_TAG_NAME) return makeSet(payload);
    const arr = [...payload];
    stampTagHeader(arr, tag);
    return Object.freeze(arr);
  }
  if (payload instanceof Map
      && payload[TAG_HEADER_SYMBOL] === undefined) {
    const m = new Map(payload);
    stampTagHeader(m, tag);
    return m;
  }
  // Scalar / Keyword / TagKeyword / Doc /
  // already-tagged composite — wrap in an
  // opaque frozen JS object with `tag` and `payload` fields.
  // The opaque shape keeps `/payload` projection out of reach
  // (the wrapper is not a Map, so projectSegment throws
  // `ProjectionSubjectNotProjectableError` on any `/key`);
  // `payload` operand is the dedicated extractor that returns
  // the wrapped value. TAG_HEADER_SYMBOL is stamped so the
  // uniform identity-read path (typeKeyword / isTaggedInstance)
  // works through the same channel composite shapes use.
  const wrap = brandValueClass({ tag, payload }, 'taggedInstance');
  stampTagHeader(wrap, tag);
  return Object.freeze(wrap);
}

// ── verb factory ─────────────────────────────────────────────
//
// A verb is a tag over a quote [D67], minted by the constructor of
// `::verb`, which reads its signature. The scope its body resolves in
// rides a holder on a JS-internal slot: the scope where the verb was
// made, which the declaration that binds it ties to the scope it
// writes, so the body sees the verb's own name. A verb a codec
// assembled from data holds none.
const VERB_ENV_REF_SLOT = Symbol('qlang/verbEnvRef');

export function makeVerb(quote, envRef) {
  const verb = brandValueClass({ tag: VERB_TAG, payload: quote }, 'taggedInstance');
  stampTagHeader(verb, VERB_TAG);
  stampSlot(verb, VERB_ENV_REF_SLOT, envRef);
  return Object.freeze(verb);
}

export function isVerb(v) {
  return isValueClass(v, 'taggedInstance') && v.tag.name === VERB_TAG_NAME;
}

export function verbEnvRef(verb) {
  return verb[VERB_ENV_REF_SLOT];
}

// The noun a verb resides on, the kind of its subject when its head
// names none: the noun whose module declared it [D72], which the loader
// of that module records in the holder beside the verb's scope.
export function residenceOfVerb(verb) {
  return verb[VERB_ENV_REF_SLOT]?.residence ?? null;
}

export function resideVerbOn(verb, kindName) {
  verb[VERB_ENV_REF_SLOT].residence = kindName;
}

// The implementation a host handed with the module that declared a verb,
// a plain function over the values the verb's head checks [D4], [D80],
// which the loader of that module records in the holder beside the verb's
// scope.
export function hostImplOfVerb(verb) {
  return verb[VERB_ENV_REF_SLOT]?.hostImpl ?? null;
}

export function attachHostImpl(verb, impl) {
  verb[VERB_ENV_REF_SLOT].hostImpl = impl;
}

// ── error value factory ───────────────────────────────────────
//
// Identity rides on the `tag` JS-header field (a TagKeyword) —
// every error value carries one, the kind of errors `::error` for
// user-created `!{}` literals that omit `:kind`. The descriptor
// Map is pure data: `:actualType` and the other facts of the site,
// dynamic per-site fields, and `:trail`. `:kind` never appears in
// the descriptor — the universal identity slot lives on the
// header so dataflow against the descriptor stays composable
// (`result !| / spec | union | error` round-trips without losing
// identity), and the `type` operand reads `error.tag` directly
// without descriptor projection.
//
// `:trail` is the path of the error [D85], a vector of stops the
// runtime writes, `{:step :subject :skipped}`, empty for an error no
// step has raised or handed on; `eval-trail.mjs` writes it. A literal
// or a re-lift that stamps a value that is no vector of stops under
// `:trail` fires this error at mint time, and a re-lift that writes no
// `:trail` starts a path of its own at the step that lifts it.
export const ErrorTrailNotVecError = declareShapeError(
  'ErrorTrailNotVecError',
  ({ actualType }) => `error descriptor :trail must be a vector of stops, got ${actualType.name}`,
  { operand: '::error', expectedType: 'vec' }
);

// A trail is a vector of stops, each a map whose `:skipped` is the quote
// of the steps the error skipped after it [D85].
export function isTrail(value) {
  return isVec(value) && !isQuote(value) && !isQSet(value)
    && value.every(stop => isQMap(stop) && isQuote(stop.get('skipped')));
}

export function makeErrorValue(tag, descriptor, { location = null, originalError = null } = {}) {
  let finalDescriptor = descriptor;
  if (descriptor.has('trail')) {
    const trail = descriptor.get('trail');
    if (!isTrail(trail)) throw new ErrorTrailNotVecError({ actualType: typeKeyword(trail), actualValue: trail });
  } else {
    finalDescriptor = new Map(descriptor);
    finalDescriptor.set('trail', Object.freeze([]));
  }
  return Object.freeze(brandValueClass({ tag, descriptor: finalDescriptor, location, originalError }, 'error'));
}

// Host-facing convenience: build an ErrorValue from a descriptor
// Map that carries the per-site identity under its `:kind` slot.
// Hosts (jdt, future bridges) build descriptors keyword-by-keyword
// and naturally place the per-site `::TagKeyword` under `:kind`;
// this helper extracts it so callers do not repeat the same
// boilerplate at every throw site.
export function errorFromKindDescriptor(descriptor, opts = {}) {
  return makeErrorValue(descriptor.get('kind'), descriptor, opts);
}

// ── describeType ──────────────────────────────────────────────

export function describeType(v) {
  if (isNull(v)) return 'Null';
  if (isBoolean(v)) return 'Boolean';
  if (isNumber(v)) return 'Number';
  if (isString(v)) return 'String';
  if (isKeyword(v)) return 'Keyword';
  if (isTagKeyword(v)) return 'TagKeyword';
  if (isQuote(v)) return 'Quote';
  if (isQSet(v)) return 'Set';
  if (isTaggedInstance(v)) return 'TaggedInstance';
  if (isVec(v)) return 'Vec';
  if (isDoc(v)) return 'Doc';
  if (isQMap(v)) return 'Map';
  if (isErrorValue(v)) return 'Error';
  if (isFunctionValue(v)) return 'Function';
  return 'Unknown';
}

// typeKeyword(v) — the kind of a value [D32]: its outermost tag, or
// the kind of the core its literal implies.
export function typeKeyword(v) {
  if (isNull(v)) return CORE_KIND.null;
  if (isBoolean(v)) return CORE_KIND.boolean;
  if (isNumber(v)) return CORE_KIND.number;
  if (isString(v)) return CORE_KIND.string;
  if (isKeyword(v)) return CORE_KIND.keyword;
  if (isTagKeyword(v)) return CORE_KIND.tag;
  // Identity-on-JS-header takes precedence on every composite:
  // tagged Vec, tagged Map, the set, the quote and the binding
  // record — `result | type` returns the TagKeyword directly.
  if (v !== null && typeof v === 'object') {
    const headerTag = v[TAG_HEADER_SYMBOL];
    if (headerTag !== undefined) return headerTag;
  }
  if (isVec(v)) return CORE_KIND.vec;
  if (isDoc(v)) return CORE_KIND.doc;
  if (isQMap(v)) return CORE_KIND.map;
  // Error values carry their tag identity on the JS-header `tag`
  // slot — opaque to descriptor projection. `typeKeyword` reads
  // it directly so `result !| type` returns the per-site
  // `::Tag` without consulting any Map field.
  if (isErrorValue(v)) return v.tag;
  if (isFunctionValue(v)) return FUNCTION_KIND;
  return UNKNOWN_KIND;
}

// What the runtime finds where no value of the language stands: a
// function value in flight, and a host's raw object.
const FUNCTION_KIND = makeTagKeyword('function');
const UNKNOWN_KIND  = makeTagKeyword('unknown');
