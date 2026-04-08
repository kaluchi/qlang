// @kaluchi/qlang — public entry point.
//
// The qlang module exposes its core capabilities for embedders:
//   parse(source, opts?)         — source string → AST
//   evalQuery(source, env?)      — source string → final pipeValue
//   evalAst(ast, state)          — pre-parsed AST → state
//   langRuntime()                — fresh built-in env Map
//   createSession(opts?)         — REPL / notebook session
//   serializeSession(session)    — session → JSON-safe payload
//   deserializeSession(json)     — JSON payload → session

import { parse } from './parse.mjs';
import { evalAst, evalQuery } from './eval.mjs';
import { langRuntime } from './runtime/index.mjs';
import {
  createSession,
  serializeSession,
  deserializeSession
} from './session.mjs';

export {
  parse,
  evalAst,
  evalQuery,
  langRuntime,
  createSession,
  serializeSession,
  deserializeSession
};
