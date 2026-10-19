// The painter of qlang source over the parts its parser reads [D367].
//
// `tokenize(src, verbNames)` returns a flat, gap-free, sorted
// `Array<{ start, end, kind }>` covering exactly `[0, src.length]`
// — every character of the source falls inside exactly one token.
// Renderers (HTML for the docs site, ANSI for the CLI REPL,
// LSP semantic tokens for the editor) consume the same token
// stream and only differ in how they coat each `kind`.
//
// Token kinds:
//
//   'string'      String literal, including the surrounding quotes
//   'regex'       Regex literal `#"…"`, its flags among it [QSTXT#regex]
//   'number'      Number literal, plus boolean and null literals
//   'comment'     A comment, and the prose of a doc: the quotes a
//                 doc holds and its spans in backticks paint as code
//   'name'        `:name` keyword OR a call's name that resolves
//                 through a reader's binding
//   'word'        a call's name that resolves to a verb of the
//                 language supplied by `langRuntime` AND each key
//                 segment of a `Path`
//   'keyword'     the name a declaration binds
//   'err'         the `!` and the bracket it touches
//                 in `!{` / closing `}` of an error literal, and the
//                 `!|` fail-track combinator — an error and the track
//                 that catches it
//   'quote'       a quote `~( … )`, including the `~(`
//                 opener and `)` closer, and the `~` of the short
//                 form `~add` (a doc `|~~ … ~~|` falls under
//                 'comment')
//   'tag'         the `::tag` head of a tagged literal, of an error literal
//                 that writes one, or a tag name — the
//                 sign of the tag and the address it names
//   'set'         `#[` opener and matching `]` closer of a set
//   'vec'         `[` opener and matching `]` closer of a vector
//   'punct'       the pipe `|`, the `{` / `}` of an ordinary
//                 map, `(` / `)` of a group, the commas of a
//                 JSON literal, and the `/` separator inside a
//                 path
//   'whitespace'  runs of whitespace between meaningful tokens, and
//                 the source past where its parse stopped
//
// A source that does not parse paints as far as the parser reads it: a source
// cut short, as a line being typed is, through the closers that complete it
// [QSSYN#refusal], and one the parser refuses up to the place of the refusal,
// the rest as whitespace.

import { closersCompleting, parse, ParseError } from './parse.mjs';
import { partOf, walkParts, tagWrittenBy } from './walk.mjs';
import { isCallStep, isBindStep, errorFieldsOf } from './steps.mjs';
import { isQuote, isDoc, isSet, isVec, isKeyword, isTag, isRegex, isPath, TAG_HEADER_SYMBOL } from './types.mjs';

// ── Public surface ────────────────────────────────────────────

export function tokenize(src, verbNames) {
  if (src.length === 0) return [];
  const read = readOf(src);
  if (read === null) return [{ start: 0, end: src.length, kind: 'whitespace' }];
  const semanticSpans = collectSemanticSpans(read.source, read.root, verbNames)
    .filter(span => span.start < read.end)
    .map(span => span.end > read.end ? { ...span, end: read.end } : span);
  const tokens = interleaveGapTokens(src.slice(0, read.end), semanticSpans);
  if (read.end < src.length) tokens.push({ start: read.end, end: src.length, kind: 'whitespace' });
  return tokens;
}

// The parts a source is painted from: `{ root, source, end }`, the source
// they were read from and how far into the painted one it reads, or null when
// no prefix completes, a throw that is no refusal passing as it is [D367].
function readOf(src) {
  let refusal;
  try {
    return { root: partOf(parse(src)), source: src, end: src.length };
  } catch (error) {
    if (!(error instanceof ParseError)) throw error;
    refusal = error;
  }
  for (const prefix of [src, src.slice(0, refusal.location.start.offset)]) {
    const closers = closersCompleting(prefix);
    if (closers !== null) return { root: partOf(parse(prefix + closers.join(''))), source: prefix + closers.join(''), end: prefix.length };
  }
  return null;
}

// ── The spans of the parts ─────────────────────────────────────

