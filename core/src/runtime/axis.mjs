// Axis-operands — reflective navigation to a binding's declaration
// [D61]: a keyword `:foo` reads the binding its scope holds under the
// name, a tag name `::Foo` the tag's, a tag name that no tag binds the
// verb it addresses from the root, `::vec/count` [D62], and every other
// value the declaration of its kind, the kind `type` answers. Each
// operand walks the `qlang/ast/<uri>` quotes in env for the step that
// declares the binding, a BindStep or an `as :name` call, and answers a
// field of it:
//
// `source`   the quote of the step.
// `docs`     a Vec of Doc-values, one per doc-prefix of the step.
// `examples` every quote among the segments of those docs, the cases
//            `runExamples` runs.
// `spec`     the descriptor the binding holds in env.

import { stateOp } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { withPipeValue, envGet, envHas } from '../state.mjs';
import {
  isKeyword, isQuote, isTagKeyword, isSnapshot, makeDoc, typeKeyword, declarationSiteOf,
  stampTagHeader, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { quoteOfBody, astOfQuote } from '../quote.mjs';
import {
  isModuleAstKey, isTagBindingName, tagBindingKey, stripTagBindingPrefix, moduleAstKey,
  canonicalTagName
} from '../env-keys.mjs';
import { addressedVerb, addressesOf, isNoun, isProviderBinding, refusalsOfNoun, verbsOfKind } from './nouns.mjs';
import { declareShapeError } from '../errors.mjs';
import { parseDocSegments } from '../doc-segments.mjs';

// `bindingName` (a value-namespace identifier or a `::`-prefixed
// tag-binding reference) is an identifier-shaped string at the JS
// level; the JS→qlang lift in `error-convert.mjs::liftIdentifier`
// converts it to a Keyword / TagKeyword at descriptor build time,
// so the printed message body reads the same regardless of shape.
// The factory's template stringifies via `${value}` which produces
// the raw `name` half — the lifted-keyword printValue surface kicks
// in only when projection consumers (`!| /bindingName`) read the
// descriptor.
//
// One class per axis: the axis is the site, so `!| type` alone says
// which lookup failed.
export const SourceBindingNotFoundError = declareShapeError('SourceBindingNotFoundError',
  ({ bindingName }) =>
    `source: no binding-step found for '${bindingName}' across loaded modules`,
  { operand: 'source' });
export const DocsBindingNotFoundError = declareShapeError('DocsBindingNotFoundError',
  ({ bindingName }) =>
    `docs: no binding-step found for '${bindingName}' across loaded modules`,
  { operand: 'docs' });
export const ExamplesBindingNotFoundError = declareShapeError('ExamplesBindingNotFoundError',
  ({ bindingName }) =>
    `examples: no binding-step found for '${bindingName}' across loaded modules`,
  { operand: 'examples' });
export const SpecBindingNotFoundError = declareShapeError('SpecBindingNotFoundError',
  ({ bindingName }) =>
    `spec: no binding-step found for '${bindingName}' across loaded modules`,
  { operand: 'spec' });

// The walk by name serves the catalog's descriptors, which carry no
// site and are all BindSteps: one matches when its key names the
// binding, a keyword in the value namespace, a tag name in the tag
// namespace.
function matchesBindingStep(step, isTagBinding, targetName) {
  if (step.type === 'BindStep') {
    const key = step.key;
    return isTagBinding
      ? key.type === 'BareTypeKeyword' && canonicalTagName(key.tag) === targetName
      : key.type === 'Keyword'         && key.name === targetName;
  }
  return false;
}

// Walk the module AST front to back, return the LAST matching binding
// step. The last-match rule mirrors qlang's shadowing semantics: a
// later `:foo body` BindStep shadows the earlier binding, so
// axis-operand lookups surface the docs / source / examples of the
// shadowing-resolved binding at that point in the module.
// A module of one declaration parses as that step itself, with no
// Pipeline wrapper, and the head step of a Pipeline rides without
// the combinator wrapper its followers carry. Both readings below
// walk one sequence rather than each re-deciding the shape.
function topLevelSteps(moduleAst) {
  if (moduleAst.type !== 'Pipeline') return [moduleAst];
  return moduleAst.steps.map((stepWrapper, index) =>
    (index === 0 ? stepWrapper : stepWrapper.step));
}

function findBindingStepFor(moduleAst, bindingName) {
  const isTagBinding = isTagBindingName(bindingName);
  const targetName = isTagBinding ? stripTagBindingPrefix(bindingName) : bindingName;
  let lastMatch = null;
  for (const step of topLevelSteps(moduleAst)) {
    if (matchesBindingStep(step, isTagBinding, targetName)) lastMatch = step;
  }
  return lastMatch;
}

// Iterate every module Quote stored in env under `qlang/ast/<uri>`.
// langRuntime and `use :ns` put the quote of the module's parsed tree at
// every such key, so the tree comes back without a second parse.
function* moduleAstsIn(env) {
  for (const [k, v] of env) {
    if (isModuleAstKey(k) && isQuote(v)) yield astOfQuote(v);
  }
}

// A binding minted through `makeConduit` / `makeSnapshot` carries
// the declaring node's own `location` object on its
// DECLARATION_SITE_SLOT, so the step that wrote the env entry is
// identifiable by reference. That is the authority: `spec` reads
// env, and reading env here too makes the four axes name one
// declaration whichever order the shadowing happened in — a cell
// BindStep over a `use`-loaded namespace, or a `use` over a cell
// BindStep.
// `makeSnapshot` records the BindStep's own location and
// `makeConduit` its body's, so a step declares the site when either
// node carries it.
function declaresSite(step, declarationSite) {
  return step.location === declarationSite || step.body?.location === declarationSite;
}

function findStepAtDeclarationSite(moduleAst, declarationSite) {
  for (const step of topLevelSteps(moduleAst)) {
    if (declaresSite(step, declarationSite)) return step;
  }
  return null;
}

// A catalog descriptor reaches env through the bootstrap's
// snapshot-unwrap and carries no site, so the name walk answers for
// it: env is insertion-ordered and the catalog loads ahead of every
// cell, so the last match there is the shadowing declaration.
export function findBindingStepAcrossModules(env, bindingName) {
  const declarationSite = declarationSiteOf(env.get(bindingName));
  let lastMatch = null;
  for (const moduleAst of moduleAstsIn(env)) {
    if (declarationSite !== undefined) {
      const sited = findStepAtDeclarationSite(moduleAst, declarationSite);
      if (sited !== null) return sited;
      continue;
    }
    const step = findBindingStepFor(moduleAst, bindingName);
    if (step !== null) lastMatch = step;
  }
  return lastMatch;
}

// A BindStep carries its doc-prefixes as `.docs`, null when it has
// none, and an `as :name` call carries the field only when it has
// some; every reader of them, `docs`, `examples` and `runExamples`,
// goes through here.
function stepDocStrings(step) {
  return step.docs ?? [];
}

// The binding a subject names: a keyword names a binding, a tag name
// a tag's, and every other value names the declaration of its kind,
// the kind `type` answers [D61].
function bindingNameOf(subject) {
  if (isKeyword(subject)) return subject.name;
  if (isTagKeyword(subject)) return tagBindingKey(subject.name);
  return tagBindingKey(typeKeyword(subject).name);
}

// A tag name that no tag binds addresses a verb from the root of the
// tree of names through the noun it lives on, `::vec/count` [D62], and
// reads what the verb's provider declared, whatever the scope binds
// under its name.
function addressOf(env, subject) {
  if (!isTagKeyword(subject) || envHas(env, tagBindingKey(subject.name))) return null;
  return addressedVerb(env, subject.name);
}

// A keyword names a binding of the scope where it stands, so under the
// name of a verb a provider exports it names nothing, and the verb is
// read through the noun it lives on [D62].
function namesNoScopeBinding(env, subject) {
  return isKeyword(subject) && isProviderBinding(env, subject.name);
}

// The name a subject reads, a keyword's, a tag's or its kind's.
function nameOf(subject) {
  if (isKeyword(subject) || isTagKeyword(subject)) return subject.name;
  return typeKeyword(subject).name;
}

// What a refusal of an axis holds: the name it read and the addresses
// where the verbs of that name live [D62].
export function refusalOf(env, subject) {
  return { bindingName: bindingNameOf(subject), addresses: addressesOf(env, nameOf(subject)) };
}

// The step that declares what a subject names, the one step every axis
// and `runExamples` read.
export function declaringStepOf(env, subject) {
  if (namesNoScopeBinding(env, subject)) return null;
  const address = addressOf(env, subject);
  if (address === null) return findBindingStepAcrossModules(env, bindingNameOf(subject));
  return findBindingStepFor(astOfQuote(envGet(env, moduleAstKey(address.uri))), address.verbName);
}

export const source = stateOp('source', 1, (state, _lambdas) => {
  const step = declaringStepOf(state.env, state.pipeValue);
  if (step === null) {
    throw new SourceBindingNotFoundError(refusalOf(state.env, state.pipeValue));
  }
  return withPipeValue(state, quoteOfBody(step));
});

export const docs = stateOp('docs', 1, (state, _lambdas) => {
  const step = declaringStepOf(state.env, state.pipeValue);
  if (step === null) {
    throw new DocsBindingNotFoundError(refusalOf(state.env, state.pipeValue));
  }
  const docStrings = stepDocStrings(step);
  return withPipeValue(state, Object.freeze(docStrings.map(s => makeDoc(s))));
});

// Every quote among the segments of a step's docs, what `examples`
// answers and `runExamples` runs.
export async function examplesOfStep(state, step) {
  const collected = [];
  for (const docStr of stepDocStrings(step)) {
    const segments = await parseDocSegments(docStr, state);
    for (const seg of segments) {
      if (isQuote(seg)) collected.push(seg);
    }
  }
  return collected;
}

export const examples = stateOp('examples', 1, async (state, _lambdas) => {
  const step = declaringStepOf(state.env, state.pipeValue);
  if (step === null) {
    throw new ExamplesBindingNotFoundError(refusalOf(state.env, state.pipeValue));
  }
  return withPipeValue(state, Object.freeze(await examplesOfStep(state, step)));
});

// `spec` — env-side declaration descriptor Map for the named binding.
// Where `source` returns a Quote of the BindStep's verbatim text and
// `docs` returns a Vec of attached doc-prefix Doc-values, `spec`
// returns the structured Map that lives under the binding's env-key
// after `langRuntime`'s snapshot-unwrap + impl-resolution pass. An
// operand and a value-class constructor fill that Map from the
// catalog `::builtin{…}` body they declare; an error tag fills it
// from the throw-site spec the bootstrap stamps, since what raises
// the error is what knows the category and the slot.
//
// The discriminator path for per-tag static facts attached to any
// tagged value-class: `result !| type | spec | /category`
// reads `:typeError` / `:arityError` / etc. off the error tag;
// `::number/add | spec | /throws` lists the per-site error classes
// `add` raises; `::conduit | spec | /impl` returns the
// `:qlang/type/conduit` constructor handle.
export const spec = stateOp('spec', 1, (state, _lambdas) => {
  const address = addressOf(state.env, state.pipeValue);
  if (address !== null) return withPipeValue(state, address.descriptor);
  const bindingName = bindingNameOf(state.pipeValue);
  if (!envHas(state.env, bindingName) || namesNoScopeBinding(state.env, state.pipeValue)) {
    throw new SpecBindingNotFoundError(refusalOf(state.env, state.pipeValue));
  }
  let entry = envGet(state.env, bindingName);
  if (isSnapshot(entry)) entry = entry.get('payload');
  return withPipeValue(state, withVerbsOfNoun(state.env, bindingName, entry));
});

// The declaration of a provider's noun lists the verbs that live on it
// [D61], computed from the subjects its providers' operands declare,
// and the refusals a query provokes on it, its own and its verbs' [D64].
function withVerbsOfNoun(env, bindingName, declaration) {
  if (!isTagBindingName(bindingName) || !isNoun(env, stripTagBindingPrefix(bindingName))) return declaration;
  const nounName = stripTagBindingPrefix(bindingName);
  const withVerbs = new Map(declaration);
  withVerbs.set('verbs', verbsOfKind(env, nounName));
  withVerbs.set('throws', refusalsOfNoun(env, nounName, declaration.get('throws') ?? []));
  stampTagHeader(withVerbs, declaration[TAG_HEADER_SYMBOL]);
  return withVerbs;
}

bindPrim('source',   source);
bindPrim('docs',     docs);
bindPrim('examples', examples);
bindPrim('spec',     spec);
