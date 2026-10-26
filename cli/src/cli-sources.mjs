// [QSDSP#residence], [QSHST#source], [QSHST#cell]

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { streamPrimitives } from './streams.mjs';
import { tablePrimitives } from './table.mjs';
import { cellPrimitives } from './cells.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_SOURCE = new TextDecoder().decode(readFileSync(join(__dirname, '..', 'lib', 'qlang', 'cli.qlang')));

export function cliSources(ioContext) {
  return [{ uri: 'cli', source: CLI_SOURCE, primitives: { ...streamPrimitives(ioContext), ...tablePrimitives, ...cellPrimitives(() => cliSources(ioContext)) } }];
}
