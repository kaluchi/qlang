// The printer of the core: the text that reads back as a value, a part a
// kind whose `print` is declared under it prints its own way taken from that
// kind before the forms of the core write the rest [QSPRN#print].

import { printQuoteSource, docText } from '../quote.mjs';
import { patternLiteral } from '../pattern.mjs';
import { readsAsBareKeyword } from '../name-chars.mjs';
import { segmentIndex } from '../path-read.mjs';
import {
  isVec,
  isQMap,
  isPath,
  isFrame,
  isTrail,
  ELISION_TAG,
  ERROR_TAG,
  formOf,
  finiteNumberOrLift,
  TAG_HEADER_SYMBOL,
  canonicalKeywordLiteral
} from '../types.mjs';

// `dispatchQlangValue(pipeValue, handlers, fallback, ...extraArgs)`: the
// handler of the value's form, `formOf`, which the views of `format.mjs`
// share.
export function dispatchQlangValue(pipeValue, handlers, fallback, ...extraArgs) {
  const handler = handlers[formOf(pipeValue)];
  return handler ? handler(pipeValue, ...extraArgs) : fallback(pipeValue, ...extraArgs);
}

function escapeQlangStringLiteral(s) {
  return `"${s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
    .replace(/[\b]/g, '\\b')
    .replace(/\f/g, '\\f')}"`;
}

const literalOfKeyword = k => k.literal;

// A pattern writes its literal, its flags after it [QSTXT#pattern].
export const printRegex = r => patternLiteral(r.source, r.flags);

// A path writes its segments so they read back [QSPTH#value]: a place as its
// digits, a key as its bare name, behind a colon where its name carries a
// slash or follows one that does, which would take it in, and quoted
// otherwise.
export const printPath = path => '/' + path.segments.map((segment, index) => printPathSegment(segment, index > 0 && path.segments[index - 1].includes('/'))).join('/');

function printPathSegment(segment, afterSlashedKey) {
  if (segment.includes('/')) return segment.split('/').every(readsAsBareKeyword) ? ':' + segment : JSON.stringify(segment);
  if (Number.isInteger(segmentIndex(segment))) return segment;
  if (readsAsBareKeyword(segment)) return afterSlashedKey ? ':' + segment : segment;
  return JSON.stringify(segment);
}

// A value under a tag writes its tag before its payload, a descriptor's
// `::builtin` among them [QSPRN#print]; the set, the quote, the doc and the
// error write their own brackets.
const PRINT_HANDLERS = {
  null:    () => 'null',
  boolean: v => String(v),
  number:  v => String(finiteNumberOrLift(v)),
  string:  escapeQlangStringLiteral,
  keyword: literalOfKeyword,
  tag:     literalOfKeyword,
  regex:   printRegex,
  path:    printPath,
  error:   printErrorValue,
  vec:     (v, indent, printedOf, oneLine) => printListLike('[', v, indent, printedOf, oneLine),
  map:     (m, indent, printedOf, oneLine) => printMapLike('{', m, indent, printedOf, oneLine),
  set:     (s, indent, printedOf, oneLine) => printListLike('#[', s, indent, printedOf, oneLine),
  quote:   printQuote,
  doc:     d => '|~~' + docText(d) + '~~|',
  underTag: printTaggedInstance
};

// A quote writes its steps in `~(…)`, and one whose code is a path alone,
// which `~(…)` refuses where it is written, under its tag [QSPTH#value].
function printQuote(quote) {
  return quote.length === 1 && isPath(quote[0]) ? `::quote[${printPath(quote[0])}]` : '~(' + printQuoteSource(quote) + ')';
}

const printedByNoKind = () => undefined;

// printValue(v, indent?, printedOf?, oneLine?) → the text that reads back as
// `v`; `printedOf(part)` answers the print a kind declared under it gives a
// part, or undefined where the forms of the core write it, a print of several
// lines keeps the indent of the place it stands in, and `oneLine` lays every
// part on one line.
export function printValue(v, indent = 0, printedOf = printedByNoKind, oneLine = false) {
  const printed = printedOf(v);
  if (printed !== undefined) return printed.split('\n').join('\n' + '  '.repeat(indent));
  return dispatchQlangValue(v, PRINT_HANDLERS, printFallback, indent, printedOf, oneLine);
}

