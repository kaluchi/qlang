// Tests for error value type and its trace, its rank in the one order, the literal,
// error-convert.mjs, and the trace of a failure a host hands [QSERR#trace].

import { describe, it, expect } from 'vitest';
import { keyword, isErrorValue, makeBinding, makeErrorValue, formOf, makeTag, makeTagged, makeFrame, makePath, makeQuote, makeTrace, stampTagHeader, TAG_HEADER_SYMBOL } from '../../src/types.mjs';
import { makeSet, compareValues } from '../../src/ordering.mjs';
import { parse } from '../../src/parse.mjs';
import { printValue } from '../../src/print-value.mjs';
import { errorFromQlang, errorFromForeign } from '../../src/error-convert.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { createSession, evalQuery } from '../../src/session.mjs';
import { boundAnswer } from '../../src/runtime/print.mjs';
import { CallUnknownNameError, declareRefusal } from '../../src/errors.mjs';

// ── makeErrorValue ──────────────────────────────────────────────

describe('makeErrorValue', () => {
  it('produces a frozen error under its tag that holds no :trace while no step raised it [QSERR#trace]', () => {
    const tag = makeTag('Oops');
    const errorVal = makeErrorValue(tag, new Map([['message', 'boom']]));
    expect(isErrorValue(errorVal)).toBe(true);
    expect(Object.isFrozen(errorVal)).toBe(true);
    expect(errorVal.tag).toBe(tag);
    expect([...errorVal.facts.keys()]).toEqual(['message']);
  });

  it('keeps a trace it is handed as it is [QSERR#trace]', () => {
    const trace = makeTrace([makeFrame('x', parse('add 1 | mul 2 | count'))]);
    const errorVal = makeErrorValue(makeTag('Oops'), new Map([['trace', trace]]));
    expect(errorVal.facts.get('trace')).toBe(trace);
  });
});

// ── a failure a host hands ──────────────────────────────────────

// A host hands a failure by the answer of its verb, by a refusal its verb or
// the constructor of its kind throws, as the first value of a query and as the
// value of a name in a scope it hands, and each holds the `:trace` it writes
// as the kind `::trace` takes it before a frame joins it [QSERR#trace].
const AnyThrownRefusedError = declareRefusal('any/thrown/RefusedError');
const NumberThrownToTheFoldRefusedError = declareRefusal('number/thrownToTheFold/RefusedError');
const BuiltRefusedError = declareRefusal('Built/RefusedError');

const HANDING_SOURCE = [
  ':any/answered |~~ Answers the failure its host makes. ~~| (::fn | impl ::builtin{})',
  ':any/thrown |~~ Throws the refusal its host raises. ~~| (::fn | throws :RefusedError |~~ Refused. ~~| | impl ::builtin{})',
  ':number/answeredToTheFold |~~ Answers a fold the failure its host makes. ~~| (::fn | takes :element |~~ The element. ~~| /0 | impl ::builtin{})',
  ':number/thrownToTheFold |~~ Throws to a fold the refusal its host raises. ~~| (::fn | takes :element |~~ The element. ~~| /0 | throws :RefusedError |~~ Refused. ~~| | impl ::builtin{})',
  ':Built |~~ A kind whose constructor its host hands. ~~| (::kind | throws :RefusedError |~~ Refused. ~~| | impl ::builtin{})'
].join('\n');

// A session whose host makes every failure with the `:trace` given, its
// constructor refusing the text "x" and an error at rest.
function hostHanding(trace) {
  const failure = () => makeErrorValue(makeTag('error'), new Map([['trace', trace]]));
  return createSession({ sources: [{ uri: 'host', source: HANDING_SOURCE, primitives: {
    'any/answered': failure,
    'any/thrown': () => { throw new AnyThrownRefusedError({ trace }); },
    'number/answeredToTheFold': failure,
    'number/thrownToTheFold': () => { throw new NumberThrownToTheFoldRefusedError({ trace }); },
    'Built/construct': payload => {
      if (payload === 'x' || payload?.[TAG_HEADER_SYMBOL]?.name === 'error') throw new BuiltRefusedError({ trace });
      return payload;
    }
  } }] });
}

