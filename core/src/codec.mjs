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
//   { "$tagKeyword": "Name" }                 → TagKeyword (`::Name`)
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
  isTagKeyword,
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
  finiteNumberOrLift,
  TAG_HEADER_SYMBOL
} from './types.mjs';
import { declarePerSiteError } from './errors.mjs';

export const TaggedJSONUnencodableValueError = declarePerSiteError(
  'TaggedJSONUnencodableValueError', 'codecError',
  ({ typeName }) => `cannot encode ${typeName} value to tagged JSON; use serializeSession`
);

// The wire carries plain JSON numbers, and `JSON.parse` reads a
// magnitude past the double range as an infinity. The decoder
// refuses it so a restored session or a conformance fixture cannot
// smuggle in a value the language does not admit.
// `:path` names the envelope keys and indices walked to reach the
// refused scalar, so `!| /path` locates it inside a restored session
// of any depth.
export const TaggedJSONNumberNotFiniteError = declarePerSiteError(
  'TaggedJSONNumberNotFiniteError', 'codecError',
  () => 'fromTaggedJSON: a number outside the finite-double domain cannot decode into a qlang Number'
);

export const MalformedTaggedJSONError = declarePerSiteError(
  'MalformedTaggedJSONError', 'codecError',
  ({ payload }) => `fromTaggedJSON: unrecognized payload shape: ${JSON.stringify(payload)}`
);

// toTaggedJSON(value) → JSON-serializable plain value
//
// Conduit and snapshot checks run BEFORE the generic isQMap branch
// because both value-classes are JS Maps whose identity rides on
// the JS-header `TAG_HEADER_SYMBOL` slot. Without the early check
// the generic `$map` serializer would walk the descriptor's
// entries and either leak
// the JS-opaque `:envRef` holder into the tagged-JSON stream
// or silently encode a snapshot wrapper as a plain Map — both
// contrary to the "conduits and snapshots require session-level
// reconstruction" contract the session serializer relies on.
export function toTaggedJSON(value) {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'number') return finiteNumberOrLift(value);
  if (t === 'string' || t === 'boolean') return value;
  if (isKeyword(value)) return { $keyword: value.name };
  if (isTagKeyword(value)) return { $tagKeyword: value.name };
  // TaggedInstance check before generic Vec / Map / Set branches —
  // a tagged Vec is still `isVec(true)`, but the bare Vec encoder
  // strips identity. The envelope below recovers identity through
  // the `$tag` slot and re-routes payload through
  // `toTaggedJSON` recursively (the `payload` operand strip-path
  // for the source-value type).
  if (isTaggedInstance(value)) {
    let inner;
    if (Array.isArray(value)) {
      // Restamp JSON_ARRAY_TAG on the clone so the inner payload
      // round-trips as a bare JSON array (the JSON-shape signal)
      // rather than collapsing into `{$vec: …}`. Same pattern the
      // `payload` operand uses to peel the TaggedInstance header
      // off a composite JsonArray without dropping the inner
      // shape's identity.
      inner = isJsonArray(value)
        ? makeJsonArray([...value])
        : Object.freeze([...value]);
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
  if (isConduit(value))  throw new TaggedJSONUnencodableValueError({ typeName: 'conduit' });
  if (isSnapshot(value)) throw new TaggedJSONUnencodableValueError({ typeName: 'snapshot' });
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
  if (isFunctionValue(value)) throw new TaggedJSONUnencodableValueError({ typeName: 'function' });
  throw new TaggedJSONUnencodableValueError({ typeName: t });
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
  '$keyword', '$tagKeyword', '$vec', '$map', '$set',
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
export function fromTaggedJSON(json, path = []) {
  if (json === null || json === undefined) return null;
  const t = typeof json;
  if (t === 'number' && !Number.isFinite(json)) throw new TaggedJSONNumberNotFiniteError({ path: Object.freeze([...path]) });
  if (t === 'number' || t === 'string' || t === 'boolean') return json;
  if (Array.isArray(json)) {
    return makeJsonArray(json.map((element, index) => fromTaggedJSON(element, [...path, index])));
  }
  if (typeof json === 'object') {
    switch (envelopeKeyOf(json)) {
      case '$keyword':    return keyword(json.$keyword);
      case '$tagKeyword': return makeTagKeyword(json.$tagKeyword);
      case '$vec':        return json.$vec.map((element, index) => fromTaggedJSON(element, [...path, index]));
      case '$map': {
        // qlang Map keys are strings. A `$keyword`-enveloped key on
        // the wire normalises to its `.name` so the decoded Map keeps
        // the string-key invariant.
        const m = new Map();
        for (const [k, v] of json.$map) {
          const decodedKey = fromTaggedJSON(k, path);
          const keyName = isKeyword(decodedKey) ? decodedKey.name : decodedKey;
          m.set(keyName, fromTaggedJSON(v, [...path, keyName]));
        }
        return m;
      }
      case '$set': {
        const s = new Set();
        // A Set carries insertion order as part of its contract, so
        // its elements index the path the way a Vec's do.
        json.$set.forEach((v, index) => s.add(fromTaggedJSON(v, [...path, index])));
        return s;
      }
      case '$tagged': {
        const taggedEnvelope = json.$tagged;
        if (!isTaggedOrErrorEnvelopeShape(taggedEnvelope)) {
          throw new MalformedTaggedJSONError({ payload: json });
        }
        return makeTaggedInstance(
          makeTagKeyword(taggedEnvelope.$tag),
          fromTaggedJSON(taggedEnvelope.payload, [...path, taggedEnvelope.$tag])
        );
      }
      case '$error': {
        const errEnvelope = json.$error;
        if (!isTaggedOrErrorEnvelopeShape(errEnvelope)) {
          throw new MalformedTaggedJSONError({ payload: json });
        }
        return makeErrorValue(
          makeTagKeyword(errEnvelope.$tag),
          fromTaggedJSON(errEnvelope.descriptor, [...path, errEnvelope.$tag]),
          {}
        );
      }
      case '$quote': return makeQuote(json.$quote);
      case '$doc':   return makeDoc(json.$doc);
    }
    // Catch-all: bare JSON object → JsonObject (recursively decoded).
    const obj = {};
    for (const [k, v] of Object.entries(json)) obj[k] = fromTaggedJSON(v, [...path, k]);
    return makeJsonObject(obj);
  }
  throw new MalformedTaggedJSONError({ payload: json });
}
