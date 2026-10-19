// Tests for LSP feature logic — pure functions, no LSP transport.

import { describe, it, expect } from 'vitest';
import {
  parseDocument, buildCatalogIndex, completionsAtOffset,
  hoverAtOffset, definitionAtOffset, referencesAtOffset,
  documentSymbols, signatureHelpAtOffset,
  semanticTokensFor, SEMANTIC_TOKEN_TYPES, foldingRangesOf
} from '../src/features.mjs';
import { langRuntime, evalQuery, isTag } from '@kaluchi/qlang-core';

// Docs whose quote stands under the tag of a group or of the fail track, in a
// literal, as a modifier and in the quote of a doc [D367].
const DOCS_OF_STEP_TAGS = ['|~~ see ::group~(add 1) ~~|', '[|~~ ::group~(add 1) ~~|]', 'f |~~ ::fail~(add 1) ~~|', '|~~ ~([|~~ ::group~(add 1) ~~|]) ~~|'];

describe('parseDocument', () => {
  it('parses valid qlang source without diagnostics', () => {
    const { root, diagnostics } = parseDocument('[1 2 3] | count', 'test.qlang');
    expect(root.parts).toHaveLength(2);
    expect(diagnostics).toHaveLength(0);
  });

  it('reads a doc whose quote stands under the tag of a group or of the fail track with no diagnostic [D367]', () => {
    for (const src of DOCS_OF_STEP_TAGS) {
      const { root, diagnostics } = parseDocument(src, 'test.qlang');
      expect(diagnostics, src).toEqual([]);
      expect(root, src).not.toBeNull();
    }
  });

  it('returns a diagnostic for a parse error', () => {
    const { root, diagnostics } = parseDocument('[1 2 3', 'test.qlang');
    expect(root).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].message).toBeTruthy();
  });

  it('diagnostic has source location', () => {
    const { diagnostics } = parseDocument('| |', 'test.qlang');
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]).toHaveProperty('startLine');
    expect(diagnostics[0]).toHaveProperty('startChar');
  });

  it('places the diagnostic of a source refused after a line doc whose `~(` reads as no code where its reading stopped [D367]', () => {
    const { diagnostics } = parseDocument('[|~~| x ~(a\n 1 2 , 3]', 'test.qlang');
    expect(diagnostics.map(({ startLine, startChar, endLine, endChar }) => [startLine, startChar, endLine, endChar])).toEqual([[1, 5, 1, 6]]);
  });
});

describe('completionsAtOffset', () => {
  it('includes the names of the verbs of the language', async () => {
    const { root } = parseDocument('', 'test.qlang');
    const items = await completionsAtOffset(root, 0);
    const labels = items.map(i => i.label);
    expect(labels).toContain('count');
    expect(labels).toContain('filter');
    expect(labels).toContain('add');
    expect(labels).toContain('manifest');
    expect(labels).not.toContain('vec/count');
  });

  it('returns the names of more than 60 verbs of the language', async () => {
    const { root } = parseDocument('', 'test.qlang');
    const items = await completionsAtOffset(root, 0);
    expect(items.length).toBeGreaterThan(60);
  });

  it('a verb of the language completes as a verb [D371]', async () => {
    const { root } = parseDocument('', 'test.qlang');
    const items = await completionsAtOffset(root, 0);
    const countItem = items.find(i => i.label === 'count');
    expect(countItem.role).toBe('verb');
  });

  it('a verb of the language completes with the documentation of its page', async () => {
    const { root } = parseDocument('', 'test.qlang');
    const items = await completionsAtOffset(root, 0);
    const countItem = items.find(i => i.label === 'count');
    expect(countItem.documentation).toBeTruthy();
    expect(countItem.documentation).toMatch(/how many/);
  });

  it('includes a name the document declares before the offset', async () => {
    const src = ':myVar 42 | myVar';
    const { root } = parseDocument(src, 'test.qlang');
    const offsetAtEnd = src.length;
    const items = await completionsAtOffset(root, offsetAtEnd);
    const labels = items.map(i => i.label);
    expect(labels).toContain('myVar');
  });

  it('a value the document names completes as a value [D371]', async () => {
    const src = ':myVar 42 | myVar';
    const { root } = parseDocument(src, 'test.qlang');
    const items = await completionsAtOffset(root, src.length);
    const myVarItem = items.find(i => i.label === 'myVar');
    expect(myVarItem.role).toBe('value');
  });

  it('names each name the document declares by the role of its declaration, a verb under its own label or a label of the root and a label by its name and its tag [D371]', async () => {
    const src = ':Box |~~ A box. ~~| | :Box/area ~(1) | :vec/second ~(get /1) | :n 1 | n';
    const { root } = parseDocument(src, 'test.qlang');
    const roles = new Map((await completionsAtOffset(root, src.length)).map(item => [item.label, item.role]));
    expect(['area', 'second', 'n', 'Box', '::Box'].map(label => roles.get(label))).toEqual(['verb', 'verb', 'value', 'label', 'label']);
  });

  it('offers each name the document declares once, by the name a step calls it by, a name with a path by its last name, after a subject and with none [QSNAM#verb], [D371]', async () => {
    for (const typed of [':vec/second ~(get /1) | [1 2] | ', ':vec/second ~(get /1) | ']) {
      const src = `${typed}it`;
      const labels = (await completionsAtOffset(parseDocument(src, 'test.qlang').root, typed.length, src)).map(item => item.label);
      expect([labels.filter(label => label === 'second').length, labels.includes('vec/second')], typed).toEqual([1, false]);
    }
  });

  it('works on a text that does not parse', async () => {
    const items = await completionsAtOffset(null, 0);
    expect(items.length).toBeGreaterThan(60);
  });

  it('mixed completions surface the nodes of the tree alongside the verbs', async () => {
    const src = 'foo';
    const { root } = parseDocument(src, 'test.qlang');
    const items = await completionsAtOffset(root, 3, src);
    expect(items.some(i => i.label === 'count')).toBe(true);
    expect(items.some(i => i.label === '::number/NotFiniteError')).toBe(true);
  });

  it('cursor right after `::` completes the names of the root as tags alone, each by its role [D371]', async () => {
    const src = '::';
    const { root } = parseDocument(src, 'test.qlang');
    const items = await completionsAtOffset(root, 2, src);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(i => i.label.startsWith('::'))).toBe(true);
    const roles = new Map(items.map(item => [item.label, item.role]));
    expect(['::vec', '::vec/count', '::number/NotFiniteError', '::number/add/addend'].map(label => roles.get(label))).toEqual(['label', 'verb', 'label', 'value']);
  });

  it('completes every name after one colon of the sign of a tag', async () => {
    const items = await completionsAtOffset(null, 1, '::');
    expect(items.some(i => !i.label.startsWith('::'))).toBe(true);
  });

  it('a kind the document declares is among the completions of tags, one with a path by its address', async () => {
    const src = ':MyTag |~~ MyTag. ~~| (::kind | impl ~(42)) | :MyTag/In |~~ In. ~~|';
    const { root } = parseDocument(src, 'test.qlang');
    const items = await completionsAtOffset(root, src.length, src);
    expect(['::MyTag', '::MyTag/In'].map(label => items.some(i => i.label === label))).toEqual([true, true]);
  });
});