const answerIn = async (session, query, initialPipeValue = null) => (await session.evalCell(query, { initialPipeValue })).result;

describe('a failure a host hands holds the :trace it writes as the kind of a trace takes it [QSERR#trace]', () => {
  it('a :trace of another shape on the answer of a host\'s verb answers the refusal of the kind, which the catch holds at rest', async () => {
    for (const [trace, refused] of [[5, 'trace/PayloadKindNotTakenError'], ['at Foo.bar(Foo.java:1)', 'trace/PayloadKindNotTakenError'], [[5], 'trace/ElementKindNotTakenError']]) {
      const session = await hostHanding(trace);
      const failure = await answerIn(session, '1 | answered');
      expect(failure.tag).toEqual(makeTag(refused));
      expect((await boundAnswer(failure, session.scope)).tag).toEqual(makeTag(refused));
      expect(await answerIn(session, '1 | answered !| 0')).toBe(0);
    }
  });

  it('a plain vector of frames on the answer of a host\'s verb is laid under the kind, and an empty trace is none, the frame of the step after it', async () => {
    expect(await answerIn(await hostHanding([makeFrame(0, parse('pre'))]), '1 | answered !| trace | eq ::trace[::frame[0 ~(pre)] ::frame[1 ~(answered)]]')).toBe(true);
    for (const trace of [[], makeTrace([])]) {
      expect(await answerIn(await hostHanding(trace), '1 | answered !| trace | eq ::trace[::frame[1 ~(answered)]]')).toBe(true);
    }
  });

  it('a refusal a host\'s verb throws carrying a :trace of another shape answers the refusal of the kind', async () => {
    const session = await hostHanding('at Foo.bar(Foo.java:1)');
    expect(await answerIn(session, '1 | thrown | add 1 !| get [~(type) /actualValue ~(trace | map ~failed)] | eq [::trace/PayloadKindNotTakenError "at Foo.bar(Foo.java:1)" [~(thrown)]]')).toBe(true);
    expect(await answerIn(session, '1 | thrown | add 1 !| 0')).toBe(0);
  });

  it('a fold names the place of its element on its frame where its one word, a host\'s verb, answers or throws such a failure', async () => {
    const answered = await hostHanding([makeFrame(0, parse('pre'))]);
    expect(await answerIn(answered, '[1 2] | reduce 0 ~(answeredToTheFold) !| trace | map ~place | eq [null null /0]')).toBe(true);
    const thrown = await hostHanding('at Foo.bar(Foo.java:1)');
    expect(await answerIn(thrown, '[1 2] | reduce 0 ~(thrownToTheFold) !| get [~(type) ~(trace | last | place)] | eq [::trace/PayloadKindNotTakenError /0]')).toBe(true);
  });

  it('a constructor of a host\'s kind that refuses the error at rest a catch holds with such a :trace answers the refusal of the kind', async () => {
    // `raise` raises the value under `::Built`, the catch lays its error at rest under that kind, whose constructor refuses it with a `:trace` of text, and the second catch reads the tag of the refusal of the kind of a trace.
    const session = await hostHanding('at Foo.bar(Foo.java:1)');
    expect(await answerIn(session, '::Built{:a 1} | raise !| type !| type')).toEqual(makeTag('trace/PayloadKindNotTakenError'));
  });

  it('carries no place of a fold\'s call of a host\'s word into another call that answers the same failure, the place a fact of its call', async () => {
    const kept = makeErrorValue(makeTag('error'), new Map());
    const session = await createSession({ sources: [{ uri: 'host', source: ':any/again |~~ Answers the one failure its host keeps. ~~| (::fn | takes :x |~~ x ~~| ~(it) | impl ::builtin{})', primitives: { 'any/again': () => kept } }] });
    expect(await answerIn(session, '[1 2] | reduce 0 ~(again) !| trace | last | place')).toEqual(makePath(['0']));
    expect(await answerIn(session, '5 | again 1 !| trace | last | place')).toBe(null);
  });

  it('a refusal the constructor of a host\'s kind throws inside a literal with an empty trace holds none, the literal\'s frame its first', async () => {
    const session = await hostHanding(makeTrace([]));
    expect(await answerIn(session, '::Outer::Built"x" !| get [~(type) ~(trace | map ~failed)] | eq [::Built/RefusedError [~(::Outer::Built"x")]]')).toBe(true);
  });

  it('a failure a host hands as the first value of its pipe holds its trace as the kind takes it', async () => {
    const session = await createSession();
    const handed = makeErrorValue(makeTag('error'), new Map([['trace', 5]]));
    expect((await answerIn(session, 'count', handed)).tag).toEqual(makeTag('trace/PayloadKindNotTakenError'));
    expect(await answerIn(session, '!| 0', handed)).toBe(0);
  });

  it('a failure a host hands as the value of a name in the scope it hands a session or a query answers the refusal of the kind where a step reads it', async () => {
    const bound = makeErrorValue(makeTag('error'), new Map([['trace', 5]]));
    const scope = new Map(await langRuntime()).set('f', makeBinding({ name: keyword('f'), value: bound }));
    const session = await createSession({ scope });
    expect(await answerIn(session, 'f | count !| type')).toEqual(makeTag('trace/PayloadKindNotTakenError'));
    expect(await answerIn(session, 'f !| 0')).toBe(0);
    expect(await evalQuery('get [~(f)] !| type', scope)).toEqual(makeTag('trace/PayloadKindNotTakenError'));
  });

  it('a trace a host stamps `::trace` over by hand is walked to its frames, an element that is no frame refused at its index', async () => {
    const trace = [makeFrame(0, parse('pre')), [1, parse('post')]];
    stampTagHeader(trace, makeTag('trace'));
    expect(await answerIn(await hostHanding(trace), '1 | answered !| get [~(type) /index] | eq [::trace/ElementKindNotTakenError 1]')).toBe(true);
  });

  it('a frame a host stamps `::frame` over a vector of another layout and a frame its trace leaves undefined are no frames, refused at their index', async () => {
    const stamped = parts => {
      stampTagHeader(parts, makeTag('frame'));
      return parts;
    };
    const steps = parse('add 1');
    const holed = [makeFrame(0, parse('pre')), undefined, makeFrame(2, parse('post'))];
    const laidOut = [[1], [1, [1, 2]], [1, makeQuote([])], [1, steps, 5], [1, steps, makePath([0]), 9]].map(parts => [makeFrame(0, steps), stamped(parts)]);
    for (const trace of [...laidOut, holed]) {
      expect(await answerIn(await hostHanding(trace), '1 | answered !| get [~(type) /index] | eq [::trace/ElementKindNotTakenError 1]')).toBe(true);
    }
  });

  it('the refusal of a trace a host hands names the trace it refused, whatever the subject of its step', async () => {
    expect(await answerIn(await hostHanding(5), '7 | answered !| get [~(type) /actualValue] | eq [::trace/PayloadKindNotTakenError 5]')).toBe(true);
  });
});

