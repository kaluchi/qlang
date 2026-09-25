// The catalog a session holds, as the entries a test walks: every verb
// or every tag bound in the session's environment, each its
// declaration, the value of its record [D63], with the name it is bound
// under, `:name`, in the order of the names. `manifest` answers the
// tree of names [D62], so a test that reads every declaration reads the
// environment itself.

import { isRuntimeKey, isTagBindingName } from '../../src/env-keys.mjs';
import { isQMap, bindingValueOf, TAG_HEADER_SYMBOL, stampTagHeader } from '../../src/types.mjs';

function carriesBuiltinShape(value) {
  return isQMap(value) && value[TAG_HEADER_SYMBOL]?.name === 'builtin';
}

export function catalogEntriesOf(env, { tags }) {
  const entries = [];
  for (const [name, record] of env) {
    const declaration = bindingValueOf(record);
    if (isRuntimeKey(name) || isTagBindingName(name) !== tags || !carriesBuiltinShape(declaration)) continue;
    const entry = new Map([['name', name], ...declaration]);
    stampTagHeader(entry, declaration[TAG_HEADER_SYMBOL]);
    entries.push(entry);
  }
  return entries.sort((left, right) => (left.get('name') < right.get('name') ? -1 : 1));
}
