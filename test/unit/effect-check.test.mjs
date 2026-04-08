// Tests for src/effect-check.mjs (parse-time AST decoration and
// validation) and src/eval.mjs::evalOperandCall (call-site safety
// net). Together they enforce the @-effect-marker invariant: a let
// whose body references an effectful identifier must itself be
// @-prefixed, and any function value resolved through a clean
// identifier must not be effectful.

import { describe, it, expect } from 'vitest';
import { parse, ParseError } from '../../src/parse.mjs';
import { evalQuery } from '../../src/eval.mjs';
import {
  EffectLaunderingError,
  EffectLaunderingAtLetParse,
  EffectLaunderingAtCall,
  QlangError
} from '../../src/errors.mjs';
import {
  decorateAstWithEffectMarkers,
  findFirstEffectfulIdentifier,
  validateEffectMarkers
} from '../../src/effect-check.mjs';
import { classifyEffect, EFFECT_MARKER_PREFIX } from '../../src/effect.mjs';
import { createSession } from '../../src/session.mjs';
import { makeFn } from '../../src/rule10.mjs';

// Helper: a fake effectful function value to seed an env so the
// runtime laundering tests have something to actually invoke. The
// real @-prefixed operands are provided by the host plugin and not
// shipped in langRuntime.
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
    const ast = parse('let @impl = @callers').body;
    expect(ast.type).toBe('OperandCall');
    expect(ast.effectful).toBe(true);
  });

  it('OperandCall with clean name gets effectful=false', () => {
    const ast = parse('count');
    expect(ast.type).toBe('OperandCall');
    expect(ast.effectful).toBe(false);
  });

  it('LetStep with @-prefix gets effectful=true', () => {
    const ast = parse('let @impl = count');
    expect(ast.effectful).toBe(true);
  });

  it('LetStep with clean name gets effectful=false', () => {
    const ast = parse('let foo = count');
    expect(ast.effectful).toBe(false);
  });

  it('AsStep with @-prefix gets effectful=true', () => {
    const ast = parse('as @captured');
    expect(ast.effectful).toBe(true);
  });

  it('AsStep with clean name gets effectful=false', () => {
    const ast = parse('as snap');
    expect(ast.effectful).toBe(false);
  });

  it('Projection with at least one @-prefixed segment gets effectful=true', () => {
    const ast = parse('let @x = (env | /scope/@callers)').body;
    // body is a ParenGroup containing a Pipeline
    expect(ast.type).toBe('ParenGroup');
    const proj = ast.pipeline.steps[1].step;
    expect(proj.type).toBe('Projection');
    expect(proj.effectful).toBe(true);
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
    const root = parse('let @x = @callers');
    expect(findFirstEffectfulIdentifier(root.body)).toBe('@callers');
  });

  it('reaches into nested OperandCall arguments', () => {
    const root = parse('let @x = filter(@callers | count)');
    expect(findFirstEffectfulIdentifier(root.body)).toBe('@callers');
  });

  it('reaches into Vec literal elements', () => {
    const root = parse('let @x = [1 @callers 3]');
    expect(findFirstEffectfulIdentifier(root.body)).toBe('@callers');
  });

  it('reports the @-prefixed Projection segment of an env-projection', () => {
    const root = parse('let @x = (env | /@callers)');
    expect(findFirstEffectfulIdentifier(root.body)).toBe('@callers');
  });

  it('reports the @-prefixed segment in a multi-key Projection', () => {
    const root = parse('let @x = (env | /scope/@callers)');
    expect(findFirstEffectfulIdentifier(root.body)).toBe('@callers');
  });
});

