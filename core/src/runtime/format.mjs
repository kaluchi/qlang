// Formatting operands: render a value as JSON or as a tabular
// string suitable for human consumption.
//
// Meta lives in lib/qlang/core.qlang.

import { canonicalKeywordLiteral } from '../keyword-literal.mjs';
import { nullaryOp } from './dispatch.mjs';
import {
  isVec,
  isQMap,
  isQSet,
  isErrorValue,
  describeType
} from '../types.mjs';
import {
  declareSubjectError,
  declareElementError
} from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

// One shared dispatch: `describeType(v)` classifies any qlang value
// into a stable string kind ('Null' | 'Number' | 'String' |
// 'Boolean' | 'Keyword' | 'Vec' | 'Map' | 'Set' | 'Error' | …).
// Each consumer keeps only a kind→handler table — the "what kind
// is this?" probe lives in one place (types.mjs), and the "what to
// do per kind?" logic sits next to the consumer's intent. No
// if-chain of `isKeyword` / `isVec` / `isQMap` / … repeats per
// site. Kinds not listed in a handler table fall through to the
// consumer's `fallback(v)` — normally an exotic-value escape hatch
// (qlang types that never enter pipeValue under Variant-B dispatch:
// conduit, snapshot, function).
function dispatchQlangValue(v, handlers, fallback, ...extraArgs) {
  const handler = handlers[describeType(v)];
  return handler ? handler(v, ...extraArgs) : fallback(v, ...extraArgs);
}

function dispatchPlainValue(v, handlers) {
  if (Array.isArray(v)) return handlers.array(v);
  if (v !== null && typeof v === 'object') return handlers.object(v);
  return handlers.scalar(v);
}

const TableSubjectNotVec = declareSubjectError('TableSubjectNotVec', 'table', 'Vec');
const TableRowNotMap     = declareElementError('TableRowNotMap',     'table', 'Map');

// Inverse pair: `toPlain` lifts a qlang value to a JSON-serializable
// plain JS shape (Map → object with keyword-named string keys, Vec →
// array, Set → array, error → `{$error: …}`); `fromPlain` lifts a
// plain JS shape back into qlang (object → Map keyed by interned
// keywords, array → Vec, scalars pass through). Together they bridge
// the language with any external system that speaks JSON — the
// `parseJson` / `json` operands, the script-mode auto-pipe of stdin
// in the CLI, and any future host that bridges qlang values with
// plain-JS data structures.
//
// `toPlain` is exported for direct unit-level coverage of the
// exotic-value fallback path — the public `json` operand feeds this
// function from inside nullaryOp, but no qlang-level path reaches
// the `String(v)` branch because raw function values never enter
// pipeValue under Variant-B dispatch.
const TO_PLAIN_HANDLERS = {
  Null:     () => null,
  Number:   v => v,
  String:   v => v,
  Boolean:  v => v,
  Keyword:  k => ':' + k.name,
  Vec:      v => v.map(toPlain),
  Map:      qMapToPlainObject,
  Set:      s => [...s].map(toPlain),
  Error:    e => ({ $error: toPlain(e.descriptor) })
};

export function toPlain(v) {
  return dispatchQlangValue(v, TO_PLAIN_HANDLERS, String);
}

function qMapToPlainObject(m) {
  const obj = {};
  for (const [k, val] of m) {
    obj[k] = toPlain(val);
  }
  return obj;
}

const FROM_PLAIN_HANDLERS = {
  array:  a => a.map(fromPlain),
  object: plainObjectToQMap,
  scalar: v => v
};

export function fromPlain(plainVal) {
  return dispatchPlainValue(plainVal, FROM_PLAIN_HANDLERS);
}

function plainObjectToQMap(plainObj) {
  const qlangMap = new Map();
  for (const [plainKey, nestedVal] of Object.entries(plainObj)) {
    qlangMap.set(plainKey, fromPlain(nestedVal));
  }
  return qlangMap;
}

