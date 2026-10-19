// VS Code extension entry point — starts the qlang language client
// that connects to the LSP server in ../lsp/src/server.mjs.
// The rules it holds: [QSWRK#tooling].

const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;
let qlang = null; // loaded async; null until ready

function activate(context) {
  const serverModule = path.resolve(__dirname, '..', '..', 'lsp', 'src', 'server.mjs');

  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio }
  };

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'qlang' }]
  };

  client = new LanguageClient('qlang', 'qlang Language Server', serverOptions, clientOptions);
  client.start();

  // The core loads by its name, a dependency of the extension's package,
  // and the tokenizer of the grammar paints until it has loaded [QSHST#source].
  import('@kaluchi/qlang-core')
    .then(m => { qlang = m; })
    .catch(e => console.warn('qlang markdown highlight: parser load failed:', e.message));

  return {
    extendMarkdownIt(md) {
      const originalHighlight = md.options.highlight;
      md.options.highlight = (code, lang, attrs) => {
        if (lang !== 'qlang') {
          return originalHighlight ? originalHighlight(code, lang, attrs) : '';
        }
        return highlightQlang(code);
      };
      return md;
    }
  };
}

function deactivate() {
  return client?.stop();
}

// ── Entry point ───────────────────────────────────────────────

function highlightQlang(code) {
  const lines = code.split('\n');
  const isRepl = lines.some(l => l.startsWith('> ') || l === '>');

  if (isRepl) {
    let inInput = false;
    return lines.map(line => {
      if (line.startsWith('> ')) {
        inInput = true;
        return `<span class="hljs-meta">&#62; </span>${tokenize(line.slice(2))}`;
      }
      if (line === '>') {
        inInput = true;
        return `<span class="hljs-meta">&#62;</span>`;
      }
      if (line === '') {
        inInput = false;
        return '';
      }
      // indented line after input prompt — pipeline continuation
      if (inInput && /^\s/.test(line)) {
        return tokenize(line);
      }
      // output / result value
      inInput = false;
      return `<span class="hljs-comment">${esc(line)}</span>`;
    }).join('\n');
  }

  return tokenize(code);
}

function tokenize(expr) {
  if (qlang) {
    try {
      return tokenizeWithParts(expr);
    } catch {
      // parse error — fall through to regex
    }
  }
  return tokenizeWithRegex(expr);
}

// ── The tokenizer over the parts the parser reads ─────────────

function tokenizeWithParts(code) {
  const { parse, partOf, walkParts, isCallStep, isKeyword, typeOf } = qlang;
  const annotations = [];

  walkParts(partOf(parse(code)), ({ value, span }) => {
    const s = span.start.offset;
    const e = span.end.offset;
    // A call is annotated by its name alone, not the whole call.
    if (isCallStep(value)) annotations.push({ start: s, end: s + value.get('name').name.length, cls: 'hljs-built_in' });
    else if (isKeyword(value)) annotations.push({ start: s, end: e, cls: 'hljs-type' });
    else if (typeof value === 'number') annotations.push({ start: s, end: e, cls: 'hljs-number' });
    else if (typeof value === 'string') annotations.push({ start: s, end: e, cls: 'hljs-string' });
    else if (typeOf(value).name === 'path') annotations.push({ start: s, end: e, cls: 'hljs-attr' });
  });

  return renderAnnotated(code, annotations);
}

function renderAnnotated(source, annotations) {
  annotations.sort((a, b) => a.start - b.start);
  let out = '';
  let pos = 0;
  for (const { start, end, cls } of annotations) {
    if (start >= pos) {
      if (start > pos) out += esc(source.slice(pos, start));
      out += `<span class="${cls}">${esc(source.slice(start, end))}</span>`;
      pos = end;
    }
  }
  if (pos < source.length) out += esc(source.slice(pos));
  return out;
}

// ── Regex fallback (used before parser loads or on parse error) ─

function tokenizeWithRegex(code) {
  let out = '';
  let i = 0;

  function span(cls, text) {
    return `<span class="${cls}">${esc(text)}</span>`;
  }

  while (i < code.length) {
    const ch = code[i];

    if (ch === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') j++;
      if (j < code.length) j++;
      out += span('hljs-string', code.slice(i, j));
      i = j;
    } else if (ch === ':' && /[a-zA-Z_]/.test(code[i + 1] ?? '')) {
      let j = i + 1;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      out += span('hljs-type', code.slice(i, j));
      i = j;
    } else if (ch === '/' && /[a-zA-Z_]/.test(code[i + 1] ?? '')) {
      let j = i;
      while (j < code.length && (code[j] === '/' || /[a-zA-Z0-9_]/.test(code[j]))) j++;
      out += span('hljs-attr', code.slice(i, j));
      i = j;
    } else if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      out += span('hljs-built_in', code.slice(i, j));
      i = j;
    } else if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < code.length && /[0-9.]/.test(code[j])) j++;
      out += span('hljs-number', code.slice(i, j));
      i = j;
    } else if (ch === '!' && code[i + 1] === '|') {
      // `!|`, the combinator that carries a failure, paints as one token.
      out += span('hljs-punctuation', '!|');
      i += 2;
    } else if ('|()[]{}'.includes(ch)) {
      out += span('hljs-punctuation', ch);
      i++;
    } else {
      out += esc(ch);
      i++;
    }
  }

  return out;
}

// ── Shared utils ──────────────────────────────────────────────

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { activate, deactivate };
