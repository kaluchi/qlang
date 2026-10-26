import { readsAsBareKeyword } from './name-chars.mjs';
import { declareDefect, CallKindsMismatchedError } from './errors.mjs';
import { TAG_SIGIL } from './scope-keys.mjs';
import { splitAddress } from './address.mjs';

export const NULL = null;

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
export function isMap(v) {
  return v instanceof Map;
}
// [QSORD#order]
export function isSet(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === SET_TAG_NAME;
}

export function isErrorValue(v) {
  return isValueClass(v, 'error');
}

const keywordLiterals = new Map();

export function canonicalKeywordLiteral(name) {
  let literal = keywordLiterals.get(name);
  if (literal === undefined) {
    literal = readsAsBareKeyword(name) ? ':' + name : ':' + JSON.stringify(name);
    keywordLiterals.set(name, literal);
  }
  return literal;
}

export function makeKeyword(name) {
  return Object.freeze(brandValueClass({ name, literal: canonicalKeywordLiteral(name) }, 'keyword'));
}

export function makeTag(name) {
  return Object.freeze(brandValueClass({ name, literal: TAG_SIGIL + name }, 'tag'));
}

export function isTag(v) {
  return isValueClass(v, 'tag');
}

// [QSNAM#binding], [QSDSP#residence], [QSHST#source]
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
  stampWiring(record, record);
  return record;
}

export function bindingValueOf(entry) {
  return isBinding(entry) ? entry.get('value') : entry;
}

// [QSTXT#regex]
export function makeRegex(source, flags) {
  return Object.freeze(brandValueClass({ source, flags }, 'regex'));
}

export function isRegex(v) {
  return isValueClass(v, 'regex');
}

// [QSPTH#value]
export function makePath(segments) {
  return Object.freeze(brandValueClass({ segments: Object.freeze(segments.map(String)) }, 'path'));
}

export function isPath(v) {
  return isValueClass(v, 'path');
}

export function isTagged(v) {
  return v !== null && typeof v === 'object' && v[TAG_HEADER_SYMBOL] !== undefined;
}

export function isQuote(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === QUOTE_TAG_NAME;
}

// [QSQUO#step]
export const QUOTE_TAG_NAME = 'quote';

export function makeQuote(steps) {
  const quote = [...steps];
  stampTagHeader(quote, QUOTE_TAG);
  return Object.freeze(quote);
}

// [QSBLD#fn]
export const FN_TAG_NAME = 'fn';

export function isFn(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === FN_TAG_NAME;
}

// [QSBLD#kind], [QSLIT#tag]
export const KIND_TAG_NAME = 'kind';

export function isKind(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === KIND_TAG_NAME;
}

// [QSBLD#fn], [QSBLD#kind]
export function commandsOf(built) {
  return built[0];
}

export function recipeOf(fn) {
  return fn[1];
}

export function constructorOf(kind) {
  return kind[1];
}

export const SET_TAG_NAME = 'set';
export const BINDING_TAG_NAME = 'binding';
const BUILTIN_TAG_NAME = 'builtin';

// [QSERR#rest]
export const errorAtRest = facts => makeTagged(ERROR_TAG, facts);

// [QSSLF#doc]
export const DOC_TAG_NAME = 'doc';

export function isDoc(v) {
  return Array.isArray(v) && v[TAG_HEADER_SYMBOL]?.name === DOC_TAG_NAME;
}

export const KINDS_OF_OWN_VECTORS = [SET_TAG_NAME, QUOTE_TAG_NAME, DOC_TAG_NAME];

export function isVecOfOwnKind(v) {
  return isVec(v) && KINDS_OF_OWN_VECTORS.includes(v[TAG_HEADER_SYMBOL]?.name);
}

export function isDocSegment(v) {
  return typeof v === 'string' || isQuote(beneathTags(v));
}

export function makeDoc(segments) {
  const doc = [];
  for (const segment of segments) {
    const piece = typeof segment === 'string' ? segment.replace(/\r\n?/g, '\n') : segment;
    if (piece === '') continue;
    if (typeof piece === 'string' && typeof doc[doc.length - 1] === 'string') doc[doc.length - 1] += piece;
    else doc.push(piece);
  }
  const prose = withoutEdges(withoutSharedIndentation(doc));
  stampTagHeader(prose, DOC_TAG);
  return Object.freeze(prose);
}

function withoutEdges(doc) {
  const last = doc.length - 1;
  return doc.map((segment, at) => {
    if (typeof segment !== 'string') return segment;
    const opened = at === 0 ? segment.trimStart() : segment;
    return at === last ? opened.trimEnd() : opened;
  }).filter(segment => segment !== '');
}

const LINE_BREAK_AND_INDENTATION = /\n([ \t]*)/g;

function linesAfterTheFirst(doc, visit) {
  return doc.map((segment, at) => (typeof segment !== 'string' ? segment : segment.replace(LINE_BREAK_AND_INDENTATION, (whole, indentation, offset) => {
    const end = offset + whole.length;
    const blank = end === segment.length ? at === doc.length - 1 : segment[end] === '\n';
    return visit(indentation, blank);
  })));
}

