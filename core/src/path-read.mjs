// [QSPTH#get], [QSPTH#write]

import { declareRefusal } from './errors.mjs';
import { beneathOpenTags, isDoc, isFn, isKind, isKeyword, isMap, isQuote, isVec, makeKeyword, makePath, makeQuote, wiringOf } from './types.mjs';
import { nearestOf } from './nearness.mjs';
import { makeSet } from './ordering.mjs';
import { commandStep } from './steps.mjs';

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
  || (error.tag.name === PathSubjectHasNoPartsError.prototype.address && error.facts.get('found') === null);

// [QSPTH#template]
export function partsOfTemplate(value) {
  if (isQuote(value) || isDoc(value) || isFn(value) || isKind(value)) return null;
  if (isVec(value)) return value;
  return isMap(value) ? [...value.values()] : null;
}

export function segmentIndex(segment) {
  return /^-?\d+$/.test(String(segment)) ? parseInt(segment, 10) : NaN;
}

// [QSPTH#get]
export const PathTagClosedError = declareRefusal('path/TagClosedError');

// [QSPTH#get]
export function readPath(subject, path, soft = false) {
  let current = subject;
  for (const [depth, segment] of path.segments.entries()) {
    const container = beneathOpenTags(current);
    if (wiringOf(container) !== undefined) throw tagClosed(container, path, depth);
    if (container === null && soft) return MISSED;
    if (isMap(container)) {
      if (!container.has(segment)) {
        if (soft) return MISSED;
        throw keyNotInMap(container, segment, path);
      }
      current = container.get(segment);
      continue;
    }
    if (isVec(container)) {
      const at = indexIn(container, segment, path, soft);
      if (at === MISSED) return MISSED;
      current = container[at];
      continue;
    }
    throw noPartsOn(container, segment, path);
  }
  return current;
}

// [QSSLF#near]
export function keyNotInMap(container, segment, path) {
  const nearest = Object.freeze(nearestOf(container.keys(), segment).map(name => makeKeyword(name)));
  return new PathKeyNotInMapError({ key: makeKeyword(segment), nearest, path, found: container });
}

export function indexIn(container, segment, path, soft = false) {
  const index = segmentIndex(segment);
  if (Number.isNaN(index)) throw new PathIndexNotIntegerError({ segment: makeKeyword(segment), path, found: container });
  const at = index < 0 ? container.length + index : index;
  if (at >= 0 && at < container.length) return at;
  if (soft) return MISSED;
  throw new PathIndexOutOfBoundsError({ index, length: container.length, path, found: container });
}

// [QSPTH#get]
export function tagClosed(value, path, depth) {
  const read = namesRead(value, path.segments.slice(depth));
  const repair = read === null ? undefined : makeQuote([...(depth === 0 ? [] : [commandStep('get', [makePath(path.segments.slice(0, depth))])]), ...read]);
  const names = makeSet([...wiringOf(value).keys()].map(makeKeyword));
  return new PathTagClosedError({ names, repair, path, found: value });
}

function namesRead(value, segments) {
  if (segments.length === 0) return [];
  const parts = wiringOf(beneathOpenTags(value));
  if (parts === undefined) return openRead(value, segments);
  const [name, ...rest] = segments;
  if (!parts.has(name)) return null;
  const after = namesRead(parts.get(name), rest);
  return after === null ? null : [commandStep(name, []), ...after];
}

// [QSPTH#get]
function openRead(value, segments) {
  let part = value;
  let open = 0;
  while (open < segments.length && wiringOf(beneathOpenTags(part)) === undefined) {
    part = partAt(part, segments[open]);
    if (part === MISSED) return [commandStep('get', [makePath(segments)])];
    open++;
  }
  const read = commandStep('get', [makePath(segments.slice(0, open))]);
  if (open === segments.length) return [read];
  const after = namesRead(part, segments.slice(open));
  return after === null ? null : [read, ...after];
}

function partAt(value, segment) {
  try {
    return readPath(value, makePath([segment]), true);
  } catch {
    return MISSED;
  }
}

export function noPartsOn(value, segment, path) {
  return new PathSubjectHasNoPartsError({
    segment: Number.isNaN(segmentIndex(segment)) ? makeKeyword(segment) : segmentIndex(segment),
    path,
    found: value
  });
}
