// A verb as the tooling reads it [QSHST#tools]: what a tool shows for a name,
// and the verbs a value of a kind reaches.

import { describe, it, expect } from 'vitest';
import { langRuntime } from '../../src/runtime/index.mjs';
import { shownFor, answerKindsOf, nodeOf, verbsReaching, verbNames } from '../../src/nouns.mjs';
import { servesTheSubject } from '../../src/dispatch.mjs';
import { createSession } from '../../src/session.mjs';
import { parse } from '../../src/parse.mjs';
import { bodyRuns } from '../../src/chain.mjs';
import { holdsALiteral } from '../../src/steps.mjs';
import { makeTag } from '../../src/types.mjs';

describe('a verb as the tooling reads it', () => {
  it('shows a name under a label by its address and the inputs of its function [QSBLD#fn]', async () => {
    const shown = shownFor(await langRuntime(), 'add');
    expect(shown.address.name).toBe('number/add');
    expect(shown.inputs).toEqual(['addend']);
  });

  it('shows nothing for a name that reaches neither a verb nor a name under a label', async () => {
    expect(shownFor(await langRuntime(), 'nothingAtAll')).toBeUndefined();
  });

  it('shows the first verb of a name several kinds answer, and the inputs of its function', async () => {
    const shown = shownFor(await langRuntime(), 'gt');
    expect(shown.address.name.endsWith('/gt')).toBe(true);
    expect(shown.inputs).toEqual(['value']);
  });

  it('shows the name any value answers', async () => {
    expect(shownFor(await langRuntime(), 'type').address.name).toBe('any/type');
  });

  it('shows the verb a subject of the kinds reaches, and the inputs of its function [QSHST#tools]', async () => {
    const scope = await langRuntime();
    expect(shownFor(scope, 'count', ['vec']).address.name).toBe('vec/count');
    expect(shownFor(scope, 'count', ['map']).address.name).toBe('map/count');
    expect(shownFor(scope, 'take', ['string'])).toEqual({ address: expect.objectContaining({ name: 'string/take' }), inputs: ['count'] });
  });

  it('shows the verb a name reaches with no subject where the kinds reach none', async () => {
    expect(shownFor(await langRuntime(), 'add', ['string']).address.name).toBe('number/add');
  });

  it('reads the kinds of the answer of a name from the kinds its returns names, the subject\'s own where that is the verb\'s own label [QSBLD#answer]', async () => {
    const scope = await langRuntime();
    expect(answerKindsOf(scope, nodeOf(scope, 'vec/filter'), ['set'])).toEqual(['set']);
    expect(answerKindsOf(scope, nodeOf(scope, 'vec/count'), ['vec'])).toEqual(['number']);
    expect(answerKindsOf(scope, nodeOf(scope, 'any/coalesce'), ['vec'])).toBeNull();
  });

  it('reads the kinds of the answer of a call as the evaluator lays it: the walk of the subject through the verb\'s own label where the walk reaches it, the noun a tag name names reached by no label and left out, and the kinds its returns names elsewhere [QSBLD#answer], [QSDSP#tagname], [QSHST#tools]', async () => {
    const session = await createSession();
    await session.evalCell(':Box |~~ A box. ~~| | :Box/f ~(1)');
    const { scope } = session;
    const kindsAfter = (address, kinds) => answerKindsOf(scope, nodeOf(scope, address), kinds);
    expect([kindsAfter('tag/toTag', ['tag', 'vec']), kindsAfter('kind/wraps', ['tag', 'kind']), kindsAfter('vec/sort', ['Box', 'tagged', 'vec'])])
      .toEqual([['tag'], ['kind'], ['Box', 'tagged', 'vec']]);
    expect(verbsReaching(scope, kindsAfter('vec/sort', ['Box', 'tagged', 'vec'])).get('f').address.name).toBe('Box/f');
  });

  it('keeps of the walk the kind `::tagged` of the value its label reached and none of the kinds beneath it, which the answer may change, and beside it the other kinds its returns names [QSBLD#answer], [QSHST#tools]', async () => {
    const session = await createSession();
    await session.evalCell(':Box |~~ A box. ~~| | :Box/g (::fn | returns |~~ A box. ~~| ::Box | impl ~(it)) | :vec/h (::fn | returns |~~ A count or a vector. ~~| #[::vec ::number] | impl ~(count))');
    const { scope } = session;
    const kindsAfter = (address, kinds) => answerKindsOf(scope, nodeOf(scope, address), kinds);
    expect([kindsAfter('tagged/within', ['Box', 'tagged', 'vec']), kindsAfter('Box/g', ['Box', 'tagged', 'vec']), kindsAfter('vec/h', ['vec'])])
      .toEqual([['Box', 'tagged'], ['Box', 'tagged'], ['vec', 'number']]);
    const answers = await Promise.all(['::Box[1 2] | within ~(get /0) | payload | type', '[1 2] | h | type'].map(query => session.evalCell(query)));
    expect(answers.map(cell => cell.result.name)).toEqual(['number', 'number']);
  });

  it('reads the kinds of an answer its returns names as a set [QSBLD#fn]', async () => {
    const session = await createSession();
    await session.evalCell(':Box |~~ A box. ~~| | :Box/f (::fn | returns |~~ The value. ~~| #[::number ::string] | impl ~(eq 1))');
    expect(answerKindsOf(session.scope, nodeOf(session.scope, 'Box/f'), ['Box'])).toEqual(['number', 'string']);
  });

  it('shows a verb written as its recipe alone, the function of no commands it is, with no inputs [QSHST#tools]', async () => {
    const session = await createSession();
    await session.evalCell(':number/double ~(mul 2)');
    expect(shownFor(session.scope, 'double')).toEqual({ address: expect.objectContaining({ name: 'number/double' }), inputs: [] });
  });

  it('reads whether the body of a declaration runs as it is written: a quote, and a function its chain or its literal gives a recipe [QSBLD#fn], [QSHST#tools]', () => {
    const bodyOf = source => parse(source)[0].get('body');
    const bodies = [
      ':v/f ~(add 1)', ':v/f (::fn | takes :x |~~ x ~~| /0 | impl ~(add x))', ':v/f ::fn[~() ~(add 1)]',
      ':v/f (::fn | takes :x |~~ x ~~| /0)', ':v/f (::fn | (impl ~(add 1)))', ':v/f ::fn[~() null]', ':v/f ::fn"x"', ':v/f (::kind | impl ~(1))', ':v/f 1'
    ];
    expect(bodies.map(source => bodyRuns(bodyOf(source)))).toEqual([true, true, true, false, false, false, false, false, false]);
  });

  it('reads a literal step, a tagged literal among them, apart from a step that computes or declares [QSLIT#closed], [QSHST#tools]', () => {
    expect(['[1 2]', '::Box{:a 1}', '1', '~(a)', '(add 1)', ':x 1', 'count'].map(source => holdsALiteral(parse(source)[0]))).toEqual([true, true, true, true, false, false, false]);
  });

  it('names the verbs of the root by their last names and their addresses, an address no verb stands at among none [QSNAM#verb], [QSHST#tools]', async () => {
    const names = verbNames(await langRuntime());
    expect(['sort', 'vec/sort', 'count', 'map/count', 'string/sort', 'vec', 'number/NotFiniteError'].map(name => names.has(name))).toEqual([true, true, true, true, false, false, false]);
  });

  it('holds whether a verb serves a subject as its call does, a tag name served by a verb of its noun whose `on` names `::tag` alone [QSDSP#tagname], [QSHST#tools]', async () => {
    const session = await createSession();
    await session.evalCell(':Desk |~~ A help desk. ~~| | :Desk/hours (::fn | on |~~ The desk. ~~| ::tag | impl ~("9 to 5")) | :Desk/size ~(count)');
    const serves = (address, subject) => servesTheSubject(nodeOf(session.scope, address), subject);
    const [desk, vec] = [makeTag('Desk'), makeTag('vec')];
    expect([serves('vec/count', [1]), serves('vec/count', vec), serves('tag/toTag', vec), serves('Desk/hours', desk), serves('Desk/hours', vec), serves('Desk/size', desk)])
      .toEqual([true, false, true, true, false, false]);
  });
});

