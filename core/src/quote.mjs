// Code as data — the steps of a quote.
//
// A quote is a vector of steps under the code tag `::quote` [D8], and
// this module is the one place that turns the parser's tree into steps
// and steps back into text. Where the syntax is a literal, the step is
// that literal itself, a nested quote included, and a container literal
// holds the steps of its elements, a pipeline element as its group;
// where the syntax computes, the step is a record, `::call`, `::proj`,
// `::bind` or `::tagged`; the fail track, the distribute and the
// parentheses wrap the quote of their step as `::fail`, `::each` and
// `::group` [D47, D52]. A comment leaves no step. In the call form an
// argument is code the operand runs against an input of its choosing,
// so a call holds each argument as the quote of its pipeline.
//
// A quote read from text keeps the parser's node on its holder and runs
// through it; a quote assembled from data is printed and parsed the
// first time it runs (`astOfQuote`).

import { parse } from './parse.mjs';
import { isPlainCommentStep } from './walk.mjs';
import { canonicalKeywordLiteral } from './keyword-literal.mjs';
import { addStructurallyUnique } from './equality.mjs';
import { printValue, TAG_PAYLOAD_NEEDS_PAREN_RE } from './runtime/print-value.mjs';
import {
  keyword, makeTagKeyword, makeDoc, makeJsonObject, makeJsonArray, makeQuote,
  makeTaggedInstance, makeErrorLiteralStep,
  isQuote, isKeyword, isTagKeyword, isDoc, isVec, isJsonArray, isJsonObject, isQMap, isQSet,
  isErrorValue, TAG_HEADER_SYMBOL, QUOTE_AST_SLOT,
  CALL_TAG, PROJ_TAG, BIND_TAG, TAGGED_TAG, EACH_TAG, FAIL_TAG, GROUP_TAG
} from './types.mjs';

const RECORD_TAG_NAMES  = new Set(['call', 'proj', 'bind', 'tagged']);
const WRAPPER_TAG_NAMES = new Set(['each', 'fail', 'group']);

// ── the tree into steps ────────────────────────────────────────

// quoteOfBody(node) → quote
//
// The quote of a body the parser produced — a pipeline, a lone step the
// parser collapsed out of one — or of nothing, the empty quote. The node
// rides on the quote's holder, so the quote runs through it.
export function quoteOfBody(node) {
  if (node === null) return makeQuote([]);
  return makeQuote(stepsOfBody(node), node);
}

// quoteOfSource(source, uri) → quote — reads text as a quote; blank
// text is the empty quote. A ParseError rides out to the caller.
export function quoteOfSource(source, uri = 'quote') {
  if (source.trim() === '') return makeQuote([]);
  return quoteOfBody(parse(source, { uri }));
}

// A quote literal's value, read once per node: the value is immutable,
// so every evaluation of the literal shares it.
const QUOTE_OF_LITERAL = new WeakMap();

export function quoteOfLiteral(node) {
  let quote = QUOTE_OF_LITERAL.get(node);
  if (quote === undefined) {
    quote = quoteOfBody(node.pipeline);
    QUOTE_OF_LITERAL.set(node, quote);
  }
  return quote;
}

// stepOfNode(node) → step — the step a single node leaves.
export function stepOfNode(node) {
  return STEP_OF_NODE[node.type](node);
}

// eachStepOf(bodyNode) → the `::each` wrapper a `*` step leaves; the
// parentheses after `*` delimit its body [D52].
export function eachStepOf(bodyNode) {
  const body = bodyNode.type === 'ParenGroup' ? bodyNode.pipeline : bodyNode;
  return makeTaggedInstance(EACH_TAG, quoteOfBody(body));
}

function stepsOfBody(node) {
  if (node.type === 'Pipeline') return stepsOfPipeline(node);
  if (isPlainCommentStep(node)) return [];
  return [stepOfNode(node)];
}

// The combinator each step rides resolves as `evalPipeline` resolves
// it: the leading combinator for the head, the unit's own after it, `|`
// wherever a comment's closer stands for it.
function stepsOfPipeline(node) {
  const steps = [];
  let leadingCombinator = node.leadingCombinator;
  node.steps.forEach((unit, index) => {
    const stepNode = index === 0 ? unit : unit.step;
    if (isPlainCommentStep(stepNode)) return;
    const combinator = leadingCombinator ?? (index === 0 ? null : unit.combinator) ?? '|';
    leadingCombinator = null;
    steps.push(stepUnderCombinator(combinator, stepNode));
  });
  return steps;
}

function stepUnderCombinator(combinator, stepNode) {
  if (combinator === '!|') return makeTaggedInstance(FAIL_TAG, makeQuote([stepOfNode(stepNode)], stepNode));
  if (combinator === '*') return eachStepOf(stepNode);
  return stepOfNode(stepNode);
}

