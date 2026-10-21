import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { makeTag } from '../../../src/types.mjs';
import { BOX } from '../../helpers/box.mjs';

describe('a kind built from ::kind', () => {
  it('answers the error the recipe of its verb answers', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | past !| type')).toEqual(makeTag('path/IndexOutOfBoundsError'));
  });
});