describe('completionsAtOffset after a value offers the verbs that accept it', () => {
  const labelsAt = async (src) => {
    const { root } = parseDocument(src, 'test.qlang');
    return (await completionsAtOffset(root, src.length, src)).map(item => item.label);
  };

  it('offers the verbs of a vector and of any value after a vector', async () => {
    const labels = await labelsAt('[1 2 3] | ');
    expect(labels).toContain('count');
    expect(labels).toContain('type');
    expect(labels).not.toContain('add');
  });

  it('reads the kind of a path and of an error literal, the walk of an error reaching its facts', async () => {
    const afterPath = await labelsAt('/a | ');
    expect(afterPath).toContain('segments');
    expect(afterPath).not.toContain('add');
    const afterError = await labelsAt('!{:a 1} | ');
    expect(afterError).toContain('trace');
    expect(afterError).toContain('keys');
    expect(afterError).not.toContain('add');
    expect(await labelsAt('::Oops!{:a 1} | ')).toContain('trace');
  });

  it('reads the subject before the word being typed', async () => {
    const labels = await labelsAt('1 | ad');
    expect(labels).toContain('add');
    expect(labels).not.toContain('count');
  });

  it('keeps the kinds of the subject through a declaration, and offers after a tagged literal the verbs the walk of its tags reaches [D371]', async () => {
    const labels = await labelsAt('[1 2 3] | :xs it | ');
    expect(labels).toContain('count');
    expect(labels).not.toContain('add');
    const afterTagged = await labelsAt('[1 2 3] | :xs it | ::Box{:a 1} | ');
    expect(afterTagged).toContain('count');
    expect(afterTagged).toContain('payload');
    expect(afterTagged).not.toContain('add');
  });

  it('reads a literal alone over the root, a label the document declares a tag of identity, and a literal its constructor refuses by the kinds of its refusal [D371]', async () => {
    const afterIdentity = await labelsAt(':Pos |~~ P ~~| (::kind | holds :NegError |~~ n ~~| ~(gt 0)) | ::Pos#-1 | ');
    expect(afterIdentity).toContain('add');
    expect(afterIdentity).not.toContain('trace');
    const afterRefusal = await labelsAt('::number"5" | ');
    expect(afterRefusal).toContain('trace');
    expect(afterRefusal).not.toContain('add');
  });

  it('offers after a tag name the verbs that serve it, those of a tag name, of any value and of its noun whose `on` names `::tag`, none of its noun refusing it [QSDSP#tagname], [D371]', async () => {
    const afterVec = await labelsAt('::vec | ');
    expect(['manifest', 'toTag', 'count', 'sort', 'add'].map(label => afterVec.includes(label))).toEqual([true, true, false, false, false]);
    expect(await labelsAt('::kind | ')).toContain('wraps');
    for (const label of afterVec.filter(offered => !offered.startsWith('::'))) {
      const answer = await evalQuery(`::vec | ${label} !| type`);
      expect(isTag(answer) && /^vec\/[^/]+\/Subject\w*Error$/.test(answer.name), label).toBe(false);
    }
  });

  it('reads no kind after a call its subject refuses, a verb of the noun a tag name names that serves no tag name [QSDSP#tagname], [D371]', async () => {
    const labels = await labelsAt('::vec | count | ');
    expect(labels).toContain('count');
    expect(labels).toContain('add');
  });

  it('follows the walk of the subject through the label of a verb that returns its own label, the noun of a tag name left out, and elsewhere the kinds it returns [QSBLD#answer], [QSDSP#tagname], [D371]', async () => {
    const afterATag = await labelsAt('1 | type | ');
    for (const src of ['::vec | toTag | ', '::number | toTag | ']) {
      const labels = await labelsAt(src);
      expect([labels, labels.includes('count'), labels.includes('add')], src).toEqual([afterATag, false, false]);
    }
    const afterWraps = await labelsAt('::kind | wraps |~~ w ~~| ::vec | ');
    expect(['reads', 'type', 'toTag'].map(label => afterWraps.includes(label))).toEqual([true, true, false]);
    const afterSorts = await Promise.all(['::Box[3 1 2] | sort | ', '::frame[1 ~(a)] | sort | ', '[3 1 2] | sort | '].map(labelsAt));
    expect(afterSorts.map(labels => ['count', 'payload', 'failed', 'add'].map(label => labels.includes(label))))
      .toEqual([[true, true, false, false], [true, true, true, false], [true, false, false, false]]);
  });

  it('follows the kind a verb declares it returns', async () => {
    const labels = await labelsAt('[1 2 3] | count | ');
    expect(labels).toContain('add');
    expect(labels).not.toContain('filter');
  });

  it('keeps the kind of a subject a verb returns as its own', async () => {
    const labels = await labelsAt('[1 2 3] | filter ~(gt 1) | ');
    expect(labels).toContain('count');
    expect(labels).not.toContain('add');
  });

  it('offers a set its own verbs and those of vectors its walk reaches, after a literal and after a verb that returns a set [QSDSP#residence]', async () => {
    for (const src of ['#[3 1 2] | ', '[2 1 2] | toSet | ']) {
      const labels = await labelsAt(src);
      for (const label of ['sort', 'union', 'count', 'filter', 'first', 'has', 'take']) expect(labels).toContain(label);
      expect(labels).not.toContain('add');
    }
  });

  it('shows each verb as a call from the subject reaches it, the form of its call over its page', async () => {
    const { root } = parseDocument('{:a 1} | ', 'test.qlang');
    const count = (await completionsAtOffset(root, 9, '{:a 1} | ')).find(item => item.label === 'count');
    expect(count.detail).toBe('::map/count');
    expect(count.documentation).toMatch(/entries the map holds/);
  });

  it('reads the pipe the cursor stands right after', async () => {
    const labels = await labelsAt('[1 2 3] |');
    expect(labels).toContain('count');
    expect(labels).not.toContain('add');
  });

  it('reads a line break as a space, the step on the next line joined by `|` [QSSYN#line]', async () => {
    const piped = await labelsAt('[1 2 3]\n| ');
    expect(piped).toContain('count');
    expect(piped).not.toContain('add');
    expect(await labelsAt('[1 2 3]\n')).toContain('add');
  });

  it('reads through a declaration and a group over a vector', async () => {
    const labels = await labelsAt(':twice ~(mul 2) | ([1 2] | reverse) | ');
    expect(labels).toContain('twice');
    expect(labels).toContain('count');
    expect(labels).not.toContain('add');
  });

  it('offers every name where no declaration names the kind of the subject', async () => {
    for (const src of [':x 1 | x | ', '[1 2 3] | map ~(add 1) | ', '{:a 1} | /a | ', '1 | nosuch | ', 'count(', '"x" | add 1 !| ']) {
      const labels = await labelsAt(src);
      expect(labels).toContain('count');
      expect(labels).toContain('add');
    }
  });
});

