// The scripts `check:conventions` runs over the catalog and the code, held on
// planted sources and on the sources of the language: no kind of the catalog
// bears the name of a command of a chain [QSBLD#fn], a refusal names a kind
// only where its address names it [QSERR#site], and the verdict fails on
// either and names it [QSWRK#tooling].

import { describe, it, expect } from 'vitest';
import { platformLocator, LANGUAGE_SOURCES } from '../../src/runtime/bootstrap.mjs';
import { kindsNamedForCommands, kindsDeclaredBy } from '../../../scripts/catalog-kinds.mjs';
import { kindsNamedOffTheirAddress, refusalsOfTheCatalog } from '../../../scripts/refusal-kinds.mjs';
import { verdictOf } from '../../../scripts/conventions-verdict.mjs';
import { problemOfTitle, rulesOfTitle, titlesOfSource } from '../../../scripts/test-titles.mjs';

// A command of a chain is named by its act and what it writes by the noun of
// the thing, which the check of the conventions holds over the catalog [QSBLD#fn].
describe('no kind of the catalog bears the name of a command of a chain', () => {
  it('finds a label that bears the name of a command, declared by its chain, by its page alone, on one line or by its literal', () => {
    const planted = [
      { path: 'holds.qlang', text: ':Holds\n  |~~ A name of another case. ~~|\n:holds\n  |~~ An invariant. ~~|\n  ::kind\n    | wraps |~~ The condition. ~~| ::quote\n' },
      { path: 'wraps.qlang', text: ':wraps\n  |~~ A payload. ~~|\n' },
      { path: 'proves.qlang', text: ':proves |~~ A law. ~~| (::kind | wraps |~~ The query. ~~| ::quote)' },
      { path: 'impl.qlang', text: ':impl\n  |~~ A recipe. ~~|\n  ::kind[~() null]\n' }
    ];
    expect(kindsNamedForCommands(planted)).toEqual([
      { path: 'holds.qlang', line: 3, name: 'holds' }, { path: 'wraps.qlang', line: 1, name: 'wraps' },
      { path: 'proves.qlang', line: 1, name: 'proves' }, { path: 'impl.qlang', line: 1, name: 'impl' }
    ]);
  });

  it('leaves a name of data, a label named for a verb that is no command, a declaration inside a law and a source of no declaration', () => {
    const planted = [
      { path: 'takes.qlang', text: ':takes\n  5\n' },
      { path: 'fill.qlang', text: ':fill\n  |~~ A fill. ~~|\n:inputs\n  |~~ The inputs. ~~|\n' },
      { path: 'box.qlang', text: ':Box\n  |~~ A box. ~~|\n  ::kind\n    | proves :x |~~ An x. ~~| ~(:holds |~~ An invariant. ~~| | true)\n' },
      { path: 'value.qlang', text: '5' }
    ];
    expect(kindsNamedForCommands(planted)).toEqual([]);
  });

  it('finds none among the sources of the language', async () => {
    const sources = await Promise.all(LANGUAGE_SOURCES.map(async uri => ({ path: uri, text: (await platformLocator(uri)).source })));
    expect(kindsNamedForCommands(sources)).toEqual([]);
  });

  it('fails the check of the conventions on such a kind and names it, and passes on none [QSWRK#tooling]', () => {
    expect(verdictOf({ commandKinds: [] })).toEqual({ text: 'check:conventions — OK\n', failed: false });
    const { text, failed } = verdictOf({ commandKinds: [{ path: 'holds.qlang', line: 3, name: 'holds' }] });
    expect(failed).toBe(true);
    expect(text).toContain('holds.qlang:3  ::holds, the name of the command `holds`');
  });
});

