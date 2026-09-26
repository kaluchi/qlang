// AST traversal primitives — `astChildrenOf` plus the toolkit of
// position-query, identifier-occurrence-search, and binding-
// visibility-scope walkers that build on it.
//
// `astChildrenOf` is the single source of truth for the qlang AST
// shape: parse.mjs's post-pass decoration (`attachAstParents`,
// `assignAstNodeIds`), editor hover (`findAstNodeAtOffset`),
// autocomplete (`bindingNamesVisibleAt`), and refactor lookups
// (`findIdentifierOccurrences`) all import from here instead of
// duplicating a `switch (node.type)` walk. A new AST node type in
// `grammar.peggy` extends both this file and `quote.mjs`; every
// downstream walker inherits the knowledge.

import { TAG_BINDING_PREFIX, isTagBindingName, tagBindingKey, canonicalTagName } from './env-keys.mjs';

// Namespace alias values used by `bindingNamesVisibleAt` to select
// which BindStep declaration shapes count toward the result
// Set. Kept on the export surface so callers (LSP completion,
// editor autocomplete) pass a named constant at every call site.
export const VALUE_NAMESPACE = 'value';
export const TAG_NAMESPACE   = 'tag';

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
    case 'ErrorLit':
      for (const entry of node.entries) out.push(entry);
      break;
    case 'MapEntry':
      out.push(node.key);
      out.push(node.value);
      break;
    case 'OperandCall':
      for (const arg of node.args) out.push(arg);
      break;
    case 'TaggedLit':
      out.push(node.payload);
      break;
    case 'QuoteLit':
      if (node.pipeline !== null) out.push(node.pipeline);
      break;
    case 'BindStep':
      out.push(node.key);
      for (const doc of node.docs ?? []) out.push(doc);
      if (node.body) out.push(node.body);
      break;
    // Leaves: NumberLit, StringLit, BooleanLit, NullLit, Keyword,
    // Projection, DocLit (frozen content), BareTypeKeyword
    // (tag-namespace identifier) have no semantic children.
  }
  return out;
}

// isPureLiteralAst(node) — recursive purity predicate over an AST
// subtree. Returns true when evaluation of the subtree depends on
// neither the surrounding pipeValue nor env nor any side-effect
// operand, which is what the head of a verb holds [D67], a group
// around one such step among them, the payload of `::Depth(3)`; a
// subtree with an OperandCall, a Projection or a Pipeline computes.
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
    case 'SetLit':
      return node.elements.every(isPureLiteralAst);
    case 'MapLit':
    case 'ErrorLit':
      return node.entries.every(e => isPureLiteralAst(e.value));
    case 'TaggedLit':
      return isPureLiteralAst(node.payload);
    case 'ParenGroup':
      return isPureLiteralAst(node.pipeline);
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

// moduleUriOf(node) — the uri of the source a node was read from,
// which the root of its tree carries: a module's name, a session
// cell's, `inline` for a query, `quote` for code assembled from data.
export function moduleUriOf(node) {
  let root = node;
  while (root.parent) root = root.parent;
  return root.uri;
}

// declaredNameOf(bindStep) — the env key a declaration writes: the
// name of a keyword, a tag's under the `::` prefix.
export function declaredNameOf(bindStep) {
  return bindStep.key.type === 'BareTypeKeyword' ? tagBindingKey(bindStep.key.tag) : bindStep.key.name;
}

// The text of each doc literal in the slot of a declaration [D83].
export function slotDocContentsOf(bindStep) {
  return (bindStep.docs ?? []).map(doc => doc.content);
}

// The declarations of a pipeline that repeat a name an earlier step of
// the same scope declared: the steps share one env but a step joined by
// `*`, which runs in a fork of each element [D71].
const REPEATED_DECLARATIONS_OF_PIPELINE = new WeakMap();

function repeatedDeclarationsOf(pipeline) {
  let repeated = REPEATED_DECLARATIONS_OF_PIPELINE.get(pipeline);
  if (repeated !== undefined) return repeated;
  repeated = new Set();
  const declared = new Set();
  pipeline.steps.forEach((unit, index) => {
    const [combinator, step] = index === 0 ? [pipeline.leadingCombinator, unit] : [unit.combinator, unit.step];
    if (step.type !== 'BindStep' || combinator === '*') return;
    const name = declaredNameOf(step);
    if (declared.has(name)) repeated.add(step);
    declared.add(name);
  });
  REPEATED_DECLARATIONS_OF_PIPELINE.set(pipeline, repeated);
  return repeated;
}

// repeatsDeclarationInScope(bindStep) — whether an earlier step of the
// declaration's scope declares its name [D44], [D71].
export function repeatsDeclarationInScope(bindStep) {
  return bindStep.parent?.type === 'Pipeline' && repeatedDeclarationsOf(bindStep.parent).has(bindStep);
}