describe('hoverAtOffset', () => {
  it('returns hover for a verb of the language', async () => {
    const src = '[1 2 3] | count';
    const { root } = parseDocument(src, 'test.qlang');
    const countOffset = src.indexOf('count');
    const hover = await hoverAtOffset(root, src, countOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/count/);
    expect(hover.content).toMatch(/::[a-z]+\/count/);
  });

  it('hover includes docs from manifest', async () => {
    const src = '[1 2 3] | filter ~(gt 2)';
    const { root } = parseDocument(src, 'test.qlang');
    const filterOffset = src.indexOf('filter');
    const hover = await hoverAtOffset(root, src, filterOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/predicate/i);
    expect(hover.content).not.toMatch(/~\{/);
  });

  it('returns hover for a path', async () => {
    const src = '{:name "alice"} | get /name';
    const { root } = parseDocument(src, 'test.qlang');
    const projOffset = src.indexOf('/name');
    const hover = await hoverAtOffset(root, src, projOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/path/);
    expect(hover.content).toMatch(/\/name/);
    expect(hover.content).toMatch(/names a part of another/);
  });

  it('returns hover for a keyword literal', async () => {
    const src = ':hello';
    const { root } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(root, src, 0);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/keyword/);
    expect(hover.content).toMatch(/:hello/);
  });

  it('hover has range', async () => {
    const src = '[1 2 3] | count';
    const { root } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(root, src, src.indexOf('count'));
    expect(hover).toHaveProperty('startOffset');
    expect(hover).toHaveProperty('endOffset');
    expect(hover.startOffset).toBeLessThan(hover.endOffset);
  });

  it('returns null for a text that does not parse', async () => {
    expect(await hoverAtOffset(null, '', 0)).toBeNull();
  });

  it('returns hover for a tag name', async () => {
    const src = '::number/NotFiniteError | doc';
    const { root } = parseDocument(src, 'test.qlang');
    const tagOffset = src.indexOf('::number/NotFiniteError') + 5;
    const hover = await hoverAtOffset(root, src, tagOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toContain("::number/NotFiniteError");
    expect(hover.content).toMatch(/a name of the root/);
  });

  it('returns hover for the head of a tagged literal', async () => {
    const src = '::number#2 | add 1';
    const { root } = parseDocument(src, 'test.qlang');
    const tagOffset = src.indexOf('::number') + 4;
    const hover = await hoverAtOffset(root, src, tagOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/::number/);
    expect(hover.content).toMatch(/a name of the root/);
  });

  it('returns hover for the tag an error literal writes before its bang', async () => {
    // `::Tag!{…}` is one literal, the error whose content carries the
    // tag, its head a part of it that resolves like every tag, and its
    // braces, which the literal owns, show no tag [QSERR#rest].
    const src = '::number/NotFiniteError!{:step 1}';
    const { root } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(root, src, 5);
    expect(hover).not.toBeNull();
    expect(hover.content).toContain("::number/NotFiniteError");
    expect(hover.endOffset - hover.startOffset).toBe('::number/NotFiniteError'.length);
    expect(await hoverAtOffset(root, src, src.indexOf('!{'))).toBeNull();
  });

  it('returns hover for `::error` written before a bang, and finds it among the references of `::error` [D367]', async () => {
    const src = '[::error!{:k 1} ::error]';
    const { root } = parseDocument(src, 'test.qlang');
    expect((await hoverAtOffset(root, src, 2)).content).toContain('**::error** — a name of the root');
    expect(referencesAtOffset(root, src.lastIndexOf('::error') + 2).map(({ startOffset }) => startOffset)).toEqual([1, 16]);
  });

  it('hover on ::Tag spans only the tag head, not the payload', async () => {
    const src = '::number#2 | add 1';
    const { root } = parseDocument(src, 'test.qlang');
    const tagOffset = src.indexOf('::number') + 4;
    const hover = await hoverAtOffset(root, src, tagOffset);
    expect(hover).not.toBeNull();
    expect(hover.endOffset - hover.startOffset).toBe('::number'.length);
  });

  it('returns the doc of a verb the document declares under a label, called by its name or its address', async () => {
    const src = ':number/double |~~ Doubles a number. ~~| ~(mul 2) | 10 | double | number/double';
    const { root } = parseDocument(src, 'test.qlang');
    for (const offset of [src.indexOf('| double') + 2, src.lastIndexOf('number/double')]) {
      const hover = await hoverAtOffset(root, src, offset);
      expect(hover.content).toMatch(/Doubles a number/);
    }
  });

  it('shows the page of a verb called in its own body, which calls itself by its name, and none for a value its own body names [QSNAM#verb], [D371]', async () => {
    const src = ':map/walk\n  |~~ Walks a tree. ~~|\n  ~(get {:n /n :kids ~(get /kids | map ~walk)})\n| {:n 1 :kids [{:n 2 :kids []}]} | walk | get /kids/0/n';
    expect((await hoverAtOffset(parseDocument(src, 'test.qlang').root, src, src.indexOf('~walk') + 1)).content).toBe("**walk** — a reader's name  \n  \nWalks a tree.  ");
    const value = ':n |~~ A number. ~~| (n | add 1)';
    expect(await hoverAtOffset(parseDocument(value, 'test.qlang').root, value, value.indexOf('(n') + 1)).toBeNull();
  });

  it('shows the prose of each doc of a declaration of the document, its links left out [D371]', async () => {
    const src = ':x |~~ see ::link~(::vec | doc) here ~~| |~~| and a line\n  1\n| x';
    const { root } = parseDocument(src, 'test.qlang');
    const { content } = await hoverAtOffset(root, src, src.lastIndexOf('x'));
    expect([content.includes('see  here'), content.includes('and a line'), content.includes('::link')]).toEqual([true, true, false]);
  });

  it('shows nothing for a call that reaches no declaration of the document with docs, one a closed group holds among them [QSNAM#scope], [D371]', async () => {
    for (const [src, name] of [['(:x |~~ inner ~~| 1) | x', 'x'], [':x 1 | x', 'x'], ['nosuch', 'nosuch']]) {
      const { root } = parseDocument(src, 'test.qlang');
      expect(await hoverAtOffset(root, src, src.lastIndexOf(name)), src).toBeNull();
    }
  });

  it('shows a keyword by its literal, the key of a JSON literal among them [QSLIT#keyword]', async () => {
    const src = '{"1": 2}';
    const { root } = parseDocument(src, 'test.qlang');
    expect((await hoverAtOffset(root, src, 2)).content).toBe('keyword `:"1"`');
  });

  it('shows nothing on the sign that joins a payload to its tag, past the head of the tag [QSLIT#tag]', async () => {
    const src = '::number#2 | add 1';
    const { root } = parseDocument(src, 'test.qlang');
    expect(await hoverAtOffset(root, src, src.indexOf('#'))).toBeNull();
  });

  it('shows the verb the subject of the call reaches, the form of its call over its page', async () => {
    for (const [src, address, words] of [['[1 2 3] | count', '::vec/count', 'elements the vector holds'], ['{:a 1} | count', '::map/count', 'entries the map holds'], ['#[1 2] | count', '::vec/count', 'elements the vector holds']]) {
      const { root } = parseDocument(src, 'test.qlang');
      const hover = await hoverAtOffset(root, src, src.indexOf('count'));
      expect(hover.content).toContain(`**count** — ${address}`);
      expect(hover.content).toContain(words);
    }
  });

  it('shows a verb with no subject under the address whose page it shows', async () => {
    const src = 'count';
    const { root } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(root, src, 0);
    const address = /— (::[A-Za-z/]+)/.exec(hover.content)[1];
    const page = await evalQuery(`${address} | doc | content`);
    expect(hover.content).toContain(page.trim().split('\n')[0].trim());
  });

  it('returns null for an offset outside any part', async () => {
    const src = '42';
    const { root } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(root, src, 100);
    expect(hover).toBeNull();
  });
});

describe('the names a step reaches in the body of a verb, the verbs, the nodes and the labels around it wherever they stand and no value a reader named there [QSNAM#verb], [D371]', () => {
  const hoverOf = async (src, offset) => (await hoverAtOffset(parseDocument(src, 'test.qlang').root, src, offset))?.content ?? null;
  const gotoOf = async (src, offset) => (await definitionAtOffset(parseDocument(src, 'test.qlang').root, offset))?.startOffset ?? null;
  const pageOf = (name, prose) => `**${name}** — a reader's name  \n  \n${prose}  `;

  it('reaches a verb declared after the verb, one that calls it back among them, in the body of a verb under a label of the root and of the document alike', async () => {
    const later = ':vec/f ~(g) | :vec/g |~~ G. ~~| ~(7) | [1] | f';
    const mutual = ':vec/even |~~ E. ~~| ~(odd) | :vec/odd |~~ O. ~~| ~(1) | [1] | even';
    const underALabel = ':Box |~~ B. ~~| | :Box/f ~(g) | :vec/g |~~ G. ~~| ~(7) | ::Box[1] | f';
    expect([await hoverOf(later, later.indexOf('~(g)') + 2), await gotoOf(later, later.indexOf('~(g)') + 2), await hoverOf(mutual, mutual.indexOf('(odd)') + 1), await hoverOf(underALabel, underALabel.indexOf('~(g)') + 2)])
      .toEqual([pageOf('g', 'G.'), later.indexOf(':vec/g'), pageOf('odd', 'O.'), pageOf('g', 'G.')]);
    expect(await evalQuery(`get [~(${later}) ~(${mutual}) ~(${underALabel})]`)).toEqual([7, 1, 7]);
  });

  it('reaches no value a reader named outside the body, which the language refuses there, and the verb where a value of its name stands outside it', async () => {
    const value = ':k |~~ K. ~~| 1 | :vec/f ~(k) | [1] | f';
    expect([await hoverOf(value, value.indexOf('~(k)') + 2), await gotoOf(value, value.indexOf('~(k)') + 2)]).toEqual([null, null]);
    expect(await evalQuery(`${value} !| get [~(type) /name]`)).toEqual(await evalQuery('[::call/UnknownNameError :k]'));
    const shadowed = ':f |~~ F value. ~~| 1 | :vec/f |~~ The verb. ~~| ~(if (count | gt 1) ~(drop 1 | f) ~(count)) | [1 2] | vec/f';
    expect([await hoverOf(shadowed, shadowed.indexOf('| f)') + 2), await gotoOf(shadowed, shadowed.indexOf('| f)') + 2), await evalQuery(shadowed)])
      .toEqual([pageOf('f', 'The verb.'), shadowed.indexOf(':vec/f'), 1]);
  });

  it('reaches a declaration of the body before one outside it, and a name outside any verb\'s body as the declarations before it', async () => {
    const inner = ':vec/f |~~ The verb. ~~| ~(:k |~~ Inner. ~~| 1 | k) | :k |~~ Outer. ~~| 2 | [1] | f';
    const outside = ':k |~~ K. ~~| 1 | get [~(k)]';
    expect([await hoverOf(inner, inner.indexOf('| k)') + 2), await gotoOf(inner, inner.indexOf('| k)') + 2), await hoverOf(outside, outside.lastIndexOf('k')), await gotoOf(outside, outside.lastIndexOf('k'))])
      .toEqual([pageOf('k', 'Inner.'), inner.indexOf(':k'), pageOf('k', 'K.'), 0]);
  });

  it('completes in the body of a verb the names it reaches by their roles, a verb under a label declared after it among them', async () => {
    const src = ':k 1 | :vec/f ~(here) | :Late |~~ L. ~~| | :Late/g ~(1)';
    const roles = new Map((await completionsAtOffset(parseDocument(src, 'test.qlang').root, src.indexOf('here'), src)).map(item => [item.label, item.role]));
    expect(['f', 'g', 'Late', '::Late', 'k'].map(label => roles.get(label))).toEqual(['verb', 'verb', 'label', 'label', undefined]);
  });
});

// A catalog context for definition fallback tests, in the form of a
// source of the language: a contract under `::any` and verbs under a
// kind, each a declaration `buildCatalogIndex` records by its span, and
// the scope of the root that answers what a bare name reaches. The server merges
// each catalog file's source and URI onto every index entry so the goto
// handler resolves offsets without re-reading the source — the test
// mirror does the same.
const catalogSrc = ':vec/count ~(1) | :number/add ~(1)';
const catalogRoot = parseDocument(catalogSrc, 'qlang/any').root;
const testCatalogIndex = new Map();
for (const [name, range] of buildCatalogIndex(catalogRoot)) {
  testCatalogIndex.set(name, {
    ...range,
    fileUri: 'file:///test/core.qlang',
    source: catalogSrc
  });
}
const testCatalogCtx = { index: testCatalogIndex, scope: await langRuntime() };

describe('definitionAtOffset', () => {
  it('jumps from the use site of a verb to its declaration under a label', async () => {
    const src = ':number/double ~(mul 2) | 10 | double';
    const { root } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('double');
    const def = await definitionAtOffset(root, useOffset);
    expect(def).not.toBeNull();
    expect(def.startOffset).toBe(0);
    expect(def.fileUri).toBeUndefined(); // in-document
  });

  it('jumps to last visible declaration when shadowed', async () => {
    const src = ':x 1 | :x 2 | x';
    const { root } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('x');
    const def = await definitionAtOffset(root, useOffset);
    expect(def).not.toBeNull();
    // Should point to the second declaration, `:x 2`, not the first.
    expect(def.startOffset).toBe(src.lastIndexOf(':x'));
  });

  it('declaration inside fork is invisible outside', async () => {
    const src = '(:x 1) | x';
    const { root } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('x');
    // x is declared inside a group, a fork — invisible at the
    // use site. Falls through to catalog (none provided) or null.
    const def = await definitionAtOffset(root, useOffset);
    expect(def === null || def.fileUri !== undefined).toBe(true);
  });

  it('jumps from a name several kinds answer to the first of its verbs the catalog declares', async () => {
    const src = '[1 2 3] | count';
    const { root } = parseDocument(src, 'test.qlang');
    const def = await definitionAtOffset(root, src.indexOf('count'), testCatalogCtx);
    expect(def).not.toBeNull();
    expect(def.fileUri).toBe('file:///test/core.qlang');
    expect(def.startOffset).toBe(0);
  });

  it('jumps from an address to the verb it names', async () => {
    const src = '[1 2 3] | vec/count';
    const { root } = parseDocument(src, 'test.qlang');
    const def = await definitionAtOffset(root, src.indexOf('vec/count'), testCatalogCtx);
    expect(def.startOffset).toBe(catalogSrc.indexOf(':vec/count'));
  });

  it('falls back to the one verb of a name under a kind when no contract names it', async () => {
    const src = '1 | add 2';
    const { root } = parseDocument(src, 'test.qlang');
    const def = await definitionAtOffset(root, src.indexOf('add'), testCatalogCtx);
    expect(def.startOffset).toBe(catalogSrc.indexOf(':number/add'));
  });

  it('returns null for a verb of the language without a catalog context', async () => {
    const src = '[1 2 3] | count';
    const { root } = parseDocument(src, 'test.qlang');
    const def = await definitionAtOffset(root, src.indexOf('count'));
    expect(def).toBeNull();
  });

  it('a declaration of the document shadows a verb of the language — jumps to the declaration, not the catalog', async () => {
    const src = ':count 42 | count';
    const { root } = parseDocument(src, 'test.qlang');
    const def = await definitionAtOffset(root, src.lastIndexOf('count'), testCatalogCtx);
    expect(def).not.toBeNull();
    expect(def.fileUri).toBeUndefined(); // in-document, not catalog
    expect(def.startOffset).toBe(0);
  });

  it('returns null for a part that names no declaration', async () => {
    const src = '42';
    const { root } = parseDocument(src, 'test.qlang');
    expect(await definitionAtOffset(root, 0)).toBeNull();
  });

  it('reads a name by the spelling it was read under: a call reaches the declaration of its name, a label\'s among them, and a tag no declaration by its last name [QSNAM#reach], [D371]', async () => {
    const src = ':Box |~~ B ~~| | :Box/Inner |~~ I ~~| | Box | get [::Inner ::Box]';
    const { root } = parseDocument(src, 'test.qlang');
    expect((await definitionAtOffset(root, src.indexOf('| Box') + 2)).startOffset).toBe(0);
    expect(await definitionAtOffset(root, src.indexOf('::Inner') + 3)).toBeNull();
    expect((await definitionAtOffset(root, src.lastIndexOf('::Box') + 3)).startOffset).toBe(0);
  });

  it('jumps from a call by address to the declaration of that address alone, a declaration of its last name aside [QSNAM#address], [D371]', async () => {
    const src = ':vec/x ~(1) | :string/x ~(2) | :count 5 | [1] | get [~(vec/x) ~(vec/count)]';
    const { root } = parseDocument(src, 'test.qlang');
    expect((await definitionAtOffset(root, src.indexOf('vec/x)'))).startOffset).toBe(0);
    expect(await definitionAtOffset(root, src.indexOf('vec/count'))).toBeNull();
    expect((await definitionAtOffset(root, src.indexOf('vec/count'), testCatalogCtx)).fileUri).toBe('file:///test/core.qlang');
  });

  it('jumps from a call of a verb in its own body to its declaration, by its name and by its address, and a value its own body names to none [QSNAM#verb], [D371]', async () => {
    const src = ':map/walk ~(get {:n /n :kids ~(get /kids | map ~walk | map ~map/walk)}) | :n (n | add 1)';
    const { root } = parseDocument(src, 'test.qlang');
    for (const offset of [src.indexOf('~walk') + 1, src.indexOf('~map/walk') + 1]) expect((await definitionAtOffset(root, offset)).startOffset).toBe(0);
    expect(await definitionAtOffset(root, src.indexOf('(n') + 1)).toBeNull();
  });

  it('returns null for a text that does not parse', async () => {
    expect(await definitionAtOffset(null, 0)).toBeNull();
  });
});

describe('referencesAtOffset', () => {
  it('finds all occurrences of a verb a reader declares', () => {
    const src = ':number/double ~(mul 2) | [1 2] | map ~double';
    const { root } = parseDocument(src, 'test.qlang');
    const refs = referencesAtOffset(root, src.lastIndexOf('double'));
    // declaration (`:number/double …`) + use site (`map ~double`)
    expect(refs.length).toBe(2);
  });

  it('finds references from the declaration site', () => {
    const src = ':x 42 | x';
    const { root } = parseDocument(src, 'test.qlang');
    // Click on the name of the declaration, :x
    const kwOffset = src.indexOf(':x') + 1; // inside the keyword
    const refs = referencesAtOffset(root, kwOffset);
    expect(refs.length).toBe(2);
  });

  it('finds no references from a keyword that is no name of a declaration [D367]', () => {
    for (const src of [':x :y | y', '[:y] | y']) {
      const { root } = parseDocument(src, 'test.qlang');
      expect(referencesAtOffset(root, src.indexOf(':y') + 1), src).toEqual([]);
    }
  });

  it('returns references for the verbs of the language', () => {
    const src = '[1 2 3] | count | add 1';
    const { root } = parseDocument(src, 'test.qlang');
    const refs = referencesAtOffset(root, src.indexOf('count'));
    expect(refs.length).toBe(1);
  });

  it('returns empty for a text that does not parse', () => {
    expect(referencesAtOffset(null, 0)).toEqual([]);
  });
});

describe('foldingRangesOf', () => {
  const foldsOf = src => foldingRangesOf(parseDocument(src, 'test.qlang').root);

  it('folds a declaration, its doc as a comment, and a quote, each to the line where its last part ends [D371]', () => {
    const src = [':double', '  |~~ Doubles.', '      ~(', '        2 | double', '      )', '  ~~|', '  ~(mul 2)', ':x 1'].join('\n');
    expect(foldsOf(src)).toEqual([
      { startLine: 0, endLine: 6, kind: 'region' },
      { startLine: 1, endLine: 4, kind: 'comment' },
      { startLine: 2, endLine: 3, kind: 'region' }
    ]);
  });

  it('ends the fold of a declaration of docs alone and of a doc on the line where the text of its doc ends, before its closer [D371]', () => {
    expect(foldsOf([':Box', '  |~~ A box', '      of parts.', '  ~~|'].join('\n'))).toEqual([
      { startLine: 0, endLine: 2, kind: 'region' },
      { startLine: 1, endLine: 2, kind: 'comment' }
    ]);
    expect(foldsOf(['|~~ A box', '    of parts. ~~|'].join('\n'))).toEqual([{ startLine: 0, endLine: 1, kind: 'comment' }]);
  });

  it('folds no quote that holds no step [D371]', () => {
    expect(foldsOf(['get [~(', '  |~| none', ')]'].join('\n'))).toEqual([]);
  });

  it('folds nothing for a text that does not parse', () => {
    expect(foldingRangesOf(null)).toEqual([]);
  });
});

describe('documentSymbols', () => {
  it('collects the verbs a reader declares under a label as verb symbols [D371]', async () => {
    const src = ':number/double ~(mul 2) | :number/triple ~(mul 3) | :q ~(add 1)';
    const { root } = parseDocument(src, 'test.qlang');
    const syms = documentSymbols(root, await langRuntime());
    expect(syms).toHaveLength(3);
    expect(syms[0].name).toBe('number/double');
    expect(syms[0].role).toBe('verb');
    expect(syms[2].role).toBe('value');
    expect(syms[1].name).toBe('number/triple');
    expect(syms[1].role).toBe('verb');
  });

  it('shows a label of the document and the verbs under it as the core reads them [D371]', async () => {
    const src = ':Box |~~ A box. ~~| | :Box/area ~(1) | :Ring/area ~(2)';
    const { root } = parseDocument(src, 'test.qlang');
    const syms = documentSymbols(root, await langRuntime());
    expect(syms.map(sym => [sym.name, sym.role])).toEqual([
      ['::Box', 'label'], ['Box/area', 'verb'], ['Ring/area', 'value']
    ]);
  });

  it('shows a kind built from ::kind as a label and a function with a recipe under it as a verb [QSNAM#address]', async () => {
    const src = [
      ':Box',
      '  |~~ A parcel. ~~|',
      '  ::kind',
      '    | wraps |~~ The sizes. ~~| ::map',
      '| :Crate |~~ A crate. ~~| (::kind | wraps |~~ The goods. ~~| ::vec)',
      '| :Box/area |~~ The area. ~~| (::fn | returns |~~ A number. ~~| ::number | impl ~(mulOf /w /h))',
      '| :Box/rule |~~ A contract. ~~| (::fn | returns |~~ A number. ~~| ::number)',
      '| :Crate/count |~~ The goods. ~~| ::fn[~() ~(count)]',
      '| :Crate/size |~~ A contract. ~~| ::fn[~() null]',
      '| :f |~~ A function. ~~| (::fn | impl ~(add 1))'
    ].join('\n');
    const { root } = parseDocument(src, 'test.qlang');
    expect(documentSymbols(root, await langRuntime()).map(sym => [sym.name, sym.role])).toEqual([
      ['::Box', 'label'], ['::Crate', 'label'], ['Box/area', 'verb'], ['Box/rule', 'value'], ['Crate/count', 'verb'], ['Crate/size', 'value'], ['f', 'value']
    ]);
  });

  it('shows a reader\'s ::builtin{} under a label as a value, a primitive it reaches none', async () => {
    const src = ':Box |~~ B. ~~| | :Box/area ::builtin{}';
    const { root } = parseDocument(src, 'test.qlang');
    expect(documentSymbols(root, await langRuntime()).map(sym => sym.role)).toEqual(['label', 'value']);
  });

  it('collects a binding of a computed body as a value symbol', async () => {
    const src = '[1 2] | :n count';
    const { root } = parseDocument(src, 'test.qlang');
    const syms = documentSymbols(root, await langRuntime());
    expect(syms).toHaveLength(1);
    expect(syms[0].role).toBe('value');
  });

  it('collects a declaration of it as a value symbol', async () => {
    const src = '42 | :answer it';
    const { root } = parseDocument(src, 'test.qlang');
    const syms = documentSymbols(root, await langRuntime());
    expect(syms).toHaveLength(1);
    expect(syms[0].name).toBe('answer');
    expect(syms[0].role).toBe('value');
  });

  it('returns empty for plain pipeline with no bindings', async () => {
    const src = '[1 2 3] | count';
    const { root } = parseDocument(src, 'test.qlang');
    expect(documentSymbols(root, await langRuntime())).toHaveLength(0);
  });

  it('returns empty for a text that does not parse', async () => {
    expect(documentSymbols(null, await langRuntime())).toEqual([]);
  });
});

describe('signatureHelpAtOffset', () => {
  it('returns the form of the call around the cursor', async () => {
    const src = '[1 2 3] | filter ~(gt 2)';
    const { root } = parseDocument(src, 'test.qlang');
    // The cursor on the `g` of `gt` stands in the narrowest call with
    // modifiers, `gt 2`, whose form the help shows.
    const offset = src.indexOf('gt');
    const sig = await signatureHelpAtOffset(root, src, offset);
    expect(sig).not.toBeNull();
    expect(sig.label).toMatch(/gt/);
  });

  it('returns null for a command without modifiers', async () => {
    const src = '[1 2 3] | count';
    const { root } = parseDocument(src, 'test.qlang');
    const sig = await signatureHelpAtOffset(root, src, src.indexOf('count'));
    // A call of `count` writes no modifiers, and the help shows nothing.
    expect(sig).toBeNull();
  });

  it('tracks the active parameter by the modifiers before the cursor', async () => {
    const src = '{:x 1 :y 2} | subOf /x /y';
    const { root } = parseDocument(src, 'test.qlang');
    // Cursor on the second modifier
    const offset = src.indexOf('/y');
    const sig = await signatureHelpAtOffset(root, src, offset);
    expect(sig).not.toBeNull();
    expect(sig.activeParameter).toBe(1);
  });

  it('shows the page of the verb the subject of the call reaches', async () => {
    const src = '[1 2 3] | take 2';
    const { root } = parseDocument(src, 'test.qlang');
    const sig = await signatureHelpAtOffset(root, src, src.lastIndexOf('2'));
    expect(sig.documentation).toMatch(/first elements, as many as the count/);
  });

  it('opens at the space after a verb that takes inputs, its first input active', async () => {
    const src = '[1 2 3] | take ';
    const { root } = parseDocument(src, 'test.qlang');
    const sig = await signatureHelpAtOffset(root, src, src.length);
    expect([sig.label, sig.activeParameter]).toEqual(['take count', 0]);
  });

  it('moves past the words written at the space after them', async () => {
    const src = '{:x 1 :y 2} | subOf /x ';
    const { root } = parseDocument(src, 'test.qlang');
    const sig = await signatureHelpAtOffset(root, src, src.length);
    expect(sig.activeParameter).toBe(1);
  });

  it('opens nothing for a verb a later step follows', async () => {
    const src = '[1 2 3] | take 2 | take';
    const { root } = parseDocument(src, 'test.qlang');
    expect(await signatureHelpAtOffset(root, src, src.lastIndexOf('take'))).toBeNull();
  });

  it('opens nothing at the space after a verb that takes no input', async () => {
    const src = '[1 2 3] | count ';
    const { root } = parseDocument(src, 'test.qlang');
    expect(await signatureHelpAtOffset(root, src, src.length)).toBeNull();
  });

  it('returns null for a text that does not parse', async () => {
    expect(await signatureHelpAtOffset(null, '', 0)).toBeNull();
  });
});

// Helper: decode the LSP 5-int semantic-tokens stream into
// `{ line, char, length, type }` records that align back to source
// offsets, so assertions can read the token kinds without
// reproducing the delta-encoding rules.
function decodeSemanticTokens(data, types) {
  const out = [];
  let line = 0;
  let char = 0;
  for (let i = 0; i < data.length; i += 5) {
    const dLine = data[i];
    const dChar = data[i + 1];
    line += dLine;
    char = dLine === 0 ? char + dChar : dChar;
    out.push({ line, char, length: data[i + 2], type: types[data[i + 3]] });
  }
  return out;
}

describe('semanticTokensFor', () => {
  it('paints a verb of the language as `function`', async () => {
    const { data } = await semanticTokensFor('[1 2 3] | count');
    const tokens = decodeSemanticTokens(data, SEMANTIC_TOKEN_TYPES);
    const countTok = tokens.find(t => t.type === 'function');
    expect(countTok).toBeTruthy();
    expect(countTok.line).toBe(0);
  });

  it('paints a `::Tag` head as `struct`', async () => {
    const { data } = await semanticTokensFor('::number/add/SubjectNotNumberError | doc');
    const tokens = decodeSemanticTokens(data, SEMANTIC_TOKEN_TYPES);
    const tagTok = tokens.find(t => t.type === 'struct');
    expect(tagTok).toBeTruthy();
    expect(tagTok.length).toBe('::number/add/SubjectNotNumberError'.length);
  });

  it('paints a user-bound identifier reference as `variable`', async () => {
    const { data } = await semanticTokensFor(':double ~(mul 2) | 5 | apply double');
    const tokens = decodeSemanticTokens(data, SEMANTIC_TOKEN_TYPES);
    expect(tokens.some(t => t.type === 'variable')).toBe(true);
  });

  it('paints a regex literal as `regexp`', async () => {
    const { data } = await semanticTokensFor('"a1" | contains #"\\d"i');
    const tokens = decodeSemanticTokens(data, SEMANTIC_TOKEN_TYPES);
    const regexTok = tokens.find(t => t.type === 'regexp');
    expect(regexTok).toBeTruthy();
    expect(regexTok.length).toBe('#"\\d"i'.length);
  });

  it('paints a comment span as `comment`', async () => {
    const { data } = await semanticTokensFor('42 |~| trace');
    const tokens = decodeSemanticTokens(data, SEMANTIC_TOKEN_TYPES);
    expect(tokens.some(t => t.type === 'comment')).toBe(true);
  });

  it('paints a string literal as `string`', async () => {
    const { data } = await semanticTokensFor('"hello"');
    const tokens = decodeSemanticTokens(data, SEMANTIC_TOKEN_TYPES);
    expect(tokens.some(t => t.type === 'string')).toBe(true);
  });

  it('paints the delimiters of a quote as `string`', async () => {
    const { data } = await semanticTokensFor('~(count)');
    const tokens = decodeSemanticTokens(data, SEMANTIC_TOKEN_TYPES);
    // Quote literal renders the ~( and ) delimiters as `string` kind
    expect(tokens.some(t => t.type === 'string')).toBe(true);
  });

  it('paints a number literal as `number`', async () => {
    const { data } = await semanticTokensFor('42');
    const tokens = decodeSemanticTokens(data, SEMANTIC_TOKEN_TYPES);
    expect(tokens.some(t => t.type === 'number')).toBe(true);
  });

  it('coats each kind of the core\'s tokens by a type of the protocol, a path and a keyword as the property they read, and a bracket and a gap by none [D371]', async () => {
    const src = ':x |~~ d ~~| 1 | [null true /a/b :k !{} ::T] !| count | x';
    const tokens = decodeSemanticTokens((await semanticTokensFor(src)).data, SEMANTIC_TOKEN_TYPES);
    expect(tokens.map(({ char, length, type }) => [src.slice(char, char + length), type])).toEqual([
      [':x', 'keyword'], ['|~~ d ~~|', 'comment'], ['1', 'number'], ['null', 'number'], ['true', 'number'], ['/a/b', 'property'], [':k', 'property'],
      ['!{', 'keyword'], ['}', 'keyword'], ['::T', 'struct'], ['!|', 'keyword'], ['count', 'function'], ['x', 'variable']
    ]);
    expect(SEMANTIC_TOKEN_TYPES).toEqual([...new Set(SEMANTIC_TOKEN_TYPES)]);
  });

  it('splits a multi-line comment into per-line entries', async () => {
    const src = '|~ multi-\nline plain ~|\n42';
    const { data } = await semanticTokensFor(src);
    const tokens = decodeSemanticTokens(data, SEMANTIC_TOKEN_TYPES);
    const commentTokens = tokens.filter(t => t.type === 'comment');
    expect(commentTokens.length).toBeGreaterThanOrEqual(2);
  });

  it('emits well-formed 5-int stream', async () => {
    const { data } = await semanticTokensFor('[1 2 3] | filter ~(gt 1) | count');
    expect(data.length % 5).toBe(0);
    // Each `length` field is positive
    for (let i = 2; i < data.length; i += 5) {
      expect(data[i]).toBeGreaterThan(0);
    }
  });

  it('returns empty data for empty source', async () => {
    const { data } = await semanticTokensFor('');
    expect(data.length).toBe(0);
  });

  it('returns empty data for a source the parser reads none of', async () => {
    // tokenize emits a single whitespace span for it, which has no
    // semantic-token type — output is empty.
    expect((await semanticTokensFor(')))')).data.length).toBe(0);
  });

  it('returns the tokens of a source cut short, as it is typed', async () => {
    expect((await semanticTokensFor('[1 2 3')).data.length).toBeGreaterThan(0);
  });

  it('paints a doc whose quote stands under the tag of a group or of the fail track, its verb as `function` [D367]', async () => {
    for (const src of DOCS_OF_STEP_TAGS) {
      const tokens = decodeSemanticTokens((await semanticTokensFor(src)).data, SEMANTIC_TOKEN_TYPES);
      expect(tokens.some(t => t.type === 'function'), src).toBe(true);
    }
  });
});
