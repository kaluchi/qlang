// Tagged-type constructors. Each constructor is a function
// `(payload, state) → value` registered into PRIMITIVE_REGISTRY
// under `qlang/type/<tag>`. evalTaggedLit looks up the type
// binding's :impl, resolves it to one of these functions,
// and invokes it against the payload-value.
//
// Plus the `qlang` value-namespace operand — a subject-form
// idempotent JSON-shape → qlang-shape converter, the pipeline
// pendant to the `::qlang<payload>` literal-time constructor.
//
// State is passed through so constructors that need a reference to
// the outer env (notably ::conduit, which captures lexical scope
// for body invocation) can pick it up directly.

import { nullaryOp, overloadedOp } from './dispatch.mjs';
import { bindPrim, bindTypeConstructor } from '../primitives.mjs';
import {
  isVecShape, isKeyword, isQuote, isQMap, isJsonObject,
  isTaggedInstance, isTagKeyword, isErrorValue,
  makeConduit, makeTaggedInstance, makeJsonObject, makeJsonArray, isJsonArray, typeKeyword
} from '../types.mjs';
import { parse } from '../parse.mjs';
import { declareSubjectError, declareShapeError, declareArityError, declareModifierError } from '../operand-errors.mjs';

const ConduitPayloadNotVecError = declareSubjectError('ConduitPayloadNotVecError', '::conduit', 'vec');
const BuiltinPayloadNotMapError = declareSubjectError('BuiltinPayloadNotMapError', '::builtin', 'map');
const ConduitArityInvalidError = declareArityError('ConduitArityInvalidError',
  ({ actualCount }) => `::conduit payload must be a Vec of 2 ([params, body]) or 3 ([self, params, body]) elements, got ${actualCount}`);
const ConduitSelfNameNotKeywordError = declareShapeError('ConduitSelfNameNotKeywordError',
  ({ actualType }) => `::conduit self-name must be a Keyword, got ${actualType.name}`);
const ConduitParamsNotVecError = declareShapeError('ConduitParamsNotVecError',
  ({ actualType }) => `::conduit params must be a Vec of Keywords, got ${actualType.name}`);
const ConduitParamNotKeywordError = declareShapeError('ConduitParamNotKeywordError',
  ({ index, actualType }) => `::conduit params[${index}] must be a Keyword, got ${actualType.name}`);
const ConduitBodyNotQuoteError = declareShapeError('ConduitBodyNotQuoteError',
  ({ actualType }) => `::conduit body must be a Quote-value, got ${actualType.name}`);

// `::conduit[[:p1 :p2] \`body-source\`]` — non-recursive
// `::conduit[:self [:p1 :p2] \`body-source\`]` — with self-name for recursion
async function conduitConstructor(payload, state) {
  if (!isVecShape(payload)) throw new ConduitPayloadNotVecError(payload);
  if (payload.length !== 2 && payload.length !== 3) {
    throw new ConduitArityInvalidError({ actualCount: payload.length });
  }
  let selfName = null;
  let params;
  let body;
  if (payload.length === 3) {
    selfName = payload[0];
    params = payload[1];
    body = payload[2];
    if (!isKeyword(selfName)) {
      throw new ConduitSelfNameNotKeywordError({ actualType: typeKeyword(selfName), actualValue: selfName });
    }
  } else {
    params = payload[0];
    body = payload[1];
  }
  if (!isVecShape(params)) {
    throw new ConduitParamsNotVecError({ actualType: typeKeyword(params), actualValue: params });
  }
  for (let i = 0; i < params.length; i++) {
    if (!isKeyword(params[i])) {
      throw new ConduitParamNotKeywordError({ index: i, actualType: typeKeyword(params[i]), actualValue: params[i] });
    }
  }
  if (!isQuote(body)) {
    throw new ConduitBodyNotQuoteError({ actualType: typeKeyword(body), actualValue: body });
  }
  const bodyAst = body.ast ?? parse(body.source, { uri: '::conduit/body' });
  return makeConduit(bodyAst, {
    name: selfName ? selfName.name : null,
    params: params.map(k => k.name),
    envRef: { env: state.env },
    docs: [],
    location: null
  });
}

bindTypeConstructor('conduit', conduitConstructor);

