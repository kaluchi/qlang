import { describe, it, expect } from 'vitest';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { shownFor, answerKindsOf, nodeOf } from '../../../src/nouns.mjs';
import { createNotebook } from '../../../src/notebook.mjs';
import { forEachPart, tagWrittenBy, tagHeadEnd, findNameOccurrences, bindingNamesVisibleAt, TAG_SPELLING } from '../../../src/parsed-parts.mjs';
import { isTag, makeBinding, makeKeyword } from '../../../src/types.mjs';
import { rootOf, formOfAStep } from '../../helpers/read-text.mjs';

describe('a verb as the tooling reads it', () => {
  it('shows a name under a label by its address and the inputs of its function', async () => {
    const shown = shownFor(await langRuntime(), 'add');
    expect(shown.address.name).toBe('number/add');
    expect(shown.inputs).toEqual(['addend']);
  });

  it('shows nothing for a name that reaches neither a verb nor a name under a label', async () => {
    expect(shownFor(await langRuntime(), 'nothingAtAll')).toBeUndefined();
  });

  it('shows nothing for a name the scope binds to a value', async () => {
    const scope = new Map(await langRuntime()).set('five', makeBinding({ name: makeKeyword('five'), value: 5 }));
    expect(shownFor(scope, 'five')).toBeUndefined();
  });

  it('shows one of the verbs of a name several kinds answer, and the inputs of its function', async () => {
    const shown = shownFor(await langRuntime(), 'take');
    expect(['map/take', 'string/take', 'vec/take']).toContain(shown.address.name);
    expect(shown.inputs).toEqual(['count']);
  });

  it('shows the name any value answers', async () => {
    expect(shownFor(await langRuntime(), 'type').address.name).toBe('any/type');
  });

  it('shows the verb a subject of the kinds reaches, and the inputs of its function', async () => {
    const scope = await langRuntime();
    expect(shownFor(scope, 'count', ['vec']).address.name).toBe('vec/count');
    expect(shownFor(scope, 'count', ['map']).address.name).toBe('map/count');
    expect(shownFor(scope, 'take', ['string'])).toEqual({ address: expect.objectContaining({ name: 'string/take' }), inputs: ['count'] });
  });

  // [QSLSP#offer]
  it('shows a part a closed tag wires as a name of its label, which answers the kinds of its field', async () => {
    const scope = await langRuntime();
    const shown = shownFor(scope, 'end', ['span', 'tagged']);
    expect(shown).toEqual({ address: expect.objectContaining({ name: 'span/end' }), inputs: [] });
    expect(answerKindsOf(scope, nodeOf(scope, shown.address.name), ['span', 'tagged'])).toEqual(['point']);
  });

  it('shows a fact the kind of a refusal wires with no node of its own as a name of the refusal', async () => {
    const shown = shownFor(await langRuntime(), 'subject', ['number/add/SubjectNotNumberError', 'tagged']);
    expect(shown).toEqual({ address: expect.objectContaining({ name: 'number/add/SubjectNotNumberError/subject' }), inputs: [] });
  });

  it('shows the verb a name reaches with no subject where the kinds reach none', async () => {
    expect(shownFor(await langRuntime(), 'add', ['string']).address.name).toBe('number/add');
  });

  it('shows a verb written as its recipe alone, the function of no commands it is, with no inputs', async () => {
    const notebook = await createNotebook();
    await notebook.evalCell(':number/double mul 2;');
    expect(shownFor(notebook.scope, 'double')).toEqual({ address: expect.objectContaining({ name: 'number/double' }), inputs: [] });
  });
});

describe('where the head of a tag ends', () => {
  const headsOf = source => {
    const heads = [];
    forEachPart(rootOf(source), read => { if (tagHeadEnd(read) !== null) heads.push(source.slice(read.span.start.offset, tagHeadEnd(read))); });
    return heads;
  };

  it('reads where the head of the tag a tagged literal writes ends, before its payload and its sign', () => {
    expect(headsOf('get [::Width#5 ::A::B[1] ::T"s"]')).toEqual(['::Width', '::A', '::B', '::T']);
  });

  it('reads where the tags an error literal writes before its bang end, none for an error literal that writes none', () => {
    expect(headsOf('[::E!{:k 1} ::E::error!{} !{:j 2} ::A::B!{}]')).toEqual(['::E', '::E', '::error', '::A', '::B']);
    expect(headsOf(':Late |~~ A late error. ~~|\n  ::Late!{:by 3};')).toEqual(['::Late']);
  });

  it('reads where the tags written before a quote of a doc end', () => {
    expect(headsOf('|~~ see ::link~(x) and ::A::B~(1) or ~(2) ~~|')).toEqual(['::link', '::A::B']);
  });

  it('answers null for a part that writes no head', () => {
    expect(['42', '::Box', '[1]', 'count'].map(source => tagHeadEnd(rootOf(source).parts[0]))).toEqual([null, null, null, null]);
  });
});

