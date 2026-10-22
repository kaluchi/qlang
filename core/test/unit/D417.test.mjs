import { it, expect, beforeAll } from 'vitest';
import { createSession, evalQuery } from '../../src/session.mjs';
import { parse } from '../../src/parse.mjs';
import { keyword, makeBinding } from '../../src/types.mjs';

beforeAll(async () => {
  await evalQuery('1');
});

it('folds by the one call of a quote faster than by a call with modifiers over the same elements', async () => {
  const millisecondsOf = async (count, code) => {
    const started = Date.now();
    expect(await evalQuery(`${count} | range | map ~([1 2] | reduce 0 ~(${code})) | sum`)).toBe(3 * count);
    return Date.now() - started;
  };
  await millisecondsOf(500, 'add');
  await millisecondsOf(500, 'sumOf /0 /1');
  let byOneCall = 0;
  let byACallWithModifiers = 0;
  for (let round = 0; round < 2; round += 1) {
    byOneCall += await millisecondsOf(4000, 'add');
    byACallWithModifiers += await millisecondsOf(4000, 'sumOf /0 /1');
  }
  expect(byOneCall).toBeLessThan(byACallWithModifiers);
}, 60_000);

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
