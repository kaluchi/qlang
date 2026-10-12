// AST-based syntax highlighter for qlang source.
//
// `tokenize(src, builtinNames)` returns a flat, gap-free, sorted
// `Array<{ start, end, kind }>` covering exactly `[0, src.length]`
// — every character of the source falls inside exactly one token.
// Renderers (HTML for the docs site, ANSI for the CLI REPL,
// LSP semantic tokens for the editor) consume the same token
// stream and only differ in how they coat each `kind`.
//
// Token kinds:
//
//   'string'      String literal, including the surrounding quotes
//   'number'      Number literal, plus boolean and null literals
//   'comment'     Plain comment, and the prose of a doc: the quotes a
//                 doc holds and its spans in backticks paint as code
//   'name'        `:name` keyword OR a call's name that resolves
//                 through a reader's binding
//   'effect'      `:@name` keyword OR the name of a call marked
//                 `@`, an effectful word
//   'word'        a call's name that resolves to a word of the
//                 language supplied by `langRuntime` AND each key
//                 segment of a `Projection`
//   'keyword'     the head Keyword/tag of a BindStep
//                 declaration
//   'err'         `!` sigil plus its immediately-attached bracket
//                 in `!{` / closing `}` of an error literal, and the
//                 `!|` fail-track combinator — an error and the track
//                 that catches it
//   'quote'       Quote literal `~( … )`, including the `~(`
//                 opener and `)` closer, and the `~` of the short
//                 form `~add` (DocLit `|~~ … ~~|` falls under
//                 'comment')
//   'tag'         `::tag` head of a TaggedLit, of an ErrorLit that
//                 writes one, or a TagLit — the
//                 tag sigil + the address it names
//   'set'         `#[` opener and matching `]` closer of a SetLit
//   'vec'         `[` opener and matching `]` closer of a VecLit
//   'punct'       the pipe `|`, the `{` / `}` of an ordinary
//                 MapLit, `(` / `)` of a group, the commas of a
//                 JSON literal, and the `/` separator inside a
//                 `Projection`
//   'whitespace'  runs of whitespace between meaningful tokens, and
//                 the source past where its parse stopped
//
// A source that does not parse paints as far as the parser reads it: a
// source cut short, as a line being typed is, through the closers that
// complete it [D125], and one the parser refuses up to the place of the
// refusal, the rest as whitespace.

import { closersCompleting, parse } from './parse.mjs';
import { walkAst } from './walk.mjs';
import { EFFECT_MARKER_PREFIX } from './effect.mjs';

const KEYWORD_SIGIL = ':';
const EFFECT_KEYWORD_PREFIX = KEYWORD_SIGIL + EFFECT_MARKER_PREFIX;

// ── Public surface ────────────────────────────────────────────

export function tokenize(src, builtinNames) {
  if (src.length === 0) return [];
  const read = readOf(src);
  if (read === null) return [{ start: 0, end: src.length, kind: 'whitespace' }];
  const semanticSpans = collectSemanticSpans(read.source, read.ast, builtinNames)
    .filter(span => span.start < read.end)
    .map(span => span.end > read.end ? { ...span, end: read.end } : span);
  const tokens = interleaveGapTokens(src.slice(0, read.end), semanticSpans);
  if (read.end < src.length) tokens.push({ start: read.end, end: src.length, kind: 'whitespace' });
  return tokens;
}

// The tree a source is painted from: `{ ast, source, end }`, the source
// the tree was parsed from and how far into the painted one it reads,
// or null when no prefix of it completes.
function readOf(src) {
  let refusal;
  try {
    return { ast: parse(src), source: src, end: src.length };
  } catch (error) {
    refusal = error;
  }
  for (const prefix of [src, src.slice(0, refusal.location.start.offset)]) {
    const closers = closersCompleting(prefix);
    if (closers !== null) return { ast: parse(prefix + closers.join('')), source: prefix + closers.join(''), end: prefix.length };
  }
  return null;
}

// ── AST-driven semantic spans ──────────────────────────────────

