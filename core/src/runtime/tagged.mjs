// Tagged-type constructors. Each constructor is a function
// `(payload, state) → value` registered into PRIMITIVE_REGISTRY
// under `qlang/type/<tag>`. evalTaggedLit looks up the type
// binding's :impl, resolves it to one of these functions,
// and invokes it against the payload-value; the state reaches a
// constructor that reads the scope it is called in.

import { nullaryOp, stateOp, stateOpVariadic, mintUnderTag } from './dispatch.mjs';
import { bindPrim, bindTypeConstructor } from '../primitives.mjs';
import { withPipeValue, nestState } from '../state.mjs';
import { evalAst } from '../eval.mjs';
import {
  isVec, isKeyword, isQuote, isQMap, isNull, isBoolean, isNumber, isString, isDoc,
  isTaggedInstance, isTagKeyword, isErrorValue, isVerb, envToRun,
  makeSet, typeKeyword, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { astOfQuote } from '../quote.mjs';
import { callVerb } from './verb.mjs';
import {
  declareSubjectError,
  declareModifierError
} from '../operand-errors.mjs';
import { declareShapeError } from '../errors.mjs';

// `::set[…]` — the set of a vector's elements, the one `distinct`
// mints [D16], so `::set[3 1 3]`, `#[3 1 3]` and `[3 1 3] | distinct`
// are one value.
const SetPayloadNotVecError = declareSubjectError('SetPayloadNotVecError', '::set', 'vec');

function setConstructor(payload) {
  if (!isVec(payload)) throw new SetPayloadNotVecError(payload);
  return makeSet(payload);
}

bindTypeConstructor('set', setConstructor);

// The constructors of the core's kinds [D32, D33]: each reads its
// payload as the value of its kind, so `::vec[1 2]`, `::qlang/vec[1 2]`
// and `[1 2]` are one value and print as the last, and a payload of
// another kind is refused at the site. A vector or a map under a tag of
// its own reads as the bare one.
const NullPayloadNotNullError       = declareSubjectError('NullPayloadNotNullError',       '::null',    'null');
const BooleanPayloadNotBooleanError = declareSubjectError('BooleanPayloadNotBooleanError', '::boolean', 'boolean');
const NumberPayloadNotNumberError   = declareSubjectError('NumberPayloadNotNumberError',   '::number',  'number');
const StringPayloadNotStringError   = declareSubjectError('StringPayloadNotStringError',   '::string',  'string');
const KeywordPayloadNotKeywordError = declareSubjectError('KeywordPayloadNotKeywordError', '::keyword', 'keyword');
const TagPayloadNotTagError         = declareSubjectError('TagPayloadNotTagError',         '::tag',     'tag');
const VecPayloadNotVecError         = declareSubjectError('VecPayloadNotVecError',         '::vec',     'vec');
const MapPayloadNotMapError         = declareSubjectError('MapPayloadNotMapError',         '::map',     'map');
const DocPayloadNotDocError         = declareSubjectError('DocPayloadNotDocError',         '::doc',     'doc');

function coreKindConstructor(isOfKind, ErrorCls, bareValueOf = payload => payload) {
  return payload => {
    if (!isOfKind(payload)) throw new ErrorCls(payload);
    return bareValueOf(payload);
  };
}

const bareVecOf = vec => vec[TAG_HEADER_SYMBOL] === undefined ? vec : Object.freeze([...vec]);
const bareMapOf = map => map[TAG_HEADER_SYMBOL] === undefined ? map : new Map(map);

bindTypeConstructor('null',    coreKindConstructor(isNull, NullPayloadNotNullError));
bindTypeConstructor('boolean', coreKindConstructor(isBoolean, BooleanPayloadNotBooleanError));
bindTypeConstructor('number',  coreKindConstructor(isNumber, NumberPayloadNotNumberError));
bindTypeConstructor('string',  coreKindConstructor(isString, StringPayloadNotStringError));
bindTypeConstructor('keyword', coreKindConstructor(isKeyword, KeywordPayloadNotKeywordError));
bindTypeConstructor('tag',     coreKindConstructor(isTagKeyword, TagPayloadNotTagError));
bindTypeConstructor('vec',     coreKindConstructor(isVec, VecPayloadNotVecError, bareVecOf));
bindTypeConstructor('map',     coreKindConstructor(isQMap, MapPayloadNotMapError, bareMapOf));
bindTypeConstructor('doc',     coreKindConstructor(isDoc, DocPayloadNotDocError));

// `::builtin{…fields…}` — catalog descriptor constructor.
// Every operand BindStep in `core/lib/qlang/operand/<family>.qlang`
// declares its body as `::builtin{:impl :qlang/prim/<name>
// :category … :subject … :modifiers … :returns …}`;
// an error tag declares prose and `~(…)` examples alone, and
// `buildLangRuntime` stamps its `:category` / `:operand` /
// `:position` / `:expectedType` from the spec the factory recorded
// at the throw site. The catalog reader and
// the bootstrap fill loop in `runtime/index.mjs` address the
// stamped fields directly through `descriptor.get(<field>)`, so
// `::builtin` flattens the payload Map into a descriptor Map
// carrying every payload entry at the top level. Identity rides
// on the Map JS-header TAG_HEADER_SYMBOL slot — same pattern as the
// binding record and the TaggedInstance, with the catalog
// reader sites (`isBuiltinDescriptor`, the stamp passes of
// `runtime/use-op.mjs` and `runtime/index.mjs`) probing the header
// directly. The dedicated constructor keeps catalog descriptors
// outside the generic TaggedInstance render path so manifest
// surfaces stay readable as plain field Maps.
import { BUILTIN_TAG, stampTagHeader } from '../types.mjs';

const BuiltinPayloadNotMapError = declareSubjectError('BuiltinPayloadNotMapError', '::builtin', 'map');

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

// ── tag / payload — TaggedInstance split/assemble pair ──────
//
// `tag ::Foo` mints the value under the tag: through the tag's
// constructor when its binding carries one, so a wrong assembly is
// refused where it is made; as a bare overlay otherwise, through
// `makeTaggedInstance` — composite payloads (Vec / Map) clone
// with the TagKeyword stamped on the JS-header slot,
// leaving the data plane intact; non-extensible payloads (scalar,
// Keyword, Doc, Error, already-tagged composite)
// ride an opaque frozen `{type, tag, payload}` wrapper. `payload`
// reverses each shape. Both operands ride the `:typeConversion`
// family alongside `keyword`.
//
// `tagged | payload` — strip identity, return the underlying
// data plane. Composite-shape returns a fresh clone of the
// payload without the header (the result re-enters the
// untagged value-class surface, ready to be re-tagged through
// `tag ::Other`); wrap-object shape returns the `.payload`
// value directly. Inverse of every `tag ::Foo` mint and the
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
//   bound — `value | tag ::Foo`. Subject is any pipeValue,
//     captured arg is the TagKeyword. The everyday partial-
//     application form.
//
//   full  — `tag value-expr tag-expr`. Both args captured,
//     pipeValue is context for both — lets compact rebuild
//     patterns like `pair | tag /1 /0` reorder elements of
//     a positional Vec into the operand's value-then-tag
//     order without an intermediate binding.

const PayloadSubjectNotTaggedInstanceError = declareSubjectError(
  'PayloadSubjectNotTaggedInstanceError', 'payload', 'taggedInstance');
const TagModifierNotTagKeywordError = declareModifierError(
  'TagModifierNotTagKeywordError', 'tag', 2, 'tagKeyword');
const TagBareSubjectShapeError = declareShapeError('TagBareSubjectShapeError',
  ({ actualType, actualLength }) =>
    actualLength === undefined
      ? `tag (bare form) requires a 2-element Vec [tagKeyword, value] subject, got ${actualType.name}`
      : `tag (bare form) requires a 2-element Vec [tagKeyword, value] subject, got Vec of length ${actualLength}`,
  { operand: 'tag', position: 'subject', expectedType: 'vec' }
);

// Composite-shape — fresh clone without the TaggedInstance header;
// a set's payload is its vector. Opaque wrap object — the wrapped
// value directly.
function payloadOf(tagged) {
  if (Array.isArray(tagged)) return Object.freeze([...tagged]);
  if (tagged instanceof Map) return new Map(tagged);
  return tagged.payload;
}

export const payloadOperand = nullaryOp('payload', (subject) => {
  if (!isTaggedInstance(subject)) {
    throw new PayloadSubjectNotTaggedInstanceError(subject);
  }
  return payloadOf(subject);
});

// The value and the tag each form reads before the tag mints: a
// modifier that answers an error answers the step with it.
async function tagPartsOf(subject, tagLambdas) {
  if (tagLambdas.length === 0) {
    if (!isVec(subject) || subject.length !== 2) {
      throw new TagBareSubjectShapeError({
        actualType: typeKeyword(subject),
        actualValue: subject,
        actualLength: isVec(subject) ? subject.length : undefined
      });
    }
    return { value: subject[1], tagKw: subject[0] };
  }
  const value = tagLambdas.length === 2 ? await tagLambdas[0](subject) : subject;
  if (isErrorValue(value)) return { failed: value };
  const tagKw = await tagLambdas[tagLambdas.length - 1](subject);
  if (isErrorValue(tagKw)) return { failed: tagKw };
  return { value, tagKw };
}

export const tagOperand = stateOpVariadic('tag', async (state, tagLambdas) => {
  const { value, tagKw, failed } = await tagPartsOf(state.pipeValue, tagLambdas);
  if (failed !== undefined) return withPipeValue(state, failed);
  if (!isTagKeyword(tagKw)) throw new TagModifierNotTagKeywordError(tagKw);
  return withPipeValue(state, await mintUnderTag(state, tagKw, value));
}, [0, 2]);

// `tagged | within code` — an edit under one tag [D41]: the payload
// runs through the quote as `apply` runs it, a fork whose declarations
// stay inside, and the answer mints back under the subject's tag,
// whose constructor runs once, at the rewrap. The steps between may
// break the tag's invariant, since an invariant holds of the result;
// an error the edit answers passes as it is; a deeper stack of tags is
// reached by nesting.
const WithinSubjectNotTaggedInstanceError = declareSubjectError(
  'WithinSubjectNotTaggedInstanceError', 'within', 'taggedInstance');
const WithinCodeNotQuoteError = declareModifierError(
  'WithinCodeNotQuoteError', 'within', 2, 'quote');

export const withinOperand = stateOp('within', 2, async (state, withinLambdas) => {
  const subject = state.pipeValue;
  if (!isTaggedInstance(subject)) throw new WithinSubjectNotTaggedInstanceError(subject);
  const code = await withinLambdas[0](subject);
  if (isErrorValue(code)) return withPipeValue(state, code);
  const edited = await editOf(code, payloadOf(subject), state);
  if (isErrorValue(edited)) return withPipeValue(state, edited);
  return withPipeValue(state, await mintUnderTag(state, typeKeyword(subject), edited));
});

// The payload run through the code, a quote in the environment it
// carries [D43] or a verb with its defaults [D67].
async function editOf(code, payload, state) {
  if (isVerb(code)) return await callVerb(code, [], withPipeValue(state, payload), null);
  if (!isQuote(code)) throw new WithinCodeNotQuoteError(code);
  return (await evalAst(astOfQuote(code), nestState(state, payload, envToRun(code, state.env)))).pipeValue;
}

bindPrim('payload', payloadOperand);
bindPrim('tag',     tagOperand);
bindPrim('within',  withinOperand);
