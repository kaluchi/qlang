// Reflective built-ins — operands that live on the state level
// instead of the value level.
//
// `env`, `use`, `reify`, and `manifest` read or write the full
// state pair, so they are built with `stateOp` / `stateOpVariadic`
// (raw state transformers, no pipeValue extraction or result
// wrapping). Semantically they are ordinary entries in langRuntime;
// syntactically they are ordinary identifiers. They can be shadowed
// by `let` or `as` like any other name — the "reflectiveness" is
// a property of the value bound to the name, not of the grammar.
//
// Meta lives in lib/qlang/core.qlang.

import { stateOp, stateOpVariadic } from './dispatch.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { astNodeToMap, qlangMapToAst, locationToQlangMap } from '../walk.mjs';
import { makeState, withPipeValue, envMerge } from '../state.mjs';
import {
  isQMap, isFunctionValue, isConduit, isSnapshot, isKeyword,
  isVec, isQSet, isQuote,
  typeKeyword, keyword, makeSnapshot, makeQuote, isErrorValue,
  isModuleAstKey, isTypeBindingName, moduleAstKey
} from '../types.mjs';
import {
  declareSubjectError,
  declareShapeError,
  declareArityError
} from '../operand-errors.mjs';
import { errorFromParse } from '../error-convert.mjs';
import { UnresolvedIdentifierError } from '../errors.mjs';
// Live ESM binding into eval.mjs — runtime/index.mjs → intro.mjs →
// eval.mjs → runtime/index.mjs forms a cycle; we never touch
// evalQuery at module-init time, only from inside the runExamples
// closure which is called long after every module has finished
// loading, so the binding resolves correctly.
import { evalQuery, evalAst } from '../eval.mjs';
import { parse as parseSource } from '../parse.mjs';
import { findBindingStepAcrossModules } from './axis.mjs';
import { parseDocSegments } from '../doc-segments.mjs';

const UseSubjectNotMap = declareSubjectError('UseSubjectNotMap', 'use', 'map');
const UseNamespaceNotKeyword = declareShapeError('UseNamespaceNotKeyword',
  ({ actualType }) => `use(:namespace) requires a keyword, got ${actualType.name}`);
const UseNamespaceNotFound = declareShapeError('UseNamespaceNotFound',
  ({ namespaceName }) => `use: namespace '${namespaceName}' not found in env`);
const UseNamespaceNotMap = declareShapeError('UseNamespaceNotMap',
  ({ namespaceName, actualType }) => `use: namespace '${namespaceName}' is ${actualType.name}, expected Map`);
const UseNamespaceElementNotKeyword = declareShapeError('UseNamespaceElementNotKeyword',
  ({ index, actualType }) => `use: element ${index} of namespace list must be a keyword, got ${actualType.name}`);
const UseNamespaceCollision = declareShapeError('UseNamespaceCollision',
  ({ collidingName, namespaces }) => `use: name '${collidingName}' exported by multiple namespaces: ${namespaces.join(', ')}`);
const UseNameNotExported = declareShapeError('UseNameNotExported',
  ({ namespaceName, exportName }) => `use: '${exportName}' not exported by namespace '${namespaceName}'`);
const ReifyArityOverflow = declareArityError('ReifyArityOverflow',
  ({ actualArity }) => `reify accepts 0 or 1 captured args, got ${actualArity}`);
const ReifyKeyNotKeyword = declareShapeError('ReifyKeyNotKeyword',
  ({ actualType }) => `reify(:name) requires a keyword captured arg, got ${actualType.name}`);

// env — replaces pipeValue with the current env Map.
export const env = stateOp('env', 1, (state, _lambdas) =>
  withPipeValue(state, state.env));

// use — overloaded by arity:
//   0 captured: merge pipeValue Map into env (existing)
//   1 captured: namespace import (keyword, Vec, or Set)
//   2 captured: selective namespace import (keyword + filter Set/Vec)
export const use = stateOpVariadic('use', 3, async (state, useLambdas) => {
  if (useLambdas.length === 0) {
    // Zero captured args: merge pipeValue Map into env
    if (!isQMap(state.pipeValue)) {
      throw new UseSubjectNotMap(state.pipeValue);
    }
    return makeState(state.pipeValue, envMerge(state.env, state.pipeValue));
  }

  const useArg = await useLambdas[0](state.pipeValue);

  if (useLambdas.length === 1) {
    // Single arg — dispatch by type
    if (isKeyword(useArg))  return await importSingleNamespace(state, useArg);
    if (isVec(useArg))      return await importOrderedNamespaces(state, useArg);
    if (isQSet(useArg))     return await importUnorderedNamespaces(state, useArg);
    throw new UseNamespaceNotKeyword({ actualType: typeKeyword(useArg), actualValue: useArg });
  }

  // Two args: namespace keyword + selection filter
  if (!isKeyword(useArg)) {
    throw new UseNamespaceNotKeyword({ actualType: typeKeyword(useArg), actualValue: useArg });
  }
  const useSelection = await useLambdas[1](state.pipeValue);
  return await importSelectiveNamespace(state, useArg, useSelection);
}, [0, 2]);

