// Assemble the langRuntime — the initial environment Map every
// query starts with. Two-phase construction:
//
// Phase 1: JS impls from runtime modules (dispatch-wrapped function
//          values with auto-computed `captured` range, no authored meta).
// Phase 2: Bootstrap manifest.qlang → descriptor conduits with
//          structured meta and doc comments. Linker enriches each
//          function value: manifest meta replaces the bare `captured`-
//          only meta, docs from doc comments populate the docs field.
//
// Declaration (manifest.qlang) is the single source of truth for
// all operand metadata. JS impls provide only the executable
// function. The linker merges both into the final function values
// that populate langRuntime.

import { keyword, isConduit } from '../types.mjs';
import { makeState } from '../state.mjs';
import { evalAst } from '../eval.mjs';
import * as vec from './vec.mjs';
import * as map from './map.mjs';
import * as setMod from './set.mjs';
import * as setops from './setops.mjs';
import * as arith from './arith.mjs';
import * as stringOps from './string.mjs';
import * as format from './format.mjs';
import * as predicates from './predicates.mjs';
import {
  env as envOperand,
  use as useOperand,
  reify as reifyOperand,
  manifest as manifestOperand,
  runExamples as runExamplesOperand,
  letOperand,
  asOperand
} from './intro.mjs';
import {
  ifOp,
  coalesce as coalesceOperand,
  when as whenOperand,
  unless as unlessOperand,
  firstTruthy as firstTruthyOperand,
  cond as condOperand
} from './control.mjs';
import { bootstrapManifest } from '../bootstrap.mjs';

// JS impl registry: name → function value (captured-only meta).
const IMPLS = {
  count: vec.count, empty: vec.empty, first: vec.first, last: vec.last,
  sum: vec.sum, min: vec.min, max: vec.max, every: vec.every, any: vec.any,
  firstNonZero: vec.firstNonZero,
  filter: vec.filter, sort: vec.sort, sortWith: vec.sortWith,
  take: vec.take, drop: vec.drop, distinct: vec.distinct,
  reverse: vec.reverse, flat: vec.flat,
  groupBy: vec.groupBy, indexBy: vec.indexBy,
  asc: vec.asc, desc: vec.desc, nullsFirst: vec.nullsFirst, nullsLast: vec.nullsLast,
  keys: map.keys, vals: map.vals, has: map.has,
  set: setMod.set,
  union: setops.union, minus: setops.minus, inter: setops.inter,
  add: arith.add, sub: arith.sub, mul: arith.mul, div: arith.div,
  split: stringOps.split, join: stringOps.join,
  contains: stringOps.contains, startsWith: stringOps.startsWith, endsWith: stringOps.endsWith,
  prepend: stringOps.prepend, append: stringOps.append,
  json: format.json, table: format.table,
  eq: predicates.eq, gt: predicates.gt, lt: predicates.lt,
  gte: predicates.gte, lte: predicates.lte,
  and: predicates.and, or: predicates.or, not: predicates.not,
  env: envOperand, use: useOperand, reify: reifyOperand,
  manifest: manifestOperand, runExamples: runExamplesOperand,
  let: letOperand, as: asOperand,
  if: ifOp, when: whenOperand, unless: unlessOperand,
  coalesce: coalesceOperand, firstTruthy: firstTruthyOperand, cond: condOperand
};

// Lazy bootstrap cache — parsed once, reused across langRuntime() calls.
let _manifestDescriptors = null;

function getDescriptors() {
  if (_manifestDescriptors !== null) return _manifestDescriptors;
  _manifestDescriptors = bootstrapManifest();
  return _manifestDescriptors;
}

// Force a conduit's body to get the descriptor Map.
function forceDescriptor(conduit) {
  const bodyState = makeState(null, new Map());
  return evalAst(conduit.body, bodyState).pipeValue;
}

// Enrich a function value with manifest meta + docs.
// The function value arrives with only `{ captured }` in meta
// (auto-computed by the dispatch helper). Enrichment replaces
// meta entirely with manifest-sourced fields, preserving `captured`.
function enrichWithManifest(fnValue, conduit) {
  const descriptor = forceDescriptor(conduit);
  if (!(descriptor instanceof Map)) return fnValue;

  const get = (k) => descriptor.get(keyword(k)) ?? null;
  const toArr = (v) => Array.isArray(v) ? v : [];
  const kwName = (v) => v && typeof v === 'object' && v.type === 'keyword' ? v.name : String(v);

  const enrichedMeta = {
    captured: fnValue.meta?.captured ?? null,
    category: kwName(get('category')),
    subject: get('subject'),
    returns: get('returns'),
    modifiers: toArr(get('modifiers')),
    docs: [...conduit.docs],
    examples: toArr(get('examples')),
    throws: toArr(get('throws')).map(kwName)
  };

  return Object.freeze({
    ...fnValue,
    meta: Object.freeze(enrichedMeta)
  });
}

// langRuntime() — returns a fresh env Map. Declaration-first:
// manifest.qlang provides structured meta and docs; JS impls
// provide the executable function.
export function langRuntime() {
  const m = new Map();
  const descriptors = getDescriptors();

  for (const [name, fnValue] of Object.entries(IMPLS)) {
    const nameKw = keyword(name);
    const conduit = descriptors.get(nameKw);
    const enriched = conduit ? enrichWithManifest(fnValue, conduit) : fnValue;
    m.set(nameKw, enriched);
  }

  return m;
}
