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
//   'comment'     Plain or doc comment, all four forms
//   'atom'        `:name` keyword (atom) OR an OperandCall name
//                 that resolves through a user-defined binding
//   'effect'      `:@name` keyword OR an `@`-prefixed OperandCall
//                 name (effectful host operand or conduit)
//   'operand'     OperandCall name that resolves to a builtin
//                 supplied by `langRuntime` AND each key segment
//                 of a `Projection`
//   'keyword'     `let` and `as` — the binding-introducing operands
//   'punct'       single-char or multi-char combinator (`|`, `*`,
//                 `>>`, `!|`, `#{`), bracket, comma, dot, or the
//                 `/` separator inside a `Projection`
//   'whitespace'  runs of whitespace between meaningful tokens, and
//                 the entire input on a parse failure (the safe
//                 fallback that lets live-typing scenarios render
//                 partial source without a span until the next
//                 keystroke makes it parseable again)

import { parse } from './parse.mjs';
import { walkAst } from './walk.mjs';

const BINDING_OPERAND_NAMES = new Set(['let', 'as']);

// ── Public surface ────────────────────────────────────────────

export function tokenize(src, builtinNames) {
  if (src.length === 0) return [];
  let ast;
  try {
    ast = parse(src);
  } catch {
    return [{ start: 0, end: src.length, kind: 'whitespace' }];
  }
  const semanticSpans = collectSemanticSpans(src, ast, builtinNames);
  return interleaveGapTokens(src, semanticSpans);
}

// ── AST-driven semantic spans ──────────────────────────────────

// Walk the AST, harvest spans for the leaf nodes that carry
// recognisable semantic categories. Nodes whose children are
// themselves spanned (Pipeline, VecLit, MapLit, ParenGroup, …)
// emit nothing here — their structural punctuation shows up via
// the gap-interleaving pass below.
function collectSemanticSpans(src, ast, builtinNames) {
  const spans = [];

  walkAst(ast, (node) => {
    const startOffset = node.location.start.offset;
    const endOffset   = node.location.end.offset;

    switch (node.type) {
      case 'LinePlainComment':
      case 'LineDocComment':
      case 'BlockPlainComment':
      case 'BlockDocComment':
        spans.push({ start: startOffset, end: endOffset, kind: 'comment' });
        return false;

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
        const kind = keywordText.startsWith(':@') ? 'effect' : 'atom';
        spans.push({ start: startOffset, end: endOffset, kind });
        return false;
      }

      case 'Projection':
        emitProjectionSpans(src, startOffset, endOffset, spans);
        return false;

      case 'OperandCall': {
        const nameEndOffset = startOffset + node.name.length;
        spans.push({
          start: startOffset,
          end:   nameEndOffset,
          kind:  classifyOperandName(node.name, builtinNames)
        });
        return; // descend into args
      }
    }
  });

  return dedupeOverlappingSpans(spans);
}

function classifyOperandName(operandName, builtinNames) {
  if (operandName.startsWith('@'))             return 'effect';
  if (BINDING_OPERAND_NAMES.has(operandName))  return 'keyword';
  if (builtinNames.has(operandName))           return 'operand';
  return 'atom';
}

function emitProjectionSpans(src, startOffset, endOffset, spans) {
  const projectionText = src.slice(startOffset, endOffset);
  let cursor = 0;
  while (cursor < projectionText.length) {
    if (projectionText[cursor] === '/') {
      spans.push({
        start: startOffset + cursor,
        end:   startOffset + cursor + 1,
        kind:  'punct'
      });
      cursor += 1;
      let segEnd = cursor;
      while (segEnd < projectionText.length && projectionText[segEnd] !== '/') {
        segEnd += 1;
      }
      if (segEnd > cursor) {
        spans.push({
          start: startOffset + cursor,
          end:   startOffset + segEnd,
          kind:  'operand'
        });
        cursor = segEnd;
      }
    }
  }
}

// Sort by start, then a strict cursor drops overlaps — a parent
// OperandCall whose name range was already emitted by the child
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
// tokens. Multi-char combinators (`>>`, `!|`, `#{`) bind tighter
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
      const punctRunEnd = scanPunctRun(src, cursor);
      outputTokens.push({ start: cursor, end: punctRunEnd, kind: 'punct' });
      cursor = punctRunEnd;
    }
  }
}

function scanPunctRun(src, startOffset) {
  const ch = src[startOffset];
  const next = src[startOffset + 1];
  if (ch === '>' && next === '>') return startOffset + 2;
  if (ch === '!' && next === '|') return startOffset + 2;
  if (ch === '#' && next === '{') return startOffset + 2;
  return startOffset + 1;
}