it('names the tag a tagged literal writes, a tag written before an error literal among them, and the kind of errors written there a part of the literal', () => {
  const [error, call] = rootOf('::Foo!{:k 1} | get [::Bar[1] !{:j 2} ::Baz]').parts;
  const [vec] = call.parts;
  expect(vec.parts.map(tagWrittenBy)).toEqual(['Bar', null, null]);
  expect(tagWrittenBy(error)).toBe('Foo');
  expect(error.parts[0].parts.map(({ value }) => value?.name ?? value)).toEqual(['k', 1]);
  const [literal] = rootOf('::E::error!{}').parts[0].parts;
  expect(literal.parts.map(({ value }) => value.name)).toEqual(['error']);
});

describe('the occurrences of a name', () => {
  it('finds the calls of a name', () => {
    const refs = findNameOccurrences(rootOf('count | add count'), 'count');
    expect(refs.map(formOfAStep)).toEqual(['call', 'call']);
  });

  it('finds the declaration of a name beside its calls', () => {
    expect(findNameOccurrences(rootOf(':double mul 2; double'), 'double').map(formOfAStep)).toEqual(['bind', 'call']);
    expect(findNameOccurrences(rootOf(':snapshot 42; snapshot'), 'snapshot').map(formOfAStep)).toEqual(['bind', 'call']);
  });

  it('finds the tag an error literal writes before its bang beside a tagged literal', () => {
    // [QSERR#rest]
    const source = '::Foo!{:k 1} | get [::Foo[1] !{:j 2}]';
    const refs = findNameOccurrences(rootOf(source), 'Foo', TAG_SPELLING);
    expect(refs.map(({ span }) => source.slice(span.start.offset, span.end.offset))).toEqual(['::Foo!{:k 1}', '::Foo[1]']);
    expect(findNameOccurrences(rootOf('[::error!{:k 1} ::error]'), 'error', TAG_SPELLING)).toHaveLength(2);
  });

  it('finds the segments of a path by name', () => {
    expect(findNameOccurrences(rootOf('get /foo/bar | count'), 'foo').map(formOfAStep)).toEqual(['path']);
  });

  it('does not include keyword literals', () => {
    expect(findNameOccurrences(rootOf(':foo'), 'foo')).toHaveLength(0);
  });

  it('finds a tagged literal written as a tag', () => {
    const refs = findNameOccurrences(rootOf('::invariant~(count)'), 'invariant', TAG_SPELLING);
    expect(refs.map(formOfAStep)).toEqual(['construct']);
  });

  it('finds a name with a path by the name a step calls it by', () => {
    const refs = findNameOccurrences(rootOf(':any/double mul 2; [1 2] | map double | any/double'), 'double');
    expect(refs.map(formOfAStep)).toEqual(['bind', 'call', 'call']);
  });

  it('finds a tag written alone', () => {
    const refs = findNameOccurrences(rootOf('::Box | source'), 'Box', TAG_SPELLING);
    expect(refs.map(({ value }) => isTag(value) && value.name)).toEqual(['Box']);
  });

  it('finds the declaration of a kind written as a tag, and no declaration of a value of that name', () => {
    expect(findNameOccurrences(rootOf(':Box |~~ Box. ~~|;'), 'Box', TAG_SPELLING).map(formOfAStep)).toEqual(['bind']);
    expect(findNameOccurrences(rootOf(':Box 1;'), 'Box', TAG_SPELLING)).toEqual([]);
  });
});

