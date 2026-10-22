// [QSPRN#print]

import { regexLiteral } from './regex-read.mjs';
import { readsAsBareKeyword } from './name-chars.mjs';
import { segmentIndex } from './path-read.mjs';
import { errorFieldsOf, isOfTheKindOfErrors, isPathAlone, isCallStep, isBindStep, isConstructStep, isFailStep, isGroupStep, computes, computesWithin } from './steps.mjs';
import {
  isVec,
  isMap,
  isSet,
  isQuote,
  isDoc,
  isKeyword,
  isFrame,
  isTrace,
  ELISION_TAG,
  ERROR_TAG,
  formOf,
  refuseForeign,
  TAG_HEADER_SYMBOL,
  canonicalKeywordLiteral
} from './types.mjs';

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

// [QSTXT#regex]
export const printRegex = r => regexLiteral(r.source, r.flags);

// [QSPTH#value]
export const printPath = path => '/' + path.segments.map((segment, index) => printPathSegment(segment, index > 0 && path.segments[index - 1].includes('/'))).join('/');

function printPathSegment(segment, afterSlashedKey) {
  if (segment.includes('/')) return segment.split('/').every(readsAsBareKeyword) ? ':' + segment : JSON.stringify(segment);
  if (Number.isInteger(segmentIndex(segment))) return segment;
  if (readsAsBareKeyword(segment)) return afterSlashedKey ? ':' + segment : segment;
  return JSON.stringify(segment);
}

// [QSPRN#print], [QSHST#door]
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
  quote:   (q, indent, printedOf, oneLine) => printQuote(q, oneLine ? { oneLine, printedOf } : AS_WRITTEN),
  doc:     (d, indent) => printDoc(d, indent),
  underTag: printUnderTag
};

// [QSPTH#value]
function printQuote(quote, view) {
  return isPathAlone(quote) ? `::quote[${printPath(quote[0])}]` : '~(' + printQuoteSource(quote, view) + ')';
}

const printedByNoKind = () => undefined;

export function printValue(v, indent = 0, printedOf = printedByNoKind, oneLine = false) {
  const printed = printedOf(v);
  if (printed !== undefined) return printed.split('\n').join('\n' + '  '.repeat(indent));
  return dispatchQlangValue(v, PRINT_HANDLERS, indent, printedOf, oneLine);
}

// [QSPRN#print]
function printListLike(open, elements, indent, printedOf, oneLine = false, stacked = false) {
  const rendered = elements.map(el => printValue(el, indent + 1, printedOf, oneLine));
  if (oneLine || (!stacked && !rendered.some(s => s.includes('\n')))) return `${open}${rendered.join(' ')}]`;
  const pad = '  '.repeat(indent + 1);
  return `${open}\n${rendered.map(s => pad + s).join('\n')}\n${'  '.repeat(indent)}]`;
}

// [QSERR#print]
function printErrorValue(e, indent, printedOf) {
  const tagHead = e.tag.name === ERROR_TAG.name ? '' : e.tag.literal;
  return `${tagHead}${printMapLike('!{', e.facts, indent, printedOf)}`;
}

// [QSLIT#tag]
const KINDS_AFTER_HASH = new Set(['number', 'boolean', 'null', 'path']);

function underTagLiteral(tagLiteral, payload, payloadPrint) {
  return KINDS_AFTER_HASH.has(formOf(payload)) ? `${tagLiteral}#${payloadPrint}` : tagLiteral + payloadPrint;
}

// [QSERR#rest]
function printUnderTag(tagged, indent, printedOf, oneLine) {
  const tagLiteral = tagged[TAG_HEADER_SYMBOL].literal;
  if (Array.isArray(tagged)) return tagLiteral + printListLike('[', [...tagged], indent, printedOf, oneLine || isFrame(tagged), isTrace(tagged) && tagged.length > 1);
  if (isOfTheKindOfErrors(tagged)) return printMapLike('!{', tagged, indent, printedOf, oneLine);
  if (tagged instanceof Map) return tagLiteral + printMapLike('{', tagged, indent, printedOf, oneLine || tagged[TAG_HEADER_SYMBOL].name === ELISION_TAG.name);
  return underTagLiteral(tagLiteral, tagged.payload, printValue(tagged.payload, indent, printedOf, oneLine));
}

