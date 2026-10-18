// A session keeps the scope its cells write, taking what its host hands by
// the walk of the door [QSNAM#root], [QSDSP#residence], [QSHST#source].

import { parse, ParseError } from './parse.mjs';
import { evalAst } from './eval.mjs';
import { langRuntime } from './runtime/index.mjs';
import { rootState } from './state.mjs';
import { errorFromParse } from './error-convert.mjs';
import { declareRoot } from './runtime/root.mjs';
import { takenFromAHost, scopeTakenFromAHost } from './runtime/verb.mjs';

// createSession(opts?) → Session
//
// opts:
//   scope   — the scope its first cell reads (defaults to a fresh langRuntime())
//   sources — the host's sources, `{ uri, source, primitives? }` in order,
//             which declare the root beside the language's [QSDSP#residence].
//
// Returns an object with:
//   evalCell(source, evalOpts?) — parse and evaluate one cell, the
//     entry { source, uri, ast, result, error, scopeAfterCell } its
//     answer; `evalOpts.initialPipeValue` is the subject of its first
//     step, null where the host gives none, and `evalOpts.uri` its
//     name, a cell without one numbered among the cells without one.
//   scope — the current scope
export async function createSession(opts = {}) {
  let scope = opts.scope ? scopeTakenFromAHost(opts.scope) : await langRuntime();
  if (opts.sources) scope = await declareRoot(scope, opts.sources);
  let cellCount = 0;

  return {
    async evalCell(source, evalOpts = {}) {
      const cellUri = evalOpts.uri ?? `cell-${++cellCount}`;
      let cellAst = null;
      let cellResult = null;
      let cellError = null;
      try {
        cellAst = parse(source, { uri: cellUri });
        const cellSeedPipeValue = 'initialPipeValue' in evalOpts
          ? takenFromAHost(evalOpts.initialPipeValue)
          : null;
        const cellInitialState = rootState(cellSeedPipeValue, scope);
        const cellFinalState = await evalAst(cellAst, cellInitialState);
        cellResult = cellFinalState.pipeValue;
        scope = cellFinalState.env;
      } catch (evalCellErr) {
        // A parse failure answers its error value beside the throw, so
        // the host prints it as it prints any error and still tells a
        // syntactic failure by the error channel; it names the source
        // its text came from where the host named one, a cell the
        // session numbers itself naming none.
        if (evalCellErr instanceof ParseError) {
          cellResult = errorFromParse(evalCellErr, scope, evalOpts.uri ?? null);
        }
        cellError = evalCellErr;
      }
      return { source, uri: cellUri, ast: cellAst, result: cellResult, error: cellError, scopeAfterCell: scope };
    },

    get scope() { return scope; }
  };
}
