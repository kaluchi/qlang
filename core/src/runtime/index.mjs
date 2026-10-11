// The environment every query starts from: the root the language's
// sources declare [D153], each read by the host's locator, with nothing
// seeded before them.

// Each module binds the implementations of the language's verbs and
// kinds into PRIMITIVE_REGISTRY, by address, as it loads [D157].
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
import './manifest.mjs';
import './code.mjs';
import './doc.mjs';
import './print.mjs';
import './axis.mjs';

import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { declareRoot } from './root.mjs';
import { platformLocator, LANGUAGE_SOURCES, BuiltinBootstrapSourceMissingError } from './bootstrap.mjs';

// One template per locator; each call answers a copy that the caller's
// declarations write into.
const _templateEnvByLocator = new WeakMap();

// langRuntime({ locator? }) → a copy of the environment the language's
// sources declare, each read by `opts.locator`, `(uri) → Promise<{ source }
// | null>`, or through `package.json#imports`; a bundle without an import
// map hands its own, as `site/scripts/_browser-entry.mjs` does.
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

// The noun a source of the language declares, the last name of its uri:
// `qlang/number` declares `number`, and `qlang` the topic [D189].
function nounOfSource(uri) {
  return uri.slice(uri.lastIndexOf('/') + 1);
}

// The bootstrap `langRuntime` memoises, callable with a locator of a
// test's own.
export async function buildLangRuntime(locator) {
  const sources = [];
  for (const uri of LANGUAGE_SOURCES) {
    const located = await locator(uri);
    if (located === null) throw new BuiltinBootstrapSourceMissingError({ uri });
    sources.push({ uri, source: located.source, impls: PRIMITIVE_REGISTRY.implsUnder(nounOfSource(uri)) });
  }
  const templateEnv = await declareRoot(new Map(), sources);
  PRIMITIVE_REGISTRY.seal();
  return templateEnv;
}