function withoutSharedIndentation(doc) {
  let shared = Infinity;
  linesAfterTheFirst(doc, (indentation, blank) => {
    if (!blank) shared = Math.min(shared, indentation.length);
    return '';
  });
  return linesAfterTheFirst(doc, (indentation, blank) => '\n' + (blank ? '' : indentation.slice(shared)));
}

export const TAG_HEADER_SYMBOL = Symbol('qlang/tag');

export function stampTagHeader(m, tag) {
  Object.defineProperty(m, TAG_HEADER_SYMBOL, {
    value: tag, enumerable: false, configurable: false, writable: false
  });
}

// [QSBLD#value]
const WIRING_SYMBOL = Symbol('qlang/wiring');

function stampWiring(value, parts) {
  Object.defineProperty(value, WIRING_SYMBOL, {
    value: parts, enumerable: false, configurable: false, writable: false
  });
}

export function wiringOf(value) {
  return value !== null && typeof value === 'object' ? value[WIRING_SYMBOL] : undefined;
}

export function beneathOpenTags(value) {
  let beneath = value;
  while (isValueClass(beneath, 'underTag') && wiringOf(beneath) === undefined) beneath = beneath.payload;
  return beneath;
}

export const BINDING_TAG     = makeTag(BINDING_TAG_NAME);
export const BUILTIN_TAG     = makeTag(BUILTIN_TAG_NAME);
export const DESC_TAG        = makeTag('desc');
export const DOC_TAG         = makeTag(DOC_TAG_NAME);
export const EXCERPT_TAG     = makeTag('excerpt');
export const CELL_TAG        = makeTag('cell');
export const LEGEND_TAG      = makeTag('legend');
export const ERROR_TAG       = makeTag('error');
export const QUOTE_TAG       = makeTag(QUOTE_TAG_NAME);
export const SET_TAG         = makeTag(SET_TAG_NAME);

// [QSLIT#kind]
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

export const isKindOfTheCore = name => Object.hasOwn(CORE_KIND, name);

// [QSBLD#value]
export function makeTagged(tag, payload, parts) {
  if (Array.isArray(payload) && payload[TAG_HEADER_SYMBOL] === undefined) {
    const arr = [...payload];
    stampTagHeader(arr, tag);
    if (parts !== undefined) stampWiring(arr, parts);
    return Object.freeze(arr);
  }
  if (payload instanceof Map
      && payload[TAG_HEADER_SYMBOL] === undefined) {
    const m = new Map(payload);
    stampTagHeader(m, tag);
    if (parts !== undefined) stampWiring(m, parts);
    return m;
  }
  const underTag = brandValueClass({ tag, payload }, 'underTag');
  stampTagHeader(underTag, tag);
  if (parts !== undefined) stampWiring(underTag, parts);
  return Object.freeze(underTag);
}

export function beneathTags(value) {
  let beneath = value;
  while (isValueClass(beneath, 'underTag')) beneath = beneath.payload;
  return beneath;
}

const NO_TAGS = Object.freeze([]);

// [QSDSP#answer]
export function tagsOver(value) {
  if (value === null || typeof value !== 'object') return NO_TAGS;
  const tags = [];
  let part = value;
  for (; isValueClass(part, 'underTag'); part = part.payload) tags.push(part.tag.name);
  const header = part[TAG_HEADER_SYMBOL];
  if (header !== undefined && !isKindOfTheCore(header.name)) tags.push(header.name);
  return tags;
}

const sameTags = (left, right) => left.length === right.length && left.every((name, at) => name === right[at]);

export class TagsInCommon {
  first = null;
  tags = NO_TAGS;

  meet(value) {
    const over = tagsOver(value);
    if (over.length > 0 && this.first === null) [this.first, this.tags] = [value, over];
    return over.length === 0 || sameTags(this.tags, over) ? null : this.first;
  }
}

// [QSDSP#answer], [QSCND#compare]
export function pairRefused(left, right) {
  const [lefts, rights] = [tagsOver(left), tagsOver(right)];
  let depth = 0;
  while (depth < lefts.length && lefts[depth] === rights[depth]) depth++;
  const kindAt = (tags, value) => {
    if (depth < tags.length) return makeTag(tags[depth]);
    const beneath = beneathTags(value);
    return isMap(beneath) ? CORE_KIND.map : isVec(beneath) && !isVecOfOwnKind(beneath) ? CORE_KIND.vec : tagOf(beneath);
  };
  return new CallKindsMismatchedError({ leftTag: kindAt(lefts, left), rightTag: kindAt(rights, right) });
}

// [QSLIT#kind]
export function payloadBeneath(value) {
  if (isValueClass(value, 'underTag')) return value.payload;
  return isMap(value) ? new Map(value) : Object.freeze([...value]);
}

// [QSLIT#tag]
export const holdsNoOtherTag = (value, kindName) => (value[TAG_HEADER_SYMBOL]?.name ?? kindName) === kindName;