function record(tag, fields) {
  return makeTaggedInstance(tag, new Map(fields));
}

function groupOf(pipelineNode) {
  return makeTaggedInstance(GROUP_TAG, quoteOfBody(pipelineNode));
}

function entryStepsOf(entries) {
  return entries.map(entry => [entry.key.name, stepOfNode(entry.value)]);
}

// A path segment reads as an index when the parser saw a canonical
// integer, and as a key otherwise.
function segmentOf(key) {
  const asNumber = Number(key);
  return Number.isInteger(asNumber) && String(asNumber) === key ? asNumber : keyword(key);
}

function callStepOf(node) {
  const fields = [['name', keyword(node.name)]];
  if (node.args !== null) fields.push(['args', Object.freeze(node.args.map(quoteOfBody))]);
  if (node.docs?.length) fields.push(['docs', Object.freeze([...node.docs])]);
  return record(CALL_TAG, fields);
}

function bindStepOf(node) {
  const name = node.key.type === 'BareTypeKeyword' ? makeTagKeyword(node.key.tag) : keyword(node.key.name);
  const fields = [['name', name]];
  if (node.docs?.length) fields.push(['docs', Object.freeze([...node.docs])]);
  if (node.params !== null) fields.push(['params', Object.freeze(node.params.map(param => keyword(param.name)))]);
  if (node.body !== null) fields.push(['body', stepOfNode(node.body)]);
  return record(BIND_TAG, fields);
}

function setStepOf(node) {
  const elements = new Set();
  for (const element of node.elements) addStructurallyUnique(elements, stepOfNode(element));
  return elements;
}

const STEP_OF_NODE = {
  NumberLit:       node => node.value,
  StringLit:       node => node.value,
  BooleanLit:      node => node.value,
  NullLit:         () => null,
  Keyword:         node => keyword(node.name),
  BareTypeKeyword: node => makeTagKeyword(node.tag),
  QuoteLit:        quoteOfLiteral,
  DocLit:          node => makeDoc(node.content),
  VecLit:          node => Object.freeze(node.elements.map(stepOfNode)),
  JsonArrayLit:    node => makeJsonArray(node.elements.map(stepOfNode)),
  SetLit:          setStepOf,
  MapLit:          node => new Map(entryStepsOf(node.entries)),
  JsonObjectLit:   node => makeJsonObject(Object.fromEntries(entryStepsOf(node.entries))),
  ErrorLit:        node => makeErrorLiteralStep(new Map(entryStepsOf(node.entries))),
  TaggedLit:       node => record(TAGGED_TAG, [['tag', makeTagKeyword(node.tag)], ['payload', stepOfNode(node.payload)]]),
  Projection:      node => record(PROJ_TAG, [['path', Object.freeze(node.keys.map(segmentOf))]]),
  OperandCall:     callStepOf,
  BindStep:        bindStepOf,
  ParenGroup:      node => groupOf(node.pipeline),
  Pipeline:        groupOf
};

// ── the tree a quote runs through ──────────────────────────────

// astOfQuote(quote) → AST node
//
// The tree the quote was read from, or, for a quote assembled from
// data, the tree of its printed text, parsed once and kept. The empty
// quote runs as the identity step `/`.
export function astOfQuote(quote) {
  const holder = quote[QUOTE_AST_SLOT];
  if (holder.ast === undefined) {
    holder.ast = parse(quote.length === 0 ? '/' : printQuoteSource(quote), { uri: 'quote' });
  }
  return holder.ast;
}

// ── which values are steps ─────────────────────────────────────

// isStep(value) — the one invariant of a quote: every element is a
// step. A record or a wrapper counts by its tag, since its constructor
// already read its fields.
export function isStep(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return true;
  if (isKeyword(value) || isTagKeyword(value) || isDoc(value) || isQuote(value)) return true;
  if (isErrorValue(value)) return [...value.descriptor.values()].every(isStep);
  const header = value?.[TAG_HEADER_SYMBOL];
  if (header !== undefined) return RECORD_TAG_NAMES.has(header.name) || WRAPPER_TAG_NAMES.has(header.name);
  if (isVec(value) || isJsonArray(value) || isQSet(value)) return [...value].every(isStep);
  if (isQMap(value)) return [...value.values()].every(isStep);
  if (isJsonObject(value)) return Object.values(value).every(isStep);
  return false;
}

// ── steps into text ────────────────────────────────────────────

// printQuoteSource(quote) → the text between `~{` and `}`, in the call
// form of today's surface. A quote read from that text leaves steps
// equal to the ones printed.
export function printQuoteSource(quote) {
  return printSteps(quote);
}

function stepTagOf(step) {
  return step?.[TAG_HEADER_SYMBOL]?.name;
}

