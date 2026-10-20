// The catalog the language declares its root by, each source the page of one
// noun and what is declared under it [QSDSP#residence]:
// `lib/qlang.qlang` the topic of the language, and each source under
// `lib/qlang/` a kind. `langRuntime()` runs them once at startup and seals the
// registry of primitives the verbs name.

import { describe, it, expect } from 'vitest';
import { nodeOf } from '../../src/nouns.mjs';
import { parse } from '../../src/parse.mjs';
import { keyword, isMap, isVec, isQuote, makeTag, bindingValueOf, TAG_HEADER_SYMBOL } from '../../src/types.mjs';
import { makeSet } from '../../src/ordering.mjs';
import { platformLocator, LANGUAGE_SOURCES } from '../../src/runtime/bootstrap.mjs';
import { evalQuery } from '../../src/session.mjs';
import { kindsNamedForCommands, kindsDeclaredBy } from '../../../scripts/catalog-kinds.mjs';
import { kindsNamedOffTheirAddress, refusalsOfTheCatalog } from '../../../scripts/refusal-kinds.mjs';
import { verdictOf } from '../../../scripts/conventions-verdict.mjs';

describe('the sources of the language', () => {
  it('each parses without errors', async () => {
    for (const uri of LANGUAGE_SOURCES) {
      expect(isQuote(parse((await platformLocator(uri)).source, { uri })), uri).toBe(true);
    }
  });
});

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
// pages of the catalog [D389].
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

describe('the verbs of the language reach their primitives', () => {

  it('spot-check — :add is a function under ::number whose recipe a primitive answers [QSBLD#input], [QSBLD#fn]', async () => {
    const { langRuntime } = await import('../../src/runtime/index.mjs');
    const { isBuiltinDescriptor, isPrimitiveHanded, isFn, recipeOf } = await import('../../src/types.mjs');
    const resolved = await langRuntime();
    const add = bindingValueOf(nodeOf(resolved, 'number/add'));
    expect(isFn(add)).toBe(true);
    expect(isBuiltinDescriptor(recipeOf(add))).toBe(true);
    expect(isPrimitiveHanded(recipeOf(add))).toBe(true);
  });

  it('spot-check — filter takes its predicate as an input of the kinds of a quote and a path, on each kind that answers it [QSSLF#catalog], [QSBLD#fn]', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('::map/filter | manifest')).toEqual(makeSet([makeTag('map/filter/ConditionKindNotTakenError'), makeTag('map/filter/answer'), makeTag('map/filter/predicate')]));
    expect(await evalQuery('[::vec/filter ::map/filter] | map ~(binding | get /value | inputs | map /kinds) | print')).toBe('[[#[::path ::quote]] [#[::path ::quote]]]');
  });
});

describe('the pages of the language read through `doc`', () => {

  it('spot-check — the page of ::vec/count tells the number of elements it answers', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const { docText } = await import('../../src/print-value.mjs');
    const joined = docText(await evalQuery('::vec/count | doc'));
    expect(joined).toContain('number of elements');
  });

  it('spot-check — ::vec/filter docs describe the predicate semantics', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const { docText } = await import('../../src/print-value.mjs');
    const joined = docText(await evalQuery('::vec/filter | doc'));
    expect(joined).toContain('predicate');
    expect(joined).toContain('true');
  });
});

describe('bare-name verb call', () => {
  // A verb called by its bare name, with no modifiers, runs on the
  // value in the pipe; an input whose place the call leaves out is
  // refused under the input. What a verb does is read by `:name |
  // source`, `::name | doc` and `::name | laws`, not by a bare name.

  it('bare `count` fires against the inbound Vec', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('[1 2 3] | count')).toBe(3);
  });

  it('bare `sort` sorts in the one order, its key left out', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('[3 1 2] | sort')).toEqual([1, 2, 3]);
  });

  it('bare `mul` on a number gives no multiplier and is refused under the input', async () => {
    // The input `multiplier` reads the first place of the args, which
    // a call without a modifier leaves empty [QSBLD#fn].
    const { evalQuery } = await import('../../src/session.mjs');
    const { isErrorValue } = await import('../../src/types.mjs');
    const evalResult = await evalQuery('5 | mul');
    expect(isErrorValue(evalResult)).toBe(true);
    expect(evalResult.tag.name).toBe('number/mul/multiplier/NotGivenError');
  });
});

describe('the root of the language', () => {
  it('the root holds the kinds of the language and its topic', async () => {
    expect(await evalQuery('get [~(kinds | has ::number) ~(::qlang | doc | type)]')).toEqual(await evalQuery('[true ::doc]'));
  });

  it('no kind of the root is left a descriptor [QSSLF#page]', async () => {
    expect(await evalQuery('kinds | map ~(binding | get /value | type) | has ::builtin')).toBe(false);
  });
});

describe('parse / open / apply — code read, written and run', () => {
  // `parse` reads a source string into the quote of its steps and
  // `toString` writes a quote back; `open` runs the quote from null and
  // `apply` against the subject. Together they round-trip
  // source text → data → pipeValue without leaving the language,
  // and ground the programmatic-query-construction surface.

  it('parse reads the literal of an atom into the quote of that one step', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const evalResult = await evalQuery('"42" | parse');
    expect(isVec(evalResult)).toBe(true);
    expect([...evalResult]).toEqual([42]);
  });

  it('parse reads a call into a ::call step with :name / :modifiers', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const callStep = (await evalQuery('"add 1 2" | parse'))[0];
    expect(isMap(callStep)).toBe(true);
    expect(callStep[TAG_HEADER_SYMBOL].name).toBe('call');
    expect(callStep.get('name')).toEqual(keyword('add'));
    expect(callStep.get('modifiers')).toHaveLength(2);
  });

  it('parse refuses a subject that is no string under its own address', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const evalResult = await evalQuery('42 | parse !| type');
    expect(evalResult).toEqual(makeTag('string/parse/SubjectNotStringError'));
  });

  it('apply runs a quote assembled from its steps', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const evalResult = await evalQuery('[42 ::call{:name :add :modifiers [1]}] | tag ::quote | apply it');
    expect(evalResult).toBe(43);
  });

  it('apply refuses code that is not a Quote', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const evalResult = await evalQuery('"not-a-quote" | apply it !| type');
    expect(evalResult).toEqual(makeTag('any/apply/code/KindNotTakenError'));
  });

  it('round-trip — "source" | parse | open is equivalent to evaluating the source', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('"42" | parse | open')).toBe(42);
    expect(await evalQuery('"10 | add 3" | parse | open')).toBe(13);
    expect(await evalQuery('"[1 2 3] | filter ~(gt 1) | count" | parse | open')).toBe(2);
  });

  it('round-trip preserves paths and Map literals', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('"{:a 1 :b 2} | get /a" | parse | open')).toBe(1);
  });

  it('error values round-trip through parse | open', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const evalResult = await evalQuery('"!{:kind :oops} | raise !| get /kind" | parse | open');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('parse errors on malformed source lift to fail-track', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    const evalResult = await evalQuery('"this is not qlang [" | parse !| type');
    expect(evalResult).toEqual(makeTag('quote/ParseError'));
  });
});
