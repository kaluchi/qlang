// format-operands coverage. Three operands, each round-tripped
// through runQuery so the bind reaches the runtime correctly and
// every per-site error site fires through real eval.

import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/run.mjs';
import { expectOperandErrorThrown } from './helpers/error-assertions.mjs';

const noopIo = {
  stdinReader: () => Promise.resolve(''),
  stdoutWrite: () => {},
  stderrWrite: () => {}
};

describe('pretty', () => {
  it('renders a number as its qlang literal form', async () => {
    const cellEntry = await runQuery('42 | pretty', noopIo);
    expect(cellEntry.result).toBe('42');
  });

  it('renders a String quoted as a qlang String literal', async () => {
    const cellEntry = await runQuery('"hello" | pretty', noopIo);
    expect(cellEntry.result).toBe('"hello"');
  });

  it('renders a Vec as the literal `[1 2 3]`', async () => {
    const cellEntry = await runQuery('[1 2 3] | pretty', noopIo);
    expect(cellEntry.result).toBe('[1 2 3]');
  });

  it('renders a keyword with the leading colon', async () => {
    const cellEntry = await runQuery(':active | pretty', noopIo);
    expect(cellEntry.result).toBe(':active');
  });
});

describe('tjson', () => {
  it('renders a number as its plain JSON form', async () => {
    const cellEntry = await runQuery('42 | tjson', noopIo);
    expect(cellEntry.result).toBe('42');
  });

  it('renders a keyword as the $keyword tagged form', async () => {
    const cellEntry = await runQuery(':role | tjson', noopIo);
    expect(cellEntry.result).toBe('{"$keyword":"role"}');
  });

  it('renders a Set as the vector under its tag in the $tagged form', async () => {
    const cellEntry = await runQuery('#[:b :a] | tjson', noopIo);
    expect(cellEntry.result).toBe('{"$tagged":{"$tag":"set","payload":[{"$keyword":"a"},{"$keyword":"b"}]}}');
  });

  it('renders a Map with keyword keys as the $map tagged form', async () => {
    const cellEntry = await runQuery('{:role :admin} | tjson', noopIo);
    expect(cellEntry.result).toBe('{"$map":[["role",{"$keyword":"admin"}]]}');
  });
});

describe('table — a view for a terminal', () => {
  it('draws a column per key, in the order of first occurrence across the rows', async () => {
    const cellEntry = await runQuery('[{:name "alice" :age 30} {:name "bob" :city "Oslo"}] | table', noopIo);
    expect(cellEntry.result).toBe([
      '-------+-----+------',
      '| name  | age | city |',
      '-------+-----+------',
      '| alice | 30  |      |',
      '| bob   |     | Oslo |',
      '-------+-----+------'
    ].join('\n'));
  });

  it('prints a String cell bare, null as an empty cell, and a composite as its literal on one line', async () => {
    const cellEntry = await runQuery('[{:s "x" :n null :m {:a 1 :b 2 :c 3} :v [~(add 1) #[2 1]]}] | table', noopIo);
    expect(cellEntry.result).toContain('| x |   | {:a 1 :b 2 :c 3} | [~(add 1) #[1 2]] |');
  });

  it('prints a tag over a set and a tagged scalar as their literals', async () => {
    const cellEntry = await runQuery('[{:k ::Keys#[2 1] :c ::Count(42)}] | table', noopIo);
    expect(cellEntry.result).toContain('| ::Keys#[1 2] | ::Count(42) |');
  });

  it('prints composite cells as literals on one line and a null cell empty', async () => {
    const mapCell = await runQuery('[{:loc {:file "f.java" :line 12 :ok true}}] | table', noopIo);
    expect(mapCell.result).toContain('{:file "f.java" :line 12 :ok true}');
    const errorCell = await runQuery('[{:err !{:kind :oops}}] | table', noopIo);
    expect(errorCell.result).toContain('::Error!{:kind :oops}');
    const nullCell = await runQuery('[{:a 1 :b null} {:a 2 :b 3}] | table', noopIo);
    expect(nullCell.result.split('\n').find(line => line.includes('| 1 '))).toMatch(/\|\s+\|$/);
  });

  it('prints Boolean and Keyword cells bare, a null inside a composite as null', async () => {
    const booleanCells = await runQuery('[{:ok true} {:ok false}] | table', noopIo);
    expect(booleanCells.result).toContain('| true  |');
    expect(booleanCells.result).toContain('| false |');
    const keywordCell = await runQuery('[{:status :ready}] | table', noopIo);
    expect(keywordCell.result).toContain('| :ready |');
    const nullInVec = await runQuery('[{:tags [null 1]}] | table', noopIo);
    expect(nullInVec.result).toContain('[null 1]');
  });

  it('prints a top-level String bare and a nested String quoted', async () => {
    const cellEntry = await runQuery('[{:name "Alice" :tags ["x" "y"]}] | table', noopIo);
    expect(cellEntry.result).toMatch(/\| Alice\s+\|/);
    expect(cellEntry.result).toContain('["x" "y"]');
  });

  it('yields the marker (empty) for an empty Vec', async () => {
    const cellEntry = await runQuery('[] | table', noopIo);
    expect(cellEntry.result).toBe('(empty)');
  });

  it('lifts TableSubjectNotVecError on a subject other than a Vec', async () => {
    const cellEntry = await runQuery('42 | table', noopIo);
    expectOperandErrorThrown(cellEntry, 'TableSubjectNotVecError', { actualType: { name: 'number' } });
  });

  it('lifts TableRowNotMapError on a row other than a Map, naming it', async () => {
    const cellEntry = await runQuery('[{:a 1} 42] | table', noopIo);
    expectOperandErrorThrown(cellEntry, 'TableRowNotMapError', { index: 1, actualType: { name: 'number' } });
  });
});
