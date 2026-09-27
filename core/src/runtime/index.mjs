// The environment every query starts from: the catalog under
// `lib/qlang/`, one module per noun, which `core.qlang` loads through
// one `use […]` against a seed of the kernel [D36], [D72].

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
import './error.mjs';
import './keyword-op.mjs';
import './tagged.mjs';
import './quote-steps.mjs';
import './verb.mjs';
import './env-op.mjs';
import './use-op.mjs';
import './manifest-op.mjs';
import './codeAsData.mjs';
import './axis.mjs';

// The codec and the session declare refusals whose facts the stamp
// pass below reads.
import '../codec.mjs';
import '../session.mjs';

import { parse } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import { rootState } from '../state.mjs';
import {
  keyword, isErrorValue, bindingValueOf, BUILTIN_TAG, stampTagHeader, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { RUNTIME_LOCATOR_KEY, tagBindingKey, isTagBindingName } from '../env-keys.mjs';
import { PRIMITIVE_REGISTRY, primKey, TYPE_KEY_PREFIX } from '../primitives.mjs';
import { stampStructuralFacts, stampThrowSiteSpec } from '../descriptor-ops.mjs';
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
  // The seed holds what the catalog uses before it can declare it:
  // `use`, the locator, and the constructor of `::builtin`, which the
  // catalog declares again with the same `:impl` [D36].
  const seedEnv = new Map();
  seedEnv.set('use', PRIMITIVE_REGISTRY.resolve(primKey('use')));
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
  const bootstrapResult = await evalAst(coreAst, bootstrapState);
  if (isErrorValue(bootstrapResult.pipeValue)) {
    throw new BootstrapCatalogNotLoadedError({
      tagName: bootstrapResult.pipeValue.tag.literal
    });
  }
  const templateEnv = bootstrapResult.env;

  // A tag binding takes the facts its throw site recorded, and the one
  // descriptor left beside them, `use` [D79], its primitive.
  for (const [envKey, entry] of templateEnv) {
    const descriptor = bindingValueOf(entry);
    if (!(descriptor instanceof Map)) continue;
    if (descriptor[TAG_HEADER_SYMBOL]?.name !== 'builtin') continue;
    if (isTagBindingName(envKey)) {
      stampThrowSiteSpec(descriptor, envKey);
      continue;
    }
    const implKey = descriptor.get('impl');
    stampStructuralFacts(descriptor, PRIMITIVE_REGISTRY.resolve(implKey.name), envKey);
  }

  PRIMITIVE_REGISTRY.seal();

  return templateEnv;
}
