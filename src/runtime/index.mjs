// Assemble the langRuntime — the initial environment Map every
// query starts with. Under the Variant-B model every runtime module
// lives in one of two places:
//
//   1. lib/qlang/core.qlang — the authored source catalog. One
//      Map literal whose entries are descriptor Maps carrying
//      :qlang/kind :builtin and :qlang/impl :qlang/prim/<name>
//      keywords that resolve against PRIMITIVE_REGISTRY at dispatch
//      time. Doc-comment prefixes fold into :docs Vecs at eval
//      time via MapEntryDocPrefix + foldEntryDocs.
//
//   2. src/runtime/*.mjs — the JS-level primitive impls. Each
//      module binds its impls into PRIMITIVE_REGISTRY at import
//      time under namespaced :qlang/prim/<name> keys. The
//      dispatch wrappers in src/runtime/dispatch.mjs (valueOp,
//      higherOrderOp, nullaryOp, overloadedOp, stateOp,
//      stateOpVariadic, higherOrderOpVariadic) attach a tiny
//      meta object carrying only the `captured` range — the rest
//      of the metadata lives in core.qlang and is addressed by
//      descriptor-Map projection at reify / manifest time.
//
// langRuntime() ties the two together by parsing core.qlang once,
// evaluating it against an empty env into a template Map, and
// handing back a shallow copy on every call so callers can add
// their own bindings (let, as, use) without mutating the template.
// The descriptor Maps inside the template are frozen and shared
// between copies — safe because qlang values are immutable at the
// language level.
//
// Importing this file is what wires the primitive registry: every
// runtime/*.mjs module listed in the import block runs its side-
// effect registry bindings at module-load time, so by the time
// langRuntime() parses core.qlang, PRIMITIVE_REGISTRY already
// holds every :qlang/prim/* key that the descriptors reference.

// Side-effect imports — each runtime module binds its impls into
// PRIMITIVE_REGISTRY during module load. The imports themselves
// carry no named binding; the act of importing triggers the
// registration blocks at the tail of each file.
import './vec.mjs';
import './map.mjs';
import './set.mjs';
import './setops.mjs';
import './arith.mjs';
import './string.mjs';
import './format.mjs';
import './predicates.mjs';
import './control.mjs';
import './error.mjs';
import './intro.mjs';

import { parse } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import { makeState } from '../state.mjs';
import { keyword, isKeyword } from '../types.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { CORE_SOURCE } from '../../gen/core.mjs';

const KW_QLANG_KIND = keyword('qlang/kind');
const KW_BUILTIN    = keyword('builtin');
const KW_QLANG_IMPL = keyword('qlang/impl');

// Cached template env — parsed and evaluated once on first call,
// then shallow-copied for every subsequent caller. Parsing
// core.qlang on every session construction would be wasteful;
// reusing the frozen descriptor Maps across sessions is safe
// because they are immutable.
let _templateEnvPromise = null;

// langRuntime() — returns a Promise<fresh env Map> seeded with the
// full built-in catalog. Each call returns a new top-level Map, so
// callers can write their own bindings (through let / as / use,
// or through session.bind at the host level) without affecting
// other sessions. The inner descriptor Maps are shared frozen
// values. Bootstrap is async because evalAst is async; the template
// is cached so the parse+eval happens once per process.
export async function langRuntime() {
  if (_templateEnvPromise === null) {
    _templateEnvPromise = (async () => {
      const coreAst = parse(CORE_SOURCE, { uri: 'qlang/core' });
      const bootstrapState = makeState(null, new Map());
      const bootstrapResult = await evalAst(coreAst, bootstrapState);
      const templateEnv = bootstrapResult.pipeValue;

      // Resolution pass: replace :qlang/impl keywords with the
      // resolved function values from PRIMITIVE_REGISTRY. After this
      // pass, every builtin descriptor carries its executable impl
      // directly — dispatch reads the function from the descriptor
      // without consulting the registry at call time.
      for (const descriptor of templateEnv.values()) {
        if (descriptor instanceof Map
            && descriptor.get(KW_QLANG_KIND) === KW_BUILTIN) {
          const implKey = descriptor.get(KW_QLANG_IMPL);
          if (isKeyword(implKey) && PRIMITIVE_REGISTRY.has(implKey)) {
            descriptor.set(KW_QLANG_IMPL, PRIMITIVE_REGISTRY.resolve(implKey));
          }
        }
      }
      PRIMITIVE_REGISTRY.seal();

      return templateEnv;
    })();
  }
  const templateEnv = await _templateEnvPromise;
  return new Map(templateEnv);
}
