// [QSSLF#axis], [QSNAM#binding], [QSDSP#residence]

import { registerStateReader } from '../primitives.mjs';
import {
  isKeyword, isTag, isBinding, isNull, isSet, isVec, makeKeyword, tagOf,
  makeTag, makeQuote, makeDoc, payloadBeneath, beneathTags, NULL
} from '../types.mjs';
import {
  addressesOf, declarationsUnder, nodeOf, partOfTheLabel, refuseWithheld, residenceOnSubject
} from '../nouns.mjs';
import { declareRefusal } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';
import { nearestTagNames, nearestNodes } from '../nearest-names.mjs';
import { splitAddress, FN_CALL_ADDRESS } from '../address.mjs';

// [QSERR#site]
const AnySourceUnknownNameError = declareRefusal('any/source/UnknownNameError');
const AnyDocUnknownNameError = declareRefusal('any/doc/UnknownNameError');
const AnyBindingUnknownNameError = declareRefusal('any/binding/UnknownNameError');
const AnyDocAnchorNameKindNotTakenError = declareRefusal('any/doc/anchor/NameKindNotTakenError');
const AnyDocAnchorElementKindNotTakenError = declareRefusal('any/doc/anchor/ElementKindNotTakenError');

// [QSDSP#walk], [QSERR#site], [QSSLF#near]
function refusalOf(scope, subject) {
  return { name: subject, addresses: addressesOf(scope, splitAddress(subject.name)[1]), nearest: nearestTagNames(scope, subject.name) };
}

// [QSLIT#keyword], [QSQUO#held]
export function declaringRecordOf(scope, subject) {
  if (isBinding(subject)) return subject;
  if (isTag(subject)) {
    refuseWithheld(scope, subject.name, true);
    return nodeOf(scope, subject.name) ?? partOfTheLabel(scope, subject.name) ?? nodeOfRefused(scope, subject.name);
  }
  return recordOfKind(scope, subject);
}

// [QSSLF#axis]
function recordOfKind(scope, value) {
  const name = tagOf(value).name;
  return nodeOf(scope, name) ?? nodeOfRefused(scope, name) ?? recordOfKind(scope, payloadBeneath(value));
}

function nodeOfRefused(scope, name) {
  const [refusedName] = splitAddress(name);
  if (refusedName === null || !name.endsWith('Error')) return null;
  return nodeOf(scope, refusedName) ?? (refusedName.startsWith(`${FN_CALL_ADDRESS}/`) ? nodeOf(scope, FN_CALL_ADDRESS) : null);
}

function nodeUnderAnchor(scope, subject, anchorName) {
  const under = isTag(subject) ? nodeOf(scope, `${subject.name}/${anchorName}`) : null;
  return under ?? residenceOnSubject(scope, anchorName, subject);
}

function anchorRefusalOf(scope, subject, anchorName) {
  return {
    name: makeKeyword(anchorName),
    addresses: addressesOf(scope, anchorName),
    nearest: nearestNodes(scope, subject, anchorName)
  };
}

// [QSDSP#residence]
export function recordReadBy(subject, anchor, state, NotFoundError) {
  if (!isNull(anchor)) {
    const node = nodeUnderAnchor(state.scope, subject, anchor.name);
    if (node === null) throw new NotFoundError(anchorRefusalOf(state.scope, subject, anchor.name));
    return node;
  }
  const record = declaringRecordOf(state.scope, subject);
  if (record === null) throw new NotFoundError(refusalOf(state.scope, subject));
  return record;
}

registerStateReader('any/binding', (subject, anchor, state) =>
  recordReadBy(subject, anchor, state, AnyBindingUnknownNameError));
// [QSSLF#axis]
registerStateReader('any/source', (subject, anchor, state) => {
  const record = recordReadBy(subject, anchor, state, AnySourceUnknownNameError);
  const written = [record, ...declarationsUnder(state.scope, record.get('name').name)].filter(declared => declared.get('source') !== null);
  return written.length === 0 ? NULL : makeQuote(written.flatMap(declared => [...declared.get('source')]));
});
export function pageOfRecord(record) {
  const docs = record.get('docs');
  if (docs.length <= 1) return docs[0] ?? NULL;
  return makeDoc(docs.flatMap((doc, index) => index === 0 ? doc : ['\n', ...doc]));
}

const anchorsOf = anchor => (isNull(beneathTags(anchor)) ? [] : isVec(beneathTags(anchor)) ? beneathTags(anchor) : [anchor]);

function recordOfAnchors(subject, anchors, state) {
  if (anchors.length === 0) return recordReadBy(subject, NULL, state, AnyDocUnknownNameError);
  return anchors.reduce((reached, anchor, index) => {
    const name = beneathTags(anchor);
    if (!isKeyword(name)) throw new AnyDocAnchorNameKindNotTakenError({ index, expected: kindsExpected('keyword'), actualValue: anchor });
    return recordReadBy(index === 0 ? reached : underRecord(reached), name, state, AnyDocUnknownNameError);
  }, subject);
}

const underRecord = record => makeTag(record.get('name').name);

const pageAt = (subject, anchor, state) => pageOfRecord(recordOfAnchors(subject, anchorsOf(anchor), state));

registerStateReader('any/doc', (subject, anchor, state) => {
  if (!isSet(anchor)) return pageAt(subject, anchor, state);
  const stranger = anchor.map(beneathTags).findIndex(each => !isNull(each) && !isKeyword(each) && !isVec(each));
  if (stranger >= 0) throw new AnyDocAnchorElementKindNotTakenError({ index: stranger, expected: kindsExpected('keyword', 'null', 'vec'), actualValue: anchor[stranger] });
  return Object.freeze(anchor.map(each => pageAt(subject, each, state)));
});

