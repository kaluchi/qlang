// Operand-level formatters — `json` (plain-JSON string render),
// `table` (fixed-width tabular cell render), plus the lossy
// plain-JSON value codec pair `toPlain` / `fromPlain` that
// bridges qlang runtime values with ordinary JS data structures.
//
// Canonical qlang-literal printing lives next door in
// `print-value.mjs`; everything below routes through the shared
// `dispatchQlangValue` lookup-table walker so the per-value-class
// decision sits in one place for each render strategy. The two
// surfaces share `escapeQlangStringLiteral`, `literalOfKeyword`,
// and `projectMapEntryForPrint` for the JS function → keyword
// handle projection on builtin descriptors.

import { canonicalKeywordLiteral } from '../keyword-literal.mjs';
import { nullaryOp } from './dispatch.mjs';
import {
  isQMap,
  isVecShape
} from '../types.mjs';
import {
  declareSubjectError,
  declareElementError
} from '../operand-errors.mjs';
import { QlangInvariantError } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
import {
  dispatchQlangValue,
  escapeQlangStringLiteral,
  literalOfKeyword,
  printValue,
  printConduit,
  projectMapEntryForPrint,
  TAG_PAYLOAD_NEEDS_PAREN_RE
} from './print-value.mjs';

export { printValue };

const TableSubjectNotVecError = declareSubjectError('TableSubjectNotVecError', 'table', 'vec');
const TableRowNotMapError     = declareElementError('TableRowNotMapError',     'table', 'map');

function dispatchPlainValue(v, handlers) {
  if (Array.isArray(v)) return handlers.array(v);
  if (v !== null && typeof v === 'object') return handlers.object(v);
  return handlers.scalar(v);
}

// `toPlain` lifts a qlang value to a JSON-serializable plain JS
// shape (Map → object with keyword-named string keys, Vec →
// array, Set → array, error → `{$error: …}`); `fromPlain` lifts a
// plain JS shape back into qlang (object → Map keyed by interned
// keywords, array → Vec, scalars pass through). Together they
// bridge the language with any external system that speaks JSON —
// the `parseJson` / `json` operands, the script-mode auto-pipe of
// stdin in the CLI, and any future host that bridges qlang values
// with plain-JS data structures.
//
// `toPlain` is exported for direct unit-level coverage of the
// exotic-value fallback path — the public `json` operand feeds
// this function from inside nullaryOp, but no qlang-level path
// reaches the `String(v)` branch because raw function values
// never enter pipeValue.
const TO_PLAIN_HANDLERS = {
  Null:           () => null,
  Number:         v => v,
  String:         v => v,
  Boolean:        v => v,
  Keyword:        k => k.literal,
  TagKeyword:     k => k.literal,
  Vec:            v => v.map(toPlain),
  Map:            qMapToPlainObject,
  // Snapshot wraps a captured value plus a :name / :docs / :location
  // bundle. Encode the wrapped value transparently — toPlain is the
  // lossy codec, the wrapper metadata is reachable through
  // `manifest` enumeration for callers that need it.
  Snapshot:       s => toPlain(s.get('payload')),
  // Conduit and TaggedInstance carry their structure as a Map. The
  // TagKeyword handler lifts the `:kind` discriminator so Map
  // iteration encodes cleanly without leaking `[object Object]`
  // markers. Raw JS slots (`:body` AST node, `:envRef` holder)
  // reach `env | json` only when env contains user-defined
  // conduits — those surface through toPlainFallback as a shape
  // outside the toPlain contract.
  Conduit:        qMapToPlainObject,
  TaggedInstance: qMapToPlainObject,
  Quote:          q => `~{${q.source}}`,
  Doc:            d => `|~~${d.content}~~|`,
  Set:            s => [...s].map(toPlain),
  // Error → `$error: {$tag, descriptor}` — the tag sits at the
  // head of the envelope so the lossy plain-JSON form carries
  // the identity slot explicitly. Round-trip is one-way at this
  // codec; `toTaggedJSON` is the bijective pair.
  Error:          e => ({ $error: { $tag: e.tag.name, descriptor: toPlain(e.descriptor) } }),
  JsonObject:     o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toPlain(v)])),
  JsonArray:      a => a.map(toPlain)
};

