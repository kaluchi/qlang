import { it, expect } from 'vitest';
import { parse } from '../../../src/parse.mjs';

it('refuses a leading combinator and an explicit combinator on the first step after a comment head', () => {
  const habit = '`|` written after `!|` is the habit of a pipe before every step: write `a !| b`';
  expect(() => parse('(!| |~| note\n| count)')).toThrow(habit);
  expect(() => parse('!| |~ one ~| |~ two ~| | count')).toThrow(habit);
});