// resolveNamespaceEnv(outerEnv, nsKeyword) → moduleEnv Map
//
// Looks up the namespace keyword in env. When absent, falls back
// to the host-provided locator (stored under :qlang/locator in
// env by createSession). The locator parses and evals the module
// source, patches :qlang/impl on builtin descriptors with the
// impls from the locator result, and installs the namespace
// keyword in env for subsequent lookups.
//
// Returns [moduleEnv, updatedOuterEnv] — the caller must use
// updatedOuterEnv so the installed namespace persists.
async function resolveNamespaceEnv(outerEnv, nsKeyword) {
  if (outerEnv.has(nsKeyword.name)) {
    const moduleEnv = outerEnv.get(nsKeyword.name);
    if (!isQMap(moduleEnv)) {
      throw new UseNamespaceNotMap({
        namespaceName: nsKeyword.name,
        actualType: typeKeyword(moduleEnv)
      });
    }
    return [moduleEnv, outerEnv];
  }

  // Locator fallback: host-provided lazy module loader.
  const locatorFn = outerEnv.get('qlang/locator');
  if (!locatorFn) {
    throw new UseNamespaceNotFound({ namespaceName: nsKeyword.name });
  }
  const locatorResult = await locatorFn(nsKeyword.name);
  if (!locatorResult) {
    throw new UseNamespaceNotFound({ namespaceName: nsKeyword.name });
  }

  // Parse and eval the module source. The module is a Map
  // expression (like core.qlang) — its pipeValue IS the exports.
  // Env-delta modules (let declarations) work too: their env delta
  // is picked up below as a fallback when pipeValue is not a Map.
  const moduleAst = parseSource(locatorResult.source, { uri: nsKeyword.name });
  const moduleEvalState = makeState(outerEnv, outerEnv);
  const moduleResultState = await evalAst(moduleAst, moduleEvalState);

  // Export surface = env delta (bindings the module added).
  // Modules using | use to install descriptor Maps into env work
  // through this path. Pure Map-expression modules (no | use) must
  // pipe through use to land their entries in env.
  const loadedExports = new Map();
  for (const [exportKey, exportVal] of moduleResultState.env) {
    if (!outerEnv.has(exportKey)) {
      loadedExports.set(exportKey, exportVal);
    }
  }

  // Stamp the resolved JS function value onto each freshly-built
  // builtin descriptor before sealing the export Map. The descriptor
  // is still the loader's mutable build buffer at this point — it
  // becomes immutable once it lands in `envWithNamespace` below — so
  // the `.set` is a single mint-site write under the same factory
  // ceremony as `makeConduit` / `makeSnapshot`.
  if (locatorResult.impls) {
    for (const [implName, implFn] of Object.entries(locatorResult.impls)) {
      const implDescriptor = loadedExports.get(implName);
      const descKind = isQMap(implDescriptor) && implDescriptor.get('qlang/kind');
      if (descKind && descKind.name === 'builtin') {
        implDescriptor.set('qlang/impl', implFn);
      }
    }
  }

  // Install namespace keyword → exports in env for subsequent lookups.
  const envWithNamespace = new Map(outerEnv);
  envWithNamespace.set(nsKeyword.name, loadedExports);
  // Stamp the loaded module's source as a Quote-value under the
  // canonical `qlang/ast/<ns>` env key — same surface the core
  // module gets in langRuntime, so axis-operands walk every
  // loaded namespace through one mechanism.
  envWithNamespace.set(moduleAstKey(nsKeyword.name), makeQuote(locatorResult.source, moduleAst));
  return [loadedExports, envWithNamespace];
}

async function importSingleNamespace(state, nsKeyword) {
  const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(state.env, nsKeyword);
  return makeState(state.pipeValue, envMerge(updatedEnv, moduleEnv));
}

