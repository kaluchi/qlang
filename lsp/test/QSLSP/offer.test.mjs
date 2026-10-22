import { describe, it, expect } from 'vitest';
import { parseDocument, completionsAtOffset, signatureHelpAtOffset } from '../../src/features.mjs';
import { evalQuery, isTag } from '@kaluchi/qlang-core';

describe('the names offered at a place', () => {
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

  it('a verb of the language completes as a verb', async () => {
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

  it('a value the document names completes as a value', async () => {
    const src = ':myVar 42 | myVar';
    const { root } = parseDocument(src, 'test.qlang');
    const items = await completionsAtOffset(root, src.length);
    const myVarItem = items.find(i => i.label === 'myVar');
    expect(myVarItem.role).toBe('value');
  });

  it('names each name the document declares by the role of its declaration, a verb under its own label or a label of the root and a label by its name and its tag', async () => {
    const src = ':Box |~~ A box. ~~| | :Box/area ~(1) | :vec/second ~(get /1) | :n 1 | n';
    const { root } = parseDocument(src, 'test.qlang');
    const roles = new Map((await completionsAtOffset(root, src.length)).map(item => [item.label, item.role]));
    expect(['area', 'second', 'n', 'Box', '::Box'].map(label => roles.get(label))).toEqual(['verb', 'verb', 'value', 'label', 'label']);
  });

  it('offers each name the document declares once, by the name a step calls it by, a name with a path by its last name, after a subject and with none', async () => {
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

  it('cursor right after `::` completes the names of the root as tags alone, each by its role', async () => {
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

describe('the verbs offered after a value', () => {
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

  it('keeps the kinds of the subject through a declaration, and offers after a tagged literal the verbs the walk of its tags reaches', async () => {
    const labels = await labelsAt('[1 2 3] | :xs it | ');
    expect(labels).toContain('count');
    expect(labels).not.toContain('add');
    const afterTagged = await labelsAt('[1 2 3] | :xs it | ::Box{:a 1} | ');
    expect(afterTagged).toContain('count');
    expect(afterTagged).toContain('payload');
    expect(afterTagged).not.toContain('add');
  });

  it('reads a literal alone over the root, a label the document declares a tag of identity, and a literal its constructor refuses by the kinds of its refusal', async () => {
    const afterIdentity = await labelsAt(':Pos |~~ P ~~| (::kind | holds :NegError |~~ n ~~| ~(gt 0)) | ::Pos#-1 | ');
    expect(afterIdentity).toContain('add');
    expect(afterIdentity).not.toContain('trace');
    const afterRefusal = await labelsAt('::number"5" | ');
    expect(afterRefusal).toContain('trace');
    expect(afterRefusal).not.toContain('add');
  });

  it('offers after a tag name the verbs that serve it, those of a tag name, of any value and of its noun whose `on` names `::tag`, none of its noun refusing it', async () => {
    const afterVec = await labelsAt('::vec | ');
    expect(['manifest', 'toTag', 'count', 'sort', 'add'].map(label => afterVec.includes(label))).toEqual([true, true, false, false, false]);
    expect(await labelsAt('::kind | ')).toContain('wraps');
    for (const label of afterVec.filter(offered => !offered.startsWith('::'))) {
      const answer = await evalQuery(`::vec | ${label} !| type`);
      expect(isTag(answer) && /^vec\/[^/]+\/Subject\w*Error$/.test(answer.name), label).toBe(false);
    }
  });

  it('reads no kind after a call its subject refuses, a verb of the noun a tag name names that serves no tag name', async () => {
    const labels = await labelsAt('::vec | count | ');
    expect(labels).toContain('count');
    expect(labels).toContain('add');
  });

  it('follows the walk of the subject through the label of a verb that returns its own label, the noun of a tag name left out, and elsewhere the kinds it returns', async () => {
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

  it('offers a set its own verbs and those of vectors its walk reaches, after a literal and after a verb that returns a set', async () => {
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

  it('reads a line break as a space, the step on the next line joined by `|`', async () => {
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

describe('the help of the signature of a call', () => {
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

  it('opens after a verb across a comment between it and the cursor, which the grammar reads as whitespace', async () => {
    const src = '[1 2 3] | take |~ how many ~| ';
    const sig = await signatureHelpAtOffset(parseDocument(src, 'test.qlang').root, src, src.length);
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
