// Axis-operands — `source`, `docs`, `examples` project the record a
// declaration wrote into its scope [D63].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, isQuote, makeTagKeyword, keyword as makeKeyword } from '../../src/types.mjs';
import { QlangTypeError } from '../../src/errors.mjs';
import { printQuoteSource } from '../../src/quote.mjs';

describe(':name | source returns the BindStep source as Quote', () => {
  it('::vec/count | source carries the canonical :count BindStep text', async () => {
    const result = await evalQuery('::vec/count | source');
    expect(isQuote(result)).toBe(true);
    expect(printQuoteSource(result).startsWith(':count')).toBe(true);
  });

  it('a module that declares nothing writes no record to read', async () => {
    // A module of a bare literal declares no binding, so a name it
    // was to bring names nothing and the axis raises its not-found
    // class.
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession({
      locator: async (nsName) => nsName === 'tests/scalar-only' ? { source: '42' } : null
    });
    const cellEntry = await session.evalCell('use :tests/scalar-only | :missing | source !| type');
    expect(cellEntry.result).toEqual(makeTagKeyword('SourceBindingNotFoundError'));
  });

  it('inline BindStep within the current query is reachable through axis lookup', async () => {
    // A declaration of the query writes its record into the query's
    // scope, which the axes read.
    const result = await evalQuery(':myLocal 42 | :myLocal | source');
    expect(isQuote(result)).toBe(true);
    expect(printQuoteSource(result)).toBe(':myLocal 42');
  });

  it('a cell-local BindStep declaration is reachable through axis lookup', async () => {
    // A cell's declaration writes its record into the session's scope;
    // the regression that first flagged the gap was `qlang ':foo |~~
    // note ~~| | :foo | docs'` returning DocsBindingNotFoundError
    // instead of the attached doc.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell(
      ':foo |~~ a note ~~| | :foo | docs * /content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([' a note ']);
  });

  it('cross-cell axis lookup — a BindStep declared in an earlier cell is visible from a later cell', async () => {
    // The session's scope keeps the records earlier cells wrote, so a
    // later cell's axes read them beside its own.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':foo |~~ first cell ~~|');
    const cellEntry = await sessionInstance.evalCell(':foo | docs * /content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([' first cell ']);
  });

  it('namespaced keyword names round-trip cleanly through axis lookup', async () => {
    // `:landing/chapter01` parses as a single namespaced Keyword;
    // BindStep writes the record under that exact name, which the
    // axes read. Pinned here so a future grammar change to
    // namespacing semantics surfaces the regression.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell(
      ':landing/chapter01 |~~ Глава из лендинг пейджа ~~| | :landing/chapter01 | docs * /content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([' Глава из лендинг пейджа ']);
  });

  it('a value that is no name reads the declaration of its kind', async () => {
    expect(await evalQuery('42 | source | eq (::number | source)')).toBe(true);
    expect(await evalQuery('{:impl :unbound} | source | eq (::map | source)')).toBe(true);
  });
});

describe(':name | docs returns Vec of Doc-values from attached prefixes', () => {
  it('::vec/count | docs returns at least one Doc-value', async () => {
    const result = await evalQuery('::vec/count | docs | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('::vec/count | docs first Doc /content carries the prefix text', async () => {
    const result = await evalQuery('::vec/count | docs | first | /content');
    expect(typeof result).toBe('string');
    expect(result).toContain('Returns the number of elements');
  });

  it('a value that is no name reads the page of its kind', async () => {
    expect(await evalQuery('42 | docs | eq (::number | docs)')).toBe(true);
  });

  it('unknown binding raises DocsBindingNotFoundError', async () => {
    const err = await evalQuery(':totallyMadeUp | docs');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('DocsBindingNotFoundError'));
  });

  it('a value whose kind no binding declares is refused under its kind', async () => {
    // The fork of the parentheses drops the tag the literal declared,
    // and the value it minted leaves with the name of that kind.
    expect(await evalQuery('(::Ghost(1)) | docs !| /bindingName')).toEqual(makeTagKeyword('Ghost'));
  });
});

describe(':name | examples extracts Quote segments from docs', () => {
  it('::vec/count | examples returns Vec of Quotes', async () => {
    const result = await evalQuery('::vec/count | examples | count');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('a value that is no name reads the examples of its kind', async () => {
    expect(await evalQuery('42 | examples | eq (::number | examples)')).toBe(true);
  });

  it('unknown binding raises ExamplesBindingNotFoundError', async () => {
    const err = await evalQuery(':totallyMadeUp | examples');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('ExamplesBindingNotFoundError'));
  });
});

describe('axis-operands walk tag-namespace bindings via `::` prefix', () => {
  it('a keyword names a binding of its scope, a tag of a provider none', async () => {
    expect(await evalQuery(':"::verb" | source !| type')).toEqual(makeTagKeyword('SourceBindingNotFoundError'));
  });

  it('a keyword naming a verb of a provider is refused with the addresses where it lives', async () => {
    expect([...await evalQuery(':count | docs !| /addresses')])
      .toEqual([makeTagKeyword('map/count'), makeTagKeyword('set/count'), makeTagKeyword('vec/count')]);
  });

  it('::verb | source resolves the tag-binding descriptor through reverse env lookup', async () => {
    const result = await evalQuery('::verb | source');
    expect(isQuote(result)).toBe(true);
    expect(printQuoteSource(result).startsWith('::verb')).toBe(true);
  });

  it('::verb | docs returns the attached Doc-prefix on the type BindStep', async () => {
    const result = await evalQuery('::verb | docs | first | /content');
    expect(typeof result).toBe('string');
    expect(result).toContain('A verb, a quote under this tag');
  });

  it('::verb | examples extracts the Quote segments from the type docstring', async () => {
    const result = await evalQuery('::verb | examples | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  // Regression — a keyword-keyed declaration mints only into the
  // value namespace. A `42 | :Foo /` freeze under a value-namespace
  // `:Foo` keyword must not satisfy a tag-namespace lookup `::Foo |
  // source` — they are distinct env entries by colon-count.
  it('::Tag | source ignores a same-stem value-namespace freeze', async () => {
    const result = await evalQuery('42 | :Foo / | ::Foo | source');
    const { isErrorValue } = await import('../../src/types.mjs');
    expect(isErrorValue(result)).toBe(true);
    expect(result.originalError.name).toBe('SourceBindingNotFoundError');
    expect(result.originalError).toBeInstanceOf(QlangTypeError);
    expect(result.originalError.context.bindingName).toBe('::Foo');
  });

  it('::Tag | docs ignores a same-stem value-namespace freeze', async () => {
    const result = await evalQuery('42 | :Foo / | ::Foo | docs');
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
    const moduleSource = '|~~ ~(5 | mul 2 | eq 10) ~~|\n:demo 99';
    const session = await createSession({
      locator: async (nsName) => nsName === 'tests/demo' ? { source: moduleSource } : null
    });
    const cellEntry = await session.evalCell('use :tests/demo | :demo | examples | count');
    expect(cellEntry.result).toBe(1);
  });

  it('docs of the loaded module carries the prefix as a Doc-value', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const moduleSource = '|~~ A short note. ~~|\n:demo 1';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use :tests/demo | :demo | docs | first | /content');
    expect(cellEntry.result).toBe(' A short note. ');
  });

  it('docs on a binding without an attached doc-prefix returns an empty Vec', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const moduleSource = ':bare 42';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use :tests/bare | :bare | docs | count');
    expect(cellEntry.result).toBe(0);
  });

  it('examples on a binding without an attached doc-prefix returns an empty Vec', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const moduleSource = ':bare 42';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use :tests/bare | :bare | examples | count');
    expect(cellEntry.result).toBe(0);
  });

  it('a name a loaded module does not declare names no binding', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const moduleSource = ':somethingElse 1';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use :tests/other | :notHere | source !| type');
    expect(cellEntry.result.name).toBe('SourceBindingNotFoundError');
  });

});

describe('a value that is no name reads the declaration of its kind', () => {
  // The kind `type` answers names the declaration [D61]: an error
  // reads the page of its tag, and a `manifest` entry, a map, reads
  // the page of `::map` whatever its `:kind` field holds.
  it('a materialized error reaches its own tag docs', async () => {
    expect(await evalQuery('10 | div 0 !| docs | first | /content'))
      .toContain('Division by zero');
  });

});

describe('axis-operands resolve the binding the evaluator dispatches', () => {
  // The four axes project the one record the scope holds under the
  // name, so a binding that shadows a built-in reads as itself — the
  // case the hypertext chain exists for.
  const shadowed = ':add ::verb~(mul 100) | ';

  it('a binding shadowing a built-in is the one source reports', async () => {
    expect(await evalQuery(shadowed + '2 | add')).toBe(200);
    expect(await evalQuery(shadowed + ':add | source | parse')).toBe(':add ::verb~(mul 100)');
  });

  it('docs and examples answer for the shadowing binding, which carries neither', async () => {
    expect(await evalQuery(shadowed + ':add | docs | count')).toBe(0);
    expect(await evalQuery(shadowed + ':add | examples | count')).toBe(0);
  });

  it('spec answers the signature of the verb source reports', async () => {
    expect(await evalQuery(shadowed + ':add | spec | type')).toEqual(makeTagKeyword('spec'));
  });

  // Whichever of a `use` and a cell's declaration writes the name last
  // holds the record the axes read, in either order.
  const namespaceLocator = async (namespaceName) => namespaceName === 'probe/shadow'
    ? { source: ':contested |~~ from the namespace ~~| 111' }
    : null;

  it('a cell BindStep after a use answers with the cell declaration', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession({ locator: namespaceLocator });
    const cellEntry = await sessionInstance.evalCell(
      'use(:probe/shadow) | :contested |~~ from the cell ~~| 222 | ' +
      '[contested, (:contested | source | parse), (:contested | docs | first | /content)]');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([
      222, ':contested |~~ from the cell ~~| 222', ' from the cell '
    ]);
  });

  it('a host binding is a record with no source and no docs', async () => {
    // `session.bind` writes the record of a binding without a
    // declaration behind it [D63], which the axes project.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    sessionInstance.bind('hostInstalled', null);
    const sourceEntry = await sessionInstance.evalCell(':hostInstalled | source');
    expect(sourceEntry.result).toBeNull();
    const docsEntry = await sessionInstance.evalCell(':hostInstalled | docs');
    expect(docsEntry.result).toEqual([]);
  });

  it('a use after a cell BindStep answers with the namespace declaration', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession({ locator: namespaceLocator });
    const cellEntry = await sessionInstance.evalCell(
      ':contested |~~ from the cell ~~| 222 | use(:probe/shadow) | ' +
      '[contested, (:contested | source | parse), (:contested | docs | first | /content)]');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([
      111, ':contested |~~ from the namespace ~~| 111', ' from the namespace '
    ]);
  });
});

