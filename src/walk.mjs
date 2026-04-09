// AST traversal primitives for qlang nodes — single source of truth
// for `astChildrenOf`, plus a toolkit of position-query, identifier-
// occurrence-search, and lexical-binding-scope helpers built on top
// of it.
//
// Other modules (parse.mjs::attachAstParents, parse.mjs::assignAstNodeIds,
// editor `findAstNodeAtOffset` for hover, autocomplete via
// `bindingNamesVisibleAt`, refactoring via `findIdentifierOccurrences`)
// import from here instead of duplicating switch-on-node-type walks.
// When a new AST node type lands in grammar.peggy, only `astChildrenOf`
// needs to learn about it; the helpers inherit the knowledge.

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
    case 'SetLit':
      for (const elem of node.elements) out.push(elem);
      break;
    case 'MapLit':
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
    // Leaves: NumberLit, StringLit, BooleanLit, NilLit, Keyword,
    // Projection, LinePlainComment, BlockPlainComment,
    // LineDocComment, BlockDocComment have no semantic children.
  }
  return out;
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
//   - OperandCall named 'let' or 'as' whose first Keyword arg names
//     the identifier (declaration site — e.g. `let(:foo, body)`)
//   - Projection whose .keys contains the name (Map field read by name)
// Keyword literals are intentionally NOT included because `:foo`
// is a value of type keyword, not an identifier reference.
export function findIdentifierOccurrences(ast, name) {
  const occurrences = [];
  walkAst(ast, (node) => {
    if (node.type === 'OperandCall' && node.name === name) occurrences.push(node);
    else if (node.type === 'OperandCall'
             && (node.name === 'let' || node.name === 'as')
             && Array.isArray(node.args) && node.args.length > 0
             && node.args[0].type === 'Keyword' && node.args[0].name === name) {
      occurrences.push(node);
    }
    else if (node.type === 'Projection' && node.keys.includes(name)) occurrences.push(node);
  });
  return occurrences;
}

// Fork-isolating AST node types — those whose evaluation creates a
// new fork via fork.mjs, so let/as bindings declared inside them do
// not leak to siblings or to the parent scope:
//
//   ParenGroup — inner pipeline runs in its own fork
//   VecLit, SetLit — each element is its own fork
//   MapLit — each entry's value is its own fork
//   MapEntry — accessor for the value-fork; isolates value from
//              the key and from sibling entries
//
// Pipeline is NOT in this set: the steps of a Pipeline run in
// sequence and share the same env progressively (every let/as in
// step k is visible to step k+1).
const FORK_ISOLATING_AST_TYPES = new Set([
  'ParenGroup', 'VecLit', 'SetLit', 'MapLit', 'MapEntry'
]);

// bindingNamesVisibleAt(ast, offset) — returns the Set of binding
// names (let / as operand calls) lexically visible at the given
// UTF-16 offset. This is the autocomplete primitive: "what
// identifiers can the user type at this cursor position without an
// unresolved-identifier error?"
//
// Visibility rules, mirroring the runtime fork semantics:
//   1. Only OperandCall nodes named 'let' or 'as' with a Keyword
//      first arg contribute names (binding declarations).
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
    // Recognize let(:name, ...) and as(:name) OperandCall patterns.
    if (node.type !== 'OperandCall') return;
    if (node.name !== 'let' && node.name !== 'as') return;
    if (!Array.isArray(node.args) || node.args.length === 0) return;
    const firstArg = node.args[0];
    if (firstArg.type !== 'Keyword') return;
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
    visible.add(firstArg.name);
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
// plain comments). Lets a future qlang formatter preserve original
// spacing without the grammar having to capture trivia tokens
// explicitly: as long as both nodes carry .location and the AST
// root carries .source, the original characters between them are
// recoverable on demand.
export function triviaBetweenAstNodes(nodeA, nodeB, ast) {
  if (!nodeA.location || !nodeB.location || !ast.source) return '';
  return ast.source.substring(nodeA.location.end.offset, nodeB.location.start.offset);
}
