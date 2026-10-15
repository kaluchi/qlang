// The axes, each a passage from a name to its declaration [QSSLF#axis], the
// record the declaration wrote into its scope [QSNAM#binding]: a tag name the
// node of the tree it addresses, `::vec/count` or `::qlang/values`
// [QSDSP#residence], a record the binding it records, and every other value,
// a keyword among them, the node of its kind, the kind `type` answers. Each
// axis projects a field of
// the record:
//
// `source`   the quote of the declaring step, null for a binding no
//            step declared, a value a host bound.
// `doc`      the page of the step's slot, its docs as one, null for
//            a slot without one [QSSLF#axis].
// `binding`  the record itself, `::binding` with its name, docs, value,
//            source and origin, the source it was read from [QSDSP#residence].
//
// Given a name, each axis reads the member the subject holds under it
// [QSDSP#tagname]: for a tag name the name under its address, an input of a
// word among them, `::vec/take | doc :count`, and for any other subject the
// word the name calls after it, `::map | doc :minus` the page of
// `::map/minus`.

import { bindStateReader } from '../primitives.mjs';
import {
  isKeyword, isTag, isBinding, isNull, isQSet, isVec, isQMap, isValueClass, keyword, typeKeyword, makeTaggedInstance,
  makeTag, makeQuote, makeDoc, NULL
} from '../types.mjs';
import {
  addressesOf, declarationsUnder, nodeOf, refuseWithheld, residenceOnSubject
} from './nouns.mjs';
import { declareRefusal } from '../errors.mjs';
import { nearestTagNames, nearestMembers } from '../nearest-names.mjs';
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

// What a refusal of an axis holds, the subject a name nothing declares:
// the tag it read, the addresses where the pages of its last name live and
// the names near it [QSDSP#walk], [QSERR#site], [QSSLF#near].
function refusalOf(env, subject) {
  return { name: subject, addresses: addressesOf(env, splitAddress(subject.name)[1]), nearest: nearestTagNames(env, subject.name) };
}

// The record a subject names, the one record every axis and `runLaws` read: a
// name by its tag, the address of its node, null where nothing declares it,
// and any other value, a keyword among them, by its kind [QSLIT#keyword]; a
// value a host bound under a name is no record, and a tag of a value withheld
// from held code is refused [QSQUO#held].
export function declaringRecordOf(env, subject) {
  if (isBinding(subject)) return subject;
  if (isTag(subject)) {
    refuseWithheld(env, subject.name, true);
    return nodeOf(env, subject.name) ?? nodeOfRefused(env, subject.name);
  }
  return recordOfKind(env, subject);
}

// The record of the first kind a value's stack of tags declares, from the
// outside in, as a call of a word walks it, a tag of identity read past to
// the kind beneath it [QSSLF#axis]; null where none is declared.
function recordOfKind(env, value) {
  const name = typeKeyword(value).name;
  return nodeOf(env, name) ?? nodeOfRefused(env, name) ?? recordOfKind(env, payloadBeneath(value));
}

// What stands beneath a value's own tag, every kind of the core being
// declared: the payload of a wrapper, or the plain vector or map of a
// container that holds its tag on itself.
function payloadBeneath(value) {
  if (isValueClass(value, 'taggedInstance')) return value.payload;
  return isQMap(value) ? new Map(value) : [...value];
}

// The node a refusal named by the address of what refused reads its page
// from, that address, when no node of its own declares it [QSSLF#catalog].
function nodeOfRefused(env, name) {
  const [refusedName] = splitAddress(name);
  return refusedName !== null && name.endsWith('Error') ? nodeOf(env, refusedName) : null;
}

// The record of the member the subject holds under a name [QSDSP#tagname], or
// null: the name under the address a tag name writes, a part of the
// args of a word among them, and otherwise the word the subject's walk
// reaches under the name [QSSLF#page].
function memberRecordOf(env, subject, memberName) {
  const under = isTag(subject) ? nodeOf(env, `${subject.name}/${memberName}`) : null;
  return under ?? residenceOnSubject(env, memberName, subject);
}

