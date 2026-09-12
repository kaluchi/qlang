// Axis-operands — `source`, `docs`, `examples` walk the
// `qlang/ast/<uri>` Quote-values in env to lift declarative
// metadata off a binding's BindStep.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, isQuote, makeTagKeyword, keyword as makeKeyword } from '../../src/types.mjs';
import { QlangTypeError } from '../../src/errors.mjs';

describe(':name | source returns the BindStep source as Quote', () => {
  it(':count | source carries the canonical :count BindStep text', async () => {
    const result = await evalQuery(':count | source');
    expect(isQuote(result)).toBe(true);
    expect(result.source.startsWith(':count')).toBe(true);
  });

  it('a module whose top-level AST is a bare literal contributes no BindSteps', async () => {
    // findBindingStepFor returns null when the moduleAst is neither
    // a Pipeline nor a top-level BindStep — bare-literal modules
    // add nothing to the axis search frontier, so the lookup falls
    // through to the axis's not-found class when no other module has the
    // binding.
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession({
      locator: async (nsName) => nsName === 'tests/scalar-only' ? { source: '42' } : null
    });
    const cellEntry = await session.evalCell('use(:tests/scalar-only) | :missing | source !| type');
    expect(cellEntry.result).toEqual(makeTagKeyword('SourceBindingNotFoundError'));
  });

  it('inline BindStep within the current query is reachable through axis lookup', async () => {
    // evalQuery stamps the parsed AST under moduleAstKey('inline')
    // so axis-operands can find bindings declared in the same cell
    // — without this, `:foo … | :foo | source` would raise
    // SourceBindingNotFoundError because the cell's AST is not among the
    // module Quotes installed via use(:ns).
    const result = await evalQuery(':myLocal 42 | :myLocal | source');
    expect(isQuote(result)).toBe(true);
    expect(result.source).toBe(':myLocal 42');
  });

  it('session.evalCell stamps cell AST so axis-operands resolve cell-local BindStep declarations', async () => {
    // session.evalCell mirrors evalQuery's inline-AST stamp under
    // moduleAstKey(cellUri); without it CLI script-mode + REPL
    // surface the axis's own not-found tag for any lookup on a
    // user-declared BindStep in the same cell — the regression that
    // initially flagged this gap was `qlang ':foo |~~ note ~~| |
    // :foo | docs'` returning DocsBindingNotFoundError instead of
    // the attached doc.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell(
      ':foo |~~ a note ~~| | :foo | docs * /content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([' a note ']);
  });

  it('cross-cell axis lookup — a BindStep declared in an earlier cell is visible from a later cell', async () => {
    // Each cell stamps its AST under a distinct moduleAstKey
    // (`qlang/ast/cell-1`, `qlang/ast/cell-2`, …) so axis-operands
    // walking every `qlang/ast/<uri>` Quote in env see prior cells'
    // declarations alongside the current cell's. The session env
    // accumulates these stamps over the cell history.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':foo |~~ first cell ~~|');
    const cellEntry = await sessionInstance.evalCell(':foo | docs * /content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([' first cell ']);
  });

  it('namespaced keyword names round-trip cleanly through axis lookup', async () => {
    // `:landing/chapter01` parses as a single namespaced Keyword;
    // BindStep stores the binding under that exact name, axis
    // lookup matches by `step.key.name === bindingName`. Pinned
    // here so a future grammar change to namespacing semantics
    // surfaces the regression.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell(
      ':landing/chapter01 |~~ Глава из лендинг пейджа ~~| | :landing/chapter01 | docs * /content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([' Глава из лендинг пейджа ']);
  });

  it('non-keyword subject raises SourceSubjectNotKeywordOrTagError', async () => {
    const err = await evalQuery('42 | source');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('SourceSubjectNotKeywordOrTagError'));
  });

  it('orphan type-descriptor (not bound under ::tag in env) raises SourceSubjectNotKeywordOrTagError', async () => {
    const err = await evalQuery('{:impl :unbound} | source');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('SourceSubjectNotKeywordOrTagError'));
  });
});

