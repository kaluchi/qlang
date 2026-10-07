// Tests for use() overload (module import).

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { makeTagKeyword } from '../../src/types.mjs';
import { moduleKey } from '../../src/env-keys.mjs';

// ── use(::module) ─────────────────────────────────────────────

describe('use(::module) imports bindings', () => {
  it('imports all exports from a module Map', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('myNs'), new Map([['hello', 42]]));
    const cellEntry = await sessionInstance.evalCell('use ::myNs | hello');
    expect(cellEntry.result).toBe(42);
  });
});

// ── use(Vec) ────────────────────────────────────────────────────

describe('use(Vec) imports in order', () => {
  it('imports from multiple modules in Vec order', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('ns1'), new Map([['a', 1]]));
    sessionInstance.bind(moduleKey('ns2'), new Map([['b', 2]]));
    const cellEntry = await sessionInstance.evalCell('use [::ns1 ::ns2] | [a b]');
    expect(cellEntry.result).toEqual([1, 2]);
  });
});

// ── use(Set) collision ──────────────────────────────────────────

describe('use(Set) detects collision', () => {
  it('throws UseModuleCollisionError when two modules export the same name', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('nsA'), new Map([['x', 1]]));
    sessionInstance.bind(moduleKey('nsB'), new Map([['x', 2]]));
    const cellEntry = await sessionInstance.evalCell('use #[::nsA ::nsB] !| type');
    expect(cellEntry.result).toEqual(makeTagKeyword('any/UseModuleCollisionError'));
  });
});

// ── use(::ns, filter) selective ─────────────────────────────────

describe('use(::ns, filter) selective import', () => {
  it('imports only the selected export', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('myNs'), new Map([['foo', 10], ['bar', 20]]));
    const cellEntry = await sessionInstance.evalCell('use ::myNs [:foo] | foo');
    expect(cellEntry.result).toBe(10);
  });

  it('rejects missing export → UseNameNotExportedError', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('myNs'), new Map([['foo', 10]]));
    const cellEntry = await sessionInstance.evalCell('use ::myNs [:missing] !| type');
    expect(cellEntry.result).toEqual(makeTagKeyword('any/UseNameNotExportedError'));
  });
});

// ── use(::missing) ───────────────────────────────────────────────

describe('use(::missing) → UseModuleNotFoundError', () => {
  it('produces UseModuleNotFoundError when module not in env', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('use ::missing !| type');
    expect(cellEntry.result).toEqual(makeTagKeyword('any/UseModuleNotFoundError'));
  });
});

// ── use(::name) where :name is an identifier-plane binding ──────
//
// A module is a header-less Map a host bound with no declaration
// behind it. An operand descriptor or a verb bound under the same
// bare name carries a JS-header tag, a value a step declared, a
// freeze among them, has a source, and a host-bound scalar carries no Map at
// all, so `use` walks past each of them to the locator and lands on
// UseModuleNotFoundError — a tagged Map's internal slots (`:impl`,
// `:envRef`) never spill into env.

describe('use(::name) walks past identifier-plane bindings under the bare name', () => {
  it('use(::count) walks past the ::builtin descriptor under the bare name and lands on UseModuleNotFoundError', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('use ::count !| type');
    expect(cellEntry.result).toEqual(makeTagKeyword('any/UseModuleNotFoundError'));
    const probeCell = await sessionInstance.evalCell('env | has :category');
    expect(probeCell.result).toBe(false);
  });

  it('use(::double) walks past the verb under the bare name and lands on UseModuleNotFoundError', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell(':double ::verb~(mul 2) | use ::double !| type');
    expect(cellEntry.result).toEqual(makeTagKeyword('any/UseModuleNotFoundError'));
    const probeCell = await sessionInstance.evalCell('env | has :envRef');
    expect(probeCell.result).toBe(false);
  });

  it('use(::cfg) walks past the freeze under the bare name and lands on UseModuleNotFoundError', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('{:a 1} | :cfg / | use ::cfg !| type');
    expect(cellEntry.result).toEqual(makeTagKeyword('any/UseModuleNotFoundError'));
  });

  it('use(::notMap) walks past a host-bound scalar under the bare name and lands on UseModuleNotFoundError', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('notMap', 42);
    const cellEntry = await sessionInstance.evalCell('use ::notMap !| type');
    expect(cellEntry.result).toEqual(makeTagKeyword('any/UseModuleNotFoundError'));
  });

});

// ── use(non-keyword) ────────────────────────────────────────────

describe('use(non-keyword) → the slot refuses it', () => {
  it('produces UseModuleNotTagError error for numeric argument', async () => {
    const evalResult = await evalQuery('use 42 !| type');
    expect(evalResult).toEqual(makeTagKeyword('verb/VerbSlotNotOfKindsError'));
  });
});

// ── use Vec with non-keyword element ────────────────────────────

describe('use Vec with non-keyword element → UseModuleElementNotTagError', () => {
  it('produces UseModuleElementNotTagError for non-keyword in Vec', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('ns1'), new Map([['a', 1]]));
    const cellEntry = await sessionInstance.evalCell('use [::ns1 42] !| type');
    expect(cellEntry.result).toEqual(makeTagKeyword('any/UseModuleElementNotTagError'));
  });
});

describe('use Set without collision succeeds', () => {
  it('imports from Set when no collisions', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('a'), new Map([['x', 10]]));
    sessionInstance.bind(moduleKey('b'), new Map([['y', 20]]));
    const cellEntry = await sessionInstance.evalCell('use #[::a ::b] | add x y');
    expect(cellEntry.result).toBe(30);
  });
});

