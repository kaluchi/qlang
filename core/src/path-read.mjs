// Reading a path [D248]: each segment a key of a map or a place of a
// vector, read beneath the tags stacked over the value it meets.

import { declareRefusal } from './errors.mjs';
import { isQMap, isVec, isValueClass, keyword } from './types.mjs';
import { nearestKeys } from './nearest-names.mjs';

export const PathSubjectNotProjectableError = declareRefusal('path/SubjectNotProjectableError');
export const PathKeyNotInMapError = declareRefusal('path/KeyNotInMapError');
export const PathIndexOutOfBoundsError = declareRefusal('path/IndexOutOfBoundsError');
export const PathIndexNotIntegerError = declareRefusal('path/IndexNotIntegerError');

// What a soft read answers where the path misses, a key or a place
// missing or null standing before its last segment.
export const MISSED = Symbol('qlang/missed');

// segmentIndex(segment) → the place a segment names, a whole number or one
// counted from the end, or NaN for a segment that names no place, `1e0`
// among them.
export function segmentIndex(segment) {
  return /^-?\d+$/.test(String(segment)) ? parseInt(segment, 10) : NaN;
}

function beneathTags(value) {
  let beneath = value;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return beneath;
}

// readPath(subject, path, soft?) → the value at the path. A miss is
// refused with the key and the keys near it, or the place and the length,
// and a value on the path that has no parts with the segment it met;
// read softly, a miss answers MISSED and the refusal of a kind stands.
export function readPath(subject, path, soft = false) {
  let current = subject;
  for (const segment of path.segments) {
    if (current === null && soft) return MISSED;
    const container = beneathTags(current);
    if (isQMap(container)) {
      if (!container.has(segment)) {
        if (soft) return MISSED;
        throw new PathKeyNotInMapError({ key: keyword(segment), nearest: nearestKeys(container, segment), actualValue: current });
      }
      current = container.get(segment);
      continue;
    }
    if (isVec(container)) {
      const index = segmentIndex(segment);
      if (Number.isNaN(index)) throw new PathIndexNotIntegerError({ key: keyword(segment), actualValue: current });
      const place = index < 0 ? container.length + index : index;
      if (place < 0 || place >= container.length) {
        if (soft) return MISSED;
        throw new PathIndexOutOfBoundsError({ index, length: container.length, actualValue: current });
      }
      current = container[place];
      continue;
    }
    throw new PathSubjectNotProjectableError({
      key: Number.isNaN(segmentIndex(segment)) ? keyword(segment) : segmentIndex(segment),
      actualValue: current
    });
  }
  return current;
}
