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
  EffectLaunderingError,
  EffectLaunderingAtBindStepParseError,
  EffectLaunderingAtCallError,
  QlangError
} from '../../src/errors.mjs';
import {
  decorateAstWithEffectMarkers,
  findFirstEffectfulIdentifier
} from '../../src/effect-check.mjs';
import { classifyEffect, EFFECT_MARKER_PREFIX } from '../../src/effect.mjs';
import { createSession } from '../../src/session.mjs';
import { isErrorValue } from '../../src/types.mjs';
import { makeFn } from '../../src/rule10.mjs';
import { catchOriginalError } from '../helpers/error-assertions.mjs';

function fakeEffectfulOperand(name = '@callers') {
  return makeFn(name, 1, (state, _lambdas) => state, {
    category: 'effectful-host',
    subject: 'any',
    modifiers: [],
    returns: 'any',
    captured: [0, 0],
    docs: ['fake test double for an effectful host operand'],
    examples: [],
    throws: []
  });
}

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
  // EffectLaunderingAtBindStepParseError produces an error value
  // (5th type). `catchOriginalError` (shared helper) unwraps the
  // originating JS-side QlangError off the ErrorValue for the
  // `instanceof EffectLaunderingAtBindStepParseError` checks below.

  it('rejects :foo ::verb~(@callers) — effectful body, clean name', async () => {
    const effectErr = await catchOriginalError(':foo ::verb~(@callers)');
    expect(effectErr).toBeInstanceOf(EffectLaunderingAtBindStepParseError);
  });

  it('accepts a quote literal whose steps name an effect — the quote is data', async () => {
    const accepted = await evalQuery(':holdsCode ::verb~([~(@callers) /x]) | 1');
    expect(accepted).toBe(1);
  });

  it('rejects nested effectful body', async () => {
    const effectErr = await catchOriginalError(':foo ::verb~(filter ~(@callers | count))');
    expect(effectErr).toBeInstanceOf(EffectLaunderingAtBindStepParseError);
  });

  it('rejects projection-laundering', async () => {
    const effectErr = await catchOriginalError(':bad ::verb~(env | /@callers)');
    expect(effectErr).toBeInstanceOf(EffectLaunderingAtBindStepParseError);
  });

  it('accepts :@impl ::verb~(@callers) — effectful body, @-prefixed name', async () => {
    // @callers resolves to unresolvedIdentifier in langRuntime (no host plugin),
    // but the let itself should NOT produce an effectLaundering error.
    const effectErr = await catchOriginalError(':@impl ::verb~(@callers)');
    expect(effectErr).not.toBeInstanceOf(EffectLaunderingAtBindStepParseError);
  });

  it('accepts :@safe ::verb~(count) — over-approximation harmless', async () => {
    const effectErr = await catchOriginalError(':@safe ::verb~(count)');
    expect(effectErr).not.toBeInstanceOf(EffectLaunderingAtBindStepParseError);
  });

  it('accepts :foo ::verb~(count) — pure body, clean name', async () => {
    const evalResult = await evalQuery(':foo ::verb~(count)');
    expect(isErrorValue(evalResult)).toBe(false);
  });

  it('rejects transitive aliasing through a clean name', async () => {
    const effectErr = await catchOriginalError(':@a ::verb~(count) | :b ::verb~(@a)');
    expect(effectErr).toBeInstanceOf(EffectLaunderingAtBindStepParseError);
  });

  it('error carries the offending binding name and effectful identifier', async () => {
    const effectErr = await catchOriginalError(':foo ::verb~(@callers)');
    expect(effectErr).toBeInstanceOf(EffectLaunderingAtBindStepParseError);
    expect(effectErr.context.bindingName).toBe('foo');
    expect(effectErr.context.effectfulName).toBe('@callers');
  });

  it('error has a stable per-site name', async () => {
    const effectErr = await catchOriginalError(':foo ::verb~(@callers)');
    expect(effectErr.name).toBe('EffectLaunderingAtBindStepParseError');
  });

  it('the thrown error is an EffectLaunderingError, not a ParseError', async () => {
    const effectErr = await catchOriginalError(':foo ::verb~(@callers)');
    expect(effectErr).toBeInstanceOf(EffectLaunderingError);
    expect(effectErr).toBeInstanceOf(QlangError);
    expect(effectErr.kind).toBe('effectLaundering');
  });

  it('as binding on an effectful expression result is exempt', async () => {
    // as(:result) captures the call result, not the function value.
    const evalResult = await evalQuery('[1 2 3] | as :result | result | count');
    expect(isErrorValue(evalResult)).toBe(false);
  });

  it('rejects BindStep inside a ParenGroup with effectful body', async () => {
    const effectErr = await catchOriginalError('1 | (:bad ::verb~(@callers) | bad)');
    expect(effectErr).toBeInstanceOf(EffectLaunderingAtBindStepParseError);
  });

});