export function toPlain(v) {
  return dispatchQlangValue(v, TO_PLAIN_HANDLERS, toPlainFallback);
}

// Fallback for values `describeType` classifies as `Unknown`. The
// only live consumer reaching this branch is the host-bound raw
// JS function slot (`:qlang/locator` and any embedder
// `session.bind(name, fn)` installs); those render as a
// host-marker string so `env | json` produces a parseable plain
// shape. `dispatchQlangValue` already routes qlang function-values
// (the `makeFn` shape) through `FunctionValueLeakedToPrintError`.
function toPlainFallback(v) {
  if (typeof v === 'function') return `<host-fn ${v.name}>`;
  throw new ToPlainUnencodableValueError({ actualType: typeof v, actualValue: v });
}

// `toPlain` refuses to silently coerce unknown shapes to garbage
// strings (the `String([object Object])` path the previous
// fallback took). Per-site class so a caller can recover by
// projecting around the offending slot or by using the
// lossless `toTaggedJSON` codec instead.
export class ToPlainUnencodableValueError extends QlangInvariantError {
  constructor({ actualType, actualValue }) {
    super(`toPlain: unencodable ${actualType} value — use toTaggedJSON for lossless JSON or project around the slot`, { actualType, actualValue });
    this.name = 'ToPlainUnencodableValueError';
    this.fingerprint = 'ToPlainUnencodableValueError';
  }
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
  // so the cell stays a value literal (round-trip-safe), bypassing
  // the `as(:name)` binding-statement surface form.
  Snapshot:   s => renderCell(s.get('payload')),
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
  Set:        s => `#[${[...s].map(renderInline).join(' ')}]`,
  Quote:      q => '~{' + q.source + '}',
  Doc:        d => '|~~' + d.content + '~~|',
  JsonObject: o => `{${Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${renderInline(v)}`).join(', ')}}`,
  JsonArray:  a => `[${a.map(renderInline).join(', ')}]`,
  Conduit:    printConduit,
  // Snapshot is an immutable value-wrapper — recurse on the
  // captured value (which carries the renderable identity). The
  // `as(:name)` surface form is a binding statement; rendering a
  // Snapshot back through it would re-enter the parser as a
  // BindStep, where eval would write env and leave pipeValue at
  // the captured value, diverging from the Snapshot identity.
  Snapshot:   s => renderInline(s.get('payload')),
  TaggedInstance: renderTaggedInstanceInline,
  // Tag-head precedes the `!{…}` envelope so the inline form
  // mirrors the canonical printer: `::Tag!{…fields…}` reads as
  // one literal, identity at the front.
  Error:      e => `${e.tag.literal}!{${mapEntriesInline(e.descriptor)}}`
};

function renderTaggedInstanceInline(instance) {
  const tagLiteral = instance.get('kind').literal;
  const payload = instance.get('payload');
  const payloadInline = renderInline(payload);
  if (TAG_PAYLOAD_NEEDS_PAREN_RE.test(payloadInline)) {
    return `${tagLiteral}(${payloadInline})`;
  }
  return tagLiteral + payloadInline;
}

// Inline / cell renderers share `String` as their unknown-shape
// fallback — dispatchQlangValue already rejects qlang function
// values at the top, and any other shape `describeType`
// classifies as `Unknown` (a raw JS function reaching here from a
// host-bound env slot is the only live case) lands as
// `String(v)`, matching the pre-split surface.
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

  const columnNames = collectColumnOrder(subject);
  const widths = columnNames.map(name => name.length);

  const cells = subject.map(row => columnNames.map((columnName, i) => {
    const text = row.has(columnName) ? renderCell(row.get(columnName)) : '';
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

function collectColumnOrder(rows) {
  const order = [];
  const seen = new Set();
  for (const row of rows) {
    for (const columnName of row.keys()) {
      if (!seen.has(columnName)) {
        seen.add(columnName);
        order.push(columnName);
      }
    }
  }
  return order;
}

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('json',  json);
bindPrim('table', table);