describe(':name | spec returns the env-side declaration descriptor', () => {
  it('::number/add | spec answers the signature of the verb, its noun the subject [D72]', async () => {
    expect(await evalQuery('::number/add | spec | /subject')).toEqual(makeTagKeyword('number'));
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
    expect(await evalQuery('::BuiltinImplNotPrimitiveKeyError | spec | /expectedType'))
      .toEqual(makeKeyword('keyword'));
    expect(await evalQuery('::HasSubjectNotMapOrSetError | spec | /expectedType'))
      .toEqual([makeKeyword('map'), makeKeyword('set')]);
  });

  it('a value-class constructor names itself on :operand as a TagKeyword', async () => {
    expect(await evalQuery('::VerbPayloadNotQuoteError | spec | /operand'))
      .toEqual(makeTagKeyword('verb'));
  });

  it('a value that is no name reads the descriptor of its kind', async () => {
    expect(await evalQuery('42 | spec | /impl')).toEqual(makeKeyword('qlang/type/number'));
  });

  it('keyword naming an unbound identifier lifts SpecBindingNotFoundError', async () => {
    const evalResult = await evalQuery(':nonexistentBindingForSpec | spec !| type');
    expect(evalResult).toEqual(makeTagKeyword('SpecBindingNotFoundError'));
  });

  it('spec of a freeze answers the value its record holds', async () => {
    // `:name /` writes the record of a binding under :name in env
    // [D63]; spec projects the record's value.
    expect(await evalQuery('42 | :answer / | :answer | spec')).toBe(42);
  });
});
