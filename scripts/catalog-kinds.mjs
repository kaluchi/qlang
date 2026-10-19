// The kinds of the catalog and the commands of a chain [QSNAM#address], [QSBLD#fn]: a kind is a
// label a source declares, a bare name by its page alone or by the chain or
// the literal that builds it from `::kind`, as the parser reads the source
// and `kinds` answers it, and a command one a chain takes, so no kind of the
// catalog bears the name of a command.

import { parse } from '../core/src/parse.mjs';
import { partOf } from '../core/src/walk.mjs';
import { isBindStep, declaresKind } from '../core/src/steps.mjs';
import { COMMAND_NAMES } from '../core/src/chain.mjs';

// kindsNamedForCommands(sources) → the kinds the sources, each `{ path, text
// }`, declare that bear the name of a command of a chain, each `{ path, line,
// name }`, the declarations the steps of its pipeline.
export function kindsNamedForCommands(sources) {
  return sources.flatMap(({ path, text }) => partOf(parse(text, { uri: path })).parts
    .filter(({ value }) => isBindStep(value) && declaresKind(value) && COMMAND_NAMES.includes(value.get('name').name))
    .map(({ value, span }) => ({ path, line: span.start.line, name: value.get('name').name })));
}
