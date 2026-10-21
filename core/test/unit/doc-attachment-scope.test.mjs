// A doc in the slot of a declaration, between its name and its body,
// documents the declaration, and one written before a declaration is
// refused [QSSYN#doc].

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';

describe('a doc documents the declaration whose slot it stands in', () => {
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
});

