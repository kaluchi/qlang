// Formatting operands: render a value as JSON or as a tabular
// string suitable for human consumption.
//
// Meta lives in lib/qlang/core.qlang.

import { nullaryOp } from './dispatch.mjs';
import {
  isVec,
  isQMap,
  isQSet,
  isKeyword,
  isErrorValue,
  describeType,
  keyword
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
    obj[isKeyword(k) ? k.name : String(k)] = toPlain(val);
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
    qlangMap.set(keyword(plainKey), fromPlain(nestedVal));
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
  Keyword:  k => ':' + k.name,
  Error:    (e, indent) => printMapLike('!{', e.descriptor, indent),
  Vec:      (v, indent) => `[${v.map(el => printValue(el, indent)).join(' ')}]`,
  Map:      (m, indent) => printMapLike('{', m, indent),
  Set:      (s, indent) => `#{${[...s].map(el => printValue(el, indent)).join(' ')}}`
};

export function printValue(v, indent = 0) {
  return dispatchQlangValue(v, PRINT_HANDLERS, String, indent);
}

function escapeQlangStringLiteral(s) {
  return `"${s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')}"`;
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
    const inner = entries.map(([k, v]) => `${printValue(k, indent)} ${printValue(v, indent)}`).join(' ');
    return `${open}${inner}}`;
  }
  const pad = '  '.repeat(indent + 1);
  const closePad = '  '.repeat(indent);
  const lines = entries.map(([k, v]) => `${pad}${printValue(k, indent + 1)} ${printValue(v, indent + 1)}`);
  return `${open}\n${lines.join('\n')}\n${closePad}}`;
}

export const table = nullaryOp('table', (subject) => {
  if (!isVec(subject)) throw new TableSubjectNotVec(describeType(subject), subject);
  if (subject.length === 0) return '(empty)';
  for (let i = 0; i < subject.length; i++) {
    if (!isQMap(subject[i])) {
      throw new TableRowNotMap(i, describeType(subject[i]), subject[i]);
    }
  }

  const rowKeyCaches = subject.map(buildRowCache);
  const columnNames = collectColumnOrder(rowKeyCaches);
  const widths = columnNames.map(name => name.length);

  const cells = rowKeyCaches.map(cache => columnNames.map((name, i) => {
    const key = cache.get(name);
    const text = key === undefined ? '' : String(toPlain(cache.row.get(key)));
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
    const name = isKeyword(k) ? k.name : String(k);
    byName.set(name, k);
  }
  return { row, get: (name) => byName.get(name) };
}

function collectColumnOrder(rowCaches) {
  const order = [];
  const seen = new Set();
  for (const cache of rowCaches) {
    for (const name of (function* () {
      for (const k of cache.row.keys()) {
        yield isKeyword(k) ? k.name : String(k);
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
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/json'),  json);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/table'), table);
