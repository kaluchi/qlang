import { canonicalKeywordLiteral } from './keyword-literal.mjs';
import {
  declareInvariantError,
  declareShapeError
} from './errors.mjs';
import { TAG_BINDING_PREFIX, canonicalTagName } from './env-keys.mjs';
import { compareValues } from './ordering.mjs';

// A function value has no literal, so none reaches the printer.
export const FunctionValueLeakedToPrintError = declareInvariantError(
  'FunctionValueLeakedToPrintError',
  () => 'printValue/toPlain: function value reached render — function values must not ' +
    'surface in pipeValue. Declare a host operand as a verb of the module the locator ' +
    'returns as { source, impls }, its primitive among the impls; a raw callable handed ' +
    'to session.bind carries no qlang literal.',
  { operand: '::qlang' }
);

// A number is a finite double, and one a host hands otherwise has no
// literal, so none reaches the printer or the codec.
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

// The keyword, the tag name, the doc, the error, the function value and
// the wrapper of a tag are objects branded on a hidden slot, so data never
// forges one.
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

// A keyword, with the literal that spells it; a map keys its entries by
// the plain name.
export function keyword(name) {
  return Object.freeze(brandValueClass({ name, literal: canonicalKeywordLiteral(name) }, 'keyword'));
}

// A tag name, `::Kind`, a value of its own whose `.name` a keyword's
// shares.
export function makeTagKeyword(tag) {
  const name = canonicalTagName(tag);
  return Object.freeze(brandValueClass({ name, literal: TAG_BINDING_PREFIX + name }, 'tagKeyword'));
}

export function isTagKeyword(v) {
  return isValueClass(v, 'tagKeyword');
}

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
  record.set('docs', Object.freeze([...docs]));
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

// A value under a tag of its own, a descriptor under `::builtin` apart.
export function isTaggedInstance(v) {
  if (v === null || typeof v !== 'object') return false;
  const tag = v[TAG_HEADER_SYMBOL];
  if (tag === undefined) return false;
  return tag.name !== BUILTIN_TAG_NAME;
}

export function isQuote(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === QUOTE_TAG_NAME;
}

// A quote is a vector of steps under `::quote` [D53], minted here alone,
// with a holder of the tree it runs through, the parser's for a quote read
// from text and filled at its first run for one assembled from data.
export const QUOTE_TAG_NAME = 'quote';
export const QUOTE_AST_SLOT = Symbol('qlang/quoteAst');

export function makeQuote(steps, ast = undefined) {
  const quote = [...steps];
  stampTagHeader(quote, QUOTE_TAG);
  stampSlot(quote, QUOTE_AST_SLOT, { ast });
  return Object.freeze(quote);
}

// A quote written as a modifier carries the environment of its call
// [D43], and one written as the body of a declaration that of its
// declaration [D44], on a JS-internal slot; a quote held as data carries
// none and runs where it is applied.
const QUOTE_ENV_SLOT = Symbol('qlang/quoteEnv');

export function quoteInEnv(quote, env) {
  const carried = [...quote];
  stampTagHeader(carried, QUOTE_TAG);
  stampSlot(carried, QUOTE_AST_SLOT, quote[QUOTE_AST_SLOT]);
  stampSlot(carried, QUOTE_ENV_SLOT, { env });
  return Object.freeze(carried);
}

// The holder a declaration fills with the scope it writes.
export function quoteEnvRef(quote) {
  return quote[QUOTE_ENV_SLOT];
}

export function envToRun(quote, envWhereApplied) {
  return quote[QUOTE_ENV_SLOT]?.env ?? envWhereApplied;
}

// A set is the vector in the one order without duplicates under `::set`
// [D16], minted here alone; the order ranks two values alike exactly when
// they are equal.
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

// The step an error literal leaves in a quote: an error of the tag written
// before its bang, or of the kind of errors [D86], whose fields hold the
// steps that compute them as written and an empty `:trail` where the
// literal writes none, so the error its fields build is the step [D42].
export function makeErrorLiteralStep(fieldSteps, tag = ERROR_TAG) {
  const descriptor = fieldSteps.has('trail') ? fieldSteps : new Map(fieldSteps).set('trail', Object.freeze([]));
  return Object.freeze(brandValueClass({
    tag, descriptor, location: null, originalError: null
  }, 'error'));
}

// A doc is the vector of its prose strings and quotes under `::doc`
// [D19], [D94], each run of prose one string that reads a line break as
// one whatever bytes the source wrote.
export const DOC_TAG_NAME = 'doc';

