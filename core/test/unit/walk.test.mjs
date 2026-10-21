// The parts the parser reads beside the records of the steps, and the walks
// over them the readers of a text share [QSQUO#step].

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import {
  keepParts,
  partOf,
  originOf,
  walkParts,
  partAtOffset,
  tagWrittenBy,
  tagHeadEnd,
  findNameOccurrences,
  visibleAt,
  bindingNamesVisibleAt, readsItsSubject, repeatsDeclarationAt, TAG_SPELLING } from '../../src/walk.mjs';
import { isCallStep, isBindStep, isConstructStep, isGroupStep, commandStep } from '../../src/steps.mjs';
import { isPath, isTag, isVec, isQuote, makeQuote } from '../../src/types.mjs';

const rootOf = source => partOf(parse(source));
const valuesOf = parts => parts.map(read => read.value);
const kindOf = ({ value }) => (isBindStep(value) ? 'bind' : isCallStep(value) ? 'call' : isConstructStep(value) ? 'construct' : isPath(value) ? 'path' : 'literal');

describe('the parts of a text', () => {
  it('[QSQUO#step] holds a part for each step of a pipeline and each element of a vector', () => {
    const root = rootOf('[1 2 3] | count');
    expect(root.parts).toHaveLength(2);
    expect(root.parts[0].value).toEqual([1, 2, 3]);
    expect(valuesOf(root.parts[0].parts)).toEqual([1, 2, 3]);
    expect(isCallStep(root.parts[1].value)).toBe(true);
  });

  it('[QSQUO#step] holds a part for each key and each value of a map, each entry of a key written again among them', () => {
    const keysAndValues = source => valuesOf(rootOf(source).parts[0].parts).map(value => value?.name ?? value);
    expect(keysAndValues('{:name "Alice" :age 30}')).toEqual(['name', 'Alice', 'age', 30]);
    expect(keysAndValues('{:a 1 :a 2}')).toEqual(['a', 1, 'a', 2]);
  });

  it('[QSQUO#step] holds the name and the body of a declaration, and the modifiers of a call', () => {
    const [bind] = rootOf(':double mul 2').parts;
    expect(kindOf(bind)).toBe('bind');
    expect(bind.parts.map(kindOf)).toEqual(['literal', 'call']);
    expect([bind.parts[0].value.name, bind.parts[1].value.get('name').name]).toEqual(['double', 'mul']);
    expect(valuesOf(bind.parts[1].parts)).toEqual([2]);
  });

  it('[QSQUO#step] holds the steps of a group, its content the pipeline its parentheses hold', () => {
    const source = '(mul 2 | add 1)';
    const [group] = rootOf(source).parts;
    expect(isGroupStep(group.value)).toBe(true);
    expect(group.parts.map(kindOf)).toEqual(['call', 'call']);
    expect(source.slice(group.content.start.offset, group.content.end.offset)).toBe('mul 2 | add 1');
  });

  it('[QSQUO#step] holds no part under an atom and no part for a call with no modifiers', () => {
    expect(rootOf('42').parts[0].parts).toEqual([]);
    expect(rootOf('count').parts[0].parts).toEqual([]);
  });

  it('[QSQUO#step] keeps each part by the value it read, and none for a value no text wrote', () => {
    const quote = parse('[1 2] | count');
    expect(partOf(quote[1]).value).toBe(quote[1]);
    expect(partOf(quote[0]).parts).toHaveLength(2);
    expect(partOf(commandStep('count', []))).toBeUndefined();
  });

  it('[QSQUO#step] keeps the steps of a group and of a step of the fail track by the part of the step', () => {
    const [group] = parse('(1 | add 1)');
    expect(partOf(group.payload)).toBe(partOf(group));
    const quote = parse('x !| get /a');
    expect(partOf(quote[1].payload)).toBe(partOf(quote[1]));
  });

  it('[QSQUO#step] holds the parent of each part, the root holding none', () => {
    const root = rootOf('[1 2 3]');
    expect(root.parent).toBeNull();
    expect(root.parts[0].parent).toBe(root);
    expect(root.parts[0].parts[1].parent).toBe(root.parts[0]);
  });

  it('[QSQUO#step] reads the parent of each part again from a part handed to it', () => {
    const root = rootOf('count');
    root.parts[0].parent = undefined;
    keepParts(root);
    expect(root.parts[0].parent).toBe(root);
  });

  it('[QSHST#source] names the source of a quote by the name its reader gave it, `quote` for one no text wrote', () => {
    expect(originOf(parse('add 1', { uri: 'cell-3' }))).toBe('cell-3');
    expect(originOf(makeQuote([commandStep('count', [])]))).toBe('quote');
  });

  it('[QSHST#tools] holds the span of the text of a doc, its quotes among it, which ends where its last word does, the whitespace before its closer aside', () => {
    const source = ':x\n  |~~ one\n  two ~(add 1)\n  three\n  ~~|\n  1 | |~~| a line  ';
    const [bind, line] = rootOf(source).parts;
    const [, doc] = bind.parts;
    const textOf = ({ text }) => [source.slice(text.start.offset, text.end.offset), text.end.line];
    expect(textOf(doc)).toEqual([' one\n  two ~(add 1)\n  three', 4]);
    expect(textOf(line)).toEqual([' a line', 6]);
  });

  it('[QSHST#tools] holds the code between the backquotes of a doc, a run of them closing at a run of as many, across the lines of a block doc', () => {
    const codeOf = source => rootOf(source).parts[0].backquoted.map(({ start, end }) => source.slice(start.offset, end.offset));
    expect(codeOf('|~~ a `count` b ``x`y`` c `` d ~~|')).toEqual(['count', 'x`y']);
    expect(codeOf('|~~ a `[1\n2]` ~(`x`) ~~|')).toEqual(['[1\n2]']);
    expect(codeOf('|~~| a `add 1`')).toEqual(['add 1']);
  });
});

