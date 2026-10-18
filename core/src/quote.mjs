// Code as data — the steps of a quote read from the parser's tree.
//
// A quote is a vector of steps under the code tag `::quote` [QSQUO#step], and
// this module is the one place that turns the parser's tree into steps. Where
// the syntax is a literal, the step is that literal itself, a nested quote
// included, and a container literal holds the steps of its elements, a
// pipeline element as its group; where the syntax computes, the step is a
// record, `::call`, `::bind` or `::construct`, and a path the path it reads; the
// fail track and the parentheses wrap the quote of their step as `::fail` and
// `::group` [QSQUO#step]. A comment leaves no step. A command's modifier is one
// word and is stored as its step [QSQUO#step].
//
// A quote read from text keeps the parser's node on its holder and runs
// through it; a quote assembled from data is printed and parsed the
// first time it runs (`astOfQuote`).

import { parse } from './parse.mjs';
import { printValue, printQuoteSource } from './print-value.mjs';
import { makeSet } from './ordering.mjs';
import { stepRecord, groupStep, CALL_TAG, BIND_TAG, CONSTRUCT_TAG, FAIL_TAG, GROUP_TAG } from './steps.mjs';
import {
  keyword, makeTag, makeDoc, makeQuote, makeRegex, makePath,
  makeTagged, errorAtRest, isDoc, ERROR_TAG, QUOTE_AST_SLOT
} from './types.mjs';

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
  return part.tags.reduceRight((inner, tagName) => makeTagged(makeTag(tagName), inner), quoteOfLiteral(part.quote));
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
  return stepRecord(BIND_TAG, [['name', keyword(name)], ['docs', Object.freeze([...docs])], ['body', body]]);
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
  if (combinator === '!|') return makeTagged(FAIL_TAG, makeQuote([stepOfNode(stepNode)], stepNode));
  return stepOfNode(stepNode);
}

function groupOf(pipelineNode) {
  return makeTagged(GROUP_TAG, quoteOfBody(pipelineNode));
}

function entryStepsOf(entries) {
  return entries.map(entry => [entry.key.name, stepOfNode(entry.value)]);
}

function callStepOf(node) {
  const fields = [['name', keyword(node.name)]];
  if (node.args.length > 0) fields.push(['modifiers', Object.freeze(node.args.map(stepOfNode))]);
  return stepRecord(CALL_TAG, fields);
}

function bindStepOf(node) {
  const fields = [['name', keyword(node.key.name)]];
  if (node.docs !== null) fields.push(['docs', Object.freeze(node.docs.map(stepOfNode))]);
  if (node.body !== null) fields.push(['body', stepOfNode(node.body)]);
  return stepRecord(BIND_TAG, fields);
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
  RegexLit:        node => makeRegex(node.regexSource, node.flags),
  TagLit:          node => makeTag(node.tag),
  QuoteLit:        quoteOfLiteral,
  DocLit:          docOfNode,
  VecLit:          node => Object.freeze(node.elements.map(stepOfNode)),
  SetLit:          setStepOf,
  MapLit:          node => new Map(entryStepsOf(node.entries)),
  ErrorLit:        node => errorAtRest(node.tag === null ? ERROR_TAG : makeTag(node.tag), new Map(entryStepsOf(node.entries))),
  TaggedLit:       node => stepRecord(CONSTRUCT_TAG, [['tag', makeTag(node.tag)], ['payload', stepOfNode(node.payload)]]),
  Path:            node => makePath(node.keys),
  Call:            callStepOf,
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
