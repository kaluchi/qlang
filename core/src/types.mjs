import { readsAsBareKeyword } from './name-chars.mjs';
import { declareRefusal, declareInvariantError } from './errors.mjs';
import { TAG_SIGIL } from './env-keys.mjs';
import { compareValues } from './ordering.mjs';

// A number is a finite double, and one a host hands otherwise has no
// literal, so none reaches the printer or the codec.
export const BuiltinNumberNotFiniteLeakedToPrintError = declareInvariantError(
  'builtin/NumberNotFiniteLeakedToPrintError',
  ({ actualValue }) => `render: ${actualValue} is outside the finite-double domain a ` +
    "qlang Number lives in — a host installed it through session.bind or the impls of " +
    'its sources, where source cannot mint one');

// Reads the guard at every seam where a Number becomes observable.
export function finiteNumberOrLift(numberValue) {
  if (!Number.isFinite(numberValue)) throw new BuiltinNumberNotFiniteLeakedToPrintError({ actualValue: String(numberValue) });
  return numberValue;
}

export const NULL = null;

// The keyword, the tag name, the error and the wrapper of a tag are
// objects branded on a hidden slot, so data never forges one.
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
// the `::set` tag [QSORD#order], so every verb that reads a vector reads a
// set: `isVec` holds for it, and this predicate tells it apart.
export function isQSet(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === SET_TAG_NAME;
}

// ── language value-class predicates ────────────────────────────

export function isErrorValue(v) {
  return isValueClass(v, 'error');
}

// The literal of a keyword of a name, bare where the name reads back
// bare and quoted with the escapes of a string otherwise.
const keywordLiterals = new Map();

export function canonicalKeywordLiteral(name) {
  let literal = keywordLiterals.get(name);
  if (literal === undefined) {
    literal = readsAsBareKeyword(name) ? ':' + name : ':' + JSON.stringify(name);
    keywordLiterals.set(name, literal);
  }
  return literal;
}

// A keyword, with the literal that spells it; a map keys its entries by
// the plain name.
export function keyword(name) {
  return Object.freeze(brandValueClass({ name, literal: canonicalKeywordLiteral(name) }, 'keyword'));
}

// A tag name, `::Kind`, a value of its own whose `.name` a keyword's
// shares.
export function makeTag(name) {
  return Object.freeze(brandValueClass({ name, literal: TAG_SIGIL + name }, 'tag'));
}

export function isTag(v) {
  return isValueClass(v, 'tag');
}

// ── binding / quote predicates ────────────────────────────────

// The record a declaration writes into its scope [QSNAM#binding]: the name,
// the docs of its slot, the value, the quote of the declaring step and its
// origin, the source or the cell it was read from [QSDSP#residence], under the
// kind `::binding`. A binding with no declaration behind it, a value a host
// bound, holds no source.
export function isBinding(v) {
  return v instanceof Map && v[TAG_HEADER_SYMBOL]?.name === BINDING_TAG_NAME;
}

export function makeBinding({ name, docs = [], value, source = null, origin = null }) {
  const record = new Map();
  record.set('name', name);
  record.set('docs', Object.freeze([...docs]));
  record.set('value', value);
  record.set('source', source);
  record.set('origin', origin);
  stampTagHeader(record, BINDING_TAG);
  return record;
}

// What a name of the scope holds: the value of its record; a value a
// host bound as it is, and a key of the runtime's own as they lie.
export function bindingValueOf(entry) {
  return isBinding(entry) ? entry.get('value') : entry;
}

// A pattern of text, the value of a `#"…"` literal: its source as written
// and its flags, which `pattern.mjs` hands to the engine [QSTXT#pattern].
export function makeRegex(source, flags) {
  return Object.freeze(brandValueClass({ source, flags }, 'regex'));
}

export function isRegex(v) {
  return isValueClass(v, 'regex');
}

// A path, the value of `/a/b/0` [QSPTH#value]: the text of each segment, a key
// of a map or a place of a vector, which the word that takes the path
// reads.
export function makePath(segments) {
  return Object.freeze(brandValueClass({ segments: Object.freeze(segments.map(String)) }, 'path'));
}

export function isPath(v) {
  return isValueClass(v, 'path');
}

// A value under a tag of its own.
export function isTaggedInstance(v) {
  return v !== null && typeof v === 'object' && v[TAG_HEADER_SYMBOL] !== undefined;
}

export function isQuote(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === QUOTE_TAG_NAME;
}

// A quote is a vector of steps under `::quote` [QSQUO#step], minted here
// alone, with a holder of the tree it runs through, the parser's for a quote
// read from text and filled at its first run for one assembled from data.
export const QUOTE_TAG_NAME = 'quote';
export const QUOTE_AST_SLOT = Symbol('qlang/quoteAst');

