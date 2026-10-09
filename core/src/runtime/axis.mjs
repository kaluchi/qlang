// The axes, each a passage from a name to its declaration
// [D61], the record the declaration wrote into its scope [D63]: a
// keyword `:foo` reads the record its scope holds under the name, a tag
// name the node of the tree it addresses, `::vec/count` or
// `::qlang/values` [D153], a record the binding it records, and every
// other value the node of its kind, the kind `type` answers. Each axis
// projects a field of the record:
//
// `source`   the quote of the declaring step, null for a binding no
//            step declared, a value a host bound.
// `doc`      the page of the step's slot, its docs as one, null for
//            a slot without one [D119].
// `binding`  the record itself, `::binding` with its name, docs, value,
//            source and module [D5].
//
// Given a name, each axis reads the member the subject holds under it
// [D88]: for a tag name the name under its address, a part of the object
// of a word among them, `::vec/take | doc :count`, and for any other
// subject the word the name calls after it, `::map | doc :minus` the
// page of `::map/minus`.

import { bindStateReader } from '../primitives.mjs';
import { envGet } from '../state.mjs';
import {
  isKeyword, isQuote, isTagKeyword, isBinding, isNull, isQSet, isVec, typeKeyword, makeTaggedInstance,
  makeTagKeyword, makeDoc, isQMap, isValueClass, TAG_HEADER_SYMBOL, NULL, ERROR_TAG
} from '../types.mjs';
import { tagLiteralOf } from '../env-keys.mjs';
import {
  addressesOf, isNoun, nodeOf, residenceOnSubject
} from './nouns.mjs';
import { declareShapeError } from '../errors.mjs';
import { raisedFrom } from './raise.mjs';
import { nearestNames, nearestTagNames } from '../nearest-names.mjs';

// `bindingName` is a name or a tag name, held among the facts as a
// keyword or a tag.
//
// One class per axis: the axis is the site, so `!| type` alone says
// which lookup failed.
export const AnySourceBindingNotFoundError = declareShapeError('any/SourceBindingNotFoundError',
  ({ bindingName }) =>
    `source: no binding found for '${bindingName}'`,
  { operand: 'source' });
export const AnyDocBindingNotFoundError = declareShapeError('any/DocBindingNotFoundError',
  ({ bindingName }) =>
    `doc: no binding found for '${bindingName}'`,
  { operand: 'doc' });
const AnyBindingNotFoundError = declareShapeError('any/BindingNotFoundError',
  ({ bindingName }) =>
    `binding: no binding found for '${bindingName}'`,
  { operand: 'binding' });
const AnyDocAnchorNotKeywordError = declareShapeError('any/DocAnchorNotKeywordError',
  ({ index, actualType }) => `doc: anchor ${index} of a path must be a keyword, got ${actualType.name}`,
  { operand: 'doc', expectedType: 'keyword' });
export const AnyExplainBindingNotFoundError = declareShapeError('any/ExplainBindingNotFoundError',
  ({ bindingName }) =>
    `explain: no binding found for '${bindingName}'`,
  { operand: 'explain' });

// The name a refusal says a subject read: a keyword's, a tag name's, and
// for every other value the tag of its kind, the kind `type` answers [D61].
function bindingNameOf(subject) {
  if (isKeyword(subject)) return subject.name;
  if (isTagKeyword(subject)) return tagLiteralOf(subject.name);
  return tagLiteralOf(typeKeyword(subject).name);
}

// The name whose verbs a refusal lists: a keyword's, the last name of a
// tag name's path, `::any/links` naming `links` [D127], or its kind's.
function nameOf(subject) {
  if (isKeyword(subject)) return subject.name;
  if (isTagKeyword(subject)) return subject.name.slice(subject.name.lastIndexOf('/') + 1);
  return typeKeyword(subject).name;
}

// What a refusal of an axis holds: the name it read and the addresses
// where the pages of that name live [D62], [D137].
export function refusalOf(env, subject) {
  return { bindingName: bindingNameOf(subject), addresses: addressesOf(env, nameOf(subject)), nearest: nearestOfSubject(env, subject) };
}

// The names near the one a subject reads, tags for a tag name and the
// names of the scope for a keyword [D118].
function nearestOfSubject(env, subject) {
  if (isTagKeyword(subject)) return nearestTagNames(env, subject.name);
  return isKeyword(subject) ? nearestNames(env, subject.name) : Object.freeze([]);
}

// The record a subject names, the one record every axis and
// `runLaws` read, or null when it names none: a value a host bound
// under a name is no record.
export function declaringRecordOf(env, subject) {
  if (isBinding(subject)) return subject;
  if (isKeyword(subject)) {
    const entry = envGet(env, subject.name);
    return isBinding(entry) ? entry : null;
  }
  const name = isTagKeyword(subject) ? subject.name : typeKeyword(subject).name;
  return nodeOf(env, name) ?? nodeOfRefused(env, name);
}

// The node a refusal named by the address of what refused reads its page
// from, that address, when no node of its own declares it [D166].
function nodeOfRefused(env, name) {
  const cut = name.lastIndexOf('/');
  return cut > 0 && name.endsWith('Error') ? nodeOf(env, name.slice(0, cut)) : null;
}