// The spans of the parts whose kind paints, by the value each read; the
// punctuation of a part that holds others shows up by the pass over the
// gaps below.
function collectSemanticSpans(src, root, verbNames) {
  // A comment is whitespace the parser keeps on the side [D367].
  const spans = root.comments.map(comment =>
    ({ start: comment.location.start.offset, end: comment.location.end.offset, kind: 'comment' }));

  walkParts(root, (read) => {
    const { value } = read;
    const startOffset = read.span.start.offset;
    const endOffset   = read.span.end.offset;
    const paint = kind => spans.push({ start: startOffset, end: endOffset, kind });

    if (isDoc(value)) {
      // The prose of a doc paints as a comment and the quotes it holds
      // as the code they are, so only prose reads grey [D367].
      let cursor = startOffset;
      for (const segment of read.parts) {
        pushProseSpans(src, cursor, segment.span.start.offset, verbNames, spans);
        cursor = segment.span.end.offset;
      }
      pushProseSpans(src, cursor, endOffset, verbNames, spans);
      return;
    }
    if (typeof value === 'string') return void paint('string');
    if (isRegex(value)) return void paint('regex');
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return void paint('number');
    if (isKeyword(value)) return void paint('name');
    if (isTag(value)) return void paint('tag');
    if (isPath(value)) return void emitPathSpans(src, startOffset, endOffset, spans);
    if (isQuote(value) && read.content !== undefined) {
      // A quote: its `~(` / `)` delimiters, or the `~` of the short
      // form, in the `quote` palette colour, and its content painted
      // again, every inner span `italic`, code as data painted as code.
      const isShortForm = src[startOffset + 1] !== '(';
      const contentStart = startOffset + (isShortForm ? 1 : 2);
      const contentEnd = isShortForm ? endOffset : endOffset - 1;
      spans.push({ start: startOffset, end: contentStart, kind: 'quote' });
      for (const inner of tokenize(src.slice(contentStart, contentEnd), verbNames)) {
        spans.push({ start: contentStart + inner.start, end: contentStart + inner.end, kind: inner.kind, italic: true });
      }
      if (!isShortForm) spans.push({ start: contentEnd, end: endOffset, kind: 'quote' });
      return false;
    }
    if (errorFieldsOf(value) !== null) {
      // The tags an error literal writes before its bang, its first parts,
      // paint as tags, and the `!{` / `}` of the error after them [QSERR#rest].
      let bang = startOffset;
      for (const held of read.parts) {
        if (!isTag(held.value)) break;
        bang = held.span.end.offset;
      }
      emitBracketSpans(bang, endOffset, 2, 1, 'err', spans);
      return;
    }
    const tag = tagWrittenBy(read);
    // The name a declaration binds paints as `keyword`, its docs as every
    // doc does [QSNAM#declare], [D367].
    if (isBindStep(value)) return void spans.push({ start: read.parts[0].span.start.offset, end: read.parts[0].span.end.offset, kind: 'keyword' });
    if (tag !== null) return void spans.push({ start: startOffset, end: startOffset + 2 + tag.length, kind: 'tag' });
    if (isSet(value)) return void emitBracketSpans(startOffset, endOffset, 2, 1, 'set', spans);
    if (isVec(value) && value[TAG_HEADER_SYMBOL] === undefined) return void emitBracketSpans(startOffset, endOffset, 1, 1, 'vec', spans);
    if (isCallStep(value)) {
      const name = value.get('name').name;
      spans.push({ start: startOffset, end: startOffset + name.length, kind: classifyCallName(name, verbNames) });
    }
  });

  return dedupeOverlappingSpans(spans);
}

