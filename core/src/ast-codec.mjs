// Bidirectional AST ↔ qlang-Map codec — encodes every parser-produced
// AST node type into a frozen Map keyed under `:qlang/kind :<NodeType>`
// plus its type-specific payload, and decodes back without loss.
//
// The codec is the data layer behind several upstream features:
//   - Structured error `:trail` — each deflect stamps the upcoming
//     step's AST-Map onto the error's trail Vec so user code can
//     filter / group / inspect deflections as qlang data.
//   - `parse` / `eval` reflective operands — `"query" | parse` lifts
//     source text into an AST-Map; `ast-map | eval` re-enters
//     evaluation against the current state. Closes the source → data
//     → exec ring that makes `| parse | eval` a first-class
//     combinator.
//   - Conduit body inspection — `reify(:helper) | /body` exposes a
//     user-defined conduit's body as an AST-Map for programmatic
//     navigation or editor tooling.
//
// Round-trip invariant: `qlangMapToAst(astNodeToMap(n))` is
// structurally equal to `n` for any AST produced by `parse()`,
// modulo the post-parse decoration (`.id`, `.parent`) and the
// root-level metadata (`.source`, `.uri`, `.parseId`, `.parsedAt`,
// `.schemaVersion`) that `parse.mjs` stamps after tree construction.
// Both halves of the invariant are pinned by
// `core/test/unit/ast-codec.test.mjs`.
//
// Field layout for every AST-Map kind:
//
//   NumberLit         :value <number>
//   StringLit         :value <string>
//   BooleanLit        :value <boolean>
//   NullLit            (no payload beyond discriminator)
//   Keyword           :name <string>
//   Projection        :keys <Vec of strings> [:effectful <bool>]
//   VecLit / SetLit   :elements <Vec of AST-Maps>
//   MapLit / ErrorLit :entries <Vec of MapEntry AST-Maps>
//   MapEntry          :key <Keyword AST-Map> :value <AST-Map>
//   OperandCall       :name <string> :args <Vec of AST-Maps | null>
//                     [:docs <Vec of strings>] [:effectful <bool>]
//   ParenGroup        :pipeline <Pipeline AST-Map>
//   Pipeline          :steps <Vec of PipelineStep Maps>
//                     :leadingCombinator <"!|" | "|" | "*" | ">>" | null>
//   PipelineStep      :combinator <string | null>  :step <AST-Map>
//                     (wrapper inside Pipeline.steps — head carries
//                     null combinator, rest carry "|", "!|", "*",
//                     or ">>")
//   DocLit            :content <string>
//   TaggedLit         :tag <string> :payload <AST-Map>
//   BareTypeKeyword   :tag <string>
//   LinePlainComment  :content <string>
//   BlockPlainComment :content <string>
//   LineDocComment    :content <string>
//   BlockDocComment   :content <string>
//
// Every AST-Map additionally carries :text and :location when the
// originating node carried them (always the case for parser-produced
// nodes).

import { isQMap, keyword } from './types.mjs';
import { QlangError } from './errors.mjs';

// Interned keyword constants for the AST-Map field namespace. The
// discriminator lives under :qlang/kind so user-level Map fields do
// not collide; payload fields use unnamespaced keywords because they
// are addressable via `ast | /name`, `ast | /args`, and so on, the
// same way any other qlang Map field is addressed.
const F_QLANG_KIND   = 'qlang/kind';
const F_VALUE        = 'value';
const F_NAME         = 'name';
const F_KEYS         = 'keys';
const F_ELEMENTS     = 'elements';
const F_ENTRIES      = 'entries';
const F_KEY          = 'key';
const F_ARGS         = 'args';
const F_DOCS         = 'docs';
const F_CONTENT      = 'content';
const F_SRC          = 'src';
const F_PIPELINE     = 'pipeline';
const F_STEPS        = 'steps';
const F_LEADING_COMBINATOR = 'leadingCombinator';
const F_COMBINATOR   = 'combinator';
const F_STEP         = 'step';
const F_EFFECTFUL    = 'effectful';
const F_TEXT         = 'text';
const F_LOCATION     = 'location';

