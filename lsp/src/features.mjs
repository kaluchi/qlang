// The features of the language server, pure functions over the public
// API of the core that `server.mjs` maps to the protocol.

import {
  parse, ParseError,
  langRuntime, evalQuery, answerKindsOf,
  findAstNodeAtOffset,
  findIdentifierOccurrences,
  writesTag,
  bindingNamesVisibleAt,
  builtFrom,
  declaresKind,
  splitAddress,
  CALL_SPELLING,
  TAG_SPELLING,
  FORK_ISOLATING_AST_TYPES,
  walkAst,
  tokenize,
  isNameStart,
  isNameContinue,
  shownFor,
  verbsReaching,
  verbNames,
  nodeOf,
  nodeAddresses,
  bareNameReach,
  residencesOf,
  isLabel,
  isVerb,
  declaresVerb
} from '@kaluchi/qlang-core';

// A tag as the server names it, `::number`, apart from the names of verbs.
const TAG_SIGIL = '::';
const tagNameOf = tag => TAG_SIGIL + tag;
const isTagName = name => name.startsWith(TAG_SIGIL);

// The prose of a doc, its segments without its quotes [QSSLF#doc], which hover
// and completion show; a doc the runtime answers is its segments, and a
// doc of the document's tree holds them as the parser read them.
const proseOfSegments = segments => segments.filter(segment => typeof segment === 'string').join('');

function tidyProse(prose) {
  return dedent(prose.replace(/\n{3,}/g, '\n\n').trim());
}

// Every line ends in a Markdown hard break, so a line break of a doc
// breaks the line of a hover.
function markdownHardBreaks(text) {
  return text.split('\n').map(l => l + '  ').join('\n');
}

// A doc without the indent of its source, measured on the lines after the
// first, which Markdown would otherwise read as a block of code.
function dedent(text) {
  const lines = text.split('\n');
  const continuationNonEmpty = lines.slice(1).filter(l => l.trim().length > 0);
  const minIndent = continuationNonEmpty.length > 0
    ? Math.min(...continuationNonEmpty.map(l => l.match(/^( *)/)[1].length))
    : 0;
  if (minIndent === 0) return text;
  return lines.map(l => l.slice(Math.min(minIndent, l.search(/\S|$/) ))).join('\n');
}

// The contents of the page at an address, `::vec/count`, once per
// address; a verb's is read at the address the tool shows for it, so its
// signature and its page name one verb [D352].
const docsCache = new Map();
async function pageContents(address) {
  if (docsCache.has(address)) return docsCache.get(address);
  let page;
  try {
    page = await evalQuery(`${address} | doc`);
  } catch {
    page = null;
  }
  const contents = Array.isArray(page) ? [proseOfSegments(page)] : [];
  docsCache.set(address, contents);
  return contents;
}

// What a call of a verb shows: its address and the inputs of its function.
const signatureOf = shown => [shown.address.literal, ...shown.inputs].join(' ');

// The kinds of the subject of the step that starts at an offset, where the
// steps before it name them, or null [QSSLF#catalog].
async function subjectKindsAt(source, offset) {
  return (await subjectAt(source, offset))?.kinds ?? null;
}

// ── Document state ────────────────────────────────────────────

export function parseDocument(source, uri) {
  const diagnostics = [];
  let ast = null;
  try {
    ast = parse(source, { uri });
  } catch (e) {
    if (e instanceof ParseError && e.location) {
      diagnostics.push({
        startLine: e.location.start.line - 1,
        startChar: e.location.start.column - 1,
        endLine: e.location.end ? e.location.end.line - 1 : e.location.start.line - 1,
        endChar: e.location.end ? e.location.end.column - 1 : e.location.start.column,
        message: e.message,
        severity: 'error'
      });
    } else {
      diagnostics.push({
        startLine: 0, startChar: 0,
        endLine: 0, endChar: 0,
        message: e.message ?? String(e),
        severity: 'error'
      });
    }
  }
  return { ast, diagnostics };
}

// ── Catalog context ───────────────────────────────────────────

// The declarations of a source of the catalog by the name each declares,
// its address [QSDSP#residence], with the span goto-definition jumps to.
export function buildCatalogIndex(catalogAst) {
  const index = new Map();
  if (!catalogAst) return index;
  walkAst(catalogAst, (node) => {
    // The declarations of a doc's examples belong to the examples.
    if (node.type === 'DocLit') return false;
    if (node.type !== 'BindStep') return;
    const span = { startOffset: node.location.start.offset, endOffset: node.location.end.offset };
    index.set(node.key.name, span);
  });
  return index;
}

