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

import { nullaryOp } from './dispatch.mjs';
import { bindPrim, bindTypeConstructor } from '../primitives.mjs';
import {
  isVecShape, isKeyword, isQuote, isQMap, isJsonObject,
  makeConduit, makeJsonObject, makeJsonArray, typeKeyword
} from '../types.mjs';
import { parse } from '../parse.mjs';
import { declareSubjectError, declareShapeError, declareArityError } from '../operand-errors.mjs';

const ConduitPayloadNotVecError = declareSubjectError('ConduitPayloadNotVecError', '::conduit', 'vec');
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
