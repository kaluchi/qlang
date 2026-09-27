// The printer of the core: the text that reads back as a value [D30], a
// part a kind of a module prints its own way taken from that kind before
// the forms of the core write the rest [D96].

import { canonicalKeywordLiteral } from '../keyword-literal.mjs';
import { printQuoteSource, docText } from '../quote.mjs';
import {
  isVec,
  isQMap,
  isErrorValue, ERROR_TAG,
  isFunctionValue,
  describeType,
  finiteNumberOrLift,
  TAG_HEADER_SYMBOL,
  FunctionValueLeakedToPrintError
} from '../types.mjs';

// `dispatchQlangValue(pipeValue, handlers, fallback, ...extraArgs)`: the
// handler of the value's class, which the views of `format.mjs` share; a
// raw function reaches none.
export function dispatchQlangValue(pipeValue, handlers, fallback, ...extraArgs) {
  if (isFunctionValue(pipeValue)) throw new FunctionValueLeakedToPrintError();
  const handler = handlers[describeType(pipeValue)];
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

// A value under a tag writes its tag before its payload, a descriptor's
// `::builtin` among them [D96]; the set, the quote, the doc and the error
// write their own brackets.
const PRINT_HANDLERS = {
  Null:       () => 'null',
  Boolean:    v => String(v),
  Number:     v => String(finiteNumberOrLift(v)),
  String:     escapeQlangStringLiteral,
  Keyword:    literalOfKeyword,
  TagKeyword: literalOfKeyword,
  Error:      printErrorValue,
  Vec:        (v, indent, printedOf) => printListLike('[', v, indent, printedOf),
  Map:        (m, indent, printedOf) => (m[TAG_HEADER_SYMBOL]?.literal ?? '') + printMapLike('{', m, indent, printedOf),
  Set:        (s, indent, printedOf) => printListLike('#[', s, indent, printedOf),
  Quote:      q => '~(' + printQuoteSource(q) + ')',
  Doc:        d => '|~~' + docText(d) + '~~|',
  TaggedInstance: printTaggedInstance
};

const printedByNoKind = () => undefined;

// printValue(v, indent?, printedOf?) → the text that reads back as `v`;
// `printedOf(part)` answers the print a kind of a module gives a part, or
// undefined where the forms of the core write it, and a print of several
// lines keeps the indent of the place it stands in.
export function printValue(v, indent = 0, printedOf = printedByNoKind) {
  const printed = printedOf(v);
  if (printed !== undefined) return printed.split('\n').join('\n' + '  '.repeat(indent));
  return dispatchQlangValue(v, PRINT_HANDLERS, printFallback, indent, printedOf);
}

// A function a host bound in the environment prints as a string that
// names it.
function printFallback(v) {
  if (typeof v === 'function') return escapeQlangStringLiteral(`<host-fn ${v.name}>`);
  return String(v);
}

// A vector or a set stands on one line unless a part takes several, and
// then each part stands on a line of its own.
function printListLike(open, elements, indent, printedOf) {
  const rendered = elements.map(el => printValue(el, indent + 1, printedOf));
  if (!rendered.some(s => s.includes('\n'))) return `${open}${rendered.join(' ')}]`;
  const pad = '  '.repeat(indent + 1);
  return `${open}\n${rendered.map(s => pad + s).join('\n')}\n${'  '.repeat(indent)}]`;
}

// An error writes the tag of its site before its bang, and none for the
// kind of errors [D64]; an empty path goes unwritten, as the literal
// leaves it [D85].
function printErrorValue(e, indent, printedOf) {
  const tagHead = e.tag.name === ERROR_TAG.name ? '' : e.tag.literal;
  const payload = new Map();
  for (const [k, v] of e.descriptor) {
    if (k === 'trail' && v.length === 0) continue;
    payload.set(k, v);
  }
  if (payload.size === 0) return tagHead + '!{}';
  return tagHead + printMapLike('!{', payload, indent, printedOf);
}

// A payload that opens with a letter, a digit or a minus stands in
// parentheses after the tag, where it would read as the tag's name.
const TAG_PAYLOAD_NEEDS_PAREN_RE = /^[\w-]/;

function printTaggedInstance(instance, indent, printedOf) {
  const tagLiteral = instance[TAG_HEADER_SYMBOL].literal;
  if (Array.isArray(instance)) return tagLiteral + printListLike('[', [...instance], indent, printedOf);
  if (instance instanceof Map) return tagLiteral + printMapLike('{', instance, indent, printedOf);
  const payloadPrint = printValue(instance.payload, indent, printedOf);
  return TAG_PAYLOAD_NEEDS_PAREN_RE.test(payloadPrint) ? `${tagLiteral}(${payloadPrint})` : tagLiteral + payloadPrint;
}

// A map of two entries or fewer, none a container, stands on one line;
// any other puts each entry on a line of its own.
function printMapLike(open, m, indent, printedOf) {
  const entries = [...m];
  const hasComposite = entries.some(([, v]) => isQMap(v) || isVec(v) || isErrorValue(v));
  if (entries.length <= 2 && !hasComposite) {
    return `${open}${entries.map(([k, v]) => `${canonicalKeywordLiteral(k)} ${printValue(v, indent, printedOf)}`).join(' ')}}`;
  }
  const pad = '  '.repeat(indent + 1);
  const lines = entries.map(([k, v]) => `${pad}${canonicalKeywordLiteral(k)} ${printValue(v, indent + 1, printedOf)}`);
  return `${open}\n${lines.join('\n')}\n${'  '.repeat(indent)}}`;
}
