// [QSHST#cell]

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { createNotebook, evalQuery, printValue } from '@kaluchi/qlang-core';
import { declareRefusal, refusingTheSubject } from '@kaluchi/qlang-core/errors';

const CellAnswerNotHeldError = declareRefusal('cell/answer/NotHeldError');

const SOURCE = 'source.qlang';
const NAMES = 'names.qlang';
const ANSWER = 'answer.qlang';

// The identity of the root the command line boots, the sources and the code
// of the core and of the command line, so a cell another root kept is held
// by none.
const CODE_OF_THE_ROOT = [
  [dirname(dirname(fileURLToPath(import.meta.resolve('@kaluchi/qlang-core')))), ['lib', 'src', 'host', 'gen']],
  [join(dirname(fileURLToPath(import.meta.url)), '..'), ['lib', 'src']]
];

function filesUnder(folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? filesUnder(path) : /\.(mjs|qlang)$/.test(entry.name) ? [path] : [];
  });
}

let identityOfTheRoot = null;

function rootIdentity() {
  if (identityOfTheRoot !== null) return identityOfTheRoot;
  const hash = createHash('sha256');
  for (const [packageFolder, folders] of CODE_OF_THE_ROOT) {
    for (const file of folders.flatMap(folder => filesUnder(join(packageFolder, folder))).sort()) {
      hash.update(relative(packageFolder, file));
      hash.update(readFileSync(file));
    }
  }
  return identityOfTheRoot = hash.digest('hex').slice(0, 12);
}

const cellFolder = identity => join(tmpdir(), 'qlang', rootIdentity(), 'cells', identity);

// The values a query declared, each as the core prints it, so reading them
// back runs no body again; a node a declaration laid holds no source and
// comes again with it.
function namesOf(scope) {
  const declared = [];
  for (const [name, entry] of scope) {
    if (typeof name === 'string' && entry.get('source') !== null) declared.push(`${printValue(entry.get('name'))} ${printValue(entry.get('value'))}`);
  }
  return declared.join('\n| ');
}

// [QSHST#cell], [QSPRN#budget]
export async function keepCell({ query, scope, answer }) {
  const identity = randomBytes(6).toString('hex');
  const folder = cellFolder(identity);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  writeFileSync(join(folder, SOURCE), query);
  writeFileSync(join(folder, NAMES), namesOf(scope));
  writeFileSync(join(folder, ANSWER), printValue(answer));
  return await evalQuery(`::cell${JSON.stringify(identity)}`, scope);
}

// [QSHST#cell]
export function cellPrimitives(sourcesOfTheRoot) {
  return {
    'cell/answer': async cell => {
      const folder = cellFolder(cell.payload);
      if (!existsSync(join(folder, ANSWER))) throw refusingTheSubject(new CellAnswerNotHeldError({ actualValue: cell }));
      const names = readFileSync(join(folder, NAMES), 'utf8');
      const answer = readFileSync(join(folder, ANSWER), 'utf8');
      const read = await (await createNotebook({ sources: sourcesOfTheRoot() })).evalCell(names === '' ? answer : `${names}\n| ${answer}`);
      if (read.defect !== null) throw read.defect;
      return read.result;
    }
  };
}
