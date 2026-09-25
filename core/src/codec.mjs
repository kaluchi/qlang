// Tagged-JSON value codec for qlang runtime values — single
// canonical encoder/decoder pair between Vec/Map/Set/keyword/scalar
// values and a JSON form that survives `JSON.stringify` round-trips.
//
// The tagged form is the wire format of the session envelope
// (`serializeSession`) and of the command line's `tjson` and
// `parseTjson` verbs.
//
// Wire-format convention: a bare JSON array is a Vec and a bare JSON
// object a Map, the shapes JSON has. The value-classes JSON lacks
// (Keyword / TaggedInstance / ErrorValue / Quote / Doc) ride
// dedicated `$tag`-keyed envelopes, and so does a Map the encoder
// writes, so a key that spells an envelope cannot read as one. A set
// is the vector under the `::set` tag [D16] and rides the `$tagged`
// envelope; it decodes through the set's constructor, so a wire that
// lists its elements out of order or twice reads as the set they make.
//
// Tag conventions:
//   number / string / boolean / null          → itself
//   bare JSON array `[v1, v2, …]`             → Vec (recursively decoded)
//   bare JSON object `{ "k": v, … }` (no `$tag` envelope key)
//                                             → Map (recursively decoded)
//   { "$keyword": "name" }                    → interned keyword
//   { "$tagKeyword": "Name" }                 → TagKeyword (`::Name`)
//   { "$map": [[k, v], …] }                   → Map (entries pairs)
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
// `$`-prefixed string in the known set (`$keyword` / `$map`
// / `$quote` / `$doc` / `$tagged` / `$error`) routes through the
// envelope branch; anything else (including objects with
// `$`-prefixed keys outside the known set, or multiple keys) decodes
// as a Map, since a JSON document is one.
//
// Function values and conduits cannot be encoded as JSON directly —
// they require the higher-level session serializer to reconstruct
// them from source on restore. toTaggedJSON throws on these via
// TaggedJSONUnencodableValueError.

import {
  keyword,
  isKeyword,
  isTagKeyword,
  isVec,
  isQMap,
  isFunctionValue,
  isConduit,
  isQuote,
  isDoc,
  isErrorValue,
  isTaggedInstance,
  makeErrorValue,
  makeTaggedInstance,
  makeTagKeyword,
  makeDoc,
  finiteNumberOrLift,
  TAG_HEADER_SYMBOL
} from './types.mjs';
import { declarePerSiteError } from './errors.mjs';
import { quoteOfSource, printQuoteSource } from './quote.mjs';

export const TaggedJSONUnencodableValueError = declarePerSiteError(
  'TaggedJSONUnencodableValueError', 'codecError',
  ({ typeName }) => `cannot encode ${typeName} value to tagged JSON; use serializeSession`,
  { operand: '::qlang' }
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
  () => 'fromTaggedJSON: a number outside the finite-double domain cannot decode into a qlang Number',
  { operand: '::qlang' }
);

export const MalformedTaggedJSONError = declarePerSiteError(
  'MalformedTaggedJSONError', 'codecError',
  ({ payload }) => `fromTaggedJSON: unrecognized payload shape: ${JSON.stringify(payload)}`,
  { operand: '::qlang' }
);

// toTaggedJSON(value) → JSON-serializable plain value
//
// The conduit check runs BEFORE the generic isQMap branch because
// the conduit is a JS Map whose identity rides on the JS-header
// `TAG_HEADER_SYMBOL` slot. Without the early check the generic
// `$map` serializer would walk the descriptor's entries and leak the
// JS-opaque `:envRef` holder into the tagged-JSON stream, contrary
// to the "conduits require session-level reconstruction" contract
// the session serializer relies on.
export function toTaggedJSON(value) {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'number') return finiteNumberOrLift(value);
  if (t === 'string' || t === 'boolean') return value;
  if (isKeyword(value)) return { $keyword: value.name };
  if (isTagKeyword(value)) return { $tagKeyword: value.name };
  // A quote is a tagged vector; its envelope carries its text.
  if (isQuote(value)) return { $quote: printQuoteSource(value) };
  // TaggedInstance check before generic Vec / Map branches — a
  // tagged Vec, the set among them, is still `isVec(true)`, but the
  // bare Vec encoder strips identity. The envelope below recovers identity through
  // the `$tag` slot and re-routes payload through
  // `toTaggedJSON` recursively (the `payload` operand strip-path
  // for the source-value type).
  if (isTaggedInstance(value)) {
    let inner;
    if (Array.isArray(value)) {
      inner = Object.freeze([...value]);
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
  if (isVec(value)) return value.map(toTaggedJSON);
  if (isDoc(value)) return { $doc: value.content };
  if (isQMap(value)) {
    return {
      $map: Array.from(value, ([k, v]) => [toTaggedJSON(k), toTaggedJSON(v)])
    };
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
// key without `$`-prefix) decodes as a Map — the catch-all for «JSON
// object on the wire» since plain JSON has no «type» slot. This narrow rule keeps real JSON data (`{"a":1}`,
// `{"name":"x", "age":2}`) safe from envelope-misinterpretation
// while still single-keying the qlang-only envelopes on the wire.
const ENVELOPE_KEYS = new Set([
  '$keyword', '$tagKeyword', '$map',
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
    return json.map((element, index) => fromTaggedJSON(element, [...path, index]));
  }
  if (typeof json === 'object') {
    switch (envelopeKeyOf(json)) {
      case '$keyword':    return keyword(json.$keyword);
      case '$tagKeyword': return makeTagKeyword(json.$tagKeyword);
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
      case '$quote': return quoteOfSource(json.$quote, 'tagged-json');
      case '$doc':   return makeDoc(json.$doc);
    }
    // Catch-all: bare JSON object → Map (recursively decoded).
    const decodedMap = new Map();
    for (const [k, v] of Object.entries(json)) decodedMap.set(k, fromTaggedJSON(v, [...path, k]));
    return decodedMap;
  }
  throw new MalformedTaggedJSONError({ payload: json });
}
