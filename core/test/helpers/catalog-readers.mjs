// [QSSLF#laws]

import { rootAddressesOf } from './root-addresses.mjs';
import { langRuntime } from '../../src/runtime/lang-runtime.mjs';

export async function catalogReaders() {
  return rootAddressesOf(await langRuntime());
}
