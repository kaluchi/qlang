// Formatting operands: render a value as JSON or as a tabular
// string suitable for human consumption.

import { nullaryOp } from './dispatch.mjs';
import { TypeError as QTypeError } from '../errors.mjs';
import {
  isVec, isQMap, isQSet, isKeyword, describeType
} from '../types.mjs';

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

export const json = nullaryOp('json', (subject) => {
  return JSON.stringify(toPlain(subject));
});

export const table = nullaryOp('table', (subject) => {
  if (!isVec(subject)) {
    throw new QTypeError(`table requires Vec subject, got ${describeType(subject)}`);
  }
  if (subject.length === 0) return '(empty)';
  if (!subject.every(isQMap)) {
    throw new QTypeError('table requires a Vec of Maps');
  }
  // Collect column keys in insertion order across all rows.
  const columnOrder = [];
  const seen = new Set();
  for (const row of subject) {
    for (const k of row.keys()) {
      const name = isKeyword(k) ? k.name : String(k);
      if (!seen.has(name)) {
        seen.add(name);
        columnOrder.push(name);
      }
    }
  }
  // Compute column widths.
  const widths = columnOrder.map(c => c.length);
  const cells = subject.map(row => columnOrder.map((c, i) => {
    const k = [...row.keys()].find(k => (isKeyword(k) ? k.name : String(k)) === c);
    const val = k === undefined ? '' : String(toPlain(row.get(k)));
    if (val.length > widths[i]) widths[i] = val.length;
    return val;
  }));
  const sep = (sym) => widths.map(w => sym.repeat(w + 2)).join('+');
  const formatRow = (rowCells) => '|' +
    rowCells.map((c, i) => ' ' + c.padEnd(widths[i]) + ' ').join('|') + '|';
  const lines = [
    sep('-'),
    formatRow(columnOrder),
    sep('-'),
    ...cells.map(formatRow),
    sep('-')
  ];
  return lines.join('\n');
});