async function importOrderedNamespaces(state, namespaces) {
  let currentEnv = state.env;
  for (let i = 0; i < namespaces.length; i++) {
    const ns = namespaces[i];
    if (!isKeyword(ns)) {
      throw new UseNamespaceElementNotKeyword({ index: i, actualType: typeKeyword(ns) });
    }
    const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(currentEnv, ns);
    currentEnv = envMerge(updatedEnv, moduleEnv);
  }
  return makeState(state.pipeValue, currentEnv);
}

async function importUnorderedNamespaces(state, namespaces) {
  const merged = new Map();
  const origins = new Map();
  let accumulatedEnv = state.env;
  for (const ns of namespaces) {
    const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(accumulatedEnv, ns);
    accumulatedEnv = updatedEnv;
    for (const [k, v] of moduleEnv) {
      if (merged.has(k)) {
        throw new UseNamespaceCollision({
          collidingName: k,
          namespaces: [origins.get(k), ns.name]
        });
      }
      merged.set(k, v);
      origins.set(k, ns.name);
    }
  }
  return makeState(state.pipeValue, envMerge(accumulatedEnv, merged));
}

async function importSelectiveNamespace(state, nsKeyword, selection) {
  const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(state.env, nsKeyword);
  const names = isQSet(selection) ? [...selection] : isVec(selection) ? selection : [selection];
  const filtered = new Map();
  for (const name of names) {
    const nameStr = isKeyword(name) ? name.name : String(name);
    if (!moduleEnv.has(nameStr)) {
      throw new UseNameNotExported({
        namespaceName: nsKeyword.name,
        exportName: nameStr
      });
    }
    filtered.set(nameStr, moduleEnv.get(nameStr));
  }
  return makeState(state.pipeValue, envMerge(updatedEnv, filtered));
}

// ── reify and manifest ─────────────────────────────────────────

// Descriptor field helpers — extracted so each null-fallback
// path is testable via synthetic conduits/snapshots/functions.
export function metaToVec(arr) {
  return arr ? [...arr] : [];
}

export function bindingName(explicitName, binding) {
  if (explicitName != null) return explicitName;
  if (binding && binding.name != null) return binding.name;
  return null;
}

export function capturedRange(fn) {
  if (fn.meta && fn.meta.captured != null) return fn.meta.captured;
  return null;
}

export function categoryKeyword(meta) {
  if (meta.category) return keyword(meta.category);
  return null;
}

// Extract message from an error value — runtime errors carry
// .originalError, user-created errors carry :message in descriptor.
export function errorMessageOf(errorValue) {
  if (errorValue.originalError) return errorValue.originalError.message;
  return errorValue.descriptor.get('message');
}

function buildBuiltinDescriptor(fn, explicitName) {
  const meta = fn.meta;
  const result = new Map();
  result.set('kind', keyword('builtin'));
  result.set('name', bindingName(explicitName, fn));
  result.set('category', categoryKeyword(meta));
  result.set('subject', meta.subject);
  result.set('modifiers', metaToVec(meta.modifiers));
  result.set('returns', meta.returns);
  result.set('captured', metaToVec(capturedRange(fn)));
  result.set('throws', metaToVec(meta.throws));
  result.set('effectful', fn.effectful);
  return result;
}

// Variant-B descriptor field constants for Map-based reads.

function buildConduitDescriptor(conduit, explicitName) {
  const result = new Map();
  result.set('kind', keyword('conduit'));
  result.set('name', explicitName ?? conduit.get('name'));
  result.set('params', metaToVec(conduit.get('params')));
  result.set('source', conduit.get('qlang/source'));
  result.set('effectful', conduit.get('effectful'));
  result.set('location', locationToQlangMap(conduit.get('location')));
  return result;
}

function buildSnapshotDescriptor(snap, explicitName) {
  // Value-level reify on a snapshot is unreachable via projection:
  // evalProjection auto-unwraps snapshots to the underlying value
  // before returning, so `env | /someAs | reify` calls buildValueDescriptor
  // on the unwrapped value, not buildSnapshotDescriptor on the wrapper.
  // Every reach into this builder flows through the named form
  // `reify(:name)` or through `manifest`, both of which always pass
  // explicitName. Reading the descriptor's :name field as a fallback
  // would be dead code.
  const value = snap.get('qlang/value');
  const result = new Map();
  result.set('kind', keyword('snapshot'));
  result.set('name', explicitName);
  result.set('value', value);
  result.set('type', typeKeyword(value));
  result.set('effectful', snap.get('effectful'));
  result.set('location', locationToQlangMap(snap.get('location')));
  return result;
}

