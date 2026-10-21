import { describe, it, expect } from 'vitest';
import { parse } from '../../../src/parse.mjs';
import { isConstructStep, builtFrom } from '../../../src/steps.mjs';

describe('the chain of a kind as the body of a bare name', () => {
  const bodyOf = source => parse(source)[0].get('body');

  it('reads a literal of a kind as the body, which no chain heads', () => {
    expect(isConstructStep(bodyOf(':Box\n  |~~ A parcel. ~~|\n  ::kind[~() null]'))).toBe(true);
  });

  it('builds a body from the noun its literal names, in a group or not, and a group of another step from none', () => {
    expect(builtFrom(bodyOf(':Box |~~ A parcel. ~~| (::kind[~() null])'))).toBe('kind');
    expect(builtFrom(bodyOf(':Box |~~ A parcel. ~~| ::kind[~() null]'))).toBe('kind');
    expect(builtFrom(bodyOf(':x (count)'))).toBe(null);
  });
});
