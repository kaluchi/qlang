// Throw-site ↔ catalog drift guard for the CLI host operands.
//
// The core suite pins the same contract for `core/src` against the
// language's root; this file pins the host half, the source of the
// command line [D153]. A host operand's per-site error class records its
// facts where the factory call builds it, and the source declares its
// kind under the noun of the place it guards, with the prose and the laws
// a reader reaches through `doc`. The two halves drift silently: a
// renamed class leaves `result !| type | doc` answering a refusal of its
// own.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession } from '@kaluchi/qlang-core/session';
import { evalQuery, nodeAddresses, nodeOf } from '@kaluchi/qlang-core';
import { cliSources } from '../src/cli-sources.mjs';
import '../src/io-operands.mjs';
import '../src/format-operands.mjs';
import '../src/script-mode.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

// Every form that puts a name in the throw-site registry opens with
// the class name as a string literal.
const DECLARATION_RE = /(?:declare[A-Za-z]+Error|recordThrowSiteSpec)\(\s*'([A-Za-z0-9]+)'/g;

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
// The refusals the source of the command line declares, by the last
// name of each address, `TableRowNotMapError` for `vec/TableRowNotMapError`.
const refusalAddresses = new Map();
for (const address of nodeAddresses(session.env)) {
  const lastName = address.slice(address.lastIndexOf('/') + 1);
  if (nodeOf(session.env, address).get('origin')?.name === 'cli' && lastName.endsWith('Error')) refusalAddresses.set(lastName, address);
}
const ask = async query => (await session.evalCell(query)).result;

describe('CLI host operands — every throw site has its kind in the source of the command line', () => {
  for (const [className, file] of throwSites) {
    it(`${className} is declared under the noun of its place`, async () => {
      expect(refusalAddresses.has(className),
        `${file} throws ${className} and the source of the command line declares no kind of it`
      ).toBe(true);
      expect(await ask(`::${refusalAddresses.get(className)} | spec | type`)).toEqual(await evalQuery('::spec'));
    });
  }
});

describe('CLI host operands — every refusal the source declares has a throw site', () => {
  for (const [className, address] of refusalAddresses) {
    it(`${address} is raised somewhere under cli/src`, () => {
      expect(throwSites.has(className),
        `the source of the command line declares ${address} with no throw site under cli/src`
      ).toBe(true);
    });
  }
});