// The catalog's declaration of what a name reaches with no subject: the one
// verb of the name, or of a name several kinds answer the first verb the
// catalog declares [D352]; for an address the node it names.
function catalogDeclarationOf({ index, runtime }, name) {
  const reach = bareNameReach(runtime, name);
  if (reach !== null) return index.get(reach.record.get('name').name) ?? null;
  for (const [, record] of residencesOf(runtime, name)) {
    const span = index.get(record.get('name').name);
    if (span !== undefined) return span;
  }
  return index.get(name) ?? null;
}

// ── Completion ────────────────────────────────────────────────

// The names of the runtime, its verbs and its tags, read once.
let _valueCompletions = null;
let _tagCompletions = null;

async function nameCompletions() {
  if (_valueCompletions) return _valueCompletions;
  const runtime = await langRuntime();
  _valueCompletions = [];
  for (const name of verbNames(runtime)) {
    const item = await verbCompletion(runtime, name, null);
    if (item !== null) _valueCompletions.push(item);
  }
  return _valueCompletions;
}

// The completion of a verb as a call of it from a subject of the kinds
// shows it, or with no kinds, its signature and its page; null for a name
// that reaches no verb.
async function verbCompletion(runtime, name, kinds) {
  const shown = shownFor(runtime, name, kinds);
  if (shown === undefined) return null;
  const docContents = await pageContents(shown.address.literal);
  return {
    label: name,
    kind: 'function',
    detail: signatureOf(shown),
    documentation: tidyProse(docContents[0] ?? '')
  };
}

async function tagCompletions() {
  if (_tagCompletions) return _tagCompletions;
  const runtime = await langRuntime();
  _tagCompletions = [];
  for (const address of nodeAddresses(runtime)) {
    const label = tagNameOf(address);
    const docContents = await pageContents(label);
    _tagCompletions.push({
      label,
      kind: 'tag',
      detail: 'a name of the root',
      documentation: tidyProse(docContents[0] ?? '')
    });
  }
  return _tagCompletions;
}

// After `::` the cursor completes a tag name alone.
function justTypedDoubleColon(source, offset) {
  if (typeof source !== 'string' || offset < 2) return false;
  return source[offset - 2] === ':' && source[offset - 1] === ':';
}

// After a value the cursor completes the verbs that accept it and the
// names the document declares; where the kind of the value is no
// declaration's, every name.
export async function completionsAtOffset(ast, offset, source = null) {
  if (justTypedDoubleColon(source, offset)) {
    return withDeclaredNames([...(await tagCompletions())], ast, offset, [TAG_SPELLING]);
  }
  const subject = typeof source === 'string' ? await subjectAt(source, offset) : null;
  if (subject !== null) {
    const runtime = await langRuntime();
    const verbs = [];
    for (const name of verbsReaching(runtime, subject.kinds).keys()) {
      const item = await verbCompletion(runtime, name, subject.kinds);
      if (item !== null) verbs.push(item);
    }
    return withDeclaredNames(verbs, subject.pipeline, subject.end, [CALL_SPELLING]);
  }
  const everyName = [...(await nameCompletions()), ...(await tagCompletions())];
  return withDeclaredNames(everyName, ast, offset, [CALL_SPELLING, TAG_SPELLING]);
}

function withDeclaredNames(items, ast, offset, spellings) {
  if (!ast) return items;
  for (const spelling of spellings) {
    for (const declared of bindingNamesVisibleAt(ast, offset, spelling)) {
      const name = spelling === TAG_SPELLING ? tagNameOf(declared) : declared;
      if (items.some(item => item.label === name)) continue;
      items.push(spelling === TAG_SPELLING
        ? { label: name, kind: 'tag', detail: "a reader's kind", documentation: null }
        : { label: name, kind: 'variable', detail: "a reader's name", documentation: null });
    }
  }
  return items;
}

// The kind of the value a literal step answers [QSLIT#kind].
const KIND_OF_LITERAL = {
  NumberLit: 'number', StringLit: 'string', RegexLit: 'regex', BooleanLit: 'boolean', NullLit: 'null',
  Keyword: 'keyword', VecLit: 'vec', MapLit: 'map', SetLit: 'set',
  QuoteLit: 'quote', DocLit: 'doc', TagLit: 'tag', Path: 'path'
};