describe('walkParts', () => {
  it('[QSHST#tools] visits every part before the parts it holds', () => {
    const visited = [];
    walkParts(rootOf('[1 2] | add 3'), ({ value }) => visited.push(isQuote(value) ? 'quote' : isVec(value) ? 'vec' : isCallStep(value) ? 'call' : value));
    expect(visited).toEqual(['quote', 'vec', 1, 2, 'call', 3]);
  });

  it('[QSHST#tools] skips the parts of a part its visitor answers false for', () => {
    const numbers = [];
    walkParts(rootOf('[1 2] | add 3'), ({ value }) => {
      if (typeof value === 'number') numbers.push(value);
      if (isVec(value) && !isQuote(value)) return false;
    });
    expect(numbers).toEqual([3]);
  });

  it('[QSHST#tools] passes the parent to the visitor', () => {
    const parents = [];
    walkParts(rootOf('[1 2 3]'), ({ value }, parent) => {
      if (typeof value === 'number') parents.push(parent.value);
    });
    expect(parents).toEqual([[1, 2, 3], [1, 2, 3], [1, 2, 3]]);
  });
});

describe('partAtOffset', () => {
  it('[QSHST#tools] returns null when the offset is outside any part', () => {
    expect(partAtOffset(rootOf('[1 2 3]'), 999)).toBeNull();
  });

  it('[QSHST#tools] returns the narrowest part holding the offset', () => {
    // Offset 19 lands inside `gt 2`.
    const read = partAtOffset(rootOf('[1 2 3] | filter ~(gt 2)'), 19);
    expect(read.value.get('name').name).toBe('gt');
  });

  it('[QSHST#tools] returns the part at the start of a number literal', () => {
    expect(partAtOffset(rootOf('42'), 0).value).toBe(42);
  });
});

