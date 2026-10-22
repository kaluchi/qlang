// [QSNAM#root], [QSDSP#residence], [QSHST#session]

import { parse, ParseError } from './parse.mjs';
import { evalPipeline } from './eval.mjs';
import { langRuntime } from './runtime/index.mjs';
import { rootState } from './state.mjs';
import { errorFromParse } from './error-convert.mjs';
import { declareRoot } from './runtime/root.mjs';
import { foreignPartOf } from './dispatch.mjs';
import { BuiltinForeignValueError } from './types.mjs';

// [QSHST#door]
function takenFromAHost(value) {
  const foreign = foreignPartOf(value);
  if (foreign !== null) throw new BuiltinForeignValueError({ actualValue: foreign.account });
  return value;
}

function scopeTakenFromAHost(scope) {
  for (const [name, entry] of scope) if (typeof name === 'string') takenFromAHost(entry);
  return scope;
}

// [QSDSP#residence]
export async function createSession(opts = {}) {
  let scope = opts.scope ? scopeTakenFromAHost(opts.scope) : await langRuntime();
  if (opts.sources) scope = await declareRoot(scope, opts.sources);
  let cellCount = 0;

  return {
    async evalCell(source, evalOpts = {}) {
      const uri = evalOpts.uri ?? `cell-${++cellCount}`;
      const entry = (result, defect) => ({ source, uri, result, defect, scopeAfterCell: scope });
      try {
        const quote = parse(source, { uri });
        const subject = 'initialPipeValue' in evalOpts ? takenFromAHost(evalOpts.initialPipeValue) : null;
        const answered = await evalPipeline(quote, rootState(subject, scope));
        scope = answered.scope;
        return entry(answered.pipeValue, null);
      } catch (thrown) {
        // [QSHST#session]
        return thrown instanceof ParseError ? entry(errorFromParse(thrown, scope, evalOpts.uri ?? null), null) : entry(null, thrown);
      }
    },

    get scope() { return scope; }
  };
}

export async function evalQuery(source, scope) {
  const { result, defect } = await (await createSession({ scope })).evalCell(source);
  if (defect !== null) throw defect;
  return result;
}
