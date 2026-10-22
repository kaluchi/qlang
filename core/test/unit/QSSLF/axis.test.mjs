import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { isErrorValue, isQuote, makeTag } from '../../../src/types.mjs';
import { QlangError } from '../../../src/errors.mjs';
import { printQuoteSource } from '../../../src/print-value.mjs';
import { BOX } from '../../helpers/box.mjs';

describe('::name | source answers the quote of the declarations under the name', () => {
  it('the axes read a declaration of the query', async () => {
    const result = await evalQuery(':myLocal 42 | ::myLocal | source');
    expect(isQuote(result)).toBe(true);
    expect(printQuoteSource(result)).toBe(':myLocal 42');
  });

  it('the axes of a later cell read a declaration of an earlier one', async () => {
    const { createSession } = await import('../../../src/session.mjs');
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':foo |~~ first cell ~~|');
    const cellEntry = await sessionInstance.evalCell('::foo | doc | content');
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toBe('first cell');
  });

  it('the axes read a name with a path at its address, under a noun that is a name of data', async () => {
    // [QSNAM#address]
    const { createSession } = await import('../../../src/session.mjs');
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell(
      ':landing {} | :landing/chapter01 |~~ Глава из лендинг пейджа ~~| | ::landing/chapter01 | doc | content');
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toBe('Глава из лендинг пейджа');
  });

  it('a value that is no name reads the declaration of its kind', async () => {
    expect(await evalQuery('42 | source | eq (::number | source)')).toBe(true);
    expect(await evalQuery('{:a 1} | source | eq (::map | source)')).toBe(true);
  });
});

it('`doc` of a value under a tag no binding declares reads the kind beneath it', async () => {
  expect(await evalQuery('::Ghost#1 | doc | eq (::number | doc)')).toBe(true);
});

describe('the axes read the node a tag addresses', () => {
  it('a keyword is a value and names nothing: it reads the source of its kind', async () => {
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

  it('an axis refusing a tag no declaration names hands its host the refusal under `originalError`, with its address and its facts', async () => {
    const result = await evalQuery('::Foo | doc');
    expect(isErrorValue(result)).toBe(true);
    expect(result.originalError.address).toBe('any/doc/UnknownNameError');
    expect(result.originalError).toBeInstanceOf(QlangError);
    expect(result.originalError.facts.name.literal).toBe('::Foo');
  });
});

describe('the axes read what a source of the root declared', () => {
  async function sessionOf(source) {
    const { createSession } = await import('../../../src/session.mjs');
    return await createSession({ sources: [{ uri: 'tests/demo', source }] });
  }

  it('reads the page a source declared', async () => {
    const session = await sessionOf(':demo |~~ A short note. ~~|\n1');
    expect((await session.evalCell('::demo | doc | content')).result).toBe('A short note.');
  });

  it('answers null for the page of a declaration without one', async () => {
    const session = await sessionOf(':bare 42');
    expect((await session.evalCell('::bare | doc')).result).toBeNull();
  });
});

it('an error at rest reads the page of its tag', async () => {
  expect(await evalQuery('10 | div 0 !| doc | content'))
    .toContain('The divisor is not zero');
});

describe('the axes resolve the binding the evaluator dispatches', () => {
  // [QSNAM#binding]
  const hundredfold = ':any/hundredfold ~(mul 100) | ';

  it('doc answers null for a verb of the reader that carries no page', async () => {
    expect(await evalQuery(hundredfold + '::any/hundredfold | doc')).toBeNull();
  });

  // [QSDSP#walk], [QSDSP#residence]
  it('a cell declaration of a name the root holds is the one the axes read', async () => {
    const { createSession } = await import('../../../src/session.mjs');
    const sessionInstance = await createSession({
      sources: [{ uri: 'probe/shadow', source: ':contested |~~ from the source ~~| 111' }]
    });
    const cellEntry = await sessionInstance.evalCell(
      ':contested |~~ from the cell ~~| 222 | ' +
      'get [~(contested), ~(::contested | source | toString), ~(::contested | doc | content)]');
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toEqual([222, ':contested |~~ from the cell ~~| 222', 'from the cell']);
  });

  it('a node a chain lays reads the page the chain wrote', async () => {
    expect(await evalQuery('::number/add/addend | doc | content')).toContain('The number added to the subject');
  });
});

it('source on a declaration of it answers the declaration', async () => {
  const source = await evalQuery('42 | :snap it | ::snap | source | toString');
  expect(source).toBe(':snap it');
});

describe('source axis prints the declaration for rare forms of a body', () => {
  it('renders a call that gives no modifiers as the body of a declaration', async () => {
    expect(await evalQuery('[1 2] | :x count | ::x | source | toString')).toBe(':x count');
  });

  it('a line comment inside the body of a declaration leaves no step', async () => {
    const evalResult = await evalQuery(':x (42 |~| note\n) | ::x | source | toString');
    expect(evalResult).toBe(':x (42)');
  });

  it('renders an error literal as the body of a declaration', async () => {
    expect(await evalQuery(':x !{:a 1} | ::x | source | toString')).toBe(':x !{:a 1}');
  });

  it('renders a group that opens with `!|` as the body of a declaration', async () => {
    // [QSNAM#declare]
    expect(await evalQuery(':handler (!| get /kind) | ::handler | source | toString')).toBe(':handler (!| get /kind)');
  });
});

it('reads the page of the invariant that refused, named by its refusal', async () => {
  expect(await evalQuery(BOX + '::Box[4 2] | put "x" !| explain | page | content'))
    .toBe('The weight is a number.');
});

it('a value whose tag no node answers reads the page of the kind beneath it', async () => {
  expect(await evalQuery('::Box#[3 1] | doc | eq (::set | doc)')).toBe(true);
});

describe('the subject an axis reads', () => {
  it('a value tagged by a user tag reads the source of that tag', async () => {
    const source = await evalQuery(':Box |~~ A box. ~~| | ::Box#[3 1] | source');
    expect(printQuoteSource(source)).toBe(':Box |~~ A box. ~~|');
  });

  it('a map holding a tag in its :kind field reads ::map, since a field names nothing', async () => {
    expect(await evalQuery(
      ':myType |~~ myType. ~~| (::kind | impl ::builtin{}) | {:kind ::myType :payload []} | source | eq (::map | source)'
    )).toBe(true);
  });
});
