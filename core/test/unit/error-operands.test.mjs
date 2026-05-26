// Tests for error operand, isError operand, and the `!|` fail-apply
// combinator, plus edge cases around trail accumulation, re-lift
// continuity, and conduit invocation on the fail-track.

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
});

// ── isError operand ─────────────────────────────────────────────

describe('isError operand', () => {
  it('with captured args produces arity error', async () => {
    const evalResult = await evalQuery('42 | isError(1) !| type | spec | /category');
    expect(evalResult).toEqual(keyword('arityError'));
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

describe('fail-track dispatch through ParenGroup and conduit', () => {
  it('fail-apply fires into a ParenGroup step', async () => {
    const evalResult = await evalQuery('!{:kind :oops} !| (/kind)');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('conduit body first step sees exposed descriptor when called via !|', async () => {
    const evalResult = await evalQuery(':handler /kind | !{:kind :oops} !| handler');
    expect(evalResult).toEqual(keyword('oops'));
  });

  it('distribute of add(10) over mixed elements produces per-element errors filterable by isError', async () => {
    const evalResult = await evalQuery('[1 "x" 3] * add(10) | filter(isError) | count');
    expect(evalResult).toBe(1);
  });

  it('plain comment between a deflecting step and a fail-apply step lands on the trail', async () => {
    // /trail yields a Quote-value carrying the joined
    // pipeline-suffix source. Plain comments participate as
    // identity pipeline steps and therefore DO land on the trail
    // when the pipeline deflects past them — the assertion here is
    // that the operand-carrying step (`count`) appears in the trail
    // source. Quote.source carries both fragments verbatim through
    // /source.
    const evalResult = await evalQuery('!{:kind :oops} |~| comment\n count !| /trail | /source');
    expect(typeof evalResult).toBe('string');
    expect(evalResult).toContain('count');
  });
});

// ── EffectLaunderingAtCallError ──────────────────────────────────────

describe('EffectLaunderingAtCallError', () => {
  it('calling non-@-prefixed name resolving to effectful conduit produces error', async () => {
    // Install an @-prefixed conduit under a non-@-prefixed name via session.bind.
    // This simulates the laundering path (via use, as, or session injection)
    // that the parse-time AST check cannot detect.
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':@myCount count');
    const effectfulConduit = sessionInstance.env.get('@myCount');
    sessionInstance.bind('doIt', effectfulConduit);
    const cellEntry = await sessionInstance.evalCell('[1 2 3] | doIt');
    expect(isErrorValue(cellEntry.result)).toBe(true);
    expect(cellEntry.result.tag.name).toBe('EffectLaunderingAtCallError');
  });
});

describe('source axis surfaces verbatim BindStep slice for rare body shapes', () => {
  it('renders bare OperandCall (no args)', async () => {
    expect(await evalQuery(':x count | :x | source | /source')).toBe(':x count');
  });

  it('renders LinePlainComment inside conduit body', async () => {
    const evalResult = await evalQuery(':x (42 |~| note\n) | :x | source | /source');
    expect(evalResult).toContain('|~|');
  });

  it('attached BlockDocComment surfaces through the docs axis operand', async () => {
    const evalResult = await evalQuery('|~~ doc ~~| :x 42 | :x | docs | first | /content');
    expect(typeof evalResult).toBe('string');
    expect(evalResult).toContain('doc');
  });

  it('renders ErrorLit body', async () => {
    expect(await evalQuery(':x [] !{:a 1} | :x | source | /source')).toContain('!{:a 1}');
  });

  it('renders leading fail-apply prefix in conduit body', async () => {
    // BindStep body is a single Primary, so a `!|` leading
    // Pipeline-step is wrapped in a ParenGroup at the source level.
    // The source axis reflects the verbatim BindStep text, parens
    // and all.
    expect(await evalQuery(':handler (!| /kind) | :handler | source | /source')).toBe(':handler (!| /kind)');
  });
});

describe('json operand on error values inside containers', () => {
  it('renders error value as $error wrapper when inside Vec', async () => {
    // [1 "x" 3] * add(10) produces [11 error 13]; json renders the Vec
    const evalResult = await evalQuery('[1 "x" 3] * add(10) | json');
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
    const caughtErr = await catchOriginalError('"x" | add(1)');
    expect(caughtErr.name).toBe('AddLeftNotNumberError');
    expect(caughtErr.context.actualType.name).toBe('string');
  });

  it('add right non-number → AddRightNotNumberError', async () => {
    const caughtErr = await catchOriginalError('1 | add("x")');
    expect(caughtErr.name).toBe('AddRightNotNumberError');
  });

  it('sub left non-number → SubLeftNotNumberError (distinct from add)', async () => {
    const caughtErr = await catchOriginalError('"x" | sub(1)');
    expect(caughtErr.name).toBe('SubLeftNotNumberError');
  });

  it('mul left non-number → MulLeftNotNumberError', async () => {
    const caughtErr = await catchOriginalError('"x" | mul(1)');
    expect(caughtErr.name).toBe('MulLeftNotNumberError');
  });

  it('div left non-number → DivLeftNotNumberError', async () => {
    const caughtErr = await catchOriginalError('"x" | div(1)');
    expect(caughtErr.name).toBe('DivLeftNotNumberError');
  });

  it('prepend modifier non-string → PrependPrefixNotStringError', async () => {
    const caughtErr = await catchOriginalError('"x" | prepend(42)');
    expect(caughtErr.name).toBe('PrependPrefixNotStringError');
  });

  it('append modifier non-string → AppendSuffixNotStringError', async () => {
    const caughtErr = await catchOriginalError('"x" | append(42)');
    expect(caughtErr.name).toBe('AppendSuffixNotStringError');
  });

  it('sum element non-number → SumElementNotNumberError', async () => {
    const caughtErr = await catchOriginalError('[1 "two" 3] | sum');
    expect(caughtErr.name).toBe('SumElementNotNumberError');
    expect(caughtErr.context.index).toBe(1);
    expect(caughtErr.context.actualType.name).toBe('string');
  });

  it('gt across types → GtOperandsNotComparableError', async () => {
    const caughtErr = await catchOriginalError('"a" | gt(5)');
    expect(caughtErr.name).toBe('GtOperandsNotComparableError');
    expect(caughtErr.context.leftType.name).toBe('string');
    expect(caughtErr.context.rightType.name).toBe('number');
  });

  it('lt across types → LtOperandsNotComparableError (distinct class)', async () => {
    const caughtErr = await catchOriginalError('"a" | lt(5)');
    expect(caughtErr.name).toBe('LtOperandsNotComparableError');
  });

  it('projection on non-Map → ProjectionSubjectNotProjectableError', async () => {
    const caughtErr = await catchOriginalError('42 | /name');
    expect(caughtErr.name).toBe('ProjectionSubjectNotProjectableError');
    expect(caughtErr.context.key).toBe('name');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('distribute on non-Vec → DistributeSubjectNotVecError', async () => {
    const caughtErr = await catchOriginalError('{:a 1} * add(1)');
    expect(caughtErr.name).toBe('DistributeSubjectNotVecError');
    expect(caughtErr.context.actualType.name).toBe('map');
  });

  it('merge on non-Vec → MergeSubjectNotVecError (distinct from distribute)', async () => {
    const caughtErr = await catchOriginalError('42 >> count');
    expect(caughtErr.name).toBe('MergeSubjectNotVecError');
  });

  it('apply args to non-function → ApplyToNonFunctionError', async () => {
    // Use `as` to bind a raw value (snapshot), not a conduit.
    // Snapshot-unwrap produces a non-function, so captured args trigger
    // ApplyToNonFunctionError on the unwrapped value.
    const caughtErr = await catchOriginalError('5 | as(:five) | five(42)');
    expect(caughtErr.name).toBe('ApplyToNonFunctionError');
    expect(caughtErr.context.name).toBe('five');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('use on non-Map → UseSubjectNotMapError', async () => {
    const caughtErr = await catchOriginalError('42 | use');
    expect(caughtErr.name).toBe('UseSubjectNotMapError');
  });

  it('filter on non-container → FilterSubjectNotContainerError', async () => {
    const caughtErr = await catchOriginalError('42 | filter(gt(1))');
    expect(caughtErr.name).toBe('FilterSubjectNotContainerError');
  });

  it('at on non-Vec-or-Map → AtSubjectNotSequenceOrMapError', async () => {
    const caughtErr = await catchOriginalError('42 | at(0)');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('AtSubjectNotSequenceOrMapError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('at with non-keyword-and-non-string key on Map → AtKeyNotKeywordOrStringError', async () => {
    const caughtErr = await catchOriginalError('{:a 1} | at(42)');
    expect(caughtErr).toBeInstanceOf(QlangTypeError);
    expect(caughtErr.name).toBe('AtKeyNotKeywordOrStringError');
    expect(caughtErr.context.actualType.name).toBe('number');
  });

  it('has with non-keyword-and-non-string key on Map → HasKeyNotKeywordOrStringError', async () => {
    const caughtErr = await catchOriginalError('{:a 1} | has(42)');
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
    const caughtErr = await catchOriginalError('42 | tag(:foo)');
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
    const r = await evalQuery('[42 ::Box] | tag(/0, /1) | type');
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
    // Each shape exercises its own `payload` operand branch:
    // tagged Set returns a fresh Set without header, tagged Map
    // returns a fresh Map without header. The tagged Vec / wrap-
    // scalar branches are covered above via the per-shape
    // identity-overlay tests.
    const { isTaggedInstance } = await import('../../src/types.mjs');
    const setResult = await evalQuery('::Tags {} | ::Tags#[:a :b] | payload');
    expect(setResult instanceof Set).toBe(true);
    expect(isTaggedInstance(setResult)).toBe(false);
    const mapResult = await evalQuery('::User {} | ::User{:name "alice"} | payload');
    expect(mapResult instanceof Map).toBe(true);
    expect(isTaggedInstance(mapResult)).toBe(false);
    expect(mapResult.get('name')).toBe('alice');
  });

  it('take count non-number → TakeCountNotNumberError', async () => {
    const caughtErr = await catchOriginalError('[1 2 3] | take("x")');
    expect(caughtErr.name).toBe('TakeCountNotNumberError');
  });

  it('drop count non-number → DropCountNotNumberError (distinct from take)', async () => {
    const caughtErr = await catchOriginalError('[1 2 3] | drop("x")');
    expect(caughtErr.name).toBe('DropCountNotNumberError');
  });

  it('all per-site type errors inherit QlangTypeError and kind', async () => {
    const queries = [
      '42 | count',
      '"x" | add(1)',
      '[1 "two"] | sum',
      '"a" | gt(5)',
      '42 | /name',
      '{:a 1} * add(1)',
      '42 >> count',
      '5 | as(:five) | five(42)',
      '42 | use'
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
      '42 | sum',          // SumSubjectNotVecOrSetError
      '42 | reverse',      // ReverseSubjectNotSequenceError
      '42 | distinct',     // DistinctSubjectNotSequenceError
      '42 | sort',         // SortNaturalSubjectNotSequenceError
      '42 | keys',         // KeysSubjectNotMapError
      '42 | vals',         // ValsSubjectNotMapError
      '"a" | add(1)',      // AddLeftNotNumberError
      '"a" | sub(1)',      // SubLeftNotNumberError
      '"a" | mul(1)',      // MulLeftNotNumberError
      '"a" | div(1)',      // DivLeftNotNumberError
      '"a" | gt(5)',       // GtOperandsNotComparableError
      '"a" | lt(5)',       // LtOperandsNotComparableError
      '1 | /name',         // ProjectionSubjectNotProjectableError (Number subject — neither Map nor Vec)
      '{:a 1} * add(1)',   // DistributeSubjectNotVecError
      '42 >> count'        // MergeSubjectNotVecError
    ];
    for (const q of queries) {
      names.add((await catchOriginalError(q)).name);
    }
    // Every query produces a distinct class — the whole point of
    // the refactor is that no two sites share an exception type.
    expect(names.size).toBe(queries.length);
  });
});

describe('coalesce / firstTruthy arityError sites carry unique per-site identity', () => {
  it('coalesce with zero captured args raises CoalesceNoAlternativesError as an ArityError', async () => {
    const caughtErr = await catchOriginalError('{} | coalesce()');
    expect(caughtErr).toBeInstanceOf(ArityError);
    expect(caughtErr.kind).toBe('arityError');
    expect(caughtErr.name).toBe('CoalesceNoAlternativesError');
  });

  it('firstTruthy with zero captured args raises FirstTruthyNoAlternativesError as an ArityError', async () => {
    const caughtErr = await catchOriginalError('{} | firstTruthy()');
    expect(caughtErr).toBeInstanceOf(ArityError);
    expect(caughtErr.kind).toBe('arityError');
    expect(caughtErr.name).toBe('FirstTruthyNoAlternativesError');
  });
});

