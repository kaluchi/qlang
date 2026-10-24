import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { printValue } from '../../../src/print-value.mjs';

const answers = async query => printValue(await evalQuery(query));

it('a field refuses a value that is no vector where it names the kinds of each element', async () => {
  expect(await answers(':Box |~~ A parcel. ~~| (::kind | reads :xs |~~ Values. ~~| /xs [::number]) | ::Box{:xs 5} !| tag'))
    .toBe('::Box/xs/KindNotTakenError');
});

it('a field answers the failure of a quote that reads it, past a part the payload leaves out', async () => {
  expect(await answers(':Box |~~ A parcel. ~~| (::kind | reads :w |~~ The width. ~~| ~(get /w | add "x")) | ::Box{:w 1} !| tag'))
    .toBe('::number/add/addend/KindNotTakenError');
});

it('a field refuses a part its quote reads that the payload leaves out as left out', async () => {
  expect(await answers(':Box |~~ A parcel. ~~| (::kind | reads :w |~~ The width. ~~| ~(get /w)) | ::Box{} !| tag'))
    .toBe('::Box/w/NotGivenError');
});
