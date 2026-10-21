import { describe, it, expect } from 'vitest';
import { parse } from '../../../src/parse.mjs';
import { readsItsSubject } from '../../../src/walk.mjs';
// A query reads its subject where its first step that declares nothing
// does, or a declaration's body before it; a host waits on the stream it
// lifts the subject from only then.
describe('readsItsSubject', () => {
  const readsOf = query => readsItsSubject(parse(query));

  it('holds that a literal of no parts reads no subject, a path among them', () => {
    for (const query of ['1', '"s"', 'true', 'null', ':k', '::vec', '/a']) expect(readsOf(query), query).toBe(false);
  });

  it('holds that a quote reads none, its code not run', () => {
    expect(readsOf('~(get /a)')).toBe(false);
  });

  it('holds that a literal of parts reads none, its parts literals, and a group reads it where its code does', () => {
    for (const query of ['[1 2]', '#[1]', '{:a 1}', '!{:a 1}', '::Box{:k 1}', '::Width#5', '[~(get /a) 1]', '{:a ~(get /b)}', '(1 | add 1)', '|~~ see ::link~(get /x) ~~|', '[/a 1]', '{:a /b}']) {
      expect(readsOf(query), query).toBe(false);
    }
    for (const query of ['get [/a 1]', 'get {:a /b}', '(get /a)', '((get /a) | count)']) expect(readsOf(query), query).toBe(true);
  });

  it('reads none where its first step that declares nothing calls a verb of the host that reads none, by its name or its address', () => {
    const verbs = new Set(['in', 'any/in']);
    for (const query of ['in | count', 'any/in', '(in) | count', ':x 1 | in']) expect(readsItsSubject(parse(query), verbs), query).toBe(false);
    for (const query of ['count | in', ':x (get /a) | in', 'vec/in']) expect(readsItsSubject(parse(query), verbs), query).toBe(true);
    expect(readsOf('in')).toBe(true);
  });

  it('reads such a verb called by its name as reading the subject where a declaration before it shadows the name, its address left the host\'s', () => {
    const verbs = new Set(['in', 'any/in']);
    for (const query of [':vec/in ~(count) | in', ':in ~(count) | in', '(:string/in ~(count) | in)']) expect(readsItsSubject(parse(query), verbs), query).toBe(true);
    expect(readsItsSubject(parse(':vec/in ~(count) | any/in'), verbs)).toBe(false);
  });

  it('reads past a step of the fail track at its head, which runs on a failure alone, a declaration under it among them', () => {
    for (const query of ['!| 5 | count', '!| :x 1 | count', '!| 5']) expect(readsOf(query), query).toBe(true);
    expect(readsItsSubject(parse('!| in | count'), new Set(['in']))).toBe(true);
    for (const query of ['!| count | (1)', '!| :x (get /a) | [1]']) expect(readsOf(query), query).toBe(false);
  });

  it('holds that a call and a blank query read it', () => {
    for (const query of ['get /a', 'doc', '']) expect(readsOf(query), query).toBe(true);
  });

  it('reads a pipeline by its first step that declares nothing', () => {
    expect(readsOf('1 | add 1')).toBe(false);
    expect(readsOf('/a/0 | segments')).toBe(false);
    expect(readsOf('::vec | doc')).toBe(false);
    expect(readsOf('doc | get [1]')).toBe(true);
    expect(readsOf(':two 2 | [1]')).toBe(false);
  });

  it('reads a declaration whose body reads, and a query of declarations alone', () => {
    expect(readsOf(':x (get /a) | [1]')).toBe(true);
    expect(readsOf(':two 2')).toBe(true);
    expect(readsOf(':a 1 | :b 2')).toBe(true);
    expect(readsOf(':Box |~~ A box. ~~| | [1]')).toBe(false);
  });
});
