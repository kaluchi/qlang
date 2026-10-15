// The walks of the parser's tree over the children `astChildrenOf` names,
// which the decoration of a parse, the language server and the editor
// read: the node at an offset, the occurrences of a name, and the names
// visible at a cursor.

import { splitAddress } from './address.mjs';

// The two spellings of a name in source, which the editor passes to say
// which occurrences and declarations count: called by its name, `count`,
// or written as a tag, the address of a node, `::Box` [QSNAM#address].
export const CALL_SPELLING = 'call';
export const TAG_SPELLING   = 'tag';

// astChildrenOf(node) → the children of a node that hold meaning, the
// step of each unit of a pipeline among them, none for a leaf.
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
    case 'Call':
      for (const arg of node.args) out.push(arg);
      break;
    case 'TaggedLit':
      out.push(node.payload);
      break;
    case 'QuoteLit':
      if (node.pipeline !== null) out.push(node.pipeline);
      break;
    case 'DocTaggedQuote':
      out.push(node.quote);
      break;
    case 'BindStep':
      out.push(node.key);
      for (const doc of node.docs ?? []) out.push(doc);
      if (node.body) out.push(node.body);
      break;
    case 'DocLit':
      for (const segment of node.segments) if (typeof segment !== 'string') out.push(segment);
      break;
    // Leaves: NumberLit, StringLit, BooleanLit, NullLit, Keyword,
    // RegexLit, Path, TagLit (a tag, the address of a node) have
    // no semantic children.
  }
  return out;
}

// The literals, which answer themselves whatever the subject, their parts
// literals [QSLIT#closed], a path among them [QSPTH#value], a quote, whose code
// does not run, and a doc.
const LITERALS = new Set([
  'NumberLit', 'StringLit', 'BooleanLit', 'NullLit', 'Keyword', 'TagLit', 'RegexLit', 'Path',
  'VecLit', 'SetLit', 'MapLit', 'ErrorLit', 'TaggedLit', 'QuoteLit', 'DocLit', 'DocTaggedQuote'
]);

// readsItsSubject(node) → whether a query reads the subject it is handed,
// which a host that lifts the subject from a stream waits on only then
// [QSHST#input]: a pipeline where its first step that declares nothing reads
// it, or where a declaration before that step runs a body that does; a
// group where its code reads it; a literal never; a call, a declaration,
// which answers its subject, and a node this walk does not name always.
export function readsItsSubject(node) {
  if (node.type === 'Pipeline') return stepsReadTheirSubject([node.steps[0], ...node.steps.slice(1).map(unit => unit.step)]);
  if (node.type === 'ParenGroup') return readsItsSubject(node.pipeline);
  return !LITERALS.has(node.type);
}

function stepsReadTheirSubject(steps) {
  for (const step of steps) {
    if (step.type !== 'BindStep') return readsItsSubject(step);
    if (astChildrenOf(step).some(readsItsSubject)) return true;
  }
  return true;
}

// walkAst(node, visit) → a walk of the tree, each node before its
// children, which it skips for a node `visit(node, parent)` answers false
// for.
export function walkAst(node, visit, parent = null) {
  if (visit(node, parent) === false) return;
  for (const child of astChildrenOf(node)) walkAst(child, visit, node);
}

// assignAstNodeIds(root) → each node its `.id`, counted from 0 in the
// order of the walk.
export function assignAstNodeIds(root) {
  let next = 0;
  walkAst(root, (n) => { n.id = next++; });
}

// attachAstParents(root) → each node its `.parent`, the root's null.
export function attachAstParents(root) {
  walkAst(root, (n, parent) => { n.parent = parent; });
}

// originOf(node) — the uri of the source a node was read from, which
// the root of its tree carries: a source of the root's name, a session
// cell's, `inline` for a query, `quote` for code assembled from data.
export function originOf(node) {
  let root = node;
  while (root.parent) root = root.parent;
  return root.uri;
}

// declaredNameOf(bindStep) — the name a declaration writes, its keyword's
// [QSNAM#address].
export function declaredNameOf(bindStep) {
  return bindStep.key.name;
}

// builtFrom(body) → the noun a body builds its value from as it is
// written: the tag at the head of its chain of commands, in parentheses or
// not, `::kind | wraps …`, or the tag of its literal, `::fn[~(…) ~(…)]`;
// null for any other body [QSBLD#fn], [QSBLD#kind].
export function builtFrom(body) {
  const chain = body.type === 'ParenGroup' ? body.pipeline : body;
  if (chain.type === 'TaggedLit') return chain.tag;
  return chain.type === 'Pipeline' && chain.steps[0].type === 'TagLit' ? chain.steps[0].tag : null;
}

