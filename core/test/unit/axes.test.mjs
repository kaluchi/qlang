// The axes, `source`, `doc` and `binding`, read the record a declaration
// wrote into its scope [QSNAM#binding].

import { describe, it, expect } from 'vitest';
import { printValue } from '../../src/index.mjs';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, isQuote, makeTag } from '../../src/types.mjs';
import { QlangError } from '../../src/errors.mjs';
import { printQuoteSource } from '../../src/quote.mjs';

describe('::name | source answers the quote of the declarations under the name', () => {
  it('::vec/count | source carries the declaration by its address', async () => {
    const result = await evalQuery('::vec/count | source');
    expect(isQuote(result)).toBe(true);
    expect(printQuoteSource(result).startsWith(':vec/count')).toBe(true);
  });

  it('a source of the root that declares nothing writes no record to read', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession({ sources: [{ uri: 'tests/atom-only', source: '42' }] });
    const cellEntry = await session.evalCell('::missing | source !| type');
    expect(cellEntry.result).toEqual(makeTag('any/source/UnknownNameError'));
  });

  it('the axes read a declaration of the query', async () => {
    // A declaration of the query writes its record into the query's
    // scope, which the axes read.
    const result = await evalQuery(':myLocal 42 | ::myLocal | source');
    expect(isQuote(result)).toBe(true);
    expect(printQuoteSource(result)).toBe(':myLocal 42');
  });

  it('the axes read a declaration of the cell', async () => {
    // A cell's declaration writes its record into the session's scope,
    // which the axes read.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell(
      ':foo |~~ a note ~~| | ::foo | doc | content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(' a note ');
  });

  it('the axes of a later cell read a declaration of an earlier one', async () => {
    // The session's scope keeps the records earlier cells wrote, so a
    // later cell's axes read them beside its own.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':foo |~~ first cell ~~|');
    const cellEntry = await sessionInstance.evalCell('::foo | doc | content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(' first cell ');
  });

  it('the axes read a name with a path at its address', async () => {
    // `:landing/chapter01` declares a node under `landing`, whose record
    // the axes read at its address [QSNAM#address].
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell(
      ':landing {} | :landing/chapter01 |~~ Глава из лендинг пейджа ~~| | ::landing/chapter01 | doc | content');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(' Глава из лендинг пейджа ');
  });

  it('a value that is no name reads the declaration of its kind', async () => {
    expect(await evalQuery('42 | source | eq (::number | source)')).toBe(true);
    expect(await evalQuery('{:impl :unbound} | source | eq (::map | source)')).toBe(true);
  });
});

describe('::name | doc returns the page the docs of its slot make', () => {
  it('::vec/count | doc returns a page', async () => {
    const result = await evalQuery('::vec/count | doc | type');
    expect(result).toEqual(makeTag('doc'));
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
    const err = await evalQuery('::totallyMadeUp | doc');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('any/doc/UnknownNameError'));
  });

  it('a value under a tag no binding declares reads the kind beneath it [QSSLF#axis]', async () => {
    expect(await evalQuery('::Ghost#1 | doc | eq (::number | doc)')).toBe(true);
  });
});

describe('::name | laws reads the laws declared under a name', () => {
  it('::vec/count | laws answers its laws by their names', async () => {
    const result = await evalQuery('::vec/count | laws | count');
    expect(result).toBeGreaterThan(0);
  });

  it('a value that is no name reads the laws of its kind', async () => {
    expect(await evalQuery('42 | laws | eq (::number | laws)')).toBe(true);
  });
});

