// The scope every query starts from: the root the language's sources declare
// [QSDSP#residence], each read by the host's locator, with nothing seeded
// before them [QSHST#source].

// Each module registers the primitives of the language's verbs and kinds
// into PRIMITIVE_REGISTRY, by address, as it loads [QSDSP#residence].
import './vec.mjs';
import './map.mjs';
import './setops.mjs';
import './arith.mjs';
import './string.mjs';
import './format.mjs';
import './predicates.mjs';
import './control.mjs';
import './raise.mjs';
import './convert.mjs';
import './regex.mjs';
import './path.mjs';
import './tagged.mjs';
import './quote-steps.mjs';
import './verb.mjs';
import './env.mjs';
import './manifest.mjs';
import './code.mjs';
import './kind.mjs';
import './fn.mjs';
import './doc.mjs';
import './print.mjs';
import './axis.mjs';

import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { keyword } from '../types.mjs';
import { declareRoot } from './root.mjs';
import { platformLocator, LANGUAGE_SOURCES, BuiltinBootstrapSourceMissingError } from './bootstrap.mjs';

// One template per locator; each call answers a copy that the caller's
// declarations write into.
const _templateScopeByLocator = new WeakMap();

// langRuntime({ locator? }) → a copy of the scope of the root the language's
// sources declare, each read by `opts.locator`, `(uri) → Promise<{ source }
// | null>`, or through `package.json#imports`; a bundle without an import
// map hands its own, as `site/scripts/_browser-entry.mjs` does [QSHST#source].
export async function langRuntime(opts = {}) {
  const locator = opts.locator ?? platformLocator;
  let templatePromise = _templateScopeByLocator.get(locator);
  if (!templatePromise) {
    templatePromise = buildLangRuntime(locator);
    _templateScopeByLocator.set(locator, templatePromise);
  }
  const templateScope = await templatePromise;
  return new Map(templateScope);
}

// The noun a source of the language declares, the last name of its uri:
// `qlang/number` declares `number`, and `qlang` the topic [QSDSP#residence].
function nounOfSource(uri) {
  return uri.slice(uri.lastIndexOf('/') + 1);
}

// The bootstrap `langRuntime` memoises, callable with a locator of a
// test's own.
export async function buildLangRuntime(locator) {
  const sources = [];
  for (const uri of LANGUAGE_SOURCES) {
    const located = await locator(uri);
    if (located === null) throw new BuiltinBootstrapSourceMissingError({ origin: keyword(uri) });
    sources.push({ uri, source: located.source, primitives: PRIMITIVE_REGISTRY.primitivesUnder(nounOfSource(uri)) });
  }
  const templateScope = await declareRoot(new Map(), sources);
  PRIMITIVE_REGISTRY.seal();
  return templateScope;
}
