// Grammar contract: where a doc stands.
//   1. Inside a literal body (Map / Vec / Set entries) — parse error.
//   2. In the slot of a declaration, between its name and its body, it
//      documents the declaration; before a declaration it is refused
//      [D83].
//   3. MapEntry AST node carries no .docs field.

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import { evalQuery } from '../../src/eval.mjs';
import { makeTagKeyword } from '../../src/types.mjs';

describe('doc-prefix inside MapEntry literal is a parse error', () => {
  it('rejects a doc-comment ahead of a MapEntry key', () => {
    expect(() => parse('{|~~ doc ~~| :k 1}')).toThrow();
  });
});

describe('DocLit literal is a Vec / Set element by itself', () => {
  it('a Doc-value at the head of a Vec is its first element', async () => {
    const result = await evalQuery('[|~~ doc ~~| 42] | first | type | eq ::doc');
    expect(result).toBe(true);
  });
});

describe('a doc documents the declaration whose slot it stands in', () => {
  it('documents a declaration', async () => {
    const result = await evalQuery(':x |~~ note ~~| 42 | :x | docs * /content');
    expect(result).toEqual([' note ']);
  });

  it('documents a freeze', async () => {
    const result = await evalQuery('42 | :x |~~ note ~~| / | :x | docs * /content');
    expect(result).toEqual([' note ']);
  });

  it('holds the doc literals of the slot as the tree holds any doc', () => {
    const ast = parse(':x |~~ one ~~| |~~ two ~~| 42');
    expect(ast.docs.map(doc => [doc.type, doc.content])).toEqual([['DocLit', ' one '], ['DocLit', ' two ']]);
  });

  it('refuses a doc written before a declaration, on its line or the one above', () => {
    expect(() => parse('|~~ note ~~| :x 42')).toThrow(/slot of the declaration/);
    expect(() => parse('5 | |~~ note ~~| :x 42')).toThrow(/slot of the declaration/);
    expect(() => parse('|~~| note\n:x 42')).toThrow(/slot of the declaration/);
    expect(() => parse(':y 1\n|~~ note ~~|\n:x 42')).toThrow(/slot of the declaration/);
  });

  it('a doc ahead of any other step chains explicitly with `|`', async () => {
    // The doc value lands as a separate pipeline step that the next
    // operand (here `filter`) sees as its subject.
    const result = await evalQuery('|~~ inline note ~~| | filter ~(gt 0) !| type');
    expect(result).toEqual(makeTagKeyword('VerbWithoutBodyError'));
  });
});

describe('MapEntry AST node has no .docs field', () => {
  it('parses MapEntry without a docs field', () => {
    const ast = parse('{:k 1}');
    expect(ast.entries[0].docs).toBeUndefined();
  });
});
