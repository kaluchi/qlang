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
// Wire-format convention: bare JSON shapes on the wire decode to the
// JSON value-classes (JsonObject / JsonArray) — they ARE JSON,
// nothing more to envelope. qlang-only value-classes (Vec / Map /
// Set / Keyword / TaggedInstance / ErrorValue / Quote / Doc) ride
// dedicated `$tag`-keyed envelopes because plain JSON has no
// surface for them.
//
// Tag conventions:
//   number / string / boolean / null          → itself
//   bare JSON array `[v1, v2, …]`             → JsonArray (recursively decoded)
//   bare JSON object `{ "k": v, … }` (no `$tag` envelope key)
//                                             → JsonObject (recursively decoded)
//   { "$keyword": "name" }                    → interned keyword
//   { "$vec": [v1, v2, …] }                   → qlang Vec
//   { "$map": [[k, v], …] }                   → qlang Map (entries pairs)
//   { "$set": [v1, v2, …] }                   → qlang Set
//   { "$quote": "source" }                    → Quote-value
//   { "$doc": "content" }                     → Doc-value
//   { "$tagged": { "$tag": "Name", "payload": <encoded> } }
//                                             → TaggedInstance with tag
//                                               on JS-header, payload
//                                               reconstructed through
//                                               `makeTaggedInstance`.
//   { "$error": { "$tag": "Name", "descriptor": <encoded-Map> } }
//                                             → ErrorValue with tag on JS-
//                                               header, descriptor as the
//                                               inner Map (no `:kind` field
//                                               — identity rides on the
//                                               envelope's `$tag` slot)
//
// Envelope detection on decode: an Object whose only own key is a
// `$`-prefixed string in the known set (`$keyword` / `$vec` / `$map`
// / `$set` / `$quote` / `$doc` / `$tagged` / `$error`) routes
// through the envelope branch; anything else (including objects
// with `$`-prefixed keys outside the known set, or multiple keys)
// decodes as a JsonObject. JsonObject is the catch-all because JSON
// has no «type» slot — a generic JSON document is a JsonObject.
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
  isJsonObject,
  isJsonArray,
  isFunctionValue,
  isConduit,
  isSnapshot,
  isQuote,
  isDoc,
  isErrorValue,
  isTaggedInstance,
  makeErrorValue,
  makeTaggedInstance,
  makeTagKeyword,
  makeJsonObject,
  makeJsonArray,
  makeQuote,
  makeDoc,
  TAG_HEADER_SYMBOL
} from './types.mjs';
import { QlangError } from './errors.mjs';

export class TaggedJSONUnencodableValueError extends QlangError {
  constructor(typeName) {
    super(`cannot encode ${typeName} value to tagged JSON; use serializeSession`, 'codecError');
    this.name = 'TaggedJSONUnencodableValueError';
    this.fingerprint = 'TaggedJSONUnencodableValueError';
    this.context = { typeName };
  }
}

export class MalformedTaggedJSONError extends QlangError {
  constructor(json) {
    super(`fromTaggedJSON: unrecognized payload shape: ${JSON.stringify(json)}`, 'codecError');
    this.name = 'MalformedTaggedJSONError';
    this.fingerprint = 'MalformedTaggedJSONError';
    this.context = { payload: json };
  }
}

// toTaggedJSON(value) → JSON-serializable plain value
//
// Conduit and snapshot checks run BEFORE the generic isQMap branch
// because both value-classes are JS Maps carrying a `:kind`
// discriminator. Without the early check the generic `$map`
// serializer would walk the descriptor's entries and either leak
// the JS-opaque `:envRef` holder into the tagged-JSON stream
// or silently encode a snapshot wrapper as a plain Map — both
// contrary to the "conduits and snapshots require session-level
// reconstruction" contract the session serializer relies on.
export function toTaggedJSON(value) {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'number' || t === 'string' || t === 'boolean') return value;
  if (isKeyword(value)) return { $keyword: value.name };
  // TaggedInstance check before generic Vec / Map / Set branches —
  // a tagged Vec is still `isVec(true)`, but the bare Vec encoder
  // strips identity. The envelope below recovers identity through
  // the `$tag` slot and re-routes payload through
  // `toTaggedJSON` recursively (the `payload` operand strip-path
  // for the source-value type).
  if (isTaggedInstance(value)) {
    let inner;
    if (Array.isArray(value)) {
      inner = Object.freeze([...value]);
    } else if (value instanceof Set) {
      inner = new Set(value);
    } else if (value instanceof Map) {
      inner = new Map(value);
    } else {
      // Opaque wrap object — read `.payload` directly.
      inner = value.payload;
    }
    return {
      $tagged: {
        $tag: value[TAG_HEADER_SYMBOL].name,
        payload: toTaggedJSON(inner)
      }
    };
  }
  if (isConduit(value))  throw new TaggedJSONUnencodableValueError('conduit');
  if (isSnapshot(value)) throw new TaggedJSONUnencodableValueError('snapshot');
  // JsonArray and JsonObject ride bare JSON on the wire — they ARE
  // JSON, no envelope needed. Vec / Map are qlang-only and need
  // dedicated envelopes since plain JSON has no surface for them.
  if (isJsonArray(value)) return value.map(toTaggedJSON);
  if (isJsonObject(value)) {
    const encoded = {};
    for (const [k, v] of Object.entries(value)) encoded[k] = toTaggedJSON(v);
    return encoded;
  }
  if (isVec(value)) return { $vec: value.map(toTaggedJSON) };
  if (isQuote(value)) return { $quote: value.source };
  if (isDoc(value)) return { $doc: value.content };
  if (isQMap(value)) {
    return {
      $map: Array.from(value, ([k, v]) => [toTaggedJSON(k), toTaggedJSON(v)])
    };
  }
  if (isQSet(value)) {
    return { $set: Array.from(value, toTaggedJSON) };
  }
  if (isErrorValue(value)) {
    return {
      $error: {
        $tag: value.tag.name,
        descriptor: toTaggedJSON(value.descriptor)
      }
    };
  }
  if (isFunctionValue(value)) throw new TaggedJSONUnencodableValueError('function');
  throw new TaggedJSONUnencodableValueError(t);
}

