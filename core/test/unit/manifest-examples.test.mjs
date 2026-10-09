// The laws of the catalog, run. The laws of a name are declared under
// it [D174]; `runLaws` evaluates each in isolation and reports
// {:law :says :actual :ok :error}, a law whose answer is true passing.
//
// The walk reads every name the root holds by its address [D153], and
// names each failing reader in the assertion message.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { rootAddressesOf } from '../helpers/root-addresses.mjs';
import { isErrorValue, isQSet } from '../../src/types.mjs';
import { printValue } from '../../src/runtime/format.mjs';

const OK_KW      = 'ok';
const LAW_KW     = 'law';
const ERROR_KW   = 'error';
const ACTUAL_KW  = 'actual';

function safeprint(v) {
  try { return printValue(v); }
  catch { return JSON.stringify(v); }
}

// The readers of the catalog's laws: the address of every name the root
// holds, `::number`, `::vec/count` and `::qlang/values`, each read by
// `runLaws` [D124].
async function catalogReaders() {
  return rootAddressesOf(await langRuntime());
}

async function walkCatalogExamples() {
  const failures = [];
  for (const reader of await catalogReaders()) {
    const [readerName, anchor = ''] = reader.split(' ');
    const exampleResults = await evalQuery(`${readerName} | runLaws ${anchor}`);
    if (!Array.isArray(exampleResults)) {
      failures.push({ reader, snippet: 'runLaws', printed: safeprint(exampleResults) });
      continue;
    }
    for (const exampleResult of exampleResults) {
      if (exampleResult.get(OK_KW) === true) continue;
      failures.push({
        reader,
        snippet: safeprint(exampleResult.get(LAW_KW)),
        error:   exampleResult.get(ERROR_KW),
        printed: safeprint(exampleResult.get(ACTUAL_KW))
      });
    }
  }
  return failures;
}

describe('catalog self-test via runLaws', () => {
  it('every Quote example evaluates truthy', async () => {
    const failures = await walkCatalogExamples();
    if (failures.length > 0) {
      const report = failures
        .map(f => `[${f.reader}] ${f.snippet}\n  => ${f.printed}${f.error ? '\n  error: ' + f.error : ''}`)
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
      const changed = await evalQuery(`${reader} | laws | vals | filter ~(payload | :example / | parse | parse | eq example | not)`);
      if (changed.length > 0) unequal.push(reader);
    }
    expect(unequal).toEqual([]);
  }, 30000);

  it('no quote of a page is read as prose', async () => {
    // A quote the parser refuses reads as prose [D94], so a link or a
    // snippet a change of the grammar breaks leaves its page with no
    // failure to show; prose names code inside backticks alone.
    const proseQuotes = [];
    for (const reader of await catalogReaders()) {
      const prose = await evalQuery(`${reader} | doc | segments | filter ~(type | eq ::string) | join ""`);
      if (prose.replace(/`[^`]*`/g, '').includes('~(')) proseQuotes.push(reader);
    }
    expect(proseQuotes).toEqual([]);
  }, 30000);

  it('the /ok distribution over every page is {true}', async () => {
    const readers = await catalogReaders();
    const distinctOkValues = await evalQuery(`[${readers.join(' ')}] * (runLaws * /ok) | flat | distinct`);
    expect(isErrorValue(distinctOkValues)).toBe(false);
    expect(isQSet(distinctOkValues)).toBe(true);
    expect([...distinctOkValues]).toEqual([true]);
  }, 30000);
});
