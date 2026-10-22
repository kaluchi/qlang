import { it, expect } from 'vitest';
import { runQuery } from '../../src/run.mjs';
import { silentStreams } from '../helpers/silent-streams.mjs';

it('`table` draws a column per key, in the order of first occurrence across the rows', async () => {
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

it('prints an error cell as its literal', async () => {
  const errorCell = await runQuery('[{:err !{:kind :oops}}] | table', silentStreams);
  expect(errorCell.result).toContain('!{:kind :oops}');
});

it('prints a boolean and a keyword cell as their literals, a null inside a composite as null', async () => {
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

it('writes a quote of declarations on one line, steps that read back as the same steps', async () => {
  const cellEntry = await runQuery('[{:q ~(:a 1\n| :b 2)}] | table', silentStreams);
  expect(cellEntry.result).toContain('| ~(:a 1 | :b 2) |');
  expect((await runQuery('"~(:a 1 | :b 2)" | parse | first | eq ~(:a 1\n| :b 2)', silentStreams)).result).toBe(true);
});

it('writes a doc of several lines on one line, each line break as a space, the view its page names', async () => {
  const cellEntry = await runQuery('[{:d |~~ one\n  two ~~|}] | table', silentStreams);
  expect(cellEntry.result).toContain('| |~~ one two ~~| |');
});

it('writes every part of a quote on one line, the modifiers of a call, the docs and the body of a declaration, a chain with its pages, the step after !| and the parts of a literal', async () => {
  const declarations = '~(:a 1\n| :b 2)';
  const cellEntry = await runQuery(`get [{:s ~(::vec/sort | source) :q ~(~(map ~(:x |~~ one\n  two ~~| 1\n| :b 2))) :f ~(~(get /a !| map ${declarations})) :v ~(~([${declarations}] | count)) :e ~(~(#[${declarations}] | count)) :m ~(~({:k ${declarations}} | count)) :t ~(~(::T[${declarations}] | count))}] | table | lines | count`, silentStreams);
  expect(cellEntry.result).toBe(5);
});

it('writes a doc on one line with the quotes it holds on one line too', async () => {
  const cellEntry = await runQuery('[{:d |~~ see\n  ~(:a 1\n| :b 2) ~~|}] | table', silentStreams);
  expect(cellEntry.result).toContain('| |~~ see ~(:a 1 | :b 2) ~~| |');
});