describe('the axes read the node a tag addresses', () => {
  it('a keyword is a value and names nothing: it reads the source of its kind [QSLIT#keyword]', async () => {
    expect(await evalQuery(':"::vec" | source')).toEqual(await evalQuery('::keyword | source'));
  });

  it('a tag of a name several kinds answer is refused with the addresses of its pages, one on each kind that answers it', async () => {
    expect([...await evalQuery('::count | doc !| get /addresses')])
      .toEqual([makeTag('map/count'), makeTag('string/count'), makeTag('vec/count')]);
  });

  it('::quote | source reads the declaration of the kind in the language\'s module', async () => {
    const result = await evalQuery('::quote | source');
    expect(isQuote(result)).toBe(true);
    expect(printQuoteSource(result).startsWith(':quote')).toBe(true);
  });

  it('::quote | doc returns the page in the slot of the declaration of the kind', async () => {
    const result = await evalQuery('::quote | doc | content');
    expect(typeof result).toBe('string');
    expect(result).toContain('code held as a value');
  });

  it('::quote | laws reads the laws declared under the kind', async () => {
    const result = await evalQuery('::quote | laws | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  // A tag is the address of a name, so it reads the nearest declaration
  // of that name whatever its value holds [QSDSP#residence].
  it('::Tag | source reads the declaration of its name', async () => {
    expect(await evalQuery('42 | :Foo it | ::Foo | source | toString')).toBe(':Foo it');
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
    expect((await session.evalCell('::demo | laws | count')).result).toBe(1);
  });

  it('reads the page a source declared', async () => {
    const session = await sessionOf(':demo |~~ A short note. ~~|\n1');
    expect((await session.evalCell('::demo | doc | content')).result).toBe(' A short note. ');
  });

  it('answers null for the page of a declaration without one', async () => {
    const session = await sessionOf(':bare 42');
    expect((await session.evalCell('::bare | doc')).result).toBeNull();
  });

  it('refuses a name no source declares', async () => {
    const session = await sessionOf(':somethingElse 1');
    expect((await session.evalCell('::notHere | source !| type')).result.name).toBe('any/source/UnknownNameError');
  });
});

describe('a value that is no name reads the declaration of its kind', () => {
  // The kind `type` answers names the declaration [QSSLF#axis]: an error
  // reads the page of its tag, and a `manifest` entry, a map, reads
  // the page of `::map` whatever its `:kind` field holds.
  it('a materialized error reaches its own tag docs', async () => {
    expect(await evalQuery('10 | div 0 !| doc | content'))
      .toContain('The divisor is not zero');
  });

});

describe('the axes resolve the binding the evaluator dispatches', () => {
  // The axes project the one record the scope holds under an address, so
  // a verb the reader declares reads as itself, the case the hypertext
  // chain exists for. A value of the reader's named as a verb meets the
  // verb at a step whose subject the verb answers [QSNAM#reach].
  const shadowed = ':any/hundredfold ~(mul 100) | ';

  it('a value of the reader named as a verb meets the verb where the subject answers it', async () => {
    expect((await evalQuery(':add ~(mul 100) | 2 | add')).tag.name).toBe('call/ValueMeetsVerbError');
  });

  it('a verb of the reader is the one source reports', async () => {
    expect(await evalQuery(shadowed + '2 | hundredfold')).toBe(200);
    expect(await evalQuery(shadowed + '::any/hundredfold | source | toString')).toBe(':any/hundredfold ~(mul 100)');
  });

  it('doc answers null for a verb of the reader that carries no page', async () => {
    expect(await evalQuery(shadowed + '::any/hundredfold | doc')).toBeNull();
  });

  // The reader's declaration of a name the root holds stands over it
  // [QSDSP#walk], [QSDSP#residence].
  it('a cell declaration of a name the root holds is the one the axes read', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession({
      sources: [{ uri: 'probe/shadow', source: ':contested |~~ from the source ~~| 111' }]
    });
    const cellEntry = await sessionInstance.evalCell(
      ':contested |~~ from the cell ~~| 222 | ' +
      'get [~(contested), ~(::contested | source | toString), ~(::contested | doc | content)]');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toEqual([222, ':contested |~~ from the cell ~~| 222', ' from the cell ']);
  });

  it('a binding no declaration wrote, a node a chain lays, holds no source, its page the one the chain wrote [D361]', async () => {
    expect(await evalQuery('::number/add/addend | source')).toBeNull();
    expect(await evalQuery('::number/add/addend | binding | get /source')).toBeNull();
    expect(await evalQuery('::number/add/addend | doc | content')).toContain('The number added to the subject');
  });
});

describe('::name | binding | /value answers the value of the declaration', () => {
  it('::vec/take reads its function, whose recipe is the descriptor of its primitive, and an input its place [QSBLD#input], [QSBLD#fn]', async () => {
    expect(printValue(await evalQuery('::vec/take | binding | get /value | get /1'))).toBe('::builtin{}');
    expect(printValue(await evalQuery('::vec/take | binding :count | get /value'))).toBe('/0');
  });

  it('the record of a declaration of it holds the value', async () => {
    // `:name it` writes the record of a binding under :name in env
    // [QSNAM#binding], which `binding` reads.
    expect(await evalQuery('42 | :answer it | ::answer | binding | get /value')).toBe(42);
  });
});