describe('the verbs a value of a kind reaches [QSDSP#walk]', () => {
  it('reaches the verbs of its kind, then those of any value', async () => {
    const reached = verbsReaching(await langRuntime(), ['number']);
    expect(reached.get('add').address.name).toBe('number/add');
    expect(reached.get('type').address.name).toBe('any/type');
    expect(reached.get('take')).toBeUndefined();
  });

  it('leaves out a verb its kind does not answer', async () => {
    const scope = await langRuntime();
    expect(verbsReaching(scope, ['number']).has('count')).toBe(false);
    expect(verbsReaching(scope, ['vec']).get('count').address.name).toBe('vec/count');
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

  it('takes the walk from a set, a quote and a doc to the verbs of tagged values and of vectors, a set\'s own verb first [QSDSP#walk]', async () => {
    const scope = await langRuntime();
    const addressesFrom = (kindName, names) => names.map(name => verbsReaching(scope, [kindName]).get(name)?.address.name);
    expect(addressesFrom('set', ['sort', 'count', 'take', 'within'])).toEqual(['set/sort', 'vec/count', 'vec/take', 'tagged/within']);
    expect(addressesFrom('quote', ['count', 'toString'])).toEqual(['vec/count', 'quote/toString']);
    expect(addressesFrom('doc', ['count', 'links'])).toEqual(['vec/count', 'doc/links']);
    expect(shownFor(scope, 'count', ['set']).address.name).toBe('vec/count');
  });
});
