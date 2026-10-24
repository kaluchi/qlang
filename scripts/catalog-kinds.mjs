// The kinds of the catalog and the commands of a chain [QSNAM#address], [QSBLD#fn]: a kind is a
// label a source declares, a bare name by its page alone or by the chain or
// the literal that builds it from `::kind`, as the parser reads the source
// and `kinds` answers it, and a command one a chain takes, so no kind of the
// catalog bears the name of a command.

import { parseSource } from '../core/src/parse.mjs';
import { partOf } from '../core/src/parsed-parts.mjs';
import { isBindStep, declaresKind } from '../core/src/steps.mjs';
import { COMMAND_NAMES } from '../core/src/chain.mjs';

// The declarations of a source, the steps of its pipeline that declare, read
// once for each text.
const READ = new Map();

// declarationsOf(sources) → the declarations the sources, each `{ path, text
// }`, hold, each `{ path, value, span }`.
export function declarationsOf(sources) {
  return sources.flatMap(({ path, text }) => {
    if (!READ.has(text)) READ.set(text, partOf(parseSource(text, { uri: path })).parts.filter(({ value }) => isBindStep(value)));
    return READ.get(text).map(({ value, span }) => ({ path, value, span }));
  });
}

// kindsNamedForCommands(sources) → the kinds the sources declare that bear the
// name of a command of a chain, each `{ path, line, name }`.
export function kindsNamedForCommands(sources) {
  return declarationsOf(sources)
    .filter(({ value }) => declaresKind(value) && COMMAND_NAMES.includes(value.get('name').name))
    .map(({ path, value, span }) => ({ path, line: span.start.line, name: value.get('name').name }));
}

// kindsDeclaredBy(sources) → the names of the kinds the sources declare, each
// a bare name [QSERR#site].
export function kindsDeclaredBy(sources) {
  return new Set(declarationsOf(sources).map(({ value }) => value).filter(declaresKind)
    .map(value => value.get('name').name).filter(name => !name.includes('/')));
}
