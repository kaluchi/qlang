// The ring of atoms [QSLIT#atoms] over the examples of its own verbs and every
// literal the conformance cases expect; the examples of the catalog are
// walked in shares, `atoms-catalog-*.test.mjs`.

import { describe, it, expect, beforeAll } from 'vitest';
import {
  RING_TIMEOUT, ringSession, unbuiltOf, conformanceLiterals
} from '../helpers/ring-of-atoms.mjs';

let ringSessionOfFile;

beforeAll(async () => {
  ringSessionOfFile = await ringSession();
}, RING_TIMEOUT);

describe('the ring of atoms', () => {
  it('[QSLIT#atoms] keeps the examples of its own verbs true', async () => {
    expect((await ringSessionOfFile.evalCell('::any/apart | runLaws | map /ok')).result).toEqual([true]);
  });

  it('[QSLIT#atoms] builds every literal of the conformance cases back from its atoms', async () => {
    expect(await unbuiltOf(ringSessionOfFile, await conformanceLiterals())).toEqual([]);
  }, RING_TIMEOUT);
});
