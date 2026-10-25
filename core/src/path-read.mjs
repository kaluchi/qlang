// [QSPTH#get], [QSPTH#write]

import { declareRefusal, refusingTheSubject } from './errors.mjs';
import { beneathTags, isDoc, isFn, isKind, isKeyword, isMap, isQuote, isVec, makeKeyword, wiredBeneath, wiringOf, CORE_KIND } from './types.mjs';
import { nearestOf } from './nearness.mjs';

export const PathSubjectHasNoPartsError = declareRefusal('path/SubjectHasNoPartsError');
export const PathKeyNotInMapError = declareRefusal('path/KeyNotInMapError');
export const PathIndexOutOfBoundsError = declareRefusal('path/IndexOutOfBoundsError');
export const PathIndexNotIntegerError = declareRefusal('path/IndexNotIntegerError');

export const MISSED = Symbol('qlang/missed');

// [QSPTH#key]
export const KINDS_OF_A_KEY_ALONE = Object.freeze(['keyword', 'number', 'string']);
export const isKeyAlone = value => KINDS_OF_A_KEY_ALONE.includes(isKeyword(value) ? 'keyword' : typeof value);

export const keyNameOf = key => (isKeyword(key) ? key.name : String(key));

// [QSPTH#query]
const MISSED_PARTS = new Set([PathKeyNotInMapError.prototype.address, PathIndexOutOfBoundsError.prototype.address]);

export const isMissedPart = error => MISSED_PARTS.has(error.tag.name);

export const isMissedRead = error => isMissedPart(error)
  || (error.tag.name === PathSubjectHasNoPartsError.prototype.address && error.facts.get('actualTag')?.name === CORE_KIND.null.name);

// [QSPTH#template]
export function partsOfTemplate(value) {
  if (isQuote(value) || isDoc(value) || isFn(value) || isKind(value)) return null;
  if (isVec(value)) return value;
  return isMap(value) ? [...value.values()] : null;
}

export function segmentIndex(segment) {
  return /^-?\d+$/.test(String(segment)) ? parseInt(segment, 10) : NaN;
}

// [D449]
export const PathNameNotWiredError = declareRefusal('path/NameNotWiredError');
export const PathPartNotWritableError = declareRefusal('path/PartNotWritableError');

// [QSPTH#get], [D449]
export function readPath(subject, path, soft = false) {
  let current = subject;
  for (const [depth, segment] of path.segments.entries()) {
    const wired = wiredBeneath(current);
    if (wired !== undefined) {
      const parts = wiringOf(wired);
      if (parts.has(segment)) {
        current = parts.get(segment);
        continue;
      }
      if (soft) return MISSED;
      throw nameNotWired(wired, parts, segment, path, depth);
    }
    const container = beneathTags(current);
    if (container === null && soft) return MISSED;
    if (isMap(container)) {
      if (!container.has(segment)) {
        if (soft) return MISSED;
        throw keyNotInMap(container, segment, path, depth);
      }
      current = container.get(segment);
      continue;
    }
    if (isVec(container)) {
      const at = indexIn(container, segment, path, depth, soft);
      if (at === MISSED) return MISSED;
      current = container[at];
      continue;
    }
    throw noPartsOn(container, segment, path, depth);
  }
  return current;
}

// [QSPTH#get]
const refusalAt = (refusal, depth) => (depth === 0 ? refusingTheSubject(refusal) : refusal);

// [QSSLF#near]
export function keyNotInMap(container, segment, path, depth) {
  const nearest = Object.freeze(nearestOf(container.keys(), segment).map(name => makeKeyword(name)));
  return refusalAt(new PathKeyNotInMapError({ key: makeKeyword(segment), nearest, path, actualValue: container }), depth);
}

export function indexIn(container, segment, path, depth, soft = false) {
  const index = segmentIndex(segment);
  if (Number.isNaN(index)) throw refusalAt(new PathIndexNotIntegerError({ segment: makeKeyword(segment), path, actualValue: container }), depth);
  const at = index < 0 ? container.length + index : index;
  if (at >= 0 && at < container.length) return at;
  if (soft) return MISSED;
  throw refusalAt(new PathIndexOutOfBoundsError({ index, length: container.length, path, actualValue: container }), depth);
}

// [D449]
function nameNotWired(value, parts, segment, path, depth) {
  const nearest = Object.freeze(nearestOf(parts.keys(), segment).map(name => makeKeyword(name)));
  return refusalAt(new PathNameNotWiredError({ name: makeKeyword(segment), nearest, path, actualValue: value }), depth);
}

export function partNotWritable(value, path, depth) {
  return refusalAt(new PathPartNotWritableError({ path, actualValue: value }), depth);
}

export function noPartsOn(value, segment, path, depth) {
  return refusalAt(new PathSubjectHasNoPartsError({
    segment: Number.isNaN(segmentIndex(segment)) ? makeKeyword(segment) : segmentIndex(segment),
    path,
    actualValue: value
  }), depth);
}
