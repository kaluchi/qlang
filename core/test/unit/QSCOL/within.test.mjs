import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { makeTag } from '../../../src/types.mjs';

describe('within edits under one tag and lays the tag back', () => {
  // The payload runs through the quote as a fork and the subject's tag is
  // laid back over the answer, its constructor running once [QSDSP#answer].
  it('a constructor that refuses the answer refuses the edit', async () => {
    expect(await evalQuery('#[1 2] | within ~(count) !| type'))
      .toEqual(makeTag('set/PayloadKindNotTakenError'));
  });

  it('an error the edit answers passes as it is, and one the code answers is refused by its input', async () => {
    expect(await evalQuery('#[1 2] | within ~(!{:k 2} | raise) !| get /k')).toBe(2);
    expect(await evalQuery('#[1 2] | within (!{:k 1} | raise) !| type')).toEqual(makeTag('tagged/within/code/KindNotTakenError'));
  });
});
