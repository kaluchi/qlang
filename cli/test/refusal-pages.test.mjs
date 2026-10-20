// The pages of the refusals of the core and of every host of the tree that
// declares any, the command line, held against the sites that declare them
// and the rules that raise them [QSERR#site]: a refusal a site declares by
// its address has its page under the noun of the place it guards, the prose,
// the facts and the laws a reader reaches through `doc`, the command line's
// in its own source, and a page of a refusal is declared by a site or raised
// by the rule of a verb or a kind. Every module of the command line but
// `bin.mjs`, which touches the process, declares its refusals as it loads.

import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession, nodeAddresses, nodeOf, isVerb, ruleRefusalsOf, typeOf, splitAddress } from '@kaluchi/qlang-core';
import { declaredRefusals } from '@kaluchi/qlang-core/errors';

const ofTheCore = new Set(declaredRefusals());
const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
for (const file of readdirSync(srcDir).filter(name => name.endsWith('.mjs') && name !== 'bin.mjs')) await import(pathToFileURL(join(srcDir, file)).href);
const declared = new Set(declaredRefusals());
const { cliSources } = await import('../src/cli-sources.mjs');

const session = await createSession({
  sources: cliSources({ stdinReader: () => Promise.resolve(''), stdoutWrite: () => {}, stderrWrite: () => {} })
});
const addresses = nodeAddresses(session.scope);
const kindAt = address => typeOf(nodeOf(session.scope, address)?.get('value')).name;

// The refusals the verbs and the kinds of the root raise by rule, which their
// chains page as the declared ones are paged.
const ruleBorn = new Set(addresses
  .filter(address => isVerb(session.scope, address) || kindAt(address) === 'kind')
  .flatMap(address => ruleRefusalsOf(session.scope, address)));

// The pages of the refusals under a noun, `number/add/SubjectNotNumberError`.
const refusalPages = addresses.filter(address => splitAddress(address)[0] !== null && /Error$/.test(address) && kindAt(address) === 'doc');

describe('every refusal a site of the core or of the command line declares has its page under its noun [QSERR#site]', () => {
  for (const address of declared) {
    it(`${address} is paged under the noun it guards`, () => {
      expect(kindAt(address), `${address} is declared by a site and no source pages it under its noun`).toBe('doc');
      if (!ofTheCore.has(address)) expect(nodeOf(session.scope, address).get('origin').name, `${address} is declared by the command line and paged outside its source`).toBe('cli');
    });
  }
});

describe('every page of a refusal is declared by a site or raised by rule [QSERR#site]', () => {
  for (const address of refusalPages) {
    it(`${address} is declared by its site or raised by rule`, () => {
      expect(declared.has(address) || ruleBorn.has(address), `${address} has a page, and no site declares it and no rule raises it`).toBe(true);
    });
  }

  it('holds the pages of the core and of the command line in one root', () => {
    expect(['call/UnknownNameError', 'any/out/SubjectNotStringError', 'vec/table/RowNotMapError'].every(address => declared.has(address) && refusalPages.includes(address))).toBe(true);
    expect(['any/out/SubjectNotStringError', 'vec/table/RowNotMapError'].every(address => !ofTheCore.has(address))).toBe(true);
  });
});
