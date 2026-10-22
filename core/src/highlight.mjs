// [QSHST#tokens]

import { closersCompleting, parse, ParseError } from './parse.mjs';
import { partOf, walkParts, tagHeadEnd } from './walk.mjs';
import { isCallStep, isBindStep, isGroupStep, errorFieldsOf } from './steps.mjs';
import { formOf } from './types.mjs';

export function tokenize(source, verbNames) {
  if (source.length === 0) return [];
  const read = readOf(source);
  if (read === null) return [{ start: 0, end: source.length, kind: 'unparsed' }];
  const spans = spansOf(read.source, read.root, verbNames)
    .filter(span => span.start < read.end)
    .map(span => (span.end > read.end ? { ...span, end: read.end } : span));
  const tokens = withGaps(source.slice(0, read.end), spans);
  if (read.end < source.length) tokens.push({ start: read.end, end: source.length, kind: 'unparsed' });
  return tokens;
}

// [QSQUO#step]
function readOf(source) {
  let refusal;
  try {
    return { root: partOf(parse(source)), source, end: source.length };
  } catch (error) {
    if (!(error instanceof ParseError)) throw error;
    refusal = error;
  }
  for (const prefix of [source, source.slice(0, refusal.location.start.offset)]) {
    const closers = closersCompleting(prefix);
    if (closers !== null) return { root: partOf(parse(prefix + closers.join(''))), source: prefix + closers.join(''), end: prefix.length };
  }
  return null;
}

// [QSHST#tokens]
function spansOf(source, root, verbNames) {
  const spans = [];
  const paint = (start, end, kind) => {
    if (end > start) spans.push({ start, end, kind });
  };
  for (const { location } of root.comments) paint(location.start.offset, location.end.offset, 'comment');
  walkParts(root, read => paintPart(read, source, verbNames, paint, spans));
  spans.sort((left, right) => left.start - right.start);
  const kept = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    kept.push(span);
    cursor = span.end;
  }
  return kept;
}

function paintPart(read, source, verbNames, paint, spans) {
  const { value } = read;
  const start = read.span.start.offset;
  const end = read.span.end.offset;
  const brackets = (opener, kind, from = start) => {
    paint(from, from + opener, kind);
    paint(end - 1, end, kind);
  };
  const form = formOf(value);
  switch (form) {
    case 'doc': return paintDoc(read, source, verbNames, paint, spans);
    case 'quote': return read.content === undefined ? undefined : paintQuote(read, source, verbNames, paint, spans);
    case 'vec': return brackets(1, 'vec');
    case 'set': return brackets(2, 'set');
    case 'map': return brackets(1, 'map');
    case 'underTag': break;
    default: return paint(start, end, form);
  }
  if (errorFieldsOf(value) !== null) return brackets(2, 'error', tagHeadEnd(read) ?? start);
  if (tagHeadEnd(read) !== null) return paint(start, tagHeadEnd(read), 'tag');
  if (isBindStep(value)) return paint(read.parts[0].span.start.offset, read.parts[0].span.end.offset, 'declaration');
  if (isGroupStep(value) && read.content !== undefined) return brackets(1, 'group');
  if (!isCallStep(value)) return undefined;
  const name = value.get('name').name;
  return paint(start, start + name.length, verbNames.has(name) ? 'verb' : 'name');
}

function paintQuote(read, source, verbNames, paint, spans) {
  const start = read.span.start.offset;
  const end = read.span.end.offset;
  const short = source[start + 1] !== '(';
  const from = start + (short ? 1 : 2);
  const to = short ? end : end - 1;
  paint(start, from, 'quote');
  for (const inner of tokenize(source.slice(from, to), verbNames)) spans.push({ ...inner, start: from + inner.start, end: from + inner.end, italic: true });
  paint(to, end, 'quote');
  return false;
}

function paintDoc(read, source, verbNames, paint, spans) {
  const quotes = read.parts.map(({ span }) => ({ start: span.start.offset, end: span.end.offset, code: false }));
  const backquoted = read.backquoted.map(({ start, end }) => ({ start: start.offset, end: end.offset, code: true }));
  let cursor = read.span.start.offset;
  for (const { start, end, code } of [...quotes, ...backquoted].sort((left, right) => left.start - right.start)) {
    paint(cursor, start, 'doc');
    if (code) for (const inner of tokenize(source.slice(start, end), verbNames)) spans.push({ ...inner, start: start + inner.start, end: start + inner.end });
    cursor = end;
  }
  paint(cursor, read.span.end.offset, 'doc');
}

function withGaps(source, spans) {
  const tokens = [];
  let cursor = 0;
  const gapUntil = end => {
    while (cursor < end) {
      let next = cursor + 1;
      let kind = 'punctuation';
      if (/\s/.test(source[cursor])) {
        while (next < end && /\s/.test(source[next])) next += 1;
        kind = 'whitespace';
      } else if (source.startsWith('!|', cursor)) {
        next = cursor + 2;
        kind = 'fail';
      }
      tokens.push({ start: cursor, end: next, kind });
      cursor = next;
    }
  };
  for (const span of spans) {
    gapUntil(span.start);
    tokens.push(span);
    cursor = span.end;
  }
  gapUntil(source.length);
  return tokens;
}
