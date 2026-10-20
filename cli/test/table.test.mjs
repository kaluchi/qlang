// The coverage of `table`: it runs through runQuery, so the bind
// reaches the runtime and every refusal fires through real eval.
// The rules it holds: [QSDSP#residence].

import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/run.mjs';
import { expectRefusalRaised, expectRefusalByAddress } from './helpers/error-assertions.mjs';
import { silentStreams } from './helpers/silent-streams.mjs';

describe('table — a view for a terminal', () => {
  it('draws a column per key, in the order of first occurrence across the rows', async () => {
    const cellEntry = await runQuery('[{:name "alice" :age 30} {:name "bob" :city "Oslo"}] | table', silentStreams);
    expect(cellEntry.result).toBe([
      '+-------+-----+------+',
      '| name  | age | city |',
      '+-------+-----+------+',
      '| alice | 30  |      |',
      '| bob   |     | Oslo |',
      '+-------+-----+------+'
    ].join('\n'));
  });

  it('prints a String cell bare, null as an empty cell, and a composite as its literal on one line', async () => {
    const cellEntry = await runQuery('[{:s "x" :n null :m {:a 1 :b 2 :c 3} :v [~(add 1) #[2 1]]}] | table', silentStreams);
    expect(cellEntry.result).toContain('| x |   | {:a 1 :b 2 :c 3} | [~(add 1) #[1 2]] |');
  });

  it('prints a tag over a set and a tagged atom as their literals', async () => {
    const cellEntry = await runQuery('[{:k ::Keys#[2 1] :c ::Count#42}] | table', silentStreams);
    expect(cellEntry.result).toContain('| ::Keys#[1 2] | ::Count#42 |');
  });

  it('prints composite cells as literals on one line and a null cell empty', async () => {
    const mapCell = await runQuery('[{:loc {:file "f.java" :line 12 :ok true}}] | table', silentStreams);
    expect(mapCell.result).toContain('{:file "f.java" :line 12 :ok true}');
    const errorCell = await runQuery('[{:err !{:kind :oops}}] | table', silentStreams);
    expect(errorCell.result).toContain('!{:kind :oops}');
    const nullCell = await runQuery('[{:a 1 :b null} {:a 2 :b 3}] | table', silentStreams);
    expect(nullCell.result.split('\n').find(line => line.includes('| 1 '))).toMatch(/\|\s+\|$/);
  });

  it('prints Boolean and Keyword cells bare, a null inside a composite as null', async () => {
    const booleanCells = await runQuery('[{:ok true} {:ok false}] | table', silentStreams);
    expect(booleanCells.result).toContain('| true  |');
    expect(booleanCells.result).toContain('| false |');
    const keywordCell = await runQuery('[{:status :ready}] | table', silentStreams);
    expect(keywordCell.result).toContain('| :ready |');
    const nullInVec = await runQuery('[{:tags [null 1]}] | table', silentStreams);
    expect(nullInVec.result).toContain('[null 1]');
  });

  it('prints a top-level String bare and a nested String quoted', async () => {
    const cellEntry = await runQuery('[{:name "Alice" :tags ["x" "y"]}] | table', silentStreams);
    expect(cellEntry.result).toMatch(/\| Alice\s+\|/);
    expect(cellEntry.result).toContain('["x" "y"]');
  });

  it('yields the marker (empty) for an empty Vec', async () => {
    const cellEntry = await runQuery('[] | table', silentStreams);
    expect(cellEntry.result).toBe('(empty)');
  });

  it('refuses a subject other than a vector under the address of table', async () => {
    const cellEntry = await runQuery('42 | table', silentStreams);
    expectRefusalByAddress(cellEntry, 'vec/table/SubjectNotVecError', { actualType: { name: 'number' } });
  });

  it('lifts VecTableRowKindNotTakenError on a row other than a Map, naming its kind', async () => {
    const cellEntry = await runQuery('[{:a 1} 42] | table', silentStreams);
    expectRefusalRaised(cellEntry, 'vec/table/RowKindNotTakenError', { actualType: { name: 'number' } });
  });
});