// ── formOf ────────────────────────────────────────────────

describe('formOf for error values', () => {
  it('answers "error" for an error value', () => {
    const errorVal = makeErrorValue(makeTag('Error'), new Map());
    expect(formOf(errorVal)).toBe('error');
  });
});

// ── the one order ───────────────────────────────────────────────────

describe('the one order ranks a failure raised after every value, by its tag and then its facts', () => {
  it('ties two failures of one tag and one set of facts', () => {
    const tag = makeTag('Oops');
    const errorVal1 = makeErrorValue(tag, new Map([['index', 1]]));
    const errorVal2 = makeErrorValue(tag, new Map([['index', 1]]));
    expect(compareValues(errorVal1, errorVal2)).toBe(0);
  });

  it('ranks two failures by their tags, then by their facts', () => {
    const facts = new Map([['index', 1]]);
    expect(compareValues(makeErrorValue(makeTag('Bar'), facts), makeErrorValue(makeTag('Foo'), facts))).toBe(-1);
    expect(compareValues(makeErrorValue(makeTag('Foo'), new Map([['index', 2]])), makeErrorValue(makeTag('Foo'), facts))).toBe(1);
  });

  it('ranks a failure raised after its error at rest, a value under its tag and every value', async () => {
    const raised = await evalQuery('::Foo!{:a 1} | raise');
    for (const value of [null, 42, keyword('oops'), new Map([['a', 1]])]) expect(compareValues(raised, value)).toBe(1);
    for (const query of ['::Foo!{:a 1} | raise !| it', '::Foo{:a 1}', '!{:a 1}', '1 | desc']) expect(compareValues(raised, await evalQuery(query))).toBe(1);
    expect(compareValues(await evalQuery('!{:a 1} | raise'), await evalQuery('!{:a 1} | raise !| it'))).toBe(1);
  });
});

