// Throw-site ↔ catalog drift guard for the CLI host operands.
//
// The core suite pins the same contract for `core/src` against the
// language's tree; this file pins the host half, the module of the
// provider `::cli` the locator serves [D152]. A host operand's per-site
// error class records its facts where the factory call builds it, and
// the module of `::cli` declares its kind with the prose and the laws a
// reader reaches through `doc`. The two halves drift silently: a renamed
// class leaves `result !| type | doc` answering a refusal of its own.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession } from '@kaluchi/qlang-core/session';
import { evalQuery } from '@kaluchi/qlang-core';
import { createCliLocator } from '../src/cli-locator.mjs';
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
  locator: createCliLocator({
    stdinReader: () => Promise.resolve(''),
    stdoutWrite: () => {},
    stderrWrite: () => {}
  })
});
const cliNodes = [...(await session.evalCell('::cli | manifest')).result].map(address => address.name);
const refusalNodes = cliNodes.filter(name => name.endsWith('Error'));
const ask = async query => (await session.evalCell(query)).result;

describe('CLI host operands — every throw site has its kind under ::cli', () => {
  for (const [className, file] of throwSites) {
    it(`${className} is declared in the module of ::cli`, async () => {
      expect(refusalNodes.includes(`cli/${className}`),
        `${file} throws ${className} and the module of ::cli declares no :${className} ::spec~(…)`
      ).toBe(true);
      expect(await ask(`::cli/${className} | spec | type`)).toEqual(await evalQuery('::spec'));
    });
  }
});

describe('CLI host operands — every refusal under ::cli has a throw site', () => {
  for (const address of refusalNodes) {
    it(`${address} is raised somewhere under cli/src`, () => {
      expect(throwSites.has(address.slice('cli/'.length)),
        `the module of ::cli declares ${address} with no throw site under cli/src`
      ).toBe(true);
    });
  }
});