describe('tagHeadEnd', () => {
  const headsOf = source => {
    const heads = [];
    walkParts(rootOf(source), read => { if (tagHeadEnd(read) !== null) heads.push(source.slice(read.span.start.offset, tagHeadEnd(read))); });
    return heads;
  };

  it('[QSHST#tools] reads where the head of the tag a tagged literal writes ends, before its payload and its sign', () => {
    expect(headsOf('get [::Width#5 ::A::B[1] ::T"s"]')).toEqual(['::Width', '::A', '::B', '::T']);
  });

  it('[QSHST#tools] reads where the tags an error literal writes before its bang end, none for an error literal that writes none', () => {
    expect(headsOf('[::E!{:k 1} ::E::error!{} !{:j 2} ::A::B!{}]')).toEqual(['::E', '::E', '::error', '::A', '::B']);
    expect(headsOf(':Late |~~ A late error. ~~|\n  ::Late!{:by 3}')).toEqual(['::Late']);
  });

  it('[QSHST#tools] reads where the tags written before a quote of a doc end', () => {
    expect(headsOf('|~~ see ::link~(x) and ::A::B~(1) or ~(2) ~~|')).toEqual(['::link', '::A::B']);
  });

  it('[QSHST#tools] answers null for a part that writes no head', () => {
    expect(['42', '::Box', '[1]', 'count'].map(source => tagHeadEnd(rootOf(source).parts[0]))).toEqual([null, null, null, null]);
  });
});

describe('tagWrittenBy', () => {
  it('[QSHST#tools] names the tag a tagged literal writes, a tag written before an error literal among them, and the kind of errors written there a part of the literal', () => {
    const [error, call] = rootOf('::Foo!{:k 1} | get [::Bar[1] !{:j 2} ::Baz]').parts;
    const [vec] = call.parts;
    expect(vec.parts.map(tagWrittenBy)).toEqual(['Bar', null, null]);
    expect(tagWrittenBy(error)).toBe('Foo');
    expect(error.parts[0].parts.map(({ value }) => value?.name ?? value)).toEqual(['k', 1]);
    const [literal] = rootOf('::E::error!{}').parts[0].parts;
    expect(literal.parts.map(({ value }) => value.name)).toEqual(['error']);
  });
});

describe('findNameOccurrences', () => {
  it('[QSHST#tools] finds the calls of a name', () => {
    const refs = findNameOccurrences(rootOf('count | add count'), 'count');
    expect(refs.map(kindOf)).toEqual(['call', 'call']);
  });

  it('[QSHST#tools] finds the declaration of a name beside its calls', () => {
    expect(findNameOccurrences(rootOf(':double mul 2 | double'), 'double').map(kindOf)).toEqual(['bind', 'call']);
    expect(findNameOccurrences(rootOf('42 | :snapshot it | snapshot'), 'snapshot').map(kindOf)).toEqual(['bind', 'call']);
  });

  it('[QSHST#tools] finds the tag an error literal writes before its bang beside a tagged literal', () => {
    // `::Foo!{…}` names the tag of its content, and an error literal
    // that writes none names no tag [QSERR#rest].
    const source = '::Foo!{:k 1} | get [::Foo[1] !{:j 2}]';
    const refs = findNameOccurrences(rootOf(source), 'Foo', TAG_SPELLING);
    expect(refs.map(({ span }) => source.slice(span.start.offset, span.end.offset))).toEqual(['::Foo!{:k 1}', '::Foo[1]']);
    expect(findNameOccurrences(rootOf('[::error!{:k 1} ::error]'), 'error', TAG_SPELLING)).toHaveLength(2);
  });

  it('[QSHST#tools] finds the segments of a path by name', () => {
    expect(findNameOccurrences(rootOf('get /foo/bar | count'), 'foo').map(kindOf)).toEqual(['path']);
  });

  it('[QSHST#tools] does not include keyword literals', () => {
    expect(findNameOccurrences(rootOf(':foo'), 'foo')).toHaveLength(0);
  });

  it('[QSHST#tools] finds a tagged literal written as a tag', () => {
    const refs = findNameOccurrences(rootOf('::invariant~(count)'), 'invariant', TAG_SPELLING);
    expect(refs.map(kindOf)).toEqual(['construct']);
  });

  it('[QSHST#tools] finds a name with a path by the name a step calls it by', () => {
    const refs = findNameOccurrences(rootOf(':any/double ~(mul 2) | [1 2] | map ~double | any/double'), 'double');
    expect(refs.map(kindOf)).toEqual(['bind', 'call', 'call']);
  });

  it('[QSHST#tools] finds a tag written alone', () => {
    const refs = findNameOccurrences(rootOf('::Box | source'), 'Box', TAG_SPELLING);
    expect(refs.map(({ value }) => isTag(value) && value.name)).toEqual(['Box']);
  });

  it('[QSHST#tools] finds the declaration of a kind written as a tag, and no declaration of a value of that name', () => {
    expect(findNameOccurrences(rootOf(':Box |~~ Box. ~~|'), 'Box', TAG_SPELLING).map(kindOf)).toEqual(['bind']);
    expect(findNameOccurrences(rootOf(':Box 1'), 'Box', TAG_SPELLING)).toEqual([]);
  });
});

