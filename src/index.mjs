// @kaluchi/qlang — public entry point.
//
// The qlang module exposes three top-level capabilities:
//   parse(source)             — source string → AST
//   evalQuery(source, env?)   — source string → final pipeValue
//   langRuntime               — the default built-in environment Map

import { parse } from './parse.mjs';
import { evalAst, evalQuery } from './eval.mjs';
import { langRuntime } from './runtime/index.mjs';

export { parse, evalAst, evalQuery, langRuntime };