export function isDoc(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === DOC_TAG_NAME;
}

// A segment of a doc: a run of its prose, a quote, or a quote under a
// stack of tags, which gives the quote its role [D108].
export function isDocSegment(v) {
  let beneath = v;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return typeof v === 'string' || isQuote(beneath);
}

export function makeDoc(segments) {
  const doc = [];
  for (const segment of segments) {
    const piece = typeof segment === 'string' ? segment.replace(/\r\n?/g, '\n') : segment;
    if (piece === '') continue;
    if (typeof piece === 'string' && typeof doc[doc.length - 1] === 'string') doc[doc.length - 1] += piece;
    else doc.push(piece);
  }
  stampTagHeader(doc, DOC_TAG);
  return Object.freeze(doc);
}

// The tag of a vector or a map rides a hidden slot, out of the way of its
// elements and its entries.
export const TAG_HEADER_SYMBOL = Symbol('qlang/tag');

export function stampTagHeader(m, tag) {
  stampSlot(m, TAG_HEADER_SYMBOL, tag);
}

// A descriptor's primitive rides a hidden slot beside its `:impl` handle,
// which the data plane reads.
export const BUILTIN_IMPL_SLOT     = Symbol('qlang/builtinImpl');

function stampSlot(target, slot, value) {
  Object.defineProperty(target, slot, {
    value, enumerable: false, configurable: false, writable: false
  });
}

// The function value bootstrap stamps on a descriptor, `use`'s [D79].
export function builtinImplOf(descriptor) {
  return descriptor[BUILTIN_IMPL_SLOT];
}

export function stampBuiltinImpl(descriptor, fn) {
  stampSlot(descriptor, BUILTIN_IMPL_SLOT, fn);
}

// The tags the runtime names.
export const BINDING_TAG     = makeTagKeyword(BINDING_TAG_NAME);
export const BUILTIN_TAG     = makeTagKeyword(BUILTIN_TAG_NAME);
export const DOC_TAG         = makeTagKeyword(DOC_TAG_NAME);
export const ERROR_TAG       = makeTagKeyword('error');
export const PARSE_ERROR_TAG = makeTagKeyword('ParseError');
export const QUOTE_TAG       = makeTagKeyword(QUOTE_TAG_NAME);
export const SET_TAG         = makeTagKeyword(SET_TAG_NAME);
export const SPEC_TAG        = makeTagKeyword('spec');
export const TAG_BINDING_TAG = makeTagKeyword('tag');
export const VERB_TAG        = makeTagKeyword(VERB_TAG_NAME);

// The kind of every value without a tag of its own, the one its literal
// implies, which `type` answers [D32].
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
  doc:     DOC_TAG
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

// A tag over a payload: an untagged vector or map keeps its shape under
// the tag, a vector under `::quote` or `::set` minted as a quote or a set,
// so every verb of the container reads it; any other payload, a tagged one
// among them, is held by a wrapper, which `payload` opens.
export function makeTaggedInstance(tag, payload) {
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
  const wrap = brandValueClass({ tag, payload }, 'taggedInstance');
  stampTagHeader(wrap, tag);
  return Object.freeze(wrap);
}

// A verb is a tag over a quote [D67], with a holder of the scope its body
// resolves in, the one it was made in, which the declaration that binds
// it extends by its own name; a verb a codec assembled holds none.
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

// An error carries its tag, the kind of errors for a literal that names
// none [D64], and a descriptor of the facts of its site with its `:trail`,
// the path it took [D85], a vector of stops that `eval-trail.mjs` writes;
// a `:trail` of another shape is refused where the error is made.
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

// An error of the tag a host's descriptor holds under `:kind`.
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
  if (isDoc(v)) return 'Doc';
  if (isQSet(v)) return 'Set';
  if (isTaggedInstance(v)) return 'TaggedInstance';
  if (isVec(v)) return 'Vec';
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
  if (v !== null && typeof v === 'object') {
    const headerTag = v[TAG_HEADER_SYMBOL];
    if (headerTag !== undefined) return headerTag;
  }
  if (isVec(v)) return CORE_KIND.vec;
  if (isQMap(v)) return CORE_KIND.map;
  if (isErrorValue(v)) return v.tag;
  if (isFunctionValue(v)) return FUNCTION_KIND;
  return UNKNOWN_KIND;
}

// What the runtime finds where no value of the language stands: a
// function value in flight, and a host's raw object.
const FUNCTION_KIND = makeTagKeyword('function');
const UNKNOWN_KIND  = makeTagKeyword('unknown');
