// [QSHST#source], [QSWRK#tooling]

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { keyword } from '../src/types.mjs';
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
    return await readFile(filePath, 'utf8');
  } catch (cause) {
    throw new BuiltinSourceLoadError({ origin: keyword(uri), sourceLocation: filePath, cause });
  }
}
