// The refusals of the command line and their pages in its source.
//
// The core suite pins the same contract for `core/src` against the language's
// root; this file pins the host half, the source of the command line
// [QSDSP#residence]. A refusal of a host's verb is declared by its address
// where its site raises it, and the source pages it under the noun of the
// place it guards, with the prose and the laws a reader reaches through `doc`.
// The two halves drift silently: a renamed class leaves `result !| type | doc`
// answering a refusal of its own.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession, evalQuery, nodeAddresses, nodeOf, typeOf, isVerb, ruleRefusalsOf } from '@kaluchi/qlang-core';
import { cliSources } from '../src/cli-sources.mjs';
import '../src/streams.mjs';
import '../src/table.mjs';
import '../src/stdin.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const isInvariant = value => typeOf(value).name === 'invariant';
const srcDir = join(here, '..', 'src');

// Every form that declares a refusal opens with its address as a string
// literal [QSERR#site].
const DECLARATION_RE = /(?:declareRefusal|recordRefusal)\(\s*'([A-Za-z0-9@/]+)'/g;

const throwSites = new Map();
for (const fileName of readdirSync(srcDir).filter(f => f.endsWith('.mjs'))) {
  for (const match of readFileSync(join(srcDir, fileName), 'utf8').matchAll(DECLARATION_RE)) {
    throwSites.set(match[1], `cli/src/${fileName}`);
  }
}

const session = await createSession({
  sources: cliSources({
    stdinReader: () => Promise.resolve(''),
    stdoutWrite: () => {},
    stderrWrite: () => {}
  })
});
// The refusals the source of the command line declares, by address; an
// invariant, whose name is its refusal, is raised by the runtime [QSBLD#fn].
const refusalAddresses = new Set();
for (const address of nodeAddresses(session.scope)) {
  const record = nodeOf(session.scope, address);
  if (record.get('origin')?.name === 'cli' && address.endsWith('Error') && !isInvariant(record.get('value'))) refusalAddresses.add(address);
}
// The refusals the verbs of the command line raise by rule, which the
// runtime raises and the source pages where a repair helps [QSERR#site].
const ruleBorn = new Set([...nodeAddresses(session.scope)]
  .filter(address => isVerb(session.scope, address))
  .flatMap(address => ruleRefusalsOf(session.scope, address)));
const ask = async query => (await session.evalCell(query)).result;

describe('the verbs of the command line — every throw site has its kind in the source of the command line', () => {
  for (const [address, file] of throwSites) {
    it(`${address} is declared under the noun of its place`, async () => {
      expect(refusalAddresses.has(address),
        `${file} throws ${address} and the source of the command line declares no kind of it`
      ).toBe(true);
      expect(await ask(`::${address} | binding | get /value | type`)).toEqual(await evalQuery('::doc'));
    });
  }
});

describe('the verbs of the command line — every refusal the source declares has a throw site', () => {
  for (const address of [...refusalAddresses].filter(address => !ruleBorn.has(address))) {
    it(`${address} is raised somewhere under cli/src`, () => {
      expect(throwSites.has(address),
        `the source of the command line declares ${address} with no throw site under cli/src`
      ).toBe(true);
    });
  }
});
