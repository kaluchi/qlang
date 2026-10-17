// HTML renderer over core's AST tokenizer. The token stream
// (kind + offsets) lives in @kaluchi/qlang-core/highlight; this
// file only paints each token kind into its `<span class="…">`
// envelope and HTML-escapes the slice, for the examples the build of the
// site paints and for the playground and the REPL of the site in the
// browser.
//
// Usage:
//   highlightQlang(src, builtins) → HTML string
//
//     `src`      qlang source text, no prompt prefix or result lines
//     `builtins` Set<string> of the names of verbs that resolve through
//                langRuntime — the playground builds this once at
//                startup and reuses it across every highlighted
//                snippet. Pass null to paint the name of every call
//                as a reader's name.
// The decisions it exists for: [QSWRK#tooling].

import { tokenize } from '@kaluchi/qlang-core/highlight';

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const KIND_TO_CLASS = {
  string:   'string',
  regex:    'regex',
  quote:    'quote',
  number:   'number',
  comment:  'comment',
  name:     'name',
  tag:      'tag',
  word:     'word',
  keyword:  'keyword',
  err:      'err',
  set:      'set',
  vec:      'vec',
  punct:    'punct'
};

export function highlightQlang(src, builtins) {
  const tokens = tokenize(src, builtins ?? new Set());
  let out = '';
  for (const { start, end, kind, italic } of tokens) {
    const slice = src.slice(start, end);
    const cls = KIND_TO_CLASS[kind];
    if (cls === undefined) {
      out += escHtml(slice);
    } else {
      const classes = italic ? `${cls} italic` : cls;
      out += `<span class="${classes}">${escHtml(slice)}</span>`;
    }
  }
  return out;
}
