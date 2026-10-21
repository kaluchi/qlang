// The loaders `#qlang/load-source` picks by its condition raise
// `::builtin/SourceLoadError` where a source the package maps does not read,
// its facts the origin of the source, where the platform looked for it and
// the host's account of the failure [QSHST#source].

import { describe, it, expect, vi, afterEach } from 'vitest';
import { keyword } from '../../src/types.mjs';

const { unreadable } = vi.hoisted(() => ({ unreadable: new Error('EACCES: permission denied') }));

vi.mock('node:fs/promises', async importOriginal => ({ ...(await importOriginal()), readFile: async () => { throw unreadable; } }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the loaders of the sources of the language', () => {
  it('[QSHST#source] raises it on Node for a file the package maps that does not read, its origin the keyword of the source', async () => {
    const { loadSource } = await import('../../host/load-source-node.mjs');
    const raised = await loadSource('qlang/vec').catch(error => error);
    expect(raised.address).toBe('builtin/SourceLoadError');
    expect(Object.keys(raised.facts)).toEqual(['origin', 'sourceLocation', 'cause']);
    expect(raised.facts.origin).toEqual(keyword('qlang/vec'));
    expect(raised.facts.sourceLocation.replaceAll('\\', '/')).toMatch(/\/lib\/qlang\/vec\.qlang$/);
    expect(raised.facts.cause).toBe(unreadable);
  });

  it('[QSHST#source] raises it in a browser for a response that fails, its status the cause', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }));
    const { loadSource } = await import('../../src/load-source-web.mjs');
    const raised = await loadSource('qlang/vec').catch(error => error);
    expect(raised.address).toBe('builtin/SourceLoadError');
    expect(Object.keys(raised.facts)).toEqual(['origin', 'sourceLocation', 'cause']);
    expect(raised.facts.origin).toEqual(keyword('qlang/vec'));
    expect(raised.facts.sourceLocation).toMatch(/\/lib\/qlang\/vec\.qlang$/);
    expect(raised.facts.cause.message).toBe('HTTP 404');
  });
});