export function makeQuote(steps, ast = undefined) {
  const quote = [...steps];
  stampTagHeader(quote, QUOTE_TAG);
  stampSlot(quote, QUOTE_AST_SLOT, { ast });
  return Object.freeze(quote);
}

// A function, a value of `::fn`: the commands that declare the inputs it
// takes, its answer and its refusals, a quote, and its recipe, code or a
// host's primitive, or none for a contract [QSBLD#fn].
export const FN_TAG_NAME = 'fn';

export function isFn(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === FN_TAG_NAME;
}

// A kind, a value of `::kind`: the commands that declare its payload, its
// fields, its refusals, its invariants and its laws, a quote, and the
// check a host hands a kind of the core, or none for a kind that lays its
// tag over the payload as it is [QSBLD#kind], [QSLIT#tag].
export const KIND_TAG_NAME = 'kind';

export function isKind(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === KIND_TAG_NAME;
}

// The commands of a function or of a kind, the chain that built it folded
// into a quote, and its recipe.
export function commandsOf(built) {
  return built[0];
}

export function recipeOf(built) {
  return built[1];
}

// A set is the vector in the one order without duplicates under `::set`
// [QSORD#order], minted here alone; the order ranks two values alike exactly
// when they are equal.
export const SET_TAG_NAME = 'set';
export const BINDING_TAG_NAME = 'binding';
const BUILTIN_TAG_NAME = 'builtin';

// The kinds a holder takes, the set of their tags a refusal of a value of
// none of them holds as `:expected` [QSERR#site].
export function kindsExpected(...kindNames) {
  return makeSet(kindNames.map(makeTag));
}

export function makeSet(elements) {
  const ordered = [...elements].sort(compareValues);
  const set = ordered.filter((element, index) => index === 0 || compareValues(ordered[index - 1], element) !== 0);
  stampTagHeader(set, SET_TAG);
  return Object.freeze(set);
}

// An error at rest, a value like any other: its facts under `::error` and
// the tag of its site over them, none for the kind of errors, what `!|`
// opens a failure to and `raise` raises [QSERR#rest].
export function errorAtRest(tag, facts) {
  const ofKind = makeTaggedInstance(ERROR_TAG, facts);
  return tag.name === ERROR_TAG.name ? ofKind : makeTaggedInstance(tag, ofKind);
}

// A doc is the vector of its prose strings and quotes under `::doc`
// [QSSLF#doc], each run of prose one string that reads a line break as
// one whatever bytes the source wrote.
export const DOC_TAG_NAME = 'doc';

export function isDoc(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === DOC_TAG_NAME;
}

// Whether a value is a vector of a kind of its own, a set, a quote or a
// doc, read as a vector wherever a vector is read and keeping its shape
// where a plain vector gives way.
export function isVecOfOwnKind(v) {
  return isQSet(v) || isQuote(v) || isDoc(v);
}

// A segment of a doc: a run of its prose, a quote, or a quote under a
// stack of tags, which gives the quote its role [QSSLF#doc].
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

function stampSlot(target, slot, value) {
  Object.defineProperty(target, slot, {
    value, enumerable: false, configurable: false, writable: false
  });
}

// The tags the runtime names.
export const BINDING_TAG     = makeTag(BINDING_TAG_NAME);
export const BUILTIN_TAG     = makeTag(BUILTIN_TAG_NAME);
export const DOC_TAG         = makeTag(DOC_TAG_NAME);
export const ELISION_TAG     = makeTag('elision');
export const ERROR_TAG       = makeTag('error');
export const QUOTE_TAG       = makeTag(QUOTE_TAG_NAME);
export const SET_TAG         = makeTag(SET_TAG_NAME);

// The kind of every value without a tag of its own, the one its literal
// implies, which `type` answers [QSLIT#kind].
export const CORE_KIND = Object.freeze({
  null:    makeTag('null'),
  boolean: makeTag('boolean'),
  number:  makeTag('number'),
  string:  makeTag('string'),
  regex:   makeTag('regex'),
  keyword: makeTag('keyword'),
  path:    makeTag('path'),
  tag:     makeTag('tag'),
  vec:     makeTag('vec'),
  map:     makeTag('map'),
  set:     SET_TAG,
  quote:   QUOTE_TAG,
  doc:     DOC_TAG
});

// The tags of a quote's steps [QSQUO#step]: the records of what computes,
// and the wrappers a step takes on the fail track or in parentheses.
export const CALL_TAG   = makeTag('call');
export const BIND_TAG   = makeTag('bind');
export const CONSTRUCT_TAG = makeTag('construct');
export const FAIL_TAG   = makeTag('fail');
export const GROUP_TAG  = makeTag('group');