describe('runtime call-site safety net (evalOperandCall)', () => {
  it('catches Map → use → clean-name laundering', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('@callers', fakeEffectfulOperand('@callers'));
    const cellEntry = await sessionInstance.evalCell(
      '{:helper (env | /@callers)} | use | :foo ::verb~(helper) | foo'
    );
    // EffectLaunderingAtCallError produces an error value.
    expect(isErrorValue(cellEntry.result)).toBe(true);
    const originalErr = cellEntry.result.originalError;
    expect(originalErr).toBeInstanceOf(EffectLaunderingAtCallError);
    expect(originalErr.context.bindingName).toBe('helper');
    expect(originalErr.context.effectfulName).toBe('@callers');
  });

  it('catches as of a function value bound to a clean name', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('@callers', fakeEffectfulOperand('@callers'));
    const cellEntry = await sessionInstance.evalCell(
      '(env | /@callers | /value) | as :snap | snap'
    );
    expect(isErrorValue(cellEntry.result)).toBe(true);
    const originalErr = cellEntry.result.originalError;
    expect(originalErr).toBeInstanceOf(EffectLaunderingAtCallError);
    expect(originalErr.context.bindingName).toBe('snap');
  });

  it('does NOT fire when looking up the @-name directly', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('@callers', fakeEffectfulOperand('@callers'));
    const cellEntry = await sessionInstance.evalCell('@callers');
    expect(cellEntry.error).toBeNull();
  });

  it('does NOT fire when the laundered binding name is also @-prefixed', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('@callers', fakeEffectfulOperand('@callers'));
    const cellEntry = await sessionInstance.evalCell(
      '{:@helper (env | /@callers)} | use | @helper'
    );
    expect(cellEntry.error).toBeNull();
  });

  it('does NOT fire on a normal pure function lookup', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('[1 2 3] | count');
    expect(cellEntry.error).toBeNull();
  });
});

describe('function and verb effectful field', () => {
  it('makeFn(@name, ...) sets effectful=true on the function value', () => {
    const fn = makeFn('@callers', 1, (state) => state, { captured: [0, 0] });
    expect(fn.effectful).toBe(true);
  });

  it('makeFn(cleanName, ...) sets effectful=false on the function value', () => {
    const fn = makeFn('count', 1, (state) => state, { captured: [0, 0] });
    expect(fn.effectful).toBe(false);
  });

  it('a verb whose body calls an @-name names it as its effect', async () => {
    const { effectfulNameOfVerb } = await import('../../src/runtime/verb.mjs');
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':@x ::verb~(@callers | count)');
    expect(effectfulNameOfVerb(sessionInstance.env.get('@x').get('value'))).toBe('@callers');
  });

  it('a verb whose body calls clean names carries no effect', async () => {
    const { effectfulNameOfVerb } = await import('../../src/runtime/verb.mjs');
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':foo ::verb~(count)');
    expect(effectfulNameOfVerb(sessionInstance.env.get('foo').get('value'))).toBeNull();
  });
});
