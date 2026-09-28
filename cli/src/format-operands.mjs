// The primitive of `table`, the renderer of the command line, a verb of
// the noun `::qlang/cli` [D92] and a plain function over the vector the
// head of its verb checks [D80].

import { declareSubjectError, declareElementError } from '@kaluchi/qlang-core/operand-errors';
import { printValue } from '@kaluchi/qlang-core';

declareSubjectError('TableSubjectNotVecError', 'table', 'vec');
const TableRowNotMapError     = declareElementError('TableRowNotMapError',     'table', 'map');

// A cell is a view at the boundary: a String prints bare, null as an
// empty cell, and every other value as its literal on one line.
function cellTextOf(cellValue) {
  if (cellValue === null) return '';
  if (typeof cellValue === 'string') return cellValue;
  return printValue(cellValue)
    .replace(/([[{(])\n\s*/g, '$1')
    .replace(/\n\s*([\]})])/g, '$1')
    .replace(/\n\s*/g, ' ');
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
    if (!(row instanceof Map)) throw new TableRowNotMapError(rowIndex, row);
  });
  const columnNames = columnOrderOf(subject);
  const widths = columnNames.map(columnName => columnName.length);
  const cells = subject.map(row => columnNames.map((columnName, columnIndex) => {
    const cellText = row.has(columnName) ? cellTextOf(row.get(columnName)) : '';
    widths[columnIndex] = Math.max(widths[columnIndex], cellText.length);
    return cellText;
  }));
  const horizontalRule = widths.map(width => '-'.repeat(width + 2)).join('+');
  const formatRow = rowCells => '|' + rowCells.map((cellText, columnIndex) => ' ' + cellText.padEnd(widths[columnIndex]) + ' ').join('|') + '|';
  return [horizontalRule, formatRow(columnNames), horizontalRule, ...cells.map(formatRow), horizontalRule].join('\n');
}

export const formatImpls = {
  table
};
