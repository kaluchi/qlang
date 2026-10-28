// [QSDSP#residence], [QSHST#source], [QSHST#cell], [D477]

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { streamPrimitives } from './streams.mjs';
import { tablePrimitives } from './table.mjs';
import { cellPrimitives } from './cells.mjs';

export { keepCell } from './cells.mjs';
export { IN_ADDRESS } from './streams.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STDIO_SOURCE = new TextDecoder().decode(readFileSync(join(__dirname, '..', 'lib', 'qlang', 'stdio.qlang')));

export function stdioSources(ioContext) {
  return [{ uri: 'stdio', source: STDIO_SOURCE, primitives: { ...streamPrimitives(ioContext), ...tablePrimitives, ...cellPrimitives(() => stdioSources(ioContext)) } }];
}
