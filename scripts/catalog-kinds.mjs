// The kinds of the catalog and the commands of a chain [D357]: a kind is a
// label a source declares, a bare name by its page alone or by the chain or
// the literal that builds it from `::kind`, as the parser reads the source
// and `kinds` answers it, and a command one a chain takes, so no kind of the
// catalog bears the name of a command.

import { parse } from '../core/src/parse.mjs';
import { declaresKind } from '../core/src/walk.mjs';
import { COMMAND_NAMES } from '../core/src/runtime/chain.mjs';

// The declarations of the catalog a source writes, the steps of its pipeline.
function declarationsOf(ast) {
  const steps = ast.type === 'Pipeline' ? [ast.steps[0], ...ast.steps.slice(1).map(unit => unit.step)] : [ast];
  return steps.filter(step => step.type === 'BindStep');
}

// kindsNamedForCommands(sources) → the kinds the sources, each `{ path, text
// }`, declare that bear the name of a command of a chain, each `{ path, line,
// name }`.
export function kindsNamedForCommands(sources) {
  return sources.flatMap(({ path, text }) => declarationsOf(parse(text, { uri: path }))
    .filter(declaration => declaresKind(declaration) && COMMAND_NAMES.includes(declaration.key.name))
    .map(declaration => ({ path, line: declaration.location.start.line, name: declaration.key.name })));
}
