// A word as the tooling reads it [D251]: what a tool shows for a name,
// and the words a value of a kind reaches.

import { describe, it, expect } from 'vitest';
import { langRuntime } from '../../src/runtime/index.mjs';
import { shownFor } from '../../src/runtime/verb.mjs';
import { nodeOf, verbsReaching } from '../../src/runtime/nouns.mjs';
import { answerKindsOf } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';

describe('a word as the tooling reads it', () => {
  it('shows a name under a label by its address and the inputs of its function [D251]', async () => {
    const shown = shownFor(await langRuntime(), 'add');
    expect(shown.address.name).toBe('number/add');
    expect(shown.inputs).toEqual(['addend']);
  });

  it('shows nothing for a name that reaches neither a verb nor a name under a label', async () => {
    expect(shownFor(await langRuntime(), 'nothingAtAll')).toBeUndefined();
  });

  it('shows the first kind\'s name of a word several kinds answer, and the inputs of its function', async () => {
    const shown = shownFor(await langRuntime(), 'gt');
    expect(shown.address.name.endsWith('/gt')).toBe(true);
    expect(shown.inputs).toEqual(['value']);
  });

  it('shows the name any value answers', async () => {
    expect(shownFor(await langRuntime(), 'type').address.name).toBe('any/type');
  });

  it('shows the word a subject of the kinds reaches, and the inputs of its function [D34]', async () => {
    const env = await langRuntime();
    expect(shownFor(env, 'count', ['vec']).address.name).toBe('vec/count');
    expect(shownFor(env, 'count', ['map']).address.name).toBe('map/count');
    expect(shownFor(env, 'take', ['string'])).toEqual({ address: expect.objectContaining({ name: 'string/take' }), inputs: ['count'] });
  });

  it('shows the word a name reaches with no subject where the kinds reach none', async () => {
    expect(shownFor(await langRuntime(), 'add', ['string']).address.name).toBe('number/add');
  });

  it('reads the kinds of the answer of a name from the kinds its returns names, the subject\'s own where that is the word\'s own label [D169], [D251]', async () => {
    const env = await langRuntime();
    expect(answerKindsOf(env, nodeOf(env, 'vec/filter'), ['set'])).toEqual(['set']);
    expect(answerKindsOf(env, nodeOf(env, 'vec/count'), ['vec'])).toEqual(['number']);
    expect(answerKindsOf(env, nodeOf(env, 'any/coalesce'), ['vec'])).toBeNull();
  });

  it('reads the kinds of an answer its returns names as a set [D251]', async () => {
    const session = await createSession();
    await session.evalCell(':Box |~~ A box. ~~| | :Box/f (::fn | returns |~~ The value. ~~| #[::number ::string] | impl ~(eq 1))');
    expect(answerKindsOf(session.env, nodeOf(session.env, 'Box/f'), ['Box'])).toEqual(['number', 'string']);
  });

  it('shows a word written as its recipe alone, the function of no commands it is, with no inputs [D253]', async () => {
    const session = await createSession();
    await session.evalCell(':number/double ~(mul 2)');
    expect(shownFor(session.env, 'double')).toEqual({ address: expect.objectContaining({ name: 'number/double' }), inputs: [] });
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
