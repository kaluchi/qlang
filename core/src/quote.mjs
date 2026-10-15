// Code as data — the steps of a quote.
//
// A quote is a vector of steps under the code tag `::quote` [QSQUO#step], and
// this module is the one place that turns the parser's tree into steps and
// steps back into text. Where the syntax is a literal, the step is that
// literal itself, a nested quote included, and a container literal holds the
// steps of its elements, a pipeline element as its group; where the syntax
// computes, the step is a record, `::call`, `::path`, `::bind` or
// `::construct`; the fail track and the parentheses wrap the quote of their
// step as `::fail` and `::group` [QSQUO#step]. A comment leaves no step. A
// command's modifier is one word and is stored as its step [QSQUO#step].
//
// A quote read from text keeps the parser's node on its holder and runs
// through it; a quote assembled from data is printed and parsed the
// first time it runs (`astOfQuote`).

import { parse } from './parse.mjs';
import { printValue, underTagLiteral } from './runtime/print-value.mjs';
import {
  keyword, makeTag, makeDoc, makeQuote, makeSet, makeRegex, makePath,
  makeTaggedInstance, errorAtRest,
  isQuote, isKeyword, isTag, isRegex, isPath, isDoc, isVec, isQMap, isQSet,
  isValueClass, ERROR_TAG, TAG_HEADER_SYMBOL, QUOTE_AST_SLOT,
  CALL_TAG, BIND_TAG, CONSTRUCT_TAG, FAIL_TAG, GROUP_TAG,
  canonicalKeywordLiteral
} from './types.mjs';

// The steps of code that stand in a pipeline alone and those that stand
// inside a container too.
const PIPELINE_STEP_TAG_NAMES  = new Set(['fail', 'bind', 'call']);
const ELEMENT_RECORD_TAG_NAMES = new Set(['call', 'construct', 'group']);

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

