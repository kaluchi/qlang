// highlightAnsi(src, builtinNames) → the source painted for a terminal:
// the tokens of the core's tokenizer, which the site paints as HTML, each
// in the colour of its kind among the eight of ANSI and their bright and
// dim variants.
// The decisions it exists for: [D241].

import { tokenize } from '@kaluchi/qlang-core/highlight';

const ANSI_RESET = '\x1b[0m';

// The parameters of the escape of each kind, the blue and the magenta
// bright so a dark scheme does not swallow them; whitespace has none.
const KIND_TO_SGR = {
  string:   '32',         // green
  regex:    '95',         // bright magenta — a pattern `#"…"`
  quote:    '32',         // green — `~(` and `)`, the body in italics
  number:   '33',         // yellow
  comment:  '2',          // dim
  name:     '36',         // cyan
  tag:      '96',         // bright cyan — `::tag` identifier
  word:     '94',         // bright blue
  keyword:  '1;94',       // bold bright blue
  err:      '91',         // bright red — `!{}` + `!|`
  set:      '92',         // bright green — `#[]` set brackets
  vec:      '93',         // bright yellow — `[]` vec brackets
  punct:    '90'          // bright black (subtle grey)
};

function sgrFor(kind, italic) {
  const base = KIND_TO_SGR[kind];
  // A span of a quote with no colour of its kind keeps the italics.
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