// ::qlang<...> / ::json<...> — pair of cross-domain converters.
// `::qlang` recursively converts a JSON-shape payload (plain
// object → qlang Map with keyword keys, plain array → qlang Vec)
// down through every nested level. `::json` does the inverse
// (qlang Map → JSON Object stamped with JSON_OBJECT_TAG, qlang
// Vec → JSON Array stamped with JSON_ARRAY_TAG). Scalars,
// keywords, sets, and errors pass through unchanged on both
// sides — the converter only touches the container shape.

function qlangFromJson(value) {
  if (isJsonObject(value)) {
    const m = new Map();
    for (const [k, v] of Object.entries(value)) {
      m.set(k, qlangFromJson(v));
    }
    return m;
  }
  if (Array.isArray(value)) {
    return value.map(qlangFromJson);
  }
  return value;
}

function jsonFromQlang(value) {
  if (isQMap(value)) {
    const obj = {};
    for (const [k, v] of value) {
      obj[k] = jsonFromQlang(v);
    }
    return makeJsonObject(obj);
  }
  if (Array.isArray(value)) {
    return makeJsonArray(value.map(jsonFromQlang));
  }
  return value;
}

bindTypeConstructor('qlang', (payload) => qlangFromJson(payload));
bindTypeConstructor('json',  (payload) => jsonFromQlang(payload));

// `::builtin{…fields…}` — catalog descriptor constructor.
// Every operand BindStep in `core/lib/qlang/operand/<family>.qlang`
// declares its body as `::builtin{:impl :qlang/prim/<name>
// :category … :subject … :modifiers … :returns … :throws …}`;
// every error tag declares its body as `::builtin{:category
// :typeError :operand …}` (no `:impl`). The catalog reader and
// the bootstrap fill loop in `runtime/index.mjs` address the
// stamped fields directly through `descriptor.get(<field>)`, so
// `::builtin` flattens the payload Map into a descriptor Map
// carrying every payload entry at the top level. Identity rides
// on the Map JS-header TAG_HEADER_SYMBOL slot — same pattern as
// Conduit / Snapshot / TaggedInstance, with the catalog reader
// sites (`isBuiltinDescriptor`, `runtime/use-op.mjs` snapshot-
// unwrap, `manifest-op.mjs::describeBinding`) probing the header
// directly. The dedicated constructor keeps catalog descriptors
// outside the generic TaggedInstance render path so manifest
// surfaces stay readable as plain field Maps.
import { BUILTIN_TAG, stampTagHeader } from '../types.mjs';

function builtinConstructor(payload) {
  // Catalog declarations always pass a Map payload — every
  // `::builtin{…fields…}` literal in `core/lib/qlang/**` writes
  // a keyword-keyed body. The explicit Map check guards user-
  // site invocations (`::builtin"hello"`, `::builtin[1 2 3]`)
  // that would otherwise destructure-iterate a String into
  // single-character keys or a Vec into index/value pairs and
  // mint a garbage descriptor.
  if (!isQMap(payload)) throw new BuiltinPayloadNotMapError(payload);
  const descriptor = new Map();
  for (const [k, v] of payload) descriptor.set(k, v);
  stampTagHeader(descriptor, BUILTIN_TAG);
  return descriptor;
}

bindTypeConstructor('builtin', builtinConstructor);

// `qlang` value-namespace operand — subject-form converter.
//
//   {"a": 1} | qlang      → {:a 1}        (JsonObject → qlang Map)
//   [1, 2, 3] | qlang     → [1 2 3]       (JsonArray → qlang Vec)
//   {:a 1} | qlang        → {:a 1}        (idempotent on qlang shape)
//   42 | qlang            → 42            (scalar unchanged)
//
// Recurses through nested containers so a JsonObject-of-JsonArrays
// lifts fully into a qlang-Map-of-qlang-Vecs in one step. The
// `::qlang<payload>` TaggedLit constructor shares this impl as
// `qlang/type/qlang` — `qlang` operand is the pipeline-time pendant.

export const qlangOperand = nullaryOp('qlang', (subject) => qlangFromJson(subject));

bindPrim('qlang', qlangOperand);

