// Tests for the error operand and the `!|` fail-apply combinator, plus edge cases around trail accumulation, re-lift
// continuity, and verb invocation on the fail-track.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, keyword, makeTagKeyword } from '../../src/types.mjs';
import { createSession } from '../../src/session.mjs';
import { QlangError, QlangTypeError, ArityError } from '../../src/errors.mjs';
import { catchOriginalError } from '../helpers/error-assertions.mjs';

// ── error operand ──────────────────────────────────────────────

describe('error operand', () => {
  it('bare form wraps pipeValue Map', async () => {
    const evalResult = await evalQuery('{:kind :oops} | error !| /kind');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('bare form on non-Map produces ErrorDescriptorNotMapError', async () => {
    const evalResult = await evalQuery('42 | error !| type');
    expect(evalResult).toEqual(makeTagKeyword('ErrorDescriptorNotMapError'));
  });

  it('full form propagates a fail-track descriptor expression instead of wrapping it', async () => {
    const evalResult = await evalQuery('null | error ("not-a-number" | add 1) !| type');
    expect(evalResult).toEqual(makeTagKeyword('AddLeftNotNumberError'));
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

  it('distribute of add(10) over mixed elements produces per-element errors a fail-track predicate selects', async () => {
    const evalResult = await evalQuery('[1 "x" 3] * add 10 | filter ~(false !| true) | count');
    expect(evalResult).toBe(1);
  });

  it('plain comment between a deflecting step and a fail-apply step stays out of the trail', async () => {
    // /trail yields the quote of the deflected steps. `evalPipeline`
    // steps over plain comments on both tracks, so only the
    // operand-carrying step (`count`) deflects into the trail.
    const evalResult = await evalQuery('!{:kind :oops} |~| comment\n count !| /trail | parse');
    expect(evalResult).toBe('count');
  });

  it('a trail materialized past a plain comment replays through apply as the bare operand suffix', async () => {
    const evalResult = await evalQuery('!{:kind :oops} |~| comment\n count !| /trail | :t / | 42 | apply t !| type');
    expect(evalResult).toEqual(makeTagKeyword('CountSubjectNotContainerError'));
  });
});

// ── EffectLaunderingAtCallError ──────────────────────────────────────

describe('EffectLaunderingAtCallError', () => {
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
    expect(cellEntry.result.tag.name).toBe('EffectLaunderingAtCallError');
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

  it('attached BlockDocComment surfaces through the docs axis operand', async () => {
    const evalResult = await evalQuery('|~~ doc ~~| :x 42 | :x | docs | first | /content');
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
    // [1 "x" 3] * add(10) produces [11 error 13]; json renders the Vec
    const evalResult = await evalQuery('[1 "x" 3] * add 10 | json');
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

  it('count on non-container → CountSubjectNotContainerError', async () => {
    const caughtErr = await catchOriginalError('42 | count');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('CountSubjectNotContainerError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('keys on non-Map → KeysSubjectNotMapError', async () => {
    const caughtErr = await catchOriginalError('42 | keys');
    expect(caughtErr.name).toBe('KeysSubjectNotMapError');
  });

  it('add left non-number → AddLeftNotNumberError', async () => {
    const caughtErr = await catchOriginalError('"x" | add 1');
    expect(caughtErr.name).toBe('AddLeftNotNumberError');
    expect(caughtErr.context.actualType.name).toBe('string');
  });

  it('add right non-number → AddRightNotNumberError', async () => {
    const caughtErr = await catchOriginalError('1 | add "x"');
    expect(caughtErr.name).toBe('AddRightNotNumberError');
  });

  it('sub left non-number → SubLeftNotNumberError (distinct from add)', async () => {
    const caughtErr = await catchOriginalError('"x" | sub 1');
    expect(caughtErr.name).toBe('SubLeftNotNumberError');
  });

  it('mul left non-number → MulLeftNotNumberError', async () => {
    const caughtErr = await catchOriginalError('"x" | mul 1');
    expect(caughtErr.name).toBe('MulLeftNotNumberError');
  });

  it('div left non-number → DivLeftNotNumberError', async () => {
    const caughtErr = await catchOriginalError('"x" | div 1');
    expect(caughtErr.name).toBe('DivLeftNotNumberError');
  });

  it('prepend modifier non-string → PrependPrefixNotStringError', async () => {
    const caughtErr = await catchOriginalError('"x" | prepend 42');
    expect(caughtErr.name).toBe('PrependPrefixNotStringError');
  });

  it('append modifier non-string → AppendSuffixNotStringError', async () => {
    const caughtErr = await catchOriginalError('"x" | append 42');
    expect(caughtErr.name).toBe('AppendSuffixNotStringError');
  });

  it('sum element non-number → SumElementNotNumberError', async () => {
    const caughtErr = await catchOriginalError('[1 "two" 3] | sum');
    expect(caughtErr.name).toBe('SumElementNotNumberError');
    expect(caughtErr.context.index).toBe(1);
    expect(caughtErr.context.actualType.name).toBe('string');
  });

  it('gt across kinds → the refusal of the head, by the kind of its slot [D65], [D72]', async () => {
    const caughtErr = await catchOriginalError('"a" | gt 5');
    expect(caughtErr.name).toBe('StringPayloadNotStringError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('projection on non-Map → ProjectionSubjectNotProjectableError', async () => {
    const caughtErr = await catchOriginalError('42 | /name');
    expect(caughtErr.name).toBe('ProjectionSubjectNotProjectableError');
    expect(caughtErr.context.key).toBe('name');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('distribute on a scalar → DistributeSubjectNotSequenceError', async () => {
    const caughtErr = await catchOriginalError('42 * add 1');
    expect(caughtErr.name).toBe('DistributeSubjectNotSequenceError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('apply args to non-function → ApplyToNonFunctionError', async () => {
    // Freeze a raw value, not a verb. Its record holds a
    // non-function, so captured args trigger ApplyToNonFunctionError on
    // the value the record holds.
    const caughtErr = await catchOriginalError('5 | :five / | five 42');
    expect(caughtErr.name).toBe('ApplyToNonFunctionError');
    expect(caughtErr.context.name).toBe('five');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('use on non-Map → UseSubjectNotMapError', async () => {
    const caughtErr = await catchOriginalError('42 | use');
    expect(caughtErr.name).toBe('UseSubjectNotMapError');
  });

  it('filter on non-container → FilterSubjectNotContainerError', async () => {
    const caughtErr = await catchOriginalError('42 | filter ~(gt 1)');
    expect(caughtErr.name).toBe('FilterSubjectNotContainerError');
  });

  it('at on non-Vec-or-Map → AtSubjectNotSequenceOrMapError', async () => {
    const caughtErr = await catchOriginalError('42 | at 0');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('AtSubjectNotSequenceOrMapError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('at with non-keyword-and-non-string key on Map → AtKeyNotKeywordOrStringError', async () => {
    const caughtErr = await catchOriginalError('{:a 1} | at 42');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('AtKeyNotKeywordOrStringError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('has with non-keyword-and-non-string key on Map → HasKeyNotKeywordOrStringError', async () => {
    const caughtErr = await catchOriginalError('{:a 1} | has 42');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('HasKeyNotKeywordOrStringError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('keyword on non-String-or-Keyword → KeywordSubjectNotStringOrKeywordError', async () => {
    const caughtErr = await catchOriginalError('42 | keyword');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('KeywordSubjectNotStringOrKeywordError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('payload on non-TaggedInstance → PayloadSubjectNotTaggedInstanceError', async () => {
    const caughtErr = await catchOriginalError('42 | payload');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('PayloadSubjectNotTaggedInstanceError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('tag with non-TagKeyword captured-arg → TagModifierNotTagKeywordError', async () => {
    const caughtErr = await catchOriginalError('42 | tag :foo');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('TagModifierNotTagKeywordError');
    expect(caughtErr.context.actualType.name).toBe('keyword');
  });

  it('tag full-application rebuilds a TaggedInstance from a [value, tagKeyword] context Vec', async () => {
    // The split/assemble round-trip can ride a positional Vec
    // by reordering with full-app captured args — useful when
    // the surface produced split-then-swapped pairs:
    // `[value, tag] | tag(/0, /1)` mints the same instance as
    // `value | tag(tag)`.
    const r = await evalQuery('[42 ::Box] | tag /0 /1 | type');
    expect(r).toEqual(makeTagKeyword('Box'));
  });

  it('error operand lifts `:kind ::TagKeyword` field onto the JS-header tag', async () => {
    // When the source Map carries no JS-header tag but has a
    // `:kind ::Foo` TagKeyword entry, the operand lifts it onto
    // the resulting error's `tag` slot and drops the field from
    // the descriptor — the same identity invariant the
    // `evalErrorLit` literal path enforces.
    const result = await evalQuery('::MyTag {} | {:kind ::MyTag :detail "x"} | error');
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
    const setResult = await evalQuery('::Tags {} | ::Tags#[:b :a] | payload');
    expect(isQSet(setResult)).toBe(true);
    const vecResult = await evalQuery('#[:b :a] | payload');
    expect(isTaggedInstance(vecResult)).toBe(false);
    expect(vecResult.map(k => k.name)).toEqual(['a', 'b']);
    const mapResult = await evalQuery('::User {} | ::User{:name "alice"} | payload');
    expect(mapResult instanceof Map).toBe(true);
    expect(isTaggedInstance(mapResult)).toBe(false);
    expect(mapResult.get('name')).toBe('alice');
  });

  it('take count non-integer → TakeCountNotIntegerError', async () => {
    const caughtErr = await catchOriginalError('[1 2 3] | take "x"');
    expect(caughtErr.name).toBe('TakeCountNotIntegerError');
  });

  it('drop count non-integer → DropCountNotIntegerError (distinct from take)', async () => {
    const caughtErr = await catchOriginalError('[1 2 3] | drop "x"');
    expect(caughtErr.name).toBe('DropCountNotIntegerError');
  });

  it('reduce on non-sequence → ReduceSubjectNotSequenceError', async () => {
    const caughtErr = await catchOriginalError('42 | reduce 0 ~(add)');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('ReduceSubjectNotSequenceError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('reduce with a non-binary reducer → ReduceReducerNotBinaryError (distinct from subject site)', async () => {
    const caughtErr = await catchOriginalError('[1 2 3] | reduce 0 ~(42)');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('ReduceReducerNotBinaryError');
  });

  it('all per-site type errors inherit QlangTypeError and kind', async () => {
    const queries = [
      '42 | count',
      '"x" | add 1',
      '[1 "two"] | sum',
      '"a" | gt 5',
      '42 | /name',
      '42 * add 1',
      '5 | :five / | five 42',
      '42 | use',
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

  it('throw sites produce distinct class names (no sharing)', async () => {
    const names = new Set();
    const queries = [
      '42 | count',        // CountSubjectNotContainerError
      '42 | first',        // FirstSubjectNotSequenceError
      '42 | last',         // LastSubjectNotSequenceError
      '42 | sum',          // SumSubjectNotContainerError
      '42 | reverse',      // ReverseSubjectNotSequenceError
      '42 | distinct',     // DistinctSubjectNotSequenceError
      '42 | sort',         // SortNaturalSubjectNotSequenceError
      '42 | keys',         // KeysSubjectNotMapError
      '42 | vals',         // ValsSubjectNotMapError
      '"a" | add 1',      // AddLeftNotNumberError
      '"a" | sub 1',      // SubLeftNotNumberError
      '"a" | mul 1',      // MulLeftNotNumberError
      '"a" | div 1',      // DivLeftNotNumberError
      '1 | /name',         // ProjectionSubjectNotProjectableError (Number subject — neither Map nor Vec)
      '42 * add 1',       // DistributeSubjectNotSequenceError
      '42 | reduce 0 ~(add)',   // ReduceSubjectNotSequenceError
      '[1 2 3] | reduce 0 ~(42)' // ReduceReducerNotBinaryError
    ];
    for (const q of queries) {
      names.add((await catchOriginalError(q)).name);
    }
    // Every query produces a distinct class — the whole point of
    // the refactor is that no two sites share an exception type.
    expect(names.size).toBe(queries.length);
  });
});

describe('coalesce arityError sites carry unique per-site identity', () => {
  it('coalesce with zero captured args raises CoalesceNoAlternativesError as an ArityError', async () => {
    const caughtErr = await catchOriginalError('{} | coalesce');
    expect(caughtErr).toBeInstanceOf(ArityError);
    expect(caughtErr.kind).toBe('arityError');
    expect(caughtErr.name).toBe('CoalesceNoAlternativesError');
  });
});

