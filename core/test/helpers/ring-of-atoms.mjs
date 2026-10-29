// [QSLIT#atoms], [QSERR#trace]

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createNotebook, evalQuery } from '../../src/notebook.mjs';
import { langRuntime } from '../../src/runtime/lang-runtime.mjs';
import { printValue } from '../../src/print-value.mjs';
import { isErrorValue } from '../../src/types.mjs';
import { compareValues } from '../../src/ordering.mjs';
import { rootAddressesOf } from './root-addresses.mjs';
import { writtenLiteralOf } from './expected-value.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const atomsModulePath = join(here, '..', 'qlang', 'atoms.qlang');
const conformanceDir = join(here, '..', 'conformance');
export const RING_TIMEOUT = 240_000;
export const SHARES = 4;

export async function ringNotebook() {
  const notebook = await createNotebook();
  const loaded = await notebook.evalCell(readFileSync(atomsModulePath, 'utf8'));
  expect([loaded.defect, isErrorValue(loaded.result)], 'atoms.qlang loads').toEqual([null, false]);
  return notebook;
}

export async function unbuiltOf(notebook, valuesBySource) {
  const unbuilt = [];
  for (const [source, value] of valuesBySource) {
    const taken = isErrorValue(value) ? (await notebook.evalCell('!| it', { initialPipeValue: value })).result : value;
    if (compareValues((await notebook.evalCell('rebuilt', { initialPipeValue: taken })).result, taken) !== 0) unbuilt.push(source);
  }
  return unbuilt;
}

export async function catalogExamples() {
  const addresses = rootAddressesOf(await langRuntime());
  const laws = [...await evalQuery(`[${addresses.join(' ')}] | map ~(laws | vals | map /1) | flat`)];
  return new Map(laws.map(law => [printValue(law), law]));
}

export async function conformanceLiterals() {
  const literalsByPrint = new Map();
  for (const caseFile of readdirSync(conformanceDir, { recursive: true }).map(String).filter(name => name.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(conformanceDir, caseFile), 'utf8').split(/\r?\n/)) {
      if (line.trim() === '' || line.trim().startsWith('//')) continue;
      const literal = await evalQuery(writtenLiteralOf(JSON.parse(line)));
      literalsByPrint.set(printValue(literal), literal);
    }
  }
  return literalsByPrint;
}

export function describeCatalogShare(share) {
  describe(`the ring of atoms over share ${share} of ${SHARES} of the catalog`, () => {
    let notebook;
    beforeAll(async () => { notebook = await ringNotebook(); }, RING_TIMEOUT);

    it('builds every example of the share back from its atoms', async () => {
      const shared = [...await catalogExamples()].filter((_, index) => index % SHARES === share - 1);
      expect(await unbuiltOf(notebook, shared)).toEqual([]);
    }, RING_TIMEOUT);
  });
}