// The prose of a doc between `start` and `end`: a comment, but for a
// span in backticks, a run of them closing at a run of as many, which
// names code and paints as the code it spells [D367].
const CODE_SPAN = /(?<!`)(`+)(?!`)([^\n]*?[^`\n])\1(?!`)/g;

function pushProseSpans(src, start, end, verbNames, spans) {
  let cursor = start;
  for (const match of src.slice(start, end).matchAll(CODE_SPAN)) {
    const codeStart = start + match.index + match[1].length;
    const codeEnd = codeStart + match[2].length;
    spans.push({ start: cursor, end: codeStart, kind: 'comment' });
    for (const inner of tokenize(match[2], verbNames)) {
      spans.push({ ...inner, start: codeStart + inner.start, end: codeStart + inner.end });
    }
    cursor = codeEnd;
  }
  spans.push({ start: cursor, end, kind: 'comment' });
}

function classifyCallName(callName, verbNames) {
  return verbNames.has(callName) ? 'word' : 'name';
}

// The opener and the closer of a vector, a set and an error literal, which
// would otherwise fall to the pass over the gaps as `punct`.
function emitBracketSpans(startOffset, endOffset, openerLen, closerLen, kind, spans) {
  spans.push({ start: startOffset, end: startOffset + openerLen, kind });
  spans.push({ start: endOffset - closerLen, end: endOffset, kind });
}

function emitPathSpans(src, startOffset, endOffset, spans) {
  const pathText = src.slice(startOffset, endOffset);
  let cursor = 0;
  // The grammar spells a path as `/` KeySeg (`/` KeySeg)*, so
  // every iteration opens on a `/` and every segment it scans runs
  // at least one character wide.
  while (cursor < pathText.length) {
    spans.push({
      start: startOffset + cursor,
      end:   startOffset + cursor + 1,
      kind:  'punct'
    });
    cursor += 1;
    let segEnd = cursor;
    while (segEnd < pathText.length && pathText[segEnd] !== '/') {
      // A quoted segment (`/"a/b"`) keeps its inner `/` — skip the
      // whole `"…"` span so a slash inside it does not split the
      // segment into two word tokens.
      if (pathText[segEnd] === '"') {
        segEnd += 1;
        while (segEnd < pathText.length && pathText[segEnd] !== '"') {
          // A backslash escapes the next char (including `\"`), so
          // step over both; every other char advances by one.
          segEnd += pathText[segEnd] === '\\' ? 2 : 1;
        }
      }
      segEnd += 1;
    }
    spans.push({
      start: startOffset + cursor,
      end:   startOffset + segEnd,
      kind:  'word'
    });
    cursor = segEnd;
  }
}

// Sort by start, then a strict cursor drops overlaps; the sort is stable,
// so the keyword span of a declaration, pushed first, stands over the name
// span of its key at the same start.
function dedupeOverlappingSpans(spans) {
  spans.sort((a, b) => a.start - b.start);
  const dedupedSpans = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start >= cursor) {
      dedupedSpans.push(span);
      cursor = span.end;
    }
  }
  return dedupedSpans;
}

// ── Gap interleaving — every code unit ends up in exactly one token ──

function interleaveGapTokens(src, semanticSpans) {
  const interleavedTokens = [];
  let cursor = 0;
  for (const span of semanticSpans) {
    if (span.start > cursor) {
      pushGapTokens(src, cursor, span.start, interleavedTokens);
    }
    interleavedTokens.push(span);
    cursor = span.end;
  }
  if (cursor < src.length) {
    pushGapTokens(src, cursor, src.length, interleavedTokens);
  }
  return interleavedTokens;
}

// A gap between the parts splits into `whitespace` runs and `punct`
// tokens, `!|` one token and every other character of structure one
// token each, commas, brackets and the `|` combinator among them.
function pushGapTokens(src, startOffset, endOffset, outputTokens) {
  let cursor = startOffset;
  while (cursor < endOffset) {
    if (/\s/.test(src[cursor])) {
      let runEnd = cursor + 1;
      while (runEnd < endOffset && /\s/.test(src[runEnd])) runEnd += 1;
      outputTokens.push({ start: cursor, end: runEnd, kind: 'whitespace' });
      cursor = runEnd;
    } else {
      const { end: punctRunEnd, kind } = scanPunctRun(src, cursor);
      outputTokens.push({ start: cursor, end: punctRunEnd, kind });
      cursor = punctRunEnd;
    }
  }
}

// The kind of a run of combinator characters in a gap: `!|`, the fail
// track, paints as `err`, the palette of the brackets of an error literal
// [QSERR#flow].
function scanPunctRun(src, startOffset) {
  const ch = src[startOffset];
  const next = src[startOffset + 1];
  if (ch === '!' && next === '|') return { end: startOffset + 2, kind: 'err'   };
  return { end: startOffset + 1, kind: 'punct' };
}
