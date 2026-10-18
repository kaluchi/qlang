// The laws of the catalog, run. The laws of a name are declared under
// it [QSSLF#laws]; `runLaws` evaluates each in isolation and reports
// {:law :says :actual :ok :error}, a law whose answer is true passing.
//
// The walk reads every name the root holds by its address [QSDSP#residence],
// and names each failing reader in the assertion message.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { rootAddressesOf } from '../helpers/root-addresses.mjs';
import { failingLawsOf, proseQuotesOf, reportOfLaws } from '../helpers/catalog-pages.mjs';
import { isErrorValue, isSet } from '../../src/types.mjs';

// The readers of the catalog's laws: the address of every name the root
// holds, `::number`, `::vec/count` and `::qlang/values`, each read by
// `runLaws` [QSSLF#laws].
async function catalogReaders() {
  return rootAddressesOf(await langRuntime());
}

describe('the laws of the catalog, run by runLaws', () => {
  it('every law answers true', async () => {
    const failures = await failingLawsOf(evalQuery, await catalogReaders());
    if (failures.length > 0) throw new Error(`${failures.length} law(s) of the catalog failed:\n${reportOfLaws(failures)}`);
  }, 30000);

  it('every law reads back from the text of its code as itself', async () => {
    // `toString` writes each law as the text of its code, which `parse` reads
    // back as the law, a reader whose read answers a failure failing [D362].
    const unequal = [];
    for (const reader of await catalogReaders()) {
      const changed = await evalQuery(`${reader} | laws | vals | map /1 | filter ~(:law it | toString | parse | eq law | not)`);
      if (isErrorValue(changed) || changed.length > 0) unequal.push(reader);
    }
    expect(unequal).toEqual([]);
  }, 30000);

  it('no quote of a page is read as prose', async () => {
    // A quote the parser refuses reads as prose [QSSLF#doc], so a link or a
    // snippet a change of the grammar breaks leaves its page with no
    // failure to show; prose names code inside backticks alone.
    expect(await proseQuotesOf(evalQuery, await catalogReaders())).toEqual([]);
  }, 30000);

  it('the laws of every name answer true and nothing else', async () => {
    const readers = await catalogReaders();
    const distinctOkValues = await evalQuery(`[${readers.join(' ')}] | map ~(runLaws | map /ok) | flat | distinct`);
    expect(isErrorValue(distinctOkValues)).toBe(false);
    expect(isSet(distinctOkValues)).toBe(true);
    expect([...distinctOkValues]).toEqual([true]);
  }, 30000);
});
