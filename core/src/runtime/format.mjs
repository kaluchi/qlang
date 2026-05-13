// Formatting operands: render a value as JSON or as a tabular
// string suitable for human consumption.
//
// Meta lives in lib/qlang/core.qlang.

import { canonicalKeywordLiteral } from '../keyword-literal.mjs';
import { nullaryOp } from './dispatch.mjs';
import {
  isVec,
  isQMap,
  isQSet,
  isErrorValue,
  isVecShape,
  isFunctionValue,
  isTagKeyword,
  describeType,
  keyword,
  FunctionValueLeakedToPrintError
} from '../types.mjs';
import {
  declareSubjectError,
  declareElementError
} from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

// One shared dispatch: `describeType(v)` classifies any qlang value
// into a stable string kind ('Null' | 'Number' | 'String' |
// 'Boolean' | 'Keyword' | 'Vec' | 'Map' | 'Set' | 'Error' | …).
// Each consumer keeps only a kind→handler table — the "what kind
// is this?" probe lives in one place (types.mjs), and the "what to
// do per kind?" logic sits next to the consumer's intent. No
// if-chain of `isKeyword` / `isVec` / `isQMap` / … repeats per
// site. Kinds not listed in a handler table fall through to the
// consumer's `fallback(v)` — normally an exotic-value escape hatch
// (qlang types that never enter pipeValue: conduit, snapshot,
// function).
function dispatchQlangValue(v, handlers, fallback, ...extraArgs) {
  // Function values have no grammatical literal — emitting any string
  // here would falsely round-trip through parse / eval into a different
  // value-class. printValue, renderInline, renderCell, and toPlain all
  // route through this dispatcher, so the invariant fires once for
  // every render path.
  if (isFunctionValue(v)) throw new FunctionValueLeakedToPrintError();
  const handler = handlers[describeType(v)];
  return handler ? handler(v, ...extraArgs) : fallback(v, ...extraArgs);
}

function dispatchPlainValue(v, handlers) {
  if (Array.isArray(v)) return handlers.array(v);
  if (v !== null && typeof v === 'object') return handlers.object(v);
  return handlers.scalar(v);
}

const TableSubjectNotVecError = declareSubjectError('TableSubjectNotVecError', 'table', 'vec');
const TableRowNotMapError     = declareElementError('TableRowNotMapError',     'table', 'map');

// Inverse pair: `toPlain` lifts a qlang value to a JSON-serializable
// plain JS shape (Map → object with keyword-named string keys, Vec →
// array, Set → array, error → `{$error: …}`); `fromPlain` lifts a
// plain JS shape back into qlang (object → Map keyed by interned
// keywords, array → Vec, scalars pass through). Together they bridge
// the language with any external system that speaks JSON — the
// `parseJson` / `json` operands, the script-mode auto-pipe of stdin
// in the CLI, and any future host that bridges qlang values with
// plain-JS data structures.
//
// `toPlain` is exported for direct unit-level coverage of the
// exotic-value fallback path — the public `json` operand feeds this
// function from inside nullaryOp, but no qlang-level path reaches
// the `String(v)` branch because raw function values never enter
// pipeValue.
const TO_PLAIN_HANDLERS = {
  Null:       () => null,
  Number:     v => v,
  String:     v => v,
  Boolean:    v => v,
  Keyword:    k => ':' + k.name,
  Vec:        v => v.map(toPlain),
  Map:        qMapToPlainObject,
  Set:        s => [...s].map(toPlain),
  Error:      e => ({ $error: toPlain(e.descriptor) }),
  JsonObject: o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toPlain(v)])),
  JsonArray:  a => a.map(toPlain)
};

export function toPlain(v) {
  return dispatchQlangValue(v, TO_PLAIN_HANDLERS, String);
}

function qMapToPlainObject(m) {
  const obj = {};
  for (const [k, val] of m) {
    const [pk, pv] = projectMapEntryForPrint(k, val);
    obj[pk] = toPlain(pv);
  }
  return obj;
}

const FROM_PLAIN_HANDLERS = {
  array:  a => a.map(fromPlain),
  object: plainObjectToQMap,
  scalar: v => v
};

export function fromPlain(plainVal) {
  return dispatchPlainValue(plainVal, FROM_PLAIN_HANDLERS);
}

function plainObjectToQMap(plainObj) {
  const qlangMap = new Map();
  for (const [plainKey, nestedVal] of Object.entries(plainObj)) {
    qlangMap.set(plainKey, fromPlain(nestedVal));
  }
  return qlangMap;
}

export const json = nullaryOp('json', (subject) => JSON.stringify(toPlain(subject)));

