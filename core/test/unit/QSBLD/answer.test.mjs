import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { makeTag } from '../../../src/types.mjs';
import { BOX } from '../../helpers/box.mjs';

it('a verb of a kind built from ::kind answers the error its recipe answers', async () => {
  expect(await evalQuery(BOX + '::Box[4 2] | past !| type')).toEqual(makeTag('path/IndexOutOfBoundsError'));
});