describe('bindingNamesVisibleAt', () => {
  const visibleIn = (source, offset = source.length, spelling) => bindingNamesVisibleAt(rootOf(source), offset, spelling);

  it('[QSHST#tools] returns the names declared before the cursor', () => {
    const visible = visibleIn(':x 1 | :y 2 | z');
    expect(visible.has('x')).toBe(true);
    expect(visible.has('y')).toBe(true);
  });

  it('[QSHST#tools] offers a name with a path by the name a step calls it by', () => {
    expect(visibleIn(':any/twice ~(mul 2) | 5').has('twice')).toBe(true);
  });

  it('[QSHST#tools] does not include bindings ahead of the cursor', () => {
    const source = ':early 1 | here | :late 2';
    const visible = visibleIn(source, source.indexOf('here'));
    expect(visible.has('early')).toBe(true);
    expect(visible.has('late')).toBe(false);
  });

  it('[QSHST#tools] includes the declarations of it', () => {
    expect(visibleIn('42 | :answer it | answer').has('answer')).toBe(true);
  });

  it('[QSHST#tools] a step that declares nothing contributes no name', () => {
    const source = '42 | mul 2 | here';
    expect(visibleIn(source, source.indexOf('here')).size).toBe(0);
  });

  it('[QSHST#tools] hides bindings whose enclosing group closes before the cursor', () => {
    const source = '(:local 1 | local) | here';
    expect(visibleIn(source, source.indexOf('here')).has('local')).toBe(false);
  });

  it('[QSHST#tools] sees a binding inside its enclosing group', () => {
    const source = '(:local 1 | local | other)';
    expect(visibleIn(source, source.indexOf('other')).has('local')).toBe(true);
  });

  it('[QSHST#tools] hides bindings inside one quote of a vector from a sibling element', () => {
    const source = 'get [~(:x 1 | x) ~(x)]';
    expect(visibleIn(source, source.lastIndexOf('x')).has('x')).toBe(false);
  });

  it('[QSHST#tools] hides bindings inside one map entry value from a sibling entry value', () => {
    const source = 'get {:a ~(:x 1 | x) :b ~(x)}';
    expect(visibleIn(source, source.lastIndexOf('x')).has('x')).toBe(false);
  });

  it('[QSHST#tools] sees a binding of the query inside nested groups, literals and quotes', () => {
    const source = ':outer 1 | ((get [{:k ~(outer)}]))';
    expect(visibleIn(source, source.lastIndexOf('outer')).has('outer')).toBe(true);
  });

  it('[QSHST#tools] surfaces the declarations of kinds by their names under the spelling of a tag', () => {
    expect(visibleIn(':MyType |~~ MyType. ~~| (::kind | impl ~(42)) | 42', undefined, TAG_SPELLING).has('MyType')).toBe(true);
  });

  it('[QSHST#tools] skips the declarations of names that are no kind under the spelling of a tag', () => {
    const visible = visibleIn(':valueName 1 | 42', undefined, TAG_SPELLING);
    expect(visible.size).toBe(0);
  });

  it('[QSHST#tools] hides the kind a closed group declares under the spelling of a tag', () => {
    const source = '(:Local |~~ Local. ~~| (::kind | impl ~(42))) | here';
    expect(visibleIn(source, source.indexOf('here'), TAG_SPELLING).has('Local')).toBe(false);
  });

  it('[QSHST#tools] answers each name with the part of the last of its declarations visible there', () => {
    const source = ':x 1 | :vec/x ~(2) | (:x 3) | here';
    const read = visibleIn(source, source.indexOf('here')).get('x');
    expect(source.slice(read.span.start.offset, read.span.end.offset)).toBe(':vec/x ~(2)');
  });

  it('[QSHST#tools] answers a name with a path by its address beside its last name, and a label under the spelling of a tag by its address alone', () => {
    const source = ':vec/x ~(1) | :string/x ~(2) | :Box |~~ B ~~| | :Box/In |~~ I ~~| | here';
    const visible = visibleIn(source, source.indexOf('here'));
    const written = name => source.slice(visible.get(name).span.start.offset, visible.get(name).span.end.offset);
    expect(['vec/x', 'string/x', 'x', 'In'].map(written)).toEqual([':vec/x ~(1)', ':string/x ~(2)', ':string/x ~(2)', ':Box/In |~~ I ~~|']);
    expect([...visibleIn(source, source.indexOf('here'), TAG_SPELLING).keys()]).toEqual(['Box', 'Box/In']);
  });

  // The declarations a predicate `declaresAVerb` holds of are verbs, here a
  // name with a path.
  describe('in the body of a verb, around it and in its docs', () => {
    const source = ':k 1 | :map/walk |~~ see ~(walk) ~~| ~(:j 2 | get /kids | map ~walk) | here | :vec/f ~(f) | :Late |~~ L ~~| | :n 3';
    const verbs = read => read.value.get('name').name.includes('/');
    const namesAt = (offset, spelling, declaresAVerb) => [...bindingNamesVisibleAt(rootOf(source), offset, spelling, declaresAVerb).keys()];
    const inTheBody = source.indexOf('~walk') + 1;

    it('[QSHST#tools] sees in the body of a verb the declarations of the body before the offset and, outside the body, the verbs and the labels wherever they stand, and no value', () => {
      expect(namesAt(inTheBody, undefined, verbs)).toEqual(['map/walk', 'walk', 'j', 'vec/f', 'f', 'Late']);
    });

    it('[QSHST#tools] sees in the body of a verb the labels alone under the spelling of a tag', () => {
      expect(namesAt(inTheBody, TAG_SPELLING, verbs)).toEqual(['Late']);
    });

    it('[QSHST#tools] sees in the body of a verb the declarations before the offset alone where no predicate tells a verb', () => {
      expect(namesAt(inTheBody)).toEqual(['k', 'j']);
    });

    it('[QSHST#tools] sees after the body of a verb the declarations before the offset', () => {
      expect(namesAt(source.indexOf('here'), undefined, verbs)).toEqual(['k', 'map/walk', 'walk']);
    });

    it('[QSHST#tools] sees in the docs of a verb the declarations before the offset', () => {
      expect(namesAt(source.indexOf('(walk)') + 1, undefined, verbs)).toEqual(['k']);
    });
  });

  it('[QSHST#tools] answers a name in the body of a verb with its nearest declaration, one in a pipeline nearer the verb before one written later farther out', () => {
    const source = '(:vec/g |~~ inner ~~| ~(1) | :vec/f ~(g) | [1] | f) | :vec/g |~~ outer ~~| ~(2)';
    const reached = bindingNamesVisibleAt(rootOf(source), source.indexOf('~(g)') + 2, undefined, read => read.value.get('name').name.includes('/')).get('g');
    expect(source.slice(reached.span.start.offset, reached.span.end.offset)).toBe(':vec/g |~~ inner ~~| ~(1)');
  });
});