// A function a host bound in the environment prints as a string that
// names it.
function printFallback(v) {
  if (typeof v === 'function') return escapeQlangStringLiteral(`<host-fn ${v.name}>`);
  return String(v);
}

// A vector or a set stands on one line unless a part takes several, and
// then each part stands on a line of its own, as each frame of a trail of
// two or more does, a frame standing on one line whatever it holds [D337].
function printListLike(open, elements, indent, printedOf, oneLine = false, stacked = false) {
  const rendered = elements.map(el => printValue(el, indent + 1, printedOf, oneLine));
  if (oneLine || (!stacked && !rendered.some(s => s.includes('\n')))) return `${open}${rendered.join(' ')}]`;
  const pad = '  '.repeat(indent + 1);
  return `${open}\n${rendered.map(s => pad + s).join('\n')}\n${'  '.repeat(indent)}]`;
}

// A failure writes the error at rest `!|` opens it to: the tag of its site
// before the bang, none for the kind of errors, and its facts, the path it
// flew among them; the answer of a host says above it that it was raised
// [QSERR#print].
function printErrorValue(e, indent, printedOf) {
  const tagHead = e.tag.name === ERROR_TAG.name ? '' : e.tag.literal;
  return `${tagHead}${printMapLike('!{', e.descriptor, indent, printedOf)}`;
}

// A payload touches its tag by its own sign, and a number, a boolean,
// null or a path, whose literal would continue the tag's name, by `#`
// [QSLIT#tag].
const KINDS_AFTER_HASH = new Set(['number', 'boolean', 'null', 'path']);

export function underTagLiteral(tagLiteral, payload, payloadPrint) {
  return KINDS_AFTER_HASH.has(formOf(payload)) ? `${tagLiteral}#${payloadPrint}` : tagLiteral + payloadPrint;
}

// An error at rest writes the literal of its kind, `!{…}`, as a set
// writes `#[…]` [QSERR#rest].
function printTaggedInstance(instance, indent, printedOf, oneLine) {
  const tagLiteral = instance[TAG_HEADER_SYMBOL].literal;
  if (Array.isArray(instance)) return tagLiteral + printListLike('[', [...instance], indent, printedOf, oneLine || isFrame(instance), isTrail(instance) && instance.length > 1);
  if (instance instanceof Map && instance[TAG_HEADER_SYMBOL].name === ERROR_TAG.name) return printMapLike('!{', instance, indent, printedOf, oneLine);
  if (instance instanceof Map) return tagLiteral + printMapLike('{', instance, indent, printedOf, oneLine || instance[TAG_HEADER_SYMBOL].name === ELISION_TAG.name);
  return underTagLiteral(tagLiteral, instance.payload, printValue(instance.payload, indent, printedOf, oneLine));
}

// A map of two entries or fewer, none a container, stands on one line, and
// so does a marker of what a view left out, whatever it holds, so what
// holds it keeps its layout [QSPRN#elide]; any other map puts each entry on
// a line of its own.
function printMapLike(open, m, indent, printedOf, oneLine = false) {
  const entries = [...m];
  const hasComposite = entries.some(([, v]) => isQMap(v) || isVec(v));
  if (oneLine || (entries.length <= 2 && !hasComposite)) {
    return `${open}${entries.map(([k, v]) => `${canonicalKeywordLiteral(k)} ${printValue(v, indent, printedOf, oneLine)}`).join(' ')}}`;
  }
  const pad = '  '.repeat(indent + 1);
  const lines = entries.map(([k, v]) => `${pad}${canonicalKeywordLiteral(k)} ${printValue(v, indent + 1, printedOf)}`);
  return `${open}\n${lines.join('\n')}\n${'  '.repeat(indent)}}`;
}
