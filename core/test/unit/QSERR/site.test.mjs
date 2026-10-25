import { describe, it, expect } from 'vitest';
import { makeKeyword, isErrorValue, makeTag } from '../../../src/types.mjs';
import { makeSet } from '../../../src/ordering.mjs';
import { errorFromQlang } from '../../../src/error-convert.mjs';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { CallUnknownNameError, declareRefusal, QlangError, CallEvaluationDepthExceededError, QlangDefect, BuiltinRefusalDeclaredTwiceError, declareForeignError, declaredRefusals } from '../../../src/errors.mjs';
import { catchOriginalError } from '../../helpers/error-assertions.mjs';
import { createNotebook } from '../../../src/notebook.mjs';
import { ruleRefusalsOf, kindsSharedBy } from '../../../src/nouns.mjs';
import { kindsDeclaredBy } from '../../../../scripts/catalog-kinds.mjs';
import { kindsNamedOffTheirAddress, refusalsOfTheCatalog } from '../../../../scripts/refusal-kinds.mjs';
import { verdictOf } from '../../../../scripts/conventions-verdict.mjs';
import { TestsProbeTypeError } from '../../helpers/probe-refusal.mjs';

const probeScope = async () => (await createNotebook({ sources: [{ uri: 'tests/probe', source:
  ':tests |~~ Probes. ~~|\n  ::kind | throws :ProbeTypeError |~~ A probe. ~~| ~(wires :actualTag |~~ The kind. ~~| ::tag | wires :actualValue |~~ The value. ~~|)' }] })).scope;

describe('a refusal converted to a failure', () => {
  it('converts a refusal — its address the tag, its facts in the order the kind of its refusal wires them', async () => {
    const typeErr = new TestsProbeTypeError({ actualValue: 'the-value' });
    const errorVal = errorFromQlang(typeErr, 'the-subject', await probeScope());
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.facts;
    expect(errorVal.tag).toEqual(makeTag('tests/ProbeTypeError'));
    expect(desc.get('actualValue')).toBe('the-value');
    expect(desc.get('actualTag')).toEqual(makeTag('string'));
    expect([...desc.keys()]).toEqual(['actualTag', 'actualValue']);
  });

  it('converts the refusal of an unknown name with the facts its label declares', async () => {
    const unresolvedErr = new CallUnknownNameError({ addresses: makeSet([]), name: makeKeyword('myName') });
    const errorVal = errorFromQlang(unresolvedErr, 42, await langRuntime());
    expect(errorVal.tag).toEqual(makeTag('call/UnknownNameError'));
    expect([...errorVal.facts.keys()]).toEqual(['name', 'addresses']);
  });

  it('refuses a fact the kind of its refusal does not wire, a defect of the runtime', async () => {
    const scope = await probeScope();
    expect(() => errorFromQlang(new TestsProbeTypeError({ undeclared: 1 }), 42, scope)).toThrow(/carries :undeclared/);
  });
});

it('a refusal carries its facts', () => {
  const qlangErr = new QlangError('boom', { count: 5 });
  expect(qlangErr.facts).toEqual({ count: 5 });
  expect(qlangErr.message).toBe('boom');
  expect(qlangErr.name).toBe('QlangError');
  expect(qlangErr).toBeInstanceOf(Error);
});

const TestsProbeError = declareRefusal('tests/ProbeError');

describe('a refusal declared by its address', () => {
  it('carries the facts its site hands, named by the last name of its address', () => {
    const unresolvedErr = new CallUnknownNameError({ name: makeKeyword('foo') });
    expect(unresolvedErr).toBeInstanceOf(QlangError);
    expect(unresolvedErr.facts.name.name).toBe('foo');
    expect(unresolvedErr.name).toBe('UnknownNameError');
    expect(unresolvedErr.address).toBe('call/UnknownNameError');
  });

  it('says its address as its message, whatever facts its site hands', () => {
    expect(new TestsProbeError().message).toBe('::tests/ProbeError');
    expect(new CallEvaluationDepthExceededError({ depth: 11, limit: 10 }).message).toBe('::call/EvaluationDepthExceededError');
  });

  it('hands no facts where its site hands none', () => {
    const probeErr = new TestsProbeError();
    expect(probeErr.name).toBe('ProbeError');
    expect(probeErr.facts).toEqual({});
  });

  it('names the class of a refusal by the last name of its address', () => {
    expect(CallUnknownNameError.name).toBe('UnknownNameError');
    expect(TestsProbeError.name).toBe('ProbeError');
  });
});

