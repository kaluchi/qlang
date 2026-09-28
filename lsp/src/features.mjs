// The features of the language server, pure functions over the public
// API of the core that `server.mjs` maps to the protocol.

import {
  parse, ParseError,
  langRuntime, evalQuery,
  findAstNodeAtOffset,
  findIdentifierOccurrences,
  writesTag,
  bindingNamesVisibleAt,
  VALUE_NAMESPACE,
  TAG_NAMESPACE,
  FORK_ISOLATING_AST_TYPES,
  walkAst,
  isModuleNamespaceKey,
  isTagBindingName,
  RUNTIME_LOCATOR_KEY,
  tagBindingKey,
  canonicalTagName,
  tokenize,
  isKeyword,
  isTagKeyword,
  isVerb,
  typeKeyword,
  bindingValueOf,
  printQuoteSource,
  signatureSpecOf,
  slotLabelsOf,
  verbShownFor,
  verbsReaching
} from '@kaluchi/qlang-core';

// The fields of a descriptor, which the loader's `use` alone is [D79].
const F_CATEGORY  = 'category';
const F_SUBJECT   = 'subject';
const F_MODIFIERS = 'modifiers';

// The prose of a doc, its segments without its quotes [D94], which hover
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

// The contents of the page a name reads, once per name: a tag's own, the
// page of a verb several kinds answer on its contract on any value [D72],
// or the page of the first address where a verb of the name lives [D62].
const docsCache = new Map();
async function fetchDocsContents(name) {
  if (docsCache.has(name)) return docsCache.get(name);
  const query = isTagBindingName(name)
    ? `${name} | doc`
    : `::any/${name} | doc !| (:"${name}" | doc) !| (/addresses | first | if (eq null) ~(null) ~(doc))`;
  let page;
  try {
    page = await evalQuery(query);
  } catch {
    page = null;
  }
  const contents = Array.isArray(page) ? [proseOfSegments(page)] : [];
  docsCache.set(name, contents);
  return contents;
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

// The declarations of a module of the catalog by name, a verb's and a
// tag's alike, each with the span goto-definition jumps to.
export function buildCatalogIndex(catalogAst) {
  const index = new Map();
  if (!catalogAst) return index;
  walkAst(catalogAst, (node) => {
    // The declarations of a doc's examples belong to the examples.
    if (node.type === 'DocLit') return false;
    if (node.type !== 'BindStep') return;
    let name;
    if (node.key.type === 'Keyword') name = node.key.name;
    else if (node.key.type === 'BareTypeKeyword') name = tagBindingKey(node.key.tag);
    else return;
    index.set(name, {
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    });
  });
  return index;
}

// ── Completion ────────────────────────────────────────────────

// The names of the runtime, its verbs and its tags, read once.
let _valueCompletions = null;
let _tagCompletions = null;

async function valueNamespaceCompletions() {
  if (_valueCompletions) return _valueCompletions;
  const runtime = await langRuntime();
  _valueCompletions = [];
  for (const [k, entry] of runtime) {
    if (isModuleNamespaceKey(k)) continue;
    if (k === RUNTIME_LOCATOR_KEY) continue;
    if (isTagBindingName(k)) continue;
    const descriptor = bindingValueOf(entry);
    if (!(descriptor instanceof Map) && !isVerb(descriptor)) continue;
    const docContents = await fetchDocsContents(k);
    _valueCompletions.push({
      label: k,
      kind: 'function',
      detail: isVerb(descriptor) ? signatureTextOf(runtime, k) : formatMetaValue(descriptor.get(F_CATEGORY)),
      documentation: tidyProse(docContents[0] ?? '')
    });
  }
  return _valueCompletions;
}

async function tagNamespaceCompletions() {
  if (_tagCompletions) return _tagCompletions;
  const runtime = await langRuntime();
  _tagCompletions = [];
  for (const [k] of runtime) {
    if (!isTagBindingName(k)) continue;
    const docContents = await fetchDocsContents(k);
    _tagCompletions.push({
      label: k,
      kind: 'tag',
      detail: 'tag-binding',
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
    return withDeclaredNames([...(await tagNamespaceCompletions())], ast, offset, [TAG_NAMESPACE]);
  }
  const subject = typeof source === 'string' ? await subjectAt(source, offset) : null;
  if (subject !== null) {
    const reached = verbsReaching(await langRuntime(), subject.kinds);
    const verbs = (await valueNamespaceCompletions()).filter(item => reached.has(item.label));
    return withDeclaredNames(verbs, subject.pipeline, subject.end, [VALUE_NAMESPACE]);
  }
  const everyName = [...(await valueNamespaceCompletions()), ...(await tagNamespaceCompletions())];
  return withDeclaredNames(everyName, ast, offset, [VALUE_NAMESPACE, TAG_NAMESPACE]);
}

function withDeclaredNames(items, ast, offset, namespaces) {
  if (!ast) return items;
  for (const namespace of namespaces) {
    for (const name of bindingNamesVisibleAt(ast, offset, namespace)) {
      if (items.some(item => item.label === name)) continue;
      items.push(namespace === TAG_NAMESPACE
        ? { label: name, kind: 'tag', detail: 'in-document tag-binding', documentation: null }
        : { label: name, kind: 'variable', detail: 'BindStep binding', documentation: null });
    }
  }
  return items;
}

// The kind of the value a literal step answers [D32].
const KIND_OF_LITERAL = {
  NumberLit: 'number', StringLit: 'string', BooleanLit: 'boolean', NullLit: 'null',
  Keyword: 'keyword', VecLit: 'vec', MapLit: 'map', SetLit: 'set',
  QuoteLit: 'quote', DocLit: 'doc', BareTypeKeyword: 'tag'
};
const CONTAINER_KINDS = new Set(['vec', 'set', 'map']);

// The subject of the step at the cursor, the word being typed aside: the
// pipeline it continues after `|` or a line break, where that pipeline
// parses and its value has kinds its declarations name; a step after `*`
// or `!|` takes an element or an error, and has none.
async function subjectAt(source, offset) {
  const before = source.slice(0, offset).replace(/[@_\p{ID_Continue}-]*$/u, '');
  const continued = before.match(/\s(!\||\||\*)\s*$/) ?? before.match(/\n\s*$/);
  if (continued === null || continued[1] === '*' || continued[1] === '!|') return null;
  let pipeline;
  try {
    pipeline = parse(before.slice(0, continued.index));
  } catch {
    return null;
  }
  const kinds = await kindsOfSteps(stepsOf(pipeline), null);
  return kinds === null ? null : { kinds, pipeline, end: continued.index };
}

function stepsOf(pipelineNode) {
  if (pipelineNode.type !== 'Pipeline') return [{ combinator: '|', step: pipelineNode }];
  return [{ combinator: pipelineNode.leadingCombinator ?? '|', step: pipelineNode.steps[0] }, ...pipelineNode.steps.slice(1)];
}

// The kinds of the value the steps answer from a subject of the kinds: a
// literal's own, the subject's through a declaration and a `!|` step, a
// container's through `*`, and a verb's `:returns`, `/` for its
// subject's own [D67]; null where a step answers no declared kind.
async function kindsOfSteps(steps, subjectKinds) {
  let kinds = subjectKinds;
  for (const { combinator, step } of steps) {
    if (combinator === '!|') continue;
    if (combinator === '*') kinds = CONTAINER_KINDS.has(kinds?.[0]) ? kinds : null;
    else kinds = await kindsAfterStep(step, kinds);
  }
  return kinds;
}

async function kindsAfterStep(step, kinds) {
  if (Object.hasOwn(KIND_OF_LITERAL, step.type)) return [KIND_OF_LITERAL[step.type]];
  if (step.type === 'BindStep') return kinds;
  if (step.type === 'ParenGroup') return await kindsOfSteps(stepsOf(step.pipeline), kinds);
  if (step.type !== 'OperandCall' || kinds === null) return null;
  const runtime = await langRuntime();
  const reached = verbsReaching(runtime, kinds).get(step.name);
  if (reached === undefined) return null;
  const returns = await evalQuery(`${reached.address.literal} | spec | /returns`, runtime);
  if (isTagKeyword(returns)) return [returns.name];
  return typeKeyword(returns).name === 'proj' ? kinds : null;
}

// ── Hover ─────────────────────────────────────────────────────

export async function hoverAtOffset(ast, source, offset) {
  if (!ast) return null;

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return null;

  if (node.type === 'OperandCall') {
    return await hoverForOperand(node, ast);
  }
  if (node.type === 'BareTypeKeyword' || isOnTagHead(node, offset)) {
    return await hoverForTag(node);
  }
  if (node.type === 'Projection') {
    return hoverForProjection(node);
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

// The head a verb of the runtime declares, as its signature prints [D72].
function signatureTextOf(runtime, name) {
  return printQuoteSource(signatureSpecOf(verbShownFor(runtime, name)).payload);
}

async function hoverForOperand(node, documentAst) {
  const runtime = await langRuntime();
  if (runtime.has(node.name)) {
    const descriptor = bindingValueOf(runtime.get(node.name));
    const docContents = await fetchDocsContents(node.name);
    const prose = tidyProse(docContents.join('\n'));
    const heading = isVerb(descriptor)
      ? [`**${node.name}** — ${signatureTextOf(runtime, node.name)}`]
      : [
        `**${node.name}** — ${formatMetaValue(descriptor.get(F_CATEGORY))}`,
        `Subject: ${formatMetaValue(descriptor.get(F_SUBJECT))}`
      ];
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
      `**${node.name}** — user binding`,
      '',
      prose
    ].join('\n')),
    startOffset: node.location.start.offset,
    endOffset: node.location.end.offset
  };
}

// The docs of the last declaration of the name in the document.
function findInDocumentDocs(ast, name) {
  if (!ast) return [];
  let lastDocs = null;
  walkAst(ast, (step) => {
    if (step.type === 'DocLit') return false;
    if (step.type === 'BindStep' && step.key.type === 'Keyword' && step.key.name === name) {
      lastDocs = (step.docs ?? []).map(doc => proseOfSegments(doc.segments));
    }
  });
  return lastDocs ?? [];
}

// A click on the head of a node that writes a tag, the `::Tag` of a
// TaggedLit or of an error literal `::Tag!{…}` [D86], and not on the
// brackets the error literal owns around its entries.
function isOnTagHead(node, offset) {
  return writesTag(node) && offset < node.location.start.offset + 2 + node.tag.length;
}

// The page of a tag a node names or writes, over the span of its head.
async function hoverForTag(node) {
  const tagKey = tagBindingKey(node.tag);
  const runtime = await langRuntime();
  if (!runtime.has(tagKey)) return null;

  const docContents = await fetchDocsContents(tagKey);
  const headStart = node.location.start.offset;
  const headEnd = headStart + 2 + node.tag.length;

  const prose = tidyProse(docContents.join('\n'));
  return {
    content: markdownHardBreaks([
      `**${tagKey}** — tag-binding`,
      '',
      prose
    ].join('\n')),
    startOffset: headStart,
    endOffset: headEnd
  };
}

function hoverForProjection(node) {
  const pathStr = '/' + node.keys.join('/');
  return {
    content: `projection \`${pathStr}\` — extracts value from Map`,
    startOffset: node.location.start.offset,
    endOffset: node.location.end.offset
  };
}

function formatMetaValue(value) {
  if (value === null || value === undefined) return 'any';
  if (typeof value === 'string') return value;
  if (isKeyword(value)) return value.name;
  if (Array.isArray(value)) {
    return value.map(formatMetaValue).join(' | ');
  }
  return String(value);
}

// ── Go to Definition ──────────────────────────────────────────

// The declaration a name, a tag name or the head of a tag a node writes
// resolves to: the last one the document makes visible at the cursor,
// else the catalog's.
export function definitionAtOffset(ast, offset, catalogCtx) {
  if (!ast) return null;

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return null;

  let name;
  if (node.type === 'OperandCall')        name = node.name;
  else if (node.type === 'BareTypeKeyword') name = tagBindingKey(node.tag);
  else if (isOnTagHead(node, offset))       name = tagBindingKey(node.tag);
  else return null;

  const localDecl = findLastVisibleDeclaration(ast, name, offset);
  if (localDecl) return localDecl;

  if (catalogCtx?.index?.has(name)) {
    return catalogCtx.index.get(name);
  }

  return null;
}

// The name a declaration binds and the symbol it shows as: a tag, a verb
// for the verb literal as its body [D67], a value otherwise.
function bindingDeclarationOf(node) {
  if (node.type === 'BindStep') {
    if (node.key.type === 'BareTypeKeyword') {
      return { name: tagBindingKey(node.key.tag), kind: 'tag' };
    }
    if (node.key.type === 'Keyword') {
      const kind = bindingKindForKeywordHead(node);
      return { name: node.key.name, kind };
    }
    return null;
  }
  return null;
}

function bindingKindForKeywordHead(bindStepNode) {
  const body = bindStepNode.body;
  return body?.type === 'TaggedLit' && canonicalTagName(body.tag) === 'verb' ? 'verb' : 'value';
}

// The span of the last declaration of the name that stands before the
// cursor in a scope that encloses it, or null.
function findLastVisibleDeclaration(ast, name, offset) {
  let lastVisible = null;

  walkAst(ast, (node) => {
    if (node.type === 'DocLit') return false;
    const decl = bindingDeclarationOf(node);
    if (decl === null || decl.name !== name) return;
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

  // A call, a declaration or the keyword of its name, and a tag name.
  let name = null;
  if (node.type === 'OperandCall') {
    name = node.name;
  } else if (node.type === 'BindStep') {
    if (node.key.type === 'Keyword') name = node.key.name;
    else if (node.key.type === 'BareTypeKeyword') name = tagBindingKey(node.key.tag);
  } else if (node.type === 'Keyword' && node.parent) {
    const parent = node.parent;
    if (parent.type === 'BindStep' && parent.key === node) {
      name = node.name;
    }
  } else if (node.type === 'BareTypeKeyword') {
    name = tagBindingKey(node.tag);
  }

  if (!name) return [];

  const occurrences = findIdentifierOccurrences(ast, name);
  return occurrences
    .filter(occ => occ.location)
    .map(occ => ({
      startOffset: occ.location.start.offset,
      endOffset: occ.location.end.offset
    }));
}

// ── Document Symbols ──────────────────────────────────────────

export function documentSymbols(ast) {
  if (!ast) return [];

  const symbols = [];
  walkAst(ast, (node) => {
    if (node.type === 'DocLit') return false;
    const decl = bindingDeclarationOf(node);
    if (decl === null || !node.location) return;

    symbols.push({
      name: decl.name,
      kind: decl.kind,
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    });
  });
  return symbols;
}

// ── Signature Help ────────────────────────────────────────────

export async function signatureHelpAtOffset(ast, source, offset) {
  if (!ast) return null;

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return null;

  const operandCall = findEnclosingOperandCall(node);
  if (!operandCall) return null;

  const runtime = await langRuntime();
  if (!runtime.has(operandCall.name)) return null;

  const descriptor = bindingValueOf(runtime.get(operandCall.name));
  const modifiers = isVerb(descriptor)
    ? slotLabelsOf(verbShownFor(runtime, operandCall.name))
    : descriptor.get(F_MODIFIERS).map(formatMetaValue);
  const docContents = await fetchDocsContents(operandCall.name);

  // The active parameter is the modifier the cursor stands on or after:
  // one per word that ends before it.
  const activeParameter = operandCall.args.filter(arg => arg.location.end.offset < offset).length;

  return {
    label: [operandCall.name, ...modifiers].join(' '),
    documentation: tidyProse(docContents[0] ?? ''),
    parameters: modifiers.map(mod => ({ label: mod })),
    activeParameter
  };
}

function findEnclosingOperandCall(node) {
  let current = node;
  while (current) {
    if (current.type === 'OperandCall' && current.args.length > 0) {
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
  'decorator',
  'keyword',
  'struct',
  'string',
  'number',
  'comment'
];

const KIND_TO_TYPE_INDEX = {
  operand: 0,
  atom:    1,
  effect:  2,
  keyword: 3,
  tag:     4,
  string:  5,
  quote:   5,
  number:  6,
  comment: 7,
  err:     3
};

// The names of the runtime, which `tokenize` paints as operands.
let _builtinNamesCache = null;
async function builtinNamesForTokenize() {
  if (_builtinNamesCache) return _builtinNamesCache;
  const runtime = await langRuntime();
  _builtinNamesCache = new Set();
  for (const k of runtime.keys()) {
    if (isModuleNamespaceKey(k)) continue;
    if (k === RUNTIME_LOCATOR_KEY) continue;
    if (isTagBindingName(k)) continue;
    _builtinNamesCache.add(k);
  }
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