const F_START  = 'start';
const F_END    = 'end';
const F_OFFSET = 'offset';
const F_LINE   = 'line';
const F_COLUMN = 'column';

const KIND_NUMBER_LIT          = keyword('NumberLit');
const KIND_STRING_LIT          = keyword('StringLit');
const KIND_BOOLEAN_LIT         = keyword('BooleanLit');
const KIND_NULL_LIT            = keyword('NullLit');
const KIND_KEYWORD             = keyword('Keyword');
const KIND_PROJECTION          = keyword('Projection');
const KIND_VEC_LIT             = keyword('VecLit');
const KIND_JSON_ARRAY_LIT      = keyword('JsonArrayLit');
const KIND_SET_LIT             = keyword('SetLit');
const KIND_MAP_LIT             = keyword('MapLit');
const KIND_JSON_OBJECT_LIT     = keyword('JsonObjectLit');
const KIND_ERROR_LIT           = keyword('ErrorLit');
const KIND_QUOTE_LIT           = keyword('QuoteLit');
const KIND_DOC_LIT             = keyword('DocLit');
const KIND_TAGGED_LIT          = keyword('TaggedLit');
const KIND_BARE_TYPE_KEYWORD   = keyword('BareTypeKeyword');
const KIND_MAP_ENTRY           = keyword('MapEntry');
const KIND_OPERAND_CALL        = keyword('OperandCall');
const KIND_BIND_STEP           = keyword('BindStep');
const KIND_PAREN_GROUP         = keyword('ParenGroup');
const KIND_PIPELINE            = keyword('Pipeline');
const KIND_PIPELINE_STEP       = keyword('PipelineStep');
const KIND_LINE_PLAIN_COMMENT  = keyword('LinePlainComment');
const KIND_BLOCK_PLAIN_COMMENT = keyword('BlockPlainComment');
const KIND_LINE_DOC_COMMENT    = keyword('LineDocComment');
const KIND_BLOCK_DOC_COMMENT   = keyword('BlockDocComment');

// Reverse lookup: discriminator keyword → AST type string. Used by
// qlangMapToAst to reconstruct the `.type` field when walking the Map
// form back into JS-object AST nodes.
const AST_KIND_TO_TYPE = new Map([
  ['NumberLit',          'NumberLit'],
  ['StringLit',          'StringLit'],
  ['BooleanLit',         'BooleanLit'],
  ['NullLit',            'NullLit'],
  ['Keyword',            'Keyword'],
  ['Projection',         'Projection'],
  ['VecLit',             'VecLit'],
  ['JsonArrayLit',       'JsonArrayLit'],
  ['SetLit',             'SetLit'],
  ['MapLit',             'MapLit'],
  ['JsonObjectLit',      'JsonObjectLit'],
  ['ErrorLit',           'ErrorLit'],
  ['QuoteLit',           'QuoteLit'],
  ['DocLit',             'DocLit'],
  ['TaggedLit',          'TaggedLit'],
  ['BareTypeKeyword',    'BareTypeKeyword'],
  ['MapEntry',           'MapEntry'],
  ['OperandCall',        'OperandCall'],
  ['BindStep',           'BindStep'],
  ['ParenGroup',         'ParenGroup'],
  ['Pipeline',           'Pipeline'],
  ['LinePlainComment',   'LinePlainComment'],
  ['BlockPlainComment',  'BlockPlainComment'],
  ['LineDocComment',     'LineDocComment'],
  ['BlockDocComment',    'BlockDocComment']
]);

// Per-site error classes for the codec. Each throw site has its own
// class with fingerprint and structured context, matching the runtime
// convention for operand errors. They extend QlangError so the
// evalNode try/catch in eval.mjs can lift them to error values when
// the `parse` / `eval` reflective operands surface them to user
// pipelines.
class AstNodeTypeUnknownError extends QlangError {
  constructor(nodeType) {
    super(`astNodeToMap: unknown AST node type '${nodeType}'`, 'ast-codec-error');
    this.name = 'AstNodeTypeUnknownError';
    this.fingerprint = 'AstNodeTypeUnknownError';
    this.context = { nodeType };
  }
}

