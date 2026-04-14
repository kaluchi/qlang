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

const TableSubjectNotVec = declareSubjectError('TableSubjectNotVec', 'table', 'Vec');
const TableRowNotMap     = declareElementError('TableRowNotMap',     'table', 'Map');

// Convert a qlang value into a JSON-serializable plain value.
// Exported for direct unit-level coverage of the exotic-value
// fallback path — the public `json` operand feeds this function
// from inside nullaryOp, but no qlang-level path reaches the
// String(v) branch because raw function values never enter
// pipeValue under Variant-B dispatch.
export function toPlain(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (isKeyword(v)) return ':' + v.name;
  if (isVec(v)) return v.map(toPlain);
  if (isQMap(v)) {
    const obj = {};
    for (const [k, val] of v) {
      obj[isKeyword(k) ? k.name : String(k)] = toPlain(val);
    }
    return obj;
  }
  if (isQSet(v)) {
    return [...v].map(toPlain);
  }
  if (isErrorValue(v)) {
    return { $error: toPlain(v.descriptor) };
  }
  return String(v);
}

export const json = nullaryOp('json', (subject) => JSON.stringify(toPlain(subject)));

// printValue(v, indent?) → qlang literal string
//
// Serializes any qlang runtime value to the source form that,
// if parsed and evaluated, reproduces the same value. This is
// the canonical display function for REPLs and tooling.
// Maps and errors with more than 2 entries are pretty-printed
// with one entry per line for readability.
export function printValue(v, indent = 0) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r')}"`;
  if (isKeyword(v)) return `:${v.name}`;
  if (isErrorValue(v)) return printMapLike('!{', v.descriptor, indent);
  if (isVec(v)) return `[${v.map(el => printValue(el, indent)).join(' ')}]`;
  if (isQMap(v)) return printMapLike('{', v, indent);
  if (isQSet(v)) return `#{${[...v].map(el => printValue(el, indent)).join(' ')}}`;
  return String(v);
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
