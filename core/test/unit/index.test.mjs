// The surface of the package root: what a host, the command line, the
// language server and the site build on.

import { describe, it, expect } from 'vitest';
import * as core from '../../src/index.mjs';

describe('the package root', () => {
  it('parses a source and evaluates a query', async () => {
    expect(core.parse('42').type).toBe('NumberLit');
    expect(await core.evalQuery('[1 2 3] | count')).toBe(3);
  });

  it('keeps a session whose cells share their names', async () => {
    const session = await core.createSession();
    await session.evalCell(':x 2');
    expect((await session.evalCell('x | add 1')).result).toBe(3);
  });

  it('prints a value as the literal that reads back as it', async () => {
    const value = await core.evalQuery('{:a #[1 2] :t ::Box[3]}');
    expect(await core.evalQuery(core.printValue(value))).toEqual(value);
  });

  it('crosses the JSON boundary both ways', () => {
    const lifted = core.fromPlain({ name: 'alice' });
    expect(core.toPlain(lifted)).toEqual({ name: 'alice' });
  });

  it('hands the tools the tree, the tokens and the letters of a name', () => {
    const ast = core.parse(':x 1 | x');
    expect(core.findIdentifierOccurrences(ast, 'x').length).toBeGreaterThan(0);
    expect(core.tokenize('[1] | count', new Set(['count'])).length).toBeGreaterThan(0);
    expect(core.isNameStart('@')).toBe(true);
  });

  it('exports no symbol of the runtime a consumer does not read', () => {
    for (const internal of ['evalAst', 'astChildrenOf', 'QlangError', 'classifyEffect', 'makeTaggedInstance', 'describeType', 'EVAL_DEPTH_LIMIT']) {
      expect(core[internal], internal).toBeUndefined();
    }
  });
});