// findAstNodeAtOffset(ast, offset) — returns the narrowest-spanning
// AST node whose source range contains the given UTF-16 offset, or
// null if no node contains the offset. The narrowest-wins tiebreaker
// matches editor expectations for hover and goto-definition: clicking
// inside `filter ~(gt 2)` lands on the inner `gt 2`, not the outer
// `filter ~(…)` that encloses it.
export function findAstNodeAtOffset(ast, offset) {
  let narrowest = null;
  walkAst(ast, (node) => {
    if (!node.location) return;
    const { start, end } = node.location;
    // Parent-first traversal: a containing node visited after
    // another one sits nested inside it, so the last match wins.
    if (start.offset <= offset && offset < end.offset) narrowest = node;
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
//       - Projection whose .keys contains the name (Map field read)
//
//   * Type-namespace lookup (`name` carries the `::` prefix, e.g.
//     `'::Tag'`):
//       - TaggedLit whose .tag matches (constructor invocation), and
//         the ErrorLit that writes the tag before its bang [D86]
//       - BareTypeKeyword whose .tag matches (identifier reference)
//       - BindStep whose BareTypeKeyword key names the identifier
//         (declaration site — `::Tag body`)
//
// Keyword literals (`:foo` value-position) stay out of the
// result set: a `:foo` literal in value position is a keyword
// value, addressable by `eq :foo` predicates but separate from
// identifier resolution.
export function findIdentifierOccurrences(ast, name) {
  if (isTagBindingName(name)) {
    return findTagNamespaceOccurrences(ast, name.slice(TAG_BINDING_PREFIX.length));
  }
  const occurrences = [];
  walkAst(ast, (node) => {
    if (node.type === 'OperandCall' && node.name === name) occurrences.push(node);
    else if (node.type === 'BindStep'
             && node.key.type === 'Keyword' && node.key.name === name) {
      occurrences.push(node);
    }
    else if (node.type === 'Projection' && node.keys.includes(name)) occurrences.push(node);
  });
  return occurrences;
}

// writesTag(node) — a node whose head is a tag it writes: a tagged
// literal, `::Tag(…)`, or an error literal that writes the tag of its
// content before its bang, `::Tag!{…}` [D86].
export function writesTag(node) {
  return node.type === 'TaggedLit' || (node.type === 'ErrorLit' && node.tag !== null);
}

function findTagNamespaceOccurrences(ast, tagName) {
  const occurrences = [];
  walkAst(ast, (node) => {
    if (writesTag(node) && canonicalTagName(node.tag) === tagName) occurrences.push(node);
    else if (node.type === 'BareTypeKeyword' && canonicalTagName(node.tag) === tagName) occurrences.push(node);
    else if (node.type === 'BindStep'
             && node.key.type === 'BareTypeKeyword' && canonicalTagName(node.key.tag) === tagName) {
      occurrences.push(node);
    }
  });
  return occurrences;
}

// Fork-isolating AST node types — those whose evaluation creates a
// new fork via fork.mjs, so BindStep bindings declared inside
// them stay local to the fork:
//
//   ParenGroup — inner pipeline runs in its own fork
//   QuoteLit — its pipeline runs where the quote is applied, under
//              the fork rule of `apply`
//   VecLit, SetLit — each element is its own fork
//   MapLit — each entry's value is its own fork
//   MapEntry — accessor for the value-fork; isolates value from
//              the key and from sibling entries
//
// Pipeline steps run sequentially in a shared env: every BindStep
// in step k shadows visibly through step k+1 onwards, so a
// Pipeline node propagates env writes through its successor steps.
export const FORK_ISOLATING_AST_TYPES = new Set([
  'ParenGroup', 'QuoteLit', 'VecLit', 'SetLit', 'MapLit', 'ErrorLit', 'MapEntry'
]);

// bindingNamesVisibleAt(ast, offset, namespace?) — returns the Set
// of binding names lexically visible at the given UTF-16 offset.
// This is the autocomplete primitive: "what identifiers can the
// user type at this cursor position without an unresolved-
// identifier error?"
//
// `namespace` picks which declaration shapes contribute:
//   - `'value'` (default) — BindStep with a Keyword key (`:name body`).
//     Names land bare (`'foo'`).
//   - `'tag'` — BindStep with a BareTypeKeyword key (`::Tag body`).
//     Names land with the `::Tag` prefix so the Set is directly
//     comparable with tag-namespace identifiers from env (which
//     all carry the `::` prefix as part of their env key).
//
// Visibility rules, mirroring the runtime fork semantics:
//   1. The declaring node must already have been completed at the
//      cursor (`location.end.offset <= offset`).
//   2. The declaration must NOT be inside a fork-isolating AST
//      node that has been crossed before reaching the cursor.
//
// Cursor containment uses the closed interval [start, end] (not
// half-open) so that a cursor at the end of a fork still sees its
// bindings.
export function bindingNamesVisibleAt(ast, offset, namespace = VALUE_NAMESPACE) {
  const visible = new Set();
  walkAst(ast, (node) => {
    let bindingName;
    if (namespace === TAG_NAMESPACE) {
      if (node.type === 'BindStep' && node.key.type === 'BareTypeKeyword') {
        bindingName = tagBindingKey(node.key.tag);
      } else {
        return;
      }
    } else {
      if (node.type === 'BindStep' && node.key.type === 'Keyword') {
        bindingName = node.key.name;
      } else {
        return;
      }
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

// locationToQlangMap(loc) → the qlang view of a peggy location:
// `{:start {:offset :line :column} :end {…}}`, or null for none. The
// `:location` of a parse error and of a declaration reads through it.
export function locationToQlangMap(loc) {
  if (!loc) return null;
  return Object.freeze(new Map([['start', positionToQlangMap(loc.start)], ['end', positionToQlangMap(loc.end)]]));
}

function positionToQlangMap(pos) {
  return Object.freeze(new Map([['offset', pos.offset], ['line', pos.line], ['column', pos.column]]));
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

