import { describe, it, expect } from 'vitest';
import { parseSource } from '../../../src/parse.mjs';
import { isGroupStep, isCallStep, isBindStep, isConstructStep, isFailStep } from '../../../src/steps.mjs';
import { isTag } from '../../../src/types.mjs';
import { stepOf } from '../../helpers/read-text.mjs';

describe('the chain of a kind as the body of a bare name', () => {
  const bodyOf = source => parseSource(source)[0].get('body');

  it('reads the chain of a bare name with its page begun on a later line, the group of its steps', () => {
    const body = bodyOf(':Box\n  |~~ A parcel. ~~|\n  ::kind\n    | accepts |~~ The sizes. ~~| ::map');
    expect(isGroupStep(body)).toBe(true);
    expect(body.payload.length).toBe(2);
  });

  it('reads one step on the line of the name', () => {
    expect(isTag(bodyOf(':Box |~~ A parcel. ~~| ::kind | accepts |~~ The sizes. ~~| ::map'))).toBe(true);
  });

  it('reads one step of a bare name with no page', () => {
    expect(isTag(bodyOf(':s\n::vec\n| s'))).toBe(true);
  });
});

it('reads an error literal under a tag on the line after a page as the body of its declaration', () => {
  const body = stepOf(':Late |~~ A late error. ~~|\n  ::Late!{:by 3}').get('body');
  expect(isConstructStep(body)).toBe(true);
  expect([body.get('tag').name, [...body.get('payload').keys()]]).toEqual(['Late', ['by']]);
});

it('the body of a definition begun on a later line runs on through a command and a step of the fail track, and ends at a value after `|`', () => {
  const [definition, value] = parseSource(':any/f\n  count\n  !| 0\n| [1 2]');
  const body = definition.get('body');
  expect(isGroupStep(body)).toBe(true);
  expect([isCallStep(body.payload[0]), isFailStep(body.payload[1])]).toEqual([true, true]);
  expect(value).toEqual([1, 2]);
});

describe('a declaration inside a pipeline', () => {
  it('reads a declaration of `it` inside a pipeline', () => {
    const quote = parseSource('foo | :snapshot it | bar');
    expect(quote).toHaveLength(3);
    expect(isBindStep(quote[1])).toBe(true);
    expect(quote[1].get('name').name).toBe('snapshot');
  });

  it('reads `:name body` as a declaration inside a pipeline', () => {
    const quote = parseSource('items | :total count | total');
    expect(isBindStep(quote[1])).toBe(true);
    expect(quote[1].get('name').name).toBe('total');
  });
});
