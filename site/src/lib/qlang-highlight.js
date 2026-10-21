// highlightQlang(source, verbNames) → the HTML of a source for the examples
// the build of the site paints and for its playground and its REPL, each token
// of the core's `tokenize` a span whose class is its kind, `italic` beside it
// inside a quote, which `site/src/styles/global.css` coats; every call is a
// name where no names of the root's words are handed.
// The rules it holds: [QSWRK#tooling], [QSHST#tokens].

import { tokenize } from '@kaluchi/qlang-core/highlight';

const escaped = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function highlightQlang(source, verbNames) {
  return tokenize(source, verbNames ?? new Set())
    .map(({ start, end, kind, italic }) => `<span class="${italic ? `${kind} italic` : kind}">${escaped(source.slice(start, end))}</span>`)
    .join('');
}