// printValue(v, indent?) → qlang literal string
//
// Canonical implementer of the round-trip invariant
// (qlang-spec.md § "Round-trip invariant"):
//
//     eval(parse(printValue(V)))  deepEqual  V
//
// for every value V that can land in pipeValue — Number, String,
// Boolean, Null, Keyword, TagKeyword, Vec, Map, Set, JSON-Object,
// JSON-Array, Error, Quote, Doc, TaggedInstance (Conduit,
// user-defined `::tag` instances). The shape is enforced by
// `core/test/unit/round-trip-invariant.test.mjs`.
//
// Three categories sit outside the contract by design:
//   * raw function values — `FunctionValueLeakedToPrintError`
//     fires here (no grammatical literal exists for them);
//   * Snapshot wrappers — auto-unwrapped on identifier-lookup /
//     projection before reaching this code path;
//   * conduit-parameter proxies — local to `applyConduit`'s body
//     fork, never escape the outer pipeValue channel.
//
// Maps and errors with more than 2 entries (or any entry whose
// value is itself a composite) pretty-print with one entry per
// line for readability — the parser's whitespace-tolerant Map
// grammar means the multi-line form still round-trips.
const PRINT_HANDLERS = {
  Null:       () => 'null',
  Boolean:    v => String(v),
  Number:     v => String(v),
  String:     escapeQlangStringLiteral,
  Keyword:    literalOfKeyword,
  TagKeyword: literalOfKeyword,
  Error:      printErrorValue,
  Vec:        (v, indent) => printListLike('[', ']', ' ',  v,      indent),
  Map:        (m, indent) => printMapLike('{', m, indent),
  Set:        (s, indent) => printListLike('#{', '}', ' ', [...s], indent),
  Quote:      q => '~{' + q.source + '}',
  Doc:        d => '|~~' + d.content + '~~|',
  JsonObject: (o, indent) => printJsonObject(o, indent),
  JsonArray:  (a, indent) => printListLike('[', ']', ', ', a,      indent),
  Conduit:    printConduit,
  Snapshot:   printSnapshot,
  TaggedInstance: printTaggedInstance
};

// Vec / Set / JsonArray share one renderer: print every element via
// printValue, then decide inline vs multi-line. Multi-line fires
// whenever any rendered element already contains a `\n` — a single
// multi-line entry would otherwise drag every subsequent entry
// onto the trailing line of the previous one (the "ladder" layout
// users complained about for `[~{multi-line} ~{multi-line}]`). One
// element per row, indented by the surrounding depth, restores the
// columnar shape.
function printListLike(open, close, inlineSep, elements, indent) {
  const rendered = elements.map(el => printValue(el, indent + 1));
  const anyMultiLine = rendered.some(s => s.includes('\n'));
  if (!anyMultiLine) {
    return `${open}${rendered.join(inlineSep)}${close}`;
  }
  const pad = '  '.repeat(indent + 1);
  const closePad = '  '.repeat(indent);
  return `${open}\n${rendered.map(s => pad + s).join('\n')}\n${closePad}${close}`;
}

function literalOfKeyword(k) { return k.literal; }

// Print a TaggedLit-style head `::Tag` ahead of the `!{…}` map
// when `:thrown` carries a TagKeyword — entropy promotion: the
// class identity rides at the structural front-position of the
// literal. The payload-Map below drops three categories of
// already-known content so the printed form stays terse:
//   * `:thrown` itself when tagHead absorbed it,
//   * `:trail null` (makeErrorValue's invariant restores it on
//     reconstruction — see types.mjs::makeErrorValue),
//   * `:message` when tagHead is present (the canonical prose is
//     reachable through `::Tag | docs` hypertext navigation; the
//     stamped string is template-fill derivable from the other
//     structured fields).
function printErrorValue(e, indent) {
  const desc = e.descriptor;
  const thrown = desc.get('thrown');
  const tagHead = isTagKeyword(thrown) ? '::' + thrown.name : '';
  const payload = new Map();
  for (const [k, v] of desc) {
    if (k === 'thrown' && tagHead) continue;
    if (k === 'trail' && v === null) continue;
    if (k === 'message' && tagHead) continue;
    payload.set(k, v);
  }
  if (payload.size === 0) return tagHead + '!{}';
  return tagHead + printMapLike('!{', payload, indent);
}

function printJsonObject(obj, indent) {
  const entries = Object.entries(obj);
  if (entries.length === 0) return '{}';
  const inner = entries
    .map(([k, v]) => `${JSON.stringify(k)}: ${printValue(v, indent)}`)
    .join(', ');
  return `{${inner}}`;
}

