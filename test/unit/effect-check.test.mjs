// Tests for effect-marker enforcement. With `let` promoted to a
// regular operand call, effect validation for conduit declarations
// lives inside the `let` operand impl at eval-time. The parse-time
// AST decoration (classifyEffect on OperandCall and Projection nodes)
// still runs, and findFirstEffectfulIdentifier is used by the `let`
// impl to reject effectful bodies under clean names.

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import { evalQuery } from '../../src/eval.mjs';
import {
  EffectLaunderingError,
  EffectLaunderingAtLetParse,
  EffectLaunderingAtCall,
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
    const ast = parse('mul(2)');
    expect(findFirstEffectfulIdentifier(ast)).toBeNull();
  });

  it('returns the @-prefixed OperandCall name', () => {
    const ast = parse('@callers');
    expect(findFirstEffectfulIdentifier(ast)).toBe('@callers');
  });

  it('reaches into nested OperandCall arguments', () => {
    const ast = parse('filter(@callers | count)');
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

describe('eval-time effect validation in let operand', () => {
  // EffectLaunderingAtLetParse produces an error value (5th type).
  // Use isErrorValue + .originalError to inspect.
  function getEffectError(query) {
    const result = evalQuery(query);
    return isErrorValue(result) ? result.originalError : null;
  }

  it('rejects let(:foo, @callers) — effectful body, clean name', () => {
    const e = getEffectError('let(:foo, @callers)');
    expect(e).toBeInstanceOf(EffectLaunderingAtLetParse);
  });

  it('rejects nested effectful body', () => {
    const e = getEffectError('let(:foo, filter(@callers | count))');
    expect(e).toBeInstanceOf(EffectLaunderingAtLetParse);
  });

  it('rejects projection-laundering', () => {
    const e = getEffectError('let(:bad, env | /@callers)');
    expect(e).toBeInstanceOf(EffectLaunderingAtLetParse);
  });

  it('accepts let(:@impl, @callers) — effectful body, @-prefixed name', () => {
    // @callers resolves to unresolved-identifier in langRuntime (no host plugin),
    // but the let itself should NOT produce an effect-laundering error.
    const e = getEffectError('let(:@impl, @callers)');
    expect(e).not.toBeInstanceOf(EffectLaunderingAtLetParse);
  });

  it('accepts let(:@safe, count) — over-approximation harmless', () => {
    const e = getEffectError('let(:@safe, count)');
    expect(e).not.toBeInstanceOf(EffectLaunderingAtLetParse);
  });

  it('accepts let(:foo, count) — pure body, clean name', () => {
    const result = evalQuery('let(:foo, count)');
    expect(isErrorValue(result)).toBe(false);
  });

  it('rejects transitive aliasing through a clean name', () => {
    const e = getEffectError('let(:@a, count) | let(:b, @a)');
    expect(e).toBeInstanceOf(EffectLaunderingAtLetParse);
  });

  it('error carries the offending binding name and effectful identifier', () => {
    const e = getEffectError('let(:foo, @callers)');
    expect(e).toBeInstanceOf(EffectLaunderingAtLetParse);
    expect(e.context.letName).toBe('foo');
    expect(e.context.effectfulName).toBe('@callers');
  });

  it('error has stable fingerprint for Sentry grouping', () => {
    const e = getEffectError('let(:foo, @callers)');
    expect(e.fingerprint).toBe('EffectLaunderingAtLetParse');
  });

  it('the thrown error is an EffectLaunderingError, not a ParseError', () => {
    const e = getEffectError('let(:foo, @callers)');
    expect(e).toBeInstanceOf(EffectLaunderingError);
    expect(e).toBeInstanceOf(QlangError);
    expect(e.kind).toBe('effect-laundering');
  });

  it('as binding on an effectful expression result is exempt', () => {
    // as(:result) captures the call result, not the function value.
    const result = evalQuery('[1 2 3] | as(:result) | result | count');
    expect(isErrorValue(result)).toBe(false);
  });

  it('rejects let inside a ParenGroup with effectful body', () => {
    const e = getEffectError('1 | (let(:bad, @callers) | bad)');
    expect(e).toBeInstanceOf(EffectLaunderingAtLetParse);
  });

});

describe('runtime call-site safety net (evalOperandCall)', () => {
  it('catches Map → use → clean-name laundering', () => {
    const session = createSession();
    session.bind('@callers', fakeEffectfulOperand('@callers'));
    const cell = session.evalCell(
      '{:helper (env | /@callers)} | use | let(:foo, helper) | foo'
    );
    // EffectLaunderingAtCall produces an error value.
    expect(isErrorValue(cell.result)).toBe(true);
    const e = cell.result.originalError;
    expect(e).toBeInstanceOf(EffectLaunderingAtCall);
    expect(e.context.bindingName).toBe('helper');
    expect(e.context.effectfulName).toBe('@callers');
  });

  it('catches as snapshot of a function value bound to a clean name', () => {
    const session = createSession();
    session.bind('@callers', fakeEffectfulOperand('@callers'));
    const cell = session.evalCell(
      '(env | /@callers) | as(:snap) | snap'
    );
    expect(isErrorValue(cell.result)).toBe(true);
    const e = cell.result.originalError;
    expect(e).toBeInstanceOf(EffectLaunderingAtCall);
    expect(e.context.bindingName).toBe('snap');
  });

  it('does NOT fire when looking up the @-name directly', () => {
    const session = createSession();
    session.bind('@callers', fakeEffectfulOperand('@callers'));
    const cell = session.evalCell('@callers');
    expect(cell.error).toBeNull();
  });

  it('does NOT fire when the laundered binding name is also @-prefixed', () => {
    const session = createSession();
    session.bind('@callers', fakeEffectfulOperand('@callers'));
    const cell = session.evalCell(
      '{:@helper (env | /@callers)} | use | @helper'
    );
    expect(cell.error).toBeNull();
  });

  it('does NOT fire on a normal pure function lookup', () => {
    const cell = createSession().evalCell('[1 2 3] | count');
    expect(cell.error).toBeNull();
  });
});

describe('function and conduit effectful field', () => {
  it('makeFn(@name, ...) sets effectful=true on the function value', () => {
    const fn = makeFn('@callers', 1, (s) => s, { captured: [0, 0] });
    expect(fn.effectful).toBe(true);
  });

  it('makeFn(cleanName, ...) sets effectful=false on the function value', () => {
    const fn = makeFn('count', 1, (s) => s, { captured: [0, 0] });
    expect(fn.effectful).toBe(false);
  });

  it('conduit created from let(:@name, ...) has effectful=true', () => {
    const session = createSession();
    session.evalCell('let(:@x, count)');
    const conduit = Array.from(session.env).find(([k]) => k.name === '@x')?.[1];
    expect(conduit).toBeDefined();
    expect(conduit.effectful).toBe(true);
  });

  it('conduit created from let(:cleanName, ...) has effectful=false', () => {
    const session = createSession();
    session.evalCell('let(:foo, count)');
    const conduit = Array.from(session.env).find(([k]) => k.name === 'foo')?.[1];
    expect(conduit).toBeDefined();
    expect(conduit.effectful).toBe(false);
  });
});
