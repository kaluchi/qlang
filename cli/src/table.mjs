// [QSDSP#residence], [QSQUO#modifier]

import { kindsExpected, printValue, tagOf } from '@kaluchi/qlang-core';
import { declareRefusal, refusingAPart } from '@kaluchi/qlang-core/errors';

const VecTableRowKindNotTakenError     = declareRefusal('vec/table/RowKindNotTakenError');

// [QSPRN#print]
function cellTextOf(cellValue) {
  if (cellValue === null) return '';
  if (typeof cellValue === 'string') return cellValue;
  return printValue(cellValue, 0, docOnOneLine, true);
}

const LINE_BREAK = /\s*\n\s*/g;

function docOnOneLine(part) {
  if (tagOf(part).name !== 'doc') return undefined;
  return `|~~ ${part.map(segment => (typeof segment === 'string' ? segment.replace(LINE_BREAK, ' ') : printValue(segment, 0, docOnOneLine, true))).join('')} ~~|`;
}

function columnOrderOf(rows) {
  const columnNames = new Set();
  for (const row of rows) for (const columnName of row.keys()) columnNames.add(columnName);
  return [...columnNames];
}

function table(subject) {
  if (subject.length === 0) return '(empty)';
  subject.forEach((row, rowIndex) => {
    if (!(row instanceof Map)) throw refusingAPart(new VecTableRowKindNotTakenError({ expected: kindsExpected('map'), actualValue: row }), rowIndex);
  });
  const columnNames = columnOrderOf(subject);
  const widths = columnNames.map(columnName => columnName.length);
  const cells = subject.map(row => columnNames.map((columnName, columnIndex) => {
    const cellText = row.has(columnName) ? cellTextOf(row.get(columnName)) : '';
    widths[columnIndex] = Math.max(widths[columnIndex], cellText.length);
    return cellText;
  }));
  const horizontalRule = '+' + widths.map(width => '-'.repeat(width + 2)).join('+') + '+';
  const formatRow = rowCells => '|' + rowCells.map((cellText, columnIndex) => ' ' + cellText.padEnd(widths[columnIndex]) + ' ').join('|') + '|';
  return [horizontalRule, formatRow(columnNames), horizontalRule, ...cells.map(formatRow), horizontalRule].join('\n');
}

export const tablePrimitives = {
  'vec/table': table
};
