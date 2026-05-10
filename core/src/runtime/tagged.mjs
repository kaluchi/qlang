// Tagged-type constructors. Each constructor is a function
// `(payload, state) → value` registered into PRIMITIVE_REGISTRY
// under `qlang/prim/<tag>`. evalTaggedLit looks up the type
// binding's :qlang/impl, resolves it to one of these functions,
// and invokes it against the payload-value.
//
// State is passed through so constructors that need a reference to
// the outer env (notably ::conduit, which captures lexical scope
// for body invocation) can pick it up directly.

import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import {
  isVec, isKeyword, isQuote, isQMap, isJsonObject,
  makeConduit, makeJsonObject, makeJsonArray, typeKeyword
} from '../types.mjs';
import { parse } from '../parse.mjs';
import { declareSubjectError, declareShapeError, declareArityError } from '../operand-errors.mjs';

const ConduitPayloadNotVec = declareSubjectError('ConduitPayloadNotVec', '::conduit', 'Vec');
const ConduitArityInvalid = declareArityError('ConduitArityInvalid',
  ({ actualCount }) => `::conduit payload must be a Vec of 2 ([params, body]) or 3 ([self, params, body]) elements, got ${actualCount}`);
const ConduitSelfNameNotKeyword = declareShapeError('ConduitSelfNameNotKeyword',
  ({ actualType }) => `::conduit self-name must be a Keyword, got ${actualType.name}`);
const ConduitParamsNotVec = declareShapeError('ConduitParamsNotVec',
  ({ actualType }) => `::conduit params must be a Vec of Keywords, got ${actualType.name}`);
const ConduitParamNotKeyword = declareShapeError('ConduitParamNotKeyword',
  ({ index, actualType }) => `::conduit params[${index}] must be a Keyword, got ${actualType.name}`);
const ConduitBodyNotQuote = declareShapeError('ConduitBodyNotQuote',
  ({ actualType }) => `::conduit body must be a Quote-value, got ${actualType.name}`);

// `::conduit[[:p1 :p2] \`body-source\`]` — non-recursive
// `::conduit[:self [:p1 :p2] \`body-source\`]` — with self-name for recursion
async function conduitConstructor(payload, state) {
  if (!isVec(payload)) throw new ConduitPayloadNotVec(payload);
  if (payload.length !== 2 && payload.length !== 3) {
    throw new ConduitArityInvalid({ actualCount: payload.length });
  }
  let selfName = null;
  let params;
  let body;
  if (payload.length === 3) {
    selfName = payload[0];
    params = payload[1];
    body = payload[2];
    if (!isKeyword(selfName)) {
      throw new ConduitSelfNameNotKeyword({ actualType: typeKeyword(selfName), actualValue: selfName });
    }
  } else {
    params = payload[0];
    body = payload[1];
  }
  if (!isVec(params)) {
    throw new ConduitParamsNotVec({ actualType: typeKeyword(params), actualValue: params });
  }
  for (let i = 0; i < params.length; i++) {
    if (!isKeyword(params[i])) {
      throw new ConduitParamNotKeyword({ index: i, actualType: typeKeyword(params[i]), actualValue: params[i] });
    }
  }
  if (!isQuote(body)) {
    throw new ConduitBodyNotQuote({ actualType: typeKeyword(body), actualValue: body });
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

PRIMITIVE_REGISTRY.bind('qlang/type/conduit', conduitConstructor);

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

PRIMITIVE_REGISTRY.bind('qlang/type/qlang', (payload) => qlangFromJson(payload));
PRIMITIVE_REGISTRY.bind('qlang/type/json',  (payload) => jsonFromQlang(payload));

// ::assertion[`snippet` `expected`] — Doc-content segment that
// records an evaluable example. runExamples filters Doc :segments
// for these, evaluates the :snippet Quote, and compares against
// the :expected Quote's evaluated value.
import { makeTagKeyword } from '../types.mjs';

const AssertionPayloadNotVec = declareSubjectError('AssertionPayloadNotVec', '::assertion', 'Vec');
const AssertionArityInvalid = declareArityError('AssertionArityInvalid',
  ({ actualCount }) => `::assertion payload must be a Vec of 2 Quote-values [snippet expected], got ${actualCount}`);
const AssertionSnippetNotQuote = declareShapeError('AssertionSnippetNotQuote',
  ({ actualType }) => `::assertion[snippet ...] — snippet must be a Quote-value, got ${actualType.name}`);
const AssertionExpectedNotQuote = declareShapeError('AssertionExpectedNotQuote',
  ({ actualType }) => `::assertion[... expected] — expected must be a Quote-value, got ${actualType.name}`);

function assertionConstructor(payload) {
  if (!isVec(payload)) throw new AssertionPayloadNotVec(payload);
  if (payload.length !== 2) {
    throw new AssertionArityInvalid({ actualCount: payload.length });
  }
  const [snippet, expected] = payload;
  if (!isQuote(snippet)) {
    throw new AssertionSnippetNotQuote({ actualType: typeKeyword(snippet), actualValue: snippet });
  }
  if (!isQuote(expected)) {
    throw new AssertionExpectedNotQuote({ actualType: typeKeyword(expected), actualValue: expected });
  }
  const m = new Map();
  m.set('qlang/kind', makeTagKeyword('assertion'));
  m.set('qlang/payload', payload);
  m.set('snippet', snippet);
  m.set('expected', expected);
  return Object.freeze(m);
}

PRIMITIVE_REGISTRY.bind('qlang/type/assertion', assertionConstructor);
