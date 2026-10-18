// The axes, each a passage from a name to its declaration [QSSLF#axis], the
// record the declaration wrote into its scope [QSNAM#binding]: a tag name the
// node of the tree it addresses, `::vec/count` or `::qlang/values`
// [QSDSP#residence], a record the binding it records, and every other value,
// a keyword among them, the node of the first kind its stack of tags
// declares. Each axis projects a field of the record:
//
// `source`   the quote of the declaring step, null for a binding no
//            declaration wrote, a node a chain lays among them [QSSLF#axis].
// `doc`      the page of the step's slot, its docs as one, null for
//            a slot without one [QSSLF#axis].
// `binding`  the record itself, `::binding` with its name, docs, value,
//            source and origin, the source it was read from [QSDSP#residence].
//
// Given an anchor, a keyword, each axis reads the node the subject holds
// under it [QSSLF#axis]: for a tag name the node under its address, an input of a
// verb among them, `::vec/take | doc :count`, and for any other subject the
// verb of that name it calls, `[1 2] | doc :count` the page of `::vec/count`.

import { registerStateReader } from '../primitives.mjs';
import {
  isKeyword, isTag, isBinding, isNull, isSet, isVec, keyword, typeOf, makeTagged,
  makeTag, makeQuote, makeDoc, payloadBeneath, NULL
} from '../types.mjs';
import {
  addressesOf, declarationsUnder, nodeOf, refuseWithheld, residenceOnSubject
} from './nouns.mjs';
import { declareRefusal } from '../errors.mjs';
import { nearestTagNames, nearestNodes } from '../nearest-names.mjs';
import { splitAddress } from '../address.mjs';

// Each axis refuses under its own address, `name` the name it read, a
// keyword or a tag [QSERR#site].
const AnySourceUnknownNameError = declareRefusal('any/source/UnknownNameError');
const AnyDocUnknownNameError = declareRefusal('any/doc/UnknownNameError');
const AnyBindingUnknownNameError = declareRefusal('any/binding/UnknownNameError');
const AnyDocAnchorElementNotKeywordError = declareRefusal('any/doc/anchor/ElementNotKeywordError');
const AnyExplainUnknownNameError = declareRefusal('any/explain/UnknownNameError');

// What a refusal of an axis holds, the subject a name nothing declares:
// the tag it read, the addresses where the pages of its last name live and
// the names near it [QSDSP#walk], [QSERR#site], [QSSLF#near].
function refusalOf(env, subject) {
  return { name: subject, addresses: addressesOf(env, splitAddress(subject.name)[1]), nearest: nearestTagNames(env, subject.name) };
}

// The record a subject names, the one record every axis and `runLaws` read: a
// name by its tag, the address of its node, null where nothing declares it,
// and any other value, a keyword among them, by its kind [QSLIT#keyword]; a
// tag of a value withheld from held code is refused [QSQUO#held].
function declaringRecordOf(env, subject) {
  if (isBinding(subject)) return subject;
  if (isTag(subject)) {
    refuseWithheld(env, subject.name, true);
    return nodeOf(env, subject.name) ?? nodeOfRefused(env, subject.name);
  }
  return recordOfKind(env, subject);
}

// The record of the first kind a value's stack of tags declares, from the
// outside in, as a call of a verb walks it, a tag of identity read past to
// the kind beneath it [QSSLF#axis]; null where none is declared.
function recordOfKind(env, value) {
  const name = typeOf(value).name;
  return nodeOf(env, name) ?? nodeOfRefused(env, name) ?? recordOfKind(env, payloadBeneath(value));
}

// The node a refusal named by the address of what refused reads its page
// from, that address, when no node of its own declares it [QSSLF#catalog].
function nodeOfRefused(env, name) {
  const [refusedName] = splitAddress(name);
  return refusedName !== null && name.endsWith('Error') ? nodeOf(env, refusedName) : null;
}

// The record of the node the subject holds under an anchor, or null: the
// node under the address a tag name writes, an input of a verb among them,
// and otherwise the verb the subject's walk reaches under the anchor [QSSLF#axis].
function nodeUnderAnchor(env, subject, anchorName) {
  const under = isTag(subject) ? nodeOf(env, `${subject.name}/${anchorName}`) : null;
  return under ?? residenceOnSubject(env, anchorName, subject);
}