describe('the names visible at a position', () => {
  const visibleIn = (source, offset = source.length, spelling) => bindingNamesVisibleAt(rootOf(source), offset, spelling);

  it('returns the names declared before the cursor', () => {
    const visible = visibleIn(':x 1; :y 2; z');
    expect(visible.has('x')).toBe(true);
    expect(visible.has('y')).toBe(true);
  });

  it('offers a name with a path by the name a step calls it by', () => {
    expect(visibleIn(':any/twice mul 2; 5').has('twice')).toBe(true);
  });

  it('does not include bindings ahead of the cursor', () => {
    const source = ':early 1; :late (here); late';
    const visible = visibleIn(source, source.indexOf('here'));
    expect(visible.has('early')).toBe(true);
    expect(visible.has('late')).toBe(false);
  });

  it('includes the declarations of the text in its query', () => {
    expect(visibleIn(':answer 42; answer').has('answer')).toBe(true);
  });

  it('a step that declares nothing contributes no name', () => {
    const source = '42 | mul 2 | here';
    expect(visibleIn(source, source.indexOf('here')).size).toBe(0);
  });

  it('hides bindings whose enclosing group closes before the cursor', () => {
    const source = '(:local 1; local) | here';
    expect(visibleIn(source, source.indexOf('here')).has('local')).toBe(false);
  });

  it('sees a binding inside its enclosing group', () => {
    const source = '(:local 1; local | other)';
    expect(visibleIn(source, source.indexOf('other')).has('local')).toBe(true);
  });

  it('hides bindings inside one quote of a vector from a sibling element', () => {
    const source = 'get [(:x 1; x) (x)]';
    expect(visibleIn(source, source.lastIndexOf('x')).has('x')).toBe(false);
  });

  it('hides bindings inside one map entry value from a sibling entry value', () => {
    const source = 'get {:a (:x 1; x) :b (x)}';
    expect(visibleIn(source, source.lastIndexOf('x')).has('x')).toBe(false);
  });

  it('sees a binding of the query inside nested groups, literals and quotes', () => {
    const source = ':outer 1; ((get [{:k (outer)}]))';
    expect(visibleIn(source, source.lastIndexOf('outer')).has('outer')).toBe(true);
  });

  it('surfaces the declarations of kinds by their names under the spelling of a tag', () => {
    expect(visibleIn(':MyType |~~ MyType. ~~| (::kind | impl ~(42)); 42', undefined, TAG_SPELLING).has('MyType')).toBe(true);
  });

  it('skips the declarations of names that are no kind under the spelling of a tag', () => {
    const visible = visibleIn(':valueName 1; 42', undefined, TAG_SPELLING);
    expect(visible.size).toBe(0);
  });

  it('hides the kind a closed group declares under the spelling of a tag', () => {
    const source = '(:Local |~~ Local. ~~| (::kind | impl ~(42));) | here';
    expect(visibleIn(source, source.indexOf('here'), TAG_SPELLING).has('Local')).toBe(false);
  });

  it('answers each name with the part of the last of its declarations visible there', () => {
    const source = ':x 1; :vec/x ~(2); (:x 3;) | here';
    const read = visibleIn(source, source.indexOf('here')).get('x');
    expect(source.slice(read.span.start.offset, read.span.end.offset)).toBe(':vec/x ~(2)');
  });

  it('answers a name with a path by its address beside its last name, and a label under the spelling of a tag by its address alone', () => {
    const source = ':vec/x ~(1); :string/x ~(2); :Box |~~ B ~~|; :Box/In |~~ I ~~|; here';
    const visible = visibleIn(source, source.indexOf('here'));
    const written = name => source.slice(visible.get(name).span.start.offset, visible.get(name).span.end.offset);
    expect(['vec/x', 'string/x', 'x', 'In'].map(written)).toEqual([':vec/x ~(1)', ':string/x ~(2)', ':string/x ~(2)', ':Box/In |~~ I ~~|']);
    expect([...visibleIn(source, source.indexOf('here'), TAG_SPELLING).keys()]).toEqual(['Box', 'Box/In']);
  });

  describe('in the body of a verb, around it and in its docs', () => {
    const source = ':k 1; :map/walk |~~ see ~(walk) ~~| (:j 2; get /kids | map walk); :vec/f f; :Late |~~ L ~~|; :n 3; here';
    const verbs = read => read.value.get('name').name.includes('/');
    const namesAt = (offset, spelling, declaresAVerb) => [...bindingNamesVisibleAt(rootOf(source), offset, spelling, declaresAVerb).keys()];
    const inTheBody = source.indexOf('map walk') + 4;

    it('sees in the body of a verb the declarations of the body before the offset and, outside the body, the verbs and the labels wherever they stand, and no value', () => {
      expect(namesAt(inTheBody, undefined, verbs)).toEqual(['map/walk', 'walk', 'j', 'vec/f', 'f', 'Late']);
    });

    it('sees in the body of a verb the labels alone under the spelling of a tag', () => {
      expect(namesAt(inTheBody, TAG_SPELLING, verbs)).toEqual(['Late']);
    });

    it('sees in the body of a verb the declarations before the offset alone where no predicate tells a verb', () => {
      expect(namesAt(inTheBody)).toEqual(['k', 'j']);
    });

    it('sees after the body of a verb the declarations before the offset', () => {
      expect(namesAt(source.indexOf(':vec/f'), undefined, verbs)).toEqual(['k', 'map/walk', 'walk']);
    });

    it('sees in the docs of a verb the declarations before the offset', () => {
      expect(namesAt(source.indexOf('(walk)') + 1, undefined, verbs)).toEqual(['k']);
    });
  });

  it('answers a name in the body of a verb with its nearest declaration, one in a text nearer the verb before one farther out', () => {
    const source = ':vec/g |~~ outer ~~| ~(2); (:vec/g |~~ inner ~~| ~(1); :vec/f g; [1] | f)';
    const reached = bindingNamesVisibleAt(rootOf(source), source.indexOf(':vec/f g') + 7, undefined, read => read.value.get('name').name.includes('/')).get('g');
    expect(source.slice(reached.span.start.offset, reached.span.end.offset)).toBe(':vec/g |~~ inner ~~| ~(1)');
  });

  it('answers a name in the body of a verb with the declaration nearer the verb, one farther out written after it set aside', () => {
    const source = ':h (:vec/g |~~ inner ~~| ~(1); :vec/f g; [1] | f); :vec/g |~~ outer ~~| ~(2); h';
    const reached = bindingNamesVisibleAt(rootOf(source), source.indexOf(':vec/f g') + 7, undefined, read => read.value.get('name').name.includes('/')).get('g');
    expect(source.slice(reached.span.start.offset, reached.span.end.offset)).toBe(':vec/g |~~ inner ~~| ~(1)');
  });
});
