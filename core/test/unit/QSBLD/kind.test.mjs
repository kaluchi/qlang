import { it, expect } from 'vitest';
import { parse } from '../../../src/parse.mjs';
import { isConstructStep, builtFrom } from '../../../src/steps.mjs';

const bodyOf = source => parse(source)[0].get('body');

it('reads a literal of a kind as the body of a bare name, which no chain heads', () => {
  expect(isConstructStep(bodyOf(':Box\n  |~~ A parcel. ~~|\n  ::kind[~() null]'))).toBe(true);
});

it('builds the body of a bare name from the noun its literal names, in a group or not, and a group of another step from none', () => {
  expect(builtFrom(bodyOf(':Box |~~ A parcel. ~~| (::kind[~() null])'))).toBe('kind');
  expect(builtFrom(bodyOf(':Box |~~ A parcel. ~~| ::kind[~() null]'))).toBe('kind');
  expect(builtFrom(bodyOf(':x (count)'))).toBe(null);
});