class AstMapMalformedError extends QlangError {
  constructor(reason) {
    super(`qlangMapToAst: malformed AST-Map — ${reason}`, 'ast-codec-error');
    this.name = 'AstMapMalformedError';
    this.fingerprint = 'AstMapMalformedError';
    this.context = { reason };
  }
}

class AstMapKindUnknownError extends QlangError {
  constructor(kindName) {
    super(`qlangMapToAst: unknown :qlang/kind '${kindName}'`, 'ast-codec-error');
    this.name = 'AstMapKindUnknownError';
    this.fingerprint = 'AstMapKindUnknownError';
    this.context = { kindName };
  }
}

// Frozen Map builder for a peggy position triple.
function positionToQlangMap(pos) {
  const m = new Map();
  m.set(F_OFFSET, pos.offset);
  m.set(F_LINE, pos.line);
  m.set(F_COLUMN, pos.column);
  return Object.freeze(m);
}

function positionFromQlangMap(map) {
  return {
    offset: map.get(F_OFFSET),
    line: map.get(F_LINE),
    column: map.get(F_COLUMN)
  };
}

export function locationToQlangMap(loc) {
  if (!loc) return null;
  const m = new Map();
  if (loc.start) m.set(F_START, positionToQlangMap(loc.start));
  if (loc.end)   m.set(F_END,   positionToQlangMap(loc.end));
  return Object.freeze(m);
}

function locationFromQlangMap(map) {
  if (!isQMap(map)) return null;
  const loc = {};
  if (map.has(F_START)) loc.start = positionFromQlangMap(map.get(F_START));
  if (map.has(F_END))   loc.end   = positionFromQlangMap(map.get(F_END));
  return loc;
}

// Stamp :text and :location on an AST-Map under construction. Every
// parser-produced node carries both, so the stamp is factored into a
// `stampCommonFields`, called at the tail of each per-type branch.
function stampCommonFields(target, node) {
  if (node.text !== undefined)     target.set(F_TEXT, node.text);
  if (node.location !== undefined) target.set(F_LOCATION, locationToQlangMap(node.location));
}

