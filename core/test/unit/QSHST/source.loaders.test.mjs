/* global Response */
import { it, expect, vi, afterEach } from 'vitest';
import { makeKeyword } from '../../../src/types.mjs';

const { unreadable, readFile } = vi.hoisted(() => ({ unreadable: new Error('EACCES: permission denied'), readFile: vi.fn() }));

vi.mock('node:fs/promises', async importOriginal => ({ ...(await importOriginal()), readFile }));

afterEach(() => {
  vi.unstubAllGlobals();
});

it('raises it on Node for a file the package maps that does not read, its origin the keyword of the source', async () => {
  readFile.mockRejectedValueOnce(unreadable);
  const { loadSource } = await import('../../../host/load-source-node.mjs');
  const raised = await loadSource('qlang/vec').catch(error => error);
  expect(raised.address).toBe('builtin/SourceLoadError');
  expect(Object.keys(raised.facts)).toEqual(['origin', 'sourceLocation', 'cause']);
  expect(raised.facts.origin).toEqual(makeKeyword('qlang/vec'));
  expect(raised.facts.sourceLocation.replaceAll('\\', '/')).toMatch(/\/lib\/qlang\/vec\.qlang$/);
  expect(raised.facts.cause).toBe(unreadable);
});

it('raises it in a browser for a response that fails, its status the cause', async () => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }));
  const { loadSource } = await import('../../../src/load-source-web.mjs');
  const raised = await loadSource('qlang/vec').catch(error => error);
  expect(raised.address).toBe('builtin/SourceLoadError');
  expect(Object.keys(raised.facts)).toEqual(['origin', 'sourceLocation', 'cause']);
  expect(raised.facts.origin).toEqual(makeKeyword('qlang/vec'));
  expect(raised.facts.sourceLocation).toMatch(/\/lib\/qlang\/vec\.qlang$/);
  expect(raised.facts.cause.message).toBe('HTTP 404');
});

it('reads a source with a byte order mark at its head as the text after it, on Node as in a browser', async () => {
  const marked = new TextEncoder().encode('﻿:x 1');
  readFile.mockResolvedValueOnce(Buffer.from(marked));
  vi.stubGlobal('fetch', async () => new Response(marked));
  const { loadSource: onNode } = await import('../../../host/load-source-node.mjs');
  const { loadSource: inABrowser } = await import('../../../src/load-source-web.mjs');
  expect([await onNode('qlang/vec'), await inABrowser('qlang/vec')]).toEqual([':x 1', ':x 1']);
});