// What the refusal of a member holds: the name the reader asked, a
// keyword, where the words of that name live [QSSLF#doc], and the members of
// the subject near it [QSSLF#near].
function memberRefusalOf(env, subject, memberName) {
  return {
    name: keyword(memberName),
    addresses: addressesOf(env, memberName),
    nearest: nearestMembers(env, subject, memberName)
  };
}

// The record the subject names in the scope of the call, or the member
// it holds under a name, or the refusal of the axis that read it; each
// axis resides on `::any`, and its primitive reads the state of
// the call [QSDSP#residence].
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
  recordReadBy(subject, memberName, state, AnyBindingUnknownNameError));
// The source of a record and of every declaration under its address,
// one quote of their steps in the order they were written, what stands
// under the address read at once; a value a host bound wrote none
// [QSSLF#catalog].
bindStateReader('any/source', (subject, memberName, state) => {
  const record = recordReadBy(subject, memberName, state, AnySourceUnknownNameError);
  const written = [record, ...declarationsUnder(state.env, record.get('name').name)].filter(declared => declared.get('source') !== null);
  return written.length === 0 ? NULL : makeQuote(written.flatMap(declared => [...declared.get('source')]));
});
// The one page of a record: its docs joined, a line break between two,
// null for a declaration without one [QSSLF#axis].
export function pageOfRecord(record) {
  const docs = record.get('docs');
  if (docs.length <= 1) return docs[0] ?? NULL;
  return makeDoc(docs.flatMap((doc, index) => index === 0 ? doc : ['\n', ...doc]));
}

// The anchors of a path: null the empty one, a keyword a path of one,
// a vector its elements, and any other value a path of one the walk
// refuses [QSSLF#axis].
const anchorsOf = anchor => (isNull(anchor) ? [] : isVec(anchor) ? anchor : [anchor]);

// The record a path of anchors reaches, each anchor the name of a member
// of the record the one before it reached, the empty path the record of
// the subject itself [QSSLF#axis].
function recordAlongPath(subject, anchors, state) {
  if (anchors.length === 0) return recordReadBy(subject, NULL, state, AnyDocUnknownNameError);
  return anchors.reduce((reached, anchor, index) => {
    if (!isKeyword(anchor)) throw new AnyDocAnchorElementNotKeywordError({ index, actualValue: anchor });
    return recordReadBy(index === 0 ? reached : underRecord(reached), anchor, state, AnyDocUnknownNameError);
  }, subject);
}

// What the next anchor of a path reads under: the address of the record
// reached, so a name under a name is read by its address [QSSLF#axis].
const underRecord = record => makeTag(record.get('name').name);

// The page an anchor reads, the page of the member at the end of its path.
const pageAt = (subject, anchor, state) => pageOfRecord(recordAlongPath(subject, anchorsOf(anchor), state));

// A set of anchors reads a page at each, in the order of the set, an
// element that is no anchor and no path refused at its place in the set.
bindStateReader('any/doc', (subject, anchor, state) => {
  if (!isQSet(anchor)) return pageAt(subject, anchor, state);
  const stranger = anchor.findIndex(each => !isNull(each) && !isKeyword(each) && !isVec(each));
  if (stranger >= 0) throw new AnyDocAnchorElementNotKeywordError({ index: stranger, actualValue: anchor[stranger] });
  return Object.freeze(anchor.map(each => pageAt(subject, each, state)));
});

// The explanation of a value: the page `doc` reads for it, null for a
// declaration without one, above the value itself, an error at rest as
// `!|` caught it [QSERR#catch], so an explanation prints as the page above what
// it explains [QSSLF#explain].
const EXPLANATION_TAG = makeTag('explanation');
bindStateReader('any/explain', (subject, state) => {
  const page = pageOfRecord(recordReadBy(subject, NULL, state, AnyExplainUnknownNameError));
  return makeTaggedInstance(EXPLANATION_TAG, new Map([['page', page], ['value', subject]]));
});