export function printValue(v, indent = 0) {
  return dispatchQlangValue(v, PRINT_HANDLERS, String, indent);
}

// Both named and anonymous conduits render as the `::conduit[…]`
// TaggedLit literal — the same shape `evalTaggedLit` accepts on the
// way back in. Named form carries the self-name keyword in the
// payload's first slot (`::conduit[:self [params] ~{body}]`),
// anonymous form omits it (`::conduit[[params] ~{body}]`). Round-
// trip: parse → evalTaggedLit → conduitConstructor → makeConduit
// reproduces the same Conduit-value modulo the lexical envRef
// holder, which the constructor binds to the call-site env at
// reconstruction time.
function printConduit(conduit) {
  const name = conduit.get('name');
  const params = conduit.get('params');
  const source = conduit.get('qlang/source');
  const paramList = `[${params.map(p => canonicalKeywordLiteral(p)).join(' ')}]`;
  const quotedBody = '~{' + source + '}';
  if (name == null) {
    return `::conduit[${paramList} ${quotedBody}]`;
  }
  return `::conduit[${canonicalKeywordLiteral(name)} ${paramList} ${quotedBody}]`;
}

function printSnapshot(snapshot) {
  return printValue(snapshot.get('qlang/value'));
}

// Round-trip a tagged-instance Map back into the `::tag[…]`
// TaggedLit literal that produced it. The constructor stamps the
// original payload Vec under `:qlang/payload` precisely so this
// renderer can reconstruct the source form without any per-tag
// hardcoding — the same shape `printConduit` produces for the
// `::conduit` value-class, generalised across every user-defined
// `::tag`.
function printTaggedInstance(instance, indent) {
  const tag = instance.get('qlang/kind').name;
  const payload = instance.get('qlang/payload');
  const inner = payload.map(el => printValue(el, indent)).join(' ');
  return `::${tag}[${inner}]`;
}

function escapeQlangStringLiteral(s) {
  return `"${s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
    .replace(/[\b]/g, '\\b')
    .replace(/\f/g, '\\f')}"`;
}

// `:qlang/impl` carries the post-bootstrap-resolved function value
// on a builtin descriptor Map. The author-form (the keyword shape
// that lives in core.qlang and that langRuntime resolves at boot)
// is `:qlang/prim/<name>`. printValue projects the function back to
// that keyword form here so descriptor Maps in pipeValue round-trip
// through parse → MapLit → eval into an equivalent Map (with the
// keyword in `:qlang/impl`, which langRuntime would re-resolve at
// bootstrap if it ever reached env again). The Function-leak
// invariant still fires for any function value that surfaces
// outside this single slot — `env | /count | /qlang/impl` strips
// the descriptor and feeds the raw function into printValue,
// which is the actual leak surface we want flagged.
function projectMapEntryForPrint(k, v) {
  if (k === 'qlang/impl' && isFunctionValue(v)) {
    return [k, keyword(`qlang/prim/${v.name}`)];
  }
  return [k, v];
}

function printMapLike(open, m, indent) {
  const entries = [...m].map(([k, v]) => projectMapEntryForPrint(k, v));
  // Inline only when the Map is small AND every value is a flat
  // scalar — a nested Map / Vec / Set / Error forces multi-line
  // so deeply-nested structures unfold one entry per row instead
  // of slamming the trailing close-braces onto a single line.
  const hasComposite = entries.some(([_k, v]) =>
    isQMap(v) || isVec(v) || isQSet(v) || isErrorValue(v));
  if (entries.length <= 2 && !hasComposite) {
    const inner = entries.map(([k, v]) => `${canonicalKeywordLiteral(k)} ${printValue(v, indent)}`).join(' ');
    return `${open}${inner}}`;
  }
  const pad = '  '.repeat(indent + 1);
  const closePad = '  '.repeat(indent);
  const lines = entries.map(([k, v]) => `${pad}${canonicalKeywordLiteral(k)} ${printValue(v, indent + 1)}`);
  return `${open}\n${lines.join('\n')}\n${closePad}}`;
}

