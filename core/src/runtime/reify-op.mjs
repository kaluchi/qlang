// `reify`, `manifest`, `runExamples` — reflective operands that
// surface descriptor Maps for any binding kind and run the inline
// `~{…}` Quote segments attached to a binding's doc-prefix.
//
// `reify` overloads by captured-arg count: value-level form reads
// the current `pipeValue` and produces its descriptor; named form
// `reify(:name)` looks up `:name` in env and stamps a descriptor
// for whatever binding lives there. `manifest` walks every
// value-namespace binding in env, returning a Vec of descriptors
// sorted by binding name. `runExamples` pulls every Quote segment
// from a binding's attached docs and evaluates each as a self-test.

import { stateOp, stateOpVariadic } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { withPipeValue } from '../state.mjs';
import {
  isQMap, isFunctionValue, isConduit, isSnapshot, isKeyword, isQuote,
  isTagKeyword, isErrorValue, typeKeyword, keyword,
  isModuleAstKey, isModuleNamespaceKey, isTagBindingName,
  tagBindingKey, RUNTIME_LOCATOR_KEY
} from '../types.mjs';
import { locationToQlangMap } from '../ast-codec.mjs';
import {
  declareShapeError,
  declareArityError
} from '../operand-errors.mjs';
import { UnresolvedIdentifierError } from '../errors.mjs';
import { evalQuery, reifyBuiltinDescriptor } from '../eval.mjs';
import { findBindingStepAcrossModules, stepDocStrings } from './axis.mjs';
import { parseDocSegments } from '../doc-segments.mjs';

const ReifyArityOverflowError = declareArityError('ReifyArityOverflowError',
  ({ actualArity }) => `reify accepts 0 or 1 captured args, got ${actualArity}`);
const ReifyKeyNotKeywordError = declareShapeError('ReifyKeyNotKeywordError',
  ({ actualType }) => `reify requires a Keyword or TagKeyword captured arg, got ${actualType.name}`);
const ManifestNamespaceNotKeywordError = declareShapeError('ManifestNamespaceNotKeywordError',
  ({ actualType }) => `manifest(:namespace) requires a keyword captured arg, got ${actualType.name}`);
const ManifestNamespaceUnknownError = declareShapeError('ManifestNamespaceUnknownError',
  ({ namespace }) => `manifest: unknown namespace :${namespace}, expected :value or :tag`);
const RunExamplesSubjectShapeError = declareShapeError('RunExamplesSubjectShapeError',
  ({ actualType }) => `runExamples requires a Keyword (binding name) or a descriptor Map carrying a :name string, got ${actualType.name}`);

// Extract a human-readable message from an error value — runtime
// errors carry `.originalError`, user-created errors carry
// `:message` in the descriptor.
function errorMessageOf(errorValue) {
  if (errorValue.originalError) return errorValue.originalError.message;
  return errorValue.descriptor.get('message');
}

// `buildBuiltinDescriptor` reifies a JS function-value into a
// descriptor Map — invoked only on conduit-parameter proxies that
// surface inside a conduit body's env. Every such proxy is minted by
// `makeConduitParameter` in `eval.mjs` with a full `meta` shape
// (`category`, `subject`, `modifiers`, `returns`, `captured`,
// `throws` all stamped at construction); the catalog-bound builtins
// flow through the `qlKind.name === 'builtin'` branch in
// `describeBinding` instead.
function buildBuiltinDescriptor(fn, explicitName) {
  const meta = fn.meta;
  const result = new Map();
  result.set('kind', keyword('builtin'));
  // Conduit-parameter proxies always reach reify through a named
  // lookup (`reify(:p)` inside a conduit body, or `manifest` over
  // the body's env — both pass `explicitName`); a bare-pipeValue
  // function value cannot surface here without first tripping
  // FunctionValueLeakedToPrintError on render, so the named path
  // is the only live entry. `fn.name` echoes `explicitName` in
  // every reachable case.
  result.set('name', explicitName);
  result.set('category', keyword(meta.category));
  result.set('subject', meta.subject);
  result.set('modifiers', [...meta.modifiers]);
  result.set('returns', meta.returns);
  result.set('captured', [...meta.captured]);
  result.set('throws', [...meta.throws]);
  result.set('effectful', fn.effectful);
  return result;
}

