import { it, expect, vi, afterEach } from 'vitest';
import { keyword } from '../../../src/types.mjs';

const { unreadable } = vi.hoisted(() => ({ unreadable: new Error('EACCES: permission denied') }));

vi.mock('node:fs/promises', async importOriginal => ({ ...(await importOriginal()), readFile: async () => { throw unreadable; } }));

afterEach(() => {
  vi.unstubAllGlobals();
});

it('raises it on Node for a file the package maps that does not read, its origin the keyword of the source', async () => {
  const { loadSource } = await import('../../../host/load-source-node.mjs');
  const raised = await loadSource('qlang/vec').catch(error => error);
  expect(raised.address).toBe('builtin/SourceLoadError');
  expect(Object.keys(raised.facts)).toEqual(['origin', 'sourceLocation', 'cause']);
  expect(raised.facts.origin).toEqual(keyword('qlang/vec'));
  expect(raised.facts.sourceLocation.replaceAll('\\', '/')).toMatch(/\/lib\/qlang\/vec\.qlang$/);
  expect(raised.facts.cause).toBe(unreadable);
});

it('raises it in a browser for a response that fails, its status the cause', async () => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }));
  const { loadSource } = await import('../../../src/load-source-web.mjs');
  const raised = await loadSource('qlang/vec').catch(error => error);
  expect(raised.address).toBe('builtin/SourceLoadError');
  expect(Object.keys(raised.facts)).toEqual(['origin', 'sourceLocation', 'cause']);
  expect(raised.facts.origin).toEqual(keyword('qlang/vec'));
  expect(raised.facts.sourceLocation).toMatch(/\/lib\/qlang\/vec\.qlang$/);
  expect(raised.facts.cause.message).toBe('HTTP 404');
});
