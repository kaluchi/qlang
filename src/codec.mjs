// Tagged-JSON value codec for qlang runtime values — single
// canonical encoder/decoder pair between Vec/Map/Set/keyword/scalar
// values and a JSON form that survives `JSON.stringify` round-trips.
//
// The tagged form mirrors what test/unit/conformance.test.mjs
// hydrates from .jsonl test cases, lifted out of the test runner
// into a shared module so notebook session save/restore, REPL
// persistence across browser reloads, and any serialization
// caller all share one wire format.
//
// Tag conventions:
//   plain JSON value          → itself (number, string, boolean, null, array)
//   { "$keyword": "name" }    → interned keyword
//   { "$map": [[k, v], ...] } → JS Map (entries pairs, recursively encoded)
//   { "$set": [v1, v2, ...] } → JS Set (recursively encoded)
//
// Function values, conduits, and snapshots cannot be encoded as JSON
// directly — they require the higher-level session serializer to
// reconstruct them from source on restore. toTaggedJSON throws on
// these via TaggedJSONUnencodableValueError.

import {
  keyword,
  isKeyword,
  isVec,
  isQMap,
  isQSet,
  isFunctionValue,
  isConduit,
  isSnapshot
} from './types.mjs';

export class TaggedJSONUnencodableValueError extends Error {
  constructor(typeName) {
    super(`cannot encode ${typeName} value to tagged JSON; use serializeSession`);
    this.name = 'TaggedJSONUnencodableValueError';
    this.typeName = typeName;
  }
}

export class MalformedTaggedJSONError extends Error {
  constructor(json) {
    super(`fromTaggedJSON: unrecognized payload shape: ${JSON.stringify(json)}`);
    this.name = 'MalformedTaggedJSONError';
    this.payload = json;
  }
}

// toTaggedJSON(value) → JSON-serializable plain value
export function toTaggedJSON(value) {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'number' || t === 'string' || t === 'boolean') return value;
  if (isKeyword(value)) return { $keyword: value.name };
  if (isVec(value)) return value.map(toTaggedJSON);
  if (isQMap(value)) {
    return {
      $map: Array.from(value, ([k, v]) => [toTaggedJSON(k), toTaggedJSON(v)])
    };
  }
  if (isQSet(value)) {
    return { $set: Array.from(value, toTaggedJSON) };
  }
  if (isFunctionValue(value)) throw new TaggedJSONUnencodableValueError('function');
  if (isConduit(value))         throw new TaggedJSONUnencodableValueError('conduit');
  if (isSnapshot(value))      throw new TaggedJSONUnencodableValueError('snapshot');
  throw new TaggedJSONUnencodableValueError(t);
}

// fromTaggedJSON(json) → qlang runtime value
export function fromTaggedJSON(json) {
  if (json === null || json === undefined) return null;
  const t = typeof json;
  if (t === 'number' || t === 'string' || t === 'boolean') return json;
  if (Array.isArray(json)) return json.map(fromTaggedJSON);
  if (typeof json === 'object') {
    if ('$keyword' in json) return keyword(json.$keyword);
    if ('$map' in json) {
      const m = new Map();
      for (const [k, v] of json.$map) m.set(fromTaggedJSON(k), fromTaggedJSON(v));
      return m;
    }
    if ('$set' in json) {
      const s = new Set();
      for (const v of json.$set) s.add(fromTaggedJSON(v));
      return s;
    }
  }
  throw new MalformedTaggedJSONError(json);
}
