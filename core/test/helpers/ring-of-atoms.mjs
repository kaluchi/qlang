// The ring of atoms [D42]: every value comes apart into its atoms and a
// shape, and the shape applied to the atoms builds it back, both written
// in qlang with the language's own verbs in `test/qlang/atoms.qlang`.
// The round trip runs over every example of the catalog, read at the
// address of each verb and at the name of each tag it declares, and over
// every literal the conformance cases expect, a failure among them
// caught to its error at rest, its path written into it, and raised again
// [D13]. The examples of the catalog are walked in shares, a
// file each, which run side by side.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession } from '../../src/session.mjs';
import { evalQuery } from '../../src/eval.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { printValue } from '../../src/runtime/format.mjs';
import { isErrorValue } from '../../src/types.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { rootAddressesOf } from './root-addresses.mjs';
import { expectedValueOf } from './expected-value.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const atomsModulePath = join(here, '..', 'qlang', 'atoms.qlang');
const conformanceDir = join(here, '..', 'conformance');
export const RING_TIMEOUT = 240_000;
export const SHARES = 4;

export async function ringSession() {
  const session = await createSession();
  const loaded = await session.evalCell(readFileSync(atomsModulePath, 'utf8'));
  expect(loaded.error, 'atoms.qlang loads').toBeNull();
  return session;
}

// The sources of the values the ring builds back unequal.
export async function unbuiltOf(session, valuesBySource) {
  const unbuilt = [];
  for (const [source, value] of valuesBySource) {
    const rebuilding = isErrorValue(value) ? '!| union {:trail (trail)} | rebuilt | raise' : 'rebuilt';
    if (!deepEqual((await session.evalCell(rebuilding, { initialPipeValue: value })).result, value)) unbuilt.push(source);
  }
  return unbuilt;
}

export async function catalogExamples() {
  const addresses = rootAddressesOf(await langRuntime());
  const laws = [...await evalQuery(`[${addresses.join(' ')}] | map ~(laws | vals | map ~/1) | flat`)];
  return new Map(laws.map(law => [printValue(law), law]));
}

export async function conformanceLiterals() {
  const literalsByPrint = new Map();
  for (const caseFile of readdirSync(conformanceDir, { recursive: true }).map(String).filter(name => name.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(conformanceDir, caseFile), 'utf8').split(/\r?\n/)) {
      if (line.trim() === '' || line.trim().startsWith('//')) continue;
      const literal = await expectedValueOf(JSON.parse(line).expect);
      literalsByPrint.set(printValue(literal), literal);
    }
  }
  return literalsByPrint;
}

// The ring over one share of the examples of the catalog, every
// SHARES-th of them from the share's place.
export function describeCatalogShare(share) {
  describe(`the ring of atoms over share ${share} of ${SHARES} of the catalog [D42]`, () => {
    let session;
    beforeAll(async () => { session = await ringSession(); }, RING_TIMEOUT);

    it('builds every example of the share back from its atoms', async () => {
      const shared = [...await catalogExamples()].filter((_, index) => index % SHARES === share - 1);
      expect(await unbuiltOf(session, shared)).toEqual([]);
    }, RING_TIMEOUT);
  });
}
