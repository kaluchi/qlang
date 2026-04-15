// Render a qlang demo block (as used in the landing page examples) to
// highlighted HTML.
//
// Input format — each line is one of:
//   |~| ...    — doc-comment / label line
//   > expr     — REPL prompt + qlang expression
//     expr     — pipeline continuation (two-space indent)
//   result     — plain result / output line
//
// All qlang source lines (prompt + continuation) are concatenated before
// highlighting so multi-line expressions get correct context, then the
// highlighted lines are mapped back 1-to-1.
//
// @param {string}   code     — raw demo block text
// @param {Function} parse    — qlang `parse` function
// @param {Function} walkAst  — qlang `walkAst` function
// @param {Set}      builtins — Set of builtin operand name strings
// @returns {string} HTML string

import { highlightQlang } from './qlang-highlight.js';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function classifyLines(lines) {
  return lines.map(line => {
    if (/^\|~/.test(line))     return { type: 'comment', content: line };
    if (line.startsWith('> ')) return { type: 'prompt',  content: line.slice(2) };
    if (/^ {2}\S/.test(line))    return { type: 'cont',    content: line.slice(2) };
    return { type: 'result', content: line };
  });
}

export function formatExample(code, builtins) {
  const infos = classifyLines(code.split('\n'));

  const combined = infos
    .filter(l => l.type === 'prompt' || l.type === 'cont')
    .map(l => l.content)
    .join('\n');
  const hlSplit = highlightQlang(combined, builtins).split('\n');

  let codeIdx = 0;
  return infos.map(({ type, content }) => {
    switch (type) {
      case 'comment': return `<span class="comment">${esc(content)}</span>`;
      case 'prompt':  return `<span class="punct">&gt; </span>${hlSplit[codeIdx++] ?? ''}`;
      case 'cont':    return `  ${hlSplit[codeIdx++] ?? ''}`;
      default:        return highlightQlang(content, builtins);
    }
  }).join('\n');
}
