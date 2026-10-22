import { it, expect } from 'vitest';
import { createSession, evalQuery } from '../../src/session.mjs';
import { parse } from '../../src/parse.mjs';
import { keyword, makeBinding } from '../../src/types.mjs';

it('folds by the one call of a quote faster than by a call with modifiers over the same elements', async () => {
  const foldsOf = (count, code) => `${count} | range | map ~([1 2] | reduce 0 ~(${code})) | sum`;
  const millisecondsOf = async query => {
    const started = Date.now();
    expect(await evalQuery(query)).toBe(3 * Number.parseInt(query, 10));
    return Date.now() - started;
  };
  await millisecondsOf(foldsOf(500, 'add'));
  await millisecondsOf(foldsOf(500, 'sumOf /0 /1'));
  expect(await millisecondsOf(foldsOf(8000, 'add'))).toBeLessThan(await millisecondsOf(foldsOf(8000, 'sumOf /0 /1')));
});

it('reaches a verb of the name a reader declares under its label beside the verbs of the root, and a query that declares none does not', async () => {
  expect(await evalQuery(':Box |~~ A box. ~~| | :Box/count ~(7) | 5 | count !| get /addresses | eq #[::Box/count ::map/count ::string/count ::vec/count]')).toBe(true);
  expect(await evalQuery('5 | count !| get /addresses | eq #[::map/count ::string/count ::vec/count]')).toBe(true);
});

it('reaches a verb of the name a later source of the root declares, and a root without that source does not', async () => {
  const later = await createSession({ sources: [{ uri: 'tests/later', source: ':Crate |~~ A crate. ~~|\n:Crate/count ~(7)' }] });
  expect((await later.evalCell('5 | count !| get /addresses | eq #[::Crate/count ::map/count ::string/count ::vec/count]')).result).toBe(true);
  expect(await evalQuery('5 | count !| get /addresses | has ::Crate/count')).toBe(false);
});

it('reads the declaration of an address of the root that a scope a host hands holds before the root\'s', async () => {
  const { scope } = await createSession();
  const handed = new Map(scope).set('boolean/not', makeBinding({ name: keyword('boolean/not'), value: parse('99') }));
  const session = await createSession({ scope: handed });
  expect((await session.evalCell('get [~(true | not) ~(5 | not !| type)] | eq [99 ::boolean/not/SubjectNotBooleanError]')).result).toBe(true);
});
