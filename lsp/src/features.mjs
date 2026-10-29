// [QSQUO#step], [QSLSP#server]

import {
  parseSource, SourceParseError,
  langRuntime, evalQuery,
  partOf,
  partAtOffset,
  findNameOccurrences,
  tagWrittenBy,
  tagHeadEnd,
  bindingNamesVisibleAt,
  holdsALiteral,
  isVerbBody,
  declaresKind,
  splitAddress,
  CALL_SPELLING,
  TAG_SPELLING,
  forEachPart,
  isNameStart,
  isNameContinue,
  isKeyword,
  makeTag,
  isTag,
  isCallStep,
  isBindStep,
  isGroupStep,
  isFailStep,
  tagOf,
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

const kindOf = value => tagOf(value).name;

function tidyPage(content) {
  return content.replace(/\n{3,}/g, '\n\n');
}

function markdownHardBreaks(text) {
  return text.split('\n').map(l => l + '  ').join('\n');
}

// [QSLSP#server]
const contentOfPages = new Map();
async function contentOfThePage(address) {
  if (!contentOfPages.has(address)) contentOfPages.set(address, tidyPage(await evalQuery(`${address} | doc | content !| ""`)));
  return contentOfPages.get(address);
}

const callFormOf = shown => [shown.address.literal, ...shown.inputs].join(' ');

// [QSSLF#catalog]
async function subjectKindsAt(source, offset) {
  return (await subjectAt(source, offset))?.kinds ?? null;
}

const spanOf = read => ({ startOffset: read.span.start.offset, endOffset: read.span.end.offset });
const headOf = read => ({ startOffset: read.span.start.offset, endOffset: tagHeadEnd(read) });

export function parseDocument(source, uri) {
  const diagnostics = [];
  let root = null;
  try {
    root = partOf(parseSource(source, { uri }));
  } catch (e) {
    if (e instanceof SourceParseError && e.location) {
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

// [QSDSP#residence]
export function buildCatalogIndex(catalogRoot) {
  const index = new Map();
  if (!catalogRoot) return index;
  forEachPart(catalogRoot, (read) => {
    if (kindOf(read.value) === 'doc') return false;
    if (isBindStep(read.value)) index.set(read.value.get('name').name, spanOf(read));
  });
  return index;
}

// [QSNAM#reach]
function catalogDeclarationOf({ index, scope }, name) {
  const reach = bareNameReach(scope, name);
  if (reach !== null) return index.get(reach.record.get('name').name) ?? null;
  for (const [, record] of residencesOf(scope, name)) {
    const span = index.get(record.get('name').name);
    if (span !== undefined) return span;
  }
  return index.get(name) ?? null;
}

// [QSLSP#server]
function roleOfNode(scope, address) {
  if (isLabel(scope, address)) return 'label';
  return isVerb(scope, address) ? 'verb' : 'value';
}

// [QSBLD#kind], [QSLSP#server]
function roleOf(bind, scope, isLabelName) {
  if (declaresKind(bind)) return 'label';
  const name = bind.get('name').name;
  const isAVerb = nodeOf(scope, name) !== null ? isVerb(scope, name) : declaresVerb(name, isVerbBody(bind.get('body')), isLabelName);
  return isAVerb ? 'verb' : 'value';
}

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

async function verbCompletion(scope, name, kinds) {
  const shown = shownFor(scope, name, kinds);
  if (shown === undefined) return null;
  return { label: name, role: 'verb', detail: callFormOf(shown), documentation: await contentOfThePage(shown.address.literal) };
}

async function tagCompletions() {
  if (_tagCompletions) return _tagCompletions;
  const scope = await langRuntime();
  _tagCompletions = [];
  for (const address of nodeAddresses(scope)) {
    const label = makeTag(address).literal;
    _tagCompletions.push({ label, role: roleOfNode(scope, address), detail: 'a name of the root', documentation: await contentOfThePage(label) });
  }
  return _tagCompletions;
}

const SIGN_OF_A_TAG = makeTag('').literal;
const followsTheSignOfATag = (source, offset) => typeof source === 'string' && offset >= SIGN_OF_A_TAG.length
  && source.startsWith(SIGN_OF_A_TAG, offset - SIGN_OF_A_TAG.length);

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

// [QSNAM#verb], [QSLSP#server]
function declaredAt(root, offset, spelling, scope) {
  const labelNameIn = labels => name => labels.has(name) || isLabel(scope, name);
  let labelNameBefore = null;
  const declaresAVerb = read => roleOf(read.value, scope, labelNameBefore ??= labelNameIn(bindingNamesVisibleAt(root, offset, TAG_SPELLING))) === 'verb';
  const labels = bindingNamesVisibleAt(root, offset, TAG_SPELLING, declaresAVerb);
  return { names: spelling === TAG_SPELLING ? labels : bindingNamesVisibleAt(root, offset, spelling, declaresAVerb), isLabelName: labelNameIn(labels) };
}

function declarationOf(root, read, { name, spelling }, scope) {
  return declaredAt(root, read.span.start.offset, spelling, scope).names.get(name);
}

function wordStartBefore(source, offset) {
  let start = offset;
  while (start > 0 && (isNameContinue(source[start - 1]) || isNameStart(source[start - 1]))) start--;
  return start;
}

async function subjectAt(source, offset) {
  const start = wordStartBefore(source, offset);
  const text = `${source.slice(0, start)}${STEP_AT_CURSOR}`;
  let root;
  try {
    root = partOf(parseSource(text));
  } catch {
    return null;
  }
  const steps = stepsOf(root);
  if (steps.length < 2 || steps[steps.length - 1].combinator === '!|') return null;
  const subject = await subjectOfSteps(steps.slice(0, -1), null, text);
  return subject === null ? null : { ...subject, root, end: start };
}

// [QSLSP#server]
const STEP_AT_CURSOR = ' it';

function stepsOf(pipeline) {
  return pipeline.parts.map(read => (isFailStep(read.value) ? { combinator: '!|', read: read.parts[0] } : { combinator: '|', read }));
}

// [QSLSP#offer]
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

// [QSLIT#closed], [QSLSP#offer]
let lastLiteral = { literal: null, subject: null };
async function subjectOfLiteral(literal) {
  if (lastLiteral.literal !== literal) {
    const value = await evalQuery(`${literal}\n!| it`);
    lastLiteral = { literal, subject: { kinds: [...kindsOfWalk(value)], value } };
  }
  return lastLiteral.subject;
}

// [QSDSP#tagname], [QSLSP#server]
function verbsServing(scope, { kinds, value }) {
  const reached = verbsReaching(scope, kinds);
  if (value === undefined) return reached;
  return new Map([...reached].filter(([, { address }]) => {
    const record = nodeOf(scope, address.name);
    return record === null || servesTheSubject(record, value);
  }));
}

export async function hoverAtOffset(root, source, offset) {
  if (!root) return null;

  const read = partAtOffset(root, offset);
  if (!read) return null;
  const { value } = read;

  if (isCallStep(value)) return await hoverForCall(read, root, source);
  if (isTag(value)) return await hoverForTag(value.name, spanOf(read));
  if (isOnTagHead(read, offset)) return await hoverForTag(tagWrittenBy(read), headOf(read));
  if (kindOf(value) === 'path') return await hoverForPath(read, source);
  if (isKeyword(value)) return { content: `keyword \`${value.literal}\``, ...spanOf(read) };
  return null;
}

async function hoverForCall(read, root, source) {
  const name = read.value.get('name').name;
  const scope = await langRuntime();
  const shown = shownFor(scope, name, await subjectKindsAt(source, read.span.start.offset));
  if (shown !== undefined) {
    const heading = `**${name}** — ${callFormOf(shown)}`;
    return { content: markdownHardBreaks([heading, '', await contentOfThePage(shown.address.literal)].join('\n')), ...spanOf(read) };
  }
  const docs = await contentOfTheDocs(declarationOf(root, read, { name, spelling: CALL_SPELLING }, scope), source);
  if (docs.length === 0) return null;
  return { content: markdownHardBreaks([`**${name}** — a reader's name`, '', tidyPage(docs.join('\n'))].join('\n')), ...spanOf(read) };
}

// [QSLIT#closed], [QSLSP#server]
async function contentOfTheDocs(declaration, source) {
  return await Promise.all((declaration?.value.get('docs') ?? []).map(doc => {
    const { start, end } = partOf(doc).span;
    return evalQuery(`${source.slice(start.offset, end.offset)}\n| content !| ""`);
  }));
}

// [QSERR#rest]
function isOnTagHead(read, offset) {
  return tagWrittenBy(read) !== null && offset < tagHeadEnd(read);
}

async function hoverForTag(tag, head) {
  const scope = await langRuntime();
  if (nodeOf(scope, tag) === null) return null;
  const literal = makeTag(tag).literal;
  return { content: markdownHardBreaks([`**${literal}** — a name of the root`, '', await contentOfThePage(literal)].join('\n')), ...head };
}

async function hoverForPath(read, source) {
  const written = source.slice(read.span.start.offset, read.span.end.offset);
  return { content: markdownHardBreaks([`path \`${written}\``, '', await contentOfThePage(tagOf(read.value).literal)].join('\n')), ...spanOf(read) };
}

function nameAt(read, offset) {
  if (isCallStep(read.value)) return { name: read.value.get('name').name, spelling: CALL_SPELLING };
  if (isTag(read.value)) return { name: read.value.name, spelling: TAG_SPELLING };
  return isOnTagHead(read, offset) ? { name: tagWrittenBy(read), spelling: TAG_SPELLING } : null;
}

export async function definitionAtOffset(root, offset, catalogCtx) {
  if (!root) return null;

  const read = partAtOffset(root, offset);
  const named = read === null ? null : nameAt(read, offset);
  if (named === null) return null;

  const declaration = declarationOf(root, read, named, await langRuntime());
  if (declaration !== undefined) return spanOf(declaration);

  return catalogCtx ? catalogDeclarationOf(catalogCtx, named.name) : null;
}

// [QSBLD#kind]
function declaredNameOf({ value }) {
  if (!isBindStep(value)) return null;
  return { name: value.get('name').name, spelling: declaresKind(value) ? TAG_SPELLING : CALL_SPELLING };
}

function referencedAt(read, offset) {
  const { value, parent } = read;
  if (isOnTagHead(read, offset)) return { name: tagWrittenBy(read), spelling: TAG_SPELLING };
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
  const named = read === null ? null : referencedAt(read, offset);
  if (named === null) return [];

  return findNameOccurrences(root, named.name, named.spelling).map(occurrence => (tagWrittenBy(occurrence) === null ? spanOf(occurrence) : headOf(occurrence)));
}

// [QSLSP#server]
export function documentSymbols(root, scope) {
  if (!root) return [];

  const labels = new Set();
  forEachPart(root, (read) => {
    if (kindOf(read.value) === 'doc') return false;
    if (declaredNameOf(read)?.spelling === TAG_SPELLING) labels.add(read.value.get('name').name);
  });
  const isLabelName = name => labels.has(name) || isLabel(scope, name);

  const symbols = [];
  forEachPart(root, (read) => {
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

const folds = read => isBindStep(read.value) || kindOf(read.value) === 'doc' || (kindOf(read.value) === 'quote' && read.content !== undefined);

const lastLineOf = read => (read.text ?? read.span).end.line - 1;

export function foldingRangesOf(root) {
  if (!root) return [];
  const ranges = [];
  forEachPart(root, (read) => {
    if (!folds(read)) return;
    const startLine = read.span.start.line - 1;
    const endLine = kindOf(read.value) === 'doc' ? lastLineOf(read) : read.parts.length === 0 ? startLine : lastLineOf(read.parts.at(-1));
    if (endLine > startLine) ranges.push({ startLine, endLine, kind: kindOf(read.value) === 'doc' ? 'comment' : 'region' });
  });
  return ranges;
}

export async function signatureHelpAtOffset(root, source, offset) {
  if (!root) return null;

  const call = callAround(root, source, offset);
  if (!call) return null;

  const name = call.value.get('name').name;
  const scope = await langRuntime();
  const shown = shownFor(scope, name, await subjectKindsAt(source, call.span.start.offset));
  if (shown === undefined || (call.parts.length === 0 && shown.inputs.length === 0)) return null;

  const inputs = shown.inputs;

  const activeParameter = call.parts.filter(modifier => modifier.span.end.offset < offset).length;

  return {
    label: [name, ...inputs].join(' '),
    documentation: await contentOfThePage(shown.address.literal),
    parameters: inputs.map(input => ({ label: input })),
    activeParameter
  };
}

// [QSSYN#comment]
function callAround(root, source, offset) {
  for (let read = partAtOffset(root, offset); read; read = read.parent) {
    if (isCallStep(read.value) && read.parts.length > 0) return read;
  }
  let followed = null;
  forEachPart(root, (candidate) => {
    const end = candidate.span.end.offset;
    if (isCallStep(candidate.value) && end < offset && (followed === null || end >= followed.span.end.offset)) followed = candidate;
  });
  return followed !== null && readsAsWhitespace(source.slice(followed.span.end.offset, offset)) ? followed : null;
}

function readsAsWhitespace(text) {
  try {
    return parseSource(text).length === 0;
  } catch {
    return false;
  }
}

// [D491]
const TYPE_OF_KIND = {
  verb:        ['function', 'defaultLibrary'],
  name:        ['variable'],
  declaration: ['function', 'declaration'],
  keyword:     ['property'],
  path:        ['property'],
  tag:         ['struct'],
  string:      ['string'],
  quote:       ['string'],
  null:        ['number'],
  boolean:     ['number'],
  number:      ['number'],
  regex:       ['regexp'],
  doc:         ['comment', 'documentation'],
  comment:     ['comment'],
  error:       ['keyword'],
  fail:        ['keyword']
};

export const SEMANTIC_TOKEN_TYPES = [...new Set(Object.values(TYPE_OF_KIND).map(([type]) => type))];

export const SEMANTIC_TOKEN_MODIFIERS = [...new Set(Object.values(TYPE_OF_KIND).flatMap(([, ...modifiers]) => modifiers))];

const CODE_OF_KIND = new Map(Object.entries(TYPE_OF_KIND).map(([kind, [type, ...modifiers]]) => [kind, {
  type: SEMANTIC_TOKEN_TYPES.indexOf(type),
  modifiers: modifiers.reduce((bits, modifier) => bits | (1 << SEMANTIC_TOKEN_MODIFIERS.indexOf(modifier)), 0)
}]));

let _rootVerbNames = null;
async function rootVerbNames() {
  if (_rootVerbNames) return _rootVerbNames;
  _rootVerbNames = verbNames(await langRuntime());
  return _rootVerbNames;
}

export async function semanticTokensFor(source) {
  const tokens = tokenize(source, await rootVerbNames());
  const data = [];
  let prevLine = 0;
  let prevChar = 0;
  const offsetToLineChar = buildLineCharIndex(source);
  for (const tok of tokens) {
    const code = CODE_OF_KIND.get(tok.kind);
    if (code === undefined) continue;
    let segStart = tok.start;
    while (segStart < tok.end) {
      const { line: segLine, char: segChar } = offsetToLineChar(segStart);
      const segLineEnd = offsetOfLineEnd(source, segStart);
      const segEnd = Math.min(tok.end, segLineEnd);
      const segLen = segEnd - segStart;
      if (segLen > 0) {
        const dLine = segLine - prevLine;
        const dChar = dLine === 0 ? segChar - prevChar : segChar;
        data.push(dLine, dChar, segLen, code.type, code.modifiers);
        prevLine = segLine;
        prevChar = segChar;
      }
      segStart = segEnd + (segEnd < tok.end ? 1 : 0);
    }
  }
  return { data };
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
