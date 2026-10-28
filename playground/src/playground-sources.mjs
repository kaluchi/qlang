// [QSHST#source], [D477]

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdioSources } from '@kaluchi/qlang-stdio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYGROUND_SOURCE = new TextDecoder().decode(readFileSync(join(__dirname, '..', 'lib', 'qlang', 'playground.qlang')));

export function playgroundSources(ioContext) {
  return [...stdioSources(ioContext), { uri: 'playground', source: PLAYGROUND_SOURCE }];
}
