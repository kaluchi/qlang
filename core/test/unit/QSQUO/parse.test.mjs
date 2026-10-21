import { describe, it, expect } from 'vitest';
import { ParseError } from '../../../src/parse.mjs';
import { createSession } from '../../../src/session.mjs';
import { compareValues } from '../../../src/ordering.mjs';
import { makeTag, makeErrorValue } from '../../../src/types.mjs';
import { refusalOf } from '../../helpers/read-text.mjs';

describe('parse.mjs — input guards and the depth of a nest', () => {
  it('refuses a source that is no string, a number and undefined among them', () => {
    for (const source of [42, undefined]) {
      const refused = refusalOf(source);
      expect(refused, String(source)).toBeInstanceOf(ParseError);
      expect(refused.message, String(source)).toBe('parse() expects a string source');
    }
  });
});

describe('a source a host hands that is no string', () => {
  it('is refused by the parser with its message alone, naming no origin and no place', async () => {
    const { result } = await (await createSession()).evalCell(42);
    const refusal = makeErrorValue(makeTag('quote/ParseError'), new Map([['message', 'parse() expects a string source']]));
    expect(compareValues(result, refusal)).toBe(0);
  });
});
