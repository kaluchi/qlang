import { it, expect } from 'vitest';
import { stepOf } from '../../helpers/read-text.mjs';

it('accepts whitespace between a string key and its colon', () => {
  const step = stepOf('{ "name" : "alice" }');
  expect([...step.keys()]).toEqual(['name']);
  expect(step.get('name')).toBe('alice');
});

it('accepts a line break between a string key and its colon', () => {
  expect(stepOf('{"name"\n:\n"alice"}').get('name')).toBe('alice');
});
