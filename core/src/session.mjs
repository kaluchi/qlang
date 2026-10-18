// A session keeps the scope its cells write, each cell a query, taking what
// its host hands by the walk of the door [QSNAM#root], [QSDSP#residence], [QSHST#source].

import { parse, ParseError } from './parse.mjs';
import { evalAst } from './eval.mjs';
import { langRuntime } from './runtime/index.mjs';
import { rootState } from './state.mjs';
import { errorFromParse } from './error-convert.mjs';
import { declareRoot } from './runtime/root.mjs';
import { foreignPartOf } from './dispatch.mjs';
import { BuiltinForeignValueError } from './types.mjs';

// A value a host hands where the core takes it, the subject of a cell or what
// a name of a scope holds, held by the walk of the door, a value of no kind
// raised as `::builtin/ForeignValueError`; a scope is taken name by name, its
// root and the keys of the runtime's own aside [QSHST#source].
function takenFromAHost(value) {
  const foreign = foreignPartOf(value);
  if (foreign !== null) throw new BuiltinForeignValueError({ actualValue: foreign.account });
  return value;
}

function scopeTakenFromAHost(scope) {
  for (const [name, entry] of scope) if (typeof name === 'string') takenFromAHost(entry);
  return scope;
}

// createSession(opts?) → a session over `opts.scope`, the root's where none is
// handed, beside which `opts.sources`, `{ uri, source, primitives? }` in
// order, declare the root [QSDSP#residence]. `evalCell(source, evalOpts?)`
// runs one cell from `evalOpts.initialPipeValue`, null where the host gives
// none, its name `evalOpts.uri` or its number among the cells with none, and
// answers its entry `{ source, uri, result, defect, scopeAfterCell }`;
// `scope` is the scope its cells write.
export async function createSession(opts = {}) {
  let scope = opts.scope ? scopeTakenFromAHost(opts.scope) : await langRuntime();
  if (opts.sources) scope = await declareRoot(scope, opts.sources);
  let cellCount = 0;

  return {
    async evalCell(source, evalOpts = {}) {
      const uri = evalOpts.uri ?? `cell-${++cellCount}`;
      const entry = (result, defect) => ({ source, uri, result, defect, scopeAfterCell: scope });
      try {
        const ast = parse(source, { uri });
        const subject = 'initialPipeValue' in evalOpts ? takenFromAHost(evalOpts.initialPipeValue) : null;
        const answered = await evalAst(ast, rootState(subject, scope));
        scope = answered.env;
        return entry(answered.pipeValue, null);
      } catch (thrown) {
        // A failure to parse is an answer, naming the source a host named, a
        // cell the session numbers naming none; a throw past the fail track is
        // the cell's defect, which answers nothing [QSHST#source].
        return thrown instanceof ParseError ? entry(errorFromParse(thrown, scope, evalOpts.uri ?? null), null) : entry(null, thrown);
      }
    },

    get scope() { return scope; }
  };
}

// evalQuery(source, scope?) → the answer of one cell of a session over the
// scope, the root's where none is handed, a defect raised to its caller [QSHST#source].
export async function evalQuery(source, scope) {
  const { result, defect } = await (await createSession({ scope })).evalCell(source);
  if (defect !== null) throw defect;
  return result;
}
