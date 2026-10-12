// The legend of a value, what `doc` answers for a value that is no name:
// a doc whose figure is the value printed with a callout at each part an
// aspect of its labels reads, and whose key lists what the value answers
// next, each aspect that derives a value run on it, each action shown by
// the call its page gives. Everything in it is computed from the value and
// the declarations under its labels; nothing is written per value.

import {
  isQMap, isVec, isQuote, isVerb, isDoc, isErrorValue, isValueClass, typeKeyword, makeDoc, makeTaggedInstance,
  makeTagKeyword, bindingValueOf, envToRun, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { nodeOf, namesUnderOf } from './nouns.mjs';
import { astOfQuote, quoteOfSource, printQuoteSource } from '../quote.mjs';
import { printValue } from './print-value.mjs';
import { evalAst } from '../eval.mjs';
import { withEnv, withPipeValue } from '../state.mjs';
import { classifyEffect } from '../effect.mjs';

const SNIPPET_TAG = makeTagKeyword('snippet');
const LINK_TAG = makeTagKeyword('link');
const FIGURE_ROWS = 3;
const PLAIN_KINDS = ['vec', 'map', 'set', 'string', 'number', 'keyword', 'boolean', 'null'];

// The prose of a record's page, its docs joined, or null.
function pageTextOf(record) {
  const docs = record?.get('docs') ?? [];
  if (docs.length === 0) return null;
  return docs.map(doc => doc.map(segment => (typeof segment === 'string' ? segment : '')).join('')).join('\n');
}

// The first paragraph of a page as one line.
function firstParagraphOf(text) {
  if (text === null) return null;
  return text.split(/\n[ \t]*\n/)[0].replace(/\s+/g, ' ').trim();
}

// A caption as it follows a dash: its first letter lowered when a word
// of prose opens it.
const lowered = caption => (caption ?? '').replace(/^[A-Z](?=[a-z])/, letter => letter.toLowerCase());

// The quotes a page holds under a tag of a role, `::holds` or `::call`.
function quotesOfRole(record, role) {
  const quotes = [];
  for (const doc of record?.get('docs') ?? []) {
    for (const segment of doc) {
      if (isValueClass(segment, 'taggedInstance') && segment.tag.name === role) quotes.push(segment.payload);
    }
  }
  return quotes;
}

// The labels a value stands under from the outside in, then the kind of
// what lies beneath them, and the kind of errors for an opened error.
function labelsOf(value) {
  const labels = [];
  let beneath = value;
  while (isValueClass(beneath, 'taggedInstance')) {
    labels.push(typeKeyword(beneath).name);
    beneath = beneath.payload;
  }
  labels.push(typeKeyword(beneath).name);
  if (isQMap(beneath) && beneath[TAG_HEADER_SYMBOL] !== undefined) labels.push('map');
  if (isVec(beneath) && beneath[TAG_HEADER_SYMBOL] !== undefined && beneath[TAG_HEADER_SYMBOL].name !== 'set') labels.push('vec');
  if (isErrorValue(value)) labels.push('error');
  return [...new Set(labels)];
}

// What an aspect's quote reads when it is a path: the keys of its
// projection, and the label it lays over each element or over the part.
function pathOfAspect(quote) {
  const ast = astOfQuote(quote);
  if (ast.type === 'Projection') return { keys: ast.keys, each: null, as: null };
  if (ast.type !== 'Pipeline' || ast.steps.length !== 2 || ast.steps[0].type !== 'Projection') return null;
  const [projection, { combinator, step }] = ast.steps;
  const laid = step.type === 'OperandCall' && step.name === 'tag' && step.args.length === 1 && step.args[0].type === 'BareTypeKeyword'
    ? step.args[0].tag : null;
  if (laid === null) return null;
  return { keys: projection.keys, each: combinator === '*' ? laid : null, as: combinator === '|' ? laid : null };
}

// The aspects and actions declared under the labels of a value, the
// outermost label's first.
function membersOf(env, labels) {
  const paths = [];
  const derived = [];
  const actions = [];
  const seen = new Set();
  for (const label of labels) {
    for (const [name, record] of namesUnderOf(env, label)) {
      if (seen.has(name)) continue;
      const value = bindingValueOf(record);
      const caption = firstParagraphOf(pageTextOf(record));
      const [call] = quotesOfRole(record, 'call');
      if (isQuote(value) && call !== undefined) {
        seen.add(name);
        actions.push({ name, caption, call: printQuoteSource(call), object: objectPartsOf(env, label + "/" + name) });
      } else if (isQuote(value)) {
        seen.add(name);
        const path = pathOfAspect(value);
        if (path !== null) paths.push({ name, caption, ...path });
        else derived.push({ name, caption, quote: value });
      } else if (isVerb(value) && isDoc(bindingValueOf(nodeOf(env, label)))) {
        seen.add(name);
        actions.push({ name, caption, call: call === undefined ? name : printQuoteSource(call), object: [] });
      }
    }
  }
  return { paths, derived, actions };
}

// The parts of an action's object its aspects name, each with its caption.
function objectPartsOf(env, address) {
  return [...namesUnderOf(env, address)].map(([name, record]) => name + " — " + lowered(firstParagraphOf(pageTextOf(record))));
}

// The names of the parts a label's path aspects read, in their order.
function partNamesOf(env, label) {
  const named = [];
  for (const [name, record] of namesUnderOf(env, label)) {
    const value = bindingValueOf(record);
    if (!isQuote(value)) continue;
    const path = pathOfAspect(value);
    if (path === null || path.keys.length !== 1) continue;
    named.push({ name, key: path.keys[0] });
  }
  return named.sort((a, b) => (Number(a.key) - Number(b.key)) || a.key.localeCompare(b.key)).map(part => part.name);
}

const keyOfPath = keys => keys.join('/');

// The callout of each part an aspect reads, by its path.
function calloutsOf(env, paths) {
  const calloutAt = new Map();
  for (const path of paths) {
    let text = `${path.name} — ${lowered(path.caption)}`;
    const label = path.each ?? path.as;
    if (label !== null) {
      const parts = partNamesOf(env, label);
      const shape = parts.length > 0 ? ` [${parts.join(' ')}]` : '';
      text += path.each !== null ? ` Each a ::${label}${shape}.` : ` A ::${label}${shape}.`;
    }
    calloutAt.set(keyOfPath(path.keys), { text, each: path.each !== null });
  }
  return calloutAt;
}

const pad = depth => '  '.repeat(depth);

function hasCalloutBelow(calloutAt, keys) {
  const prefix = keyOfPath(keys);
  for (const key of calloutAt.keys()) if (key !== prefix && key.startsWith(prefix === '' ? '' : `${prefix}/`)) return true;
  return false;
}

function tagPrefixOf(value) {
  const tag = value?.[TAG_HEADER_SYMBOL];
  return tag !== undefined && !['set', 'vec', 'map', 'error'].includes(tag.name) ? tag.literal : '';
}

// The text of a part, each callout written on the first line of the part
// it explains, aligned to one column within its container; a collection
// whose elements a label reads shows its first rows.
function render(value, keys, calloutAt, depth) {
  const beneath = isValueClass(value, 'taggedInstance') ? value.payload : value;
  if (isQMap(beneath)) {
    const rows = [...beneath].map(([key, part]) => {
      const childKeys = [...keys, key];
      const own = calloutAt.get(keyOfPath(childKeys));
      const shown = hasCalloutBelow(calloutAt, childKeys) || own?.each
        ? render(part, childKeys, calloutAt, depth + 1)
        : printValue(part, depth + 1);
      return { line: `${pad(depth + 1)}:${key} ${shown}`, callout: own?.text };
    });
    return `${tagPrefixOf(value)}{\n${aligned(rows)}\n${pad(depth)}}`;
  }
  if (isVec(beneath)) {
    const opener = beneath[TAG_HEADER_SYMBOL]?.name === 'set' ? '#[' : `${tagPrefixOf(value)}[`;
    if (calloutAt.get(keyOfPath(keys))?.each) {
      const rows = beneath.slice(0, FIGURE_ROWS).map(element => `${pad(depth + 1)}${printValue(element, depth + 1)}`);
      if (beneath.length > FIGURE_ROWS) rows.push(`${pad(depth + 1)}|~ and ${beneath.length - FIGURE_ROWS} more like them ~|`);
      return `${opener}\n${rows.join('\n')}\n${pad(depth)}]`;
    }
    const positions = beneath.map((_, index) => [...keys, String(index)]);
    if (positions.some(childKeys => calloutAt.has(keyOfPath(childKeys)) || hasCalloutBelow(calloutAt, childKeys))) {
      const rows = beneath.map((element, index) => ({
        line: `${pad(depth + 1)}${hasCalloutBelow(calloutAt, positions[index]) ? render(element, positions[index], calloutAt, depth + 1) : printValue(element, depth + 1)}`,
        callout: calloutAt.get(keyOfPath(positions[index]))?.text
      }));
      return `${opener}\n${aligned(rows)}\n${pad(depth)}]`;
    }
  }
  return printValue(value, depth);
}

function aligned(rows) {
  const firstLineOf = text => text.split('\n')[0];
  const width = Math.min(40, Math.max(...rows.map(row => firstLineOf(row.line).length)));
  return rows.map(row => {
    if (row.callout === undefined) return row.line;
    const [first, ...rest] = row.line.split('\n');
    return [`${first}${' '.repeat(Math.max(1, width - first.length + 2))}|~ ${row.callout} ~|`, ...rest].join('\n');
  }).join('\n');
}

// A short print of an answer for the key.
function shortPrintOf(answer) {
  const printed = printValue(answer).replace(/\s+/g, ' ');
  return printed.length > 70 ? `${printed.slice(0, 67)}…` : printed;
}

async function answerOn(quote, value, state) {
  const runState = withPipeValue(withEnv(state, envToRun(quote, state.env)), value);
  return (await evalAst(astOfQuote(quote), runState)).pipeValue;
}

// What an action's object holds, after its caption.
const objectNote = action => (action.object.length === 0 ? "" : " Its object: " + action.object.join("; "));

const snippet = text => makeTaggedInstance(SNIPPET_TAG, quoteOfSource(text));
const link = text => makeTaggedInstance(LINK_TAG, quoteOfSource(text));

// legendOf(value, state) → the doc that explains the value.
export async function legendOf(value, state) {
  const env = state.env;
  const labels = labelsOf(value);
  const labelled = labels.find(label => nodeOf(env, label) !== null);
  const labelRecord = nodeOf(env, labelled);
  const stack = labels.filter(label => !PLAIN_KINDS.includes(label) && label !== 'error');
  const named = stack.length > 1 ? `${stack.map(label => makeTagKeyword(label).literal).join(' over ')}` : makeTagKeyword(labels[0]).literal;
  const segments = [`${named} — ${lowered(firstParagraphOf(pageTextOf(labelRecord)))}\n\n`];
  const { paths, derived, actions } = membersOf(env, labels);
  segments.push('`', render(value, [], calloutsOf(env, paths), 0), '`\n');
  const holds = labels.flatMap(label => quotesOfRole(nodeOf(env, label), 'holds'));
  if (holds.length > 0) {
    segments.push('\nEvery value under the label holds ');
    holds.forEach((quote, index) => segments.push(index === 0 ? '' : ' and ', `\`${printQuoteSource(quote)}\``));
    segments.push('.\n');
  }
  if (derived.length + actions.length > 0) {
    segments.push('\nWhat it answers next, each run on this value:\n');
    for (const aspect of derived) {
      segments.push(snippet(aspect.name), ` is \`${shortPrintOf(await answerOn(aspect.quote, value, state))}\` — ${lowered(aspect.caption)}\n`);
    }
    for (const action of actions) {
      if (classifyEffect(action.name)) {
        segments.push(snippet(action.call), ` acts on the world, so it is not run here — ${lowered(action.caption)}${objectNote(action)}\n`);
        continue;
      }
      segments.push(snippet(action.call), ` is \`${shortPrintOf(await answerOn(quoteOfSource(action.call), value, state))}\` — ${lowered(action.caption)}${objectNote(action)}\n`);
    }
  }
  const deeper = [...new Set(paths.map(path => path.each ?? path.as).filter(label => label !== null))];
  const plainKind = labels.find(label => PLAIN_KINDS.includes(label));
  segments.push('\nDeeper: the page of any name above by `doc :name`');
  for (const label of deeper) segments.push(', ', link(`::${label} | doc`));
  if (plainKind !== undefined) segments.push(', and the verbs of its shape, ', snippet(`::${plainKind} | manifest`));
  segments.push('.\n');
  return makeDoc(segments);
}
