import { it, expect } from 'vitest';
import { parseSource } from '../../../src/parse.mjs';
import { readsItsSubject } from '../../../src/parsed-parts.mjs';
const readsOf = query => readsItsSubject(parseSource(query));

it('a literal of no parts reads no subject, a path among them', () => {
  for (const query of ['1', '"s"', 'true', 'null', ':k', '::vec', '/a']) expect(readsOf(query), query).toBe(false);
});

it('a quote reads none, its code not run', () => {
  expect(readsOf('~(get /a)')).toBe(false);
});

it('a literal of parts reads none, its parts literals, and a group reads it where its code does', () => {
  for (const query of ['[1 2]', '#[1]', '{:a 1}', '!{:a 1}', '::Box{:k 1}', '::Width#5', '[~(get /a) 1]', '{:a ~(get /b)}', '(1 | add 1)', '|~~ see ::link~(get /x) ~~|', '[/a 1]', '{:a /b}']) {
    expect(readsOf(query), query).toBe(false);
  }
  for (const query of ['get [/a 1]', 'get {:a /b}', '(get /a)', '((get /a) | count)']) expect(readsOf(query), query).toBe(true);
});

it('a query headed by a noun reads none, the streams and the host it asks among them', () => {
  for (const query of ['::stdio | in | count', '(::stdio | in) | count', ':x 1; ::stdio | in', '::host | kinds']) expect(readsOf(query), query).toBe(false);
  for (const query of ['count | stdio/out', 'stdio/out']) expect(readsOf(query), query).toBe(true);
});

it('a query reads past a step of the fail track at its head, which runs on a failure alone', () => {
  for (const query of ['!| 5 | count', '!| 5']) expect(readsOf(query), query).toBe(true);
  expect(readsOf('!| count | (1)')).toBe(false);
});

it('a call and a blank query read the subject', () => {
  for (const query of ['get /a', 'doc', '']) expect(readsOf(query), query).toBe(true);
});

it('a pipeline reads by its first step that declares nothing', () => {
  expect(readsOf('1 | add 1')).toBe(false);
  expect(readsOf('/a/0 | segments')).toBe(false);
  expect(readsOf('::vec | doc')).toBe(false);
  expect(readsOf('doc | get [1]')).toBe(true);
  expect(readsOf(':two 2; [1]')).toBe(false);
});

it('a declaration reads no subject, and a text of declarations alone reads none', () => {
  for (const query of [':x (get /a); [1]', ':two 2;', ':a 1; :b 2;', ':Box |~~ A box. ~~|; [1]']) expect(readsOf(query), query).toBe(false);
  expect(readsOf(':two 2; count')).toBe(true);
});
