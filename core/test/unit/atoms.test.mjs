// The ring of atoms [D42]: every value comes apart into its atoms and a
// shape, and the shape applied to the atoms builds it back, both written
// in qlang with the language's own verbs in `test/qlang/atoms.qlang`.
// The round trip runs over every example of the catalog, read at the
// address of each verb and at the name of each tag it declares, and over
// every literal the conformance cases expect. A value built back unequal
// is a part of the ring still open, listed with the reason it is, and an
// open part that closes fails the walk until it leaves the list.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession } from '../../src/session.mjs';
import { evalQuery } from '../../src/eval.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { printValue } from '../../src/runtime/format.mjs';
import { printQuoteSource } from '../../src/quote.mjs';
import { catalogEntriesOf } from '../helpers/catalog-entries.mjs';
import { expectedValueOf } from '../helpers/expected-value.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const atomsModulePath = join(here, '..', 'qlang', 'atoms.qlang');
const conformanceDir = join(here, '..', 'conformance');
const RING_TIMEOUT = 120_000;

const OPEN_EXAMPLES = new Map([
  // The step of an error literal whose trail is no vector of stops:
  // `error`, the one verb that builds an error from its fields, refuses
  // that trail, since the error a step produces holds its path there.
  ['!{:kind :oops :trail 5} !| [type /actualType] | eq [::ErrorTrailNotVecError ::number]',
    'no verb builds an error step whose trail is no vector of stops'],
]);

let ringSession;

beforeAll(async () => {
  ringSession = await createSession();
  const loaded = await ringSession.evalCell(readFileSync(atomsModulePath, 'utf8'));
  expect(loaded.error, 'atoms.qlang loads').toBeNull();
});

// The sources of the values the ring builds back unequal. Each value
// goes in a vector, which no name calls and around which no error
// deflects.
async function unbuiltOf(valuesBySource) {
  const unbuilt = [];
  for (const [source, value] of valuesBySource) {
    ringSession.bind('ringSubject', [value]);
    if ((await ringSession.evalCell('ringSubject | survives')).result !== true) unbuilt.push(source);
  }
  return unbuilt;
}

async function catalogExamples() {
  const tagNames = catalogEntriesOf(await langRuntime(), { tags: true }).map(entry => entry.get('name'));
  const examples = [
    ...await evalQuery('::qlang | manifest * manifest | flat * examples | flat'),
    ...await evalQuery(`[${tagNames.join(' ')}] * examples | flat`),
  ];
  return new Map(examples.map(example => [printQuoteSource(example), example]));
}

async function conformanceLiterals() {
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

describe('the ring of atoms [D42]', () => {
  it('keeps the examples of its own verbs true', async () => {
    expect((await ringSession.evalCell(':apart | runExamples * /ok')).result).toEqual([true]);
  });

  it('builds every example of the catalog back from its atoms but the open ones', async () => {
    expect(await unbuiltOf(await catalogExamples()), 'an open part that closes leaves OPEN_EXAMPLES')
      .toEqual([...OPEN_EXAMPLES.keys()]);
  }, RING_TIMEOUT);

  it('builds every literal of the conformance cases back from its atoms', async () => {
    expect(await unbuiltOf(await conformanceLiterals())).toEqual([]);
  }, RING_TIMEOUT);
});
