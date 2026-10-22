import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { langRuntime } from '../../../src/runtime/index.mjs';
import { keyword, makeTagged, makeBinding, ERROR_TAG, makeTag, makeErrorValue } from '../../../src/types.mjs';
import { errorFromQlang } from '../../../src/error-convert.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { TestsProbeTypeError } from '../../helpers/probe-refusal.mjs';

const scopeHolding = async value => new Map(await langRuntime()).set('held', makeBinding({ name: keyword('held'), value }));

it('prints a value a host hands under `::error` over a payload that is no map as the payload under its tag, the error literal writing a map alone', async () => {
  expect(await evalQuery('held | print', await scopeHolding(makeTagged(ERROR_TAG, 5)))).toBe('::error#5');
});

it('converts a refusal whose site hands no facts to an error of no facts', async () => {
  const errorVal = errorFromQlang(new TestsProbeTypeError(), 10, await langRuntime());
  expect(errorVal.tag).toEqual(makeTag('tests/ProbeTypeError'));
  expect([...errorVal.facts.keys()]).toEqual([]);
});

it('an error of the kind of errors prints without its kind', async () => {
  // The kind of errors is the one `!{…}` implies, so its print writes no tag before the bang.
  const err = makeErrorValue(makeTag('error'), new Map());
  expect(printValue(err)).toBe('!{}');
});