// ── the literal ─────────────────────────────────────────────────

describe('the literal reads back error values and values under a tag', () => {
  // `printValue` writes the literal the parser reads, so every value
  // the host builds survives the trip; each kind of payload exercises a
  // distinct branch of the printer.
  it('reads back an error value raised, and a tag over each kind of payload', async () => {
    const errorVal = makeErrorValue(makeTag('Oops'), new Map([['message', 'something went wrong']]));
    const restoredError = await evalQuery(`${printValue(errorVal)} | raise`);
    expect(isErrorValue(restoredError)).toBe(true);
    expect(restoredError.tag.name).toBe('Oops');
    expect(restoredError.facts.get('message')).toBe('something went wrong');
    const hostBuilt = [
      makeTagged(makeTag('Box'), [1, 2, 3]),
      makeTagged(makeTag('Keys'), makeSet([keyword('b'), keyword('a')])),
      makeTagged(makeTag('User'), new Map([['name', 'alice']])),
      makeTagged(makeTag('Count'), 42)
    ];
    for (const value of hostBuilt) {
      expect(compareValues(await evalQuery(printValue(value)), value) === 0).toBe(true);
    }
  });
});

describe('the one order tells an Array, a Map and a Set under a tag from one under none', () => {
  // Collections that hold their tag on themselves, of one content under
  // another tag or none, are not equal.
  it('rejects tagged Array vs untagged Array with same elements', () => {
    const tagged = makeTagged(makeTag('A'), [1, 2, 3]);
    expect(compareValues(tagged, [1, 2, 3]) === 0).toBe(false);
  });

  it('rejects tagged Map vs untagged Map with same entries', () => {
    const tagged = makeTagged(makeTag('U'), new Map([['k', 1]]));
    expect(compareValues(tagged, new Map([['k', 1]])) === 0).toBe(false);
  });

  it('rejects a tag over a set vs the set of the same elements', () => {
    const tagged = makeTagged(makeTag('S'), makeSet([1, 2]));
    expect(compareValues(tagged, makeSet([1, 2])) === 0).toBe(false);
  });
});

// ── errorFromQlang ──────────────────────────────────────────────

// A refusal no page of the catalog declares facts for: the facts it
// carries are those every refusal shares under `::error`.
const TestsProbeTypeError = declareRefusal('tests/ProbeTypeError');