// ── tag / payload — TaggedInstance split/assemble pair ──────
//
// After Phase 3 the default `::Tag<payload>` constructor always
// wraps: the payload value rides as-is on the instance's
// `:payload` slot, identity sits on the Map JS-header. These two
// operands give user code a clean way to deconstruct the wrap
// (`payload`) and to mint a new TaggedInstance at runtime from a
// value + tag pair (`tag(::Foo)`). Both ride the
// `:typeConversion` family alongside `keyword` / `qlang` / `json`.
//
// `tagged | payload` — strip identity, return the underlying
// data plane. Composite-shape returns a fresh clone of the
// payload without the header (the result re-enters the
// untagged value-class surface, ready to be re-tagged through
// `tag(::Other)`); wrap-object shape returns the `.payload`
// value directly. Inverse of every `tag(::Foo)` mint and the
// natural «open the envelope» step for tagged-value workflow.
//
// `tag` mints `TaggedInstance` from a value plus a TagKeyword.
// Three arities through overloadedOp form a symmetric partner
// for `[type, payload]` split:
//
//   bare  — subject is a `[tag, value]` 2-element Vec (the
//     shape `[type payload]` projects from any tagged value).
//     Unpacks the pair and routes through `makeTaggedInstance`.
//     Round-trip pair: `tagged | [type payload] | tag` yields
//     the same TaggedInstance for composite-shape payloads;
//     wrap-shape payloads with already-tagged inner content
//     fold through the makeTaggedInstance wrap branch.
//
//   bound — `value | tag(::Foo)`. Subject is any pipeValue,
//     captured arg is the TagKeyword. The everyday partial-
//     application form.
//
//   full  — `tag(value-expr, tag-expr)`. Both args captured,
//     pipeValue is context for both — lets compact rebuild
//     patterns like `pair | tag(/1, /0)` reorder elements of
//     a positional Vec into the operand's value-then-tag
//     order without an intermediate `as` snapshot.

const PayloadSubjectNotTaggedInstanceError = declareSubjectError(
  'PayloadSubjectNotTaggedInstanceError', 'payload', 'taggedInstance');
const TagModifierNotTagKeywordError = declareModifierError(
  'TagModifierNotTagKeywordError', 'tag', 2, 'tagKeyword');
const TagBareSubjectShapeError = declareShapeError('TagBareSubjectShapeError',
  ({ actualType, actualLength }) =>
    actualLength === undefined
      ? `tag (bare form) requires a 2-element Vec [tagKeyword, value] subject, got ${actualType.name}`
      : `tag (bare form) requires a 2-element Vec [tagKeyword, value] subject, got Vec of length ${actualLength}`);

export const payloadOperand = nullaryOp('payload', (subject) => {
  if (!isTaggedInstance(subject)) {
    throw new PayloadSubjectNotTaggedInstanceError(subject);
  }
  // Composite-shape — fresh clone without the TaggedInstance
  // header. JsonArray composite restamps `JSON_ARRAY_TAG` on
  // the clone (a plain `[...subject]` spread would drop the
  // JSON-shape signal alongside the TaggedInstance header);
  // every other Array clone yields a plain Vec.
  if (Array.isArray(subject)) {
    return isJsonArray(subject) ? makeJsonArray([...subject]) : Object.freeze([...subject]);
  }
  if (subject instanceof Set) return new Set(subject);
  if (subject instanceof Map) return new Map(subject);
  // Opaque wrap object — return the wrapped value directly.
  return subject.payload;
});

function makeTaggedFromKw(value, tagKw) {
  if (!isTagKeyword(tagKw)) throw new TagModifierNotTagKeywordError(tagKw);
  return makeTaggedInstance(tagKw, value);
}

export const tagOperand = overloadedOp('tag', 2, {
  0: (subject) => {
    if (!isVecShape(subject) || subject.length !== 2) {
      throw new TagBareSubjectShapeError({
        actualType: typeKeyword(subject),
        actualValue: subject,
        actualLength: isVecShape(subject) ? subject.length : undefined
      });
    }
    return makeTaggedFromKw(subject[1], subject[0]);
  },
  1: async (subject, tagKwLambda) => {
    const tagKw = await tagKwLambda(subject);
    if (isErrorValue(tagKw)) return tagKw;
    return makeTaggedFromKw(subject, tagKw);
  },
  2: async (ctx, valLambda, tagKwLambda) => {
    const val = await valLambda(ctx);
    if (isErrorValue(val)) return val;
    const tagKw = await tagKwLambda(ctx);
    if (isErrorValue(tagKw)) return tagKw;
    return makeTaggedFromKw(val, tagKw);
  }
});

bindPrim('payload', payloadOperand);
bindPrim('tag',     tagOperand);
