import { describe, it, expect } from 'vitest';
import { parseSource } from '../../../src/parse.mjs';
import { isGroupStep, isConstructStep } from '../../../src/steps.mjs';
import { isTag } from '../../../src/types.mjs';
import { stepOf } from '../../helpers/read-text.mjs';

describe('the chain of a kind as the body of a bare name', () => {
  const bodyOf = source => parseSource(source)[0].get('body');

  it('reads the chain of a bare name with its page begun on a later line, the group of its steps', () => {
    const body = bodyOf(':Box\n  |~~ A parcel. ~~|\n  ::kind\n    | accepts |~~ The sizes. ~~| ::map;');
    expect(isGroupStep(body)).toBe(true);
    expect(body.payload.length).toBe(2);
  });

  it('reads the chain on the line of the name, up to the `;` that ends it', () => {
    const body = bodyOf(':Box |~~ A parcel. ~~| ::kind | accepts |~~ The sizes. ~~| ::map; 1');
    expect([isGroupStep(body), body.payload.length]).toEqual([true, 2]);
  });

  it('reads one step of a bare name with no page', () => {
    expect(isTag(bodyOf(':s\n::vec;\ns'))).toBe(true);
  });
});

it('reads an error literal under a tag on the line after a page as the body of its declaration', () => {
  const body = stepOf(':Late |~~ A late error. ~~|\n  ::Late!{:by 3};').get('body');
  expect(isConstructStep(body)).toBe(true);
  expect([body.get('tag').name, [...body.get('payload').keys()]]).toEqual(['Late', ['by']]);
});
