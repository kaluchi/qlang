import { it, expect } from 'vitest';
import { SourceParseError } from '../../../src/parse.mjs';
import { stepOf, refusalOf } from '../../helpers/read-text.mjs';

it('reads the escape \\u0000 of JSON as the null character', () => {
  expect(stepOf('"a\\u0000b"')).toBe('a\x00b');
});

it('refuses an escape \\u whose digits are no hexadecimal', () => {
  const refused = refusalOf('"\\u00GG"');
  expect(refused).toBeInstanceOf(SourceParseError);
  expect([refused.found, refused.expected.map(alternative => alternative.description)]).toEqual(['G', ['hexadecimal digit']]);
});