describe(':name | docs returns Vec of Doc-values from attached prefixes', () => {
  it(':count | docs returns at least one Doc-value', async () => {
    const result = await evalQuery(':count | docs | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it(':count | docs first Doc /content carries the prefix text', async () => {
    const result = await evalQuery(':count | docs | first | /content');
    expect(typeof result).toBe('string');
    expect(result).toContain('Returns the number of elements');
  });

  it('non-keyword subject raises DocsSubjectNotKeywordOrTagError', async () => {
    const err = await evalQuery('42 | docs');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('DocsSubjectNotKeywordOrTagError'));
  });

  it('unknown binding raises DocsBindingNotFoundError', async () => {
    const err = await evalQuery(':totallyMadeUp | docs');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('DocsBindingNotFoundError'));
  });
});

describe(':name | examples extracts Quote segments from docs', () => {
  it(':count | examples returns Vec of Quotes', async () => {
    const result = await evalQuery(':count | examples | count');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('non-keyword subject raises ExamplesSubjectNotKeywordOrTagError', async () => {
    const err = await evalQuery('42 | examples');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('ExamplesSubjectNotKeywordOrTagError'));
  });

  it('unknown binding raises ExamplesBindingNotFoundError', async () => {
    const err = await evalQuery(':totallyMadeUp | examples');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('ExamplesBindingNotFoundError'));
  });
});

describe('axis-operands walk tag-namespace bindings via ~{::} prefix', () => {
  it(':"::conduit" | source finds the tag binding via the keyword form', async () => {
    const result = await evalQuery(':"::conduit" | source');
    expect(isQuote(result)).toBe(true);
    expect(result.source.startsWith('::conduit')).toBe(true);
  });

  it('::conduit | source resolves the tag-binding descriptor through reverse env lookup', async () => {
    const result = await evalQuery('::conduit | source');
    expect(isQuote(result)).toBe(true);
    expect(result.source.startsWith('::conduit')).toBe(true);
  });

  it('::conduit | docs returns the attached Doc-prefix on the type BindStep', async () => {
    const result = await evalQuery('::conduit | docs | first | /content');
    expect(typeof result).toBe('string');
    expect(result).toContain('Conduit literal');
  });

  it('::conduit | examples extracts the Quote segments from the type docstring', async () => {
    const result = await evalQuery('::conduit | examples | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  // Regression — `as` mints only into the value namespace, so the
  // axis walker's `OperandCall as` recogniser must skip when the
  // lookup is in the tag namespace. A `42 | as(:Foo)` snapshot under
  // a value-namespace `:Foo` keyword must not satisfy a
  // tag-namespace lookup `::Foo | source` — they are distinct env
  // entries by colon-count.
  it('::Tag | source ignores a same-stem as(:Tag) value-namespace snapshot', async () => {
    const result = await evalQuery('42 | as(:Foo) | ::Foo | source');
    const { isErrorValue } = await import('../../src/types.mjs');
    expect(isErrorValue(result)).toBe(true);
    expect(result.originalError.name).toBe('SourceBindingNotFoundError');
    expect(result.originalError).toBeInstanceOf(QlangTypeError);
    expect(result.originalError.context.bindingName).toBe('::Foo');
  });

  it('::Tag | docs ignores a same-stem as(:Tag) value-namespace snapshot', async () => {
    const result = await evalQuery('42 | as(:Foo) | ::Foo | docs');
    const { isErrorValue } = await import('../../src/types.mjs');
    expect(isErrorValue(result)).toBe(true);
    expect(result.originalError.name).toBe('DocsBindingNotFoundError');
    expect(result.originalError).toBeInstanceOf(QlangTypeError);
    expect(result.originalError.context.bindingName).toBe('::Foo');
  });
});

describe('examples axis extracts Quote segments from a loaded module', () => {
  it('use-loaded module with Quote segment is reachable through examples', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const moduleSource = '|~~ ~{5 | mul(2) | eq(10)} ~~|\n:demo 99';
    const session = await createSession({
      locator: async (nsName) => nsName === 'tests/demo' ? { source: moduleSource } : null
    });
    const cellEntry = await session.evalCell('use(:tests/demo) | :demo | examples | count');
    expect(cellEntry.result).toBe(1);
  });

  it('docs of the loaded module carries the prefix as a Doc-value', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const moduleSource = '|~~ A short note. ~~|\n:demo 1';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use(:tests/demo) | :demo | docs | first | /content');
    expect(cellEntry.result).toBe(' A short note. ');
  });

  it('docs on a binding without an attached doc-prefix returns an empty Vec', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const moduleSource = ':bare 42';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use(:tests/bare) | :bare | docs | count');
    expect(cellEntry.result).toBe(0);
  });

  it('examples on a binding without an attached doc-prefix returns an empty Vec', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const moduleSource = ':bare 42';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use(:tests/bare) | :bare | examples | count');
    expect(cellEntry.result).toBe(0);
  });

  it('single-step module containing a non-binding OperandCall fails axis lookup with SourceBindingNotFoundError', async () => {
    // A standalone non-binding OperandCall (e.g. `count`) at the
    // module top level evaluates without throwing, but it is not
    // a binding declaration — `matchesBindingStep` falls through
    // the `name === 'as'` check and returns false, so
    // `:any | source` resolves to SourceBindingNotFoundError.
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession({
      locator: async () => ({ source: 'count' })
    });
    const cellEntry = await session.evalCell('use(:tests/non-binding) | :missing | source !| type');
    expect(cellEntry.result.name).toBe('SourceBindingNotFoundError');
  });

  it('zero-arg `as()` in a module is structurally not a binding declaration', async () => {
    // Parser shape: OperandCall named `as` with `args === []`.
    // matchesBindingStep enters the `name === 'as'` branch, then
    // the empty-args guard skips it before pulling out a first-arg
    // key. Lookup falls through to the axis's not-found class.
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession({
      locator: async () => ({ source: '42 | as()' })
    });
    const cellEntry = await session.evalCell('use(:tests/zero) | :nonexistentBinding | source !| type');
    expect(cellEntry.result.name).toBe('SourceBindingNotFoundError');
  });

  it('axis lookup walking a single-step module that does not match returns SourceBindingNotFoundError', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const moduleSource = ':somethingElse 1';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use(:tests/other) | :notHere | source !| type');
    expect(cellEntry.result.name).toBe('SourceBindingNotFoundError');
  });

  it('axis lookup skips a module step that is a bare unresolved identifier (no args / null args)', async () => {
    // A module whose only step is a bare identifier reference —
    // `args === null` per OperandCall grammar — must not match any
    // binding lookup. Exercises the `!Array.isArray(step.args)`
    // branch of matchesBindingStep.
    const { createSession } = await import('../../src/session.mjs');
    const moduleSource = 'someBareIdent';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use(:tests/bare-ref) | :anything | source !| type');
    expect(cellEntry.result.name).toBe('SourceBindingNotFoundError');
  });
});