describe('errorFromQlang', () => {
  // The facts of the site come in the order the catalog declares them,
  // its label's first and those of `::error` after, and the trace last
  // [QSERR#site].
  it('converts a refusal — its address the tag, its facts in the order the catalog declares them [QSERR#site]', async () => {
    const typeErr = new TestsProbeTypeError({ actualValue: 'the-value' });
    const errorVal = errorFromQlang(typeErr, 'the-subject', await langRuntime());
    expect(isErrorValue(errorVal)).toBe(true);
    const desc = errorVal.facts;
    expect(errorVal.tag).toEqual(makeTag('tests/ProbeTypeError'));
    expect(desc.get('actualValue')).toBe('the-value');
    expect(desc.get('actualType')).toEqual(makeTag('string'));
    expect([...desc.keys()]).toEqual(['actualType', 'actualValue']);
  });

  it('converts CallUnknownNameError with the facts its label declares', async () => {
    const unresolvedErr = new CallUnknownNameError({ addresses: makeSet([]), name: keyword('myName') });
    const errorVal = errorFromQlang(unresolvedErr, 42, await langRuntime());
    expect(errorVal.tag).toEqual(makeTag('call/UnknownNameError'));
    expect([...errorVal.facts.keys()]).toEqual(['name', 'addresses']);
  });

  it('refuses a fact neither the label nor ::error declares, a defect of the runtime', async () => {
    const scope = await langRuntime();
    expect(() => errorFromQlang(new TestsProbeTypeError({ undeclared: 1 }), 42, scope)).toThrow(/carries :undeclared/);
  });

  it('converts a refusal whose site hands no facts to an error of no facts [QSERR#rest]', async () => {
    const errorVal = errorFromQlang(new TestsProbeTypeError(), 10, await langRuntime());
    expect(errorVal.tag).toEqual(makeTag('tests/ProbeTypeError'));
    expect([...errorVal.facts.keys()]).toEqual([]);
  });
});

// ── errorFromForeign ────────────────────────────────────────────

describe('errorFromForeign', () => {
  // A host's failure carries the facts every host can give, its account
  // and the accounts of the failures beneath it [QSHST#answer], [QSERR#site].
  it('lifts a JavaScript error to its account under the tag of the language', async () => {
    const jsErr = new Error('something went wrong');
    const errorVal = errorFromForeign(jsErr, await langRuntime());
    expect(isErrorValue(errorVal)).toBe(true);
    expect(errorVal.tag).toEqual(makeTag('call/HostFailureError'));
    expect([...errorVal.facts.keys()]).toEqual(['message']);
    expect(errorVal.facts.get('message')).toBe('something went wrong');
    expect(errorVal.originalError).toBe(jsErr);
  });

  it('leaves the stack, the class and the fields of the host error with the host', async () => {
    class AppError extends Error {
      constructor() {
        super('app error');
        this.name = 'AppError';
        this.status = 404;
        this.code = 'NOT_FOUND';
      }
    }
    const errorVal = errorFromForeign(new AppError(), await langRuntime());
    expect([...errorVal.facts.keys()]).toEqual(['message']);
    expect(errorVal.originalError.code).toBe('NOT_FOUND');
  });

  it('recounts the accounts of the failures beneath it, outermost first', async () => {
    const top = new Error('top error', { cause: new Error('intermediate', { cause: 'root cause' }) });
    const errorVal = errorFromForeign(top, await langRuntime());
    expect(errorVal.facts.get('causes')).toEqual(['intermediate', 'root cause']);
  });

  it('recounts eight failures beneath it at most', async () => {
    let current = new Error('leaf');
    for (let i = 0; i < 12; i++) current = new Error(`level-${i}`, { cause: current });
    expect(errorFromForeign(current, await langRuntime()).facts.get('causes')).toHaveLength(8);
  });

  it('gives no causes where none stands beneath it', async () => {
    const scope = await langRuntime();
    expect(errorFromForeign(new Error('no cause'), scope).facts.has('causes')).toBe(false);
    expect(errorFromForeign(new Error('a null cause', { cause: null }), scope).facts.has('causes')).toBe(false);
  });

  it('takes a thrown value that is no error by its text', async () => {
    expect(errorFromForeign('a bare string', await langRuntime()).facts.get('message')).toBe('a bare string');
  });
});

describe('error-convert coercion edge cases', () => {
  it('leaves out a fact its site hands as undefined', async () => {
    const typeErr = new TestsProbeTypeError({ index: undefined, actualValue: null });
    const errorVal = errorFromQlang(typeErr, 42, await langRuntime());
    expect(errorVal.facts.has('index')).toBe(false);
    expect(errorVal.facts.get('actualValue')).toBe(null);
    expect(errorVal.facts.get('actualType')).toEqual(makeTag('null'));
  });
});
