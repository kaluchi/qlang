// Module Quote storage in env — every loaded module's source ships
// alongside its evaluated bindings under `qlang/ast/<uri>`, a key the
// runtime keeps for itself, which `env` leaves out [D61].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { createSession } from '../../src/session.mjs';
import { printQuoteSource } from '../../src/quote.mjs';
import { moduleAstKey } from '../../src/env-keys.mjs';
import { isQuote, keyword, makeTagKeyword, typeKeyword } from '../../src/types.mjs';

describe('langRuntime stamps the core module as a Quote', () => {
  it('keeps the core module under qlang/ast/qlang/core', async () => {
    expect(isQuote((await langRuntime()).get(moduleAstKey('qlang/core')))).toBe(true);
  });

  it('prints the module as its text, the comments left out', async () => {
    const coreModule = (await langRuntime()).get(moduleAstKey('qlang/core'));
    expect(printQuoteSource(coreModule).startsWith('use [')).toBe(true);
  });

  it('holds the steps of the module', async () => {
    const coreModule = (await langRuntime()).get(moduleAstKey('qlang/core'));
    expect(coreModule[0].get('name')).toEqual(keyword('use'));
  });

  it('shares one frozen Quote across runtimes', async () => {
    const first = (await langRuntime()).get(moduleAstKey('qlang/core'));
    const second = (await langRuntime()).get(moduleAstKey('qlang/core'));
    expect(first).toBe(second);
  });

  it('keeps the key out of the bindings env answers', async () => {
    expect(await evalQuery('env | has :"qlang/ast/inline"')).toBe(false);
  });
});

describe('use stamps loaded namespaces under qlang/ast/<ns>', () => {
  it('stores the module source as a Quote when the locator returns one', async () => {
    const moduleSource = ':greet "hi"';
    const sessionInstance = await createSession({
      locator: async (nsName) => nsName === 'lazy/mod'
        ? { source: moduleSource }
        : null
    });
    await sessionInstance.evalCell('use :lazy/mod');
    expect(printQuoteSource(sessionInstance.env.get(moduleAstKey('lazy/mod')))).toBe(moduleSource);
  });

  it('holds the module as the steps of its declarations', async () => {
    const sessionInstance = await createSession({
      locator: async () => ({ source: ':answer 42' })
    });
    await sessionInstance.evalCell('use :lazy/mod');
    const loadedModule = sessionInstance.env.get(moduleAstKey('lazy/mod'));
    expect(typeKeyword(loadedModule[0])).toEqual(makeTagKeyword('bind'));
  });

  it('module Quote survives subsequent use of a second namespace', async () => {
    const sessionInstance = await createSession({
      locator: async (nsName) => {
        if (nsName === 'lazy/a') return { source: ':a 1' };
        if (nsName === 'lazy/b') return { source: ':b 2' };
        return null;
      }
    });
    await sessionInstance.evalCell('use :lazy/a | use :lazy/b');
    expect(printQuoteSource(sessionInstance.env.get(moduleAstKey('lazy/a')))).toBe(':a 1');
  });
});
