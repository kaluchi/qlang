// The axes, each a passage from a name to its declaration
// [D61], the record the declaration wrote into its scope [D5]: a
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
//            source and origin, the source it was read from [D153].
//
// Given a name, each axis reads the member the subject holds under it
// [D88]: for a tag name the name under its address, a part of the args
// of a word among them, `::vec/take | doc :count`, and for any other
// subject the word the name calls after it, `::map | doc :minus` the
// page of `::map/minus`.

import { bindStateReader } from '../primitives.mjs';
import {
  isKeyword, isTag, isBinding, isNull, isQSet, isVec, keyword, typeKeyword, makeTaggedInstance,
  makeTag, makeQuote, makeDoc, NULL
} from '../types.mjs';
import {
  addressesOf, declarationsUnder, nodeOf, residenceOnSubject
} from './nouns.mjs';
import { declareRefusal } from '../errors.mjs';
import { nearestTagNames } from '../nearest-names.mjs';
import { splitAddress } from '../address.mjs';

// `name` is the name an axis read, a keyword or a tag.
//
// One class per axis: the axis is the site, so `!| type` alone says
// which lookup failed.
export const AnySourceUnknownNameError = declareRefusal('any/source/UnknownNameError');
export const AnyDocUnknownNameError = declareRefusal('any/doc/UnknownNameError');
const AnyBindingUnknownNameError = declareRefusal('any/binding/UnknownNameError');
const AnyDocAnchorElementNotKeywordError = declareRefusal('any/doc/anchor/ElementNotKeywordError');
export const AnyExplainUnknownNameError = declareRefusal('any/explain/UnknownNameError');

// The name a refusal says a subject read: a tag name itself, and for
// every other value the tag of its kind, the kind `type` answers [D61].
function nameReadOf(subject) {
  return isTag(subject) ? subject : typeKeyword(subject);
}

// The name whose verbs a refusal lists: the last name of a tag name's
// path, `::any/links` naming `links` [D46], or its kind's.
function nameOf(subject) {
  if (isTag(subject)) return splitAddress(subject.name)[1];
  return typeKeyword(subject).name;
}

// What a refusal of an axis holds: the name it read and the addresses
// where the pages of that name live [D34], [D46].
export function refusalOf(env, subject) {
  return { name: nameReadOf(subject), addresses: addressesOf(env, nameOf(subject)), nearest: nearestOfSubject(env, subject) };
}

// The names near the one a tag name reads, the reader's own among them
// [D118].
function nearestOfSubject(env, subject) {
  return isTag(subject) ? nearestTagNames(env, subject.name) : Object.freeze([]);
}

// The record a subject names, the one record every axis and
// `runLaws` read, or null when it names none: a name by its tag, the
// address of its node, and any other value, a keyword among them, by its
// kind [D221]; a value a host bound under a name is no record.
export function declaringRecordOf(env, subject) {
  if (isBinding(subject)) return subject;
  const name = isTag(subject) ? subject.name : typeKeyword(subject).name;
  return nodeOf(env, name) ?? nodeOfRefused(env, name);
}

// The node a refusal named by the address of what refused reads its page
// from, that address, when no node of its own declares it [D180].
function nodeOfRefused(env, name) {
  const [refusedName] = splitAddress(name);
  return refusedName !== null && name.endsWith('Error') ? nodeOf(env, refusedName) : null;
}

// The record of the member the subject holds under a name [D88], or
// null: the name under the address a tag name writes, a part of the
// args of a word among them, and otherwise the word the subject's walk
// reaches under the name [D117].
function memberRecordOf(env, subject, memberName) {
  const under = isTag(subject) ? nodeOf(env, `${subject.name}/${memberName}`) : null;
  return under ?? residenceOnSubject(env, memberName, subject);
}

// What the refusal of a member holds: the name the reader asked, a
// keyword, and where the words of that name live [D206].
function memberRefusalOf(env, memberName) {
  return {
    name: keyword(memberName),
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
    if (member === null) throw new NotFoundError(memberRefusalOf(state.env, memberName.name));
    return member;
  }
  const record = declaringRecordOf(state.env, subject);
  if (record === null) throw new NotFoundError(refusalOf(state.env, subject));
  return record;
}

bindStateReader('any/binding', (subject, memberName, state) =>
  recordReadBy(subject, memberName, state, AnyBindingUnknownNameError));
// The source of a record and of every declaration under its address,
// one quote of their steps in the order they were written, what stands
// under the address read at once; a value a host bound wrote none
// [D168].
bindStateReader('any/source', (subject, memberName, state) => {
  const record = recordReadBy(subject, memberName, state, AnySourceUnknownNameError);
  const written = [record, ...declarationsUnder(state.env, record.get('name').name)].filter(declared => declared.get('source') !== null);
  return written.length === 0 ? NULL : makeQuote(written.flatMap(declared => [...declared.get('source')]));
});
// The one page of a record: its docs joined, a line break between two,
// null for a declaration without one [D119].
export function pageOfRecord(record) {
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
  if (anchors.length === 0) return recordReadBy(subject, NULL, state, AnyDocUnknownNameError);
  return anchors.reduce((reached, anchor, index) => {
    if (!isKeyword(anchor)) throw new AnyDocAnchorElementNotKeywordError({ index, actualValue: anchor });
    return recordReadBy(index === 0 ? reached : underRecord(reached), anchor, state, AnyDocUnknownNameError);
  }, subject);
}

// What the next anchor of a path reads under: the address of the record
// reached, so a name under a name is read by its address [D164].
const underRecord = record => makeTag(record.get('name').name);

// The page an anchor reads, the page of the member at the end of its path.
const pageAt = (subject, anchor, state) => pageOfRecord(recordAlongPath(subject, anchorsOf(anchor), state));

// A set of anchors reads a page at each, in the order of the set.
bindStateReader('any/doc', (subject, anchor, state) =>
  isQSet(anchor) ? Object.freeze(anchor.map(each => pageAt(subject, each, state))) : pageAt(subject, anchor, state));

// The explanation of a value: the page `doc` reads for it, null for a
// declaration without one, above the value itself, an error at rest as
// `!|` caught it [D13], so an explanation prints as the page above what
// it explains [D98].
const EXPLANATION_TAG = makeTag('explanation');
bindStateReader('any/explain', (subject, state) => {
  const page = pageOfRecord(recordReadBy(subject, NULL, state, AnyExplainUnknownNameError));
  return makeTaggedInstance(EXPLANATION_TAG, new Map([['page', page], ['value', subject]]));
});

