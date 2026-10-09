// Tests for effect-marker enforcement. A verb declared under a clean
// name is refused inside `evalBindStep` at eval-time when its body
// calls an effectful name, which findFirstEffectfulIdentifier finds
// over the verb's body; the parse-time AST decoration
// (classifyEffect on OperandCall and Projection nodes) marks the
// names it reads.

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import { evalQuery } from '../../src/eval.mjs';
import {
  BindEffectMarkMissingError,
  QlangError
} from '../../src/errors.mjs';
import {
  decorateAstWithEffectMarkers,
  findFirstEffectfulIdentifier
} from '../../src/effect-check.mjs';
import { classifyEffect, EFFECT_MARKER_PREFIX } from '../../src/effect.mjs';
import { createSession } from '../../src/session.mjs';
import { isErrorValue } from '../../src/types.mjs';
import { catchOriginalError } from '../helpers/error-assertions.mjs';

describe('effect.mjs classifyEffect', () => {
  it('returns true for an @-prefixed name', () => {
    expect(classifyEffect('@callers')).toBe(true);
  });

  it('returns false for a clean name', () => {
    expect(classifyEffect('count')).toBe(false);
  });

  it('returns false for a non-string input', () => {
    expect(classifyEffect(null)).toBe(false);
    expect(classifyEffect(undefined)).toBe(false);
    expect(classifyEffect(42)).toBe(false);
  });

  it('returns false for the empty string', () => {
    expect(classifyEffect('')).toBe(false);
  });

  it('exposes the marker prefix as a constant', () => {
    expect(EFFECT_MARKER_PREFIX).toBe('@');
  });
});

describe('decorateAstWithEffectMarkers — boolean field stamping', () => {
  it('OperandCall with @-prefix gets effectful=true', () => {
    const ast = parse('@callers');
    expect(ast.type).toBe('OperandCall');
    expect(ast.effectful).toBe(true);
  });

  it('OperandCall with clean name gets effectful=false', () => {
    const ast = parse('count');
    expect(ast.type).toBe('OperandCall');
    expect(ast.effectful).toBe(false);
  });

  it('a call by address carries the marker of the verb it names', () => {
    expect(parse('any/@out').effectful).toBe(true);
    expect(parse('vec/count').effectful).toBe(false);
  });

  it('Projection with at least one @-prefixed segment gets effectful=true', () => {
    const ast = parse('/scope/@callers');
    expect(ast.type).toBe('Projection');
    expect(ast.effectful).toBe(true);
  });

  it('Projection with all clean segments gets effectful=false', () => {
    const ast = parse('/a/b/c');
    expect(ast.type).toBe('Projection');
    expect(ast.effectful).toBe(false);
  });

  it('decorateAstWithEffectMarkers returns the same root reference', () => {
    const ast = parse('count');
    expect(decorateAstWithEffectMarkers(ast)).toBe(ast);
  });
});

describe('findFirstEffectfulIdentifier', () => {
  it('returns null for an effect-clean body', () => {
    const ast = parse('mul 2');
    expect(findFirstEffectfulIdentifier(ast)).toBeNull();
  });

  it('returns the @-prefixed OperandCall name', () => {
    const ast = parse('@callers');
    expect(findFirstEffectfulIdentifier(ast)).toBe('@callers');
  });

  it('reaches into nested OperandCall arguments', () => {
    const ast = parse('filter ~(@callers | count)');
    expect(findFirstEffectfulIdentifier(ast)).toBe('@callers');
  });

  it('reaches into Vec literal elements', () => {
    const ast = parse('[1 @callers 3]');
    expect(findFirstEffectfulIdentifier(ast)).toBe('@callers');
  });

  it('reports the @-prefixed Projection segment', () => {
    const ast = parse('env | /@callers');
    expect(findFirstEffectfulIdentifier(ast)).toBe('@callers');
  });

  it('reports the @-prefixed segment in a multi-key Projection', () => {
    const ast = parse('env | /scope/@callers');
    expect(findFirstEffectfulIdentifier(ast)).toBe('@callers');
  });
});

