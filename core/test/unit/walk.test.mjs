// The parts the parser reads beside the records of the steps, and the walks
// over them the readers of a text share [D367].

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import {
  keepParts,
  partOf,
  originOf,
  walkParts,
  partAtOffset,
  tagWrittenBy,
  findNameOccurrences,
  visibleAt,
  bindingNamesVisibleAt, readsItsSubject, repeatsDeclarationAt, TAG_SPELLING } from '../../src/walk.mjs';
import { isCallStep, isBindStep, isConstructStep, commandStep } from '../../src/steps.mjs';
import { isPath, isTag, isVec, isQuote, makeQuote } from '../../src/types.mjs';

const rootOf = source => partOf(parse(source));
const valuesOf = parts => parts.map(read => read.value);
const kindOf = ({ value }) => (isBindStep(value) ? 'bind' : isCallStep(value) ? 'call' : isConstructStep(value) ? 'construct' : isPath(value) ? 'path' : 'literal');

describe('the parts of a text', () => {
  it('holds a part for each step of a pipeline and each element of a vector', () => {
    const root = rootOf('[1 2 3] | count');
    expect(root.parts).toHaveLength(2);
    expect(root.parts[0].value).toEqual([1, 2, 3]);
    expect(valuesOf(root.parts[0].parts)).toEqual([1, 2, 3]);
    expect(isCallStep(root.parts[1].value)).toBe(true);
  });

  it('holds a part for each key and each value of a map', () => {
    const [map] = rootOf('{:name "Alice" :age 30}').parts;
    expect(valuesOf(map.parts).map(value => value?.name ?? value)).toEqual(['name', 'Alice', 'age', 30]);
  });

  it('holds the name and the body of a declaration, and the modifiers of a call', () => {
    const [bind] = rootOf(':double mul 2').parts;
    expect(bind.parts.map(kindOf)).toEqual(['literal', 'call']);
    expect(bind.parts[0].value.name).toBe('double');
    expect(valuesOf(bind.parts[1].parts)).toEqual([2]);
  });

  it('holds the steps of a group, its content the pipeline its parentheses hold', () => {
    const source = '(mul 2 | add 1)';
    const [group] = rootOf(source).parts;
    expect(group.parts.map(kindOf)).toEqual(['call', 'call']);
    expect(source.slice(group.content.start.offset, group.content.end.offset)).toBe('mul 2 | add 1');
  });

  it('holds no part under an atom and no part for a call with no modifiers', () => {
    expect(rootOf('42').parts[0].parts).toEqual([]);
    expect(rootOf('count').parts[0].parts).toEqual([]);
  });

  it('keeps each part by the value it read, and none for a value no text wrote', () => {
    const quote = parse('[1 2] | count');
    expect(partOf(quote[1]).value).toBe(quote[1]);
    expect(partOf(quote[0]).parts).toHaveLength(2);
    expect(partOf(commandStep('count', []))).toBeUndefined();
    expect(partOf(42)).toBeUndefined();
  });

  it('keeps the steps of a group and of a step of the fail track by the part of the step', () => {
    const [group] = parse('(1 | add 1)');
    expect(partOf(group.payload)).toBe(partOf(group));
    const quote = parse('x !| get /a');
    expect(partOf(quote[1].payload)).toBe(partOf(quote[1]));
  });

  it('holds the parent of each part, the root holding none', () => {
    const root = rootOf('[1 2 3]');
    expect(root.parent).toBeNull();
    expect(root.parts[0].parent).toBe(root);
    expect(root.parts[0].parts[1].parent).toBe(root.parts[0]);
  });

  it('reads the parent of each part again from a part handed to it', () => {
    const root = rootOf('count');
    root.parts[0].parent = undefined;
    keepParts(root);
    expect(root.parts[0].parent).toBe(root);
  });

  it('names the source of a quote by the name its reader gave it, `quote` for one no text wrote [QSDSP#residence]', () => {
    expect(originOf(parse('add 1', { uri: 'cell-3' }))).toBe('cell-3');
    expect(originOf(makeQuote([commandStep('count', [])]))).toBe('quote');
  });
});

