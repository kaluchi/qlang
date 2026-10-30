import { describe, it, expect } from 'vitest';
import { makeKeyword, isErrorValue, makeErrorValue, makeTag, makeTagged } from '../../../src/types.mjs';
import { makeSet, compareValues } from '../../../src/ordering.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { evalQuery } from '../../../src/notebook.mjs';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { printAnswer } from '../../../src/runtime/print.mjs';

it('reads back the literal of an error value raised and of a tag over each kind of payload', async () => {
  const errorVal = makeErrorValue(makeTag('Oops'), new Map([['message', 'something went wrong']]));
  const restoredError = await evalQuery(`${printValue(errorVal)} | raise`);
  expect(isErrorValue(restoredError)).toBe(true);
  expect(restoredError.tag.name).toBe('Oops');
  expect(restoredError.facts.get('message')).toBe('something went wrong');
  const hostBuilt = [
    makeTagged(makeTag('Box'), [1, 2, 3]),
    makeTagged(makeTag('Keys'), makeSet([makeKeyword('b'), makeKeyword('a')])),
    makeTagged(makeTag('User'), new Map([['name', 'alice']])),
    makeTagged(makeTag('Count'), 42)
  ];
  for (const value of hostBuilt) {
    expect(compareValues(await evalQuery(printValue(value)), value) === 0).toBe(true);
  }
});

describe('the print of a failure, its tag before the bang and its facts', () => {
  it('a failure that flew no step prints its facts alone, and its print raised starts its trace at the raise', async () => {
    const err = makeErrorValue(makeTag('Foo'), new Map([['category', makeKeyword('oops')]]));
    expect(printValue(err)).toBe('::Foo!{:category :oops}');
    expect(isErrorValue(await evalQuery(printValue(err)))).toBe(false);
    expect(compareValues(await evalQuery(`${printValue(err)} | raise !| get /trace | map failed`), await evalQuery('[~(raise)]')) === 0).toBe(true);
  });

  it('an answer that is a failure prints under the line that says it was raised, an error at rest under none', async () => {
    const scope = await langRuntime();
    const failure = await evalQuery('"x" | add 1');
    expect(await printAnswer(failure, scope)).toBe(`|~| raised, and no !| caught it\n${printValue(failure)}`);
    const atRest = await evalQuery('"x" | add 1 !| it');
    expect(await printAnswer(atRest, scope)).toBe(printValue(atRest));
  });
});