function buildValueDescriptor(value, explicitName) {
  const result = new Map();
  result.set('kind', keyword('value'));
  if (explicitName != null) result.set('name', explicitName);
  result.set('value', value);
  result.set('type', typeKeyword(value));
  return result;
}

function describeBinding(value, explicitName) {
  // Variant-B built-ins: env stores a descriptor Map directly
  // (authored in lib/qlang/core.qlang, loaded by langRuntime).
  // Reify transforms the raw descriptor into a user-facing shape:
  // internal :qlang/kind and :qlang/impl are stripped; :kind :builtin
  // is stamped; :captured and :effectful are read from the resolved
  // function value sitting on :qlang/impl (placed there by the
  // bootstrap resolution pass in runtime/index.mjs).
  const qlKind = isQMap(value) && value.get('qlang/kind');
  if (qlKind && qlKind.name === 'builtin') {
    const reifyResult = new Map();
    reifyResult.set('kind', keyword('builtin'));
    if (explicitName != null) reifyResult.set('name', explicitName);
    for (const [descKey, descVal] of value) {
      if (descKey === 'qlang/kind' || descKey === 'qlang/impl') continue;
      reifyResult.set(descKey, descVal);
    }
    const implFn = value.get('qlang/impl');
    reifyResult.set('captured', [...implFn.meta.captured]);
    reifyResult.set('effectful', implFn.effectful);
    return reifyResult;
  }
  // Conduit-parameters (created at applyConduit time via makeFn)
  // are function values that can show up as env bindings while a
  // conduit body is evaluating. buildBuiltinDescriptor handles
  // them via the fn.meta path carried by conduit-parameter proxies
  // constructed at makeConduitParameter time, since their metadata
  // is inlined rather than living in core.qlang.
  if (isFunctionValue(value)) return buildBuiltinDescriptor(value, explicitName);
  if (isConduit(value)) return buildConduitDescriptor(value, explicitName);
  if (isSnapshot(value)) return buildSnapshotDescriptor(value, explicitName);
  return buildValueDescriptor(value, explicitName);
}

// reify — value-level (0 captured) or named-form (1 captured keyword).
export const reify = stateOpVariadic('reify', 2, async (state, reifyLambdas) => {
  if (reifyLambdas.length === 0) {
    const reifyDescriptor = describeBinding(state.pipeValue);
    return withPipeValue(state, reifyDescriptor);
  }
  if (reifyLambdas.length === 1) {
    const reifyKeyValue = await reifyLambdas[0](state.pipeValue);
    if (!isKeyword(reifyKeyValue)) {
      throw new ReifyKeyNotKeyword({ actualType: typeKeyword(reifyKeyValue), actualValue: reifyKeyValue });
    }
    if (!state.env.has(reifyKeyValue.name)) {
      throw new UnresolvedIdentifierError(reifyKeyValue.name);
    }
    const reifyBound = state.env.get(reifyKeyValue.name);
    const reifyDescriptor = describeBinding(reifyBound, reifyKeyValue.name);
    return withPipeValue(state, reifyDescriptor);
  }
  throw new ReifyArityOverflow({ actualArity: reifyLambdas.length });
}, [0, 1]);

const RunExamplesSubjectShapeError = declareShapeError('RunExamplesSubjectShapeError',
  ({ actualType }) => `runExamples requires a Keyword (binding name) or a descriptor Map carrying a :name string, got ${actualType.name}`);

// runQuoteEntry(quote) → result Map
//
// Each Quote segment in a binding's doc is an executable test case.
// Eval the Quote's source in an isolated env; truthy success → ok,
// error or falsy (false / null) → fail. Result Map shape:
//   {:snippet <Quote> :actual <value> :ok <bool> :error <string|null>}
async function runQuoteEntry(quote) {
  const result = new Map();
  result.set('snippet', quote);
  const actualValue = await evalQuery(quote.source);
  if (isErrorValue(actualValue)) {
    result.set('actual', null);
    result.set('error', errorMessageOf(actualValue));
    result.set('ok', false);
    return result;
  }
  result.set('actual', actualValue);
  result.set('error', null);
  result.set('ok', actualValue !== false && actualValue !== null);
  return result;
}