export const json = nullaryOp('json', (subject) => JSON.stringify(toPlain(subject)));

// printValue(v, indent?) → qlang literal string
//
// Serializes any qlang runtime value to the source form that,
// if parsed and evaluated, reproduces the same value. This is
// the canonical display function for REPLs and tooling.
// Maps and errors with more than 2 entries are pretty-printed
// with one entry per line for readability.
const PRINT_HANDLERS = {
  Null:     () => 'null',
  Boolean:  v => String(v),
  Number:   v => String(v),
  String:   escapeQlangStringLiteral,
  Keyword:  k => k.literal,
  Error:    (e, indent) => printMapLike('!{', e.descriptor, indent),
  Vec:      (v, indent) => `[${v.map(el => printValue(el, indent)).join(' ')}]`,
  Map:      (m, indent) => printMapLike('{', m, indent),
  Set:      (s, indent) => `#{${[...s].map(el => printValue(el, indent)).join(' ')}}`,
  Quote:    q => '`' + q.source + '`',
  Doc:      d => '|~~' + d.content + '~~|',
  Conduit:  printConduit,
  Snapshot: printSnapshot,
  Function: printFunction
};

export function printValue(v, indent = 0) {
  return dispatchQlangValue(v, PRINT_HANDLERS, String, indent);
}

function printConduit(conduit) {
  const name = conduit.get('name');
  const params = conduit.get('params');
  const body = conduit.get('qlang/body');
  const source = body?.text ?? '…';
  const docPrefix = conduit.get('docs').map(doc => `|~~ ${doc} ~~|\n`).join('');
  const paramList = `[${params.map(p => canonicalKeywordLiteral(p)).join(', ')}]`;
  // Anonymous conduits (no name) render as the canonical
  // `::conduit[...]` tagged literal — the form an author would
  // type to construct one inline. Named conduits render as the
  // def-step that introduced them, so reify of a `def`-bound
  // conduit round-trips back through the same syntax.
  if (name == null) {
    return `${docPrefix}::conduit[${paramList} \`${source}\`]`;
  }
  const nameKw = canonicalKeywordLiteral(name);
  if (params.length > 0) {
    return `${docPrefix}def(${nameKw}, ${paramList}, ${source})`;
  }
  return `${docPrefix}def(${nameKw}, ${source})`;
}

function printSnapshot(snapshot) {
  return printValue(snapshot.get('qlang/value'));
}

function printFunction(fn) {
  return `:qlang/prim/${fn.name}`;
}

function escapeQlangStringLiteral(s) {
  return `"${s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
    .replace(/[\b]/g, '\\b')
    .replace(/\f/g, '\\f')}"`;
}

function printMapLike(open, m, indent) {
  const entries = [...m];
  // Inline only when the Map is small AND every value is a flat
  // scalar — a nested Map / Vec / Set / Error forces multi-line
  // so deeply-nested structures unfold one entry per row instead
  // of slamming the trailing close-braces onto a single line.
  const hasComposite = entries.some(([_k, v]) =>
    isQMap(v) || isVec(v) || isQSet(v) || isErrorValue(v));
  if (entries.length <= 2 && !hasComposite) {
    const inner = entries.map(([k, v]) => `${canonicalKeywordLiteral(k)} ${printValue(v, indent)}`).join(' ');
    return `${open}${inner}}`;
  }
  const pad = '  '.repeat(indent + 1);
  const closePad = '  '.repeat(indent);
  const lines = entries.map(([k, v]) => `${pad}${canonicalKeywordLiteral(k)} ${printValue(v, indent + 1)}`);
  return `${open}\n${lines.join('\n')}\n${closePad}}`;
}

