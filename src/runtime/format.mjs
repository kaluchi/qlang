// Formatting operands: render a value as JSON or as a tabular
// string suitable for human consumption.

import { nullaryOp } from './dispatch.mjs';
import {
  isVec,
  isQMap,
  isQSet,
  isKeyword,
  describeType
} from '../types.mjs';
import {
  declareSubjectError,
  declareElementError
} from './operand-errors.mjs';

const TableSubjectNotVec = declareSubjectError('TableSubjectNotVec', 'table', 'Vec');
const TableRowNotMap     = declareElementError('TableRowNotMap',     'table', 'Map');

// Convert a qlang value into a JSON-serializable plain value.
function toPlain(v) {
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
  return String(v);
}

export const json = nullaryOp('json', (subject) => JSON.stringify(toPlain(subject)));

// table — render a Vec of Maps as a fixed-width tabular string.
// Empty Vec yields the marker '(empty)'. Heterogeneous Vecs
// (mixed Map and non-Map elements) raise a type error.
//
// Implementation builds a per-row keyword-name → key cache once,
// keeping column lookups O(1) instead of O(rows × cols²).
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

// buildRowCache(row) — { row, get(name) → key }
// Caches keyword-name → key lookups for one row so the layout
// loop above does not re-scan map.keys() per cell.
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
