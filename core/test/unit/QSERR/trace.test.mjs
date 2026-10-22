import { describe, it, expect } from 'vitest';
import { keyword, isErrorValue, makeBinding, makeErrorValue, makeTag, makeFrame, makePath, makeQuote, makeTrace, stampTagHeader, TAG_HEADER_SYMBOL } from '../../../src/types.mjs';
import { parse } from '../../../src/parse.mjs';
import { langRuntime } from '../../../src/runtime/index.mjs';
import { createSession, evalQuery } from '../../../src/session.mjs';
import { boundAnswer } from '../../../src/runtime/print.mjs';
import { declareRefusal } from '../../../src/errors.mjs';

describe('an error value and the trace it is handed', () => {
  it('produces a frozen error under its tag that holds no :trace while no step raised it', () => {
    const tag = makeTag('Oops');
    const errorVal = makeErrorValue(tag, new Map([['message', 'boom']]));
    expect(isErrorValue(errorVal)).toBe(true);
    expect(Object.isFrozen(errorVal)).toBe(true);
    expect(errorVal.tag).toBe(tag);
    expect([...errorVal.facts.keys()]).toEqual(['message']);
  });

  it('keeps a trace it is handed as it is', () => {
    const trace = makeTrace([makeFrame('x', parse('add 1 | mul 2 | count'))]);
    const errorVal = makeErrorValue(makeTag('Oops'), new Map([['trace', trace]]));
    expect(errorVal.facts.get('trace')).toBe(trace);
  });
});

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

describe('a failure a host hands holds the :trace it writes as the kind of a trace takes it', () => {
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

it('the steps skipped past a comment run again by apply as the call after it', async () => {
  const evalResult = await evalQuery('!{:kind :oops} | raise |~| comment\n| count !| trace | last | skipped | :t it | 42 | apply t !| type');
  expect(evalResult).toEqual(makeTag('call/KindAnswersNoVerbError'));
});
