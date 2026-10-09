// Axis-operands — `source`, `doc`, `binding` project the record a
// declaration wrote into its scope [D63].

import { describe, it, expect } from 'vitest';
import { printValue } from '../../src/index.mjs';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, isQuote, makeTagKeyword } from '../../src/types.mjs';
import { QlangError } from '../../src/errors.mjs';
import { printQuoteSource } from '../../src/quote.mjs';

describe(':name | source returns the BindStep source as Quote', () => {
  it('::vec/count | source carries the declaration by its address', async () => {
    const result = await evalQuery('::vec/count | source');
    expect(isQuote(result)).toBe(true);
    expect(printQuoteSource(result).startsWith(':vec/count')).toBe(true);
  });

  it('a source of the root that declares nothing writes no record to read', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession({ sources: [{ uri: 'tests/scalar-only', source: '42' }] });
    const cellEntry = await session.evalCell(':missing | source !| type');
    expect(cellEntry.result).toEqual(makeTagKeyword('any/source/UnknownNameError'));
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
    // note ~~| | :foo | doc'` returning AnyDocUnknownNameError
    // instead of the attached doc.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell(
      ':foo |~~ a note ~~| | :foo | doc | content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(' a note ');
  });

  it('cross-cell axis lookup — a BindStep declared in an earlier cell is visible from a later cell', async () => {
    // The session's scope keeps the records earlier cells wrote, so a
    // later cell's axes read them beside its own.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':foo |~~ first cell ~~|');
    const cellEntry = await sessionInstance.evalCell(':foo | doc | content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(' first cell ');
  });

  it('moduled keyword names round-trip cleanly through axis lookup', async () => {
    // `:landing/chapter01` parses as a single moduled Keyword;
    // BindStep writes the record under that exact name, which the
    // axes read. Pinned here so a future grammar change to
    // namespacing semantics surfaces the regression.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell(
      ':landing {} | :landing/chapter01 |~~ Глава из лендинг пейджа ~~| | :landing/chapter01 | doc | content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(' Глава из лендинг пейджа ');
  });

  it('a value that is no name reads the declaration of its kind', async () => {
    expect(await evalQuery('42 | source | eq (::number | source)')).toBe(true);
    expect(await evalQuery('{:impl :unbound} | source | eq (::map | source)')).toBe(true);
  });
});

describe(':name | doc returns the page its attached prefixes make', () => {
  it('::vec/count | doc returns a page', async () => {
    const result = await evalQuery('::vec/count | doc | type');
    expect(result).toEqual(makeTagKeyword('doc'));
  });

  it('the content of the first doc of ::vec/count carries its prose', async () => {
    const result = await evalQuery('::vec/count | doc | content');
    expect(typeof result).toBe('string');
    expect(result).toContain('number of elements');
  });

  it('a value that is no name reads the page of its kind', async () => {
    expect(await evalQuery('42 | doc | eq (::number | doc)')).toBe(true);
  });

  it('unknown binding raises AnyDocUnknownNameError', async () => {
    const err = await evalQuery(':totallyMadeUp | doc');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('any/doc/UnknownNameError'));
  });

  it('a value whose kind no binding declares is refused under its kind', async () => {
    // The fork of the parentheses drops the tag the literal declared,
    // and the value it minted leaves with the name of that kind.
    expect(await evalQuery('(::Ghost(1)) | doc !| /name')).toEqual(makeTagKeyword('Ghost'));
  });
});

describe(':name | laws reads the laws declared under a name', () => {
  it('::vec/count | laws answers its laws by their names', async () => {
    const result = await evalQuery('::vec/count | laws | count');
    expect(result).toBeGreaterThan(0);
  });

  it('a value that is no name reads the laws of its kind', async () => {
    expect(await evalQuery('42 | laws | eq (::number | laws)')).toBe(true);
  });
});