// [QSHST#source]
export function isBuiltinDescriptor(v) {
  return isMap(v) && v[TAG_HEADER_SYMBOL]?.name === BUILTIN_TAG_NAME;
}

export function builtinOf(value) {
  const recipe = isFn(value) ? recipeOf(value) : isKind(value) ? constructorOf(value) : value;
  return isBuiltinDescriptor(recipe) ? recipe : null;
}

const ADDRESS_OF_A_PRIMITIVE = 'of';

export function addressNamedBy(descriptor) {
  const address = isBuiltinDescriptor(descriptor) ? descriptor.get(ADDRESS_OF_A_PRIMITIVE) : undefined;
  return isTag(address) ? address : undefined;
}

// [QSDSP#walk], [QSHST#source]
const HANDED_PRIMITIVES = new WeakMap();

export function isPrimitiveHanded(descriptor) {
  return HANDED_PRIMITIVES.has(descriptor);
}

export function handedFor(descriptor, holder, sameHolder = Object.is) {
  const handed = HANDED_PRIMITIVES.get(descriptor);
  return handed?.holders.some(held => sameHolder(held, holder)) ? handed : undefined;
}

export function takePrimitive(descriptor, primitive, holders, address) {
  descriptor.set(ADDRESS_OF_A_PRIMITIVE, makeTag(address));
  HANDED_PRIMITIVES.set(descriptor, { primitive, holders, labelName: splitAddress(address)[0] });
}

// [QSERR#trace]
export const TRACE_TAG = makeTag('trace');
export const FRAME_TAG = makeTag('frame');

export function isTrace(value) {
  return isVec(value) && value[TAG_HEADER_SYMBOL]?.name === TRACE_TAG.name;
}

export function isFrame(value) {
  return isVec(value) && value[TAG_HEADER_SYMBOL]?.name === FRAME_TAG.name;
}

// [QSHST#source], [QSERR#trace]
const WIRINGS_THE_ROOT_HANDS = new Map();

export function takeWiring(kindName, wiring) {
  WIRINGS_THE_ROOT_HANDS.set(kindName, wiring);
}

export function makeFrame(subject, unfinished, path = null) {
  const payload = path === null ? [subject, unfinished] : [subject, unfinished, path];
  return makeTagged(FRAME_TAG, payload, WIRINGS_THE_ROOT_HANDS.get(FRAME_TAG.name)(payload));
}

export const SUBJECT_OF_A_FRAME = 'subject';

export function partsOfFrame(frame) {
  const parts = wiringOf(frame);
  return { subject: parts.get(SUBJECT_OF_A_FRAME), unfinished: parts.get('unfinished'), path: parts.get('path') };
}

export function makeTrace(frames) {
  return makeTagged(TRACE_TAG, [...frames]);
}

// [QSPRN#excerpt]
export const isExcerpt = value => isMap(value) && value[TAG_HEADER_SYMBOL]?.name === EXCERPT_TAG.name;

export const makeExcerpt = facts => makeTagged(EXCERPT_TAG, new Map(facts));

// [QSHST#cell]
export const isCell = value => isValueClass(value, 'underTag') && value.tag.name === CELL_TAG.name;

// [QSERR#alert]
export function makeErrorValue(tag, facts, { originalError = null, told = null } = {}) {
  return Object.freeze(brandValueClass({ tag, facts, originalError, told }, 'error'));
}

// [QSLIT#kind]
export function formOf(v) {
  if (isErrorValue(v)) return 'error';
  if (isValueClass(v, 'underTag')) return 'underTag';
  const kind = tagOf(v);
  return isKindOfTheCore(kind.name) ? kind.name : 'underTag';
}

// [QSLIT#kind], [QSHST#door]
export function tagOf(v) {
  if (isNull(v)) return CORE_KIND.null;
  if (isBoolean(v)) return CORE_KIND.boolean;
  if (isNumber(v)) return CORE_KIND.number;
  if (isString(v)) return CORE_KIND.string;
  if (isKeyword(v)) return CORE_KIND.keyword;
  if (isTag(v)) return CORE_KIND.tag;
  if (isRegex(v)) return CORE_KIND.regex;
  if (isPath(v)) return CORE_KIND.path;
  const headerTag = typeof v === 'object' ? v[TAG_HEADER_SYMBOL] : undefined;
  if (headerTag !== undefined) return headerTag;
  if (isVec(v)) return CORE_KIND.vec;
  return isMap(v) ? CORE_KIND.map : refuseForeign(v);
}

// [QSHST#door]
export const BuiltinForeignValueError = declareDefect('builtin/ForeignValueError',
  ({ actualValue }) => `the core met ${actualValue}, a value of no kind of the language`);

export function refuseForeign(value) {
  throw new BuiltinForeignValueError({ actualValue: accountOfForeign(value) });
}

export function accountOfForeign(value) {
  if (value === undefined || value === null) return String(value);
  if (typeof value === 'function') return `function ${value.name}`.trimEnd();
  if (typeof value !== 'object') return `${typeof value} ${String(value)}`;
  return `object ${Object.getPrototypeOf(value)?.constructor?.name ?? 'null'}`;
}
