// HTML renderer over core's AST tokenizer. The token stream
// (kind + offsets) lives in @kaluchi/qlang-core/highlight; this
// file only paints each token kind into its `<span class="…">`
// envelope and HTML-escapes the slice. Same renderer is reused by
// the playground (browser) and the docs build (Node) — core ships
// pure JS with zero runtime deps so both bundles inline cleanly.
//
// Usage:
//   highlightQlang(src, builtins) → HTML string
//
//     `src`      qlang source text, no prompt prefix or result lines
//     `builtins` Set<string> of operand names that resolve through
//                langRuntime — the playground builds this once at
//                startup and reuses it across every highlighted
//                snippet. Pass null to treat every OperandCall name
//                as user-defined.

import { tokenize } from '@kaluchi/qlang-core/highlight';

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const KIND_TO_CLASS = {
  string:   'string',
  number:   'number',
  comment:  'comment',
  atom:     'atom',
  effect:   'effect',
  operand:  'operand',
  keyword:  'keyword',
  err:      'err',
  set:      'set',
  vec:      'vec',
  punct:    'punct'
};

export function highlightQlang(src, builtins) {
  const tokens = tokenize(src, builtins ?? new Set());
  let out = '';
  for (const { start, end, kind } of tokens) {
    const slice = src.slice(start, end);
    const cls = KIND_TO_CLASS[kind];
    if (cls === undefined) {
      out += escHtml(slice);
    } else {
      out += `<span class="${cls}">${escHtml(slice)}</span>`;
    }
  }
  return out;
}
