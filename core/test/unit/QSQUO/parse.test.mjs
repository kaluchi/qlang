import { it, expect } from 'vitest';
import { SourceParseError } from '../../../src/parse.mjs';
import { createNotebook } from '../../../src/notebook.mjs';
import { compareValues } from '../../../src/ordering.mjs';
import { makeTag, makeErrorValue } from '../../../src/types.mjs';
import { refusalOf } from '../../helpers/read-text.mjs';

it('refuses a source that is no string, a number and undefined among them', () => {
  for (const source of [42, undefined]) {
    const refused = refusalOf(source);
    expect(refused, String(source)).toBeInstanceOf(SourceParseError);
    expect(refused.message, String(source)).toBe('a source is a string: the host handed a value of another kind');
  }
});

it('a source a host hands that is no string is refused by the parser with its message alone, naming no origin and no span', async () => {
  const { result } = await (await createNotebook()).evalCell(42);
  const refusal = makeErrorValue(makeTag('quote/ParseError'), new Map([['message', 'a source is a string: the host handed a value of another kind']]));
  expect(compareValues(result, refusal)).toBe(0);
});
