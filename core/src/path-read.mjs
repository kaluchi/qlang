// Reading a path: each segment a key of a map or an index of a vector,
// read beneath the tags stacked over the value it meets, and a write
// follows a path as a read does and misses as a read misses [D360].

import { declareRefusal } from './errors.mjs';
import { beneathTags, isDoc, isFn, isKind, isMap, isQuote, isVec, keyword } from './types.mjs';
import { nearestKeys } from './nearest-names.mjs';

export const PathSubjectHasNoPartsError = declareRefusal('path/SubjectHasNoPartsError');
export const PathKeyNotInMapError = declareRefusal('path/KeyNotInMapError');
export const PathIndexOutOfBoundsError = declareRefusal('path/IndexOutOfBoundsError');
export const PathIndexNotIntegerError = declareRefusal('path/IndexNotIntegerError');

// What a soft read answers where the path misses, a key or an index
// missing or null standing before its last segment.
export const MISSED = Symbol('qlang/missed');

// partsOfTemplate(value) → the parts a template of `get` reads in their
// places, the elements of a vector or a set and the values of a map, under
// a tag or none; null for any other value, which the template answers as
// it is, a quote, a doc, a function and a kind among them, each a vector
// of code or prose [QSPTH#template].
export function partsOfTemplate(value) {
  if (isQuote(value) || isDoc(value) || isFn(value) || isKind(value)) return null;
  if (isVec(value)) return value;
  return isMap(value) ? [...value.values()] : null;
}

// segmentIndex(segment) → the index a segment names, a whole number or one
// counted from the end, or NaN for a segment that names no index, `1e0`
// among them.
export function segmentIndex(segment) {
  return /^-?\d+$/.test(String(segment)) ? parseInt(segment, 10) : NaN;
}

// readPath(subject, path, soft?) → the value at the path. A miss is
// refused with the key and the keys near it, or the index and the length,
// and a value on the path that has no parts with the segment it met, each
// refusal with the path it followed; read softly, a miss answers MISSED
// and the refusal of a kind stands.
export function readPath(subject, path, soft = false) {
  let current = subject;
  for (const segment of path.segments) {
    if (current === null && soft) return MISSED;
    const container = beneathTags(current);
    if (isMap(container)) {
      if (!container.has(segment)) {
        if (soft) return MISSED;
        throw keyNotInMap(container, segment, path, current);
      }
      current = container.get(segment);
      continue;
    }
    if (isVec(container)) {
      const at = indexIn(container, segment, path, current, soft);
      if (at === MISSED) return MISSED;
      current = container[at];
      continue;
    }
    throw noPartsOn(current, segment, path);
  }
  return current;
}

// The refusal of a key the map lacks, with the keys near it.
export function keyNotInMap(container, segment, path, met = container) {
  return new PathKeyNotInMapError({ key: keyword(segment), nearest: nearestKeys(container, segment), path, actualValue: met });
}

// The index a segment names in a vector, counted from the end where it
// is negative; a segment that names no index is refused, and an index
// past the end too, or answers MISSED read softly.
export function indexIn(container, segment, path, met = container, soft = false) {
  const index = segmentIndex(segment);
  if (Number.isNaN(index)) throw new PathIndexNotIntegerError({ segment: keyword(segment), path, actualValue: met });
  const at = index < 0 ? container.length + index : index;
  if (at >= 0 && at < container.length) return at;
  if (soft) return MISSED;
  throw new PathIndexOutOfBoundsError({ index, length: container.length, path, actualValue: met });
}

// The refusal of a value on the path that has no parts.
export function noPartsOn(value, segment, path) {
  return new PathSubjectHasNoPartsError({
    segment: Number.isNaN(segmentIndex(segment)) ? keyword(segment) : segmentIndex(segment),
    path,
    actualValue: value
  });
}