function printSteps(steps) {
  return steps.map((step, index) => {
    const stepTag = stepTagOf(step);
    const lead = index === 0 ? '' : ' ';
    if (stepTag === 'fail') return `${lead}!| ${printFailBody(step.payload)}`;
    if (stepTag === 'each') return `${lead}* ${printEachBody(step.payload)}`;
    return (index === 0 ? '' : ' | ') + printStep(step);
  }).join('');
}

function printFailBody(quote) {
  return quote.length === 1 ? printStep(quote[0]) : `(${printSteps(quote)})`;
}

// A lone step after `*` prints bare; anything else takes the
// parentheses that delimit the body, a group inside them keeping its
// own [D52].
function printEachBody(quote) {
  const bare = quote.length === 1 && !WRAPPER_TAG_NAMES.has(stepTagOf(quote[0]));
  return bare ? printStep(quote[0]) : `(${printSteps(quote)})`;
}

function printStep(step) {
  if (isQuote(step)) return `~{${printSteps(step)}}`;
  const stepTag = stepTagOf(step);
  switch (stepTag) {
    case 'call':   return printCall(step);
    case 'proj':   return printProj(step);
    case 'bind':   return printBind(step);
    case 'tagged': return printTagged(step);
    case 'group':  return `(${printSteps(step.payload)})`;
    case 'each':
    case 'fail':   return `(${printSteps([step])})`;
    case undefined: break;
    default:       return printValue(step);
  }
  if (isErrorValue(step)) return printErrorStep(step);
  if (isJsonArray(step)) return `[${step.map(printElement).join(', ')}]`;
  if (isVec(step)) return `[${step.map(printElement).join(' ')}]`;
  if (isQSet(step)) return `#[${[...step].map(printElement).join(' ')}]`;
  if (isQMap(step)) return `{${printEntries([...step])}}`;
  if (isJsonObject(step)) {
    return `{${Object.entries(step).map(([key, value]) => `${JSON.stringify(key)}: ${printElement(value)}`).join(', ')}}`;
  }
  return printValue(step);
}

// Inside a container or an argument, a declaration and a documented
// call take parentheses: there the grammar reads a keyword or a doc as
// a value of its own.
function readsAsDeclaration(step) {
  const stepTag = stepTagOf(step);
  return stepTag === 'bind' || (stepTag === 'call' && step.has('docs'));
}

function printElement(step) {
  return readsAsDeclaration(step) ? `(${printStep(step)})` : printStep(step);
}

function printEntries(entries) {
  return entries.map(([key, value]) => `${canonicalKeywordLiteral(key)} ${printElement(value)}`).join(' ');
}

function printDocs(docs) {
  return docs.map(doc => `|~~${doc}~~|`);
}

function printCall(call) {
  const parts = call.has('docs') ? printDocs(call.get('docs')) : [];
  const args = call.get('args');
  const argumentList = args === undefined ? '' : `(${args.map(printArgument).join(', ')})`;
  parts.push(call.get('name').name + argumentList);
  return parts.join(' ');
}

function printArgument(argument) {
  return argument.length > 0 && readsAsDeclaration(argument[0])
    ? `(${printSteps(argument)})`
    : printSteps(argument);
}

// A key prints bare when it reads as a bare keyword, behind a colon when
// its name carries a slash, and quoted otherwise; an index prints as
// its digits.
function printSegment(segment) {
  if (typeof segment === 'number') return String(segment);
  if (segment.literal.startsWith(':"')) return segment.literal.slice(1);
  return segment.name.includes('/') ? segment.literal : segment.name;
}

function printProj(proj) {
  return '/' + proj.get('path').map(printSegment).join('/');
}

function printBind(bind) {
  const parts = [bind.get('name').literal];
  if (bind.has('docs')) parts.push(...printDocs(bind.get('docs')));
  if (bind.has('params')) parts.push(`[${bind.get('params').map(param => param.literal).join(' ')}]`);
  if (bind.has('body')) {
    const body = bind.get('body');
    parts.push(isKeyword(body) || isTagKeyword(body) ? `(${printStep(body)})` : printStep(body));
  }
  return parts.join(' ');
}

// The tag and its payload are one token run, so a payload that opens
// with a name's character, a digit or a slash takes parentheses.
function printTagged(tagged) {
  const payloadText = printStep(tagged.get('payload'));
  const needsParen = payloadText.startsWith('/') || TAG_PAYLOAD_NEEDS_PAREN_RE.test(payloadText);
  return tagged.get('tag').literal + (needsParen ? `(${payloadText})` : payloadText);
}

// An error literal prints as `!{…}` with its fields as written; an
// error value that carries another tag writes it as `:kind`, which the
// literal lifts back.
function printErrorStep(error) {
  const entries = error.tag.name === 'Error' ? [] : [['kind', error.tag]];
  entries.push(...error.descriptor);
  return `!{${printEntries(entries)}}`;
}
