// The printer of the core: the text that reads back as a value, a part a
// kind whose `print` is declared under it prints its own way taken from that
// kind before the forms of the core write the rest, the text of code among
// them [QSPRN#print].

import { regexLiteral } from './regex-read.mjs';
import { readsAsBareKeyword } from './name-chars.mjs';
import { segmentIndex } from './path-read.mjs';
import { stepTagOf, errorFieldsOf, CALL_TAG, BIND_TAG, CONSTRUCT_TAG, FAIL_TAG, GROUP_TAG } from './steps.mjs';
import {
  isVec,
  isMap,
  isSet,
  isPath,
  isQuote,
  isDoc,
  isFrame,
  isTrace,
  isValueClass,
  ELISION_TAG,
  ERROR_TAG,
  QUOTE_AST_SLOT,
  formOf,
  refuseForeign,
  TAG_HEADER_SYMBOL,
  canonicalKeywordLiteral
} from './types.mjs';

// `dispatchQlangValue(pipeValue, handlers, ...extraArgs)`: the handler of the
// value's form, `formOf`, which the codec of JSON shares.
export function dispatchQlangValue(pipeValue, handlers, ...extraArgs) {
  return handlers[formOf(pipeValue)](pipeValue, ...extraArgs);
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

// A regex writes its literal, its flags after it [QSTXT#regex].
export const printRegex = r => regexLiteral(r.source, r.flags);

// A path writes its segments so they read back [QSPTH#value]: an index as its
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
// error write their own brackets, and a number past the doubles is raised [QSHST#source].
const PRINT_HANDLERS = {
  null:    () => 'null',
  boolean: v => String(v),
  number:  v => (Number.isFinite(v) ? String(v) : refuseForeign(v)),
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
  underTag: printUnderTag
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
  return dispatchQlangValue(v, PRINT_HANDLERS, indent, printedOf, oneLine);
}

// A vector or a set stands on one line unless a part takes several, and
// then each part stands on a line of its own, as each frame of a trace of
// two or more does, a frame standing on one line whatever it holds [QSPRN#print].
function printListLike(open, elements, indent, printedOf, oneLine = false, stacked = false) {
  const rendered = elements.map(el => printValue(el, indent + 1, printedOf, oneLine));
  if (oneLine || (!stacked && !rendered.some(s => s.includes('\n')))) return `${open}${rendered.join(' ')}]`;
  const pad = '  '.repeat(indent + 1);
  return `${open}\n${rendered.map(s => pad + s).join('\n')}\n${'  '.repeat(indent)}]`;
}

// A failure writes its error at rest, the value a catch holds of it: the tag
// of its site before the bang, none for the kind of errors, and its facts, the
// trace it left among them; the answer of a host says above it that it was
// raised [QSERR#print].
function printErrorValue(e, indent, printedOf) {
  const tagHead = e.tag.name === ERROR_TAG.name ? '' : e.tag.literal;
  return `${tagHead}${printMapLike('!{', e.descriptor, indent, printedOf)}`;
}

// A payload touches its tag by its own sign, and a number, a boolean,
// null or a path, whose literal would continue the tag's name, by `#`
// [QSLIT#tag].
const KINDS_AFTER_HASH = new Set(['number', 'boolean', 'null', 'path']);

function underTagLiteral(tagLiteral, payload, payloadPrint) {
  return KINDS_AFTER_HASH.has(formOf(payload)) ? `${tagLiteral}#${payloadPrint}` : tagLiteral + payloadPrint;
}

// An error at rest writes the literal of its kind, `!{…}`, as a set
// writes `#[…]` [QSERR#rest].
function printUnderTag(tagged, indent, printedOf, oneLine) {
  const tagLiteral = tagged[TAG_HEADER_SYMBOL].literal;
  if (Array.isArray(tagged)) return tagLiteral + printListLike('[', [...tagged], indent, printedOf, oneLine || isFrame(tagged), isTrace(tagged) && tagged.length > 1);
  if (tagged instanceof Map && tagged[TAG_HEADER_SYMBOL].name === ERROR_TAG.name) return printMapLike('!{', tagged, indent, printedOf, oneLine);
  if (tagged instanceof Map) return tagLiteral + printMapLike('{', tagged, indent, printedOf, oneLine || tagged[TAG_HEADER_SYMBOL].name === ELISION_TAG.name);
  return underTagLiteral(tagLiteral, tagged.payload, printValue(tagged.payload, indent, printedOf, oneLine));
}

// A map of two entries or fewer, none a container, stands on one line, and
// so does an elision of what a view left out, whatever it holds, so what
// holds it keeps its layout [QSPRN#print]; any other map puts each entry on a line
// of its own.
function printMapLike(open, m, indent, printedOf, oneLine = false) {
  const entries = [...m];
  const hasComposite = entries.some(([, v]) => isMap(v) || isVec(v));
  if (oneLine || (entries.length <= 2 && !hasComposite)) {
    return `${open}${entries.map(([k, v]) => `${canonicalKeywordLiteral(k)} ${printValue(v, indent, printedOf, oneLine)}`).join(' ')}}`;
  }
  const pad = '  '.repeat(indent + 1);
  const lines = entries.map(([k, v]) => `${pad}${canonicalKeywordLiteral(k)} ${printValue(v, indent + 1, printedOf)}`);
  return `${open}\n${lines.join('\n')}\n${'  '.repeat(indent)}}`;
}

// printQuoteSource(quote) → the text between `~(` and `)`, in the command
// form. A quote read from that text leaves steps equal to the ones
// printed, since the constructor of every record and wrapper refuses one
// whose text reads back as another step.
export function printQuoteSource(quote) {
  return printSteps(quote);
}

// The text a quote of a doc was written in, the source its literal
// spelled, which reads back as the same steps; a quote assembled from
// data, which has no source, is printed [QSSLF#doc].
function writtenSourceOf(quote) {
  const writtenText = quote[QUOTE_AST_SLOT]?.ast?.text;
  return typeof writtenText === 'string' ? writtenText : printQuoteSource(quote);
}

// docText(doc) → its prose with each quote written where it stands as its
// author wrote it, a quote under tags with its stack before it, the text
// a doc's `content` answers [QSSLF#doc].
export function docText(doc) {
  return doc.map(segment => typeof segment === 'string' ? segment
    : isQuote(segment) ? `~(${writtenSourceOf(segment)})` : printValue(segment)).join('');
}

// A quote of declarations alone, the story `source` reads, prints one
// declaration a line, each after the first led by its pipe, as the
// catalog writes it [QSQUO#parse], and so does a quote of several steps one of
// which takes several lines, the commands of a chain among them.
function printSteps(steps) {
  const printed = steps.map(step => (stepTagOf(step) === FAIL_TAG.name ? { fail: printSteps(step.payload) } : { step: printStep(step) }));
  const lined = steps.length > 1 && (steps.every(step => stepTagOf(step) === BIND_TAG.name) || printed.some(({ fail, step }) => (fail ?? step).includes('\n')));
  const gap = lined ? '\n' : ' ';
  return printed.map(({ fail, step }, index) => {
    if (fail !== undefined) return `${index === 0 ? '' : gap}!| ${fail}`;
    return (index === 0 ? '' : `${gap}| `) + step;
  }).join('');
}

function printStep(step) {
  if (isQuote(step)) return `~(${printSteps(step)})`;
  if (isDoc(step)) return printValue(step);
  if (isSet(step)) return `#[${step.map(printStep).join(' ')}]`;
  switch (stepTagOf(step)) {
    case CALL_TAG.name: return printCall(step);
    case BIND_TAG.name: return printBind(step);
    case CONSTRUCT_TAG.name: return printConstruct(step.get('tag').literal, step.get('payload'));
    case GROUP_TAG.name: return `(${printSteps(step.payload)})`;
  }
  const errorFields = errorFieldsOf(step);
  if (errorFields !== null) return `${isValueClass(step, 'underTag') ? step.tag.literal : ''}!{${printEntries([...errorFields])}}`;
  if (isVec(step)) return `[${step.map(printStep).join(' ')}]`;
  if (isMap(step)) return `{${printEntries([...step])}}`;
  return printValue(step);
}

// A construct step writes its payload after its tag as a tagged literal
// does, and a payload of code in the parentheses the parser refuses after
// a tag, so the step reads back as none [QSLIT#tag].
function printConstruct(tagLiteral, payload) {
  const kind = stepTagOf(payload);
  if (kind === CALL_TAG.name || kind === BIND_TAG.name) return `${tagLiteral}(${printStep(payload)})`;
  return underTagLiteral(tagLiteral, payload, printStep(payload));
}

function printEntries(entries) {
  return entries.map(([key, value]) => `${canonicalKeywordLiteral(key)} ${printStep(value)}`).join(' ');
}

function printCall(call) {
  return [call.get('name').name, ...(call.get('modifiers') ?? []).map(printStep)].join(' ');
}

function printBind(bind) {
  const parts = [bind.get('name').literal];
  if (bind.has('docs')) parts.push(...bind.get('docs').map(printStep));
  if (bind.has('body')) parts.push(printStep(bind.get('body')));
  return parts.join(' ');
}
