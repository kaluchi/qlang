// ANSI renderer over core's AST tokenizer. Same token stream that
// site/src/lib/qlang-highlight.js paints into HTML spans, here
// painted into terminal-grade ANSI escapes for the CLI REPL.
//
// Colour palette is intentionally narrow — eight ANSI colours plus
// dim/bold modifiers. Renders identically across every standard
// terminal emulator and degrades gracefully if a downstream pipe
// strips the escapes.
//
// Usage:
//   highlightAnsi(src, builtinNames) → String with embedded ANSI escapes

import { tokenize } from '@kaluchi/qlang-core/highlight';

const ANSI_RESET = '\x1b[0m';

// Bright variants (9x) for the blue/magenta family so effect,
// operand, and keyword stay legible on themes that render the
// base-intensity dark blue (34) and dark magenta (35) close to
// black — Windows Terminal's default Campbell palette in
// particular blends both into the background on a dark scheme.
// SGR parameters per kind — numeric codes joined with `;` and
// wrapped in `\x1b[…m`. Stored as comma-list strings so the
// italic modifier can be merged into the same escape sequence
// (italic = `3`).
const KIND_TO_SGR = {
  string:   '32',         // green
  quote:    '32',         // green — `~{` / `}` delimiters; body
                          // spans get their per-kind colour + italic
                          // from the tokeniser's nested sub-tokens
  number:   '33',         // yellow
  comment:  '2',          // dim
  atom:     '36',         // cyan
  effect:   '95',         // bright magenta
  tag:      '96',         // bright cyan — `::tag` identifier
  operand:  '94',         // bright blue
  keyword:  '1;94',       // bold bright blue
  err:      '91',         // bright red — `!{}` + `!|`
  set:      '92',         // bright green — `#{}` set brackets
  vec:      '93',         // bright yellow — `[]` vec brackets
  punct:    '90'          // bright black (subtle grey)
  // 'whitespace' has no entry — emitted raw, no escape sequence.
};

function sgrFor(kind, italic) {
  const base = KIND_TO_SGR[kind];
  // Italic-only escape (`\x1b[3m`) when the span has no per-kind
  // colour but does carry the italic modifier — e.g. an unparseable
  // Quote body falls back to `whitespace` kind, but the body is still
  // inside a `~{...}` so the italic cue belongs.
  if (base === undefined) return italic ? '\x1b[3m' : undefined;
  return italic ? `\x1b[3;${base}m` : `\x1b[${base}m`;
}

export function highlightAnsi(src, builtinNames) {
  const tokens = tokenize(src, builtinNames);
  let out = '';
  for (const { start, end, kind, italic } of tokens) {
    const slice = src.slice(start, end);
    const ansi = sgrFor(kind, italic);
    out += ansi === undefined ? slice : ansi + slice + ANSI_RESET;
  }
  return out;
}