// The kinds an error literal's walk reaches: its tag, the kind of errors
// and the map of its facts [QSLIT#kind].
const kindsOfErrorLiteral = step => [...(step.tag === null ? [] : [step.tag]), 'error', 'map'];

// Where the name being typed before the cursor begins.
function wordStartBefore(source, offset) {
  let start = offset;
  while (start > 0 && (isNameContinue(source[start - 1]) || isNameStart(source[start - 1]))) start--;
  return start;
}

// The subject of the step at the cursor, the word being typed aside: the
// steps before it, where the source with a step at the cursor parses, that
// step follows `|`, and the value before it has kinds its declarations
// name; a step after `!|` takes an error, and has none. The parser tells
// the combinator, the grammar written once.
async function subjectAt(source, offset) {
  const start = wordStartBefore(source, offset);
  let pipeline;
  try {
    pipeline = parse(`${source.slice(0, start)}${STEP_AT_CURSOR}`);
  } catch {
    return null;
  }
  const steps = stepsOf(pipeline);
  if (steps.length < 2 || steps[steps.length - 1].combinator === '!|') return null;
  const kinds = await kindsOfSteps(steps.slice(0, -1), null);
  return kinds === null ? null : { kinds, pipeline, end: start };
}

const STEP_AT_CURSOR = ' it';

function stepsOf(pipelineNode) {
  if (pipelineNode.type !== 'Pipeline') return [{ combinator: '|', step: pipelineNode }];
  return [{ combinator: pipelineNode.leadingCombinator ?? '|', step: pipelineNode.steps[0] }, ...pipelineNode.steps.slice(1)];
}

// The kinds of the value the steps answer from a subject of the kinds: a
// literal's own, the subject's through a declaration and a `!|` step, and a
// name's the kinds its `returns` names, the subject's own where that is the
// verb's own label [D352]; null where a step answers no declared kind.
async function kindsOfSteps(steps, subjectKinds) {
  let kinds = subjectKinds;
  for (const { combinator, step } of steps) {
    if (combinator === '!|') continue;
    kinds = await kindsAfterStep(step, kinds);
  }
  return kinds;
}

async function kindsAfterStep(step, kinds) {
  if (Object.hasOwn(KIND_OF_LITERAL, step.type)) return [KIND_OF_LITERAL[step.type]];
  if (step.type === 'ErrorLit') return kindsOfErrorLiteral(step);
  if (step.type === 'BindStep') return kinds;
  if (step.type === 'ParenGroup') return await kindsOfSteps(stepsOf(step.pipeline), kinds);
  if (step.type !== 'Call' || kinds === null) return null;
  const runtime = await langRuntime();
  const reached = verbsReaching(runtime, kinds).get(step.name);
  if (reached === undefined) return null;
  return answerKindsOf(runtime, nodeOf(runtime, reached.address.name), kinds);
}

// ── Hover ─────────────────────────────────────────────────────

export async function hoverAtOffset(ast, source, offset) {
  if (!ast) return null;

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return null;

  if (node.type === 'Call') {
    return await hoverForCall(node, ast, source);
  }
  if (node.type === 'TagLit' || isOnTagHead(node, offset)) {
    return await hoverForTag(node);
  }
  if (node.type === 'Path') {
    return await hoverForPath(node);
  }
  if (node.type === 'Keyword') {
    return {
      content: `keyword \`:${node.name}\``,
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    };
  }
  return null;
}

// A call of a verb of the runtime shows the verb its subject reaches,
// where the steps before it name the kinds of the subject, its signature
// over its page; a verb the document declares shows its doc.
async function hoverForCall(node, documentAst, source) {
  const runtime = await langRuntime();
  const shown = shownFor(runtime, node.name, await subjectKindsAt(source, node.location.start.offset));
  if (shown !== undefined) {
    const docContents = await pageContents(shown.address.literal);
    const prose = tidyProse(docContents.join('\n'));
    const heading = [`**${node.name}** — ${signatureOf(shown)}`];
    return {
      content: markdownHardBreaks([...heading, '', prose].join('\n')),
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    };
  }
  const docStrings = findInDocumentDocs(documentAst, node.name);
  if (docStrings.length === 0) return null;
  const prose = tidyProse(docStrings.join('\n'));
  return {
    content: markdownHardBreaks([
      `**${node.name}** — a reader's name`,
      '',
      prose
    ].join('\n')),
    startOffset: node.location.start.offset,
    endOffset: node.location.end.offset
  };
}

