// Tests of `raise` and the `!|` fail-apply combinator, plus edge cases around
// trail accumulation, re-lift continuity, and verb invocation on the
// fail-track.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { keyword, makeTag } from '../../src/types.mjs';
import { QlangError } from '../../src/errors.mjs';
import { catchOriginalError } from '../helpers/error-assertions.mjs';

// ── raise ──────────────────────────────────────────────

describe('raise', () => {
  it('bare form wraps pipeValue Map', async () => {
    const evalResult = await evalQuery('{:kind :oops} | raise !| get /kind');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('bare form on non-Map produces RaiseSubjectNotMapError', async () => {
    const evalResult = await evalQuery('42 | raise !| type');
    expect(evalResult).toEqual(makeTag('map/raise/SubjectNotMapError'));
  });

  it('an error in the pipe rides past raise', async () => {
    const evalResult = await evalQuery('("not-a-number" | add 1) | raise !| type');
    expect(evalResult).toEqual(makeTag('number/add/SubjectNotNumberError'));
  });
});

// ── fail-apply deflect on non-error pipeValue ──────────────────

describe('fail-apply deflect on non-error', () => {
  it('null deflects through !|', async () => {
    const evalResult = await evalQuery('null !| get /kind');
    expect(evalResult).toBeNull();
  });

  it('Map deflects through !|', async () => {
    const evalResult = await evalQuery('{:a 1} !| get /kind');
    expect(evalResult instanceof Map).toBe(true);
    expect(evalResult.get('a')).toBe(1);
  });
});

// ── fail-track dispatch through containers ─────────────────────

describe('fail-track dispatch through ParenGroup and verb', () => {
  it('fail-apply fires into a ParenGroup step', async () => {
    const evalResult = await evalQuery('!{:kind :oops} | raise !| (get /kind)');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('a verb body first step sees exposed descriptor when called via !|', async () => {
    const evalResult = await evalQuery(':any/handler ~(get /kind) | !{:kind :oops} | raise !| handler');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('plain comment between a deflecting step and a fail-apply step stays out of the trail', async () => {
    // The last frame of the trail holds the steps the error skipped.
    // `evalPipeline` steps over plain comments on both tracks, so only
    // the step that calls a word (`count`) joins them [QSERR#rest].
    const evalResult = await evalQuery('!{:kind :oops} | raise |~| comment\n| count !| trail | last | skipped | parse');
    expect(evalResult).toBe('count');
  });

  it('the steps skipped past a plain comment replay through apply as the bare call after it', async () => {
    const evalResult = await evalQuery('!{:kind :oops} | raise |~| comment\n| count !| trail | last | skipped | :t it | 42 | apply t !| type');
    expect(evalResult).toEqual(makeTag('call/KindAnswersNoVerbError'));
  });
});


describe('source axis prints the declaration for rare body shapes', () => {
  it('renders bare Call (no args)', async () => {
    expect(await evalQuery('[1 2] | :x count | ::x | source | parse')).toBe(':x count');
  });

  it('a LinePlainComment inside a declaration body leaves no step', async () => {
    const evalResult = await evalQuery(':x (42 |~| note\n) | ::x | source | parse');
    expect(evalResult).toBe(':x (42)');
  });

  it('a block doc in the slot surfaces through the doc axis', async () => {
    const evalResult = await evalQuery(':x |~~ doc ~~| 42 | ::x | doc | content');
    expect(typeof evalResult).toBe('string');
    expect(evalResult).toContain('doc');
  });

  it('renders ErrorLit body', async () => {
    expect(await evalQuery('~(:x !{:a 1}) | parse')).toBe(':x !{:a 1}');
  });

  it('renders leading fail-apply prefix in a declaration body', async () => {
    // BindStep body is a single Primary, so a `!|` leading
    // Pipeline-step is wrapped in a ParenGroup at the source level,
    // and the group keeps its parentheses in print.
    expect(await evalQuery(':handler (!| get /kind) | ::handler | source | parse')).toBe(':handler (!| get /kind)');
  });
});

describe('json on errors at rest inside containers', () => {
  it('renders an error at rest as the value under its tags [QSERR#rest]', async () => {
    const evalResult = await evalQuery('get [11 ~("x" | add 10 !| it) 13] | json');
    expect(typeof evalResult).toBe('string');
    expect(evalResult).toContain('"$tag":"number/add/SubjectNotNumberError"');
  });
});

describe('per-site error classes carry unique identity', () => {
  // Each test catches a concrete error from a known source site and
  // asserts its class name and the facts the error value holds [QSERR#site].
  // The class name alone identifies the throw location, and tests
  // match on `e.name` (stable identifier) so they stay readable
  // without importing every per-site class.
  //
  // `catchOriginalError(query)` lives in
  // `../helpers/error-assertions.mjs` — runtime errors are error
  // values, the helper unwraps the underlying QlangError off
  // `.originalError` for structured (`.name`, `.facts.*`,
  // `instanceof QlangError`) inspection.

  it('count on a value no kind of which answers it is refused with the addresses of count [QSDSP#residence]', async () => {
    const caughtErr = await catchOriginalError('42 | count');
    expect(caughtErr).toBeInstanceOf(QlangError);
    expect(caughtErr.name).toBe('KindAnswersNoVerbError');
    expect(caughtErr.facts.addresses.map(address => address.name)).toEqual(['map/count', 'set/count', 'string/count', 'vec/count']);
  });

  it('keys on non-Map is refused under the address of keys [QSBLD#fn]', async () => {
    expect((await evalQuery('42 | keys')).tag.name).toBe('map/keys/SubjectNotMapError');
  });

  it('a subject of another kind is refused under the address of the word [QSBLD#fn]', async () => {
    const refused = await evalQuery('"x" | add 1');
    expect(refused.tag.name).toBe('number/add/SubjectNotNumberError');
    expect(refused.descriptor.get('actualType').name).toBe('string');
  });

  it('an input that breaks its invariant is refused under the address of the input [QSBLD#fn]', async () => {
    expect((await evalQuery('1 | add "x"')).tag.name).toBe('number/add/addend/KindNotTakenError');
  });

  it('each name refuses under its own address', async () => {
    const tags = await Promise.all(['"x" | sub 1', '"x" | mul 1', '"x" | div 1'].map(async query => (await evalQuery(query)).tag.name));
    expect(tags).toEqual(['number/sub/SubjectNotNumberError', 'number/mul/SubjectNotNumberError', 'number/div/SubjectNotNumberError']);
  });

  it('a prefix or a suffix of another kind is refused by the kinds of its input [QSBLD#fn]', async () => {
    expect((await evalQuery('"x" | prepend 42')).tag.name).toBe('string/prepend/prefix/KindNotTakenError');
    expect((await evalQuery('"x" | append 42')).tag.name).toBe('string/append/suffix/KindNotTakenError');
  });

  it('sum element non-number → VecSumElementNotNumberError, the element and its kind among the facts', async () => {
    const refused = await evalQuery('[1 "two" 3] | sum');
    expect(refused.originalError.address).toBe('vec/sum/ElementNotNumberError');
    expect(refused.descriptor.get('index')).toBe(1);
    expect(refused.descriptor.get('actualType').name).toBe('string');
    expect(refused.descriptor.get('actualValue')).toBe('two');
  });

  it('gt across kinds is refused by the kinds of its input, the kind it met among the facts [QSBLD#fn]', async () => {
    const refused = await evalQuery('"a" | gt 5');
    expect(refused.tag.name).toBe('string/gt/value/KindNotTakenError');
    expect(refused.descriptor.get('actualType').name).toBe('number');
  });

  it('a path on a value with no parts → PathSubjectHasNoPartsError', async () => {
    const refused = await evalQuery('42 | get /name');
    expect(refused.originalError.name).toBe('SubjectHasNoPartsError');
    expect(refused.descriptor.get('key').name).toBe('name');
    expect(refused.descriptor.get('actualType').name).toBe('number');
  });

  it('apply args to non-function → CallValueTakesNoModifiersError', async () => {
    // Freeze a raw value, not a verb. Its record holds a
    // non-function, so captured args trigger CallValueTakesNoModifiersError on
    // the value the record holds.
    const refused = await evalQuery('5 | :five it | five 42');
    expect(refused.originalError.name).toBe('ValueTakesNoModifiersError');
    expect(refused.descriptor.get('name').name).toBe('five');
    expect(refused.descriptor.get('actualType').name).toBe('number');
  });

  it('a key of a map of another kind is refused by the kinds of its input [QSBLD#fn]', async () => {
    const refused = await evalQuery('{:a 1} | has [42]');
    expect(refused.tag.name).toBe('map/has/key/KindNotTakenError');
    expect(refused.descriptor.get('actualType').name).toBe('vec');
  });

  it('payload on non-TaggedInstance is refused under the address of payload [QSBLD#fn]', async () => {
    expect((await evalQuery('42 | payload')).tag.name).toBe('tagged/payload/SubjectNotTaggedError');
  });

  it('a tag of a pair that is a keyword is refused by the primitive of tag', async () => {
    const refused = await evalQuery('[:foo 42] | tag');
    expect(refused.originalError).toBeInstanceOf(QlangError);
    expect(refused.originalError.name).toBe('PairTagNotTagError');
    expect(refused.descriptor.get('actualType').name).toBe('keyword');
  });

  it('a value and a tag one vector holds meet by a name that keeps the vector', async () => {
    // The subject of a call is the value in the pipe [QSNUM#combine], so the
    // pair is named before its value takes the tag it holds.
    const r = await evalQuery('[42 ::Box] | :pair it | get /0 | tag (pair | get /1) | type');
    expect(r).toEqual(makeTag('Box'));
  });

  it('raise takes the tag the map carries and keeps every entry a fact', async () => {
    // A `:kind` entry names no tag [QSERR#rest]: the tag is the map's own.
    const result = await evalQuery(':MyTag |~~ MyTag. ~~| | ::MyTag{:kind ::Other :detail "x"} | raise');
    expect(result.tag.name).toBe('MyTag');
    expect(result.descriptor.get('kind')).toEqual(makeTag('Other'));
    expect(result.descriptor.get('detail')).toBe('x');
  });

  it('payload strips header off every TaggedInstance shape', async () => {
    // Each shape exercises its own branch of `payload`: a tag
    // over a set stacks on it and answers the set, a set answers its
    // vector, and a tagged Map returns a fresh Map without header.
    // The tagged vector and the tag over an atom are covered above via
    // the tests of a tag over each kind of payload.
    const { isTaggedInstance, isQSet } = await import('../../src/types.mjs');
    const setResult = await evalQuery(':Tags |~~ Tags. ~~| | ::Tags#[:b :a] | payload');
    expect(isQSet(setResult)).toBe(true);
    const vecResult = await evalQuery('#[:b :a] | payload');
    expect(isTaggedInstance(vecResult)).toBe(false);
    expect(vecResult.map(k => k.name)).toEqual(['a', 'b']);
    const mapResult = await evalQuery(':User |~~ User. ~~| | ::User{:name "alice"} | payload');
    expect(mapResult instanceof Map).toBe(true);
    expect(isTaggedInstance(mapResult)).toBe(false);
    expect(mapResult.get('name')).toBe('alice');
  });

  it('a count that is no whole number breaks the law of the count of its word [QSERR#site]', async () => {
    expect((await evalQuery('[1 2 3] | take 1.5')).tag.name).toBe('vec/take/count/NotIntegerError');
    expect((await evalQuery('[1 2 3] | drop 1.5')).tag.name).toBe('vec/drop/count/NotIntegerError');
    expect((await evalQuery('"abc" | take 1.5')).tag.name).toBe('string/take/count/NotIntegerError');
  });


  it('a reducer of code runs on the pair, failing under the word it called [QSCOL#reduce]', async () => {
    const answer = await evalQuery('[1 2 3] | reduce 0 ~(add 1)');
    expect(answer.tag.name).toBe('number/add/SubjectNotNumberError');
  });

  it('every refusal of the runtime is one kind of error, its message its address [QSERR#site]', async () => {
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

  it('throw sites refuse under addresses of their own (no sharing)', async () => {
    const addresses = new Set();
    const queries = [
      '42 | count',        // call/KindAnswersNoVerbError, the contract of count
      '42 | keys',         // map/keys/SubjectNotMapError
      '42 | vals',         // map/vals/SubjectNotMapError
      '1 | get /name',         // path/SubjectHasNoPartsError (Number subject — neither Map nor Vec)
      '[1] | get /a',          // path/IndexNotIntegerError
      '[1 2 3] | reduce 0 1'   // vec/reduce/reducer/KindNotTakenError
    ];
    for (const q of queries) {
      addresses.add((await evalQuery(q)).tag.name);
    }
    expect(addresses.size).toBe(queries.length);
  });
});

describe('coalesce refuses a call with no alternatives by the law of its part', () => {
  it('coalesce with no args breaks the law of its alternatives, the args it was given among its facts [QSERR#site], [QSBLD#input]', async () => {
    const refused = await evalQuery('{} | coalesce');
    expect(refused.tag.name).toBe('any/coalesce/alternatives/EmptyError');
    expect(await evalQuery('{} | coalesce !| get /actualValue | eq ::any/coalesce[]')).toBe(true);
  });
});

