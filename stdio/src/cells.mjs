// [QSHST#cell]

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createNotebook, evalQuery, printValue } from '@kaluchi/qlang-core';
import { declareRefusal } from '@kaluchi/qlang-core/errors';

const CellAnswerSubjectNotHeldError = declareRefusal('cell/answer/SubjectNotHeldError');

const STORE = join(tmpdir(), 'qlang');
const SOURCE = 'source.qlang';
const NAMES = 'names.qlang';
const ANSWER = 'answer.qlang';
const AGE_OF_A_CELL = 24 * 60 * 60 * 1000;

const CODE_OF_THE_ROOT = [
  [dirname(dirname(fileURLToPath(import.meta.resolve('@kaluchi/qlang-core')))), ['lib', 'src', 'host', 'gen']],
  [join(dirname(fileURLToPath(import.meta.url)), '..'), ['lib', 'src']]
];

function filesUnder(folder) {
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

const cellFolder = identity => join(STORE, rootIdentity(), 'cells', identity);

function namesOf(scope) {
  const declared = [];
  for (const [name, entry] of scope) {
    if (typeof name === 'string' && entry.get('source') !== null) declared.push(`${printValue(entry.get('name'))} ${printValue(entry.get('value'))};`);
  }
  return declared.join('\n');
}

// [QSHST#cell]
function cellsAged(now) {
  for (const root of readdirSync(STORE)) {
    const cells = join(STORE, root, 'cells');
    for (const identity of readdirSync(cells)) {
      const folder = join(cells, identity);
      const kept = statSync(folder, { throwIfNoEntry: false });
      if (kept !== undefined && now - kept.mtimeMs > AGE_OF_A_CELL) rmSync(folder, { recursive: true, force: true });
    }
  }
}

// [QSHST#cell], [QSPRN#budget]
export async function keepCell({ query, scope, value }) {
  const names = namesOf(scope);
  const printed = printValue(value);
  const identity = createHash('sha256').update(query).update('\n').update(names).update('\n').update(printed).digest('hex').slice(0, 12);
  const folder = cellFolder(identity);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const now = new Date();
  utimesSync(folder, now, now);
  cellsAged(now.getTime());
  writeFileSync(join(folder, SOURCE), query);
  writeFileSync(join(folder, NAMES), names);
  writeFileSync(join(folder, ANSWER), printed);
  return await evalQuery(`::cell${JSON.stringify(identity)}`, scope);
}

// [QSHST#cell]
export function cellPrimitives(sourcesOfTheRoot) {
  return {
    'cell/answer': async cell => {
      const folder = cellFolder(cell.payload);
      if (!existsSync(join(folder, ANSWER))) throw new CellAnswerSubjectNotHeldError({});
      const names = readFileSync(join(folder, NAMES), 'utf8');
      const answer = readFileSync(join(folder, ANSWER), 'utf8');
      const { scope } = await createNotebook({ sources: sourcesOfTheRoot() });
      return await evalQuery(names === '' ? answer : `${names}\n${answer}`, scope);
    }
  };
}
