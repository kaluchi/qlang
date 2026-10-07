// A session keeps the env its cells write, so a query sees what the
// cells before it declared [D44], [D63].

import { parse, ParseError } from './parse.mjs';
import { evalAst } from './eval.mjs';
import { langRuntime } from './runtime/index.mjs';
import { rootState } from './state.mjs';
import { isBinding, keyword, makeBinding } from './types.mjs';
import { RUNTIME_LOCATOR_KEY, isRuntimeKey, moduleKey } from './env-keys.mjs';
import { errorFromParse } from './error-convert.mjs';
import { loadTree } from './runtime/use.mjs';
import { ROOT_MODULE_PATH } from './runtime/nouns.mjs';

// The env of a session whose host hands a locator: the host's modules
// beside the language's, which the locator before it still serves, and,
// when the host answers the root, `qlang/core`, the root read again with
// the providers the host binds there beside the language's, and the
// modules under them [D152].
const ROOT_SOURCE_PATH = 'qlang/core';

async function withHostLocator(env, hostLocator) {
  const languageLocator = env.get(RUNTIME_LOCATOR_KEY);
  const hostRoot = await hostLocator(ROOT_SOURCE_PATH);
  const locator = async path => {
    if (path !== ROOT_SOURCE_PATH || hostRoot === null) return (await hostLocator(path)) ?? await languageLocator(path);
    const languageRoot = await languageLocator(ROOT_SOURCE_PATH);
    return { source: `${languageRoot.source}\n${hostRoot.source}` };
  };
  const hostEnv = new Map(env).set(RUNTIME_LOCATOR_KEY, locator);
  if (hostRoot === null) return hostEnv;
  hostEnv.delete(moduleKey(ROOT_MODULE_PATH));
  return await loadTree(rootState(null, hostEnv), hostEnv, ROOT_MODULE_PATH);
}

// createSession(opts?) → Session
//
// opts:
//   env     — initial env Map (defaults to a fresh langRuntime())
//   locator — async (path: string) => {source, impls?} | null, asked
//             before the language's for a module the env lacks, the root
//             `qlang/core` among them.
//
// Returns an object with:
//   evalCell(source, evalOpts?) — parse and evaluate one cell, the
//     entry { source, uri, ast, result, error, envAfterCell } its
//     answer; `evalOpts.initialPipeValue` is the subject of its first
//     step, null when absent, and `evalOpts.uri` its name, a cell
//     without one numbered among the cells without one.
//   env — the current env Map
//   bind(name, value) — install a binding into env
export async function createSession(opts = {}) {
  let env = opts.env ?? await langRuntime();
  if (opts.locator) env = await withHostLocator(env, opts.locator);
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
          ? evalOpts.initialPipeValue
          : null;
        const cellInitialState = rootState(cellSeedPipeValue, env);
        const cellFinalState = await evalAst(cellAst, cellInitialState);
        cellResult = cellFinalState.pipeValue;
        env = cellFinalState.env;
      } catch (evalCellErr) {
        // A parse failure answers its error value beside the throw, so
        // the host prints it as it prints any error and still tells a
        // syntactic failure by the error channel.
        if (evalCellErr instanceof ParseError) {
          cellResult = errorFromParse(evalCellErr);
        }
        cellError = evalCellErr;
      }
      return { source, uri: cellUri, ast: cellAst, result: cellResult, error: cellError, envAfterCell: env };
    },

    // A host binds a value as a binding without a doc [D63], a record
    // as the binding it is, and a key of the runtime's own as it lies.
    bind(name, value) {
      env = new Map(env).set(name, isRuntimeKey(name) || isBinding(value)
        ? value
        : makeBinding({ name: keyword(name), value }));
    },

    get env() { return env; }
  };
}

