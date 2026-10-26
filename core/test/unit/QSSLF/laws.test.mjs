import { describe, it, expect } from 'vitest';
import { evalQuery, createNotebook } from '../../../src/notebook.mjs';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { failingLawsOf, reportOfLaws } from '../../helpers/catalog-pages.mjs';
import { isErrorValue, isSet, makeTag, makeBinding, makeKeyword } from '../../../src/types.mjs';
import { catalogReaders } from '../../helpers/catalog-readers.mjs';

async function sessionOf(source) {
  const { createNotebook } = await import('../../../src/notebook.mjs');
  return await createNotebook({ sources: [{ uri: 'tests/demo', source }] });
}

it('reads the laws a source declared under a name', async () => {
  const notebook = await sessionOf(':demo 99\n:demo/fiveDoubled ::law~(5 | mul 2 | eq 10)');
  expect((await notebook.evalCell('::demo | laws | count')).result).toBe(1);
});

describe('the laws of the catalog, run by runLaws', () => {
  it('every law answers true', async () => {
    const failures = await failingLawsOf(evalQuery, await catalogReaders());
    expect(failures, `${failures.length} law(s) of the catalog failed:\n${reportOfLaws(failures)}`).toEqual([]);
  }, 30000);

  it('every law reads back from the text of its code as itself', async () => {
    // [QSQUO#parse]
    const unequal = [];
    for (const reader of await catalogReaders()) {
      const changed = await evalQuery(`${reader} | laws | vals | map /1 | filter ~(:law it | toString | parse | eq law | not)`);
      if (isErrorValue(changed) || changed.length > 0) unequal.push(reader);
    }
    expect(unequal).toEqual([]);
  }, 30000);

  it('the laws of every name answer true and nothing else', async () => {
    const readers = await catalogReaders();
    const distinctOkValues = await evalQuery(`[${readers.join(' ')}] | map ~(runLaws | map /ok) | flat | distinct`);
    expect(isErrorValue(distinctOkValues)).toBe(false);
    expect(isSet(distinctOkValues)).toBe(true);
    expect([...distinctOkValues]).toEqual([true]);
  }, 30000);
});

describe('runLaws reads a name as laws does', () => {
  it('a binding no declaration wrote runs no law and reads no page', async () => {
    // [QSNAM#binding]
    const scope = new Map(await langRuntime()).set('hostInjected', makeBinding({ name: makeKeyword('hostInjected'), value: 42 }));
    const sessionInstance = await createNotebook({ scope });
    const cellEntry = await sessionInstance.evalCell('::hostInjected | runLaws');
    expect(cellEntry.result).toEqual([]);
    const pageEntry = await sessionInstance.evalCell('::hostInjected | doc');
    expect(pageEntry.result).toBeNull();
  });

  it('the tag of a name several kinds answer is refused with their addresses', async () => {
    const addresses = await evalQuery('::count | runLaws !| addresses');
    expect([...addresses].map(address => address.name).sort()).toEqual(['excerpt/count', 'map/count', 'string/count', 'vec/count']);
  });

  it('a value runs the laws of its kind, as doc reads its page', async () => {
    const results = await evalQuery('42 | runLaws');
    expect(isErrorValue(results)).toBe(false);
    expect(results.map(result => result.get('law').name)).toEqual((await evalQuery('::number | runLaws')).map(result => result.get('law').name));
  });
});

describe('the outcome of each law', () => {
  it('a name a source declares with no law under it runs none', async () => {
    const notebook = await createNotebook({
      sources: [{ uri: 'tests/source', source: ':bare 42' }]
    });
    const cellEntry = await notebook.evalCell('::bare | runLaws | count');
    expect(cellEntry.result).toBe(0);
  });

  it('a law a source of the root declares runs from a cell', async () => {
    // [QSQUO#held]
    const moduleSource = ':fortytwo 1\n:fortytwo/addsUp |~~ Tracks the scope through runLaws. ~~| ::law~(40 | add 2 | eq 42)';
    const notebook = await createNotebook({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellEntry = await notebook.evalCell(
      '::fortytwo | runLaws | first | get /ok');
    expect(cellEntry.result).toBe(true);
  });

  it('a law does not leak the writes of a declaration back into the calling notebook', async () => {
    const moduleSource = ':writer 1\n:writer/declares |~~ Declares a name of its own. ~~| ::law~(:scratch 99 | scratch | eq 99)';
    const notebook = await createNotebook({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellRun = await notebook.evalCell(
      '::writer | runLaws | first | get /ok');
    expect(cellRun.result).toBe(true);
    const cellProbe = await notebook.evalCell('scratch');
    expect(isErrorValue(cellProbe.result)).toBe(true);
    expect(cellProbe.result.tag)
      .toEqual(makeTag('call/UnknownNameError'));
  });

  it('a law that raises a map holds it at rest as its :error, its :message among its facts', async () => {
    const moduleSource = ':demo 1\n:demo/raises |~~ A user-built error. ~~| ::law~({:message "hand-built failure" :kind :test} | raise)';
    const notebook = await createNotebook({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellEntry = await notebook.evalCell('::demo | runLaws | first');
    expect(cellEntry.result.get('ok')).toBe(false);
    expect(cellEntry.result.get('error').get('message')).toBe('hand-built failure');
  });
});
