// The comments of a file of the tree, each read by the parser of its language
// [QSREQ#rigor]: a module of JavaScript by acorn; a source of the catalog by
// the parser of the core, which keeps its comments and the spans of its docs;
// and the grammar by the parser of peggy, the code of its initializers, its
// actions and its predicates by acorn and a comment of the grammar where the
// parser leaves no literal, no class and no code. A file of a language the tree
// holds no parser of, a page of the site and a workflow, is read by the form of
// its comment line.

import { parse as parseJavaScript } from 'acorn';
import peggy from 'peggy';
import { parseSource } from '../core/src/parse.mjs';
import { forEachPart, partOf } from '../core/src/parsed-parts.mjs';
import { isDoc } from '../core/src/types.mjs';

const JAVASCRIPT = /\.(?:mjs|js)$/;
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*|#)/;

function commentsOfJavaScript(code, offset = 0, options = {}) {
  const found = [];
  parseJavaScript(code, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, ...options, onComment: (block, value, start, end) => found.push({ start: start + offset, end: end + offset, value }) });
  return found;
}

function rangesOfCatalog(text, uri, docs) {
  const root = partOf(parseSource(text, { uri }));
  const ranges = root.comments.map(({ location, content }) => ({ start: location.start.offset, end: location.end.offset, value: content }));
  if (docs) {
    forEachPart(root, part => {
      if (!isDoc(part.value)) return true;
      ranges.push({ start: part.span.start.offset, end: part.span.end.offset });
      return false;
    });
  }
  return ranges;
}

function rangesOfGrammar(text, grammarSource) {
  const ranges = [];
  const opaque = [];
  const visit = node => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.codeLocation !== undefined) {
      const { start, end } = node.codeLocation;
      opaque.push({ start: start.offset - 1, end: end.offset + 1 });
      ranges.push(...commentsOfJavaScript(text.slice(start.offset, end.offset), start.offset, { allowReturnOutsideFunction: true }));
    }
    if ((node.type === 'literal' || node.type === 'class') && node.location !== undefined) opaque.push({ start: node.location.start.offset, end: node.location.end.offset });
    if (node.type === 'named' && node.location !== undefined) opaque.push({ start: node.location.start.offset, end: node.expression.location.start.offset });
    for (const key of Object.keys(node)) if (!key.endsWith('ocation')) visit(node[key]);
  };
  visit(peggy.parser.parse(text, { grammarSource }));
  opaque.sort((left, right) => left.start - right.start);
  let at = 0;
  for (const { start, end } of [...opaque, { start: text.length, end: text.length }]) {
    for (let cursor = at; cursor < start; cursor += 1) {
      if (text.startsWith('//', cursor)) {
        const close = text.indexOf('\n', cursor);
        const stop = close === -1 || close > start ? start : close;
        ranges.push({ start: cursor, end: stop, value: text.slice(cursor + 2, stop) });
        cursor = stop;
      } else if (text.startsWith('/*', cursor)) {
        const close = text.indexOf('*/', cursor + 2);
        const stop = close === -1 ? start : Math.min(close + 2, start);
        ranges.push({ start: cursor, end: stop, value: text.slice(cursor + 2, Math.max(cursor + 2, stop - 2)) });
        cursor = stop;
      }
    }
    at = Math.max(at, end);
  }
  return ranges;
}

function rangesOfCommentLines(text) {
  const ranges = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    const after = line.indexOf(' // ');
    if (COMMENT_LINE.test(line)) ranges.push({ start: offset, end: offset + line.length, value: line });
    else if (after !== -1) ranges.push({ start: offset + after, end: offset + line.length, value: line.slice(after + 4) });
    offset += line.length + 1;
  }
  return ranges;
}

const READ = new Map();

// commentRanges(path, text, { docs }) → each comment the file holds, `{ start,
// end, value }` in the order of the text, its offsets and what it says, and
// each doc of a source of the catalog where `docs` asks for them.
export function commentRanges(path, text, { docs = false } = {}) {
  const key = `${docs}\u0000${path}\u0000${text}`;
  let ranges = READ.get(key);
  if (ranges === undefined) {
    if (JAVASCRIPT.test(path)) ranges = commentsOfJavaScript(text);
    else if (path.endsWith('.qlang')) ranges = rangesOfCatalog(text, path, docs);
    else if (path.endsWith('.peggy')) ranges = rangesOfGrammar(text, path);
    else ranges = rangesOfCommentLines(text);
    ranges.sort((left, right) => left.start - right.start);
    READ.set(key, ranges);
  }
  return ranges;
}

// linesOfComments(path, text, { docs }) → for each line, `{ holds, names,
// within }`: what it holds of the code and what it names in its comments, and
// in its docs where `docs` asks for them, and whether a comment runs over it
// from a line before to a line after.
export function linesOfComments(path, text, options) {
  const ranges = commentRanges(path, text, options);
  const lines = [];
  let offset = 0;
  let next = 0;
  for (const line of text.split('\n')) {
    const end = offset + line.length;
    let holds = '';
    let names = '';
    let within = false;
    let cursor = offset;
    while (next < ranges.length && ranges[next].end <= offset) next += 1;
    for (let index = next; index < ranges.length && ranges[index].start < end; index += 1) {
      const from = Math.max(ranges[index].start, offset);
      const to = Math.min(ranges[index].end, end);
      if (ranges[index].start < offset && ranges[index].end > end) within = true;
      if (from > cursor) holds += text.slice(cursor, from);
      names += text.slice(Math.max(from, cursor), to);
      cursor = Math.max(cursor, to);
    }
    holds += text.slice(cursor, end);
    lines.push({ holds: holds.replace(/\r$/, ''), names: names.replace(/\r$/, ''), within });
    offset = end + 1;
  }
  return lines;
}
