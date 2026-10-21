import { describe, it, expect } from 'vitest';
import { ParseError } from '../../../src/parse.mjs';
import { refusalOf } from '../../helpers/read-text.mjs';

describe('parse — a map literal takes whitespace around the colon of a string key', () => {
  it('refuses a keyword key that touches its value', () => {
    const refused = refusalOf('{:name"alice"}');
    expect([refused instanceof ParseError, refused?.found]).toEqual([true, '"']);
  });
});
