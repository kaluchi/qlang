// The root a runtime holds, as the addresses a test walks [QSNAM#address]:
// every name the host's sources declared, `::number` and `::vec/count` alike,
// in the order of their names.

import { ROOT_KEY } from '../../src/env-keys.mjs';

export function rootAddressesOf(env) {
  return [...env.get(ROOT_KEY).keys()].sort().map(name => `::${name}`);
}
