import { describe, it, expect } from 'vitest';
import { ParseError } from '../../../src/parse.mjs';
import { stepOf, refusalOf } from '../../helpers/read-text.mjs';

describe('parse — the literals of atoms', () => {
  it('parses JSON unicode escape \\u0000 (null byte)', () => {
    expect(stepOf('"a\\u0000b"')).toBe('a\x00b');
  });

  it('rejects invalid hex in \\u escape', () => {
    const refused = refusalOf('"\\u00GG"');
    expect(refused).toBeInstanceOf(ParseError);
    expect([refused.found, refused.expected.map(alternative => alternative.description)]).toEqual(['G', ['hexadecimal digit']]);
  });
});
