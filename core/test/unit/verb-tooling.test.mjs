// The head of a verb as the tooling reads it [D72]: the slots as the
// head writes them, and the verb a tool shows for a name.

import { describe, it, expect } from 'vitest';
import { langRuntime } from '../../src/runtime/index.mjs';
import { evalQuery } from '../../src/eval.mjs';
import { slotLabelsOf, verbShownFor } from '../../src/runtime/verb.mjs';
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
