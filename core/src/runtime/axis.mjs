// Axis-operands — reflective navigation to a binding's declaration
// [D61], the record the declaration wrote into its scope [D63]: a
// keyword `:foo` reads the record its scope holds under the name, a tag
// name `::Foo` the tag's, a tag name that no tag binds the record of
// the verb it addresses from the root, `::vec/count` [D62], a record
// the binding it records, and every other value the record of its
// kind, the kind `type` answers. Each operand projects a field of the
// record:
//
// `source`   the quote of the declaring step, null for a binding no
//            step declared, a value `use` or a host bound.
// `docs`     a Vec of Doc-values, one per doc-prefix of the step.
// `examples` every quote among the segments of those docs, the cases
//            `runExamples` runs.
// `spec`     the value the binding holds, a verb's signature for a verb.

import { stateOp } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { withPipeValue, envHas } from '../state.mjs';
import {
  isKeyword, isQuote, isTagKeyword, isBinding, isVerb, typeKeyword, stampTagHeader, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { signatureSpecOf } from './verb.mjs';
import { tagBindingKey } from '../env-keys.mjs';
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
    `source: no binding found for '${bindingName}'`,
  { operand: 'source' });
export const DocsBindingNotFoundError = declareShapeError('DocsBindingNotFoundError',
  ({ bindingName }) =>
    `docs: no binding found for '${bindingName}'`,
  { operand: 'docs' });
export const ExamplesBindingNotFoundError = declareShapeError('ExamplesBindingNotFoundError',
  ({ bindingName }) =>
    `examples: no binding found for '${bindingName}'`,
  { operand: 'examples' });
export const SpecBindingNotFoundError = declareShapeError('SpecBindingNotFoundError',
  ({ bindingName }) =>
    `spec: no binding found for '${bindingName}'`,
  { operand: 'spec' });

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

// The record a subject names, the one record every axis and
// `runExamples` read, or null when it names none: a value a host bound
// under a name is no record.
export function declaringRecordOf(env, subject) {
  if (isBinding(subject)) return subject;
  if (namesNoScopeBinding(env, subject)) return null;
  const address = addressOf(env, subject);
  if (address !== null) return address.record;
  const entry = env.get(bindingNameOf(subject));
  return isBinding(entry) ? entry : null;
}

// Every quote among the segments of a record's docs, what `examples`
// answers and `runExamples` runs.
export async function examplesOfRecord(state, record) {
  const collected = [];
  for (const doc of record.get('docs')) {
    const segments = await parseDocSegments(doc.content, state);
    for (const seg of segments) {
      if (isQuote(seg)) collected.push(seg);
    }
  }
  return collected;
}

export const source = stateOp('source', 1, (state, _lambdas) => {
  const record = declaringRecordOf(state.env, state.pipeValue);
  if (record === null) {
    throw new SourceBindingNotFoundError(refusalOf(state.env, state.pipeValue));
  }
  return withPipeValue(state, record.get('source'));
});

export const docs = stateOp('docs', 1, (state, _lambdas) => {
  const record = declaringRecordOf(state.env, state.pipeValue);
  if (record === null) {
    throw new DocsBindingNotFoundError(refusalOf(state.env, state.pipeValue));
  }
  return withPipeValue(state, record.get('docs'));
});

export const examples = stateOp('examples', 1, async (state, _lambdas) => {
  const record = declaringRecordOf(state.env, state.pipeValue);
  if (record === null) {
    throw new ExamplesBindingNotFoundError(refusalOf(state.env, state.pipeValue));
  }
  return withPipeValue(state, Object.freeze(await examplesOfRecord(state, record)));
});

// `spec` — the value the record holds: the structured Map that a
// catalog `::builtin{…}` body declared, after `langRuntime`'s
// impl-resolution pass, for an operand and a value-class constructor;
// the throw-site spec the bootstrap stamps for an error tag, since
// what raises the error is what knows the category and the slot; the
// signature of a verb as a `::spec~(…)` [D67]; and the value itself
// for any other binding.
//
// The discriminator path for per-tag static facts attached to any
// tagged value-class: `result !| type | spec | /category`
// reads `:typeError` / `:arityError` / etc. off the error tag;
// `::number/add | spec | /throws` lists the per-site error classes
// `add` raises; `::verb | spec | /impl` returns the
// `:qlang/type/verb` constructor handle.
export const spec = stateOp('spec', 1, (state, _lambdas) => {
  const record = declaringRecordOf(state.env, state.pipeValue);
  if (record === null) {
    throw new SpecBindingNotFoundError(refusalOf(state.env, state.pipeValue));
  }
  const declaration = record.get('value');
  if (isVerb(declaration)) return withPipeValue(state, signatureSpecOf(declaration));
  return withPipeValue(state, withVerbsOfNoun(state.env, record));
});

// The declaration of a provider's noun lists the verbs that live on it
// [D61], computed from the subjects its providers' operands declare,
// and the refusals a query provokes on it, its own and its verbs' [D64].
function withVerbsOfNoun(env, record) {
  const declaration = record.get('value');
  const recordName = record.get('name');
  if (!isTagKeyword(recordName) || !isNoun(env, recordName.name)) return declaration;
  const withVerbs = new Map(declaration);
  withVerbs.set('verbs', verbsOfKind(env, recordName.name));
  withVerbs.set('throws', refusalsOfNoun(env, recordName.name, declaration.get('throws') ?? []));
  stampTagHeader(withVerbs, declaration[TAG_HEADER_SYMBOL]);
  return withVerbs;
}

bindPrim('source',   source);
bindPrim('docs',     docs);
bindPrim('examples', examples);
bindPrim('spec',     spec);
