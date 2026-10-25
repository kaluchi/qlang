// [QSHST#source], [QSGAT#workspaces]

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { makeKeyword } from '../src/types.mjs';
import { BuiltinSourceLoadError } from '../src/source-load-error.mjs';

export async function loadSource(uri) {
  let filePath;
  try {
    filePath = createRequire(import.meta.url).resolve(`#${uri}`);
  } catch (cause) {
    if (cause?.code === 'ERR_PACKAGE_IMPORT_NOT_DEFINED' || cause?.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    throw cause;
  }
  try {
    return new TextDecoder().decode(await readFile(filePath));
  } catch (cause) {
    throw new BuiltinSourceLoadError({ origin: makeKeyword(uri), sourceLocation: filePath, cause });
  }
}
