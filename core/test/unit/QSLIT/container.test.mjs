import { it, expect } from 'vitest';
import { SourceParseError } from '../../../src/parse.mjs';
import { refusalOf } from '../../helpers/read-text.mjs';

it('refuses a keyword key that touches its value', () => {
  const refused = refusalOf('{:name"alice"}');
  expect([refused instanceof SourceParseError, refused?.found]).toEqual([true, '"']);
});
