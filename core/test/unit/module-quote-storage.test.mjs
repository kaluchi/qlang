// Module Quote storage in env — every loaded module's source ships
// alongside its evaluated bindings under `qlang/ast/<uri>`.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { isQuote, makeTagKeyword } from '../../src/types.mjs';

describe('langRuntime stamps the core module as a Quote', () => {
  it('exposes the core module under :qlang/ast/qlang/core', async () => {
    const result = await evalQuery('env | /:qlang/ast/qlang/core | type');
    expect(result).toEqual(makeTagKeyword('quote'));
  });

  it('prints the module as its text, the comments left out', async () => {
    const result = await evalQuery('env | /:qlang/ast/qlang/core | parse | startsWith "use ["');
    expect(result).toBe(true);
  });

  it('holds the steps of the module', async () => {
    const result = await evalQuery('env | /:qlang/ast/qlang/core | first | /name');
    expect(result).toEqual(await evalQuery(':use'));
  });

  it('returns the same frozen Quote across repeated lookups', async () => {
    const a = await evalQuery('env | /:qlang/ast/qlang/core');
    const b = await evalQuery('env | /:qlang/ast/qlang/core');
    expect(isQuote(a)).toBe(true);
    expect(isQuote(b)).toBe(true);
    expect(a).toBe(b);
  });
});

describe('manifest filters out the qlang/ast/ reserved namespace', () => {
  it('does not list module Quote entries among descriptors', async () => {
    const result = await evalQuery('manifest * /name | filter ~(startsWith "qlang/ast/")');
    expect(result).toEqual([]);
  });

  it('still lists ordinary builtin descriptors', async () => {
    const result = await evalQuery('manifest * /name | filter ~(eq "count") | count');
    expect(result).toBe(1);
  });
});

describe('use stamps loaded namespaces under :qlang/ast/<ns>', () => {
  it('stores the module source as a Quote when the locator returns one', async () => {
    const moduleSource = ':greet "hi"';
    const sessionInstance = await createSession({
      locator: async (nsName) => nsName === 'lazy/mod'
        ? { source: moduleSource }
        : null
    });
    const cellEntry = await sessionInstance.evalCell('use :lazy/mod | env | /:qlang/ast/lazy/mod | parse');
    expect(cellEntry.result).toBe(moduleSource);
  });

  it('holds the module as the steps of its declarations', async () => {
    const moduleSource = ':answer 42';
    const sessionInstance = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await sessionInstance.evalCell('use :lazy/mod | env | /:qlang/ast/lazy/mod | first | type');
    expect(cellEntry.result).toEqual(makeTagKeyword('bind'));
  });

  it('module Quote survives subsequent use of a second namespace', async () => {
    const sessionInstance = await createSession({
      locator: async (nsName) => {
        if (nsName === 'lazy/a') return { source: ':a 1' };
        if (nsName === 'lazy/b') return { source: ':b 2' };
        return null;
      }
    });
    const cellEntry = await sessionInstance.evalCell(
      'use :lazy/a | use :lazy/b | env | /:qlang/ast/lazy/a | parse');
    expect(cellEntry.result).toBe(':a 1');
  });
});
