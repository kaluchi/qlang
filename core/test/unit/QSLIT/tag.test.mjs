import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { parse } from '../../../src/parse.mjs';
import { isMap, makeTag } from '../../../src/types.mjs';
import { isConstructStep } from '../../../src/steps.mjs';

describe('assembling steps by hand', () => {
  it('a number payload touches its tag by `#`', async () => {
    expect(await evalQuery('::construct{:tag ::T :payload 42} | get [~(it)] | tag ::quote | toString')).toBe('::T#42');
  });
});

describe('the parser reads a tag before a payload as a tagged literal', () => {
  it('reads a map touching a tag as its payload', () => {
    const [step] = parse('::Box{:k 1}');
    expect(isConstructStep(step)).toBe(true);
    expect(isMap(step.get('payload'))).toBe(true);
  });
});

describe('a tag no declaration answers lays itself over any payload', () => {
  it('a vector under a tag is read as a vector, and `type` reads the tag', async () => {
    const { isVec, isTagged, typeOf, TAG_HEADER_SYMBOL } = await import('../../../src/types.mjs');
    const tagged = await evalQuery('::Loose[1 2 3]');
    expect(Array.isArray(tagged)).toBe(true);
    expect(isVec(tagged)).toBe(true);
    expect(isTagged(tagged)).toBe(true);
    expect(tagged[TAG_HEADER_SYMBOL]).toEqual(makeTag('Loose'));
    expect(typeOf(tagged)).toEqual(makeTag('Loose'));
    expect(tagged.length).toBe(3);
    expect(tagged[0]).toBe(1);
    expect(tagged[1]).toBe(2);
  });

  it('a map under a tag is read as a map, its entries its own', async () => {
    const { isMap, isTagged, TAG_HEADER_SYMBOL } = await import('../../../src/types.mjs');
    const tagged = await evalQuery('::Loose{:custom "field" :position 1}');
    expect(isMap(tagged)).toBe(true);
    expect(isTagged(tagged)).toBe(true);
    expect(tagged[TAG_HEADER_SYMBOL]).toEqual(makeTag('Loose'));
    expect(tagged.get('custom')).toBe('field');
    expect(tagged.get('position')).toBe(1);
  });

  it('a string under a tag is held whole, and `payload` takes it off', async () => {
    const { isTagged, typeOf } = await import('../../../src/types.mjs');
    const tagged = await evalQuery('::Loose"hello"');
    expect(isTagged(tagged)).toBe(true);
    expect(typeOf(tagged)).toEqual(makeTag('Loose'));
    expect(tagged.payload).toBe('hello');
    const extracted = await evalQuery('::Loose"hello" | payload');
    expect(extracted).toBe('hello');
  });

  it('a keyword touches its tag by its colon', async () => {
    const { isTagged, isKeyword } = await import('../../../src/types.mjs');
    const tagged = await evalQuery('::Loose:foo');
    expect(isTagged(tagged)).toBe(true);
    expect(isKeyword(tagged.payload)).toBe(true);
    expect(tagged.payload.name).toBe('foo');
  });

  it('a number touches its tag by `#`, since `::Tag42` reads as one name', async () => {
    const { isTagged } = await import('../../../src/types.mjs');
    const tagged = await evalQuery('::Loose#42');
    expect(isTagged(tagged)).toBe(true);
    expect(tagged.payload).toBe(42);
  });
});
