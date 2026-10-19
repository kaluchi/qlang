// highlightAnsi(source, verbNames) → the source painted for a terminal, each
// token of the core's `tokenize` in the colour of its kind among the eight of
// ANSI and their bright and dim variants, a token inside a quote in italics.
// The rules it holds: [QSWRK#tooling], [QSHST#repl].

import { tokenize } from '@kaluchi/qlang-core/highlight';

const ANSI_RESET = '\x1b[0m';

// The parameters of the escape of each kind, the blue and the magenta bright
// so a dark scheme does not swallow them, and a path the colour of the keys it
// reads; whitespace and the source past the parse have none.
const SGR_OF_KIND = {
  null:        '33',     // yellow
  boolean:     '33',
  number:      '33',
  string:      '32',     // green
  quote:       '32',
  regex:       '95',     // bright magenta
  keyword:     '36',     // cyan
  path:        '36',
  name:        '36',
  tag:         '96',     // bright cyan
  verb:        '94',     // bright blue
  declaration: '1;94',   // bold bright blue
  error:       '91',     // bright red
  fail:        '91',
  set:         '92',     // bright green
  vec:         '93',     // bright yellow
  doc:         '2',      // dim
  comment:     '2',
  map:         '90',     // bright black
  group:       '90',
  punctuation: '90'
};

function sgrFor(kind, italic) {
  const base = SGR_OF_KIND[kind];
  if (base === undefined) return italic ? '\x1b[3m' : undefined;
  return italic ? `\x1b[3;${base}m` : `\x1b[${base}m`;
}

export function highlightAnsi(source, verbNames) {
  let out = '';
  for (const { start, end, kind, italic } of tokenize(source, verbNames)) {
    const slice = source.slice(start, end);
    const ansi = sgrFor(kind, italic);
    out += ansi === undefined ? slice : ansi + slice + ANSI_RESET;
  }
  return out;
}