describe('visibleAt', () => {
  const declarationIn = source => {
    let found = null;
    walkParts(rootOf(source), read => { if (isBindStep(read.value) && found === null) found = read; });
    return found;
  };

  it('[QSNAM#scope] sees a declaration inside a quote within the pipeline the quote holds, its end included', () => {
    const source = 'get [~(:x 1 | x) 5]';
    const declaration = declarationIn(source);
    expect(visibleAt(declaration, source.indexOf('| x') + 2)).toBe(true);
    expect(visibleAt(declaration, source.indexOf(')'))).toBe(true);
    expect(visibleAt(declaration, source.indexOf('5'))).toBe(false);
    expect(visibleAt(declaration, source.indexOf('~'))).toBe(false);
  });

  it('[QSNAM#scope] sees a declaration of the query everywhere after it', () => {
    const source = ':x 1 | (get [~(x)])';
    expect(visibleAt(declarationIn(source), source.lastIndexOf('x'))).toBe(true);
  });
});

describe('repeatsDeclarationAt', () => {
  it('[QSNAM#scope] holds a declaration that repeats a name an earlier step of its quote declared, on either track', () => {
    const quote = parse(':x 1 | :y 2 | :x 3 | x !| :y 4');
    expect([0, 1, 2, 3, 4].map(index => repeatsDeclarationAt(quote, index))).toEqual([false, false, true, false, true]);
  });
});