// quoteOfSource(source, uri) → quote — reads text as a quote; blank text,
// comments among it, is the empty quote [QSSYN#comment]. A ParseError rides
// out to the caller.
export function quoteOfSource(source, uri = 'quote') {
  const ast = parse(source, { uri });
  return ast.type === 'Blank' ? makeQuote([]) : quoteOfBody(ast);
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

// A doc literal's value, the prose the parser read and a quote for each
// span of it that read as code [QSSLF#doc], read once per node as a quote is.
const DOC_OF_LITERAL = new WeakMap();

// The segment a part of a doc literal is: its prose, a quote, or a quote
// under the stack of tags written before it, held as data [QSSLF#doc].
function docSegmentOfPart(part) {
  if (typeof part === 'string') return part;
  if (part.type !== 'DocTaggedQuote') return quoteOfLiteral(part);
  return part.tags.reduceRight((inner, tagName) => makeTaggedInstance(makeTag(tagName), inner), quoteOfLiteral(part.quote));
}

export function docOfNode(node) {
  let doc = DOC_OF_LITERAL.get(node);
  if (doc === undefined) {
    doc = makeDoc(node.segments.map(docSegmentOfPart));
    DOC_OF_LITERAL.set(node, doc);
  }
  return doc;
}

// The docs a declaration writes in the slot before its body [QSSYN#doc].
export function slotDocsOf(bindStep) {
  return (bindStep.docs ?? []).map(docOfNode);
}

// stepOfNode(node) → step — the step a single node leaves.
export function stepOfNode(node) {
  return STEP_OF_NODE[node.type](node);
}

// commandStep(name, modifiers) → the step of a command, its name and its
// modifiers, which a quote assembled from data holds as a quote read from
// text holds it.
export function commandStep(name, modifiers) {
  return record(CALL_TAG, [['name', keyword(name)], ['modifiers', Object.freeze([...modifiers])]]);
}

// tagCallStepOf(tag) → the step `tag ::Tag`, the call a tagged literal
// stands for [QSERR#rest].
export function tagCallStepOf(tag) {
  return commandStep('tag', [tag]);
}

// groupStep(steps) → the step of steps in parentheses.
export function groupStep(steps) {
  return makeTaggedInstance(GROUP_TAG, makeQuote(steps));
}

// stepOfValue(value) → the step that answers a value where it stands, the
// literal the value prints as.
export function stepOfValue(value) {
  return quoteOfSource(printValue(value))[0];
}

// declarationStep(name, docs, value) → the step of a declaration that binds
// a value under its docs, a doc in parentheses, since a doc after the name
// is a page of the declaration.
export function declarationStep(name, docs, value) {
  const body = isDoc(value) ? groupStep([value]) : stepOfValue(value);
  return record(BIND_TAG, [['name', keyword(name)], ['docs', Object.freeze([...docs])], ['body', body]]);
}

function stepsOfBody(node) {
  return node.type === 'Pipeline' ? stepsOfPipeline(node) : [stepOfNode(node)];
}

// The combinator each step rides resolves as `evalPipeline` resolves
// it: the leading combinator or `|` for the head, the unit's own after
// it.
function stepsOfPipeline(node) {
  return [
    stepUnderCombinator(node.leadingCombinator ?? '|', node.steps[0]),
    ...node.steps.slice(1).map(unit => stepUnderCombinator(unit.combinator, unit.step))
  ];
}

function stepUnderCombinator(combinator, stepNode) {
  if (combinator === '!|') return makeTaggedInstance(FAIL_TAG, makeQuote([stepOfNode(stepNode)], stepNode));
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

function callStepOf(node) {
  const fields = [['name', keyword(node.name)]];
  if (node.args.length > 0) fields.push(['modifiers', Object.freeze(node.args.map(stepOfNode))]);
  return record(CALL_TAG, fields);
}

function bindStepOf(node) {
  const fields = [['name', keyword(node.key.name)]];
  if (node.docs !== null) fields.push(['docs', Object.freeze(node.docs.map(stepOfNode))]);
  if (node.body !== null) fields.push(['body', stepOfNode(node.body)]);
  return record(BIND_TAG, fields);
}

// A set literal leaves the set of its elements' steps, in the one
// order like every set [QSORD#order].
function setStepOf(node) {
  return makeSet(node.elements.map(stepOfNode));
}

const STEP_OF_NODE = {
  NumberLit:       node => node.value,
  StringLit:       node => node.value,
  BooleanLit:      node => node.value,
  NullLit:         () => null,
  Keyword:         node => keyword(node.name),
  RegexLit:        node => makeRegex(node.pattern, node.flags),
  TagLit: node => makeTag(node.tag),
  QuoteLit:        quoteOfLiteral,
  DocLit:          docOfNode,
  VecLit:          node => Object.freeze(node.elements.map(stepOfNode)),
  SetLit:          setStepOf,
  MapLit:          node => new Map(entryStepsOf(node.entries)),
  ErrorLit:        node => errorAtRest(node.tag === null ? ERROR_TAG : makeTag(node.tag), new Map(entryStepsOf(node.entries))),
  TaggedLit:       node => record(CONSTRUCT_TAG, [['tag', makeTag(node.tag)], ['payload', stepOfNode(node.payload)]]),
  Path:            node => makePath(node.keys),
  Call:     callStepOf,
  BindStep:        bindStepOf,
  ParenGroup:      node => groupOf(node.pipeline),
  Pipeline:        groupOf
};

// ── the tree a quote runs through ──────────────────────────────

// astOfQuote(quote) → AST node
//
// The tree the quote was read from, or, for a quote assembled from
// data, the tree of its printed text, parsed once and kept. The empty
// quote runs as the identity, as `it` does.
export function astOfQuote(quote) {
  const holder = quote[QUOTE_AST_SLOT];
  if (holder.ast === undefined) {
    holder.ast = parse(quote.length === 0 ? '' : printQuoteSource(quote), { uri: 'quote' });
  }
  return holder.ast;
}

// ── which values are steps ─────────────────────────────────────

// isStep(value) — the one invariant of a quote: every element is a
// step. The fail track, a declaration and any call stand in the quote
// itself; inside a container, a field or a payload a
// step is an element step.
export function isStep(value) {
  return PIPELINE_STEP_TAG_NAMES.has(stepTagOf(value)) || isElementStep(value);
}

// isElementStep(value) — a literal, a quote, a doc, a container of element
// steps, an error literal's step, the error at rest it spells [QSERR#rest], a
// group, or a record, which counts by its tag since its constructor already
// read it back from its own text. A declaration and a command with modifiers
// stand in a pipeline alone: inside a container the grammar reads each of
// their words as an element of its own.
export function isElementStep(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return true;
  if (isKeyword(value) || isTag(value) || isRegex(value) || isPath(value) || isDoc(value) || isQuote(value)) return true;
  const errorFields = errorFieldsOf(value);
  if (errorFields !== null) return [...errorFields.values()].every(isElementStep);
  if (isQSet(value)) return value.every(isElementStep);
  const stepTag = stepTagOf(value);
  if (stepTag !== undefined) return ELEMENT_RECORD_TAG_NAMES.has(stepTag) && !(stepTag === 'call' && value.has('modifiers'));
  if (isVec(value)) return value.every(isElementStep);
  return isQMap(value) && [...value.values()].every(isElementStep);
}

// isCommandStep(value) — a command with its modifiers, the step a
// declaration's body may be beside an element step.
export function isCommandStep(value) {
  return stepTagOf(value) === 'call';
}

// ── steps into text ────────────────────────────────────────────

// printQuoteSource(quote) → the text between `~(` and `)`, in the command
// form. A quote read from that text leaves steps equal to the ones
// printed, since the constructor of every record and wrapper refuses one
// whose text reads back as another step.
export function printQuoteSource(quote) {
  return printSteps(quote);
}

// The text a quote of a doc was written in, the source its literal
// spelled, which reads back as the same steps; a quote assembled from
// data, which has no source, is printed [QSSLF#doc].
function writtenSourceOf(quote) {
  const writtenText = quote[QUOTE_AST_SLOT]?.ast?.text;
  return typeof writtenText === 'string' ? writtenText : printQuoteSource(quote);
}

// docText(doc) → its prose with each quote written where it stands as its
// author wrote it, a quote under tags with its stack before it, the text
// a doc's `content` answers [QSSLF#doc].
export function docText(doc) {
  return doc.map(segment => typeof segment === 'string' ? segment
    : isQuote(segment) ? `~(${writtenSourceOf(segment)})` : printValue(segment)).join('');
}

function stepTagOf(step) {
  return step?.[TAG_HEADER_SYMBOL]?.name;
}

// A quote of declarations alone, the story `source` reads, prints one
// declaration a line, each after the first led by its pipe, as the
// catalog writes it [QSQUO#parse], and so does a quote of several steps one of
// which takes several lines, the commands of a signature among them [QSBLD#fn].
function printSteps(steps) {
  const printed = steps.map(step => (stepTagOf(step) === 'fail' ? { fail: printSteps(step.payload) } : { step: printStep(step) }));
  const lined = steps.length > 1 && (steps.every(step => stepTagOf(step) === 'bind') || printed.some(({ fail, step }) => (fail ?? step).includes('\n')));
  const gap = lined ? '\n' : ' ';
  return printed.map(({ fail, step }, index) => {
    if (fail !== undefined) return `${index === 0 ? '' : gap}!| ${fail}`;
    return (index === 0 ? '' : `${gap}| `) + step;
  }).join('');
}

function printStep(step) {
  if (isQuote(step)) return `~(${printSteps(step)})`;
  if (isDoc(step)) return printValue(step);
  if (isQSet(step)) return `#[${step.map(printStep).join(' ')}]`;
  switch (stepTagOf(step)) {
    case 'call':   return printCall(step);
    case 'bind':   return printBind(step);
    case 'construct': return printConstruct(step.get('tag').literal, step.get('payload'));
    case 'group':  return `(${printSteps(step.payload)})`;
  }
  const errorFields = errorFieldsOf(step);
  if (errorFields !== null) return `${isValueClass(step, 'taggedInstance') ? step.tag.literal : ''}!{${printEntries([...errorFields])}}`;
  if (isVec(step)) return `[${step.map(printStep).join(' ')}]`;
  if (isQMap(step)) return `{${printEntries([...step])}}`;
  return printValue(step);
}

// A construct step writes its payload after its tag as a tagged literal
// does, and a payload of code in the parentheses the parser refuses after
// a tag, so the step reads back as none [QSLIT#tag].
function printConstruct(tagLiteral, payload) {
  const kind = stepTagOf(payload);
  if (kind === 'call' || kind === 'bind') return `${tagLiteral}(${printStep(payload)})`;
  return underTagLiteral(tagLiteral, payload, printStep(payload));
}

// The fields of the step of an error literal, a map under `::error`
// beneath the tag the literal writes before its bang [QSERR#rest]; null
// for any other value.
function errorFieldsOf(value) {
  const fields = isValueClass(value, 'taggedInstance') ? value.payload : value;
  return isQMap(fields) && fields[TAG_HEADER_SYMBOL]?.name === ERROR_TAG.name ? fields : null;
}

function printEntries(entries) {
  return entries.map(([key, value]) => `${canonicalKeywordLiteral(key)} ${printStep(value)}`).join(' ');
}

function printCall(call) {
  return [call.get('name').name, ...(call.get('modifiers') ?? []).map(printStep)].join(' ');
}

function printBind(bind) {
  const parts = [bind.get('name').literal];
  if (bind.has('docs')) parts.push(...bind.get('docs').map(printStep));
  if (bind.has('body')) parts.push(printStep(bind.get('body')));
  return parts.join(' ');
}
