// [QSHST#tokens]

import { verbNames } from '../../src/nouns.mjs';
import { langRuntime } from '../../src/runtime/lang-runtime.mjs';

let verbNamesOfTheRoot;

export async function rootVerbNames() {
  if (verbNamesOfTheRoot === undefined) verbNamesOfTheRoot = verbNames(await langRuntime());
  return verbNamesOfTheRoot;
}