describe('axis-operands read the node a tag addresses', () => {
  it('a keyword names a binding of its scope, a tag of a provider none', async () => {
    expect(await evalQuery(':"::vec" | source !| type')).toEqual(makeTagKeyword('any/source/UnknownNameError'));
  });

  it('a keyword naming a word of a provider is refused with the addresses of its pages, one on each kind that answers it', async () => {
    expect([...await evalQuery(':count | doc !| /addresses')])
      .toEqual([makeTagKeyword('map/count'), makeTagKeyword('set/count'), makeTagKeyword('string/count'), makeTagKeyword('vec/count')]);
  });

  it('::quote | source reads the declaration of the kind in the language\'s module', async () => {
    const result = await evalQuery('::quote | source');
    expect(isQuote(result)).toBe(true);
    expect(printQuoteSource(result).startsWith(':quote')).toBe(true);
  });

  it('::quote | doc returns the attached Doc-prefix on the type BindStep', async () => {
    const result = await evalQuery('::quote | doc | content');
    expect(typeof result).toBe('string');
    expect(result).toContain('Code as a value');
  });

  it('::quote | laws reads the laws declared under the kind', async () => {
    const result = await evalQuery('::quote | laws | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  // A tag is the address of a name, so it reads the nearest declaration
  // of that name whatever its value holds [D153].
  it('::Tag | source reads the declaration of its name', async () => {
    expect(await evalQuery('42 | :Foo / | ::Foo | source | parse')).toBe(':Foo /');
  });

  it('a tag no declaration names is refused by its address', async () => {
    const result = await evalQuery('::Foo | doc');
    expect(isErrorValue(result)).toBe(true);
    expect(result.originalError.address).toBe('any/doc/UnknownNameError');
    expect(result.originalError).toBeInstanceOf(QlangError);
    expect(result.originalError.facts.name.literal).toBe('::Foo');
  });
});

describe('the axes read what a source of the root declared', () => {
  async function sessionOf(source) {
    const { createSession } = await import('../../src/session.mjs');
    return await createSession({ sources: [{ uri: 'tests/demo', source }] });
  }

  it('reads the laws a source declared under a name', async () => {
    const session = await sessionOf(':demo 99\n:demo/fiveDoubled ::law~(5 | mul 2 | eq 10)');
    expect((await session.evalCell(':demo | laws | count')).result).toBe(1);
  });

  it('reads the page a source declared', async () => {
    const session = await sessionOf(':demo |~~ A short note. ~~|\n1');
    expect((await session.evalCell(':demo | doc | content')).result).toBe(' A short note. ');
  });

  it('answers null for the page of a declaration without one', async () => {
    const session = await sessionOf(':bare 42');
    expect((await session.evalCell(':bare | doc')).result).toBeNull();
  });

  it('refuses a name no source declares', async () => {
    const session = await sessionOf(':somethingElse 1');
    expect((await session.evalCell(':notHere | source !| type')).result.name).toBe('any/source/UnknownNameError');
  });
});

describe('a value that is no name reads the declaration of its kind', () => {
  // The kind `type` answers names the declaration [D61]: an error
  // reads the page of its tag, and a `manifest` entry, a map, reads
  // the page of `::map` whatever its `:kind` field holds.
  it('a materialized error reaches its own tag docs', async () => {
    expect(await evalQuery('10 | div 0 !| doc | content'))
      .toContain('The divisor is not zero');
  });

});

describe('axis-operands resolve the binding the evaluator dispatches', () => {
  // The axes project the one record the scope holds under an address, so
  // a word the reader declares reads as itself, the case the hypertext
  // chain exists for. A name of the reader takes no word of the
  // vocabulary [D166].
  const shadowed = ':any/hundredfold ~(mul 100) | ';

  it('a binding of the reader takes no word of the vocabulary', async () => {
    expect((await evalQuery(':add ~(mul 100) | 2 | add')).tag.name).toBe('bind/NameTakenByVocabularyError');
  });

  it('a word of the reader is the one source reports', async () => {
    expect(await evalQuery(shadowed + '2 | hundredfold')).toBe(200);
    expect(await evalQuery(shadowed + '::any/hundredfold | source | parse')).toBe(':any/hundredfold ~(mul 100)');
  });

  it('doc answers null for a word of the reader that carries no page', async () => {
    expect(await evalQuery(shadowed + '::any/hundredfold | doc')).toBeNull();
  });

  // The reader's declaration of a name the root holds stands over it
  // [D62], [D153].
  it('a cell declaration of a name the root holds is the one the axes read', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession({
      sources: [{ uri: 'probe/shadow', source: ':contested |~~ from the source ~~| 111' }]
    });
    const cellEntry = await sessionInstance.evalCell(
      ':contested |~~ from the cell ~~| 222 | ' +
      '[contested, (:contested | source | parse), (:contested | doc | content)]');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([222, ':contested |~~ from the cell ~~| 222', ' from the cell ']);
  });

  it('a host binding is a record with no source and no docs', async () => {
    // `session.bind` writes the record of a binding without a
    // declaration behind it [D63], which the axes project.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    sessionInstance.bind('hostInstalled', null);
    const sourceEntry = await sessionInstance.evalCell(':hostInstalled | source');
    expect(sourceEntry.result).toBeNull();
    const docsEntry = await sessionInstance.evalCell(':hostInstalled | doc');
    expect(docsEntry.result).toBeNull();
  });
});

describe(':name | binding | /value answers the value of the declaration', () => {
  it('::vec/take reads the descriptor of its primitive, and a part its selector [D164]', async () => {
    expect(printValue(await evalQuery('::vec/take | binding | /value'))).toBe('::builtin{}');
    expect(printValue(await evalQuery('::vec/take | binding :count | /value'))).toBe('~(/0)');
  });

  it('the record of a freeze holds the value', async () => {
    // `:name /` writes the record of a binding under :name in env
    // [D63], which `binding` reads.
    expect(await evalQuery('42 | :answer / | :answer | binding | /value')).toBe(42);
  });
});
