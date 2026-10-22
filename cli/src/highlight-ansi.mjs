// [QSWRK#tooling], [QSCLI#colour]

import { tokenize } from '@kaluchi/qlang-core/highlight';

const ANSI_RESET = '\x1b[0m';

const SGR_OF_KIND = {
  null:        '33',
  boolean:     '33',
  number:      '33',
  string:      '32',
  quote:       '32',
  regex:       '95',
  keyword:     '36',
  path:        '36',
  name:        '36',
  tag:         '96',
  verb:        '94',
  declaration: '1;94',
  error:       '91',
  fail:        '91',
  set:         '92',
  vec:         '93',
  doc:         '2',
  comment:     '2',
  map:         '90',
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
