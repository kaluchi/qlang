import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';

describe('a path no modifier wrote', () => {
  it('repairs no refusal of a path that no modifier of the call wrote', async () => {
    expect(await evalQuery(':any/f (::fn | returns |~~ N. ~~| ::number | impl ~(it)) | /a | f !| get [~(type) ~(has :repair)]'))
      .toEqual(await evalQuery('[::any/f/answer/KindNotTakenError false]'));
  });
});
