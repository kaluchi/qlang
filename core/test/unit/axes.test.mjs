// The axes, `source`, `doc` and `binding`, read the record a declaration
// wrote into its scope [QSNAM#binding].

import { describe, it, expect } from 'vitest';
import { printValue } from '../../src/index.mjs';
import { evalQuery } from '../../src/session.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { ROOT_KEY } from '../../src/scope-keys.mjs';
import { isErrorValue, isQuote, makeTag } from '../../src/types.mjs';
import { QlangError } from '../../src/errors.mjs';
import { printQuoteSource } from '../../src/print-value.mjs';

describe('::name | source answers the quote of the declarations under the name', () => {
  it('a source of the root that declares nothing adds no node to the root', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const session = await createSession({ sources: [{ uri: 'tests/atom-only', source: '42' }] });
    expect([...session.scope.get(ROOT_KEY).keys()]).toEqual([...(await langRuntime()).get(ROOT_KEY).keys()]);
  });

  it('the axes read a declaration of the query', async () => {
    // A declaration of the query writes its record into the query's
    // scope, which the axes read.
    const result = await evalQuery(':myLocal 42 | ::myLocal | source');
    expect(isQuote(result)).toBe(true);
    expect(printQuoteSource(result)).toBe(':myLocal 42');
  });

  it('the axes of a later cell read a declaration of an earlier one', async () => {
    // The session's scope keeps the records earlier cells wrote, so a
    // later cell's axes read them beside its own.
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':foo |~~ first cell ~~|');
    const cellEntry = await sessionInstance.evalCell('::foo | doc | content');
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toBe(' first cell ');
  });

  it('the axes read a name with a path at its address, under a noun that is a name of data', async () => {
    // `:landing/chapter01` declares a node under `landing`, whose record
    // the axes read at its address [QSNAM#address].
    const { createSession } = await import('../../src/session.mjs');
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell(
      ':landing {} | :landing/chapter01 |~~ Глава из лендинг пейджа ~~| | ::landing/chapter01 | doc | content');
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toBe(' Глава из лендинг пейджа ');
  });

  it('a value that is no name reads the declaration of its kind', async () => {
    expect(await evalQuery('42 | source | eq (::number | source)')).toBe(true);
    expect(await evalQuery('{:a 1} | source | eq (::map | source)')).toBe(true);
  });
});

describe('::name | doc returns the page the docs of its slot make', () => {
  it('a value under a tag no binding declares reads the kind beneath it [QSSLF#axis]', async () => {
    expect(await evalQuery('::Ghost#1 | doc | eq (::number | doc)')).toBe(true);
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

  it('::quote | source reads the declaration of the kind in the source of the catalog that declares it', async () => {
    const result = await evalQuery('::quote | source');
    expect(isQuote(result)).toBe(true);
    expect(printQuoteSource(result).startsWith(':quote')).toBe(true);
  });

  it('::quote | doc reads the page the declaration of the kind holds, the page a quote reads', async () => {
    expect(await evalQuery('::quote | doc | get [~(type) ~(eq (~(1) | doc))]')).toEqual(await evalQuery('[::doc true]'));
  });

  it('an axis refusing a tag no declaration names hands its host the QlangError under `originalError`, with its address and its facts', async () => {
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
});

describe('a value that is no name reads the declaration of its kind', () => {
  // An error at rest reads by `doc` the page of its tag [QSSLF#axis].
  it('an error at rest reads the page of its tag', async () => {
    expect(await evalQuery('10 | div 0 !| doc | content'))
      .toContain('The divisor is not zero');
  });
});

describe('the axes resolve the binding the evaluator dispatches', () => {
  // The axes read the one record the scope holds under an address, so a
  // verb the reader declares reads as itself [QSNAM#binding].
  const hundredfold = ':any/hundredfold ~(mul 100) | ';

  it('doc answers null for a verb of the reader that carries no page', async () => {
    expect(await evalQuery(hundredfold + '::any/hundredfold | doc')).toBeNull();
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
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toEqual([222, ':contested |~~ from the cell ~~| 222', ' from the cell ']);
  });

  it('a node a chain lays reads the page the chain wrote [QSSLF#axis]', async () => {
    expect(await evalQuery('::number/add/addend | doc | content')).toContain('The number added to the subject');
  });
});

describe('::name | binding | /value answers the value of the declaration', () => {
  it('::vec/take reads its function, whose recipe is the descriptor of its primitive, and an input its place [QSBLD#input], [QSBLD#fn]', async () => {
    expect(printValue(await evalQuery('::vec/take | binding | get /value | get /1'))).toBe('::builtin{}');
    expect(printValue(await evalQuery('::vec/take | binding :count | get /value'))).toBe('/0');
  });
});
