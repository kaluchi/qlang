// [QSDSP#residence], [QSHST#source]

// [QSDSP#residence]
import './sequence.mjs';
import './map-primitives.mjs';
import './setops.mjs';
import './arith.mjs';
import './string-primitives.mjs';
import './json.mjs';
import './predicates.mjs';
import './control.mjs';
import './raise.mjs';
import './convert.mjs';
import './regex-primitives.mjs';
import './path-primitives.mjs';
import './with.mjs';
import './shape-primitives.mjs';
import './constructors.mjs';
import './tagged-primitives.mjs';
import './quote-steps.mjs';
import './host-primitives.mjs';
import './manifest.mjs';
import './code.mjs';
import './kind-primitives.mjs';
import './fn-primitives.mjs';
import './doc-primitives.mjs';
import './print.mjs';
import './legend-primitives.mjs';
import './axis.mjs';

import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { makeKeyword } from '../types.mjs';
import { declareRoot } from './root.mjs';
import { platformLocator, LANGUAGE_SOURCES, BuiltinBootstrapSourceMissingError } from './bootstrap.mjs';

const _templateScopeByLocator = new WeakMap();

// [QSHST#source]
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

// [QSDSP#residence]
function nounOfSource(uri) {
  return uri.slice(uri.lastIndexOf('/') + 1);
}

export async function buildLangRuntime(locator) {
  const sources = [];
  for (const uri of LANGUAGE_SOURCES) {
    const located = await locator(uri);
    if (located === null) throw new BuiltinBootstrapSourceMissingError({ origin: makeKeyword(uri) });
    sources.push({ uri, source: located.source, primitives: PRIMITIVE_REGISTRY.primitivesUnder(nounOfSource(uri)) });
  }
  const templateScope = await declareRoot(new Map(), sources);
  PRIMITIVE_REGISTRY.seal();
  return templateScope;
}
