import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';

it('`filter` takes its predicate as code, a quote or a path, on each kind that declares it', async () => {
  expect(await evalQuery('[::vec/filter ::map/filter] | map ~(binding | get /value | inputs | map /kinds) | print')).toBe('[[#[::path ::quote]] [#[::path ::quote]]]');
});

it('`filter` over a map runs a predicate that names a value as that value for each entry, true keeping every entry and false none', async () => {
  expect(await evalQuery('get [~(true | :n it | {:a 1 :b 2} | filter ~(n) | count) ~(false | :n it | {:a 1 :b 2} | filter ~(n) | count)]')).toEqual([2, 0]);
});
