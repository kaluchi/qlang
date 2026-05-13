// AST traversal primitives for qlang nodes — single source of truth
// for `astChildrenOf`, plus a toolkit of position-query, identifier-
// occurrence-search, and lexical-binding-scope helpers built on top
// of it, and an AST ↔ qlang-Map codec for code-as-data surfaces
// (structured :trail, `parse` / `eval` reflective operands, conduit
// body inspection).
//
// Other modules (parse.mjs::attachAstParents, parse.mjs::assignAstNodeIds,
// editor `findAstNodeAtOffset` for hover, autocomplete via
// `bindingNamesVisibleAt`, refactoring via `findIdentifierOccurrences`)
// import from here instead of duplicating switch-on-node-type walks.
// When a new AST node type lands in grammar.peggy, both `astChildrenOf`
// and the `astNodeToMap` / `qlangMapToAst` codec learn about it here;
// all downstream helpers inherit the knowledge.

import { isQMap } from './types.mjs';
import { QlangError } from './errors.mjs';

// astChildrenOf(node) — yields the direct semantic children of an
// AST node. "Semantic" excludes plumbing like the {combinator, step}
// wrapper inside Pipeline.steps[i] (we yield the step itself, not
// the wrapper). Returns an empty array for leaf node types.
export function astChildrenOf(node) {
  if (!node || typeof node !== 'object' || !('type' in node)) return [];
  const out = [];
  switch (node.type) {
    case 'Pipeline':
      if (node.steps.length > 0) out.push(node.steps[0]);
      for (let i = 1; i < node.steps.length; i++) {
        out.push(node.steps[i].step);
      }
      break;
    case 'ParenGroup':
      out.push(node.pipeline);
      break;
    case 'VecLit':
    case 'JsonArrayLit':
    case 'SetLit':
      for (const elem of node.elements) out.push(elem);
      break;
    case 'MapLit':
    case 'JsonObjectLit':
    case 'ErrorLit':
      for (const entry of node.entries) out.push(entry);
      break;
    case 'MapEntry':
      out.push(node.key);
      out.push(node.value);
      break;
    case 'OperandCall':
      if (Array.isArray(node.args)) {
        for (const arg of node.args) out.push(arg);
      }
      break;
    case 'TaggedLit':
      out.push(node.payload);
      break;
    case 'BindStep':
      out.push(node.key);
      if (Array.isArray(node.params)) {
        for (const param of node.params) out.push(param);
      }
      if (node.body) out.push(node.body);
      break;
    // Leaves: NumberLit, StringLit, BooleanLit, NullLit, Keyword,
    // Projection, QuoteLit (frozen source, lazy AST), DocLit (frozen
    // content), BareTypeKeyword (type-namespace identifier),
    // LinePlainComment, BlockPlainComment, LineDocComment,
    // BlockDocComment have no semantic children.
  }
  return out;
}

// isPureLiteralAst(node) — recursive purity predicate over an AST
// subtree. Returns true when evaluation of the subtree depends on
// neither the surrounding pipeValue nor env nor any side-effect
// operand. Pure-literal bodies are eval'd at def-time and bound as
// a snapshot of the resulting value; impure bodies (containing
// OperandCall, Projection, ParenGroup, Pipeline) bind as a zero-
// param conduit invoked lazily per-lookup. Used by both the
// `def` operand impl (runtime/intro.mjs) and the `BindStep` handler
// (eval.mjs).
export function isPureLiteralAst(node) {
  switch (node.type) {
    case 'NumberLit':
    case 'StringLit':
    case 'BooleanLit':
    case 'NullLit':
    case 'Keyword':
    case 'QuoteLit':
    case 'DocLit':
    case 'BareTypeKeyword':
      return true;
    case 'VecLit':
    case 'JsonArrayLit':
    case 'SetLit':
      return node.elements.every(isPureLiteralAst);
    case 'MapLit':
    case 'JsonObjectLit':
    case 'ErrorLit':
      return node.entries.every(e => isPureLiteralAst(e.value));
    case 'TaggedLit':
      return isPureLiteralAst(node.payload);
    default:
      return false;
  }
}

// walkAst(node, visit) — pre-order recursive descent over the AST.
//   visit(node, parent) — return false to skip descending into the
//   node's children. Any other return value (or undefined) continues
//   normally.
export function walkAst(node, visit, parent = null) {
  if (visit(node, parent) === false) return;
  for (const child of astChildrenOf(node)) walkAst(child, visit, node);
}

