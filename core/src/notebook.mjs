// [QSNAM#root], [QSDSP#residence], [QSHST#notebook]

import { parseSource, SourceParseError } from './parse.mjs';
import { evalAtTheTop } from './eval.mjs';
import { langRuntime } from './runtime/lang-runtime.mjs';
import { rootState } from './state.mjs';
import { refusalOfAParse } from './runtime/code.mjs';
import { declareRoot } from './runtime/root.mjs';
import { foreignPartOf } from './dispatch.mjs';
import { BuiltinForeignValueError } from './types.mjs';

// [QSHST#door]
function takenFromAHost(value) {
  const foreign = foreignPartOf(value);
  if (foreign !== null) throw new BuiltinForeignValueError({ found: foreign.account });
  return value;
}

function scopeTakenFromAHost(scope) {
  for (const [name, entry] of scope) if (typeof name === 'string') takenFromAHost(entry);
  return scope;
}

// [QSDSP#residence], [D469]
export async function createNotebook(opts = {}) {
  let scope = opts.scope ? scopeTakenFromAHost(opts.scope) : await langRuntime();
  if (opts.sources) scope = await declareRoot(scope, opts.sources);
  let cellCount = 0;

  return {
    async evalCell(source, evalOpts = {}) {
      const uri = evalOpts.uri ?? `cell-${++cellCount}`;
      const entry = (result, defect) => ({ source, uri, result, defect, scopeAfterCell: scope });
      try {
        const quote = parseSource(source, { uri });
        const subject = 'initialPipeValue' in evalOpts ? takenFromAHost(evalOpts.initialPipeValue) : null;
        const answered = await evalAtTheTop(quote, rootState(subject, scope));
        scope = answered.scope;
        return entry(answered.pipeValue, null);
      } catch (thrown) {
        // [QSHST#notebook]
        return thrown instanceof SourceParseError ? entry(await refusalOfAParse(thrown, scope, evalOpts.uri ?? null), null) : entry(null, thrown);
      }
    },

    get scope() { return scope; }
  };
}

export async function evalQuery(source, scope) {
  const { result, defect } = await (await createNotebook({ scope })).evalCell(source);
  if (defect !== null) throw defect;
  return result;
}