describe('walkParts', () => {
  it('visits every part before the parts it holds', () => {
    const visited = [];
    walkParts(rootOf('[1 2] | add 3'), ({ value }) => visited.push(isQuote(value) ? 'quote' : isVec(value) ? 'vec' : isCallStep(value) ? 'call' : value));
    expect(visited).toEqual(['quote', 'vec', 1, 2, 'call', 3]);
  });

  it('skips the parts of a part its visitor answers false for', () => {
    const numbers = [];
    walkParts(rootOf('[1 2] | add 3'), ({ value }) => {
      if (typeof value === 'number') numbers.push(value);
      if (isVec(value) && !isQuote(value)) return false;
    });
    expect(numbers).toEqual([3]);
  });

  it('passes the parent to the visitor', () => {
    const parents = [];
    walkParts(rootOf('[1 2 3]'), ({ value }, parent) => {
      if (typeof value === 'number') parents.push(parent.value);
    });
    expect(parents).toEqual([[1, 2, 3], [1, 2, 3], [1, 2, 3]]);
  });
});

describe('partAtOffset', () => {
  it('returns null when the offset is outside any part', () => {
    expect(partAtOffset(rootOf('[1 2 3]'), 999)).toBeNull();
  });

  it('returns the narrowest part holding the offset', () => {
    // Offset 19 lands inside `gt 2`.
    const read = partAtOffset(rootOf('[1 2 3] | filter ~(gt 2)'), 19);
    expect(read.value.get('name').name).toBe('gt');
  });

  it('returns the part at the start of a number literal', () => {
    expect(partAtOffset(rootOf('42'), 0).value).toBe(42);
  });
});

describe('tagWrittenBy', () => {
  it('names the tag a tagged literal writes, an error literal holding each tag written before its bang as a part [QSERR#rest], [D367]', () => {
    const [error, call] = rootOf('::Foo!{:k 1} | get [::Bar[1] !{:j 2} ::Baz]').parts;
    const [vec] = call.parts;
    expect(vec.parts.map(tagWrittenBy)).toEqual(['Bar', null, null]);
    expect(tagWrittenBy(error)).toBeNull();
    expect(error.parts.map(({ value }) => (isTag(value) ? value.name : value?.name ?? value))).toEqual(['Foo', 'k', 1]);
    expect(rootOf('::E::error!{}').parts[0].parts.map(({ value }) => value.name)).toEqual(['E', 'error']);
  });
});

describe('findNameOccurrences', () => {
  it('finds the calls of a name', () => {
    const refs = findNameOccurrences(rootOf('count | add count'), 'count');
    expect(refs.map(kindOf)).toEqual(['call', 'call']);
  });

  it('finds the declaration of a name beside its calls', () => {
    expect(findNameOccurrences(rootOf(':double mul 2 | double'), 'double').map(kindOf)).toEqual(['bind', 'call']);
    expect(findNameOccurrences(rootOf('42 | :snapshot it | snapshot'), 'snapshot').map(kindOf)).toEqual(['bind', 'call']);
  });

  it('finds the tag an error literal writes before its bang beside a tagged literal', () => {
    // `::Foo!{…}` names the tag of its content, and an error literal
    // that writes none names no tag [QSERR#rest].
    const source = '::Foo!{:k 1} | get [::Foo[1] !{:j 2}]';
    const refs = findNameOccurrences(rootOf(source), 'Foo', TAG_SPELLING);
    expect(refs.map(({ span }) => source.slice(span.start.offset, span.end.offset))).toEqual(['::Foo', '::Foo[1]']);
    expect(findNameOccurrences(rootOf('[::error!{:k 1} ::error]'), 'error', TAG_SPELLING)).toHaveLength(2);
  });

  it('finds the segments of a path by name', () => {
    expect(findNameOccurrences(rootOf('get /foo/bar | count'), 'foo').map(kindOf)).toEqual(['path']);
  });

  it('does not include keyword literals', () => {
    expect(findNameOccurrences(rootOf(':foo'), 'foo')).toHaveLength(0);
  });

  it('finds a tagged literal written as a tag', () => {
    const refs = findNameOccurrences(rootOf('::invariant~(count)'), 'invariant', TAG_SPELLING);
    expect(refs.map(kindOf)).toEqual(['construct']);
  });

  it('finds a name with a path by the name a step calls it by', () => {
    const refs = findNameOccurrences(rootOf(':any/double ~(mul 2) | [1 2] | map ~double | any/double'), 'double');
    expect(refs.map(kindOf)).toEqual(['bind', 'call', 'call']);
  });

  it('finds a tag written alone', () => {
    const refs = findNameOccurrences(rootOf('::Box | source'), 'Box', TAG_SPELLING);
    expect(refs.map(({ value }) => isTag(value) && value.name)).toEqual(['Box']);
  });

  it('finds the declaration of a kind written as a tag, and no declaration of another name', () => {
    expect(findNameOccurrences(rootOf(':Box |~~ Box. ~~|'), 'Box', TAG_SPELLING).map(kindOf)).toEqual(['bind']);
    expect(findNameOccurrences(rootOf(':Box 1'), 'Box', TAG_SPELLING)).toEqual([]);
  });
});

