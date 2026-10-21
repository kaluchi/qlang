import { describe, it, expect } from 'vitest';
import { stepOf } from '../../helpers/read-text.mjs';

describe('parse — a map literal takes whitespace around the colon of a string key', () => {
  it('accepts whitespace between a string key and its colon', () => {
    const step = stepOf('{ "name" : "alice" }');
    expect([...step.keys()]).toEqual(['name']);
    expect(step.get('name')).toBe('alice');
  });

  it('accepts a line break between a string key and its colon', () => {
    expect(stepOf('{"name"\n:\n"alice"}').get('name')).toBe('alice');
  });
});