// What the refusal of an anchor holds: the name the reader asked, a
// keyword, where the verbs of that name live, and the nodes of the subject
// near it [QSSLF#axis].
function anchorRefusalOf(env, subject, anchorName) {
  return {
    name: keyword(anchorName),
    addresses: addressesOf(env, anchorName),
    nearest: nearestNodes(env, subject, anchorName)
  };
}

// The record the subject names in the scope of the call, or the node it
// holds under an anchor, or the refusal of the axis that read it; each
// axis resides on `::any`, and its primitive reads the state of
// the call [QSDSP#residence].
export function recordReadBy(subject, anchor, state, NotFoundError) {
  if (!isNull(anchor)) {
    const node = nodeUnderAnchor(state.env, subject, anchor.name);
    if (node === null) throw new NotFoundError(anchorRefusalOf(state.env, subject, anchor.name));
    return node;
  }
  const record = declaringRecordOf(state.env, subject);
  if (record === null) throw new NotFoundError(refusalOf(state.env, subject));
  return record;
}

registerStateReader('any/binding', (subject, anchor, state) =>
  recordReadBy(subject, anchor, state, AnyBindingUnknownNameError));
// The source of a record and of every declaration under its address,
// one quote of their steps in the order they were written, what stands
// under the address read at once; a binding no declaration wrote holds
// none [QSSLF#axis].
registerStateReader('any/source', (subject, anchor, state) => {
  const record = recordReadBy(subject, anchor, state, AnySourceUnknownNameError);
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

// The anchors `doc` reads in turn: none for null, a keyword alone, the
// elements of a vector, and any other value one anchor the read refuses
// [QSSLF#axis].
const anchorsOf = anchor => (isNull(anchor) ? [] : isVec(anchor) ? anchor : [anchor]);

// The record the anchors reach, read in turn, each the last name of a node
// under the record the one before it reached, no anchor the record of the
// subject itself [QSSLF#axis].
function recordOfAnchors(subject, anchors, state) {
  if (anchors.length === 0) return recordReadBy(subject, NULL, state, AnyDocUnknownNameError);
  return anchors.reduce((reached, anchor, index) => {
    if (!isKeyword(anchor)) throw new AnyDocAnchorElementNotKeywordError({ index, actualValue: anchor });
    return recordReadBy(index === 0 ? reached : underRecord(reached), anchor, state, AnyDocUnknownNameError);
  }, subject);
}

// What the next anchor reads under: the address of the record reached, so
// a node under a node is read by its address [QSSLF#axis].
const underRecord = record => makeTag(record.get('name').name);

// The page the anchors read, the page of the node the last of them reaches.
const pageAt = (subject, anchor, state) => pageOfRecord(recordOfAnchors(subject, anchorsOf(anchor), state));

// A set of anchors reads a page at each, in the order of the set, an
// element that is no anchor and no vector of them refused at its index.
registerStateReader('any/doc', (subject, anchor, state) => {
  if (!isSet(anchor)) return pageAt(subject, anchor, state);
  const stranger = anchor.findIndex(each => !isNull(each) && !isKeyword(each) && !isVec(each));
  if (stranger >= 0) throw new AnyDocAnchorElementNotKeywordError({ index: stranger, actualValue: anchor[stranger] });
  return Object.freeze(anchor.map(each => pageAt(subject, each, state)));
});

// The explanation of a value: the page `doc` reads for it, null for a
// declaration without one, above the value itself, an error at rest as
// `!|` caught it [QSERR#catch], so an explanation prints as the page above what
// it explains [QSSLF#explain].
const EXPLANATION_TAG = makeTag('explanation');
registerStateReader('any/explain', (subject, state) => {
  const page = pageOfRecord(recordReadBy(subject, NULL, state, AnyExplainUnknownNameError));
  return makeTagged(EXPLANATION_TAG, new Map([['page', page], ['value', subject]]));
});

