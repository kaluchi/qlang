// Tagged-type constructors. Each constructor is a function
// `(payload, state) → value` registered into PRIMITIVE_REGISTRY
// under `qlang/type/<tag>`. evalTaggedLit looks up the type
// binding's :impl, resolves it to one of these functions,
// and invokes it against the payload-value; the state reaches a
// constructor that reads the scope it is called in.

import { mintUnderTag } from './dispatch.mjs';
import { bindPrim, bindStateReader, bindTypeConstructor } from '../primitives.mjs';
import {
  isVec, isKeyword, isQMap, isNull, isBoolean, isNumber, isString, isDoc,
  isTagKeyword, makeSet, typeKeyword, TAG_HEADER_SYMBOL
} from '../types.mjs';
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
// `tag` mints `TaggedInstance` from a value plus a TagKeyword, the
// symmetric partner of the `[type, payload]` split: the pair
// `[tag, value]` it takes apart without a name, `tagged | [type
// payload] | tag` yielding the same value for composite payloads.

declareSubjectError('PayloadSubjectNotTaggedInstanceError', 'payload', 'taggedInstance');
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

// `payload` and `within` reside on `::tagged`, each a plain function
// over the tagged value the head of its verb checked [D72], [D78];
// `within` returns its subject's kind, so the answer of its edit mints
// back under the subject's tag [D41], [D67].
bindPrim('payload', subject => payloadOf(subject));
bindPrim('within', async (subject, code) => await code(payloadOf(subject)));

// `tag` resides on `::qlang/any` and reads the state of its call, whose
// scope holds the constructor of the tag [D79]: `value | tag ::Foo` lays
// the tag over the subject, `tag value ::Foo` over its first modifier,
// the full application [D72], and `[::Foo value] | tag` over the second
// element of the pair it takes apart.
async function mintPair(pair, state) {
  if (!isVec(pair) || pair.length !== 2) {
    throw new TagBareSubjectShapeError({
      actualType: typeKeyword(pair),
      actualValue: pair,
      actualLength: isVec(pair) ? pair.length : undefined
    });
  }
  const [pairTag, value] = pair;
  if (!isTagKeyword(pairTag)) throw new TagModifierNotTagKeywordError(pairTag);
  return await mintUnderTag(state, pairTag, value);
}

bindStateReader('tag', async (subject, tagName, state) =>
  (isNull(tagName) ? await mintPair(subject, state) : await mintUnderTag(state, tagName, subject)));

declareSubjectError('WithinSubjectNotTaggedInstanceError', 'within', 'taggedInstance');
declareModifierError('WithinCodeNotQuoteError', 'within', 2, 'quote');