// assignAstNodeIds(root) — counter-based pre-order id assignment
// over the entire AST. Mutates the tree, returns nothing. Each node
// receives a `.id` (number, monotonic from 0 within this call).
// Used by parse.mjs as part of the post-parse decoration pass.
export function assignAstNodeIds(root) {
  let next = 0;
  walkAst(root, (n) => { n.id = next++; });
}

// attachAstParents(root) — sets `.parent` on every non-root node.
// Mutates the tree, returns nothing. The root receives `.parent = null`.
export function attachAstParents(root) {
  walkAst(root, (n, parent) => { n.parent = parent; });
}

// findAstNodeAtOffset(ast, offset) — returns the narrowest-spanning
// AST node whose source range contains the given UTF-16 offset, or
// null if no node contains the offset. The narrowest-wins tiebreaker
// matches editor expectations for hover and goto-definition: clicking
// inside `filter(gt(2))` should land on the inner `gt(2)`, not the
// outer `filter(...)` that encloses it.
export function findAstNodeAtOffset(ast, offset) {
  let narrowest = null;
  walkAst(ast, (node) => {
    if (!node.location) return;
    const { start, end } = node.location;
    if (start.offset <= offset && offset < end.offset) {
      if (!narrowest || astNodeSpan(node) < astNodeSpan(narrowest)) {
        narrowest = node;
      }
    }
  });
  return narrowest;
}

// findIdentifierOccurrences(ast, name) — returns every AST node
// that names the given qlang identifier. The result includes both
// declarations and uses, intentionally:
//   - OperandCall whose .name matches (read site or bare identifier)
//   - BindStep whose Keyword key names the identifier (declaration
//     site — `:foo body` form). BareTypeKeyword keys (`::foo body`)
//     bind under `::foo` and do not match a value-namespace lookup.
//   - OperandCall named `as` whose first Keyword arg names the
//     identifier (snapshot declaration site — `as(:foo)`).
//   - Projection whose .keys contains the name (Map field read by name)
// Keyword literals are intentionally NOT included because `:foo`
// is a value of type keyword, not an identifier reference.
export function findIdentifierOccurrences(ast, name) {
  const occurrences = [];
  walkAst(ast, (node) => {
    if (node.type === 'OperandCall' && node.name === name) occurrences.push(node);
    else if (node.type === 'BindStep'
             && node.key.type === 'Keyword' && node.key.name === name) {
      occurrences.push(node);
    }
    else if (node.type === 'OperandCall'
             && node.name === 'as'
             && Array.isArray(node.args) && node.args.length > 0
             && node.args[0].type === 'Keyword' && node.args[0].name === name) {
      occurrences.push(node);
    }
    else if (node.type === 'Projection' && node.keys.includes(name)) occurrences.push(node);
  });
  return occurrences;
}

// Fork-isolating AST node types — those whose evaluation creates a
// new fork via fork.mjs, so def/as bindings declared inside them do
// not leak to siblings or to the parent scope:
//
//   ParenGroup — inner pipeline runs in its own fork
//   VecLit, SetLit — each element is its own fork
//   MapLit — each entry's value is its own fork
//   MapEntry — accessor for the value-fork; isolates value from
//              the key and from sibling entries
//
// Pipeline is NOT in this set: the steps of a Pipeline run in
// sequence and share the same env progressively (every def/as in
// step k is visible to step k+1).
export const FORK_ISOLATING_AST_TYPES = new Set([
  'ParenGroup', 'VecLit', 'SetLit', 'MapLit', 'ErrorLit', 'MapEntry'
]);

// bindingNamesVisibleAt(ast, offset) — returns the Set of binding
// names lexically visible at the given UTF-16 offset. This is the
// autocomplete primitive: "what identifiers can the user type at
// this cursor position without an unresolved-identifier error?"
//
// Visibility rules, mirroring the runtime fork semantics:
//   1. BindStep nodes with a Keyword key, and OperandCall nodes
//      named `as` with a Keyword first arg, contribute names
//      (binding declarations). BareTypeKeyword bind into the
//      `::tag` namespace and are skipped for value-name lookup.
//   2. The binding must already have been declared at the cursor
//      (`location.end.offset <= offset`).
//   3. The binding must NOT be inside a fork-isolating AST node
//      that has been crossed before reaching the cursor's scope.
//
// Cursor containment uses the closed interval [start, end] (not
// half-open) so that a cursor at the end of a fork still sees its
// bindings.
export function bindingNamesVisibleAt(ast, offset) {
  const visible = new Set();
  walkAst(ast, (node) => {
    let bindingName = null;
    if (node.type === 'BindStep' && node.key.type === 'Keyword') {
      bindingName = node.key.name;
    } else if (node.type === 'OperandCall' && node.name === 'as'
               && Array.isArray(node.args) && node.args.length > 0
               && node.args[0].type === 'Keyword') {
      bindingName = node.args[0].name;
    } else {
      return;
    }
    if (!node.location || node.location.end.offset > offset) return;
    let current = node;
    let parent = current.parent;
    while (parent) {
      if (FORK_ISOLATING_AST_TYPES.has(parent.type)) {
        if (!current.location
            || current.location.start.offset > offset
            || current.location.end.offset < offset) {
          return;
        }
      }
      current = parent;
      parent = current.parent;
    }
    visible.add(bindingName);
  });
  return visible;
}