function buildConduitDescriptor(conduit, explicitName) {
  const result = new Map();
  result.set('kind', keyword('conduit'));
  result.set('name', explicitName ?? conduit.get('name'));
  result.set('params', [...conduit.get('params')]);
  result.set('source', conduit.get('qlang/source'));
  result.set('effectful', conduit.get('effectful'));
  result.set('location', locationToQlangMap(conduit.get('location')));
  return result;
}

function buildSnapshotDescriptor(snap, explicitName) {
  // Value-level reify on a snapshot is unreachable via projection:
  // `evalProjection` auto-unwraps snapshots to the underlying
  // value before returning, so `env | /someAs | reify` calls
  // `buildValueDescriptor` on the unwrapped value rather than
  // `buildSnapshotDescriptor` on the wrapper. Every reach into
  // this builder flows through the named form `reify(:name)` or
  // through `manifest`, both of which pass `explicitName`. Reading
  // the descriptor's `:name` field as a fallback would be dead
  // code.
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
  const qlKind = isQMap(value) && value.get('qlang/kind');
  if (qlKind && qlKind.name === 'builtin') {
    return reifyBuiltinDescriptor(value, value.get('qlang/impl'), explicitName);
  }
  // Tag bindings: env stores a Map with `:qlang/kind :tag` plus
  // optional `:qlang/impl` (Keyword handle into PRIMITIVE_REGISTRY
  // for JS-side constructors, Quote-value for qlang-side bodies),
  // declared via `::Tag {descriptor}` BindStep. Reify shape mirrors
  // the builtin path — strip `:qlang/kind`, stamp `:kind :tag`,
  // pass through every other field. `:qlang/impl` stays addressable
  // because authors composing tag registries (manifest(:tag),
  // catalog walks, error registry generation) consume the handle
  // directly.
  if (qlKind && qlKind.name === 'tag') {
    const tagResult = new Map();
    tagResult.set('kind', keyword('tag'));
    if (explicitName != null) tagResult.set('name', explicitName);
    for (const [descKey, descVal] of value) {
      if (descKey === 'qlang/kind') continue;
      tagResult.set(descKey, descVal);
    }
    return tagResult;
  }
  // Conduit-parameters — function values minted by
  // `makeConduitParameter` in `eval.mjs` that surface inside a
  // conduit body's env. `reify(:paramName)` from within the body
  // routes the proxy here; `buildBuiltinDescriptor` reads the
  // full meta the proxy carries inline (`category`, `subject`,
  // `modifiers`, `returns`, `captured`, `throws`).
  if (isFunctionValue(value)) return buildBuiltinDescriptor(value, explicitName);
  if (isConduit(value)) return buildConduitDescriptor(value, explicitName);
  if (isSnapshot(value)) return buildSnapshotDescriptor(value, explicitName);
  return buildValueDescriptor(value, explicitName);
}

export const reify = stateOpVariadic('reify', 2, async (state, reifyLambdas) => {
  if (reifyLambdas.length === 0) {
    // Subject-form. A Keyword or TagKeyword pipeValue probes env
    // for a matching binding (`:foo` → value-namespace; `::Foo` →
    // tag-namespace); on a hit the binding's descriptor surfaces
    // (mirroring `:name | source` / `| docs` / `| examples`). On a
    // miss — or any non-identifier pipeValue — `describeBinding`
    // falls through to `buildValueDescriptor`, so the literal
    // identity itself becomes the reified subject (`:kind :value`
    // plus `:type` from the value-class ladder). Identity-as-value
    // semantics: an unbound `:foo` or `::Foo` is still a valid
    // keyword / tag-keyword reify subject.
    if (isKeyword(state.pipeValue)) {
      const lookupName = state.pipeValue.name;
      if (state.env.has(lookupName)) {
        return withPipeValue(state, describeBinding(state.env.get(lookupName), lookupName));
      }
    }
    if (isTagKeyword(state.pipeValue)) {
      const lookupName = tagBindingKey(state.pipeValue.name);
      if (state.env.has(lookupName)) {
        return withPipeValue(state, describeBinding(state.env.get(lookupName), lookupName));
      }
    }
    return withPipeValue(state, describeBinding(state.pipeValue));
  }
  if (reifyLambdas.length === 1) {
    const reifyKeyValue = await reifyLambdas[0](state.pipeValue);
    // Captured arg can be a value-namespace Keyword (`reify(:count)`)
    // or a tag-namespace TagKeyword (`reify(::ParseError)`); the
    // lookup name keeps the leading `::` for the tag-namespace
    // branch so the env probe and descriptor `:name` field carry the
    // same identifier shape `manifest(:tag)` emits.
    let lookupName;
    if (isKeyword(reifyKeyValue))         lookupName = reifyKeyValue.name;
    else if (isTagKeyword(reifyKeyValue)) lookupName = tagBindingKey(reifyKeyValue.name);
    else throw new ReifyKeyNotKeywordError({ actualType: typeKeyword(reifyKeyValue), actualValue: reifyKeyValue });
    if (!state.env.has(lookupName)) {
      throw new UnresolvedIdentifierError(lookupName);
    }
    const reifyBound = state.env.get(lookupName);
    return withPipeValue(state, describeBinding(reifyBound, lookupName));
  }
  throw new ReifyArityOverflowError({ actualArity: reifyLambdas.length });
}, [0, 1]);