describe('use arity-2 with non-keyword module', () => {
  it('produces UseModuleNotTagError', async () => {
    const evalResult = await evalQuery('use [::a] #[:x] !| type');
    expect(evalResult.name).toBe('any/UseModuleNotTagError');
  });
});

describe('use selective with Vec filter', () => {
  it('accepts Vec as selection filter', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('lib'), new Map([['x', 10], ['y', 20]]));
    const cellEntry = await sessionInstance.evalCell('use ::lib [:x] | x');
    expect(cellEntry.result).toBe(10);
  });
});

import { QlangTypeError } from '../../src/errors.mjs';

describe('per-site error triple-assertions', () => {
  it('UseModuleNotFoundError: name, instanceof, context', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('use ::nonexistent');
    const originalErr = cellEntry.result.originalError;
    expect(originalErr.name).toBe('UseModuleNotFoundError');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
    expect(originalErr.context.module.literal).toBe('::nonexistent');
  });

  it('UseModuleCollisionError: name, instanceof, context', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('a'), new Map([['x', 1]]));
    sessionInstance.bind(moduleKey('b'), new Map([['x', 2]]));
    const cellEntry = await sessionInstance.evalCell('use #[::a ::b]');
    const originalErr = cellEntry.result.originalError;
    expect(originalErr.name).toBe('UseModuleCollisionError');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
    expect(originalErr.context.collidingName).toBe('x');
  });

  it('UseNameNotExportedError: name, instanceof, context', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('lib'), new Map([['x', 1]]));
    const cellEntry = await sessionInstance.evalCell('use ::lib #[:z]');
    const originalErr = cellEntry.result.originalError;
    expect(originalErr.name).toBe('UseNameNotExportedError');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
    expect(originalErr.context.module).toBe('::lib');
    expect(originalErr.context.exportName).toBe('z');
  });

  it('UseModuleElementNotTagError: name, instanceof, context', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('ns'), new Map([['x', 1]]));
    const cellEntry = await sessionInstance.evalCell('use [::ns 42]');
    const originalErr = cellEntry.result.originalError;
    expect(originalErr.name).toBe('UseModuleElementNotTagError');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
  });

  it('UseModuleNotTagError: name, instanceof, context', async () => {
    const evalResult = await evalQuery('use [::a] #[:x]');
    const originalErr = evalResult.originalError;
    expect(originalErr.name).toBe('UseModuleNotTagError');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
  });

  it('RaiseSubjectNotMapError: name, instanceof', async () => {
    const evalResult = await evalQuery('42 | raise');
    const originalErr = evalResult.originalError;
    expect(originalErr.name).toBe('RaiseSubjectNotMapError');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
  });
});

describe('higher-order lambda fail-track deflection into !|', () => {
  // When a lambda passed to a higher-order operand (every, any,
  // groupBy, indexBy, filter) raises an unresolvedIdentifier error,
  // the higher-order operand returns that error value as its own
  // result. Downstream the success-track `|` deflects the error, so
  // we route the next step through `!|` to fire on it and project
  // its tag.
  it('every returns the error raised by its predicate', async () => {
    const evalResult = await evalQuery('[1 2 3] | every ~(thisIsNotDefined) !| type');
    expect(evalResult).toEqual(makeTagKeyword('call/UnresolvedIdentifierError'));
  });

  it('any returns the error raised by its predicate', async () => {
    const evalResult = await evalQuery('[1 2 3] | any ~(thisIsNotDefined) !| type');
    expect(evalResult).toEqual(makeTagKeyword('call/UnresolvedIdentifierError'));
  });

  it('groupBy returns the error raised by its key lambda', async () => {
    const evalResult = await evalQuery('[1 2 3] | groupBy ~(thisIsNotDefined) !| type');
    expect(evalResult).toEqual(makeTagKeyword('call/UnresolvedIdentifierError'));
  });

  it('indexBy returns the error raised by its key lambda', async () => {
    const evalResult = await evalQuery('[1 2 3] | indexBy ~(thisIsNotDefined) !| type');
    expect(evalResult).toEqual(makeTagKeyword('call/UnresolvedIdentifierError'));
  });

  it('filter returns the error raised by its predicate', async () => {
    const evalResult = await evalQuery('[1 2 3] | filter ~(thisIsNotDefined) !| type');
    expect(evalResult).toEqual(makeTagKeyword('call/UnresolvedIdentifierError'));
  });
});

describe('a module read in a scope of its own [D63], [D152]', () => {
  it('keeps the modules its own use loaded, and passes none of their names on', async () => {
    let askedForInner = 0;
    const sessionInstance = await createSession({
      locator: async path => {
        if (path === 'outer') return { source: 'use ::inner | :x 1' };
        if (path === 'inner') { askedForInner++; return { source: ':y 2' }; }
        return null;
      }
    });
    expect((await sessionInstance.evalCell('use ::outer | x')).result).toBe(1);
    expect((await sessionInstance.evalCell('use ::outer | y !| type')).result).toEqual(makeTagKeyword('call/UnresolvedIdentifierError'));
    expect((await sessionInstance.evalCell('use ::outer | use ::inner | y')).result).toBe(2);
    expect(askedForInner).toBe(1);
  });

  it('refuses an element of a set of modules that is no tag', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind(moduleKey('a'), new Map([['x', 1]]));
    expect((await sessionInstance.evalCell('use #[::a 42] !| type')).result).toEqual(makeTagKeyword('any/UseModuleElementNotTagError'));
  });
});