describe('a tagged subject names its binding through the header', () => {
  // The operand reference promises the axis trio accepts any value
  // carrying a TagKeyword on its JS-header slot. A `manifest`
  // view-Map names one through its `:kind` field instead — that is
  // the field's job, since a view describes a binding rather than
  // being one.
  it('a materialized error reaches its own tag docs', async () => {
    expect(await evalQuery('10 | div(0) !| docs | first | /content'))
      .toContain('Division by zero');
  });

  it('a manifest view reaches the docs of the kind its `:kind` names', async () => {
    expect(await evalQuery('manifest | first | docs | first | /content'))
      .toContain('Tag-binding declaration shape');
  });
});

describe('axis-operands resolve the binding the evaluator dispatches', () => {
  // `spec` reads env; `source` / `docs` / `examples` walk the module
  // ASTs env holds. Both readings have to name one declaration, or a
  // binding that shadows a built-in reads as the built-in — the case
  // the hypertext chain exists for.
  const shadowed = ':add mul(100) | ';

  it('a binding shadowing a built-in is the one source reports', async () => {
    expect(await evalQuery(shadowed + '2 | add')).toBe(200);
    expect(await evalQuery(shadowed + ':add | source | /source')).toBe(':add mul(100)');
  });

  it('docs and examples answer for the shadowing binding, which carries neither', async () => {
    expect(await evalQuery(shadowed + ':add | docs | count')).toBe(0);
    expect(await evalQuery(shadowed + ':add | examples | count')).toBe(0);
  });

  it('spec names the same declaration source does', async () => {
    expect(await evalQuery(shadowed + ':add | spec | type')).toEqual(makeTagKeyword('conduit'));
  });

  // Module load order is not shadow order: a cell's own AST is
  // stamped into env before the cell runs, so a `use` the cell
  // performs lands after it. The declaration site the binding
  // carries is what settles both orders.
  const namespaceLocator = async (namespaceName) => namespaceName === 'probe/shadow'
    ? { source: ':contested |~~ from the namespace ~~| 111' }
    : null;

  it('a cell BindStep after a use answers with the cell declaration', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession({ locator: namespaceLocator });
    const cellEntry = await sessionInstance.evalCell(
      'use(:probe/shadow) | :contested |~~ from the cell ~~| 222 | ' +
      '[contested, :contested | source | /source, :contested | docs | first | /content]');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([
      222, ':contested |~~ from the cell ~~| 222', ' from the cell '
    ]);
  });

  it('a host binding carrying no slots answers not-found, not a foreign TypeError', async () => {
    // `session.bind` installs a value directly, so env holds whatever
    // the host handed it — including one that carries no slots to
    // read a declaration site off.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    sessionInstance.bind('hostInstalled', null);
    const cellEntry = await sessionInstance.evalCell(':hostInstalled | source !| type');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual(makeTagKeyword('SourceBindingNotFoundError'));
  });

  it('a use after a cell BindStep answers with the namespace declaration', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession({ locator: namespaceLocator });
    const cellEntry = await sessionInstance.evalCell(
      ':contested |~~ from the cell ~~| 222 | use(:probe/shadow) | ' +
      '[contested, :contested | source | /source, :contested | docs | first | /content]');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([
      111, ':contested |~~ from the namespace ~~| 111', ' from the namespace '
    ]);
  });
});

