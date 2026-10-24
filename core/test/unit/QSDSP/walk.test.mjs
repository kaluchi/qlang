import { describe, it, expect } from 'vitest';
import { createNotebook, evalQuery } from '../../../src/notebook.mjs';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { shownFor, verbsReaching } from '../../../src/nouns.mjs';

describe('the verbs that live on a kind', () => {
  it('a verb of any tagged value lives on the kind of tagged values', async () => {
    expect(await evalQuery('::tagged | manifest | has ::tagged/within')).toBe(true);
  });

  it('a host verb declared under a kind serves its values beneath a tag', async () => {
    const notebook = await createNotebook({ sources: [{
      uri: 'tests/typed',
      source: ':string/shout ::builtin{}',
      primitives: { 'string/shout': text => text.toUpperCase() }
    }] });
    expect((await notebook.evalCell('::Box"hi" | shout')).result).toBe('HI');
  });
});

describe('the verbs a value of a kind reaches', () => {
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
    expect(reached.get('toString').address.name).toBe('tag/toString');
  });

  it('reaches only the verbs of any value for a kind no source declares', async () => {
    const reached = verbsReaching(await langRuntime(), ['Width']);
    expect(reached.has('type')).toBe(true);
    expect(reached.has('add')).toBe(false);
  });

  it('takes the walk from a set, a quote and a doc to the verbs of tagged values and of vectors, a set\'s own verb first', async () => {
    const scope = await langRuntime();
    const addressesFrom = (kindName, names) => names.map(name => verbsReaching(scope, [kindName]).get(name)?.address.name);
    expect(addressesFrom('set', ['sort', 'count', 'take', 'within'])).toEqual(['set/sort', 'vec/count', 'vec/take', 'tagged/within']);
    expect(addressesFrom('quote', ['count', 'toString'])).toEqual(['vec/count', 'quote/toString']);
    expect(addressesFrom('doc', ['count', 'links'])).toEqual(['vec/count', 'doc/links']);
    expect(shownFor(scope, 'count', ['set']).address.name).toBe('vec/count');
  });
});
