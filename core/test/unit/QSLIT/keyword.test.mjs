import { it, expect } from 'vitest';

it('writes a keyword bare where its name reads back bare', async () => {
  const { canonicalKeywordLiteral } = await import('../../../src/types.mjs');
  expect(canonicalKeywordLiteral('foo')).toBe(':foo');
  expect(canonicalKeywordLiteral('qlang/error')).toBe(':qlang/error');
  expect(canonicalKeywordLiteral('true')).toBe(':true');
  expect(canonicalKeywordLiteral('данные/х')).toBe(':данные/х');
});

it('writes a keyword quoted where its name does not read back bare', async () => {
  const { canonicalKeywordLiteral } = await import('../../../src/types.mjs');
  expect(canonicalKeywordLiteral('1')).toBe(':"1"');
  expect(canonicalKeywordLiteral('foo bar')).toBe(':"foo bar"');
  expect(canonicalKeywordLiteral('$ref')).toBe(':"$ref"');
  expect(canonicalKeywordLiteral('a/')).toBe(':"a/"');
  expect(canonicalKeywordLiteral('')).toBe(':""');
  expect(canonicalKeywordLiteral('a\nb')).toBe(':"a\\nb"');
});
