import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { printValue } from '../../../src/print-value.mjs';

const answers = async query => printValue(await evalQuery(query));

describe('a field of a kind', () => {
  it('refuses a value that is no vector where it names the kinds of each element', async () => {
    expect(await answers(':Box |~~ A parcel. ~~| (::kind | reads :xs |~~ Values. ~~| /xs [::number]) | ::Box{:xs 5} !| type'))
      .toBe('::Box/xs/KindNotTakenError');
  });

  it('answers the failure of a quote that reads it, past a place it leaves out', async () => {
    expect(await answers(':Box |~~ A parcel. ~~| (::kind | reads :w |~~ The width. ~~| ~(get /w | add "x")) | ::Box{:w 1} !| type'))
      .toBe('::number/add/addend/KindNotTakenError');
  });

  it('refuses a place a quote reads that the payload leaves out as left out', async () => {
    expect(await answers(':Box |~~ A parcel. ~~| (::kind | reads :w |~~ The width. ~~| ~(get /w)) | ::Box{} !| type'))
      .toBe('::Box/w/NotGivenError');
  });
});
