// The features of the language server, pure functions over the public API
// of the core that `server.mjs` maps to the protocol, which ask the language
// what a literal and a page answer [D367], [D371].

import {
  parse, ParseError,
  langRuntime, evalQuery,
  partOf,
  partAtOffset,
  findNameOccurrences,
  tagWrittenBy,
  tagHeadEnd,
  bindingNamesVisibleAt,
  holdsALiteral,
  bodyRuns,
  declaresKind,
  splitAddress,
  CALL_SPELLING,
  TAG_SPELLING,
  walkParts,
  isNameStart,
  isNameContinue,
  isKeyword,
  makeTag,
  isTag,
  isCallStep,
  isBindStep,
  isGroupStep,
  isFailStep,
  typeOf,
  shownFor,
  answerKindsOf,
  kindsOfWalk,
  servesTheSubject,
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

const kindOf = value => typeOf(value).name;

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

// The prose of the page at an address as `doc | prose` answers it, read once
// for each address, a verb's at the address the tool shows for it [D371].
const proseOfPages = new Map();
async function proseOfThePage(address) {
  if (!proseOfPages.has(address)) proseOfPages.set(address, tidyProse(await evalQuery(`${address} | doc | prose !| ""`)));
  return proseOfPages.get(address);
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

// The role of a node of the root, a label, a verb or a value [D371].
function roleOfNode(scope, address) {
  if (isLabel(scope, address)) return 'label';
  return isVerb(scope, address) ? 'verb' : 'value';
}

// The role of a declaration of the document, a label, a verb as the core
// reads it or a value a reader named [QSBLD#kind], [D371].
function roleOf(bind, scope, isLabelName) {
  if (declaresKind(bind)) return 'label';
  const name = bind.get('name').name;
  const isAVerb = nodeOf(scope, name) !== null ? isVerb(scope, name) : declaresVerb(name, bodyRuns(bind.get('body')), isLabelName);
  return isAVerb ? 'verb' : 'value';
}

// ── Completion ────────────────────────────────────────────────

// The names of the root, its verbs by their last names and its tags, read once.
let _verbCompletions = null;
let _tagCompletions = null;

async function nameCompletions() {
  if (_verbCompletions) return _verbCompletions;
  const scope = await langRuntime();
  _verbCompletions = [];
  for (const name of verbNames(scope)) {
    if (splitAddress(name)[0] !== null) continue;
    const item = await verbCompletion(scope, name, null);
    if (item !== null) _verbCompletions.push(item);
  }
  return _verbCompletions;
}

// The completion of a verb as a call of it from a subject of the kinds
// shows it, or with no kinds, the form of its call and its page; null for
// a name that reaches no verb.
async function verbCompletion(scope, name, kinds) {
  const shown = shownFor(scope, name, kinds);
  if (shown === undefined) return null;
  return { label: name, role: 'verb', detail: callFormOf(shown), documentation: await proseOfThePage(shown.address.literal) };
}

async function tagCompletions() {
  if (_tagCompletions) return _tagCompletions;
  const scope = await langRuntime();
  _tagCompletions = [];
  for (const address of nodeAddresses(scope)) {
    const label = makeTag(address).literal;
    _tagCompletions.push({ label, role: roleOfNode(scope, address), detail: 'a name of the root', documentation: await proseOfThePage(label) });
  }
  return _tagCompletions;
}

// After the sign a tag opens with, the literal of a tag of no name yet, the
// cursor completes a tag name alone.
const SIGN_OF_A_TAG = makeTag('').literal;
const followsTheSignOfATag = (source, offset) => typeof source === 'string' && offset >= SIGN_OF_A_TAG.length
  && source.startsWith(SIGN_OF_A_TAG, offset - SIGN_OF_A_TAG.length);

// After a value the cursor completes the verbs that serve it and the names
// the document declares; where the steps before it name no kind, every name.
export async function completionsAtOffset(root, offset, source = null) {
  const scope = await langRuntime();
  if (followsTheSignOfATag(source, offset)) {
    return withDeclaredNames([...(await tagCompletions())], root, offset, [TAG_SPELLING], scope);
  }
  const subject = typeof source === 'string' ? await subjectAt(source, offset) : null;
  if (subject !== null) {
    const verbs = [];
    for (const name of verbsServing(scope, subject).keys()) {
      const item = await verbCompletion(scope, name, subject.kinds);
      if (item !== null) verbs.push(item);
    }
    return withDeclaredNames(verbs, subject.root, subject.end, [CALL_SPELLING], scope);
  }
  const everyName = [...(await nameCompletions()), ...(await tagCompletions())];
  return withDeclaredNames(everyName, root, offset, [CALL_SPELLING, TAG_SPELLING], scope);
}

// The items with the names the document declares that the offset sees, each
// by the name a step calls it by and the role of its declaration, where no
// item of its label stands.
function withDeclaredNames(items, root, offset, spellings, scope) {
  if (!root) return items;
  for (const spelling of spellings) {
    const ofTags = spelling === TAG_SPELLING;
    const { names, isLabelName } = declaredAt(root, offset, spelling, scope);
    for (const [name, read] of names) {
      const label = ofTags ? makeTag(name).literal : name;
      if ((!ofTags && splitAddress(name)[0] !== null) || items.some(item => item.label === label)) continue;
      items.push({ label, role: roleOf(read.value, scope, isLabelName), detail: ofTags ? "a reader's kind" : "a reader's name", documentation: null });
    }
  }
  return items;
}

// The names of the document a step may call at an offset under a spelling,
// the body of a verb found by the labels declared before the offset, and
// whether a name is a label's there [QSNAM#verb], [D371].
function declaredAt(root, offset, spelling, scope) {
  const labelNameIn = labels => name => labels.has(name) || isLabel(scope, name);
  let labelNameBefore = null;
  const declaresAVerb = read => roleOf(read.value, scope, labelNameBefore ??= labelNameIn(bindingNamesVisibleAt(root, offset, TAG_SPELLING))) === 'verb';
  const labels = bindingNamesVisibleAt(root, offset, TAG_SPELLING, declaresAVerb);
  return { names: spelling === TAG_SPELLING ? labels : bindingNamesVisibleAt(root, offset, spelling, declaresAVerb), isLabelName: labelNameIn(labels) };
}

// The declaration of the document the name a part reads reaches, by the
// spelling it is read under, where the part stands, or undefined.
function declarationOf(root, read, { name, spelling }, scope) {
  return declaredAt(root, read.span.start.offset, spelling, scope).names.get(name);
}

// Where the name being typed before the cursor begins.
function wordStartBefore(source, offset) {
  let start = offset;
  while (start > 0 && (isNameContinue(source[start - 1]) || isNameStart(source[start - 1]))) start--;
  return start;
}

// The subject of the step at the cursor, the word being typed aside: the
// steps before it, where the source with a step at the cursor parses, that
// step follows `|`, and the steps before it name the kinds of the value they
// answer; a step after `!|` takes an error, and has none. The parser tells
// the combinator, the grammar written once.
async function subjectAt(source, offset) {
  const start = wordStartBefore(source, offset);
  const text = `${source.slice(0, start)}${STEP_AT_CURSOR}`;
  let root;
  try {
    root = partOf(parse(text));
  } catch {
    return null;
  }
  const steps = stepsOf(root);
  if (steps.length < 2 || steps[steps.length - 1].combinator === '!|') return null;
  const subject = await subjectOfSteps(steps.slice(0, -1), null, text);
  return subject === null ? null : { ...subject, root, end: start };
}

const STEP_AT_CURSOR = ' it';

function stepsOf(pipeline) {
  return pipeline.parts.map(read => (isFailStep(read.value) ? { combinator: '!|', read: read.parts[0] } : { combinator: '|', read }));
}

// The subject the steps answer from a subject, the kinds of its value and the
// value where a literal step answers it: the subject itself through a
// declaration and a `!|` step, and the kinds the `returns` of a verb that
// serves it names [QSBLD#answer]; null where a step answers no declared kind.
async function subjectOfSteps(steps, subject, text) {
  let answered = subject;
  for (const { combinator, read } of steps) {
    if (combinator === '!|') continue;
    answered = await subjectAfterStep(read, answered, text);
  }
  return answered;
}

async function subjectAfterStep(read, subject, text) {
  const step = read.value;
  if (isBindStep(step)) return subject;
  if (isGroupStep(step)) return await subjectOfSteps(stepsOf(read), subject, text);
  if (holdsALiteral(step)) return await subjectOfLiteral(text.slice(read.span.start.offset, read.span.end.offset));
  if (subject === null) return null;
  const scope = await langRuntime();
  const reached = verbsServing(scope, subject).get(step.get('name').name);
  const kinds = reached === undefined ? null : answerKindsOf(scope, nodeOf(scope, reached.address.name), subject.kinds);
  return kinds === null ? null : { kinds };
}

// What a literal answers run alone over the root, closed [QSLIT#closed], a
// refusal of its constructor at rest, and the walk of its tags, the last kept [D371].
let lastLiteral = { literal: null, subject: null };
async function subjectOfLiteral(literal) {
  if (lastLiteral.literal !== literal) {
    const value = await evalQuery(`${literal}\n!| it`);
    lastLiteral = { literal, subject: { kinds: [...kindsOfWalk(value)], value } };
  }
  return lastLiteral.subject;
}

// The verbs a subject reaches by name, those that serve its value where a
// literal answers it, as its call would [QSDSP#tagname], [D371].
function verbsServing(scope, { kinds, value }) {
  const reached = verbsReaching(scope, kinds);
  if (value === undefined) return reached;
  return new Map([...reached].filter(([, { address }]) => servesTheSubject(nodeOf(scope, address.name), value)));
}

// ── Hover ─────────────────────────────────────────────────────

export async function hoverAtOffset(root, source, offset) {
  if (!root) return null;

  const read = partAtOffset(root, offset);
  if (!read) return null;
  const { value } = read;

  if (isCallStep(value)) return await hoverForCall(read, root, source);
  if (isTag(value)) return await hoverForTag(value.name, spanOf(read));
  if (isOnTagHead(read, offset)) return await hoverForTag(tagWrittenBy(read), { startOffset: read.span.start.offset, endOffset: tagHeadEnd(read) });
  if (kindOf(value) === 'path') return await hoverForPath(read, source);
  if (isKeyword(value)) return { content: `keyword \`${value.literal}\``, ...spanOf(read) };
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
    const heading = `**${name}** — ${callFormOf(shown)}`;
    return { content: markdownHardBreaks([heading, '', await proseOfThePage(shown.address.literal)].join('\n')), ...spanOf(read) };
  }
  const docs = await proseOfTheDocs(declarationOf(root, read, { name, spelling: CALL_SPELLING }, scope), source);
  if (docs.length === 0) return null;
  return { content: markdownHardBreaks([`**${name}** — a reader's name`, '', tidyProse(docs.join('\n'))].join('\n')), ...spanOf(read) };
}

// The prose of each doc of a declaration of the document, each run alone,
// closed [QSLIT#closed], through `prose` [D371].
async function proseOfTheDocs(declaration, source) {
  return await Promise.all((declaration?.value.get('docs') ?? []).map(doc => {
    const { start, end } = partOf(doc).span;
    return evalQuery(`${source.slice(start.offset, end.offset)}\n| prose !| ""`);
  }));
}

// A click on the head of a tagged literal, the `::Tag` of `::Tag[…]`; the
// head of an error literal, `::Tag!{…}`, is a part of its own [QSERR#rest].
function isOnTagHead(read, offset) {
  return tagWrittenBy(read) !== null && offset < tagHeadEnd(read);
}

// The page of a tag a part names or writes, over the span of its head.
async function hoverForTag(tag, head) {
  const scope = await langRuntime();
  if (nodeOf(scope, tag) === null) return null;
  const literal = makeTag(tag).literal;
  return { content: markdownHardBreaks([`**${literal}** — a name of the root`, '', await proseOfThePage(literal)].join('\n')), ...head };
}

// A path shows its literal over the page of its kind.
async function hoverForPath(read, source) {
  const written = source.slice(read.span.start.offset, read.span.end.offset);
  return { content: markdownHardBreaks([`path \`${written}\``, '', await proseOfThePage(typeOf(read.value).literal)].join('\n')), ...spanOf(read) };
}

// ── Go to Definition ──────────────────────────────────────────

function nameAt(read, offset) {
  if (isCallStep(read.value)) return { name: read.value.get('name').name, spelling: CALL_SPELLING };
  if (isTag(read.value)) return { name: read.value.name, spelling: TAG_SPELLING };
  return isOnTagHead(read, offset) ? { name: tagWrittenBy(read), spelling: TAG_SPELLING } : null;
}

// The declaration a name, a tag name or the head of a tag a part writes
// resolves to: the last one the document makes visible at the cursor,
// else the catalog's.
export async function definitionAtOffset(root, offset, catalogCtx) {
  if (!root) return null;

  const read = partAtOffset(root, offset);
  const named = read === null ? null : nameAt(read, offset);
  if (named === null) return null;

  const declaration = declarationOf(root, read, named, await langRuntime());
  if (declaration !== undefined) return spanOf(declaration);

  return catalogCtx ? catalogDeclarationOf(catalogCtx, named.name) : null;
}

// The name a declaration binds and the spelling a step reads it under, a
// label's that of a tag [QSBLD#kind], or null.
function declaredNameOf({ value }) {
  if (!isBindStep(value)) return null;
  return { name: value.get('name').name, spelling: declaresKind(value) ? TAG_SPELLING : CALL_SPELLING };
}

// ── Find References ───────────────────────────────────────────

// The name a part names with the spelling it is read under: a call and a
// declaration by the name a step calls, a label by its tag.
function referencedAt(read) {
  const { value, parent } = read;
  if (isCallStep(value)) return { name: splitAddress(value.get('name').name)[1], spelling: CALL_SPELLING };
  if (isBindStep(value)) {
    const declared = declaredNameOf(read);
    return declared.spelling === TAG_SPELLING ? declared : { name: splitAddress(declared.name)[1], spelling: CALL_SPELLING };
  }
  if (isKeyword(value) && isBindStep(parent.value) && parent.parts[0] === read) return { name: splitAddress(value.name)[1], spelling: CALL_SPELLING };
  return isTag(value) ? { name: value.name, spelling: TAG_SPELLING } : null;
}

export function referencesAtOffset(root, offset) {
  if (!root) return [];

  const read = partAtOffset(root, offset);
  const named = read === null ? null : referencedAt(read);
  if (named === null) return [];

  return findNameOccurrences(root, named.name, named.spelling).map(spanOf);
}

// ── Document Symbols ──────────────────────────────────────────

// documentSymbols(root, scope) → the declarations of a document, each by
// its role, a label written as its tag, a verb or a value [D371].
export function documentSymbols(root, scope) {
  if (!root) return [];

  const labels = new Set();
  walkParts(root, (read) => {
    if (kindOf(read.value) === 'doc') return false;
    if (declaredNameOf(read)?.spelling === TAG_SPELLING) labels.add(read.value.get('name').name);
  });
  const isLabelName = name => labels.has(name) || isLabel(scope, name);

  const symbols = [];
  walkParts(root, (read) => {
    if (kindOf(read.value) === 'doc') return false;
    const declared = declaredNameOf(read);
    if (declared === null) return;
    symbols.push({
      name: declared.spelling === TAG_SPELLING ? makeTag(declared.name).literal : declared.name,
      role: roleOf(read.value, scope, isLabelName),
      ...spanOf(read)
    });
  });
  return symbols;
}

// ── Folding ───────────────────────────────────────────────────

// foldingRangesOf(root) → the lines a declaration, a doc and a quote span,
// from 0 to where the last part of its node ends, a doc's where its text
// ends; a doc folds as a comment [D371].
const folds = read => isBindStep(read.value) || kindOf(read.value) === 'doc' || (kindOf(read.value) === 'quote' && read.content !== undefined);

const lastLineOf = read => (read.text ?? read.span).end.line - 1;

export function foldingRangesOf(root) {
  if (!root) return [];
  const ranges = [];
  walkParts(root, (read) => {
    if (!folds(read)) return;
    const startLine = read.span.start.line - 1;
    const endLine = kindOf(read.value) === 'doc' ? lastLineOf(read) : read.parts.length === 0 ? startLine : lastLineOf(read.parts.at(-1));
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

  // The active parameter of the protocol is the input whose modifier the
  // cursor stands on or after: one per modifier that ends before it.
  const activeParameter = call.parts.filter(modifier => modifier.span.end.offset < offset).length;

  return {
    label: [name, ...inputs].join(' '),
    documentation: await proseOfThePage(shown.address.literal),
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

// The type of semantic token of the protocol each kind of `tokenize` is coated
// by, a path a property as the keys it reads; a kind with none, a bracket, a
// gap or the source past the parse, sends no token [D371].
const TYPE_OF_KIND = {
  verb:        'function',
  name:        'variable',
  declaration: 'keyword',
  keyword:     'property',
  path:        'property',
  tag:         'struct',
  string:      'string',
  quote:       'string',
  null:        'number',
  boolean:     'number',
  number:      'number',
  regex:       'regexp',
  doc:         'comment',
  comment:     'comment',
  error:       'keyword',
  fail:        'keyword'
};

// The types of the legend the server answers `initialize` with, each once.
export const SEMANTIC_TOKEN_TYPES = [...new Set(Object.values(TYPE_OF_KIND))];

const TYPE_INDEX_OF_KIND = new Map(Object.entries(TYPE_OF_KIND).map(([kind, type]) => [kind, SEMANTIC_TOKEN_TYPES.indexOf(type)]));

// The verbs of the root, which `tokenize` paints as verbs.
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
    const typeIndex = TYPE_INDEX_OF_KIND.get(tok.kind);
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
