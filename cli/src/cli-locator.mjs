// The locator of the command line: its provider, `::cli`, bound beside the
// language at the root, and the module of that path with the primitives
// of its verbs [D80], [D152].

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeIoImpls } from './io-operands.mjs';
import { formatImpls } from './format-operands.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogFile = name => readFileSync(join(__dirname, '..', 'lib', 'qlang', name), 'utf8');
const CLI_ROOT_SOURCE = catalogFile('cli-root.qlang');
const CLI_SOURCE = catalogFile('cli.qlang');

export function createCliLocator(ioContext) {
  const impls = { ...makeIoImpls(ioContext), ...formatImpls };
  return async (path) => {
    if (path === 'qlang/core') return { source: CLI_ROOT_SOURCE };
    return path === 'cli' ? { source: CLI_SOURCE, impls } : null;
  };
}