describe('bindingNamesVisibleAt', () => {
  const visibleIn = (source, offset = source.length, spelling) => bindingNamesVisibleAt(rootOf(source), offset, spelling);

  it('returns the names declared before the cursor', () => {
    const visible = visibleIn(':x 1 | :y 2 | z');
    expect(visible.has('x')).toBe(true);
    expect(visible.has('y')).toBe(true);
  });

  it('offers a name with a path by the name a step calls it by', () => {
    expect(visibleIn(':any/twice ~(mul 2) | 5').has('twice')).toBe(true);
  });

  it('does not include bindings that are still ahead of the cursor', () => {
    const source = ':early 1 | here | :late 2';
    const visible = visibleIn(source, source.indexOf('here'));
    expect(visible.has('early')).toBe(true);
    expect(visible.has('late')).toBe(false);
  });

  it('includes the declarations of it', () => {
    expect(visibleIn('42 | :answer it | answer').has('answer')).toBe(true);
  });

  it('a step that declares nothing contributes no name', () => {
    const source = '42 | mul 2 | here';
    expect(visibleIn(source, source.indexOf('here')).size).toBe(0);
  });

  it('hides bindings whose enclosing group has already closed', () => {
    const source = '(:local 1 | local) | here';
    expect(visibleIn(source, source.indexOf('here')).has('local')).toBe(false);
  });

  it('still sees a binding while inside its enclosing group', () => {
    const source = '(:local 1 | local | other)';
    expect(visibleIn(source, source.indexOf('other')).has('local')).toBe(true);
  });

  it('hides bindings inside one quote of a vector from a sibling element', () => {
    const source = 'get [~(:x 1 | x) ~(x)]';
    expect(visibleIn(source, source.lastIndexOf('x')).has('x')).toBe(false);
  });

  it('hides bindings inside one map entry value from a sibling entry value', () => {
    const source = 'get {:a ~(:x 1 | x) :b ~(x)}';
    expect(visibleIn(source, source.lastIndexOf('x')).has('x')).toBe(false);
  });

  it('top-level binding remains visible inside any number of nested forks', () => {
    const source = ':outer 1 | ((get [{:k ~(outer)}]))';
    expect(visibleIn(source, source.lastIndexOf('outer')).has('outer')).toBe(true);
  });

  it('surfaces the declarations of kinds by their names under the spelling of a tag', () => {
    expect(visibleIn(':MyType |~~ MyType. ~~| (::kind | impl ~(42)) | 42', undefined, TAG_SPELLING).has('MyType')).toBe(true);
  });

  it('skips the declarations of names that are no kind under the spelling of a tag', () => {
    const visible = visibleIn(':valueName 1 | 42', undefined, TAG_SPELLING);
    expect(visible.size).toBe(0);
  });

  it('hides the kind a closed group declares under the spelling of a tag', () => {
    const source = '(:Local |~~ Local. ~~| (::kind | impl ~(42))) | here';
    expect(visibleIn(source, source.indexOf('here'), TAG_SPELLING).has('Local')).toBe(false);
  });
});

