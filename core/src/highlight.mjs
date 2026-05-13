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
//   'keyword'     `as` — the binding-introducing operand, plus the
//                 head Keyword/TagKeyword of a BindStep declaration
//   'err'         `!` sigil plus its immediately-attached bracket
//                 in `!{` / closing `}` of an `!{}` descriptor, and
//                 the `!|` fail-track combinator — anything that
//                 carries the fail-track semantic in qlang
//   'quote'       Quote literal `~{ … }`, including the paired
//                 `~{` opener and `}` closer (DocLit `|~~ … ~~|`
//                 falls under 'comment')
//   'type'        `::tag` head of a TaggedLit or a BareTypeKeyword —
//                 the type-namespace identifier sigil + name
//   'set'         `#{` opener and matching `}` closer of a SetLit
//   'vec'         `[` opener and matching `]` closer of a VecLit
//   'punct'       every other single-char or multi-char combinator
//                 (`|`, `*`, `>>`), the `{` / `}` of an ordinary
//                 MapLit, `(` / `)` of an operand-call arg list,
//                 commas, dots, and the `/` separator inside a
//                 `Projection`
//   'whitespace'  runs of whitespace between meaningful tokens, and
//                 the entire input on a parse failure (the safe
//                 fallback that lets live-typing scenarios render
//                 partial source without a span until the next
//                 keystroke makes it parseable again)

import { parse } from './parse.mjs';
import { walkAst } from './walk.mjs';
import { EFFECT_MARKER_PREFIX } from './effect.mjs';

const BINDING_OPERAND_NAMES = new Set(['as']);
const KEYWORD_SIGIL = ':';
const EFFECT_KEYWORD_PREFIX = KEYWORD_SIGIL + EFFECT_MARKER_PREFIX;

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

// Recursive call from QuoteLit handling: tokenise the Quote body
// the same way as the top-level source. Quote bodies parse through
// the full `Pipeline` rule including a leading combinator
// (`~{| count}`, `~{* mul(2)}`), so the same tokeniser pipeline
// applies without a separate start-rule. When the body is
// unparseable (rare malformed-suffix case), fall back to a single
// whitespace span so the renderer still paints the body uniformly
// italic.
function subTokenize(src, builtinNames) {
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
      case 'DocLit':
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
        const kind = keywordText.startsWith(EFFECT_KEYWORD_PREFIX) ? 'effect' : 'atom';
        spans.push({ start: startOffset, end: endOffset, kind });
        return false;
      }

      case 'ErrorLit':
        emitBracketSpans(startOffset, endOffset, 2, 1, 'err', spans);
        return;

      case 'QuoteLit': {
        // Quote literal — paint the `~{` / `}` delimiters in the
        // `quote` palette colour, then sub-tokenise the body source
        // recursively. Every inner span carries `italic: true` so
        // the renderer can compose italic + the inner kind's
        // colour (`atom` italic, `operand` italic, etc.) — the
        // visual cue is "this is code-as-data, painted in the same
        // palette as code-as-running but italicised".
        spans.push({ start: startOffset, end: startOffset + 2, kind: 'quote' });
        const bodyStart = startOffset + 2;
        const bodyEnd = endOffset - 1;
        const innerSource = src.slice(bodyStart, bodyEnd);
        const innerSpans = subTokenize(innerSource, builtinNames);
        for (const inner of innerSpans) {
          spans.push({
            start: bodyStart + inner.start,
            end:   bodyStart + inner.end,
            kind:  inner.kind,
            italic: true
          });
        }
        spans.push({ start: bodyEnd, end: endOffset, kind: 'quote' });
        return false;
      }

      case 'BindStep': {
        // The binding key — Keyword `:name` or BareTypeKeyword `::Tag` —
        // paints as 'keyword' (binding-introducer) so it is visually
        // distinct from a plain value-position `:name`. The attached
        // doc-prefix delimiters (`|~~ … ~~|` / `|~~| …`) do not
        // survive into the AST as standalone nodes — DocAttachedSequence
        // and the BindStep production both fold doc-content into the
        // `.docs` Vec of strings. The grammar stamps the prefix's
        // start offset on `docPrefixStart` (set by either the
        // wrapping DocAttachedSequence rule when docs sit before the
        // BindStep, or by the BindStep rule itself when docs sit
        // between key and body). The end of the prefix region is
        // wherever the next AST node begins: key for the external
        // case, body for the inline case.
        const key = node.key;
        const keyStart = key.location.start.offset;
        const keyEnd = key.location.end.offset;
        if (typeof node.docPrefixStart === 'number') {
          const prefixEnd = node.docPrefixStart < keyStart
            ? keyStart                                           // external (before key)
            : (node.body ? node.body.location.start.offset       // inline (key … docs … body)
                         : endOffset);
          spans.push({ start: node.docPrefixStart, end: prefixEnd, kind: 'comment' });
        }
        spans.push({ start: keyStart, end: keyEnd, kind: 'keyword' });
        return; // descend into docs / params / body
      }

      case 'BareTypeKeyword':
        spans.push({ start: startOffset, end: endOffset, kind: 'type' });
        return false;

      case 'TaggedLit': {
        // Cover the `::tag` head with a single 'type' span; descend
        // into the payload below so VecLit/MapLit/StringLit children
        // emit their own spans.
        const typeHeadEnd = startOffset + 2 + node.tag.length;
        spans.push({ start: startOffset, end: typeHeadEnd, kind: 'type' });
        return; // descend into payload
      }

      case 'SetLit':
        emitBracketSpans(startOffset, endOffset, 2, 1, 'set', spans);
        return;

      case 'VecLit':
      case 'JsonArrayLit':
        emitBracketSpans(startOffset, endOffset, 1, 1, 'vec', spans);
        return;

      case 'Projection':
        emitProjectionSpans(src, startOffset, endOffset, spans);
        return false;

      case 'OperandCall': {
        // Doc-attached `as(:name)` calls carry `docPrefixStart` from
        // DocAttachedSequence; the prose region between the first
        // doc-comment and the operand head is folded into the AST
        // as a plain string Vec, so the highlighter paints it with
        // one `comment`-kind span the same way it does for
        // BindStep (see the case above).
        if (typeof node.docPrefixStart === 'number' && node.docPrefixStart < startOffset) {
          spans.push({ start: node.docPrefixStart, end: startOffset, kind: 'comment' });
        }
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
  if (operandName.startsWith(EFFECT_MARKER_PREFIX)) return 'effect';
  if (BINDING_OPERAND_NAMES.has(operandName))       return 'keyword';
  if (builtinNames.has(operandName))                return 'operand';
  return 'atom';
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
      const { end: punctRunEnd, kind } = scanPunctRun(src, cursor);
      outputTokens.push({ start: cursor, end: punctRunEnd, kind });
      cursor = punctRunEnd;
    }
  }
}

// Resolve the kind of a single- or multi-char combinator run in a
// gap region. `!|` is the fail-track combinator and takes the `err`
// kind so renderers can paint it in the same palette as the `!{}`
// descriptor brackets. `#{` is not listed here because a well-
// formed set opener always arrives through the SetLit AST case
// above, and an unparseable source collapses to a single
// `whitespace` token before this scanner ever runs.
function scanPunctRun(src, startOffset) {
  const ch = src[startOffset];
  const next = src[startOffset + 1];
  if (ch === '>' && next === '>') return { end: startOffset + 2, kind: 'punct' };
  if (ch === '!' && next === '|') return { end: startOffset + 2, kind: 'err'   };
  return { end: startOffset + 1, kind: 'punct' };
}