// A query reads its subject where its first step that declares nothing
// does, or a declaration's body before it; a host waits on the stream it
// lifts the subject from only then [QSHST#stdin].
describe('readsItsSubject', () => {
  const readsOf = query => readsItsSubject(parse(query));

  it('[QSHST#stdin] holds that a literal of no parts reads no subject, a path among them', () => {
    for (const query of ['1', '"s"', 'true', 'null', ':k', '::vec', '/a']) expect(readsOf(query), query).toBe(false);
  });

  it('[QSHST#stdin] holds that a quote reads none, its code not run', () => {
    expect(readsOf('~(get /a)')).toBe(false);
  });

  it('[QSHST#stdin] holds that a literal of parts reads none, its parts literals, and a group reads it where its code does', () => {
    for (const query of ['[1 2]', '#[1]', '{:a 1}', '!{:a 1}', '::Box{:k 1}', '::Width#5', '[~(get /a) 1]', '{:a ~(get /b)}', '(1 | add 1)', '|~~ see ::link~(get /x) ~~|', '[/a 1]', '{:a /b}']) {
      expect(readsOf(query), query).toBe(false);
    }
    for (const query of ['get [/a 1]', 'get {:a /b}', '(get /a)', '((get /a) | count)']) expect(readsOf(query), query).toBe(true);
  });

  it('[QSHST#stdin] reads none where its first step that declares nothing calls a verb of the host that reads none, by its name or its address', () => {
    const verbs = new Set(['in', 'any/in']);
    for (const query of ['in | count', 'any/in', '(in) | count', ':x 1 | in']) expect(readsItsSubject(parse(query), verbs), query).toBe(false);
    for (const query of ['count | in', ':x (get /a) | in', 'vec/in']) expect(readsItsSubject(parse(query), verbs), query).toBe(true);
    expect(readsOf('in')).toBe(true);
  });

  it('[QSHST#stdin] reads such a verb called by its name as reading the subject where a declaration before it shadows the name, its address left the host\'s', () => {
    const verbs = new Set(['in', 'any/in']);
    for (const query of [':vec/in ~(count) | in', ':in ~(count) | in', '(:string/in ~(count) | in)']) expect(readsItsSubject(parse(query), verbs), query).toBe(true);
    expect(readsItsSubject(parse(':vec/in ~(count) | any/in'), verbs)).toBe(false);
  });

  it('[QSHST#stdin] reads past a step of the fail track at its head, which runs on a failure alone, a declaration under it among them', () => {
    for (const query of ['!| 5 | count', '!| :x 1 | count', '!| 5']) expect(readsOf(query), query).toBe(true);
    expect(readsItsSubject(parse('!| in | count'), new Set(['in']))).toBe(true);
    for (const query of ['!| count | (1)', '!| :x (get /a) | [1]']) expect(readsOf(query), query).toBe(false);
  });

  it('[QSHST#stdin] holds that a call and a blank query read it', () => {
    for (const query of ['get /a', 'doc', '']) expect(readsOf(query), query).toBe(true);
  });

  it('[QSHST#stdin] reads a pipeline by its first step that declares nothing', () => {
    expect(readsOf('1 | add 1')).toBe(false);
    expect(readsOf('/a/0 | segments')).toBe(false);
    expect(readsOf('::vec | doc')).toBe(false);
    expect(readsOf('doc | get [1]')).toBe(true);
    expect(readsOf(':two 2 | [1]')).toBe(false);
  });

  it('[QSHST#stdin] reads a declaration whose body reads, and a query of declarations alone', () => {
    expect(readsOf(':x (get /a) | [1]')).toBe(true);
    expect(readsOf(':two 2')).toBe(true);
    expect(readsOf(':a 1 | :b 2')).toBe(true);
    expect(readsOf(':Box |~~ A box. ~~| | [1]')).toBe(false);
  });
});