describe('eval-time effect validation in evalBindStep', () => {
  // BindEffectMarkMissingError produces an error value
  // (5th type). `catchOriginalError` (shared helper) unwraps the
  // originating JS-side QlangError off the ErrorValue for the
  // `instanceof BindEffectMarkMissingError` checks below.

  it('rejects an effectful body under a clean name', async () => {
    const effectErr = await catchOriginalError(':any/foo ~(@callers)');
    expect(effectErr).toBeInstanceOf(BindEffectMarkMissingError);
  });

  it('accepts a quote literal whose steps name an effect — the quote is data', async () => {
    const accepted = await evalQuery(':any/holdsCode ~([~(@callers) /x]) | 1');
    expect(accepted).toBe(1);
  });

  it('rejects nested effectful body', async () => {
    const effectErr = await catchOriginalError(':any/foo ~(filter ~(@callers | count))');
    expect(effectErr).toBeInstanceOf(BindEffectMarkMissingError);
  });

  it('rejects projection-laundering', async () => {
    const effectErr = await catchOriginalError(':any/bad ~(env | /@callers)');
    expect(effectErr).toBeInstanceOf(BindEffectMarkMissingError);
  });

  it('accepts an effectful body under a name with the mark', async () => {
    // @callers resolves to unresolvedIdentifier in langRuntime (no host plugin),
    // but the let itself should NOT produce an effectLaundering error.
    const effectErr = await catchOriginalError(':any/@impl ~(@callers)');
    expect(effectErr).not.toBeInstanceOf(BindEffectMarkMissingError);
  });

  it('accepts a pure body under a name with the mark', async () => {
    const effectErr = await catchOriginalError(':any/@safe ~(count)');
    expect(effectErr).not.toBeInstanceOf(BindEffectMarkMissingError);
  });

  it('accepts a pure body under a clean name', async () => {
    const evalResult = await evalQuery(':any/foo ~(count)');
    expect(isErrorValue(evalResult)).toBe(false);
  });

  it('rejects transitive aliasing through a clean name', async () => {
    const effectErr = await catchOriginalError(':any/@a ~(count) | :any/b ~(@a)');
    expect(effectErr).toBeInstanceOf(BindEffectMarkMissingError);
  });

  it('error carries the offending binding name and effectful identifier', async () => {
    const effectErr = await catchOriginalError(':any/foo ~(@callers)');
    expect(effectErr).toBeInstanceOf(BindEffectMarkMissingError);
    expect(effectErr.context.name.name).toBe('any/foo');
    expect(effectErr.context.calls.name).toBe('@callers');
  });

  it('error has a stable per-site name', async () => {
    const effectErr = await catchOriginalError(':any/foo ~(@callers)');
    expect(effectErr.name).toBe('EffectMarkMissingError');
  });

  it('the thrown error is a refusal of bind, not a ParseError', async () => {
    const effectErr = await catchOriginalError(':any/foo ~(@callers)');
    expect(effectErr).toBeInstanceOf(BindEffectMarkMissingError);
    expect(effectErr).toBeInstanceOf(QlangError);
    expect(effectErr.address).toBe('bind/EffectMarkMissingError');
  });

  it('a freeze of an expression result is exempt', async () => {
    // `:result /` names the value the pipe holds, not a function.
    const evalResult = await evalQuery('[1 2 3] | :result / | result | count');
    expect(isErrorValue(evalResult)).toBe(false);
  });

  it('rejects BindStep inside a ParenGroup with effectful body', async () => {
    const effectErr = await catchOriginalError('1 | (:any/bad ~(@callers) | bad)');
    expect(effectErr).toBeInstanceOf(BindEffectMarkMissingError);
  });

});

describe('a pure call runs clean', () => {

  it('does NOT fire on a normal pure function lookup', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('[1 2 3] | count');
    expect(cellEntry.error).toBeNull();
  });
});
