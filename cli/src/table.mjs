// The primitive of `table`, the renderer of the command line, a name its
// source declares under `::vec` [QSDSP#residence], taking the vector the
// walk served alone [QSQUO#modifier].

import { kindsExpected, printValue, typeOf } from '@kaluchi/qlang-core';
import { declareRefusal, refusingAPart } from '@kaluchi/qlang-core/errors';

const VecTableRowKindNotTakenError     = declareRefusal('vec/table/RowKindNotTakenError');

// A cell is a view at the boundary: a string bare, null empty, and any other
// value its literal on the printer's one line [QSPRN#print].
function cellTextOf(cellValue) {
  if (cellValue === null) return '';
  if (typeof cellValue === 'string') return cellValue;
  return printValue(cellValue, 0, docOnOneLine, true);
}

// A doc on one line, each line break of its prose and the space around it one space.
const LINE_BREAK = /\s*\n\s*/g;

function docOnOneLine(part) {
  if (typeOf(part).name !== 'doc') return undefined;
  return `|~~${part.map(segment => (typeof segment === 'string' ? segment.replace(LINE_BREAK, ' ') : printValue(segment, 0, docOnOneLine, true))).join('')}~~|`;
}

// Columns follow the first occurrence of each key across the rows.
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
