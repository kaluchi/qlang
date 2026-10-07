// The catalog a session holds, as the entries a test walks [D152]: with
// `tags`, every node the language's module binds, its kinds and the
// pages of its concepts, each named by its tag, `::number`; without,
// the names the scope binds to a descriptor, which no module of the
// language leaves. Each entry carries the name it is read by, `:name`,
// in the order of the names. What lies under a noun `::qlang | manifest
// * manifest` answers.

import { exportsOfModule, LANGUAGE_PATH } from '../../src/runtime/nouns.mjs';
import { isRuntimeKey } from '../../src/env-keys.mjs';
import { bindingValueOf, TAG_HEADER_SYMBOL } from '../../src/types.mjs';

export function catalogEntriesOf(env, { tags }) {
  const names = tags
    ? [...(exportsOfModule(env, LANGUAGE_PATH)?.keys() ?? [])].map(name => `::${name}`)
    : [...env.keys()].filter(name => !isRuntimeKey(name) && bindingValueOf(env.get(name))?.[TAG_HEADER_SYMBOL]?.name === 'builtin');
  return names.sort().map(name => new Map([['name', name]]));
}