// A refusal is public, so its name carries a kind only where its address
// names it, which the check of the conventions holds over the code and the
// pages of the catalog [QSERR#site].
describe('a refusal names a kind only where its address names it', () => {
  const nouns = new Set(['boolean', 'keyword', 'map', 'number', 'set', 'string', 'vec']);
  const named = addresses => kindsNamedOffTheirAddress(addresses.map(address => ({ address })), nouns);

  it('finds a kind after `Not`, a list of them however joined, a plural and one after a word of no kind', () => {
    expect(named(['vec/join/ElementNotStringOrKeywordError', 'vec/join/ElementNotStringNorKeywordError', 'vec/sum/ElementNotANumberError', 'point/PayloadNotThreeNumbersError'])).toEqual([
      { address: 'vec/join/ElementNotStringOrKeywordError', kinds: ['string', 'keyword'] },
      { address: 'vec/join/ElementNotStringNorKeywordError', kinds: ['string', 'keyword'] },
      { address: 'vec/sum/ElementNotANumberError', kinds: ['number'] },
      { address: 'point/PayloadNotThreeNumbersError', kinds: ['number'] }
    ]);
  });

  it('finds the label of the address named by a role other than the subject, and a verb of the address that names a kind', () => {
    expect(named(['vec/zip/ElementNotVecError', 'string/replace/with/AnswerNotStringError', 'set/zip/SubjectNotVecError'])).toEqual([
      { address: 'vec/zip/ElementNotVecError', kinds: ['vec'] },
      { address: 'string/replace/with/AnswerNotStringError', kinds: ['string'] },
      { address: 'set/zip/SubjectNotVecError', kinds: ['vec'] }
    ]);
  });

  it('leaves the label of a subject, the kind a conversion reads, a place a key is missing from, a word of no kind and a name by the role', () => {
    expect(named(['number/add/SubjectNotNumberError', 'string/toNumber/TextNotNumberError', 'path/KeyNotInMapError', 'vec/toMap/ElementNotPairError', 'vec/sum/ElementKindNotTakenError'])).toEqual([]);
  });

  it('reads what `throws` and `holds` write in a chain and in the quote of a literal, and leaves a law, a doc and a command of no name', () => {
    const planted = [{ path: 'box.qlang', text: [
      ':Box', '  |~~ A box. ~~|', '  ::kind', '    | holds :NotWideError |~~ Wide. ~~| ~(gt 0)',
      '    | proves :x |~~ An x. ~~| ~(:Pos |~~ P. ~~| (::kind | holds :NotPositiveError |~~ P. ~~| ~(gt 0)) | true)',
      ':Box/w', '  |~~ The width, `| throws :NotNumberError`. ~~|', '  ::fn', '    | throws :SubjectNotBoxError |~~ A box. ~~|',
      '    | throws |~~ No name. ~~|', '    | holds',
      ':Box/h ::fn[~(throws :RowNotMapError |~~ A row. ~~|) ::builtin{}]', ':Box/d |~~ A page. ~~|', ''].join('\n') }];
    expect(refusalsOfTheCatalog(planted)).toEqual([
      { address: 'Box/NotWideError', file: 'box.qlang', line: 4 },
      { address: 'Box/w/SubjectNotBoxError', file: 'box.qlang', line: 9 },
      { address: 'Box/h/RowNotMapError', file: 'box.qlang', line: 12 }
    ]);
  });

  it('reads the kinds a source declares, by the page alone and by the chain, and no node under one and no value', () => {
    const planted = [{ path: 'kinds.qlang', text: [
      ':Holds', '  |~~ A page alone. ~~|', ':Box', '  |~~ A box. ~~|', '  ::kind', '    | wraps |~~ The payload. ~~| ::vec',
      ':Box/w', '  |~~ A node. ~~|', ':limit 5', ':double ~(mul 2)', ''].join('\n') }];
    expect(kindsDeclaredBy(planted)).toEqual(new Set(['Holds', 'Box']));
  });

  it('fails the check of the conventions on such a refusal and names it, and passes on none [QSWRK#tooling]', () => {
    expect(verdictOf({ kindNames: [] })).toEqual({ text: 'check:conventions — OK\n', failed: false });
    const { text, failed } = verdictOf({ kindNames: [{ file: 'core/src/runtime/sequence.mjs', line: 9, address: 'vec/sum/ElementNotNumberError', kinds: ['number'] }] });
    expect(failed).toBe(true);
    expect(text).toContain('core/src/runtime/sequence.mjs:9  vec/sum/ElementNotNumberError names ::number');
  });
});

// A test is held by its own title, which opens with the one rule it holds and
// names second the record in transit that brought it [D409].
describe('a test names first the one rule it holds and second the record that brings it', () => {
  const context = { heldByItsTests: name => name === 'D404', overridesOf: name => ({ D409: ['QSWRK#marks', 'QSCOL'] })[name] };
  const problemOf = title => problemOfTitle({ title, rules: title === null ? [] : rulesOfTitle(title) }, context);

  it('[QSWRK#marks] [D409] reads the rules at the head of a title, a section, a chapter and a record, and none past its words', () => {
    expect(rulesOfTitle('[QSHST#answer] [D409] reads -h [QSHST#tools]')).toEqual(['QSHST#answer', 'D409']);
    expect(rulesOfTitle('[QSWRK] [D404] a rule')).toEqual(['QSWRK', 'D404']);
    expect(rulesOfTitle('reads -h [QSHST#answer]')).toEqual([]);
  });

  it('[QSWRK#marks] [D409] reads the title of a test from its string, its template and the call of a table, and none from a name', () => {
    const source = ["describe('a group', () => {", "  it('[QSNUM#arith] adds', () => {});", '  test(`[QSNUM#arith] adds ${1}`, () => {});',
      "  it.each([[1], [2]])('[QSNUM#arith] adds %s', () => {});", '  it(name, () => {});', '});'].join('\n');
    expect(titlesOfSource(source)).toEqual([{ line: 2, title: '[QSNUM#arith] adds' }, { line: 3, title: '[QSNUM#arith] adds ${…}' },
      { line: 4, title: '[QSNUM#arith] adds %s' }, { line: 5, title: null }]);
  });

  it('[QSWRK#marks] [D409] passes a title that opens with a section, a record its tests hold, and a record in transit over the section or its chapter', () => {
    for (const title of ['[QSHST#answer] reads -h', '[D404] reads a nest at once', '[QSWRK#marks] [D409] refuses', '[QSCOL#image] [D409] maps']) expect(problemOf(title), title).toBeNull();
  });

  it('[QSWRK#marks] [D409] refuses a title of no literal, of no rule, of a chapter, of a record no test holds, of two sections and of a record out of transit or over another section', () => {
    expect(problemOf(null)).toContain('by no literal');
    expect(problemOf('reads -h [QSHST#answer]')).toBe('opens with no rule it holds');
    expect(problemOf('[QSHST] reads -h')).toContain('a chapter and not the section');
    expect(problemOf('[D409] refuses')).toContain('no record in force of a domain its tests hold');
    expect(problemOf('[QSHST#answer] [QSHST#repl] reads -h')).toContain('opens with two rules');
    expect(problemOf('[QSHST#answer] [D404] reads -h')).toContain('no record in transit');
    expect(problemOf('[QSHST#answer] [D409] reads -h')).toContain('overrides neither QSHST#answer nor its chapter');
    expect(problemOf('[QSWRK#marks] [D409] [D404] refuses')).toContain('past its rule and its record');
  });
});
