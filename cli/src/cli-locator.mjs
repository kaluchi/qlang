// The locator of the command line: the module of its noun, `qlang/cli`,
// with the primitives of its verbs [D80], [D92].

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeIoImpls } from './io-operands.mjs';
import { formatImpls } from './format-operands.mjs';
import { parseImpls } from './parse-operands.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_SOURCE = readFileSync(join(__dirname, '..', 'lib', 'qlang', 'cli.qlang'), 'utf8');

export function createCliLocator(ioContext) {
  const impls = { ...makeIoImpls(ioContext), ...formatImpls, ...parseImpls };
  return async (namespaceName) => (namespaceName === 'qlang/cli' ? { source: CLI_SOURCE, impls } : null);
}

export async function installCliCatalog(session) {
  await session.evalCell('use :qlang/cli');
}