// The docs of the last declaration of the name in the document, a verb
// under a label by the name a step calls it by.
function findInDocumentDocs(ast, name) {
  if (!ast) return [];
  let lastDocs = null;
  walkAst(ast, (step) => {
    if (step.type === 'DocLit') return false;
    if (step.type === 'BindStep' && step.key.type === 'Keyword' && (step.key.name === name || splitAddress(step.key.name)[1] === name)) {
      lastDocs = (step.docs ?? []).map(doc => proseOfSegments(doc.segments));
    }
  });
  return lastDocs ?? [];
}

// A click on the head of a node that writes a tag, the `::Tag` of a
// TaggedLit or of an error literal `::Tag!{…}` [QSERR#rest], and not on the
// brackets the error literal owns around its entries.
function isOnTagHead(node, offset) {
  return writesTag(node) && offset < node.location.start.offset + 2 + node.tag.length;
}

// The page of a tag a node names or writes, over the span of its head.
async function hoverForTag(node) {
  const tagKey = tagNameOf(node.tag);
  const runtime = await langRuntime();
  if (nodeOf(runtime, node.tag) === null) return null;

  const docContents = await pageContents(tagKey);
  const headStart = node.location.start.offset;
  const headEnd = headStart + 2 + node.tag.length;

  const prose = tidyProse(docContents.join('\n'));
  return {
    content: markdownHardBreaks([
      `**${tagKey}** — a name of the root`,
      '',
      prose
    ].join('\n')),
    startOffset: headStart,
    endOffset: headEnd
  };
}

// A path shows its literal over the page of the kind of paths.
async function hoverForPath(node) {
  const prose = tidyProse((await pageContents('::path')).join('\n'));
  return {
    content: markdownHardBreaks([`path \`${node.text}\``, '', prose].join('\n')),
    startOffset: node.location.start.offset,
    endOffset: node.location.end.offset
  };
}

// ── Go to Definition ──────────────────────────────────────────

// The declaration a name, a tag name or the head of a tag a node writes
// resolves to: the last one the document makes visible at the cursor,
// else the catalog's.
export function definitionAtOffset(ast, offset, catalogCtx) {
  if (!ast) return null;

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return null;

  let name, address;
  if (node.type === 'Call')        [name, address] = [node.name, node.name];
  else if (node.type === 'TagLit') [name, address] = [tagNameOf(node.tag), node.tag];
  else if (isOnTagHead(node, offset))       [name, address] = [tagNameOf(node.tag), node.tag];
  else return null;

  const localDecl = findLastVisibleDeclaration(ast, name, offset);
  if (localDecl) return localDecl;

  return catalogCtx ? catalogDeclarationOf(catalogCtx, address) : null;
}

// The name a declaration binds and what it declares: a label, its tag,
// for a page alone or for the chain or the literal of a kind [QSBLD#kind], a
// value otherwise.
function bindingDeclarationOf(node) {
  if (node.type !== 'BindStep') return null;
  return declaresKind(node)
    ? { name: tagNameOf(node.key.name), kind: 'tag' }
    : { name: node.key.name, kind: 'value' };
}

// Whether a body runs on the values of the label it is declared under: a
// quote, and a function its chain gives a recipe, `| impl …`, or its
// literal one that is no null [QSBLD#fn].
function bodyRuns(body) {
  if (body.type === 'QuoteLit') return true;
  if (builtFrom(body) !== 'fn') return false;
  const chain = body.type === 'ParenGroup' ? body.pipeline : body;
  if (chain.type === 'TaggedLit') return chain.payload.type === 'VecLit' && chain.payload.elements[1]?.type !== 'NullLit';
  return chain.type === 'Pipeline' && chain.steps.slice(1).some(({ step }) => step.type === 'Call' && step.name === 'impl');
}

// Whether a declaration of a value declares a verb, by the core's rule: a name
// the runtime holds as the core answers it, and one of the document as
// `declaresVerb` reads it, a quote or a function with a recipe running where a
// reader's `::builtin{}` reaches no primitive [D352].
function declaresVerbIn({ key, body }, runtime, isLabelName) {
  return nodeOf(runtime, key.name) !== null
    ? isVerb(runtime, key.name)
    : declaresVerb(key.name, bodyRuns(body), isLabelName);
}

