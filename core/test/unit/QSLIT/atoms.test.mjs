import { it, expect, beforeAll } from 'vitest';
import {
  RING_TIMEOUT, ringSession, unbuiltOf, conformanceLiterals
} from '../../helpers/ring-of-atoms.mjs';

let ringSessionOfFile;

beforeAll(async () => {
  ringSessionOfFile = await ringSession();
}, RING_TIMEOUT);

it('the ring of atoms keeps the examples of its own verbs true', async () => {
  expect((await ringSessionOfFile.evalCell('::any/apart | runLaws | map /ok')).result).toEqual([true]);
});

it('builds every literal of the conformance cases back from its atoms', async () => {
  expect(await unbuiltOf(ringSessionOfFile, await conformanceLiterals())).toEqual([]);
}, RING_TIMEOUT);