// declaresKind(bindStep) — whether a declaration declares a label: a name
// by its page alone, `:Box |~~ A parcel. ~~|`, or by the chain of a kind,
// `:Box |~~ A parcel. ~~| (::kind | wraps …)` [QSBLD#kind].
export function declaresKind(bindStep) {
  return bindStep.body === null || builtFrom(bindStep.body) === 'kind';
}

// The declarations of a pipeline that repeat a name an earlier step of
// the same scope declared, the steps sharing one env [QSNAM#scope].
const REPEATED_DECLARATIONS_OF_PIPELINE = new WeakMap();

function repeatedDeclarationsOf(pipeline) {
  let repeated = REPEATED_DECLARATIONS_OF_PIPELINE.get(pipeline);
  if (repeated !== undefined) return repeated;
  repeated = new Set();
  const declared = new Set();
  pipeline.steps.forEach((unit, index) => {
    const step = index === 0 ? unit : unit.step;
    if (step.type !== 'BindStep') return;
    const name = declaredNameOf(step);
    if (declared.has(name)) repeated.add(step);
    declared.add(name);
  });
  REPEATED_DECLARATIONS_OF_PIPELINE.set(pipeline, repeated);
  return repeated;
}

// repeatsDeclarationInScope(bindStep) — whether an earlier step of the
// declaration's scope declares its name [QSNAM#scope].
export function repeatsDeclarationInScope(bindStep) {
  return bindStep.parent?.type === 'Pipeline' && repeatedDeclarationsOf(bindStep.parent).has(bindStep);
}

// findAstNodeAtOffset(ast, offset) → the narrowest node whose span holds
// the UTF-16 offset, a cursor inside `filter ~(gt 2)` landing on `gt 2`,
// or null.
export function findAstNodeAtOffset(ast, offset) {
  let narrowest = null;
  walkAst(ast, (node) => {
    if (!node.location) return;
    const { start, end } = node.location;
    // A node is walked after the nodes that hold it, so the last wins.
    if (start.offset <= offset && offset < end.offset) narrowest = node;
  });
  return narrowest;
}

// findIdentifierOccurrences(ast, name, spelling?) → the nodes that name
// it, a keyword written as a value none of them: called, a call of the
// name, its declaration and a path that reads it as a key; written
// as a tag [QSNAM#address], its declaration, a tagged or an error literal that
// writes it [QSERR#rest] and the tag name alone.
export function findIdentifierOccurrences(ast, name, spelling = CALL_SPELLING) {
  if (spelling === TAG_SPELLING) return findTagOccurrences(ast, name);
  const occurrences = [];
  walkAst(ast, (node) => {
    if (node.type === 'Call' && splitAddress(node.name)[1] === name) occurrences.push(node);
    else if (node.type === 'BindStep' && splitAddress(node.key.name)[1] === name) occurrences.push(node);
    else if (node.type === 'Path' && node.keys.includes(name)) occurrences.push(node);
  });
  return occurrences;
}

// writesTag(node) — a node whose head is a tag it writes: a tagged
// literal, `::Tag(…)`, or an error literal that writes the tag of its
// content before its bang, `::Tag!{…}` [QSERR#rest].
export function writesTag(node) {
  return node.type === 'TaggedLit' || (node.type === 'ErrorLit' && node.tag !== null);
}

function findTagOccurrences(ast, tagName) {
  const occurrences = [];
  walkAst(ast, (node) => {
    if (writesTag(node) && node.tag === tagName) occurrences.push(node);
    else if (node.type === 'TagLit' && node.tag === tagName) occurrences.push(node);
    else if (node.type === 'BindStep' && declaresKind(node) && node.key.name === tagName) occurrences.push(node);
  });
  return occurrences;
}

// The nodes whose declarations stay inside them [QSQUO#modifier]: a group, a
// quote, each word of a literal and each value of a map; the steps of a
// pipeline share their scope, each seeing the declarations before it.
export const FORK_ISOLATING_AST_TYPES = new Set([
  'ParenGroup', 'QuoteLit', 'VecLit', 'SetLit', 'MapLit', 'ErrorLit', 'MapEntry'
]);

// bindingNamesVisibleAt(ast, offset, spelling?) → the names a step may
// call at the UTF-16 offset: the declarations that end at or before it,
// one inside a node whose declarations stay inside it only for an offset
// within the part of that node that holds it, its end included, and
// under the spelling of a tag the labels alone [QSSLF#catalog].
export function bindingNamesVisibleAt(ast, offset, spelling = CALL_SPELLING) {
  const visible = new Set();
  walkAst(ast, (node) => {
    if (node.type !== 'BindStep' || (spelling === TAG_SPELLING && !declaresKind(node))) return;
    const bindingName = node.key.name;
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
    visible.add(spelling === TAG_SPELLING ? bindingName : splitAddress(bindingName)[1]);
  });
  return visible;
}