// `manifest` — Vec of descriptors, one per binding in env, sorted by
// name. Overloaded by captured-arg count:
//
//   manifest          — value-namespace bindings (operands, conduits,
//                       snapshots). Tag-namespace `::tag` and module
//                       AST storage filtered out.
//   manifest(:value)  — explicit alias of the bare form.
//   manifest(:tag)    — tag-namespace bindings (`::Tag` declarations
//                       from the operand catalog family files and any in-query
//                       `::Tag {…}` BindSteps). Names render with the
//                       `::Tag` prefix so the descriptors round-trip
//                       through reify lookup.
//
// Module Quote storage under the `qlang/ast/<uri>` env-key family is
// always filtered — those entries are runtime housekeeping outside
// either namespace's user-facing catalog.
export const manifest = stateOpVariadic('manifest', 2, async (state, manifestLambdas) => {
  let namespace = 'value';
  if (manifestLambdas.length === 1) {
    const arg = await manifestLambdas[0](state.pipeValue);
    if (!isKeyword(arg)) {
      throw new ManifestNamespaceNotKeywordError({
        actualType: typeKeyword(arg),
        actualValue: arg
      });
    }
    if (arg.name === 'tag' || arg.name === 'value') {
      namespace = arg.name;
    } else {
      throw new ManifestNamespaceUnknownError({ namespace: arg.name });
    }
  }
  const entries = [];
  for (const [k, v] of state.env) {
    if (isModuleAstKey(k)) continue;
    if (isModuleNamespaceKey(k)) continue;
    if (k === RUNTIME_LOCATOR_KEY) continue;
    const isTag = isTagBindingName(k);
    if (namespace === 'tag' && !isTag) continue;
    if (namespace === 'value' && isTag) continue;
    entries.push({ name: k, value: v });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const descriptors = entries.map(e => describeBinding(e.value, e.name));
  return withPipeValue(state, descriptors);
}, [0, 1]);

// `runExamples` — execute every Quote segment in a binding's
// attached doc-prefix as a self-test expression.
//
// Each Quote is evaluated against an empty initial state; a result
// that is not `false`, `null`, or an ErrorValue counts as
// `:ok true`. The return is a Vec of result Maps, one per Quote
// segment.

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

async function collectQuotesForBinding(env, lookupName) {
  const step = findBindingStepAcrossModules(env, lookupName);
  // Bindings without a source-located BindStep (host-installed
  // bindings via `session.bind`, runtime-seeded built-ins) have no
  // examples to run. `runExamples` returns an empty Vec — the
  // catalog walk in manifest-self-test counts them as
  // zero-contribution entries.
  if (step === null) return [];
  const docStrings = stepDocStrings(step);
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
  let lookupName;
  if (isKeyword(subject)) {
    lookupName = subject.name;
  } else if (isQMap(subject) && typeof subject.get('name') === 'string') {
    lookupName = subject.get('name');
  } else {
    throw new RunExamplesSubjectShapeError({ actualType: typeKeyword(subject), actualValue: subject });
  }
  const quotes = await collectQuotesForBinding(state.env, lookupName);
  const results = await Promise.all(quotes.map(runQuoteEntry));
  return withPipeValue(state, results);
});

bindPrim('reify',       reify);
bindPrim('manifest',    manifest);
bindPrim('runExamples', runExamples);