describe('validateEffectMarkers — parse-time enforcement', () => {
  it('rejects let foo = @callers (direct effectful body, clean name)', () => {
    expect(() => parse('let foo = @callers')).toThrow(EffectLaunderingAtLetParse);
  });

  it('rejects nested let foo = filter(@callers | count)', () => {
    expect(() => parse('let foo = filter(@callers | count)')).toThrow(EffectLaunderingAtLetParse);
  });

  it('rejects projection-laundering let bad = (env | /@callers)', () => {
    expect(() => parse('let bad = (env | /@callers)')).toThrow(EffectLaunderingAtLetParse);
  });

  it('rejects deeply nested let bad = (env | /scope/@callers)', () => {
    expect(() => parse('let bad = (env | /scope/@callers)')).toThrow(EffectLaunderingAtLetParse);
  });

  it('accepts let @impl = @callers (effectful body, @-prefixed name)', () => {
    expect(() => parse('let @impl = @callers')).not.toThrow();
  });

  it('accepts let @safe = count (over-approximation harmless)', () => {
    expect(() => parse('let @safe = count')).not.toThrow();
  });

  it('accepts let foo = count (pure body, clean name)', () => {
    expect(() => parse('let foo = count')).not.toThrow();
  });

  it('rejects transitive aliasing through a clean name', () => {
    const source = 'let @a = count\n| let b = @a';
    expect(() => parse(source)).toThrow(EffectLaunderingAtLetParse);
  });

  it('error carries the offending binding name and effectful identifier', () => {
    let thrown;
    try { parse('let foo = @callers'); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(EffectLaunderingAtLetParse);
    expect(thrown.context.letName).toBe('foo');
    expect(thrown.context.effectfulName).toBe('@callers');
  });

  it('error carries source location of the offending let', () => {
    let thrown;
    try { parse('let foo = @callers'); } catch (e) { thrown = e; }
    expect(thrown.location).not.toBeNull();
    expect(thrown.location.start.offset).toBe(0);
  });

  it('error has stable fingerprint for Sentry grouping', () => {
    let thrown;
    try { parse('let foo = @callers'); } catch (e) { thrown = e; }
    expect(thrown.fingerprint).toBe('EffectLaunderingAtLetParse');
  });

  it('the thrown error is a QlangError, not a ParseError', () => {
    let thrown;
    try { parse('let foo = @callers'); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(EffectLaunderingError);
    expect(thrown).toBeInstanceOf(QlangError);
    expect(thrown).not.toBeInstanceOf(ParseError);
    expect(thrown.kind).toBe('effect-laundering');
  });

  it('as binding on an effectful expression result is exempt at parse time', () => {
    // `as` captures the call result of @callers, not the function
    // value itself. The effect already fired; the snapshot is pure
    // data. Exempt from the parse-time invariant.
    expect(() => parse('@callers | as result')).not.toThrow();
  });

  it('rejects nested let inside a ParenGroup with effectful body', () => {
    expect(() => parse('1 | (let bad = @callers | bad)')).toThrow(EffectLaunderingAtLetParse);
  });

  it('validateEffectMarkers returns the AST unchanged on success', () => {
    const ast = parse('let foo = count');
    expect(validateEffectMarkers(ast)).toBe(ast);
  });
});

describe('runtime call-site safety net (evalOperandCall)', () => {
  // The parse-time check cannot see laundering through env-projection
  // followed by `use`-rebinding under a clean name, because the
  // resulting AST mentions only the clean name. The runtime safety
  // net in eval.mjs::evalOperandCall checks every function-value
  // resolution: an effectful function looked up through a clean
  // name throws EffectLaunderingAtCall.

  it('catches Map → use → let foo = helper laundering', () => {
    const session = createSession();
    session.bind('@callers', fakeEffectfulOperand('@callers'));
    const cell = session.evalCell(
      '{:helper (env | /@callers)} | use | let foo = helper | foo'
    );
    expect(cell.error).not.toBeNull();
    expect(cell.error).toBeInstanceOf(EffectLaunderingAtCall);
    expect(cell.error.context.bindingName).toBe('helper');
    expect(cell.error.context.effectfulName).toBe('@callers');
  });

  it('error has stable fingerprint for Sentry grouping', () => {
    const session = createSession();
    session.bind('@callers', fakeEffectfulOperand('@callers'));
    const cell = session.evalCell(
      '{:helper (env | /@callers)} | use | let foo = helper | foo'
    );
    expect(cell.error.fingerprint).toBe('EffectLaunderingAtCall');
  });

  it('catches as snapshot of a function value bound to a clean name', () => {
    const session = createSession();
    session.bind('@callers', fakeEffectfulOperand('@callers'));
    // (env | /@callers) returns the function value (top-level, no
    // let, so parse-time validator does not check it). `as snap`
    // captures the function value (not a call result, because we
    // never invoked it). `snap` looks it up under a clean name —
    // call-site safety net fires.
    const cell = session.evalCell(
      '(env | /@callers) | as snap | snap'
    );
    expect(cell.error).toBeInstanceOf(EffectLaunderingAtCall);
    expect(cell.error.context.bindingName).toBe('snap');
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
    // Looking up `count` resolves to the pure builtin; no laundering.
    const cell = createSession().evalCell('[1 2 3] | count');
    expect(cell.error).toBeNull();
  });
});

describe('function and thunk effectful field', () => {
  it('makeFn(@name, ...) sets effectful=true on the function value', () => {
    const fn = makeFn('@callers', 1, (s) => s, { captured: [0, 0] });
    expect(fn.effectful).toBe(true);
  });

  it('makeFn(cleanName, ...) sets effectful=false on the function value', () => {
    const fn = makeFn('count', 1, (s) => s, { captured: [0, 0] });
    expect(fn.effectful).toBe(false);
  });

  it('thunk created from let @name has effectful=true', () => {
    const session = createSession();
    session.evalCell('let @x = count');
    const thunk = session.env.get(Object.freeze({ type: 'keyword', name: '@x' }))
      ?? Array.from(session.env).find(([k]) => k.name === '@x')?.[1];
    expect(thunk).toBeDefined();
    expect(thunk.effectful).toBe(true);
  });

  it('thunk created from let cleanName has effectful=false', () => {
    const session = createSession();
    session.evalCell('let foo = count');
    const thunk = Array.from(session.env).find(([k]) => k.name === 'foo')?.[1];
    expect(thunk).toBeDefined();
    expect(thunk.effectful).toBe(false);
  });
});