// astNodeToMap(node) → frozen qlang Map (or null for null / non-AST
// input).
//
// Converts a JS-object AST node into a frozen Map carrying :qlang/kind
// plus type-specific payload fields. Nested child nodes recurse into
// their own Maps; collections of children become frozen Vecs.
//
// Non-AST values (null, scalars, objects without `.type`) return null,
// matching the defensive shape of astChildrenOf above — callers that
// walk arbitrary trees receive a stable signal.
// A node whose `.type` is one of the unknown kinds throws
// AstNodeTypeUnknownError — a runtime invariant violation that
// deserves a loud failure.
export function astNodeToMap(node) {
  if (node == null) return null;
  if (typeof node !== 'object' || !('type' in node)) return null;

  const m = new Map();

  switch (node.type) {
    case 'NumberLit':
      m.set(F_QLANG_KIND, KIND_NUMBER_LIT);
      m.set(F_VALUE, node.value);
      break;

    case 'StringLit':
      m.set(F_QLANG_KIND, KIND_STRING_LIT);
      m.set(F_VALUE, node.value);
      break;

    case 'BooleanLit':
      m.set(F_QLANG_KIND, KIND_BOOLEAN_LIT);
      m.set(F_VALUE, node.value);
      break;

    case 'NullLit':
      m.set(F_QLANG_KIND, KIND_NULL_LIT);
      break;

    case 'Keyword':
      m.set(F_QLANG_KIND, KIND_KEYWORD);
      m.set(F_NAME, node.name);
      break;

    case 'Projection':
      m.set(F_QLANG_KIND, KIND_PROJECTION);
      m.set(F_KEYS, Object.freeze([...node.keys]));
      if (node.effectful !== undefined) m.set(F_EFFECTFUL, node.effectful);
      break;

    case 'VecLit':
      m.set(F_QLANG_KIND, KIND_VEC_LIT);
      m.set(F_ELEMENTS, Object.freeze(node.elements.map(astNodeToMap)));
      break;

    case 'JsonArrayLit':
      m.set(F_QLANG_KIND, KIND_JSON_ARRAY_LIT);
      m.set(F_ELEMENTS, Object.freeze(node.elements.map(astNodeToMap)));
      break;

    case 'SetLit':
      m.set(F_QLANG_KIND, KIND_SET_LIT);
      m.set(F_ELEMENTS, Object.freeze(node.elements.map(astNodeToMap)));
      break;

    case 'MapLit':
      m.set(F_QLANG_KIND, KIND_MAP_LIT);
      m.set(F_ENTRIES, Object.freeze(node.entries.map(astNodeToMap)));
      break;

    case 'JsonObjectLit':
      m.set(F_QLANG_KIND, KIND_JSON_OBJECT_LIT);
      m.set(F_ENTRIES, Object.freeze(node.entries.map(astNodeToMap)));
      break;

    case 'ErrorLit':
      m.set(F_QLANG_KIND, KIND_ERROR_LIT);
      m.set(F_ENTRIES, Object.freeze(node.entries.map(astNodeToMap)));
      break;

    case 'QuoteLit':
      m.set(F_QLANG_KIND, KIND_QUOTE_LIT);
      m.set(F_SRC, node.src);
      break;

    case 'DocLit':
      m.set(F_QLANG_KIND, KIND_DOC_LIT);
      m.set(F_CONTENT, node.content);
      break;

    case 'TaggedLit':
      m.set(F_QLANG_KIND, KIND_TAGGED_LIT);
      m.set('tag', node.tag);
      m.set('payload', astNodeToMap(node.payload));
      break;

    case 'BareTypeKeyword':
      m.set(F_QLANG_KIND, KIND_BARE_TYPE_KEYWORD);
      m.set('tag', node.tag);
      break;

    case 'MapEntry':
      m.set(F_QLANG_KIND, KIND_MAP_ENTRY);
      m.set(F_KEY,   astNodeToMap(node.key));
      m.set(F_VALUE, astNodeToMap(node.value));
      break;

    case 'OperandCall':
      m.set(F_QLANG_KIND, KIND_OPERAND_CALL);
      m.set(F_NAME, node.name);
      // args === null  → bare identifier (no parens)
      // args === []    → empty call site `f()`
      // args === [...] → one or more captured-arg expressions
      m.set(F_ARGS, node.args === null
        ? null
        : Object.freeze(node.args.map(astNodeToMap)));
      if (node.docs !== undefined)      m.set(F_DOCS, Object.freeze([...node.docs]));
      if (node.effectful !== undefined) m.set(F_EFFECTFUL, node.effectful);
      break;

    case 'BindStep':
      m.set(F_QLANG_KIND, KIND_BIND_STEP);
      m.set(F_KEY, astNodeToMap(node.key));
      // docs / params / body are nullable — each absent in some forms:
      //   :foo body                  → docs=null, params=null, body=AST
      //   :foo docs                  → docs=[...], params=null, body=null
      //   :foo docs body             → docs=[...], params=null, body=AST
      //   :foo [:p ...] body         → docs=null, params=[Keyword AST...], body=AST
      //   :foo docs [:p ...] body    → all three
      m.set(F_DOCS,   node.docs === null   ? null : Object.freeze([...node.docs]));
      m.set('params', node.params === null ? null : Object.freeze(node.params.map(astNodeToMap)));
      m.set('body',   node.body === null   ? null : astNodeToMap(node.body));
      break;

    case 'ParenGroup':
      m.set(F_QLANG_KIND, KIND_PAREN_GROUP);
      m.set(F_PIPELINE, astNodeToMap(node.pipeline));
      break;

    case 'Pipeline':
      m.set(F_QLANG_KIND, KIND_PIPELINE);
      m.set(F_STEPS, Object.freeze(node.steps.map(pipelineStepToMap)));
      // The grammar emits `leadingCombinator` only when an explicit
      // prefix was authored; absent it is undefined. The AST-Map
      // codec pins the field to `null` for that case so the round-
      // trip reads a consistent type and downstream walkers do not
      // branch on field-presence.
      m.set(F_LEADING_COMBINATOR, node.leadingCombinator ?? null);
      break;

    case 'LinePlainComment':
      m.set(F_QLANG_KIND, KIND_LINE_PLAIN_COMMENT);
      m.set(F_CONTENT, node.content);
      break;

    case 'BlockPlainComment':
      m.set(F_QLANG_KIND, KIND_BLOCK_PLAIN_COMMENT);
      m.set(F_CONTENT, node.content);
      break;

    case 'LineDocComment':
      m.set(F_QLANG_KIND, KIND_LINE_DOC_COMMENT);
      m.set(F_CONTENT, node.content);
      break;

    case 'BlockDocComment':
      m.set(F_QLANG_KIND, KIND_BLOCK_DOC_COMMENT);
      m.set(F_CONTENT, node.content);
      break;

    default:
      throw new AstNodeTypeUnknownError(node.type);
  }

  stampCommonFields(m, node);
  return Object.freeze(m);
}

