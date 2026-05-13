// Axis-operands — `source`, `docs`, `examples` walk the
// `qlang/ast/<uri>` Quote-values in env to lift declarative
// metadata off a binding's BindStep.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, isQuote, makeTagKeyword } from '../../src/types.mjs';

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
    // through to AxisBindingNotFoundError when no other module has the
    // binding.
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession({
      locator: async (nsName) => nsName === 'tests/scalar-only' ? { source: '42' } : null
    });
    const cellEntry = await session.evalCell('use(:tests/scalar-only) | :missing | source !| /thrown');
    expect(cellEntry.result).toEqual(makeTagKeyword('AxisBindingNotFoundError'));
  });

  it('inline BindStep within the current query is reachable through axis lookup', async () => {
    // evalQuery stamps the parsed AST under moduleAstKey('inline')
    // so axis-operands can find bindings declared in the same cell
    // — without this, `:foo … | :foo | source` would raise
    // AxisBindingNotFoundError because the cell's AST is not among the
    // module Quotes installed via use(:ns).
    const result = await evalQuery(':myLocal 42 | :myLocal | source');
    expect(isQuote(result)).toBe(true);
    expect(result.source).toBe(':myLocal 42');
  });

  it('session.evalCell stamps cell AST so axis-operands resolve cell-local BindStep declarations', async () => {
    // session.evalCell mirrors evalQuery's inline-AST stamp under
    // moduleAstKey(cellUri); without it CLI script-mode + REPL
    // surface `::AxisBindingNotFoundError` for any axis lookup on a
    // user-declared BindStep in the same cell — the regression that
    // initially flagged this gap was `qlang ':foo |~~ note ~~| |
    // :foo | docs'` returning AxisBindingNotFoundError instead of
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
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('SourceSubjectNotKeywordOrTagError'));
  });

  it('orphan type-descriptor (not bound under ::tag in env) raises SourceSubjectNotKeywordOrTagError', async () => {
    const err = await evalQuery('{:qlang/kind :tag :qlang/impl :unbound} | source');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('SourceSubjectNotKeywordOrTagError'));
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
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('DocsSubjectNotKeywordOrTagError'));
  });

  it('unknown binding raises AxisBindingNotFoundError', async () => {
    const err = await evalQuery(':totallyMadeUp | docs');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('AxisBindingNotFoundError'));
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
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('ExamplesSubjectNotKeywordOrTagError'));
  });

  it('unknown binding raises AxisBindingNotFoundError', async () => {
    const err = await evalQuery(':totallyMadeUp | examples');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('AxisBindingNotFoundError'));
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

  it('single-step module containing a non-binding OperandCall fails axis lookup with AxisBindingNotFoundError', async () => {
    // A standalone non-binding OperandCall (e.g. `count`) at the
    // module top level evaluates without throwing, but it is not
    // a binding declaration — `matchesBindingStep` falls through
    // the `name === 'as'` check and returns false, so
    // `:any | source` resolves to AxisBindingNotFoundError.
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession({
      locator: async () => ({ source: 'count' })
    });
    const cellEntry = await session.evalCell('use(:tests/non-binding) | :missing | source !| /thrown');
    expect(cellEntry.result.name).toBe('AxisBindingNotFoundError');
  });

  it('zero-arg `as()` in a module is structurally not a binding declaration', async () => {
    // Parser shape: OperandCall named `as` with `args === []`.
    // matchesBindingStep enters the `name === 'as'` branch, then
    // the empty-args guard skips it before pulling out a first-arg
    // key. Lookup falls through to AxisBindingNotFoundError.
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession({
      locator: async () => ({ source: '42 | as()' })
    });
    const cellEntry = await session.evalCell('use(:tests/zero) | :nonexistentBinding | source !| /thrown');
    expect(cellEntry.result.name).toBe('AxisBindingNotFoundError');
  });

  it('axis lookup walking a single-step module that does not match returns AxisBindingNotFoundError', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const moduleSource = ':somethingElse 1';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use(:tests/other) | :notHere | source !| /thrown');
    expect(cellEntry.result.name).toBe('AxisBindingNotFoundError');
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
    const cellEntry = await session.evalCell('use(:tests/bare-ref) | :anything | source !| /thrown');
    expect(cellEntry.result.name).toBe('AxisBindingNotFoundError');
  });
});
