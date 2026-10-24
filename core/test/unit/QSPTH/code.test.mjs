import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';

it('repairs no refusal of a path that no modifier of the call wrote', async () => {
  expect(await evalQuery(':any/f (::fn | returns |~~ N. ~~| ::number | impl ~(it)) | /a | f !| get [~(tag) ~(has :repair)]'))
    .toEqual(await evalQuery('[::any/f/answer/KindNotTakenError false]'));
});
