// [QSNAM#address]

import { ROOT_KEY } from '../../src/scope-keys.mjs';

export function rootAddressesOf(scope) {
  return [...scope.get(ROOT_KEY).keys()].sort().map(name => `::${name}`);
}
