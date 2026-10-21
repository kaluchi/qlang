import { describe, it, expect } from 'vitest';

describe('types.mjs — canonicalKeywordLiteral', async () => {
  it('returns bare form for identifier-safe names', async () => {
    const { canonicalKeywordLiteral } = await import('../../../src/types.mjs');
    expect(canonicalKeywordLiteral('foo')).toBe(':foo');
    expect(canonicalKeywordLiteral('qlang/error')).toBe(':qlang/error');
    expect(canonicalKeywordLiteral('true')).toBe(':true');
    expect(canonicalKeywordLiteral('данные/х')).toBe(':данные/х');
  });

  it('returns quoted form for names that need quoting', async () => {
    const { canonicalKeywordLiteral } = await import('../../../src/types.mjs');
    expect(canonicalKeywordLiteral('1')).toBe(':"1"');
    expect(canonicalKeywordLiteral('foo bar')).toBe(':"foo bar"');
    expect(canonicalKeywordLiteral('$ref')).toBe(':"$ref"');
    expect(canonicalKeywordLiteral('a/')).toBe(':"a/"');
    expect(canonicalKeywordLiteral('')).toBe(':""');
    expect(canonicalKeywordLiteral('a\nb')).toBe(':"a\\nb"');
  });
});