// Pipeline.steps is a heterogeneous array at the JS-object level:
// steps[0] is a bare AST node (the head of the pipeline, no preceding
// combinator), and steps[i>=1] is a { combinator, step } wrapper
// object carrying the combinator token and the subsequent AST node.
// For round-trip fidelity the Map form uniforms this into a Vec of
// PipelineStep Maps, each carrying a :combinator field (null for the
// head, string for the rest) and a :step field holding the step's own
// AST-Map. The PipelineStep wrapper itself is an AST-Map kind so that
// downstream walkers recognize it via :qlang/kind like any other node.
function pipelineStepToMap(step, index) {
  const m = new Map();
  m.set(F_QLANG_KIND, KIND_PIPELINE_STEP);
  if (index === 0) {
    m.set(F_COMBINATOR, null);
    m.set(F_STEP, astNodeToMap(step));
  } else {
    m.set(F_COMBINATOR, step.combinator);
    m.set(F_STEP, astNodeToMap(step.step));
  }
  return Object.freeze(m);
}

// qlangMapToAst(map) → plain JS AST node (or null for null input).
//
// Inverse of astNodeToMap. Reads the :qlang/kind discriminator and
// reconstructs the JS-object AST node with the same shape peggy would
// have produced at parse time. Post-parse decoration (.id / .parent)
// is NOT re-attached — callers that need those fields should run
// assignAstNodeIds and attachAstParents on the result. Root-level
// metadata (.source / .uri / .parseId / .parsedAt / .schemaVersion)
// is also out of band, for the same reason: parse.mjs stamps it at
// parse time onto the root, separate from the node shape.
//
// Throws AstMapMalformedError when the input Map is missing a required
// field or carries a field with the wrong shape.
// Throws AstMapKindUnknownError when :qlang/kind is a keyword that
// does not correspond to any known AST type.
export function qlangMapToAst(map) {
  if (map == null) return null;
  if (!isQMap(map)) {
    throw new AstMapMalformedError(`expected a Map, got ${typeof map}`);
  }
  if (!map.has(F_QLANG_KIND)) {
    throw new AstMapMalformedError('missing :qlang/kind discriminator');
  }
  const kindVal = map.get(F_QLANG_KIND);
  const kindName = kindVal && kindVal.name ? kindVal.name : String(kindVal);
  const type = AST_KIND_TO_TYPE.get(kindName);
  if (!type) {
    throw new AstMapKindUnknownError(kindName);
  }

  const node = { type };

  switch (type) {
    case 'NumberLit':
    case 'StringLit':
    case 'BooleanLit':
      node.value = map.get(F_VALUE);
      break;

    case 'NullLit':
      // No payload beyond the discriminator.
      break;

    case 'Keyword':
      node.name = map.get(F_NAME);
      break;

    case 'Projection':
      node.keys = [...map.get(F_KEYS)];
      if (map.has(F_EFFECTFUL)) node.effectful = map.get(F_EFFECTFUL);
      break;

    case 'VecLit':
    case 'JsonArrayLit':
    case 'SetLit':
      node.elements = map.get(F_ELEMENTS).map(qlangMapToAst);
      break;

    case 'MapLit':
    case 'JsonObjectLit':
    case 'ErrorLit':
      node.entries = map.get(F_ENTRIES).map(qlangMapToAst);
      break;

    case 'QuoteLit':
      node.src = map.get(F_SRC);
      break;

    case 'DocLit':
      node.content = map.get(F_CONTENT);
      break;

    case 'TaggedLit':
      node.tag = map.get('tag');
      node.payload = qlangMapToAst(map.get('payload'));
      break;

    case 'BareTypeKeyword':
      node.tag = map.get('tag');
      break;

    case 'MapEntry':
      node.key   = qlangMapToAst(map.get(F_KEY));
      node.value = qlangMapToAst(map.get(F_VALUE));
      break;

    case 'OperandCall': {
      node.name = map.get(F_NAME);
      const args = map.get(F_ARGS);
      node.args = args === null ? null : args.map(qlangMapToAst);
      if (map.has(F_DOCS))      node.docs      = [...map.get(F_DOCS)];
      if (map.has(F_EFFECTFUL)) node.effectful = map.get(F_EFFECTFUL);
      break;
    }

    case 'BindStep': {
      node.key = qlangMapToAst(map.get(F_KEY));
      const docs = map.get(F_DOCS);
      node.docs = docs === null ? null : [...docs];
      const params = map.get('params');
      node.params = params === null ? null : params.map(qlangMapToAst);
      const body = map.get('body');
      node.body = body === null ? null : qlangMapToAst(body);
      break;
    }

    case 'ParenGroup':
      node.pipeline = qlangMapToAst(map.get(F_PIPELINE));
      break;

    case 'Pipeline': {
      const stepMaps = map.get(F_STEPS);
      node.steps = stepMaps.map(pipelineStepFromMap);
      // Preserve the shape peggy emits: leadingCombinator is present
      // only when a leading-prefix was authored; an absent field
      // reads as falsy and matches evalPipeline's identity-head
      // short-circuit without an explicit `null`.
      const leading = map.get(F_LEADING_COMBINATOR);
      if (leading !== null && leading !== undefined) node.leadingCombinator = leading;
      break;
    }

    case 'LinePlainComment':
    case 'BlockPlainComment':
    case 'LineDocComment':
    case 'BlockDocComment':
      node.content = map.get(F_CONTENT);
      break;
  }

  if (map.has(F_TEXT))     node.text     = map.get(F_TEXT);
  if (map.has(F_LOCATION)) node.location = locationFromQlangMap(map.get(F_LOCATION));

  return node;
}

// Inverse of pipelineStepToMap. Index 0 unwraps the head step back to
// a bare AST node (dropping the PipelineStep wrapper); subsequent
// indices reconstruct the { combinator, step } JS-object shape that
// evalPipeline's tail-loop consumes.
function pipelineStepFromMap(stepMap, index) {
  if (!isQMap(stepMap)) {
    throw new AstMapMalformedError(`Pipeline step at index ${index} is not a Map`);
  }
  if (stepMap.get(F_QLANG_KIND) !== KIND_PIPELINE_STEP) {
    throw new AstMapMalformedError(`Pipeline step at index ${index} is not a :PipelineStep Map`);
  }
  if (index === 0) {
    return qlangMapToAst(stepMap.get(F_STEP));
  }
  return {
    combinator: stepMap.get(F_COMBINATOR),
    step: qlangMapToAst(stepMap.get(F_STEP))
  };
}
