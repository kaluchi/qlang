// The head of a verb as the tooling reads it [D72]: the slots as the
// head writes them, the verb a tool shows for a name, and the verbs a
// value of a kind reaches.

import { describe, it, expect } from 'vitest';
import { langRuntime } from '../../src/runtime/index.mjs';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { shownFor, slotLabelsOf, verbShownFor } from '../../src/runtime/verb.mjs';
import { nodeOf, verbsReaching } from '../../src/runtime/nouns.mjs';
import { answerKindsOf } from '../../src/eval.mjs';
import { keyword, makeBinding } from '../../src/types.mjs';

describe('the head of a verb as the tooling reads it', () => {
  it('labels the slots as the head writes them, the rest behind a star', async () => {
    const verb = await evalQuery('::verb~(:n ::number * :xs ::any | xs)');
    expect(slotLabelsOf(verb)).toEqual([':n ::number', '* :xs ::any']);
  });

  it('shows the verb a name binds, its slots labeled', async () => {
    const env = new Map(await langRuntime());
    const twice = await evalQuery('::verb~(:x ::number | mul x)');
    env.set('twice', makeBinding({ name: keyword('twice'), value: twice }));
    expect(slotLabelsOf(verbShownFor(env, 'twice'))).toEqual([':x ::number']);
    expect(shownFor(env, 'twice').labels).toEqual([':x ::number']);
  });

  it('shows a name under a label by its address and the parts of its object [D164]', async () => {
    const shown = shownFor(await langRuntime(), 'add');
    expect(shown.address.name).toBe('number/add');
    expect(shown.labels).toEqual(['addend']);
  });

  it('shows nothing for a name that reaches neither a verb nor a name under a label', async () => {
    expect(shownFor(await langRuntime(), 'nothingAtAll')).toBeUndefined();
  });

  it('shows the first kind\'s name of a word several kinds answer, and the parts of its object', async () => {
    const shown = shownFor(await langRuntime(), 'gt');
    expect(shown.address.name.endsWith('/gt')).toBe(true);
    expect(shown.labels).toEqual(['than']);
  });

  it('shows the name any value answers, and nothing for a name no verb goes by', async () => {
    const env = await langRuntime();
    expect(shownFor(env, 'type').address.name).toBe('any/type');
    expect(verbShownFor(env, 'type')).toBeUndefined();
    expect(verbShownFor(env, 'nosuchverb')).toBeUndefined();
  });

  it('shows the first verb a contract a reader declares answers for', async () => {
    const session = await createSession();
    await session.evalCell(':any/zap ::verb~() | :vec/zap ::verb~(count)');
    const zap = (await session.evalCell('::vec/zap | binding | /value')).result;
    expect(verbShownFor(session.env, 'zap')).toBe(zap);
  });

  it('reads the kinds of the answer of a name from the definition of its answer, the subject\'s own where that is the word\'s own label [D169]', async () => {
    const env = await langRuntime();
    expect(answerKindsOf(env, nodeOf(env, 'vec/filter'), ['set'])).toEqual(['set']);
    expect(answerKindsOf(env, nodeOf(env, 'vec/count'), ['vec'])).toEqual(['number']);
    expect(answerKindsOf(env, nodeOf(env, 'any/coalesce'), ['vec'])).toBeNull();
  });

  it('shows a contract no verb answers for as it is', async () => {
    const env = new Map(await langRuntime());
    const lonelyContract = await evalQuery('::verb~()');
    env.set('lonely', makeBinding({ name: keyword('lonely'), value: lonelyContract }));
    expect(verbShownFor(env, 'lonely')).toBe(lonelyContract);
  });
});

describe('the verbs a value of a kind reaches [D34]', () => {
  it('reaches the verbs of its kind, then those of any value', async () => {
    const reached = verbsReaching(await langRuntime(), ['number']);
    expect(reached.get('add').address.name).toBe('number/add');
    expect(reached.get('type').address.name).toBe('any/type');
    expect(reached.get('take')).toBeUndefined();
  });

  it('leaves out a word its kind does not answer', async () => {
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
