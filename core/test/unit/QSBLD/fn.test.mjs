import { describe, it, expect } from 'vitest';
import { printValue } from '../../../src/index.mjs';
import { evalQuery } from '../../../src/notebook.mjs';
import { makeTag } from '../../../src/types.mjs';
import { platformLocator, LANGUAGE_SOURCES } from '../../../src/runtime/bootstrap.mjs';
import { kindsNamedForCommands } from '../../../../scripts/catalog-kinds.mjs';
import { verdictOf } from '../../../../scripts/conventions-verdict.mjs';

it('the value of `::vec/take` is its function, whose recipe is the descriptor of its primitive, and an input its place', async () => {
  expect(printValue(await evalQuery('::vec/take | binding | get /value | get /1'))).toBe('::builtin{}');
  expect(printValue(await evalQuery('::vec/take | binding :count | get /value'))).toBe('/0');
});

it('mul given no multiplier is refused under its input', async () => {
  expect(await evalQuery('5 | mul !| type')).toEqual(makeTag('number/mul/multiplier/NotGivenError'));
});

describe('no kind of the catalog bears the name of a command of a chain', () => {
  it('finds a label that bears the name of a command, declared by its chain, by its page alone, on one line or by its literal', () => {
    const planted = [
      { path: 'holds.qlang', text: ':Holds\n  |~~ A name of another case. ~~|\n:holds\n  |~~ An invariant. ~~|\n  ::kind\n    | wraps |~~ The condition. ~~| ::quote\n' },
      { path: 'wraps.qlang', text: ':wraps\n  |~~ A payload. ~~|\n' },
      { path: 'proves.qlang', text: ':proves |~~ A law. ~~| (::kind | wraps |~~ The query. ~~| ::quote)' },
      { path: 'impl.qlang', text: ':impl\n  |~~ A recipe. ~~|\n  ::kind[~() null]\n' }
    ];
    expect(kindsNamedForCommands(planted)).toEqual([
      { path: 'holds.qlang', line: 3, name: 'holds' }, { path: 'wraps.qlang', line: 1, name: 'wraps' },
      { path: 'proves.qlang', line: 1, name: 'proves' }, { path: 'impl.qlang', line: 1, name: 'impl' }
    ]);
  });

  it('leaves a name of data, a label named for a verb that is no command, a declaration inside a law and a source of no declaration', () => {
    const planted = [
      { path: 'takes.qlang', text: ':takes\n  5\n' },
      { path: 'fill.qlang', text: ':fill\n  |~~ A fill. ~~|\n:inputs\n  |~~ The inputs. ~~|\n' },
      { path: 'box.qlang', text: ':Box\n  |~~ A box. ~~|\n  ::kind\n    | proves :x |~~ An x. ~~| ~(:holds |~~ An invariant. ~~| | true)\n' },
      { path: 'value.qlang', text: '5' }
    ];
    expect(kindsNamedForCommands(planted)).toEqual([]);
  });

  it('finds none among the sources of the language', async () => {
    const sources = await Promise.all(LANGUAGE_SOURCES.map(async uri => ({ path: uri, text: (await platformLocator(uri)).source })));
    expect(kindsNamedForCommands(sources)).toEqual([]);
  });

  it('fails the check of the conventions on such a kind and names it, and passes on none', () => {
    expect(verdictOf({ commandKinds: [] })).toEqual({ text: 'check:conventions — OK\n', failed: false });
    const { text, failed } = verdictOf({ commandKinds: [{ path: 'holds.qlang', line: 3, name: 'holds' }] });
    expect(failed).toBe(true);
    expect(text).toContain('holds.qlang:3  ::holds, the name of the command `holds`');
  });
});
