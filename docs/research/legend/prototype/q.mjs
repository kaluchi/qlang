// The prototype's command line: the language with the host source
// `ci.qlang` declared in its root, each argument a query whose answer
// prints as the command line prints it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession, printAnswer } from '../core/src/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const session = await createSession({ sources: [{ uri: 'ci', source: readFileSync(join(here, 'ci.qlang'), 'utf8'), impls: { 'Pipe/@retry': subject => subject } }] });
for (const query of process.argv.slice(2)) {
  const cell = await session.evalCell(query);
  console.log(await printAnswer(cell.result, session.env));
}