async function collectQuotesForBinding(env, bindingName) {
  const step = findBindingStepAcrossModules(env, bindingName);
  // Bindings without a source-located BindStep (host-installed
  // bindings via session.bind, runtime-seeded built-ins) simply
  // have no examples to run. runExamples returns an empty Vec —
  // the catalog walk in manifest-self-test treats them as zero-
  // contribution rather than a failure.
  if (step === null) return [];
  const docStrings = step.docs ?? [];
  const collected = [];
  for (const docStr of docStrings) {
    const segments = await parseDocSegments(docStr, env);
    for (const seg of segments) {
      if (isQuote(seg)) collected.push(seg);
    }
  }
  return collected;
}

export const runExamples = stateOp('runExamples', 1, async (state, _runExLambdas) => {
  const subject = state.pipeValue;
  let bindingName;
  if (isKeyword(subject)) {
    bindingName = subject.name;
  } else if (isQMap(subject) && typeof subject.get('name') === 'string') {
    bindingName = subject.get('name');
  } else {
    throw new RunExamplesSubjectShapeError({ actualType: typeKeyword(subject), actualValue: subject });
  }
  const quotes = await collectQuotesForBinding(state.env, bindingName);
  const results = await Promise.all(quotes.map(runQuoteEntry));
  return withPipeValue(state, results);
});