describe('visibleAt', () => {
  const declarationIn = source => {
    let found = null;
    walkParts(rootOf(source), read => { if (isBindStep(read.value) && found === null) found = read; });
    return found;
  };

  it('sees a declaration inside a quote within the pipeline the quote holds, its end included [D367]', () => {
    const source = 'get [~(:x 1 | x) 5]';
    const declaration = declarationIn(source);
    expect(visibleAt(declaration, source.indexOf('| x') + 2)).toBe(true);
    expect(visibleAt(declaration, source.indexOf(')'))).toBe(true);
    expect(visibleAt(declaration, source.indexOf('5'))).toBe(false);
    expect(visibleAt(declaration, source.indexOf('~'))).toBe(false);
  });

  it('sees a declaration of the query everywhere after it', () => {
    const source = ':x 1 | (get [~(x)])';
    expect(visibleAt(declarationIn(source), source.lastIndexOf('x'))).toBe(true);
  });
});

describe('repeatsDeclarationAt', () => {
  it('holds a declaration that repeats a name an earlier step of its quote declared, on either track [D367]', () => {
    const quote = parse(':x 1 | :y 2 | :x 3 | x !| :y 4');
    expect([0, 1, 2, 3, 4].map(index => repeatsDeclarationAt(quote, index))).toEqual([false, false, true, false, true]);
  });
});

// A query reads its subject where its first step that declares nothing
// does, or a declaration's body before it; a host waits on the stream it
// lifts the subject from only then [QSHST#stdin].
describe('readsItsSubject', () => {
  const readsOf = query => readsItsSubject(parse(query));

  it('holds that a literal of no parts reads no subject, a path among them [QSPTH#value]', () => {
    for (const query of ['1', '"s"', 'true', 'null', ':k', '::vec', '/a', '/a/0 | segments']) expect(readsOf(query), query).toBe(false);
  });

  it('holds that a quote reads none, its code not run', () => {
    expect(readsOf('~(get /a)')).toBe(false);
  });

  it('holds that a literal of parts reads none, its parts literals, and a group reads it where its code does [QSLIT#tag]', () => {
    for (const query of ['[1 2]', '#[1]', '{:a 1}', '!{:a 1}', '::Box{:k 1}', '::Width#5', '[~(get /a) 1]', '{:a ~(get /b)}', '(1 | add 1)', '|~~ see ::link~(get /x) ~~|', '[/a 1]', '{:a /b}']) {
      expect(readsOf(query), query).toBe(false);
    }
    for (const query of ['get [/a 1]', 'get {:a /b}', '(get /a)', '((get /a) | count)']) expect(readsOf(query), query).toBe(true);
  });

  it('holds that a call and a blank query read it', () => {
    for (const query of ['get /a', 'doc', '']) expect(readsOf(query), query).toBe(true);
  });

  it('reads a pipeline by its first step that declares nothing', () => {
    expect(readsOf('1 | add 1')).toBe(false);
    expect(readsOf('::vec | doc')).toBe(false);
    expect(readsOf('doc | get [1]')).toBe(true);
    expect(readsOf(':two 2 | [1]')).toBe(false);
  });

  it('reads a declaration whose body reads, and a query of declarations alone', () => {
    expect(readsOf(':x (get /a) | [1]')).toBe(true);
    expect(readsOf(':two 2')).toBe(true);
    expect(readsOf(':a 1 | :b 2')).toBe(true);
    expect(readsOf(':Box |~~ A box. ~~| | [1]')).toBe(false);
  });

  it('reads a step of the fail track by the step it holds', () => {
    expect(readsOf('!| :x 1 | [1]')).toBe(false);
    expect(readsOf('!| :x (get /a) | [1]')).toBe(true);
  });
});
