// Every name of the root by its address, the readers whose laws and pages
// the catalog holds [QSSLF#laws].

import { rootAddressesOf } from './root-addresses.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';

// The readers of the catalog's laws: the address of every name the root
// holds, `::number`, `::vec/count` and `::qlang/values`, each read by
// `runLaws` [QSSLF#laws].
export async function catalogReaders() {
  return rootAddressesOf(await langRuntime());
}