describe(':name | spec returns the env-side declaration descriptor', () => {
  it(':add | spec surfaces the operand descriptor Map with :category :arith', async () => {
    expect(await evalQuery(':add | spec | /category')).toEqual(makeKeyword('arith'));
  });

  it('::AddLeftNotNumberError | spec surfaces per-tag static :operand', async () => {
    expect(await evalQuery('::AddLeftNotNumberError | spec | /operand')).toEqual(makeKeyword('add'));
  });

  // The stamp lifts each recorded fact into the value-class the
  // reader projects on: a numeric position stays a Number, the
  // `subject` position and a single expected type become Keywords, a
  // multi-type expectation becomes a Vec of them, and a tag-binding
  // raiser spells itself as a TagKeyword the way source writes it.
  it('a numeric position stays a Number and :subject lifts to a Keyword', async () => {
    expect(await evalQuery('::AddLeftNotNumberError | spec | /position')).toBe(1);
    expect(await evalQuery('::CountSubjectNotContainerError | spec | /position'))
      .toEqual(makeKeyword('subject'));
  });

  it('a single expected type lifts to a Keyword and several to a Vec', async () => {
    expect(await evalQuery('::AsNameNotKeywordError | spec | /expectedType'))
      .toEqual(makeKeyword('keyword'));
    expect(await evalQuery('::SourceSubjectNotKeywordOrTagError | spec | /expectedType'))
      .toEqual([makeKeyword('keyword'), makeKeyword('tagKeyword')]);
  });

  it('a value-class constructor names itself on :operand as a TagKeyword', async () => {
    expect(await evalQuery('::ConduitBodyNotQuoteError | spec | /operand'))
      .toEqual(makeTagKeyword('conduit'));
  });

  it('non-keyword subject lifts SpecSubjectNotKeywordOrTagError', async () => {
    const evalResult = await evalQuery('42 | spec !| type');
    expect(evalResult).toEqual(makeTagKeyword('SpecSubjectNotKeywordOrTagError'));
  });

  it('keyword naming an unbound identifier lifts SpecBindingNotFoundError', async () => {
    const evalResult = await evalQuery(':nonexistentBindingForSpec | spec !| type');
    expect(evalResult).toEqual(makeTagKeyword('SpecBindingNotFoundError'));
  });

  it('as-bound snapshot auto-unwraps under spec lookup', async () => {
    // `as(:name)` stores a Snapshot wrapper under :name in env.
    // Identifier lookup auto-unwraps via evalOperandCall, but spec
    // reads env directly and unwraps inline so the surface stays
    // the captured payload rather than the Snapshot housekeeping
    // Map.
    expect(await evalQuery('42 | as(:answer) | :answer | spec')).toBe(42);
  });
});
