// `manifest`, `runExamples` — reflective operands over env.
//
// `manifest` walks every binding in env, returning a Vec of
// descriptor Maps sorted by name. `runExamples` pulls every Quote
// segment from a named binding's attached doc-prefix and evaluates
// each as a self-test, yielding `{:snippet :actual :ok :error}`
// per Quote. Together they drive catalog-wide self-tests
// (`manifest * runExamples * every(/ok)`) and the LSP / doc-site
// surfaces that enumerate operands.
//
// The per-binding descriptor shape `manifest` produces is built by
// `describeBinding`, a switch over the env-value's runtime shape
// (`::builtin` Map, conduit Map, snapshot Map, raw function value
// for conduit-parameter proxies, or plain pipeValue). The same
// `buildBuiltinDescriptor` / `buildConduitDescriptor` /
// `buildSnapshotDescriptor` / `buildValueDescriptor` helpers
// stamp the user-facing fields per kind.
//
// The introspection surface for "what does THIS one binding do"
// is the axis trio in `axis.mjs` (`:name | source` / `| docs` /
// `| examples`) — reads source AST directly, never touches the
// runtime descriptor. Reach for `manifest` when the question is
// "which bindings exist" rather than "what does this one do".

import { stateOp, stateOpVariadic } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { withPipeValue } from '../state.mjs';
import {
  isQMap, isFunctionValue, isConduit, isSnapshot, isKeyword, isQuote,
  isErrorValue, typeKeyword, keyword
} from '../types.mjs';
import {
  isModuleAstKey, isModuleNamespaceKey, isTagBindingName,
  RUNTIME_LOCATOR_KEY
} from '../env-keys.mjs';
import { locationToQlangMap } from '../ast-codec.mjs';
import {
  declareShapeError
} from '../operand-errors.mjs';
import { evalQuery } from '../eval.mjs';
import { manifestBuiltinDescriptor } from '../descriptor-ops.mjs';
import { findBindingStepAcrossModules, stepDocStrings } from './axis.mjs';
import { parseDocSegments } from '../doc-segments.mjs';

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

// `buildBuiltinDescriptor` lifts a JS function-value into a
// descriptor Map — invoked only on conduit-parameter proxies that
// surface inside a conduit body's env. Every such proxy is minted
// by `makeConduitParameter` in `eval.mjs` with a full `meta` shape
// (`category`, `subject`, `modifiers`, `returns`, `captured`,
// `throws` all stamped at construction); the catalog-bound builtins
// flow through the `qlKind.name === 'builtin'` branch in
// `describeBinding` instead.
function buildBuiltinDescriptor(fn, explicitName) {
  const meta = fn.meta;
  const result = new Map();
  result.set('kind', keyword('builtin'));
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
  // `explicitName` is always the env key (manifest iterates env entries
  // and threads each key as the name); the conduit's own `:name`
  // payload mirrors it under normal BindStep declarations but the
  // env-key is the source of truth for the descriptor.
  const result = new Map();
  result.set('kind', keyword('conduit'));
  result.set('name', explicitName);
  result.set('params', [...conduit.get('params')]);
  result.set('source', conduit.get('source'));
  result.set('effectful', conduit.get('effectful'));
  result.set('location', locationToQlangMap(conduit.get('location')));
  return result;
}

function buildSnapshotDescriptor(snap, explicitName) {
  const value = snap.get('payload');
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
  result.set('name', explicitName);
  result.set('value', value);
  result.set('type', typeKeyword(value));
  return result;
}

function describeBinding(value, explicitName) {
  const qlKind = isQMap(value) && value.get('kind');
  if (qlKind && qlKind.name === 'builtin') {
    // `::builtin{:impl …}` carries either an operand declaration
    // (env-key is a plain identifier, `:impl` is a resolved JS
    // function value after the bootstrap pass) or a tag-binding
    // declaration (env-key carries the `::` prefix, `:impl` stays
    // a keyword pointing into PRIMITIVE_REGISTRY, or is absent for
    // doc-only declarations). Distinguish by env-key shape.
    const isTagBindingEntry = typeof explicitName === 'string'
                              && explicitName.startsWith('::');
    if (isTagBindingEntry) {
      const tagResult = new Map();
      tagResult.set('kind', keyword('tag'));
      tagResult.set('name', explicitName);
      for (const [descKey, descVal] of value) {
        if (descKey === 'kind') continue;
        tagResult.set(descKey, descVal);
      }
      return tagResult;
    }
    return manifestBuiltinDescriptor(value, value.get('impl'), explicitName);
  }
  // Conduit-parameters — function values minted by
  // `makeConduitParameter` in `eval.mjs` that surface inside a
  // conduit body's env. `manifest` over the body's env routes the
  // proxy here; `buildBuiltinDescriptor` reads the full meta the
  // proxy carries inline (`category`, `subject`, `modifiers`,
  // `returns`, `captured`, `throws`).
  if (isFunctionValue(value)) return buildBuiltinDescriptor(value, explicitName);
  if (isConduit(value)) return buildConduitDescriptor(value, explicitName);
  if (isSnapshot(value)) return buildSnapshotDescriptor(value, explicitName);
  return buildValueDescriptor(value, explicitName);
}

// `manifest` — Vec of descriptors, one per binding in env, sorted by
// name. Overloaded by captured-arg count:
//
//   manifest          — value-namespace bindings (operands, conduits,
//                       snapshots). Tag-namespace `::tag` and module
//                       AST storage filtered out.
//   manifest(:value)  — explicit alias of the bare form.
//   manifest(:tag)    — tag-namespace bindings (`::Tag` declarations
//                       from the operand catalog family files and any
//                       in-query `::Tag {…}` BindSteps). Names render
//                       with the `::Tag` prefix.
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

bindPrim('manifest',    manifest);
bindPrim('runExamples', runExamples);
