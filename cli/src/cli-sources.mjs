// The source the command line declares the root by beside the language's,
// with the primitives of its verbs [D80], [D153].

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeIoImpls } from './io-operands.mjs';
import { formatImpls } from './format-operands.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_SOURCE = readFileSync(join(__dirname, '..', 'lib', 'qlang', 'cli.qlang'), 'utf8');

export function cliSources(ioContext) {
  return [{ uri: 'cli', source: CLI_SOURCE, impls: { ...makeIoImpls(ioContext), ...formatImpls } }];
}