// The span of the last declaration of the name that stands before the
// cursor in a scope that encloses it, or null: a call by address reaches
// the declaration of that address, and a bare call one whose name a step
// calls it by.
function findLastVisibleDeclaration(ast, name, offset) {
  let lastVisible = null;

  walkAst(ast, (node) => {
    if (node.type === 'DocLit') return false;
    const decl = bindingDeclarationOf(node);
    if (decl === null || (decl.name !== name && (isTagName(name) || splitAddress(decl.name)[1] !== name))) return;
    if (!node.location || node.location.end.offset > offset) return;
    if (!isVisibleAcrossForks(node, offset)) return;
    lastVisible = {
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    };
  });

  return lastVisible;
}

// A declaration is visible when every fork above it encloses the cursor.
function isVisibleAcrossForks(declNode, cursorOffset) {
  let current = declNode;
  let parent = current.parent;
  while (parent) {
    if (FORK_ISOLATING_AST_TYPES.has(parent.type)) {
      if (!current.location
          || current.location.start.offset > cursorOffset
          || current.location.end.offset < cursorOffset) {
        return false;
      }
    }
    current = parent;
    parent = current.parent;
  }
  return true;
}

// ── Find References ───────────────────────────────────────────

export function referencesAtOffset(ast, offset) {
  if (!ast) return [];

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return [];

  // A call, a declaration or the keyword of its name, each by the name a
  // step calls it by, and a tag name.
  let name = null;
  if (node.type === 'Call') {
    name = splitAddress(node.name)[1];
  } else if (node.type === 'BindStep') {
    const declared = bindingDeclarationOf(node).name;
    name = isTagName(declared) ? declared : splitAddress(declared)[1];
  } else if (node.type === 'Keyword' && node.parent) {
    const parent = node.parent;
    if (parent.type === 'BindStep' && parent.key === node) {
      name = splitAddress(node.name)[1];
    }
  } else if (node.type === 'TagLit') {
    name = tagNameOf(node.tag);
  }

  if (!name) return [];

  const occurrences = isTagName(name)
    ? findIdentifierOccurrences(ast, name.slice(TAG_SIGIL.length), TAG_SPELLING)
    : findIdentifierOccurrences(ast, name);
  return occurrences
    .filter(occ => occ.location)
    .map(occ => ({
      startOffset: occ.location.start.offset,
      endOffset: occ.location.end.offset
    }));
}

// ── Document Symbols ──────────────────────────────────────────

// documentSymbols(ast, runtime) → the declarations of a document, each
// shown as a label, a verb or a value; a label is a name the document
// declares by its page alone, or a label of the language the runtime
// holds.
export function documentSymbols(ast, runtime) {
  if (!ast) return [];

  const labels = new Set();
  walkAst(ast, (node) => {
    if (node.type === 'DocLit') return false;
    if (node.type === 'BindStep' && bindingDeclarationOf(node).kind === 'tag') labels.add(node.key.name);
  });
  const isLabelName = name => labels.has(name) || isLabel(runtime, name);

  const symbols = [];
  walkAst(ast, (node) => {
    if (node.type === 'DocLit') return false;
    const decl = bindingDeclarationOf(node);
    if (decl === null || !node.location) return;

    symbols.push({
      name: decl.name,
      kind: decl.kind === 'value' && declaresVerbIn(node, runtime, isLabelName) ? 'verb' : decl.kind,
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    });
  });
  return symbols;
}

// ── Folding ───────────────────────────────────────────────────

// foldingRangesOf(ast, source) → the line ranges an editor folds, from
// 0: a declaration, a doc and a quote that span lines, the line of a
// closer that stands alone left open; a doc folds as a comment.
const FOLDED_NODE_TYPES = new Set(['BindStep', 'DocLit', 'QuoteLit']);

export function foldingRangesOf(ast, source) {
  if (!ast) return [];
  const lines = source.split(/\r?\n/);
  const ranges = [];
  walkAst(ast, (node) => {
    if (!FOLDED_NODE_TYPES.has(node.type)) return;
    const startLine = node.location.start.line - 1;
    const lastLine = node.location.end.line - 1;
    const closerAlone = /^\s*(~~\||\))\s*$/.test(lines[lastLine]);
    const endLine = closerAlone ? lastLine - 1 : lastLine;
    if (endLine > startLine) ranges.push({ startLine, endLine, kind: node.type === 'DocLit' ? 'comment' : 'region' });
  });
  return ranges;
}

