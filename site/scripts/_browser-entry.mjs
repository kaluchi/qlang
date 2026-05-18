// Reference browser-embedding entry point for qlang.
//
// Bundles into `site/public/qlang.js` through
// `site/scripts/bundle-qlang.mjs`. The bundler's `text` loader
// rewrites each `import <name> from '<path>.qlang'` line into a
// JS string at build time, so the resulting bundle ships catalog
// source-of-truth alongside the evaluator and resolves every
// `use(:qlang/<ns>)` from an in-process Map without a network
// fetch.
//
// Embedders hosting qlang in a browser tab copy this pattern:
// re-export the core API from `@kaluchi/qlang-core`, statically
// import every `.qlang` catalog file the runtime needs, and
// expose an `inlineCatalogLocator` named export. Consumer code
// then calls `await langRuntime({ locator: inlineCatalogLocator })`
// to bootstrap. No `<script type="importmap">`, no `fetch`, no
// host-side resolver glue.

import coreSource              from '@kaluchi/qlang-core/lib/qlang/core.qlang';
import runtimeInvariantsSource from '@kaluchi/qlang-core/lib/qlang/runtime-invariants.qlang';
import tagSource               from '@kaluchi/qlang-core/lib/qlang/tag.qlang';
import arithSource             from '@kaluchi/qlang-core/lib/qlang/operand/arith.qlang';
import axisSource              from '@kaluchi/qlang-core/lib/qlang/operand/axis.qlang';
import codeAsDataSource        from '@kaluchi/qlang-core/lib/qlang/operand/code-as-data.qlang';
import comparatorSource        from '@kaluchi/qlang-core/lib/qlang/operand/comparator.qlang';
import containerSource         from '@kaluchi/qlang-core/lib/qlang/operand/container.qlang';
import controlSource           from '@kaluchi/qlang-core/lib/qlang/operand/control.qlang';
import errorSource             from '@kaluchi/qlang-core/lib/qlang/operand/error.qlang';
import formatSource            from '@kaluchi/qlang-core/lib/qlang/operand/format.qlang';
import mapOpSource             from '@kaluchi/qlang-core/lib/qlang/operand/map-op.qlang';
import predicateSource         from '@kaluchi/qlang-core/lib/qlang/operand/predicate.qlang';
import reflectiveSource        from '@kaluchi/qlang-core/lib/qlang/operand/reflective.qlang';
import setOpSource             from '@kaluchi/qlang-core/lib/qlang/operand/set-op.qlang';
import stringSource            from '@kaluchi/qlang-core/lib/qlang/operand/string.qlang';
import typeClassifierSource    from '@kaluchi/qlang-core/lib/qlang/operand/type-classifier.qlang';
import typeConversionSource    from '@kaluchi/qlang-core/lib/qlang/operand/type-conversion.qlang';
import vecSource               from '@kaluchi/qlang-core/lib/qlang/operand/vec.qlang';

// Logical-name keys here mirror `core.qlang`'s `use([:qlang/<ns>])`
// invocation list — the locator is the only seam the runtime calls
// to fetch a namespace.
const CATALOG = new Map([
  ['qlang/core',                    coreSource],
  ['qlang/runtime-invariants',      runtimeInvariantsSource],
  ['qlang/tag',                     tagSource],
  ['qlang/operand/arith',           arithSource],
  ['qlang/operand/axis',            axisSource],
  ['qlang/operand/code-as-data',    codeAsDataSource],
  ['qlang/operand/comparator',      comparatorSource],
  ['qlang/operand/container',       containerSource],
  ['qlang/operand/control',         controlSource],
  ['qlang/operand/error',           errorSource],
  ['qlang/operand/format',          formatSource],
  ['qlang/operand/map-op',          mapOpSource],
  ['qlang/operand/predicate',       predicateSource],
  ['qlang/operand/reflective',      reflectiveSource],
  ['qlang/operand/set-op',          setOpSource],
  ['qlang/operand/string',          stringSource],
  ['qlang/operand/type-classifier', typeClassifierSource],
  ['qlang/operand/type-conversion', typeConversionSource],
  ['qlang/operand/vec',             vecSource]
]);

export async function inlineCatalogLocator(namespaceName) {
  return CATALOG.has(namespaceName)
    ? { source: CATALOG.get(namespaceName) }
    : null;
}

// Re-export the API the embedding script consumes. Bundling
// through this entry keeps `@kaluchi/qlang-core` as a peer of the
// inline-catalog locator — the consumer imports both from the
// same `qlang.js` bundle without ever touching the locator
// machinery itself.
export {
  evalQuery,
  printValue,
  langRuntime,
  parse,
  createSession,
  serializeSession,
  deserializeSession
} from '@kaluchi/qlang-core';