// [QSPRN#print]
function printMapLike(open, m, indent, printedOf, oneLine = false) {
  const entries = [...m];
  const hasComposite = entries.some(([, v]) => (isMap(v) || isVec(v)) && v[TAG_HEADER_SYMBOL]?.name !== ELISION_TAG.name);
  if (oneLine || (entries.length <= 2 && !hasComposite)) {
    return `${open}${entries.map(([k, v]) => `${canonicalKeywordLiteral(k)} ${printValue(v, indent, printedOf, oneLine)}`).join(' ')}}`;
  }
  const pad = '  '.repeat(indent + 1);
  const lines = entries.map(([k, v]) => `${pad}${canonicalKeywordLiteral(k)} ${printValue(v, indent + 1, printedOf)}`);
  return `${open}\n${lines.join('\n')}\n${'  '.repeat(indent)}}`;
}

// [QSSLF#doc]
export function docText(doc) {
  return doc.map(segment => (typeof segment === 'string' ? segment : printValue(segment))).join('');
}

// [QSPRN#print]
function printDoc(doc, indent) {
  const continued = `\n${'  '.repeat(indent)}  `;
  return `|~~ ${doc.map(segment => (typeof segment === 'string' ? segment.replace(/\n(?!\n)/g, continued) : printValue(segment))).join('')} ~~|`;
}

// [QSQUO#step]
export const asPrinted = { of: value => printValue(value), quoting: literal => printStep(literal, true), computesWithin };

// [QSQUO#parse], [QSPRN#print]
const AS_WRITTEN = { oneLine: false, printedOf: printedByNoKind };

export function printQuoteSource(steps, view = AS_WRITTEN) {
  const printed = steps.map(step => (isFailStep(step) ? { fail: printQuoteSource(step.payload, view) } : { step: printStep(step, false, view), source: step }));
  const lined = !view.oneLine && steps.length > 1 && (steps.every(isBindStep) || printed.some(({ fail, step }) => (fail ?? step).includes('\n')));
  const gap = lined ? '\n' : ' ';
  return printed.map(({ fail, step, source }, index) => {
    if (fail !== undefined) return `${index === 0 ? '' : gap}!| ${fail}`;
    const head = index === 0 ? '' : `${gap}| `;
    return head + (view.oneLine || !passesTheLine(head + step) ? step : stepOnLines(source, view) ?? step);
  }).join('');
}

// [QSPRN#print]
const LINE_WIDTH = 80;

const passesTheLine = printed => printed.split('\n').some(line => line.length > LINE_WIDTH);

function stepOnLines(step, view) {
  if (isCallStep(step)) {
    const modifiers = (step.get('modifiers') ?? []).map(modifier => (isKeyword(modifier) ? ` ${printValue(modifier)}` : `\n    ${isDoc(modifier) ? printValue(modifier, 2, view.printedOf) : printStep(modifier, false, view)}`));
    return step.get('name').name + modifiers.join('');
  }
  if (!isBindStep(step) || !step.has('docs')) return null;
  const docs = step.get('docs').map(doc => `\n  ${printValue(doc, 1, view.printedOf)}`);
  return step.get('name').literal + docs.join('') + (step.has('body') ? ` ${printStep(step.get('body'), false, view)}` : '');
}

function printStep(step, quoting = false, view = AS_WRITTEN) {
  if (quoting && computes(step)) return `~(${isCallStep(step) ? printCall(step) : printQuoteSource(step.payload)})`;
  if (isCallStep(step)) return printCall(step, view);
  if (isGroupStep(step)) return `(${printQuoteSource(step.payload, view)})`;
  if (isBindStep(step)) return printBind(step, view);
  if (isConstructStep(step)) return underTagLiteral(step.get('tag').literal, step.get('payload'), printStep(step.get('payload'), quoting, view));
  const errorFields = errorFieldsOf(step);
  if (errorFields !== null) return `!{${printEntries([...errorFields], quoting, view)}}`;
  if (isQuote(step)) return `~(${printQuoteSource(step, view)})`;
  if (isDoc(step)) return printValue(step, 0, view.printedOf, view.oneLine);
  if (isSet(step)) return `#[${step.map(part => printStep(part, quoting, view)).join(' ')}]`;
  if (isVec(step)) return `[${step.map(part => printStep(part, quoting, view)).join(' ')}]`;
  if (isMap(step)) return `{${printEntries([...step], quoting, view)}}`;
  return printValue(step);
}

function printEntries(entries, quoting, view = AS_WRITTEN) {
  return entries.map(([key, value]) => `${canonicalKeywordLiteral(key)} ${printStep(value, quoting, view)}`).join(' ');
}

function printCall(call, view = AS_WRITTEN) {
  return [call.get('name').name, ...(call.get('modifiers') ?? []).map(modifier => printStep(modifier, false, view))].join(' ');
}

function printBind(bind, view) {
  const parts = [bind.get('name').literal];
  if (bind.has('docs')) parts.push(...bind.get('docs').map(doc => printStep(doc, false, view)));
  if (bind.has('body')) parts.push(printStep(bind.get('body'), false, view));
  return parts.join(' ');
}