// ── Signature Help ────────────────────────────────────────────

export async function signatureHelpAtOffset(ast, source, offset) {
  if (!ast) return null;

  const call = callAround(ast, source, offset);
  if (!call) return null;

  const runtime = await langRuntime();
  const shown = shownFor(runtime, call.name, await subjectKindsAt(source, call.location.start.offset));
  if (shown === undefined || (call.args.length === 0 && shown.inputs.length === 0)) return null;

  const inputs = shown.inputs;
  const docContents = await pageContents(shown.address.literal);

  // The active parameter of the protocol is the input whose modifier the
  // cursor stands on or after: one per modifier that ends before it.
  const activeParameter = call.args.filter(modifier => modifier.location.end.offset < offset).length;

  return {
    label: [call.name, ...inputs].join(' '),
    documentation: tidyProse(docContents[0] ?? ''),
    parameters: inputs.map(input => ({ label: input })),
    activeParameter
  };
}

// The call the cursor writes the words of: the narrowest call with words
// that holds it, or the call that spaces before the cursor follow, a verb
// taking inputs among them.
function callAround(ast, source, offset) {
  const node = findAstNodeAtOffset(ast, offset);
  const enclosing = node ? findEnclosingCall(node) : null;
  if (enclosing) return enclosing;
  let followed = null;
  walkAst(ast, (candidate) => {
    if (candidate.type !== 'Call' || !candidate.location) return;
    if (/^[ \t]+$/.test(source.slice(candidate.location.end.offset, offset))) followed = candidate;
  });
  return followed;
}

function findEnclosingCall(node) {
  let current = node;
  while (current) {
    if (current.type === 'Call' && current.args.length > 0) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

// ── Semantic tokens ───────────────────────────────────────────

// The kinds of `tokenize` as the semantic-token types of the protocol; a
// bracket has none, and the editor's grammar paints it.
export const SEMANTIC_TOKEN_TYPES = [
  'function',
  'variable',
  'keyword',
  'struct',
  'string',
  'number',
  'comment',
  'regexp'
];

const KIND_TO_TYPE_INDEX = {
  word:    0,
  name:    1,
  keyword: 2,
  tag:     3,
  string:  4,
  quote:   4,
  number:  5,
  comment: 6,
  regex:   7,
  err:     2
};

// The names of the runtime, which `tokenize` paints as words.
let _builtinNamesCache = null;
async function builtinNamesForTokenize() {
  if (_builtinNamesCache) return _builtinNamesCache;
  _builtinNamesCache = verbNames(await langRuntime());
  return _builtinNamesCache;
}

// semanticTokensFor(source) → { data: Uint32Array }, five integers per
// token as the protocol encodes them, a token that spans lines split
// into one per line.
export async function semanticTokensFor(source) {
  const builtinNames = await builtinNamesForTokenize();
  const tokens = tokenize(source, builtinNames);
  const data = [];
  let prevLine = 0;
  let prevChar = 0;
  const offsetToLineChar = buildLineCharIndex(source);
  for (const tok of tokens) {
    const typeIndex = KIND_TO_TYPE_INDEX[tok.kind];
    if (typeIndex === undefined) continue;
    let segStart = tok.start;
    while (segStart < tok.end) {
      const { line: segLine, char: segChar } = offsetToLineChar(segStart);
      const segLineEnd = offsetOfLineEnd(source, segStart);
      const segEnd = Math.min(tok.end, segLineEnd);
      const segLen = segEnd - segStart;
      if (segLen > 0) {
        const dLine = segLine - prevLine;
        const dChar = dLine === 0 ? segChar - prevChar : segChar;
        data.push(dLine, dChar, segLen, typeIndex, 0);
        prevLine = segLine;
        prevChar = segChar;
      }
      segStart = segEnd + (segEnd < tok.end ? 1 : 0);
    }
  }
  return { data: Uint32Array.from(data) };
}

function buildLineCharIndex(source) {
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') lineStarts.push(i + 1);
  }
  return function offsetToLineChar(offset) {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo, char: offset - lineStarts[lo] };
  };
}

function offsetOfLineEnd(source, fromOffset) {
  const nl = source.indexOf('\n', fromOffset);
  return nl === -1 ? source.length : nl;
}
