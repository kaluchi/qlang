// AST traversal primitives — `astChildrenOf` plus the toolkit of
// position-query, identifier-occurrence-search, and lexical-binding-
// scope helpers that build on it.
//
// `astChildrenOf` is the single source of truth for the qlang AST
// shape: parse.mjs's post-pass decoration (`attachAstParents`,
// `assignAstNodeIds`), editor hover (`findAstNodeAtOffset`),
// autocomplete (`bindingNamesVisibleAt`), and refactor lookups
// (`findIdentifierOccurrences`) all import from here instead of
// duplicating a `switch (node.type)` walk. A new AST node type in
// `grammar.peggy` extends both this file and `ast-codec.mjs`; every
// downstream walker inherits the knowledge.

import { TYPE_BINDING_PREFIX, isTypeBindingName } from './types.mjs';

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
// operand. Pure-literal bodies are eval'd at decl-time and bound as
// a snapshot of the resulting value; impure bodies (containing
// OperandCall, Projection, ParenGroup, Pipeline) bind as a zero-
// param conduit invoked lazily per-lookup. Used by `evalBindStep`.
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
// inside `filter(gt(2))` lands on the inner `gt(2)`, not the outer
// `filter(...)` that encloses it.
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
// that names the given qlang identifier. Supports both namespaces:
//
//   * Value-namespace lookup (`name` is a plain identifier like
//     `'foo'`):
//       - OperandCall whose .name matches (read site or bare ident)
//       - BindStep whose Keyword key names the identifier
//         (declaration site — `:foo body` form)
//       - OperandCall named `as` whose first Keyword arg names the
//         identifier (snapshot declaration site — `as(:foo)`)
//       - Projection whose .keys contains the name (Map field read)
//
//   * Type-namespace lookup (`name` carries the `::` prefix, e.g.
//     `'::Tag'`):
//       - TaggedLit whose .tag matches (constructor invocation)
//       - BareTypeKeyword whose .tag matches (identifier reference)
//       - BindStep whose BareTypeKeyword key names the identifier
//         (declaration site — `::Tag body`)
//
// Keyword literals (`:foo` value-position) are intentionally NOT
// included because `:foo` is a value of type keyword, not an
// identifier reference.
export function findIdentifierOccurrences(ast, name) {
  if (isTypeBindingName(name)) {
    return findTypeNamespaceOccurrences(ast, name.slice(TYPE_BINDING_PREFIX.length));
  }
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

function findTypeNamespaceOccurrences(ast, tagName) {
  const occurrences = [];
  walkAst(ast, (node) => {
    if (node.type === 'TaggedLit' && node.tag === tagName) occurrences.push(node);
    else if (node.type === 'BareTypeKeyword' && node.tag === tagName) occurrences.push(node);
    else if (node.type === 'BindStep'
             && node.key.type === 'BareTypeKeyword' && node.key.tag === tagName) {
      occurrences.push(node);
    }
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
    let bindingName;
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

