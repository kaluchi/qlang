// The head of a verb as the tooling reads it [D72]: the slots as the
// head writes them, the verb a tool shows for a name, and the verbs a
// value of a kind reaches.

import { describe, it, expect } from 'vitest';
import { langRuntime } from '../../src/runtime/index.mjs';
import { evalQuery } from '../../src/eval.mjs';
import { slotLabelsOf, verbShownFor } from '../../src/runtime/verb.mjs';
import { verbsReaching } from '../../src/runtime/nouns.mjs';
import { bindingValueOf, residenceOfVerb } from '../../src/types.mjs';

describe('the head of a verb as the tooling reads it', () => {
  it('labels the slots as the head writes them, the rest behind a star', async () => {
    const verb = await evalQuery('::verb~(:n ::number * :xs ::any | xs)');
    expect(slotLabelsOf(verb)).toEqual([':n ::number', '* :xs ::any']);
  });

  it('shows the verb a name binds, its slots labeled', async () => {
    const env = await langRuntime();
    const addVerb = verbShownFor(env, 'add');
    expect(addVerb).toBe(bindingValueOf(env.get('add')));
    expect(slotLabelsOf(addVerb)).toEqual([':addend ::number']);
  });

  it('shows the first verb a contract answers for', async () => {
    const env = await langRuntime();
    expect(residenceOfVerb(verbShownFor(env, 'gt'))).not.toBeNull();
  });

  it('shows a contract no verb answers for as it is', async () => {
    const env = new Map(await langRuntime());
    const lonelyContract = await evalQuery('::verb~()');
    env.set('lonely', lonelyContract);
    expect(verbShownFor(env, 'lonely')).toBe(lonelyContract);
  });
});

describe('the verbs a value of a kind reaches [D34]', () => {
  it('reaches the verbs of its kind, then those of any value', async () => {
    const reached = verbsReaching(await langRuntime(), ['number']);
    expect(reached.get('add').address.name).toBe('number/add');
    expect(reached.get('type').address.name).toBe('any/type');
    expect(slotLabelsOf(reached.get('add').verb)).toEqual([':addend ::number']);
  });

  it('leaves out a contract of any value its kind does not answer', async () => {
    const env = await langRuntime();
    expect(verbsReaching(env, ['number']).has('count')).toBe(false);
    expect(verbsReaching(env, ['vec']).get('count').address.name).toBe('vec/count');
  });

  it('takes the verb of the outermost kind a name lives on', async () => {
    const reached = verbsReaching(await langRuntime(), ['tag', 'number']);
    expect(reached.get('gt').address.name).toBe('tag/gt');
  });

  it('reaches only the verbs of any value for a kind no module declares', async () => {
    const reached = verbsReaching(await langRuntime(), ['Width']);
    expect(reached.has('type')).toBe(true);
    expect(reached.has('add')).toBe(false);
  });
});
