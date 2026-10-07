// The environment every query starts from: the tree of names [D152], its
// root `core.qlang`, which binds the providers, the language's module
// `qlang.qlang`, which binds its nouns and the pages of its concepts, and
// under `lib/qlang/` the module of each noun, which the bootstrap walks
// from the root with nothing seeded but the host's locator [D36].

// Each module binds the primitives the catalog's verbs name into
// PRIMITIVE_REGISTRY as it loads.
import './vec.mjs';
import './map.mjs';
import './setops.mjs';
import './arith.mjs';
import './string.mjs';
import './format.mjs';
import './predicates.mjs';
import './control.mjs';
import './raise.mjs';
import './keyword.mjs';
import './tagged.mjs';
import './quote-steps.mjs';
import './verb.mjs';
import './env.mjs';
import './use.mjs';
import './manifest.mjs';
import './code.mjs';
import './doc.mjs';
import './print.mjs';
import './axis.mjs';

import { rootState } from '../state.mjs';
import { RUNTIME_LOCATOR_KEY } from '../env-keys.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { loadTree } from './use.mjs';
import { exportsOfModule, ROOT_MODULE_PATH } from './nouns.mjs';
import {
  platformLocator, BootstrapRootMissingError, BootstrapCatalogNotLoadedError
} from './bootstrap.mjs';

// One template per locator; each call answers a copy that the caller's
// declarations write into.
const _templateEnvByLocator = new WeakMap();

// langRuntime({ locator? }) → a copy of the environment the catalog
// builds, its sources read by `opts.locator`, `(namespaceName) →
// Promise<{ source } | null>`, or through `package.json#imports`; a
// bundle without an import map hands its own, as
// `site/scripts/_browser-entry.mjs` does.
export async function langRuntime(opts = {}) {
  const locator = opts.locator ?? platformLocator;
  let templatePromise = _templateEnvByLocator.get(locator);
  if (!templatePromise) {
    templatePromise = buildLangRuntime(locator);
    _templateEnvByLocator.set(locator, templatePromise);
  }
  const templateEnv = await templatePromise;
  return new Map(templateEnv);
}

// The bootstrap `langRuntime` memoises, callable with a locator of a
// test's own.
export async function buildLangRuntime(locator) {
  const seedEnv = new Map([[RUNTIME_LOCATOR_KEY, locator]]);
  let templateEnv;
  try {
    templateEnv = await loadTree(rootState(null, seedEnv), seedEnv, ROOT_MODULE_PATH);
  } catch (loadFailure) {
    throw new BootstrapCatalogNotLoadedError({ tagName: `::${loadFailure.name}` });
  }
  if (exportsOfModule(templateEnv, ROOT_MODULE_PATH) === null) throw new BootstrapRootMissingError();
  PRIMITIVE_REGISTRY.seal();
  return templateEnv;
}