// Walk the AST, harvest spans for the leaf nodes that carry
// recognisable semantic categories. Nodes whose children are
// themselves spanned (Pipeline, VecLit, MapLit, ParenGroup, …)
// emit nothing here — their structural punctuation shows up via
// the gap-interleaving pass below.
function collectSemanticSpans(src, ast, builtinNames) {
  // A plain comment is whitespace the parser keeps on the side [D81].
  const spans = ast.comments.map(comment =>
    ({ start: comment.location.start.offset, end: comment.location.end.offset, kind: 'comment' }));

  walkAst(ast, (node) => {
    const startOffset = node.location.start.offset;
    const endOffset   = node.location.end.offset;

    switch (node.type) {
      case 'DocLit': {
        // The prose of a doc paints as a comment and the quotes it holds
        // as the code they are, so only prose reads grey [D83].
        let cursor = startOffset;
        for (const segment of node.segments) {
          if (typeof segment === 'string') continue;
          pushProseSpans(src, cursor, segment.location.start.offset, builtinNames, spans);
          cursor = segment.location.end.offset;
        }
        pushProseSpans(src, cursor, endOffset, builtinNames, spans);
        return; // descend into the quotes
      }

      case 'StringLit':
        spans.push({ start: startOffset, end: endOffset, kind: 'string' });
        return false;

      case 'NumberLit':
      case 'BooleanLit':
      case 'NullLit':
        spans.push({ start: startOffset, end: endOffset, kind: 'number' });
        return false;

      case 'Keyword': {
        const keywordText = src.slice(startOffset, endOffset);
        const kind = keywordText.startsWith(EFFECT_KEYWORD_PREFIX) ? 'effect' : 'name';
        spans.push({ start: startOffset, end: endOffset, kind });
        return false;
      }

      case 'ErrorLit': {
        // The tag an error literal writes before its bang paints as
        // every tag head does, then the `!{` / `}` of the error [D86].
        const bangOffset = node.tag === null ? startOffset : startOffset + 2 + node.tag.length;
        if (node.tag !== null) spans.push({ start: startOffset, end: bangOffset, kind: 'tag' });
        emitBracketSpans(bangOffset, endOffset, 2, 1, 'err', spans);
        return;
      }

      case 'QuoteLit': {
        // Quote literal — paint the `~(` / `)` delimiters, or the
        // `~` of the short form, in the `quote` palette colour, then
        // sub-tokenise the body; every inner span carries
        // `italic: true`, code as data painted as code, italicised.
        const isShortForm = src[startOffset + 1] !== '(';
        const bodyStart = startOffset + (isShortForm ? 1 : 2);
        const bodyEnd = isShortForm ? endOffset : endOffset - 1;
        spans.push({ start: startOffset, end: bodyStart, kind: 'quote' });
        const innerSource = src.slice(bodyStart, bodyEnd);
        const innerSpans = tokenize(innerSource, builtinNames);
        for (const inner of innerSpans) {
          spans.push({
            start: bodyStart + inner.start,
            end:   bodyStart + inner.end,
            kind:  inner.kind,
            italic: true
          });
        }
        if (!isShortForm) spans.push({ start: bodyEnd, end: endOffset, kind: 'quote' });
        return false;
      }

      case 'BindStep': {
        // The binding key — Keyword `:name` or TagLit `::Tag` —
        // paints as 'keyword' (binding-introducer) so it is visually
        // distinct from a plain value-position `:name`; the doc literals
        // of its slot paint as every doc does [D83].
        const key = node.key;
        spans.push({ start: key.location.start.offset, end: key.location.end.offset, kind: 'keyword' });
        return; // descend into docs / body
      }

      case 'TagLit':
        spans.push({ start: startOffset, end: endOffset, kind: 'tag' });
        return false;

      case 'TaggedLit': {
        // Cover the `::tag` head with a single 'tag' span; descend
        // into the payload below so VecLit/MapLit/StringLit children
        // emit their own spans.
        const tagHeadEnd = startOffset + 2 + node.tag.length;
        spans.push({ start: startOffset, end: tagHeadEnd, kind: 'tag' });
        return; // descend into payload
      }

      case 'SetLit':
        emitBracketSpans(startOffset, endOffset, 2, 1, 'set', spans);
        return;

      case 'VecLit':
        emitBracketSpans(startOffset, endOffset, 1, 1, 'vec', spans);
        return;

      case 'Projection':
        emitProjectionSpans(src, startOffset, endOffset, spans);
        return false;

      case 'Call': {
        const nameEndOffset = startOffset + node.name.length;
        spans.push({
          start: startOffset,
          end:   nameEndOffset,
          kind:  classifyCallName(node.name, builtinNames)
        });
        return; // descend into args
      }
    }
  });

  return dedupeOverlappingSpans(spans);
}