it('a defect of the runtime carries its message and its facts', () => {
  const defect = new QlangDefect('registration failed', { site: 'X', verb: 'foo' });
  expect(defect.message).toBe('registration failed');
  expect(defect.facts.site).toBe('X');
  expect(defect.facts.verb).toBe('foo');
  expect(defect).toBeInstanceOf(QlangError);
});

describe('one address, one site', () => {
  it('lists every address a site declared, which the pages of the refusals are held against', () => {
    expect([...declaredRefusals()]).toEqual(expect.arrayContaining(['tests/ProbeError', 'call/UnknownNameError', 'builtin/RefusalDeclaredTwiceError']));
  });

  it('refuses a second declaration of an address already declared', () => {
    let refusal = null;
    try {
      declareRefusal('call/UnknownNameError');
    } catch (caught) {
      refusal = caught;
    }
    expect(refusal).toBeInstanceOf(QlangDefect);
    expect(refusal).toBeInstanceOf(BuiltinRefusalDeclaredTwiceError);
    expect(refusal.name).toBe('RefusalDeclaredTwiceError');
    expect(refusal.facts.address).toBe('call/UnknownNameError');
    expect(refusal.message).toContain('call/UnknownNameError');
  });
});

it('declares a failure of the embedding outside the refusals of the language, which still names its site', () => {
  const TestsBridgeUnreachableError = declareForeignError('tests/BridgeUnreachableError',
    ({ endpoint }) => `host bridge at ${endpoint} answered nothing`);
  const foreignErr = new TestsBridgeUnreachableError({ endpoint: 'ipc://bridge' });

  expect(foreignErr).toBeInstanceOf(Error);
  expect(foreignErr).not.toBeInstanceOf(QlangError);
  expect(foreignErr.name).toBe('BridgeUnreachableError');
  expect(foreignErr.address).toBe('tests/BridgeUnreachableError');
  expect(foreignErr.facts.endpoint).toBe('ipc://bridge');
  expect(foreignErr.message).toContain('ipc://bridge');
});

it('every refusal of the runtime is one kind of error, its message its address', async () => {
  const queries = [
    '42 | count',
    '[1 "two"] | sum',
    '42 | get /name',
    '42 | map ~(add 1)',
    '5 | :five it | five 42',
    '42 | reduce 0 ~(add)'
  ];
  for (const q of queries) {
    const caughtErr = await catchOriginalError(q);
    expect(caughtErr).toBeInstanceOf(QlangError);
    expect(caughtErr.message).toBe(`::${caughtErr.address}`);
  }
});

const notebook = await createNotebook();
await notebook.evalCell([
  ':number/pick (::fn | takes :by |~~ How much. ~~| /0 ::number | returns |~~ A boolean or a string. ~~| #[::boolean ::string] | impl ~(gt by))',
  ':number/keep (::fn | returns |~~ A number or a string. ~~| #[::number ::string] | impl ~(add 1))',
  ':number/plain (::fn | takes :by |~~ How much. ~~| ~(query /0 1) | impl ~(add by))'
].join(' | '));