// Envelope detection sentinel: an Object is a qlang-only-value
// envelope iff it has exactly one own key and that key is one of
// the reserved `$`-prefixed strings below. Anything else
// (multi-key object, single-key with unknown `$`-prefix, single-
// key without `$`-prefix) decodes as a JsonObject — the catch-all
// for «JSON object on the wire» since plain JSON has no «type»
// slot. This narrow rule keeps real JSON data (`{"a":1}`,
// `{"name":"x", "age":2}`) safe from envelope-misinterpretation
// while still single-keying the qlang-only envelopes on the wire.
const ENVELOPE_KEYS = new Set([
  '$keyword', '$vec', '$map', '$set',
  '$tagged', '$error', '$quote', '$doc'
]);

function envelopeKeyOf(obj) {
  const ownKeys = Object.keys(obj);
  if (ownKeys.length !== 1) return null;
  const onlyKey = ownKeys[0];
  return ENVELOPE_KEYS.has(onlyKey) ? onlyKey : null;
}

// `$tagged` / `$error` envelopes both carry an inner object with a
// required `$tag` slot — anything else (null, primitive, missing
// `$tag`) is wire corruption; surface it as `MalformedTaggedJSONError`
// instead of letting a property-access TypeError escape.
function isTaggedOrErrorEnvelopeShape(envelope) {
  return envelope !== null
      && typeof envelope === 'object'
      && '$tag' in envelope;
}

// fromTaggedJSON(json) → qlang runtime value
export function fromTaggedJSON(json) {
  if (json === null || json === undefined) return null;
  const t = typeof json;
  if (t === 'number' || t === 'string' || t === 'boolean') return json;
  if (Array.isArray(json)) return makeJsonArray(json.map(fromTaggedJSON));
  if (typeof json === 'object') {
    switch (envelopeKeyOf(json)) {
      case '$keyword': return keyword(json.$keyword);
      case '$vec':     return json.$vec.map(fromTaggedJSON);
      case '$map': {
        const m = new Map();
        for (const [k, v] of json.$map) {
          const decodedKey = fromTaggedJSON(k);
          m.set(typeof decodedKey === 'object' && decodedKey?.type === 'keyword' ? decodedKey.name : decodedKey, fromTaggedJSON(v));
        }
        return m;
      }
      case '$set': {
        const s = new Set();
        for (const v of json.$set) s.add(fromTaggedJSON(v));
        return s;
      }
      case '$tagged': {
        const taggedEnvelope = json.$tagged;
        if (!isTaggedOrErrorEnvelopeShape(taggedEnvelope)) {
          throw new MalformedTaggedJSONError(json);
        }
        return makeTaggedInstance(
          makeTagKeyword(taggedEnvelope.$tag),
          fromTaggedJSON(taggedEnvelope.payload)
        );
      }
      case '$error': {
        const errEnvelope = json.$error;
        if (!isTaggedOrErrorEnvelopeShape(errEnvelope)) {
          throw new MalformedTaggedJSONError(json);
        }
        return makeErrorValue(
          makeTagKeyword(errEnvelope.$tag),
          fromTaggedJSON(errEnvelope.descriptor),
          {}
        );
      }
      case '$quote': return makeQuote(json.$quote);
      case '$doc':   return makeDoc(json.$doc);
    }
    // Catch-all: bare JSON object → JsonObject (recursively decoded).
    const obj = {};
    for (const [k, v] of Object.entries(json)) obj[k] = fromTaggedJSON(v);
    return makeJsonObject(obj);
  }
  throw new MalformedTaggedJSONError(json);
}
