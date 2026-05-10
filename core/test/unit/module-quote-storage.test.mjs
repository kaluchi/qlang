// Module Quote storage in env — every loaded module's source ships
// alongside its evaluated bindings under `qlang/ast/<uri>`.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { isQuote, keyword } from '../../src/types.mjs';

describe('langRuntime stamps the core module as a Quote', () => {
  it('exposes the core module under :qlang/ast/qlang/core', async () => {
    const result = await evalQuery('env | /:qlang/ast/qlang/core | reify | /type');
    expect(result).toEqual(keyword('quote'));
  });

  it('exposes verbatim source through /source', async () => {
    const result = await evalQuery('env | /:qlang/ast/qlang/core | /source | startsWith("|~")');
    expect(result).toBe(true);
  });

  it('exposes pre-parsed AST through /ast — no re-parse needed', async () => {
    const result = await evalQuery('env | /:qlang/ast/qlang/core | /ast | /:qlang/kind');
    expect(result).toEqual(keyword('Pipeline'));
  });

  it('returns the same frozen Quote across repeated lookups', async () => {
    const a = await evalQuery('env | /:qlang/ast/qlang/core');
    const b = await evalQuery('env | /:qlang/ast/qlang/core');
    expect(isQuote(a)).toBe(true);
    expect(isQuote(b)).toBe(true);
    expect(a.source).toBe(b.source);
  });
});

describe('manifest filters out the qlang/ast/ reserved namespace', () => {
  it('does not list module Quote entries among descriptors', async () => {
    const result = await evalQuery('manifest * /name | filter(startsWith("qlang/ast/"))');
    expect(result).toEqual([]);
  });

  it('still lists ordinary builtin descriptors', async () => {
    const result = await evalQuery('manifest * /name | filter(eq("count")) | count');
    expect(result).toBe(1);
  });
});

describe('use stamps loaded namespaces under :qlang/ast/<ns>', () => {
  it('stores the module source as a Quote when the locator returns one', async () => {
    const moduleSource = 'let(:greet, "hi")';
    const sessionInstance = await createSession({
      locator: async (nsName) => nsName === 'lazy/mod'
        ? { source: moduleSource }
        : null
    });
    const cellEntry = await sessionInstance.evalCell('null | use(:lazy/mod) | env | /:qlang/ast/lazy/mod | /source');
    expect(cellEntry.result).toBe(moduleSource);
  });

  it('parses the module AST eagerly so /ast skips a re-parse', async () => {
    const moduleSource = 'let(:answer, 42)';
    const sessionInstance = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await sessionInstance.evalCell('null | use(:lazy/mod) | env | /:qlang/ast/lazy/mod | /ast | /:qlang/kind');
    expect(cellEntry.result).toEqual(keyword('OperandCall'));
  });

  it('module Quote survives subsequent use of a second namespace', async () => {
    const sessionInstance = await createSession({
      locator: async (nsName) => {
        if (nsName === 'lazy/a') return { source: 'let(:a, 1)' };
        if (nsName === 'lazy/b') return { source: 'let(:b, 2)' };
        return null;
      }
    });
    const cellEntry = await sessionInstance.evalCell(
      'null | use(:lazy/a) | use(:lazy/b) | env | /:qlang/ast/lazy/a | /source');
    expect(cellEntry.result).toBe('let(:a, 1)');
  });
});
