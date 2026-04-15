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
const KIND_TO_ANSI = {
  string:   '\x1b[32m',     // green
  number:   '\x1b[33m',     // yellow
  comment:  '\x1b[2m',      // dim
  atom:     '\x1b[36m',     // cyan
  effect:   '\x1b[95m',     // bright magenta
  operand:  '\x1b[94m',     // bright blue
  keyword:  '\x1b[1;94m',   // bold bright blue
  err:      '\x1b[91m',     // bright red — `!{}` brackets + `!|`
  set:      '\x1b[92m',     // bright green — `#{}` set brackets
                            // (off the cyan axis used by the prompt
                            // `qlang>` and the `atom` kind so the
                            // three stay visually distinct)
  vec:      '\x1b[93m',     // bright yellow — `[]` vec brackets
  punct:    '\x1b[90m'      // bright black (subtle grey)
  // 'whitespace' has no entry — emitted raw, no escape sequence.
};

export function highlightAnsi(src, builtinNames) {
  const tokens = tokenize(src, builtinNames);
  let out = '';
  for (const { start, end, kind } of tokens) {
    const slice = src.slice(start, end);
    const ansi = KIND_TO_ANSI[kind];
    out += ansi === undefined ? slice : ansi + slice + ANSI_RESET;
  }
  return out;
}
