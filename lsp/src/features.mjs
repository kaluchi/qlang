// The features of the language server, pure functions over the public
// API of the core that `server.mjs` maps to the protocol, reading the
// records of the steps and the parts the parser keeps beside them [D367].

import {
  parse, ParseError,
  langRuntime, evalQuery, answerKindsOf,
  partOf,
  partAtOffset,
  findNameOccurrences,
  tagWrittenBy,
  bindingNamesVisibleAt,
  visibleAt,
  builtFrom,
  declaresKind,
  splitAddress,
  CALL_SPELLING,
  TAG_SPELLING,
  walkParts,
  isNameStart,
  isNameContinue,
  isKeyword,
  isTag,
  isLiteral,
  isCallStep,
  isBindStep,
  isGroupStep,
  isFailStep,
  errorFieldsOf,
  typeOf,
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
import { tokenize } from '@kaluchi/qlang-core/highlight';

// A tag as the server names it, `::number`, apart from the names of verbs.
const TAG_SIGIL = '::';
const tagNameOf = tag => TAG_SIGIL + tag;
const isTagName = name => name.startsWith(TAG_SIGIL);

const kindOf = value => typeOf(value).name;

// The prose of a doc, its segments without its quotes [D367], which hover
// and completion show.
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
// address; a verb's is read at the address the tool shows for it, so the
// form of its call and its page name one verb [QSHST#tools].
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

// The form of a call of a verb: its address and the inputs of its function.
const callFormOf = shown => [shown.address.literal, ...shown.inputs].join(' ');

// The kinds of the subject of the step that starts at an offset, where the
// steps before it name them, or null [QSSLF#catalog].
async function subjectKindsAt(source, offset) {
  return (await subjectAt(source, offset))?.kinds ?? null;
}

const spanOf = read => ({ startOffset: read.span.start.offset, endOffset: read.span.end.offset });

// ── Document state ────────────────────────────────────────────

// parseDocument(source, uri) → the root of the parts of a document, null
// where it does not parse, and its diagnostics.
export function parseDocument(source, uri) {
  const diagnostics = [];
  let root = null;
  try {
    root = partOf(parse(source, { uri }));
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
  return { root, diagnostics };
}

// ── Catalog context ───────────────────────────────────────────

// The declarations of a source of the catalog by the name each declares,
// its address [QSDSP#residence], with the span goto-definition jumps to;
// the declarations of a doc's examples belong to the examples.
export function buildCatalogIndex(catalogRoot) {
  const index = new Map();
  if (!catalogRoot) return index;
  walkParts(catalogRoot, (read) => {
    if (kindOf(read.value) === 'doc') return false;
    if (isBindStep(read.value)) index.set(read.value.get('name').name, spanOf(read));
  });
  return index;
}

// The catalog's declaration of what a name reaches with no subject: the one
// verb of the name, or of a name several kinds answer the first verb the
// catalog declares [QSNAM#reach]; for an address the node it names.
function catalogDeclarationOf({ index, scope }, name) {
  const reach = bareNameReach(scope, name);
  if (reach !== null) return index.get(reach.record.get('name').name) ?? null;
  for (const [, record] of residencesOf(scope, name)) {
    const span = index.get(record.get('name').name);
    if (span !== undefined) return span;
  }
  return index.get(name) ?? null;
}

// ── Completion ────────────────────────────────────────────────

// The names of the root, its verbs and its tags, read once.
let _valueCompletions = null;
let _tagCompletions = null;

async function nameCompletions() {
  if (_valueCompletions) return _valueCompletions;
  const scope = await langRuntime();
  _valueCompletions = [];
  for (const name of verbNames(scope)) {
    const item = await verbCompletion(scope, name, null);
    if (item !== null) _valueCompletions.push(item);
  }
  return _valueCompletions;
}

// The completion of a verb as a call of it from a subject of the kinds
// shows it, or with no kinds, the form of its call and its page; null for
// a name that reaches no verb.
async function verbCompletion(scope, name, kinds) {
  const shown = shownFor(scope, name, kinds);
  if (shown === undefined) return null;
  const docContents = await pageContents(shown.address.literal);
  return {
    label: name,
    kind: 'function',
    detail: callFormOf(shown),
    documentation: tidyProse(docContents[0] ?? '')
  };
}

async function tagCompletions() {
  if (_tagCompletions) return _tagCompletions;
  const scope = await langRuntime();
  _tagCompletions = [];
  for (const address of nodeAddresses(scope)) {
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
export async function completionsAtOffset(root, offset, source = null) {
  if (justTypedDoubleColon(source, offset)) {
    return withDeclaredNames([...(await tagCompletions())], root, offset, [TAG_SPELLING]);
  }
  const subject = typeof source === 'string' ? await subjectAt(source, offset) : null;
  if (subject !== null) {
    const scope = await langRuntime();
    const verbs = [];
    for (const name of verbsReaching(scope, subject.kinds).keys()) {
      const item = await verbCompletion(scope, name, subject.kinds);
      if (item !== null) verbs.push(item);
    }
    return withDeclaredNames(verbs, subject.root, subject.end, [CALL_SPELLING]);
  }
  const everyName = [...(await nameCompletions()), ...(await tagCompletions())];
  return withDeclaredNames(everyName, root, offset, [CALL_SPELLING, TAG_SPELLING]);
}

function withDeclaredNames(items, root, offset, spellings) {
  if (!root) return items;
  for (const spelling of spellings) {
    for (const declared of bindingNamesVisibleAt(root, offset, spelling)) {
      const name = spelling === TAG_SPELLING ? tagNameOf(declared) : declared;
      if (items.some(item => item.label === name)) continue;
      items.push(spelling === TAG_SPELLING
        ? { label: name, kind: 'tag', detail: "a reader's kind", documentation: null }
        : { label: name, kind: 'variable', detail: "a reader's name", documentation: null });
    }
  }
  return items;
}

// The kinds an error literal's walk reaches: its tag, the kind of errors
// and the map of its facts [QSLIT#kind].
const kindsOfErrorLiteral = step => [...(kindOf(step) === 'error' ? [] : [kindOf(step)]), 'error', 'map'];

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
  let quote;
  try {
    quote = parse(`${source.slice(0, start)}${STEP_AT_CURSOR}`);
  } catch {
    return null;
  }
  const steps = stepsOf(quote);
  if (steps.length < 2 || steps[steps.length - 1].combinator === '!|') return null;
  const kinds = await kindsOfSteps(steps.slice(0, -1), null);
  return kinds === null ? null : { kinds, root: partOf(quote), end: start };
}

const STEP_AT_CURSOR = ' it';

function stepsOf(quote) {
  return quote.map(step => (isFailStep(step) ? { combinator: '!|', step: step.payload[0] } : { combinator: '|', step }));
}

// The kinds of the value the steps answer from a subject of the kinds: a
// literal's own, the subject's through a declaration and a `!|` step, and a
// name's the kinds its `returns` names, the subject's own where that is the
// verb's own label [QSBLD#answer]; null where a step answers no declared kind.
async function kindsOfSteps(steps, subjectKinds) {
  let kinds = subjectKinds;
  for (const { combinator, step } of steps) {
    if (combinator === '!|') continue;
    kinds = await kindsAfterStep(step, kinds);
  }
  return kinds;
}

async function kindsAfterStep(step, kinds) {
  if (errorFieldsOf(step) !== null) return kindsOfErrorLiteral(step);
  if (isLiteral(step)) return [kindOf(step)];
  if (isBindStep(step)) return kinds;
  if (isGroupStep(step)) return await kindsOfSteps(stepsOf(step.payload), kinds);
  if (!isCallStep(step) || kinds === null) return null;
  const scope = await langRuntime();
  const reached = verbsReaching(scope, kinds).get(step.get('name').name);
  if (reached === undefined) return null;
  return answerKindsOf(scope, nodeOf(scope, reached.address.name), kinds);
}

// ── Hover ─────────────────────────────────────────────────────

export async function hoverAtOffset(root, source, offset) {
  if (!root) return null;

  const read = partAtOffset(root, offset);
  if (!read) return null;
  const { value } = read;

  if (isCallStep(value)) return await hoverForCall(read, root, source);
  if (isTag(value)) return await hoverForTag(value.name, read);
  if (isOnTagHead(read, offset)) return await hoverForTag(tagWrittenBy(read), read);
  if (kindOf(value) === 'path') return await hoverForPath(read, source);
  if (isKeyword(value)) return { content: `keyword \`:${value.name}\``, ...spanOf(read) };
  return null;
}

// A call of a verb of the root shows the verb its subject reaches,
// where the steps before it name the kinds of the subject, the form of its
// call over its page; a verb the document declares shows its doc.
async function hoverForCall(read, root, source) {
  const name = read.value.get('name').name;
  const scope = await langRuntime();
  const shown = shownFor(scope, name, await subjectKindsAt(source, read.span.start.offset));
  if (shown !== undefined) {
    const docContents = await pageContents(shown.address.literal);
    const prose = tidyProse(docContents.join('\n'));
    const heading = [`**${name}** — ${callFormOf(shown)}`];
    return { content: markdownHardBreaks([...heading, '', prose].join('\n')), ...spanOf(read) };
  }
  const docStrings = findInDocumentDocs(root, name);
  if (docStrings.length === 0) return null;
  const prose = tidyProse(docStrings.join('\n'));
  return {
    content: markdownHardBreaks([
      `**${name}** — a reader's name`,
      '',
      prose
    ].join('\n')),
    ...spanOf(read)
  };
}

// The docs of the last declaration of the name in the document, a verb
// under a label by the name a step calls it by.
function findInDocumentDocs(root, name) {
  let lastDocs = null;
  walkParts(root, ({ value }) => {
    if (kindOf(value) === 'doc') return false;
    if (!isBindStep(value)) return;
    const declared = value.get('name').name;
    if (declared === name || splitAddress(declared)[1] === name) lastDocs = (value.get('docs') ?? []).map(proseOfSegments);
  });
  return lastDocs ?? [];
}

// A click on the head of a tagged literal, the `::Tag` of `::Tag[…]`; the
// head of an error literal, `::Tag!{…}`, is a part of its own [QSERR#rest].
function isOnTagHead(read, offset) {
  const tag = tagWrittenBy(read);
  return tag !== null && offset < read.span.start.offset + 2 + tag.length;
}

// The page of a tag a part names or writes, over the span of its head.
async function hoverForTag(tag, read) {
  const tagKey = tagNameOf(tag);
  const scope = await langRuntime();
  if (nodeOf(scope, tag) === null) return null;

  const docContents = await pageContents(tagKey);
  const headStart = read.span.start.offset;
  const prose = tidyProse(docContents.join('\n'));
  return {
    content: markdownHardBreaks([
      `**${tagKey}** — a name of the root`,
      '',
      prose
    ].join('\n')),
    startOffset: headStart,
    endOffset: headStart + 2 + tag.length
  };
}

// A path shows its literal over the page of the kind of paths.
async function hoverForPath(read, source) {
  const prose = tidyProse((await pageContents('::path')).join('\n'));
  const written = source.slice(read.span.start.offset, read.span.end.offset);
  return { content: markdownHardBreaks([`path \`${written}\``, '', prose].join('\n')), ...spanOf(read) };
}

// ── Go to Definition ──────────────────────────────────────────

// The declaration a name, a tag name or the head of a tag a part writes
// resolves to: the last one the document makes visible at the cursor,
// else the catalog's.
export function definitionAtOffset(root, offset, catalogCtx) {
  if (!root) return null;

  const read = partAtOffset(root, offset);
  if (!read) return null;

  let name, address;
  if (isCallStep(read.value)) [name, address] = [read.value.get('name').name, read.value.get('name').name];
  else if (isTag(read.value)) [name, address] = [tagNameOf(read.value.name), read.value.name];
  else if (isOnTagHead(read, offset)) [name, address] = [tagNameOf(tagWrittenBy(read)), tagWrittenBy(read)];
  else return null;

  const localDecl = findLastVisibleDeclaration(root, name, offset);
  if (localDecl) return localDecl;

  return catalogCtx ? catalogDeclarationOf(catalogCtx, address) : null;
}

// The name a declaration binds and what it declares: a label, its tag,
// for a page alone or for the chain or the literal of a kind [QSBLD#kind], a
// value otherwise.
function bindingDeclarationOf({ value }) {
  if (!isBindStep(value)) return null;
  return declaresKind(value)
    ? { name: tagNameOf(value.get('name').name), kind: 'tag' }
    : { name: value.get('name').name, kind: 'value' };
}

// Whether a body runs on the values of the label it is declared under: a
// quote, and a function its chain gives a recipe, `| impl …`, or its
// literal one that is no null [QSBLD#fn].
function bodyRuns(body) {
  if (kindOf(body) === 'quote') return true;
  if (builtFrom(body) !== 'fn') return false;
  const steps = isGroupStep(body) ? body.payload : [body];
  if (steps.length > 1) return steps.slice(1).some(step => isCallStep(step) && step.get('name').name === 'impl');
  const payload = steps[0].get('payload');
  return kindOf(payload) === 'vec' && payload[1] !== null;
}

// Whether a declaration of a value declares a verb, by the core's rule: a name
// the root holds as the core answers it, and one of the document as
// `declaresVerb` reads it, a quote or a function with a recipe running where a
// reader's `::builtin{}` reaches no primitive [QSNAM#verb], [QSHST#source].
function declaresVerbIn(bind, scope, isLabelName) {
  const name = bind.get('name').name;
  return nodeOf(scope, name) !== null
    ? isVerb(scope, name)
    : declaresVerb(name, bodyRuns(bind.get('body')), isLabelName);
}

// The span of the last declaration of the name that stands before the
// cursor in a scope that encloses it, or null: a call by address reaches
// the declaration of that address, and a bare call one whose name a step
// calls it by.
function findLastVisibleDeclaration(root, name, offset) {
  let lastVisible = null;
  walkParts(root, (read) => {
    if (kindOf(read.value) === 'doc') return false;
    const decl = bindingDeclarationOf(read);
    if (decl === null || (decl.name !== name && (isTagName(name) || splitAddress(decl.name)[1] !== name))) return;
    if (read.span.end.offset > offset || !visibleAt(read, offset)) return;
    lastVisible = spanOf(read);
  });
  return lastVisible;
}

// ── Find References ───────────────────────────────────────────

export function referencesAtOffset(root, offset) {
  if (!root) return [];

  const read = partAtOffset(root, offset);
  if (!read) return [];

  // A call, a declaration or the keyword of its name, each by the name a
  // step calls it by, and a tag name.
  const { value, parent } = read;
  let name = null;
  if (isCallStep(value)) {
    name = splitAddress(value.get('name').name)[1];
  } else if (isBindStep(value)) {
    const declared = bindingDeclarationOf(read).name;
    name = isTagName(declared) ? declared : splitAddress(declared)[1];
  } else if (isKeyword(value) && isBindStep(parent.value) && parent.parts[0] === read) {
    name = splitAddress(value.name)[1];
  } else if (isTag(value)) {
    name = tagNameOf(value.name);
  }

  if (!name) return [];

  const occurrences = isTagName(name)
    ? findNameOccurrences(root, name.slice(TAG_SIGIL.length), TAG_SPELLING)
    : findNameOccurrences(root, name);
  return occurrences.map(spanOf);
}

// ── Document Symbols ──────────────────────────────────────────

// documentSymbols(root, scope) → the declarations of a document, each
// shown as a label, a verb or a value, a label a kind the document declares
// under a name, by its chain or by its page alone, or one the root holds
// [QSNAM#address].
export function documentSymbols(root, scope) {
  if (!root) return [];

  const labels = new Set();
  walkParts(root, (read) => {
    if (kindOf(read.value) === 'doc') return false;
    if (bindingDeclarationOf(read)?.kind === 'tag') labels.add(read.value.get('name').name);
  });
  const isLabelName = name => labels.has(name) || isLabel(scope, name);

  const symbols = [];
  walkParts(root, (read) => {
    if (kindOf(read.value) === 'doc') return false;
    const decl = bindingDeclarationOf(read);
    if (decl === null) return;
    symbols.push({
      name: decl.name,
      kind: decl.kind === 'value' && declaresVerbIn(read.value, scope, isLabelName) ? 'verb' : decl.kind,
      ...spanOf(read)
    });
  });
  return symbols;
}

// ── Folding ───────────────────────────────────────────────────

// foldingRangesOf(root, source) → the line ranges an editor folds, from
// 0: a declaration, a doc and a quote that span lines, the line of a
// closer that stands alone left open; a doc folds as a comment.
const folds = read => isBindStep(read.value) || kindOf(read.value) === 'doc' || (kindOf(read.value) === 'quote' && read.content !== undefined);

export function foldingRangesOf(root, source) {
  if (!root) return [];
  const lines = source.split(/\r?\n/);
  const ranges = [];
  walkParts(root, (read) => {
    if (!folds(read)) return;
    const startLine = read.span.start.line - 1;
    const lastLine = read.span.end.line - 1;
    const closerAlone = /^\s*(~~\||\))\s*$/.test(lines[lastLine]);
    const endLine = closerAlone ? lastLine - 1 : lastLine;
    if (endLine > startLine) ranges.push({ startLine, endLine, kind: kindOf(read.value) === 'doc' ? 'comment' : 'region' });
  });
  return ranges;
}

// ── Signature Help ────────────────────────────────────────────

export async function signatureHelpAtOffset(root, source, offset) {
  if (!root) return null;

  const call = callAround(root, source, offset);
  if (!call) return null;

  const name = call.value.get('name').name;
  const scope = await langRuntime();
  const shown = shownFor(scope, name, await subjectKindsAt(source, call.span.start.offset));
  if (shown === undefined || (call.parts.length === 0 && shown.inputs.length === 0)) return null;

  const inputs = shown.inputs;
  const docContents = await pageContents(shown.address.literal);

  // The active parameter of the protocol is the input whose modifier the
  // cursor stands on or after: one per modifier that ends before it.
  const activeParameter = call.parts.filter(modifier => modifier.span.end.offset < offset).length;

  return {
    label: [name, ...inputs].join(' '),
    documentation: tidyProse(docContents[0] ?? ''),
    parameters: inputs.map(input => ({ label: input })),
    activeParameter
  };
}

// The call the cursor writes the words of: the narrowest call with words
// that holds it, or the call that spaces before the cursor follow, a verb
// taking inputs among them.
function callAround(root, source, offset) {
  for (let read = partAtOffset(root, offset); read; read = read.parent) {
    if (isCallStep(read.value) && read.parts.length > 0) return read;
  }
  let followed = null;
  walkParts(root, (candidate) => {
    if (isCallStep(candidate.value) && /^[ \t]+$/.test(source.slice(candidate.span.end.offset, offset))) followed = candidate;
  });
  return followed;
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

// The verbs of the root, which `tokenize` paints as words.
let _rootVerbNames = null;
async function rootVerbNames() {
  if (_rootVerbNames) return _rootVerbNames;
  _rootVerbNames = verbNames(await langRuntime());
  return _rootVerbNames;
}

// semanticTokensFor(source) → { data: Uint32Array }, five integers per
// token as the protocol encodes them, a token that spans lines split
// into one per line.
export async function semanticTokensFor(source) {
  const tokens = tokenize(source, await rootVerbNames());
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
