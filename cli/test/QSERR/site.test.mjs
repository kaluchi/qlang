import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createNotebook, nodeAddresses, nodeOf, isVerb, ruleRefusalsOf, typeOf, splitAddress } from '@kaluchi/qlang-core';
import { declaredRefusals } from '@kaluchi/qlang-core/errors';

const ofTheCore = new Set(declaredRefusals());
const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
for (const file of readdirSync(srcDir).filter(name => name.endsWith('.mjs') && name !== 'bin.mjs')) await import(pathToFileURL(join(srcDir, file)).href);
const declared = new Set(declaredRefusals());
const { cliSources } = await import('../../src/cli-sources.mjs');

const notebook = await createNotebook({
  sources: cliSources({ stdinReader: () => Promise.resolve(''), stdoutWrite: () => {}, stderrWrite: () => {} })
});
const addresses = nodeAddresses(notebook.scope);
const kindAt = address => typeOf(nodeOf(notebook.scope, address)?.get('value')).name;

const ruleBorn = new Set(addresses
  .filter(address => isVerb(notebook.scope, address) || kindAt(address) === 'kind')
  .flatMap(address => ruleRefusalsOf(notebook.scope, address)));

const refusalPages = addresses.filter(address => splitAddress(address)[0] !== null && /Error$/.test(address) && kindAt(address) === 'doc');

describe('every refusal a site of the core or of the command line declares has its page under its noun', () => {
  for (const address of declared) {
    it(`${address} is paged under the noun it guards`, () => {
      expect(kindAt(address), `${address} is declared by a site and no source pages it under its noun`).toBe('doc');
      if (!ofTheCore.has(address)) expect(nodeOf(notebook.scope, address).get('origin').name, `${address} is declared by the command line and paged outside its source`).toBe('cli');
    });
  }
});

describe('every page of a refusal is declared by a site or raised by rule', () => {
  for (const address of refusalPages) {
    it(`${address} is declared by its site or raised by rule`, () => {
      expect(declared.has(address) || ruleBorn.has(address), `${address} has a page, and no site declares it and no rule raises it`).toBe(true);
    });
  }

  it('holds the pages of the core and of the command line in one root', () => {
    expect(['call/UnknownNameError', 'any/out/SubjectKindNotTakenError', 'vec/table/RowKindNotTakenError'].every(address => declared.has(address) && refusalPages.includes(address))).toBe(true);
    expect(['any/out/SubjectKindNotTakenError', 'vec/table/RowKindNotTakenError'].every(address => !ofTheCore.has(address))).toBe(true);
  });
});
