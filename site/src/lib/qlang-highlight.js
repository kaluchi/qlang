// AST-based syntax highlighter for qlang source.
//
// Hybrid strategy: walkAst() harvests semantic spans from leaf nodes
// (string/number literals, keyword atoms, operand names, projections,
// comments); gaps between those spans (combinators, brackets, whitespace)
// are classified by a small pattern scanner.
//
// Works in both Node.js (Astro build time) and browser (playground).
// Callers supply `parse` and `walkAst` so the module stays dependency-free.
//
// Usage:
//   highlightQlang(src, parse, walkAst) → HTML string

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sp(cls, text) {
  return `<span class="${cls}">${esc(text)}</span>`;
}

const BINDING_KEYWORDS = new Set(['let', 'as']);

// Collect leaf-level highlighted spans from the AST.
// Returns array of { start, end, render(text) → html } sorted by start.
function collectSpans(src, ast, walkAst, builtins) {
  const spans = [];

  walkAst(ast, (node) => {
    if (!node.location) return;
    const s = node.location.start.offset;
    const e = node.location.end.offset;

    switch (node.type) {
      case 'LinePlainComment':
      case 'LineDocComment':
      case 'BlockPlainComment':
      case 'BlockDocComment':
        spans.push({ start: s, end: e, render: t => sp('comment', t) });
        return false; // no children to descend

      case 'StringLit':
        spans.push({ start: s, end: e, render: t => sp('string', t) });
        return false;

      case 'NumberLit':
        spans.push({ start: s, end: e, render: t => sp('number', t) });
        return false;

      case 'BooleanLit':
      case 'NullLit':
        spans.push({ start: s, end: e, render: t => sp('number', t) });
        return false;

      case 'Keyword': {
        // :name atom — full span including the colon.
        // :@name is an effectful binding declaration — use .effect class.
        const kwText = src.slice(s, e);
        const cls = kwText.startsWith(':@') ? 'effect' : 'atom';
        spans.push({ start: s, end: e, render: t => sp(cls, t) });
        return false;
      }

      case 'Projection': {
        // /key or /key1/key2 — split each segment into / (punct) + field (operand)
        spans.push({
          start: s, end: e,
          render: t => {
            let out = '';
            let i = 0;
            while (i < t.length) {
              if (t[i] === '/') {
                out += sp('punct', '/');
                i++;
                let j = i;
                while (j < t.length && t[j] !== '/') j++;
                if (j > i) out += sp('operand', t.slice(i, j));
                i = j;
              } else {
                out += esc(t[i++]);
              }
            }
            return out;
          }
        });
        return false;
      }

      case 'OperandCall': {
        // Highlight only the name token; args are handled by descendant spans.
        const nameEnd = s + node.name.length;
        if (node.name.startsWith('@')) {
          // @name — effectful call, rendered as one unified .effect span
          spans.push({ start: s, end: nameEnd, render: t => sp('effect', t) });
        } else if (BINDING_KEYWORDS.has(node.name)) {
          spans.push({ start: s, end: nameEnd, render: t => sp('keyword', t) });
        } else if (builtins.has(node.name)) {
          spans.push({ start: s, end: nameEnd, render: t => sp('operand', t) });
        } else {
          // User-defined: conduit params, local names — same green as :name atoms
          spans.push({ start: s, end: nameEnd, render: t => sp('atom', t) });
        }
        // Descend into args normally
        break;
      }
      // Pipeline, VecLit, MapLit, ParenGroup etc. — not highlighted directly;
      // their structure becomes gap characters or is covered by child spans.
    }
  });

  // Sort by start offset; on ties prefer the narrower span (child wins).
  spans.sort((a, b) => a.start - b.start || (a.end - a.start) - (b.end - b.start));

  // Remove overlapping spans: advance cursor strictly, skip anything starting
  // before the cursor (a parent whose name-range was already emitted by a child,
  // or duplicate hits on the same position).
  const result = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start >= cursor) {
      result.push(span);
      cursor = span.end;
    }
  }
  return result;
}

// Emit HTML for gap text (combinators, brackets, whitespace).
function renderGap(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '>' && s[i + 1] === '>') {
      out += sp('punct', '>>'); i += 2;
    } else if (ch === '!' && s[i + 1] === '|') {
      out += sp('punct', '!|'); i += 2;
    } else if (ch === '#' && s[i + 1] === '{') {
      out += sp('punct', '#{'); i += 2;
    } else if (ch === '|' && s[i + 1] !== '~') {
      out += sp('punct', '|'); i++;
    } else if (ch === '*') {
      out += sp('punct', '*'); i++;
    } else if ('()[]{},.'.includes(ch)) {
      out += sp('punct', ch); i++;
    } else {
      out += esc(ch); i++;
    }
  }
  return out;
}

/**
 * Highlight a qlang source string.
 *
 * @param {string}   src      — qlang source (no prompt prefix, no result lines)
 * @param {Function} parse    — qlang `parse` function
 * @param {Function} walkAst  — qlang `walkAst` function
 * @param {Set}      builtins — Set of builtin operand name strings from langRuntime()
 * @returns {string} HTML string with <span class="…"> highlighting
 *                   Falls back to HTML-escaped plain text on parse error.
 */
export function highlightQlang(src, parse, walkAst, builtins) {
  let ast;
  try {
    ast = parse(src);
  } catch {
    return esc(src);
  }

  const spans = collectSpans(src, ast, walkAst, builtins);

  let out = '';
  let pos = 0;
  for (const { start, end, render } of spans) {
    if (start > pos) out += renderGap(src.slice(pos, start));
    out += render(src.slice(start, end));
    pos = end;
  }
  if (pos < src.length) out += renderGap(src.slice(pos));

  return out;
}