// astNodeSpan(node) — number of UTF-16 code units the node spans
// in the source. Used as the narrowest-wins tiebreaker inside
// findAstNodeAtOffset.
export function astNodeSpan(node) {
  if (!node.location) return Number.POSITIVE_INFINITY;
  return node.location.end.offset - node.location.start.offset;
}

// astNodeContainsOffset(node, offset) — true if `offset` falls
// inside the node's source range.
export function astNodeContainsOffset(node, offset) {
  if (!node.location) return false;
  return node.location.start.offset <= offset && offset < node.location.end.offset;
}

// triviaBetweenAstNodes(nodeA, nodeB, ast) — returns the source
// slice between two adjacent AST nodes (whitespace, punctuation,
// plain comments). Lets a qlang formatter preserve original
// spacing without the grammar having to capture trivia tokens
// explicitly: as long as both nodes carry .location and the AST
// root carries .source, the original characters between them are
// recoverable on demand.
export function triviaBetweenAstNodes(nodeA, nodeB, ast) {
  if (!nodeA.location || !nodeB.location || !ast.source) return '';
  return ast.source.substring(nodeA.location.end.offset, nodeB.location.start.offset);
}

// ── AST ↔ qlang Map codec ──────────────────────────────────────
//
// Bidirectional converter between the JS-object AST produced by the
// peggy parser and a pure qlang-Map representation. Every AST node
// type maps to a frozen Map with `:qlang/kind :<NodeType>` as the
// discriminator and type-specific fields mirroring the node's shape.
// The round-trip invariant holds: given any AST produced by parse(),
// qlangMapToAst ∘ astNodeToMap is structurally the identity, modulo
// post-parse decoration (.id / .parent) and root-level metadata
// (.source / .uri / .parseId / .parsedAt / .schemaVersion) which are
// stamped by parse.mjs after tree construction and are not part of
// the node shape itself.
//
// This is the foundation for several upstream features:
//   - Structured error :trail — each deflect stamps an AST-Map onto
//     the trail Vec instead of the raw source text string, so user
//     code can filter / group / inspect trails as qlang data.
//   - `parse` / `eval` reflective operands — `"query" | parse`
//     produces an AST-Map; `ast-map | eval` re-enters evaluation
//     against the current state. Closes the source → data → exec
//     ring that makes `| parse | eval` a first-class combinator.
//   - Conduit body as data — `reify(:helper) | /body` exposes a
//     user-defined conduit's body expression as an AST-Map for
//     programmatic inspection or editor tooling.
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
//                     (wrapper inside Pipeline.steps — first step
//                      carries null combinator, rest carry "|", "!|",
//                      "*", or ">>")
//   DocLit            :content <string>
//   TaggedLit         :tag <string> :payload <AST-Map>
//   BareTypeKeyword   :tag <string>
//   LinePlainComment  :content <string>
//   BlockPlainComment :content <string>
//   LineDocComment    :content <string>
//   BlockDocComment   :content <string>
//
// Every AST-Map additionally carries :text and :location (when the
// originating node carried them, which is always the case for
// parser-produced nodes).

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

import { keyword } from './types.mjs';

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
// the forthcoming `parse` / `eval` reflective operands surface them
// to user pipelines.
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
// `stampCommonFields`, called at the tail of each per-type branch below.
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
// walk arbitrary trees receive a stable signal instead of an exception.
// A node whose `.type` is not one of the known kinds throws
// AstNodeTypeUnknownError — this is a runtime invariant violation, not
// user data, and deserves a loud failure.
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
// is also not reconstructed, for the same reason: it is stamped by
// parse.mjs at parse time, not carried by the node shape.
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