// The prose of a doc between `start` and `end`: a comment, but for a
// span in backticks, which names code and paints as the code it spells.
function pushProseSpans(src, start, end, builtinNames, spans) {
  let cursor = start;
  for (const match of src.slice(start, end).matchAll(/`([^`\n]+)`/g)) {
    const codeStart = start + match.index + 1;
    const codeEnd = codeStart + match[1].length;
    spans.push({ start: cursor, end: codeStart, kind: 'comment' });
    for (const inner of tokenize(match[1], builtinNames)) {
      spans.push({ ...inner, start: codeStart + inner.start, end: codeStart + inner.end });
    }
    cursor = codeEnd;
  }
  spans.push({ start: cursor, end, kind: 'comment' });
}

function classifyCallName(callName, builtinNames) {
  if (callName.startsWith(EFFECT_MARKER_PREFIX)) return 'effect';
  if (builtinNames.has(callName))                return 'word';
  return 'name';
}

// Emit opener and closer spans for a literal with known bracket
// widths (VecLit / SetLit / ErrorLit). Interior children still
// walk through their own AST cases; the opener/closer fill in the
// bracket bytes that would otherwise fall to the gap pass as
// undifferentiated `punct`.
function emitBracketSpans(startOffset, endOffset, openerLen, closerLen, kind, spans) {
  spans.push({ start: startOffset, end: startOffset + openerLen, kind });
  spans.push({ start: endOffset - closerLen, end: endOffset, kind });
}

function emitProjectionSpans(src, startOffset, endOffset, spans) {
  const projectionText = src.slice(startOffset, endOffset);
  let cursor = 0;
  // The grammar spells a Projection as `/` KeySeg (`/` KeySeg)*, so
  // every iteration opens on a `/` and every segment it scans runs
  // at least one character wide.
  while (cursor < projectionText.length) {
    spans.push({
      start: startOffset + cursor,
      end:   startOffset + cursor + 1,
      kind:  'punct'
    });
    cursor += 1;
    let segEnd = cursor;
    while (segEnd < projectionText.length && projectionText[segEnd] !== '/') {
      // A quoted segment (`/"a/b"`) keeps its inner `/` — skip the
      // whole `"…"` span so a slash inside it does not split the
      // segment into two word tokens.
      if (projectionText[segEnd] === '"') {
        segEnd += 1;
        while (segEnd < projectionText.length && projectionText[segEnd] !== '"') {
          // A backslash escapes the next char (including `\"`), so
          // step over both; every other char advances by one.
          segEnd += projectionText[segEnd] === '\\' ? 2 : 1;
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

// Sort by start, then a strict cursor drops overlaps — a parent
// Call whose name range was already emitted by the child
// rule must not duplicate. Two distinct spans never share the
// same start offset under the current AST shape (the per-node
// visitor emits at most one span per node), so the comparator
// stays as a single-key sort.
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

// ── Gap interleaving — every byte ends up in exactly one token ──

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

// Walk a gap region, splitting into `whitespace` runs and `punct`
// tokens. Multi-char tokens (`!|`, `#[`) bind tighter
// than single-char punct. Any single byte that is neither
// whitespace nor a known multi-char prefix advances by one as
// `punct` — gaps between AST nodes contain only structural
// punctuation under any qlang-parseable input, so the single-byte
// fallback covers commas, brackets, the `|` combinator, and any
// future grammar punct uniformly without changes here.
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

// Resolve the kind of a single- or multi-char combinator run in a
// gap region. `!|` is the fail-track combinator and takes the `err`
// kind so renderers can paint it in the same palette as the `!{}`
// descriptor brackets. `#[` is not listed here because a set opener
// always arrives through the SetLit AST case above.
function scanPunctRun(src, startOffset) {
  const ch = src[startOffset];
  const next = src[startOffset + 1];
  if (ch === '!' && next === '|') return { end: startOffset + 2, kind: 'err'   };
  return { end: startOffset + 1, kind: 'punct' };
}