// Cell renderer for the `table` operand. Scalars render bare
// (strings without quotes, numbers stringified, null as an empty
// cell). Composites render as inline qlang literals — no newline
// breaks — so a nested `:location` Map shows up as
// `{:file … :startLine 12}`.
// Nested scalars inside a composite quote strings the same way
// printValue does; only the top-level String in a cell is bare.
const CELL_HANDLERS = {
  Null:       () => '',
  Boolean:    v => String(v),
  Number:     v => String(v),
  String:     v => v,
  Keyword:    literalOfKeyword,
  TagKeyword: literalOfKeyword,
  Vec:        v => renderInline(v),
  Map:        m => renderInline(m),
  Set:        s => renderInline(s),
  Error:      e => renderInline(e),
  Quote:      q => '~{' + q.source + '}',
  Doc:        d => '|~~' + d.content + '~~|',
  JsonObject: o => renderInline(o),
  JsonArray:  a => renderInline(a),
  Conduit:    printConduit,
  // Snapshot is an immutable value-wrapper: the captured value
  // carries the renderable identity, the wrapper itself is env
  // housekeeping. Cell-renderer recurses on the unwrapped value
  // so the cell stays a value literal (round-trip-safe), not the
  // `as(:name)` binding statement.
  Snapshot:   s => renderCell(s.get('qlang/value')),
  TaggedInstance: renderTaggedInstanceInline
};

const INLINE_HANDLERS = {
  Null:       () => 'null',
  Boolean:    v => String(v),
  Number:     v => String(v),
  String:     escapeQlangStringLiteral,
  Keyword:    literalOfKeyword,
  TagKeyword: literalOfKeyword,
  Vec:        v => `[${v.map(renderInline).join(' ')}]`,
  Map:        m => `{${mapEntriesInline(m)}}`,
  Set:        s => `#{${[...s].map(renderInline).join(' ')}}`,
  Quote:      q => '~{' + q.source + '}',
  Doc:        d => '|~~' + d.content + '~~|',
  JsonObject: o => `{${Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${renderInline(v)}`).join(', ')}}`,
  JsonArray:  a => `[${a.map(renderInline).join(', ')}]`,
  Conduit:    printConduit,
  // Snapshot is an immutable value-wrapper — recurse on the
  // captured value (which carries the renderable identity).
  // The `as(:name)` surface form is a binding statement; rendering
  // a Snapshot back through it would re-enter the parser as a
  // BindStep, where eval would write env and leave pipeValue at
  // the captured value, diverging from the Snapshot identity.
  Snapshot:   s => renderInline(s.get('qlang/value')),
  TaggedInstance: renderTaggedInstanceInline,
  Error:      e => `!{${mapEntriesInline(e.descriptor)}}`
};

function renderTaggedInstanceInline(instance) {
  const tag = instance.get('qlang/kind').name;
  const payload = instance.get('qlang/payload');
  return `::${tag}[${payload.map(renderInline).join(' ')}]`;
}

function renderInline(v) {
  return dispatchQlangValue(v, INLINE_HANDLERS, String);
}

function mapEntriesInline(m) {
  return [...m]
    .map(([k, v]) => projectMapEntryForPrint(k, v))
    .map(([k, v]) => `${canonicalKeywordLiteral(k)} ${renderInline(v)}`)
    .join(' ');
}

function renderCell(v) {
  return dispatchQlangValue(v, CELL_HANDLERS, String);
}

export const table = nullaryOp('table', (subject) => {
  if (!isVecShape(subject)) throw new TableSubjectNotVecError(subject);
  if (subject.length === 0) return '(empty)';
  for (let i = 0; i < subject.length; i++) {
    if (!isQMap(subject[i])) {
      throw new TableRowNotMapError(i, subject[i]);
    }
  }

  const rowKeyCaches = subject.map(buildRowCache);
  const columnNames = collectColumnOrder(rowKeyCaches);
  const widths = columnNames.map(name => name.length);

  const cells = rowKeyCaches.map(cache => columnNames.map((name, i) => {
    const key = cache.get(name);
    const text = key === undefined ? '' : renderCell(cache.row.get(key));
    if (text.length > widths[i]) widths[i] = text.length;
    return text;
  }));

  const horizontalRule = widths.map(w => '-'.repeat(w + 2)).join('+');
  const formatRow = (rowCells) =>
    '|' + rowCells.map((c, i) => ' ' + c.padEnd(widths[i]) + ' ').join('|') + '|';

  return [
    horizontalRule,
    formatRow(columnNames),
    horizontalRule,
    ...cells.map(formatRow),
    horizontalRule
  ].join('\n');
});

function buildRowCache(row) {
  const byName = new Map();
  for (const k of row.keys()) {
    byName.set(k, k);
  }
  return { row, get: (name) => byName.get(name) };
}

function collectColumnOrder(rowCaches) {
  const order = [];
  const seen = new Set();
  for (const cache of rowCaches) {
    for (const name of (function* () {
      for (const k of cache.row.keys()) {
        yield k;
      }
    })()) {
      if (!seen.has(name)) {
        seen.add(name);
        order.push(name);
      }
    }
  }
  return order;
}

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind('qlang/prim/json',  json);
PRIMITIVE_REGISTRY.bind('qlang/prim/table', table);