// The caption a run of prose gives the laws after it [D124]: the last
// sentence of its last paragraph when that sentence ends in a colon and
// no blank line stands between it and the law, its lines joined as one.
// A run of whitespace alone keeps the caption above it unless it holds a
// blank line.
const BLANK_LINE = /\n[ \t]*\n/;
function captionAfter(prose, captionAbove) {
  const paragraphs = prose.split(BLANK_LINE);
  const lastParagraph = paragraphs.at(-1).trim().replace(/\s+/g, ' ');
  if (lastParagraph === '') return paragraphs.length > 1 ? null : captionAbove;
  if (!lastParagraph.endsWith(':')) return null;
  return lastParagraph.slice(0, -1).split(/(?<=[.!?])\s+/).at(-1);
}

// Every claim of a record's page: each law, a quote with no tag among the
// segments of its docs, with the caption it proves, what `runLaws` runs
// [D123], [D124].
export function claimsOfRecord(record) {
  const claims = [];
  for (const doc of record.get('docs')) {
    let caption = null;
    for (const segment of doc) {
      if (typeof segment === 'string') caption = captionAfter(segment, caption);
      else if (isQuote(segment)) claims.push({ law: segment, says: caption ?? NULL });
    }
  }
  return claims;
}

// The record of the member the subject holds under a name [D88], or
// null: the name under the address a tag name writes, a part of the
// object of a word among them, and otherwise the word the subject's walk
// reaches under the name [D117].
function memberRecordOf(env, subject, memberName) {
  const under = isTagKeyword(subject) ? nodeOf(env, `${subject.name}/${memberName}`) : null;
  return under ?? residenceOnSubject(env, memberName, subject);
}

// What the refusal of a member holds: the address the name would have
// under a noun, or the name alone, and where the words of that name
// live.
function memberRefusalOf(env, subject, memberName) {
  const onNoun = isTagKeyword(subject) && isNoun(env, subject.name);
  return {
    bindingName: onNoun ? tagLiteralOf(`${subject.name}/${memberName}`) : memberName,
    addresses: addressesOf(env, memberName)
  };
}

// The record the subject names in the scope of the call, or the member
// it holds under a name, or the refusal of the axis that read it; each
// axis resides on `::any`, and its primitive reads the state of
// the call [D79].
export function recordReadBy(subject, memberName, state, NotFoundError) {
  if (!isNull(memberName)) {
    const member = memberRecordOf(state.env, subject, memberName.name);
    if (member === null) throw new NotFoundError(memberRefusalOf(state.env, subject, memberName.name));
    return member;
  }
  const record = declaringRecordOf(state.env, subject);
  if (record === null) throw new NotFoundError(refusalOf(state.env, subject));
  return record;
}

bindStateReader('any/binding', (subject, memberName, state) =>
  recordReadBy(subject, memberName, state, AnyBindingNotFoundError));
bindStateReader('any/source', (subject, memberName, state) =>
  recordReadBy(subject, memberName, state, AnySourceBindingNotFoundError).get('source'));
// The one page of a record: its docs joined, a line break between two,
// null for a declaration without one [D119].
function pageOfRecord(record) {
  const docs = record.get('docs');
  if (docs.length <= 1) return docs[0] ?? NULL;
  return makeDoc(docs.flatMap((doc, index) => index === 0 ? doc : ['\n', ...doc]));
}

// The anchors of a path: null the empty one, a keyword a path of one,
// a vector its elements, and any other value a path of one the walk
// refuses [D119].
const anchorsOf = anchor => (isNull(anchor) ? [] : isVec(anchor) ? anchor : [anchor]);

// The record a path of anchors reaches, each anchor the name of a member
// of the record the one before it reached, the empty path the record of
// the subject itself [D119].
function recordAlongPath(subject, anchors, state) {
  if (anchors.length === 0) return recordReadBy(subject, NULL, state, AnyDocBindingNotFoundError);
  return anchors.reduce((reached, anchor, index) => {
    if (!isKeyword(anchor)) throw new AnyDocAnchorNotKeywordError({ index, actualType: typeKeyword(anchor) });
    return recordReadBy(index === 0 ? reached : underRecord(reached), anchor, state, AnyDocBindingNotFoundError);
  }, subject);
}

// What the next anchor of a path reads under: the address of the record
// reached, so a name under a name is read by its address [D164].
const underRecord = record => makeTagKeyword(record.get('name').name);

// The page an anchor reads, the page of the member at the end of its path.
const pageAt = (subject, anchor, state) => pageOfRecord(recordAlongPath(subject, anchorsOf(anchor), state));

// A set of anchors reads a page at each, in the order of the set.
bindStateReader('any/doc', (subject, anchor, state) =>
  isQSet(anchor) ? Object.freeze(anchor.map(each => pageAt(subject, each, state))) : pageAt(subject, anchor, state));

// The value as an explanation holds it: an error, a map under `::error`
// beneath the tags stacked over it, raised under the tag it shows, as it
// arrived before `!|` opened it [D101]; any other value as it is.
function heldByExplanation(subject) {
  const passedTags = [];
  let beneath = subject;
  while (isValueClass(beneath, 'taggedInstance')) {
    passedTags.push(beneath.tag);
    beneath = beneath.payload;
  }
  return isQMap(beneath) && beneath[TAG_HEADER_SYMBOL]?.name === ERROR_TAG.name ? raisedFrom(beneath, passedTags) : subject;
}

// The explanation of a value [D100]: the page `doc` reads for it,
// null for a declaration without one, above the value itself, so an
// explanation prints as the page above what it explains [D98].
const EXPLANATION_TAG = makeTagKeyword('explanation');
bindStateReader('any/explain', (subject, state) => {
  const page = pageOfRecord(recordReadBy(subject, NULL, state, AnyExplainBindingNotFoundError));
  return makeTaggedInstance(EXPLANATION_TAG, new Map([['page', page], ['value', heldByExplanation(subject)]]));
});

