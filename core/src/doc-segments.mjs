// Doc-content tokenizer — splits a Doc-value's `.content` string
// into a Vec of segments, each one of:
//
//   Prose     — `{:qlang/kind :prose :text "..."}` for the raw
//               text between special tokens.
//   Quote     — Quote-value (frozen `.source`) for a `~{…}`
//               paired-delimiter code fragment.
//   TaggedLit — the value produced by invoking a `::tag`
//               constructor against its parsed payload (e.g.
//               `::link~{path}` or `::diagram[…]`).
//
// The tokenizer scans char-by-char for `~{` (Quote opener) and
// `::` (TaggedLit opener), parses the surrounding qlang fragment
// through the canonical parse() entry point, and emits the
// corresponding value-class. Anything between the openers (or
// before the first / after the last) becomes a Prose segment.

import { parse } from './parse.mjs';
import { evalAst } from './eval.mjs';
import { makeState } from './state.mjs';
import { keyword, makeQuote } from './types.mjs';

const PROSE_KIND = keyword('prose');

function makeProseSegment(text) {
  const m = new Map();
  m.set('qlang/kind', PROSE_KIND);
  m.set('text', text);
  return Object.freeze(m);
}

// Find the next opener (`~{` or `::`) at or after `from` in `content`.
// Returns { offset, kind } or null when none.
//   kind 'quote'  — `~{...}` paired Quote delimiter.
//   kind 'tagged' — `::tag<payload>` (TaggedLit, evaluated through
//                   the registered constructor).
// Keyword references (`:foo`), bare names, and stray `:` characters
// stay in Prose — the Doc-content canon is `:Prose` / `:Quote` /
// TaggedLit-built; further structure rides through `::tag`
// constructors authors register, no per-form grammar specialisation
// here.
function findNextOpener(content, from) {
  let best = null;
  for (let i = from; i < content.length; i++) {
    const ch = content[i];
    if (ch === '~' && content[i + 1] === '{') {
      best = { offset: i, kind: 'quote' };
      break;
    }
    if (ch === ':' && content[i + 1] === ':') {
      best = { offset: i, kind: 'tagged' };
      break;
    }
  }
  return best;
}

// Locate the position AFTER the matching `}` closer for a `~{...}`
// Quote starting at `start` (which points to `~`). Balance-counts
// `~{` opens against `}` closes; string-literal spans and nested
// `~{...}` Quote spans are skip-zones so inner `}` chars do not
// trip the outer close.
function findQuoteEnd(content, start) {
  let i = start + 2;
  let depth = 1;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '"') {
      i++;
      while (i < content.length && content[i] !== '"') {
        if (content[i] === '\\' && i + 1 < content.length) i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '~' && content[i + 1] === '{') {
      depth++;
      i += 2;
      continue;
    }
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
      i++;
      continue;
    }
    i++;
  }
  return -1;
}

// Locate the end of a `::tag<...>` TaggedLit at `start`. Peggy's
// startRule mode still demands end-of-input, so the tokenizer
// performs a bracket-balanced scan to find the matching close,
// then hands the carved-out substring to the parser.
const BRACKET_CLOSERS = { '(': ')', '[': ']', '{': '}' };

function findTaggedEnd(content, start) {
  let i = start + 2;
  while (i < content.length && /[\w@/-]/.test(content[i])) i++;
  while (i < content.length && /\s/.test(content[i])) i++;
  if (i >= content.length) return -1;
  const opener = content[i];
  if (opener === '~' && content[i + 1] === '{') {
    return findQuoteEnd(content, i);
  }
  if (opener === '"') {
    i++;
    while (i < content.length && content[i] !== '"') {
      if (content[i] === '\\') i++;
      i++;
    }
    return i < content.length ? i + 1 : -1;
  }
  const closer = BRACKET_CLOSERS[opener];
  if (!closer) return -1;
  let depth = 1;
  i++;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '~' && content[i + 1] === '{') {
      const end = findQuoteEnd(content, i);
      if (end === -1) return -1;
      i = end;
      continue;
    }
    if (ch === '"') {
      i++;
      while (i < content.length && content[i] !== '"') {
        if (content[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return -1;
}

function tryParseTaggedAt(content, start) {
  const end = findTaggedEnd(content, start);
  if (end === -1) return null;
  const slice = content.slice(start, end);
  try {
    const ast = parse(slice, { uri: 'doc-content/tagged', startRule: 'TaggedLit' });
    return { ast, length: end - start };
  } catch {
    return null;
  }
}

// Eval a TaggedLit AST in a fresh state (Doc-segment evaluation
// is independent of the outer pipeValue — segments are content,
// not pipeline steps). Constructor sees its own payload-value;
// state.env carries through for ::conduit-style env capture.
async function evalTaggedSegment(ast, env) {
  const state = makeState(null, env);
  const result = await evalAst(ast, state);
  return result.pipeValue;
}

export async function parseDocSegments(content, env) {
  const segments = [];
  let cursor = 0;
  while (cursor < content.length) {
    const opener = findNextOpener(content, cursor);
    if (opener === null) {
      const tail = content.slice(cursor);
      if (tail.length > 0) segments.push(makeProseSegment(tail));
      break;
    }
    if (opener.offset > cursor) {
      segments.push(makeProseSegment(content.slice(cursor, opener.offset)));
    }
    if (opener.kind === 'quote') {
      const endAfter = findQuoteEnd(content, opener.offset);
      if (endAfter === -1) {
        segments.push(makeProseSegment(content.slice(opener.offset)));
        break;
      }
      // opener.offset points to `~`; content slice between `~{` and `}` is the source.
      const source = content.slice(opener.offset + 2, endAfter - 1);
      segments.push(makeQuote(source));
      cursor = endAfter;
      continue;
    }
    const parsed = tryParseTaggedAt(content, opener.offset);
    if (parsed === null) {
      segments.push(makeProseSegment(content.slice(opener.offset, opener.offset + 2)));
      cursor = opener.offset + 2;
      continue;
    }
    const value = await evalTaggedSegment(parsed.ast, env);
    segments.push(value);
    cursor = opener.offset + parsed.length;
  }
  return Object.freeze(segments);
}