// manifest — Vec of descriptors, one per value-namespace binding
// in env, sorted by name. Reserved namespaces filtered:
//   `qlang/ast/<uri>` — module Quote storage for axis-operand traversal
//   `::<tag>`         — type-namespace bindings (type definitions)
// Both are runtime housekeeping or live in a parallel namespace,
// not the value-level operand catalog manifest is documenting.
export const manifest = stateOp('manifest', 1, (state, _lambdas) => {
  const entries = [];
  for (const [k, v] of state.env) {
    if (isModuleAstKey(k)) continue;
    if (isTypeBindingName(k)) continue;
    entries.push({ name: k, key: k, value: v });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const descriptors = entries.map(e => describeBinding(e.value, e.name));
  return withPipeValue(state, descriptors);
});

// ── let and as — binding operands ─────────────────────────────

const AsNameNotKeyword = declareShapeError('AsNameNotKeyword',
  ({ actualType }) => `as requires a keyword argument (the binding name), got ${actualType.name}`);

import { envSet } from '../state.mjs';

// as(:name) — snapshot the current pipeValue under a keyword name.
export const asOperand = stateOp('as', 2, async (state, asLambdas) => {
  const asNameValue = await asLambdas[0](state.pipeValue);
  if (!isKeyword(asNameValue)) {
    throw new AsNameNotKeyword({ actualType: typeKeyword(asNameValue), actualValue: asNameValue });
  }
  const asBindingName = asNameValue.name;
  const asSnapshot = makeSnapshot(state.pipeValue, {
    name: asBindingName,
    docs: asLambdas.docs,
    location: asLambdas.location
  });
  const asNextEnv = envSet(state.env, asBindingName, asSnapshot);
  return makeState(state.pipeValue, asNextEnv);
});

// ── parse / eval — the code-as-data ring closer ─────────────
//
// parse(source-string) → AST-Map      (the `read` primitive)
// eval(ast-map)        → pipeValue    (the `eval` primitive)
//
// Together they close the loop that motivated the whole Variant-B
// refactor: "qlang code" | parse | eval lifts a source string into
// an AST-Map (via walk.mjs::astNodeToMap) and then re-enters the
// evaluator against the current state (via walk.mjs::qlangMapToAst
// + evalAst). Structured trail entries, programmatic conduit body
// inspection, and hand-rolled AST construction all become user-
// level qlang operations from this point on.

const ParseSubjectNotStringOrQuote = declareSubjectError(
  'ParseSubjectNotStringOrQuote', 'parse', ['string', 'quote']);

const EvalSubjectNotMapOrQuote = declareSubjectError(
  'EvalSubjectNotMapOrQuote', 'eval', ['map', 'quote']);

// parse — reads a source string into the Variant-B AST-Map form.
// A Quote-value is accepted too: it is "code in string form", so
// `\`5 | mul(2)\` | parse` is the same as `"5 | mul(2)" | parse`
// minus the escape boilerplate. Malformed sources surface on the
// fail-track: the peggy ParseError is caught and converted to a
// qlang error value via errorFromParse, which stamps :kind
// :parse-error and the peggy source location onto the descriptor.
// The converted error becomes the new pipeValue directly — no
// throw into evalNode, because evalNode's fallback conversion
// treats ParseError as a foreign error (kind :foreign-error) which
// loses the parse-specific discriminator a user-facing operand
// should preserve.
export const parseOperand = stateOp('parse', 1, async (state, _parseLambdas) => {
  const parseSrc = state.pipeValue;
  let sourceText;
  if (typeof parseSrc === 'string') sourceText = parseSrc;
  else if (isQuote(parseSrc))       sourceText = parseSrc.source;
  else throw new ParseSubjectNotStringOrQuote(parseSrc);
  try {
    const parsedAst = parseSource(sourceText, { uri: 'parse-operand' });
    return withPipeValue(state, astNodeToMap(parsedAst));
  } catch (parseErr) {
    return withPipeValue(state, errorFromParse(parseErr));
  }
});

// AST extracted from a Quote-or-Map value, returned for `eval` /
// `apply` to dispatch through `evalAst`. Throws `EvalSubjectNotMapOrQuote`
// when the value is neither shape; raises the parse-error path
// (lifted to `::ParseError`) when a Quote source cannot be parsed.
function astFromQuoteLike(value) {
  if (isQMap(value)) return qlangMapToAst(value);
  if (isQuote(value)) {
    // A ParseError raised here rides out into `evalNode`'s try/catch,
    // which lifts it through `errorFromParse` to a `::ParseError!{…}`
    // ErrorValue — no local catch needed.
    return value.ast ?? parseSource(value.source, { uri: 'quote-source' });
  }
  throw new EvalSubjectNotMapOrQuote(value);
}

// eval — runs an AST against the current state. Subject is either
// an AST-Map (the `parse` output, or a hand-constructed Map via
// astNodeToMap-style data assembly) or a Quote (raw qlang source
// in string form — parsed on the fly). The current pipeValue
// becomes the initial pipeValue of the inner evaluation, and env
// is threaded in unchanged: writes the inner code does through
// BindStep / as land in state.env exactly as if the code had been
// inlined at the call site. The result is whatever pipeValue the
// inner code produces; env changes from inner BindStep / as / use
// calls propagate out, matching the semantics of a bare paren-group
// application.
export const evalOperand = stateOp('eval', 1, async (state, _evalLambdas) => {
  return await evalAst(astFromQuoteLike(state.pipeValue), state);
});

// apply(subject) — runs the Quote-or-Map in pipeValue against
// the captured-arg `subject` as the initial pipeValue. This
// is the classical Lisp / JS `apply` convention: the function (body)
// goes first, the argument second — `(apply fn args)` ≡
// `body | apply(subject)`. Trail-emitted Quotes flow through
// pipeValue naturally, so a `:trail` step is directly re-executable:
//
//   "x" | add(1) | mul(2) !| /trail | first | apply(5)   → 10
//
// The Quote's leading combinator (if any — `~{* mul(2)}` /
// `~{| count}` / `~{>> sort}` / `~{!| /trail}`) routes the first
// step through that combinator against the new subject, so a
// pipeline-suffix shape replays semantically.
export const applyOperand = stateOp('apply', 2, async (state, applyLambdas) => {
  const bodyAst = astFromQuoteLike(state.pipeValue);
  const newSubject = await applyLambdas[0](state.pipeValue);
  const innerState = makeState(newSubject, state.env);
  const resultState = await evalAst(bodyAst, innerState);
  // Propagate inner env changes (BindStep / as / use writes inside
  // the applied body) outward, matching `eval` semantics.
  return makeState(resultState.pipeValue, resultState.env);
});

// ── Variant-B primitive registry bindings ─────────────────────
// Bind each reflective operand impl into PRIMITIVE_REGISTRY under
// its :qlang/prim/ namespaced key at module-load time. Note that
// `asOperand` / `parseOperand` / `evalOperand` are the JS-level
// identifiers for the qlang operands `as` / `parse` / `eval` (the
// qlang names are JS reserved / common enough that the JS-side
// identifier disambiguates); the registry keys use the qlang names.
PRIMITIVE_REGISTRY.bind('qlang/prim/env',         env);
PRIMITIVE_REGISTRY.bind('qlang/prim/use',         use);
PRIMITIVE_REGISTRY.bind('qlang/prim/reify',       reify);
PRIMITIVE_REGISTRY.bind('qlang/prim/runExamples', runExamples);
PRIMITIVE_REGISTRY.bind('qlang/prim/manifest',    manifest);
PRIMITIVE_REGISTRY.bind('qlang/prim/as',          asOperand);
PRIMITIVE_REGISTRY.bind('qlang/prim/parse',       parseOperand);
PRIMITIVE_REGISTRY.bind('qlang/prim/eval',        evalOperand);
PRIMITIVE_REGISTRY.bind('qlang/prim/apply',       applyOperand);
