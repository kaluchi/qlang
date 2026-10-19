// Grammar contract: where a doc stands.
//   1. An element of a vector or a set, a literal as any other; before
//      the key of a map entry — parse error.
//   2. In the slot of a declaration, between its name and its body, it
//      documents the declaration; before a declaration it is refused
//      [D367].

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import { evalQuery } from '../../src/session.mjs';

describe('a doc before the key of a map entry is a parse error', () => {
  it('refuses a doc ahead of the key of an entry', () => {
    expect(() => parse('{|~~ doc ~~| :k 1}')).toThrow();
  });
});

describe('a doc is an element of a vector or a set by itself', () => {
  it('a Doc-value at the head of a Vec is its first element', async () => {
    const result = await evalQuery('[|~~ doc ~~| 42] | first | type | eq ::doc');
    expect(result).toBe(true);
  });
});

describe('a doc documents the declaration whose slot it stands in', () => {
  it('documents a declaration', async () => {
    const result = await evalQuery(':x |~~ note ~~| 42 | ::x | doc | content');
    expect(result).toBe(' note ');
  });

  it('documents a declaration of it', async () => {
    const result = await evalQuery('42 | :x |~~ note ~~| it | ::x | doc | content');
    expect(result).toBe(' note ');
  });

  it('holds the docs of the slot as the record of the declaration holds any doc', () => {
    const [declaration] = parse(':x |~~ one ~~| |~~ two ~~| 42');
    expect(declaration.get('docs').map(doc => [...doc])).toEqual([[' one '], [' two ']]);
  });

  it('refuses a doc written before a declaration, on its line or the one above', () => {
    expect(() => parse('|~~ note ~~| :x 42')).toThrow(/slot of the declaration/);
    expect(() => parse('5 | |~~ note ~~| :x 42')).toThrow(/slot of the declaration/);
    expect(() => parse('|~~| note\n:x 42')).toThrow(/slot of the declaration/);
    expect(() => parse(':y 1\n|~~ note ~~|\n:x 42')).toThrow(/slot of the declaration/);
  });

  it('a doc ahead of any other step chains explicitly with `|`', async () => {
    // The doc value lands as a separate pipeline step that the next
    // verb (here `segments`) sees as its subject.
    const result = await evalQuery('|~~ inline note ~~| | segments | count');
    expect(result).toBe(1);
  });
});

