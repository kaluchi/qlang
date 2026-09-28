// The environment every query starts from: the catalog under
// `lib/qlang/`, one module per noun, which the root `core.qlang` lists
// and the bootstrap loads in order against a seed of the kernel [D36],
// [D72], [D113].

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

import { parse } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import { rootState } from '../state.mjs';
import { keyword, bindingValueOf, BUILTIN_TAG, stampTagHeader } from '../types.mjs';
import { RUNTIME_LOCATOR_KEY, tagBindingKey } from '../env-keys.mjs';
import { PRIMITIVE_REGISTRY, TYPE_KEY_PREFIX } from '../primitives.mjs';
import { stampThrowSiteSpec } from '../descriptor-ops.mjs';
import { importOrderedNamespaces } from './use.mjs';
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
  // The seed holds what the catalog uses before it can declare it: the
  // locator, and the constructor of `::builtin`, which the catalog
  // declares again with the same `:impl` [D36].
  const seedEnv = new Map();
  seedEnv.set(RUNTIME_LOCATOR_KEY, locator);
  const seedBuiltinDescriptor = new Map();
  seedBuiltinDescriptor.set('impl', keyword(TYPE_KEY_PREFIX + 'builtin'));
  stampTagHeader(seedBuiltinDescriptor, BUILTIN_TAG);
  seedEnv.set(tagBindingKey('builtin'), seedBuiltinDescriptor);

  const rootResult = await locator('qlang/core');
  if (rootResult === null) throw new BootstrapRootMissingError();
  const coreSource = rootResult.source;
  const coreAst = parse(coreSource, { uri: 'qlang/core' });
  const bootstrapState = rootState(null, seedEnv);
  const moduleNames = (await evalAst(coreAst, bootstrapState)).pipeValue;
  let templateEnv;
  try {
    templateEnv = await importOrderedNamespaces(bootstrapState, moduleNames);
  } catch (loadFailure) {
    throw new BootstrapCatalogNotLoadedError({ tagName: `::${loadFailure.name}` });
  }

  // A tag binding takes the facts its throw site recorded.
  for (const [envKey, entry] of templateEnv) stampThrowSiteSpec(bindingValueOf(entry), envKey);

  PRIMITIVE_REGISTRY.seal();

  return templateEnv;
}