// Cell renderer for the `table` operand. Scalars render bare
// (strings without quotes, numbers stringified, null as an empty
// cell). Composites render as inline qlang literals — no newline
// breaks — so a nested `:location` Map shows up as
// `{:file … :startLine 12}` rather than as `[object Object]`.
// Nested scalars inside a composite quote strings the same way
// printValue does; only the top-level String in a cell is bare.
const CELL_HANDLERS = {
  Null:     () => '',
  Boolean:  v => String(v),
  Number:   v => String(v),
  String:   v => v,
  Keyword:  k => k.literal,
  Vec:      v => renderInline(v),
  Map:      m => renderInline(m),
  Set:      s => renderInline(s),
  Error:    e => renderInline(e),
  Quote:    q => '`' + q.source + '`',
  Doc:      d => '|~~' + d.content + '~~|',
  Conduit:  c => `def(${canonicalKeywordLiteral(c.get('name'))}, ${c.get('qlang/body')?.text ?? '…'})`,
  Snapshot: s => `as(${canonicalKeywordLiteral(s.get('name'))})`,
  Function: fn => `:qlang/prim/${fn.name}`
};

const INLINE_HANDLERS = {
  Null:     () => 'null',
  Boolean:  v => String(v),
  Number:   v => String(v),
  String:   escapeQlangStringLiteral,
  Keyword:  k => k.literal,
  Vec:      v => `[${v.map(renderInline).join(' ')}]`,
  Map:      m => `{${mapEntriesInline(m)}}`,
  Set:      s => `#{${[...s].map(renderInline).join(' ')}}`,
  Quote:    q => '`' + q.source + '`',
  Doc:      d => '|~~' + d.content + '~~|',
  Conduit:  c => `def(${canonicalKeywordLiteral(c.get('name'))}, ${c.get('qlang/body')?.text ?? '…'})`,
  Snapshot: s => `as(${canonicalKeywordLiteral(s.get('name'))})`,
  Function: fn => `:qlang/prim/${fn.name}`,
  Error:    e => `!{${mapEntriesInline(e.descriptor)}}`
};

function renderInline(v) {
  return dispatchQlangValue(v, INLINE_HANDLERS, String);
}

function mapEntriesInline(m) {
  return [...m]
    .map(([k, v]) => `${canonicalKeywordLiteral(k)} ${renderInline(v)}`)
    .join(' ');
}

function renderCell(v) {
  return dispatchQlangValue(v, CELL_HANDLERS, String);
}

export const table = nullaryOp('table', (subject) => {
  if (!isVec(subject)) throw new TableSubjectNotVec(subject);
  if (subject.length === 0) return '(empty)';
  for (let i = 0; i < subject.length; i++) {
    if (!isQMap(subject[i])) {
      throw new TableRowNotMap(i, subject[i]);
    }
  }

  const rowKeyCaches = subject.map(buildRowCache);
  const columnNames = collectColumnOrder(rowKeyCaches);
  const widths = columnNames.map(name => name.length);

  const cells = rowKeyCaches.map(cache => columnNames.map((name, i) => {
    const key = cache.get(name);
    const text = key === undefined ? '' : renderCell(cache.row.get(key));
    if (text.length > widths[i]) widths[i] = text.length;
    return text;
  }));

  const horizontalRule = widths.map(w => '-'.repeat(w + 2)).join('+');
  const formatRow = (rowCells) =>
    '|' + rowCells.map((c, i) => ' ' + c.padEnd(widths[i]) + ' ').join('|') + '|';

  return [
    horizontalRule,
    formatRow(columnNames),
    horizontalRule,
    ...cells.map(formatRow),
    horizontalRule
  ].join('\n');
});

function buildRowCache(row) {
  const byName = new Map();
  for (const k of row.keys()) {
    byName.set(k, k);
  }
  return { row, get: (name) => byName.get(name) };
}

function collectColumnOrder(rowCaches) {
  const order = [];
  const seen = new Set();
  for (const cache of rowCaches) {
    for (const name of (function* () {
      for (const k of cache.row.keys()) {
        yield k;
      }
    })()) {
      if (!seen.has(name)) {
        seen.add(name);
        order.push(name);
      }
    }
  }
  return order;
}

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind('qlang/prim/json',  json);
PRIMITIVE_REGISTRY.bind('qlang/prim/table', table);