describe('the refusals a verb that is a function raises by rule', () => {
  it('names an answer of none of several kinds where its label is none of them', () => {
    expect(ruleRefusalsOf(notebook.scope, 'number/pick')).toEqual([
      'number/pick/SubjectNotNumberError',
      'number/pick/ArgsBeyondInputsError',
      'number/pick/by/NotGivenError',
      'number/pick/by/KindNotTakenError',
      'number/pick/answer/KindNotTakenError'
    ]);
  });

  it('names no refusal of an answer whose kinds hold its label', () => {
    expect(ruleRefusalsOf(notebook.scope, 'number/keep')).toEqual(['number/keep/SubjectNotNumberError', 'number/keep/ArgsBeyondInputsError']);
  });

  it('names no refusal of an answer it does not name, nor of an input its selector reads softly', () => {
    expect(ruleRefusalsOf(notebook.scope, 'number/plain')).toEqual(['number/plain/SubjectNotNumberError', 'number/plain/ArgsBeyondInputsError']);
  });

  it('names the refusals whose kinds the refusals of a verb and of a kind share by their tags', async () => {
    const { scopeAfterCell } = await notebook.evalCell(':number/twice ~(mul 2)');
    expect([kindsSharedBy(scopeAfterCell, 'vec/filter'), kindsSharedBy(scopeAfterCell, 'group'), kindsSharedBy(scopeAfterCell, 'number/pick'), kindsSharedBy(scopeAfterCell, 'number/twice')])
      .toEqual([['fn/KindNotTakenError'], ['kind/InvariantNotHeldError'], [], []]);
  });

  it('names the refusals of a verb written as its recipe alone, the function of no commands it is', async () => {
    const own = await createNotebook();
    await own.evalCell(':number/v ~(1)');
    expect(ruleRefusalsOf(own.scope, 'number/v')).toEqual(['number/v/SubjectNotNumberError', 'number/v/ArgsBeyondInputsError']);
  });
});

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

  it('leaves the label of a subject, the kind a conversion reads, a map a key is missing from, a word of no kind and a name by the role', () => {
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
      ':Holds', '  |~~ A page alone. ~~|', ':Box', '  |~~ A box. ~~|', '  ::kind', '    | accepts |~~ The payload. ~~| ::vec',
      ':Box/w', '  |~~ A node. ~~|', ':limit 5', ':double ~(mul 2)', ''].join('\n') }];
    expect(kindsDeclaredBy(planted)).toEqual(new Set(['Holds', 'Box']));
  });

  it('fails the check of the conventions on such a refusal and names it, and passes on none', () => {
    expect(verdictOf({ kindNames: [] })).toEqual({ text: 'check:conventions — OK\n', failed: false });
    const { text, failed } = verdictOf({ kindNames: [{ file: 'core/src/runtime/sequence.mjs', line: 9, address: 'vec/sum/ElementNotNumberError', kinds: ['number'] }] });
    expect(failed).toBe(true);
    expect(text).toContain('core/src/runtime/sequence.mjs:9  vec/sum/ElementNotNumberError names ::number');
  });
});

describe('the refusals a kind raises by rule', () => {
  it('names the payload of none of its kinds, each field left out, not read and of none of its kinds, and a field of no kinds left out and not read alone', async () => {
    const own = await createNotebook();
    await own.evalCell([
      ':Box',
      '  |~~ A parcel. ~~|',
      '  ::kind',
      '    | accepts |~~ The sizes. ~~| ::map',
      '    | wires :w |~~ The width. ~~| /w ::number',
      '    | wires :tags |~~ The tags. ~~| ~(query /tags []) [::keyword]',
      '    | wires :note |~~ A note. ~~| /note'
    ].join('\n'));
    expect(ruleRefusalsOf(own.scope, 'Box')).toEqual([
      'Box/PayloadKindNotTakenError',
      'Box/w/NotGivenError',
      'Box/w/NotReadError',
      'Box/w/KindNotTakenError',
      'Box/tags/NotGivenError',
      'Box/tags/NotReadError',
      'Box/tags/KindNotTakenError',
      'Box/tags/ElementKindNotTakenError',
      'Box/note/NotGivenError',
      'Box/note/NotReadError'
    ]);
  });

  it('names a payload that is no vector where it names the kinds of each element', async () => {
    const own = await createNotebook();
    await own.evalCell(':Nums\n  |~~ Numbers. ~~|\n  ::kind\n    | accepts |~~ The numbers. ~~| [::number]');
    expect(ruleRefusalsOf(own.scope, 'Nums')).toEqual(['Nums/PayloadKindNotTakenError', 'Nums/ElementKindNotTakenError']);
  });

  it('names no refusal of a kind that writes no wraps and no field', async () => {
    const own = await createNotebook();
    await own.evalCell(':Mark\n  |~~ A mark. ~~|\n  ::kind\n    | proves :holds |~~ It holds. ~~| ~(true)');
    expect(ruleRefusalsOf(own.scope, 'Mark')).toEqual([]);
  });

  it('names the refusal of every payload for a kind whose wraps names no kind', async () => {
    const own = await createNotebook();
    await own.evalCell(':Topic\n  |~~ A topic. ~~|\n  ::kind\n    | accepts |~~ None. ~~| #[]');
    expect(ruleRefusalsOf(own.scope, 'Topic')).toEqual(['Topic/PayloadKindNotTakenError']);
  });
});
