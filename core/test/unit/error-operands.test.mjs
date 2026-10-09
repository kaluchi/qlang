// Tests for the error operand and the `!|` fail-apply combinator, plus edge cases around trail accumulation, re-lift
// continuity, and verb invocation on the fail-track.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, keyword, makeTagKeyword } from '../../src/types.mjs';
import { createSession } from '../../src/session.mjs';
import { QlangError, QlangTypeError, ArityError } from '../../src/errors.mjs';
import { catchOriginalError } from '../helpers/error-assertions.mjs';

// ── raise operand ──────────────────────────────────────────────

describe('raise operand', () => {
  it('bare form wraps pipeValue Map', async () => {
    const evalResult = await evalQuery('{:kind :oops} | raise !| /kind');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('bare form on non-Map produces RaiseSubjectNotMapError', async () => {
    const evalResult = await evalQuery('42 | raise !| type');
    expect(evalResult).toEqual(makeTagKeyword('map/raise/SubjectNotMapError'));
  });

  it('an error in the pipe rides past raise', async () => {
    const evalResult = await evalQuery('("not-a-number" | add 1) | raise !| type');
    expect(evalResult).toEqual(makeTagKeyword('number/add/SubjectNotNumberError'));
  });
});

// ── fail-apply deflect on non-error pipeValue ──────────────────

describe('fail-apply deflect on non-error', () => {
  it('null deflects through !|', async () => {
    const evalResult = await evalQuery('null !| /kind');
    expect(evalResult).toBeNull();
  });

  it('Map deflects through !|', async () => {
    const evalResult = await evalQuery('{:a 1} !| /kind');
    expect(evalResult instanceof Map).toBe(true);
    expect(evalResult.get('a')).toBe(1);
  });
});

// ── fail-track dispatch through containers ─────────────────────

describe('fail-track dispatch through ParenGroup and verb', () => {
  it('fail-apply fires into a ParenGroup step', async () => {
    const evalResult = await evalQuery('!{:kind :oops} !| (/kind)');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('a verb body first step sees exposed descriptor when called via !|', async () => {
    const evalResult = await evalQuery(':handler ::verb~(/kind) | !{:kind :oops} !| handler');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('distribute of add(10) over mixed elements answers the first failure [D103]', async () => {
    const evalResult = await evalQuery('[1 "x" 3] * add 10 !| type');
    expect(evalResult).toEqual(makeTagKeyword('number/add/SubjectNotNumberError'));
  });

  it('plain comment between a deflecting step and a fail-apply step stays out of the trail', async () => {
    // The last stop of the trail holds the steps the error skipped.
    // `evalPipeline` steps over plain comments on both tracks, so only
    // the operand-carrying step (`count`) joins them [D85].
    const evalResult = await evalQuery('!{:kind :oops} |~| comment\n count !| /trail/-1/skipped | parse');
    expect(evalResult).toBe('count');
  });

  it('the steps skipped past a plain comment replay through apply as the bare operand suffix', async () => {
    const evalResult = await evalQuery('!{:kind :oops} |~| comment\n count !| /trail/-1/skipped | :t / | 42 | apply t !| type');
    expect(evalResult).toEqual(makeTagKeyword('call/KindAnswersNoVerbError'));
  });
});

// ── CallEffectMarkMissingError ──────────────────────────────────────

describe('CallEffectMarkMissingError', () => {
  it('calling non-@-prefixed name resolving to an effectful verb produces error', async () => {
    // Install a verb whose body calls an @-prefixed name under a
    // non-@-prefixed name via session.bind. This simulates the
    // laundering path (via use, as, or session injection) that the
    // declaration cannot see.
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':@myCount ::verb~(@callers | count)');
    const effectfulVerb = sessionInstance.env.get('@myCount');
    sessionInstance.bind('doIt', effectfulVerb);
    const cellEntry = await sessionInstance.evalCell('[1 2 3] | doIt');
    expect(isErrorValue(cellEntry.result)).toBe(true);
    expect(cellEntry.result.tag.name).toBe('call/EffectMarkMissingError');
  });
});

describe('source axis prints the declaration for rare body shapes', () => {
  it('renders bare OperandCall (no args)', async () => {
    expect(await evalQuery(':x count | :x | source | parse')).toBe(':x count');
  });

  it('a LinePlainComment inside a declaration body leaves no step', async () => {
    const evalResult = await evalQuery(':x (42 |~| note\n) | :x | source | parse');
    expect(evalResult).toBe(':x (42)');
  });

  it('a block doc in the slot surfaces through the docs axis operand', async () => {
    const evalResult = await evalQuery(':x |~~ doc ~~| 42 | :x | doc | content');
    expect(typeof evalResult).toBe('string');
    expect(evalResult).toContain('doc');
  });

  it('renders ErrorLit body', async () => {
    expect(await evalQuery(':x !{:a 1} | :x | source | parse')).toBe(':x !{:a 1}');
  });

  it('renders leading fail-apply prefix in a declaration body', async () => {
    // BindStep body is a single Primary, so a `!|` leading
    // Pipeline-step is wrapped in a ParenGroup at the source level,
    // and the group keeps its parentheses in print.
    expect(await evalQuery(':handler (!| /kind) | :handler | source | parse')).toBe(':handler (!| /kind)');
  });
});

describe('json operand on error values inside containers', () => {
  it('renders error value as $error wrapper when inside Vec', async () => {
    // A literal holds the error a word answers [D87]; json renders the Vec
    const evalResult = await evalQuery('[11 ("x" | add 10) 13] | json');
    expect(typeof evalResult).toBe('string');
    expect(evalResult).toContain('$error');
  });
});

describe('per-site error classes carry unique identity', () => {
  // Each test catches a concrete error from a known source site
  // and asserts its unique class name + structured context. The
  // class name alone identifies the throw location, and tests
  // match on `e.name` (stable identifier) so they stay readable
  // without importing every per-site class.
  //
  // `catchOriginalError(query)` lives in
  // `../helpers/error-assertions.mjs` — runtime errors are error
  // values, the helper unwraps the underlying QlangError off
  // `.originalError` for structured (`.name`, `.context.*`,
  // `instanceof QlangTypeError`) inspection.

  it('count on a non-container reaches its contract, which names the residences [D72]', async () => {
    const caughtErr = await catchOriginalError('42 | count');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('KindAnswersNoVerbError');
    expect(caughtErr.context.addresses.map(address => address.name)).toEqual(['map/count', 'set/count', 'string/count', 'vec/count']);
  });

  it('keys on non-Map is refused under the address of keys [D166]', async () => {
    expect((await evalQuery('42 | keys')).tag.name).toBe('map/keys/SubjectNotMapError');
  });

  it('a subject of another kind is refused under the address of the name [D166]', async () => {
    const refused = await evalQuery('"x" | add 1');
    expect(refused.tag.name).toBe('number/add/SubjectNotNumberError');
    expect(refused.descriptor.get('actualType').name).toBe('string');
  });

  it('a part that breaks its law is refused under the address of the part [D166]', async () => {
    expect((await evalQuery('1 | add "x"')).tag.name).toBe('number/add/addend/HoldsNotMetError');
  });

  it('each name refuses under its own address', async () => {
    const tags = await Promise.all(['"x" | sub 1', '"x" | mul 1', '"x" | div 1'].map(async query => (await evalQuery(query)).tag.name));
    expect(tags).toEqual(['number/sub/SubjectNotNumberError', 'number/mul/SubjectNotNumberError', 'number/div/SubjectNotNumberError']);
  });

  it('a prefix or a suffix of another kind is refused by the law of its part [D166]', async () => {
    expect((await evalQuery('"x" | prepend 42')).tag.name).toBe('string/prepend/prefix/HoldsNotMetError');
    expect((await evalQuery('"x" | append 42')).tag.name).toBe('string/append/suffix/HoldsNotMetError');
  });

  it('sum element non-number → AnySumElementNotNumberError', async () => {
    const caughtErr = await catchOriginalError('[1 "two" 3] | sum');
    expect(caughtErr.name).toBe('SumElementNotNumberError');
    expect(caughtErr.context.index).toBe(1);
    expect(caughtErr.context.actualType.name).toBe('string');
  });

  it('gt across kinds is refused by the law of its part, the kind it met among the facts [D166]', async () => {
    const refused = await evalQuery('"a" | gt 5');
    expect(refused.tag.name).toBe('string/gt/than/HoldsNotMetError');
    expect(refused.descriptor.get('actualType').name).toBe('number');
  });

  it('projection on non-Map → ProjSubjectNotProjectableError', async () => {
    const caughtErr = await catchOriginalError('42 | /name');
    expect(caughtErr.name).toBe('SubjectNotProjectableError');
    expect(caughtErr.context.key).toBe('name');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('distribute on a scalar → EachSubjectNotContainerError', async () => {
    const caughtErr = await catchOriginalError('42 * add 1');
    expect(caughtErr.name).toBe('SubjectNotContainerError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('apply args to non-function → CallValueTakesNoModifiersError', async () => {
    // Freeze a raw value, not a verb. Its record holds a
    // non-function, so captured args trigger CallValueTakesNoModifiersError on
    // the value the record holds.
    const caughtErr = await catchOriginalError('5 | :five / | five 42');
    expect(caughtErr.name).toBe('ValueTakesNoModifiersError');
    expect(caughtErr.context.name).toBe('five');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('a key of a map of another kind is refused by the law of its part [D166]', async () => {
    for (const [query, address] of [['{:a 1} | at 42', 'map/at/key/HoldsNotMetError'], ['{:a 1} | has 42', 'map/has/key/HoldsNotMetError']]) {
      const refused = await evalQuery(query);
      expect(refused.tag.name).toBe(address);
      expect(refused.descriptor.get('actualType').name).toBe('number');
    }
  });

  it('payload on non-TaggedInstance is refused under the address of payload [D166]', async () => {
    expect((await evalQuery('42 | payload')).tag.name).toBe('tagged/payload/SubjectNotTaggedError');
  });

  it('a tag of a pair that is a keyword is refused by the primitive of tag', async () => {
    const caughtErr = await catchOriginalError('[:foo 42] | tag');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('PairTagNotTagError');
    expect(caughtErr.context.actualType.name).toBe('keyword');
  });

  it('a value and a tag one vector holds meet by a name that keeps the vector', async () => {
    // The subject of a call is the value in the pipe [D165], so the
    // pair is named before its value takes the tag it holds.
    const r = await evalQuery('[42 ::Box] | :pair / | /0 | tag (pair | /1) | type');
    expect(r).toEqual(makeTagKeyword('Box'));
  });

  it('error operand lifts `:kind ::TagKeyword` field onto the JS-header tag', async () => {
    // When the source Map carries no JS-header tag but has a
    // `:kind ::Foo` TagKeyword entry, the operand lifts it onto
    // the resulting error's `tag` slot and drops the field from
    // the descriptor — the same identity invariant the
    // `evalErrorLit` literal path enforces.
    const result = await evalQuery(':MyTag ::spec~() | {:kind ::MyTag :detail "x"} | raise');
    expect(result.tag.name).toBe('MyTag');
    expect(result.descriptor.has('kind')).toBe(false);
    expect(result.descriptor.get('detail')).toBe('x');
  });

  it('payload strips header off every TaggedInstance shape', async () => {
    // Each shape exercises its own `payload` operand branch: a tag
    // over a set stacks on it and answers the set, a set answers its
    // vector, and a tagged Map returns a fresh Map without header.
    // The tagged Vec / wrap-scalar branches are covered above via
    // the per-shape identity-overlay tests.
    const { isTaggedInstance, isQSet } = await import('../../src/types.mjs');
    const setResult = await evalQuery(':Tags ::spec~() | ::Tags#[:b :a] | payload');
    expect(isQSet(setResult)).toBe(true);
    const vecResult = await evalQuery('#[:b :a] | payload');
    expect(isTaggedInstance(vecResult)).toBe(false);
    expect(vecResult.map(k => k.name)).toEqual(['a', 'b']);
    const mapResult = await evalQuery(':User ::spec~() | ::User{:name "alice"} | payload');
    expect(mapResult instanceof Map).toBe(true);
    expect(isTaggedInstance(mapResult)).toBe(false);
    expect(mapResult.get('name')).toBe('alice');
  });

  it('take count non-integer → AnyTakeCountNotIntegerError', async () => {
    const caughtErr = await catchOriginalError('[1 2 3] | take 1.5');
    expect(caughtErr.name).toBe('TakeCountNotIntegerError');
  });

  it('drop count non-integer → AnyDropCountNotIntegerError (distinct from take)', async () => {
    const caughtErr = await catchOriginalError('[1 2 3] | drop 1.5');
    expect(caughtErr.name).toBe('DropCountNotIntegerError');
  });


  it('reduce with a non-binary reducer → AnyReduceReducerNotBinaryError (distinct from subject site)', async () => {
    const caughtErr = await catchOriginalError('[1 2 3] | reduce 0 ~(42)');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('ReduceReducerNotBinaryError');
  });

  it('all per-site type errors inherit QlangTypeError and kind', async () => {
    const queries = [
      '42 | count',
      '[1 "two"] | sum',
      '42 | /name',
      '42 * add 1',
      '5 | :five / | five 42',
      '42 | reduce 0 ~(add)',
      '[1 2 3] | reduce 0 ~(42)'
    ];
    for (const q of queries) {
      const caughtErr = await catchOriginalError(q);
      expect(caughtErr).toBeInstanceOf(QlangTypeError);
      expect(caughtErr).toBeInstanceOf(QlangError);
      expect(caughtErr.kind).toBe('typeError');
    }
  });

  it('throw sites refuse under addresses of their own (no sharing)', async () => {
    const addresses = new Set();
    const queries = [
      '42 | count',        // call/KindAnswersNoVerbError, the contract of count
      '42 | keys',         // map/keys/SubjectNotMapError
      '42 | vals',         // map/vals/SubjectNotMapError
      '1 | /name',         // proj/SubjectNotProjectableError (Number subject — neither Map nor Vec)
      '42 * add 1',       // each/SubjectNotContainerError
      '[1 2 3] | reduce 0 ~(42)' // any/ReduceReducerNotBinaryError
    ];
    for (const q of queries) {
      addresses.add((await evalQuery(q)).tag.name);
    }
    expect(addresses.size).toBe(queries.length);
  });
});

describe('coalesce arityError sites carry unique per-site identity', () => {
  it('coalesce with zero captured args raises AnyCoalesceNoAlternativesError as an ArityError', async () => {
    const caughtErr = await catchOriginalError('{} | coalesce');
    expect(caughtErr).toBeInstanceOf(ArityError);
    expect(caughtErr.kind).toBe('arityError');
    expect(caughtErr.name).toBe('CoalesceNoAlternativesError');
  });
});

