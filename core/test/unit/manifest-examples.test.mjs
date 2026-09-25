// Regression catcher for core.qlang examples.
//
// Every operand in core.qlang carries a docs prefix whose Quote
// segments are executable test cases. runExamples evaluates each
// Quote in isolation and reports {:snippet :actual :ok :error}; a
// Quote whose eval result is truthy passes, otherwise it fails.
//
// This walks every verb of the core by its address, the nouns
// listing what lives on them [D62], and every tag the catalog
// declares by its name, and surfaces each failing reader in the
// assertion message instead of reducing the result to a single
// boolean.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { catalogEntriesOf } from '../helpers/catalog-entries.mjs';
import { isErrorValue, isQSet } from '../../src/types.mjs';
import { printValue } from '../../src/runtime/format.mjs';
import { printQuoteSource } from '../../src/quote.mjs';

const OK_KW      = 'ok';
const SNIPPET_KW = 'snippet';
const ERROR_KW   = 'error';
const ACTUAL_KW  = 'actual';

function safeprint(v) {
  try { return printValue(v); }
  catch { return JSON.stringify(v); }
}

// The readers of the catalog's examples: the address of every verb of
// the core, `::vec/count`, and the name of every tag it declares,
// `::AddLeftNotNumberError`, each a subject `runExamples` and
// `examples` read.
async function catalogReaders() {
  const verbAddresses = await evalQuery('::qlang | manifest * manifest | flat');
  const tagNames = catalogEntriesOf(await langRuntime(), { tags: true }).map(entry => entry.get('name'));
  return [...[...verbAddresses].map(address => address.literal), ...tagNames];
}

async function walkCatalogExamples() {
  const failures = [];
  for (const reader of await catalogReaders()) {
    const exampleResults = await evalQuery(`${reader} | runExamples`);
    if (!Array.isArray(exampleResults)) {
      failures.push({ reader, snippet: 'runExamples', printed: safeprint(exampleResults) });
      continue;
    }
    for (const exampleResult of exampleResults) {
      if (exampleResult.get(OK_KW) === true) continue;
      failures.push({
        reader,
        snippet: printQuoteSource(exampleResult.get(SNIPPET_KW)),
        error:   exampleResult.get(ERROR_KW),
        printed: safeprint(exampleResult.get(ACTUAL_KW))
      });
    }
  }
  return failures;
}

describe('catalog self-test via runExamples', () => {
  it('every Quote example evaluates truthy', async () => {
    const failures = await walkCatalogExamples();
    if (failures.length > 0) {
      const report = failures
        .map(f => `[${f.reader}] ~(${f.snippet})\n  => ${f.printed}${f.error ? '\n  error: ' + f.error : ''}`)
        .join('\n');
      throw new Error(`${failures.length} catalog example(s) failed:\n${report}`);
    }
  }, 30000);

  it('every example reads back as the steps it prints as', async () => {
    // `parse` prints a quote and reads text back; an example that
    // printed as text reading back as other steps would be a printer
    // that loses code.
    const unequal = [];
    for (const reader of await catalogReaders()) {
      const changed = await evalQuery(`${reader} | examples | filter ~(:example / | parse | parse | eq example | not)`);
      if (changed.length > 0) unequal.push(reader);
    }
    expect(unequal).toEqual([]);
  }, 30000);

  it('every verb of the catalog lives on a noun', async () => {
    const verbNames = catalogEntriesOf(await langRuntime(), { tags: false }).map(entry => entry.get('name'));
    const addressedNames = new Set([...await evalQuery('::qlang | manifest * manifest | flat')]
      .map(address => address.name.slice(address.name.lastIndexOf('/') + 1)));
    expect(verbNames.filter(verbName => !addressedNames.has(verbName))).toEqual([]);
  });

  it('the /ok distribution over every verb is {true}', async () => {
    const distinctOkValues = await evalQuery('::qlang | manifest * manifest | flat * (runExamples * /ok) | flat | distinct');
    expect(isErrorValue(distinctOkValues)).toBe(false);
    expect(isQSet(distinctOkValues)).toBe(true);
    expect([...distinctOkValues]).toEqual([true]);
  }, 30000);
});
