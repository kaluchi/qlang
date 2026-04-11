// Bootstrap evaluator for manifest.qlang.
//
// Parses and evaluates the manifest source in an isolated session
// seeded with a minimal runtime (only `let` + literals). Returns
// a Map of descriptor conduits keyed by operand name keyword.
// The linker in runtime/index.mjs merges these descriptors with
// JS impls to build the full langRuntime.
//
// This is the qlang equivalent of C's crt0: the minimal execution
// environment that runs before the full runtime is assembled.

import { parse } from './parse.mjs';
import { evalAst } from './eval.mjs';
import { makeState, envSet } from './state.mjs';
import { keyword, isConduit, isKeyword } from './types.mjs';
import { MANIFEST_SOURCE } from '../gen/manifest.mjs';
import { letOperand } from './runtime/intro.mjs';

// bootstrapManifest() → Map<keyword, conduit>
//
// Evaluates manifest.qlang in a minimal env containing only the
// `let` operand. The manifest is a pipeline of let(:name, {...})
// calls, each writing a descriptor conduit into env. The result
// is an env Map where each key is an operand name keyword and
// each value is a conduit whose body is a descriptor Map literal,
// with .docs from the doc comments.
export function bootstrapManifest() {
  // Minimal bootstrap env: only `let` is needed to evaluate the
  // manifest. All other syntax (Map/Vec/Keyword literals, |, doc
  // comments) is handled by the parser and evaluator natively.
  const bootstrapEnv = new Map();
  bootstrapEnv.set(keyword('let'), letOperand);

  const ast = parse(MANIFEST_SOURCE, { uri: 'manifest.qlang' });
  const initialState = makeState(bootstrapEnv, bootstrapEnv);
  const finalState = evalAst(ast, initialState);

  // Extract all conduit entries — each is a descriptor authored
  // in manifest.qlang. The `let(:let, {...})` entry shadows the
  // bootstrap `let` operand during evaluation, but the resulting
  // conduit is still the descriptor we need for enrichment.
  const descriptors = new Map();
  for (const [k, v] of finalState.env) {
    if (isKeyword(k) && isConduit(v)) {
      descriptors.set(k, v);
    }
  }
  return descriptors;
}
