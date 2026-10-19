// The HTML of a block of qlang in a preview of markdown, painted by the core's
// tokens, each kind coated by a class of highlight.js the preview colours: a
// block that holds a prompt, `> `, is the queries after its prompts, each with
// the indented lines that follow it, and the answers below them, and any other
// block one source [QSHST#tools].
// The rules it holds: [QSHST#tools].

// The class of highlight.js each kind is coated by, a path the class of the
// keys it reads; a kind with none is written plain.
const CLASS_OF_KIND = {
  null:        'hljs-literal',
  boolean:     'hljs-literal',
  number:      'hljs-number',
  string:      'hljs-string',
  quote:       'hljs-string',
  regex:       'hljs-regexp',
  keyword:     'hljs-attr',
  path:        'hljs-attr',
  tag:         'hljs-type',
  verb:        'hljs-built_in',
  name:        'hljs-variable',
  declaration: 'hljs-keyword',
  error:       'hljs-keyword',
  fail:        'hljs-keyword',
  doc:         'hljs-comment',
  comment:     'hljs-comment',
  vec:         'hljs-punctuation',
  set:         'hljs-punctuation',
  map:         'hljs-punctuation',
  group:       'hljs-punctuation',
  punctuation: 'hljs-punctuation'
};

const PROMPT = /^>(?: |$)/;

const escaped = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The HTML of a source, a token inside a quote leaning.
function painted(source, { tokenize, verbNames }) {
  return tokenize(source, verbNames).map(({ start, end, kind, italic }) => {
    const coat = italic ? `${CLASS_OF_KIND[kind] ?? ''} hljs-emphasis`.trim() : CLASS_OF_KIND[kind];
    const text = escaped(source.slice(start, end));
    return coat === undefined ? text : `<span class="${coat}">${text}</span>`;
  }).join('');
}

// blockHtml(code, painter) → the HTML of a block painted by `painter.tokenize`
// with the names of the root's words `painter.verbNames` holds, or '' while
// the core's painter has not loaded, which markdown-it writes plain [QSHST#tools].
function blockHtml(code, painter) {
  if (painter.tokenize === null) return '';
  const lines = code.split('\n');
  if (!lines.some(line => PROMPT.test(line))) return painted(code, painter);
  const html = [];
  for (let at = 0; at < lines.length;) {
    const prompt = PROMPT.exec(lines[at])?.[0];
    let end = at + 1;
    if (prompt !== undefined) while (end < lines.length && /^\s+\S/.test(lines[end])) end += 1;
    else while (end < lines.length && lines[end] !== '' && !PROMPT.test(lines[end])) end += 1;
    const source = [lines[at].slice(prompt?.length ?? 0), ...lines.slice(at + 1, end)].join('\n');
    const paintedLines = painted(source, painter).split('\n');
    if (prompt !== undefined) paintedLines[0] = `<span class="hljs-meta">${escaped(prompt)}</span>${paintedLines[0]}`;
    html.push(...paintedLines);
    at = end;
  }
  return html.join('\n');
}

module.exports = { blockHtml };
