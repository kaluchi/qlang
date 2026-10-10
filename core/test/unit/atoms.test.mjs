// The ring of atoms [D42] over the examples of its own verbs and every
// literal the conformance cases expect; the examples of the catalog are
// walked in shares, `atoms-catalog-*.test.mjs`, and the parts of the ring
// still open are examples the catalog holds.

import { describe, it, expect, beforeAll } from 'vitest';
import {
  RING_TIMEOUT, OPEN_EXAMPLES, ringSession, unbuiltOf, catalogExamples, conformanceLiterals
} from '../helpers/ring-of-atoms.mjs';

let ringSessionOfFile;

beforeAll(async () => {
  ringSessionOfFile = await ringSession();
}, RING_TIMEOUT);

describe('the ring of atoms [D42]', () => {
  it('keeps the examples of its own verbs true', async () => {
    expect((await ringSessionOfFile.evalCell('::any/apart | runLaws | map ~/ok')).result).toEqual([true]);
  });

  it('holds open only examples of the catalog', async () => {
    const examples = await catalogExamples();
    expect([...OPEN_EXAMPLES.keys()].filter(source => !examples.has(source))).toEqual([]);
  });

  it('builds every literal of the conformance cases back from its atoms', async () => {
    expect(await unbuiltOf(ringSessionOfFile, await conformanceLiterals())).toEqual([]);
  }, RING_TIMEOUT);
});