// A tag over a payload: an untagged vector or map keeps its shape under
// the tag, so every verb of the container reads it; any other payload, a
// tagged one among them, is held by a wrapper, which `payload` opens.
export function makeTaggedInstance(tag, payload) {
  if (Array.isArray(payload) && payload[TAG_HEADER_SYMBOL] === undefined) {
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

// The descriptor of an implementation a host hands, `::builtin{}`, the
// recipe of a word or of a kind that a primitive answers, or the value of
// a name under a label alone [QSBLD#fn], [QSBLD#kind], [QSBLD#recipe].
export function isBuiltinDescriptor(v) {
  return isQMap(v) && v[TAG_HEADER_SYMBOL]?.name === BUILTIN_TAG_NAME;
}

// A name under a label a host's source declared, which alone reaches a
// primitive [QSDSP#walk], with the implementation the host handed beside that
// source, a plain function over the values of the inputs of the call
// [QSQUO#literal], [QSDSP#residence].
const HOST_IMPLS = new WeakMap();

export function isHostDeclared(value) {
  return HOST_IMPLS.has(value);
}

export function hostImplOf(value) {
  return HOST_IMPLS.get(value);
}

export function declareHostValue(value, impl) {
  HOST_IMPLS.set(value, impl);
}

// An error carries its tag, the kind of errors for a literal that names none
// [QSERR#rest], and a descriptor of the facts of its site with its `:trail`,
// the path it took [QSERR#trail], a vector of stops that `eval-trail.mjs`
// writes; a `:trail` of another shape is refused where the error is made.
export const ErrorTrailNotVecError = declareRefusal('error/TrailNotVecError');

// A trail is a plain vector of plain maps, each holding under `:skipped`
// the quote of the steps the error skipped after it [QSERR#trail].
export function isTrail(value) {
  return isVec(value) && value[TAG_HEADER_SYMBOL] === undefined
    && value.every(stop => isQMap(stop) && stop[TAG_HEADER_SYMBOL] === undefined && isQuote(stop.get('skipped')));
}

// An error holds the facts of its site and, once a step raised it or
// handed it on, its path, `:trail`; one whose path is empty holds no
// `:trail` [QSERR#trail].
export function makeErrorValue(tag, descriptor, { location = null, originalError = null } = {}) {
  let finalDescriptor = descriptor;
  if (descriptor.has('trail')) {
    const trail = descriptor.get('trail');
    if (!isTrail(trail)) throw new ErrorTrailNotVecError({ actualValue: trail });
    if (trail.length === 0) {
      finalDescriptor = new Map(descriptor);
      finalDescriptor.delete('trail');
    }
  }
  return Object.freeze(brandValueClass({ tag, descriptor: finalDescriptor, location, originalError }, 'error'));
}

// formOf(v) → the form a writer of the core reads a value by: `error`,
// `underTag` for a value under a tag, a quote's data written under the
// tag of a kind among them [QSSLF#doc], the kind of the core `typeKeyword`
// answers, or `unknown` for a host's raw object.
export function formOf(v) {
  if (isErrorValue(v)) return 'error';
  if (isValueClass(v, 'taggedInstance')) return 'underTag';
  const kind = typeKeyword(v);
  if (kind === UNKNOWN_KIND) return 'unknown';
  return Object.hasOwn(CORE_KIND, kind.name) ? kind.name : 'underTag';
}

// typeKeyword(v) — the kind of a value [QSLIT#kind]: its outermost tag, or
// the kind of the core its literal implies.
export function typeKeyword(v) {
  if (isNull(v)) return CORE_KIND.null;
  if (isBoolean(v)) return CORE_KIND.boolean;
  if (isNumber(v)) return CORE_KIND.number;
  if (isString(v)) return CORE_KIND.string;
  if (isKeyword(v)) return CORE_KIND.keyword;
  if (isTag(v)) return CORE_KIND.tag;
  if (isRegex(v)) return CORE_KIND.regex;
  if (isPath(v)) return CORE_KIND.path;
  if (v !== null && typeof v === 'object') {
    const headerTag = v[TAG_HEADER_SYMBOL];
    if (headerTag !== undefined) return headerTag;
  }
  if (isVec(v)) return CORE_KIND.vec;
  if (isQMap(v)) return CORE_KIND.map;
  return UNKNOWN_KIND;
}

// What the runtime finds where no value of the language stands: a
// host's raw object.
const UNKNOWN_KIND = makeTag('unknown');
