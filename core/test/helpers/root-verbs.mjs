// The names of the verbs of the root, read once, which the painter tells
// from the names of a reader [QSHST#tokens].

import { verbNames } from '../../src/nouns.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';

let verbNamesOfTheRoot;

export async function rootVerbNames() {
  if (verbNamesOfTheRoot === undefined) verbNamesOfTheRoot = verbNames(await langRuntime());
  return verbNamesOfTheRoot;
}
