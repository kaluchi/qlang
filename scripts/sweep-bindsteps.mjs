// One-shot migration: `|~~ docs ~~| def(:name, body)` (and the
// 3-arg parametric form) → BindStep form `:name |~~ docs ~~| body`.
//
// Usage: node scripts/sweep-bindsteps.mjs <file> [<file>...]
//
// Strategy: parse each input through the qlang grammar, walk the
// Pipeline.steps array for `OperandCall { name: 'def', args }`
// nodes, generate a BindStep replacement, and splice the original
// source range [doc-prefix-start, def-end] with the new BindStep
// source.
//
// `.docs` (Vec of strings) and `args[0..2]` give us name / params? /
// body. The doc-prefix's source start is located by scanning back
// from the def OperandCall's location.start.offset through
// preceding doc-comment markers.

import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from '../core/src/parse.mjs';
import { walkAst } from '../core/src/walk.mjs';

function bindingKeySource(arg) {
  if (arg.type === 'Keyword') return ':' + arg.name;
  if (arg.type === 'BareTypeKeyword') return '::' + arg.tag;
  throw new Error('unexpected name-arg type: ' + arg.type);
}

function findDocPrefixStart(source, defNode) {
  // Grammar's `DocAttachedSequence` stamps `docPrefixStart` on the
  // bound OperandCall — the offset of the FIRST doc-comment in the
  // attached prefix. Use that authoritative position; fall back to
  // the def-step's own start when no prefix attached. Then snap to
  // the line beginning so the replacement starts at column 0 (the
  // leading indent / blank-line space gets folded into the new
  // BindStep emission).
  const anchor = typeof defNode.docPrefixStart === 'number'
    ? defNode.docPrefixStart
    : defNode.location.start.offset;
  let lineStart = anchor;
  while (lineStart > 0 && source[lineStart - 1] !== '\n') lineStart--;
  return lineStart;
}

function reindent(textBlock, indent) {
  return textBlock.split('\n').map((line, idx) => {
    if (idx === 0) return line;
    return line === '' ? '' : indent + line;
  }).join('\n');
}

function buildBindStep(defNode, source) {
  const args = defNode.args;
  if (!args || args.length === 0) {
    throw new Error('def() with no args at ' + defNode.location.start.line);
  }
  const nameArg = args[0];
  let paramsArg = null;
  let bodyArg = null;
  if (args.length === 3) {
    paramsArg = args[1];
    bodyArg = args[2];
  } else if (args.length === 2) {
    bodyArg = args[1];
  }
  // args.length === 1 — doc-only declaration, no body.

  const lines = [bindingKeySource(nameArg)];
  for (const doc of defNode.docs ?? []) {
    lines.push('  |~~' + doc + '~~|');
  }
  if (paramsArg !== null) {
    const paramsText = source.slice(paramsArg.location.start.offset, paramsArg.location.end.offset);
    lines.push('  ' + reindent(paramsText, '  '));
  }
  if (bodyArg !== null) {
    // Pipeline body needs ParenGroup wrapping — BindStep's body slot
    // accepts a single Primary, not a multi-step Pipeline. The
    // original `def(:name, <pipeline>)` captured-arg slot allowed
    // PipelineInLiteral (which can be a Pipeline node); BindStep
    // tightens that to Primary so multi-step bodies must declare
    // their scope explicitly.
    const bodyText = source.slice(bodyArg.location.start.offset, bodyArg.location.end.offset);
    const wrappedBody = bodyArg.type === 'Pipeline'
      ? '(' + bodyText + ')'
      : bodyText;
    lines.push('  ' + reindent(wrappedBody, '  '));
  }
  return lines.join('\n');
}

function sweepFile(source) {
  const ast = parse(source, { uri: 'sweep' });
  const replacements = [];
  walkAst(ast, (node) => {
    if (node.type !== 'OperandCall') return;
    if (node.name !== 'def') return;
    const start = findDocPrefixStart(source, node);
    const end = node.location.end.offset;
    const newText = buildBindStep(node, source);
    replacements.push({ start, end, newText });
  });

  replacements.sort((a, b) => b.start - a.start);
  let out = source;
  for (const { start, end, newText } of replacements) {
    out = out.slice(0, start) + newText + out.slice(end);
  }
  return out;
}

const files = process.argv.slice(2);
let touched = 0;
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let after;
  try {
    after = sweepFile(before);
  } catch (e) {
    console.error('SKIP', file, '—', e.message.slice(0, 200));
    continue;
  }
  if (before !== after) {
    writeFileSync(file, after);
    touched++;
    console.log('updated', file);
  }
}
console.log(`${touched}/${files.length} touched`);
