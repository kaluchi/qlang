// Canonical qlang-literal printer.
//
// `printValue(v, indent?)` is the round-trip surface — every value
// V that can land in pipeValue renders into a source string that
// `eval(parse(...))` brings back to a deepEqual (or render-stable
// for Conduit) value. The contract is pinned by
// `core/test/unit/round-trip-invariant.test.mjs`.
//
// Three categories sit outside the contract by design:
//   * raw qlang function values → `FunctionValueLeakedToPrintError`
//   * Snapshot wrappers — auto-unwrapped on identifier-lookup /
//     projection before reaching this code path
//   * conduitParameter proxies — local to `applyConduit`'s body
//     fork, never escape the outer pipeValue channel
//
// `dispatchQlangValue` is the per-value-class lookup-table walker
// every render-time consumer (this file, `format.mjs`'s
// `renderCell` / `renderInline`, `toPlain`) routes through. The
// "what kind is this?" probe lives once in `types.mjs::describeType`
// and the "what to do per kind?" decision sits next to each
// consumer's intent as a `kind → handler` table.

import { canonicalKeywordLiteral } from '../keyword-literal.mjs';
import {
  isVec,
  isQMap,
  isQSet,
  isErrorValue,
  isFunctionValue,
  describeType,
  keyword,
  TAG_HEADER_SYMBOL,
  FunctionValueLeakedToPrintError
} from '../types.mjs';
import { primKey } from '../primitives.mjs';

// `dispatchQlangValue(pipeValue, handlers, fallback, ...extraArgs)`
// — shared kind-dispatcher. Guards against raw qlang function
// values reaching any render path; downstream handlers can rely
// on the input being a renderable value-class.
export function dispatchQlangValue(pipeValue, handlers, fallback, ...extraArgs) {
  if (isFunctionValue(pipeValue)) throw new FunctionValueLeakedToPrintError();
  const handler = handlers[describeType(pipeValue)];
  return handler ? handler(pipeValue, ...extraArgs) : fallback(pipeValue, ...extraArgs);
}

// Raw JS function reaching a render path comes from a host-bound
// env entry — `:qlang/locator` is the canonical example, but
// embedders may install others via `session.bind(name, jsFn)`.
// The host-marker string parses back as a String value, keeping
// the env's surface display round-trippable.
export function hostFunctionLiteral(fn) {
  return escapeQlangStringLiteral(`<host-fn ${fn.name}>`);
}

export function escapeQlangStringLiteral(s) {
  return `"${s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
    .replace(/[\b]/g, '\\b')
    .replace(/\f/g, '\\f')}"`;
}

export function literalOfKeyword(k) { return k.literal; }

// `:impl` carries the post-bootstrap-resolved function value on a
// builtin descriptor Map. The author-form (the keyword shape that
// lives in the operand-family catalog and that langRuntime
// resolves at boot) is `:qlang/prim/<name>`. printValue projects
// the function back to that keyword form here so descriptor Maps
// in pipeValue round-trip through parse → MapLit → eval into an
// equivalent Map. The Function-leak invariant still fires for any
// function value that surfaces outside this single slot — `env |
// /count | /impl` strips the descriptor and feeds the raw function
// into printValue, which is the actual leak surface we want
// flagged.
export function projectMapEntryForPrint(k, v) {
  if (k === 'impl' && isFunctionValue(v)) {
    return [k, keyword(primKey(v.name))];
  }
  return [k, v];
}

// printValue(v, indent?) → qlang literal string
//
// Canonical implementer of the round-trip invariant
// (qlang-spec.md § "Round-trip invariant"):
//
//     eval(parse(printValue(V)))  deepEqual  V
//
// for every value V that can land in pipeValue — Number, String,
// Boolean, Null, Keyword, TagKeyword, Vec, Map, Set, JSON-Object,
// JSON-Array, Error, Quote, Doc, Conduit, Snapshot (auto-unwrapped
// before reaching this code path under identifier-lookup, kept
// here for direct projection), TaggedInstance (user-defined
// `::tag` instances). The shape is enforced by
// `core/test/unit/round-trip-invariant.test.mjs`.
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
  Set:        (s, indent) => printListLike('#[', ']', ' ', [...s], indent),
  Quote:      q => '~{' + q.source + '}',
  Doc:        d => '|~~' + d.content + '~~|',
  JsonObject: (o, indent) => printJsonObject(o, indent),
  JsonArray:  (a, indent) => printListLike('[', ']', ', ', a,      indent),
  Conduit:    printConduit,
  Snapshot:   printSnapshot,
  TaggedInstance: printTaggedInstance
};

export function printValue(v, indent = 0) {
  return dispatchQlangValue(v, PRINT_HANDLERS, printFallback, indent);
}

// Fallback for values `describeType` classifies as `Unknown`. A
// raw JS function (typically `:qlang/locator` or other host-bound
// env entries) renders as a host-marker string literal so the
// surface display round-trips through the parser as a String
// value. Any other unknown shape stringifies via `String(v)` so
// the host-marker handles the function case and the generic
// stringifier covers shapes describeType does not classify.
function printFallback(v) {
  if (typeof v === 'function') return hostFunctionLiteral(v);
  return String(v);
}

// Vec / Set / JsonArray share one renderer: print every element
// via printValue, then decide inline vs multi-line. Multi-line
// fires whenever any rendered element already contains a `\n` —
// a single multi-line entry would otherwise drag every subsequent
// entry onto the trailing line of the previous one (the "ladder"
// layout users complained about for `[~{multi-line} ~{multi-line}]`).
// One element per row, indented by the surrounding depth, restores
// the columnar shape.
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

// Print a TaggedLit-style head `::Tag` ahead of the `!{…}` map —
// the tag identity rides at the structural front-position of the
// literal, the same shape `printTaggedInstance` produces for
// non-error tagged-instances. `error.tag` is always a TagKeyword
// (universal identity invariant for the value-class), so the
// head is unconditional. The payload-Map drops the auto-injected
// `:trail null` (makeErrorValue's invariant restores it on
// reconstruction — see types.mjs::makeErrorValue); every other
// descriptor field — `:message`, per-site dynamic context, user-
// stamped slots — rides through verbatim so the print form is
// round-trip exact under `parse(printValue(V))`.
function printErrorValue(e, indent) {
  const tagHead = e.tag.literal;
  const payload = new Map();
  for (const [k, v] of e.descriptor) {
    if (k === 'trail' && v === null) continue;
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

// Both named and anonymous conduits render as the `::conduit[…]`
// TaggedLit literal — the same shape `evalTaggedLit` accepts on
// the way back in. Named form carries the self-name keyword in
// the payload's first slot (`::conduit[:self [params] ~{body}]`),
// anonymous form omits it (`::conduit[[params] ~{body}]`).
// Round-trip: parse → evalTaggedLit → conduitConstructor →
// makeConduit reproduces the same Conduit-value modulo the
// lexical envRef holder, which the constructor binds to the
// call-site env at reconstruction time.
// The `::conduit` literal head sits on the Map's
// TAG_HEADER_SYMBOL slot — the printer reads identity through
// the same channel `typeKeyword` / `isConduit` use. Mirrors
// the fixed `::Tag` heads JsonObject / JsonArray emit through
// their own Symbol-tag round-trip paths.
export function printConduit(conduit) {
  const tagLiteral = conduit[TAG_HEADER_SYMBOL].literal;
  const name = conduit.get('name');
  const params = conduit.get('params');
  const source = conduit.get('source');
  const paramList = `[${params.map(p => canonicalKeywordLiteral(p)).join(' ')}]`;
  const quotedBody = '~{' + source + '}';
  if (name == null) {
    return `${tagLiteral}[${paramList} ${quotedBody}]`;
  }
  return `${tagLiteral}[${canonicalKeywordLiteral(name)} ${paramList} ${quotedBody}]`;
}

function printSnapshot(snapshot) {
  return printValue(snapshot.get('payload'));
}

// Round-trip a tagged-instance Map back into the TaggedLit literal
// that produced it. The constructor stamps the original payload
// value under `:payload`; the renderer concatenates the tag
// literal with the printed payload directly. ParenGroup wrap
// fires only when the payload's print form opens with an
// identifier character (letter, digit, or leading `-` for
// negative numbers) — those would otherwise fuse into the tag's
// TagName tail in the grammar's atomic `"::" TagName Primary`
// production. Every other Primary opens with a distinguishing
// sigil (`"`, `:`, `[`, `{`, `#`, `~`, `|`, `!`, `/`) that the
// parser splits on cleanly, so no wrap is needed.
export const TAG_PAYLOAD_NEEDS_PAREN_RE = /^[\w-]/;
// Render shape mirrors the payload shape — the identity-overlay
// design preserves the payload's native type through the header
// stamp on composites, and uses an opaque wrap object for
// payloads that cannot carry the header themselves:
//
//   Tagged Vec (Array + header) → `::Tag[…elements…]`.
//   Tagged Set (Set + header)   → `::Tag#[…elements…]`.
//   Tagged Map (Map + header)   → `::Tag{:field value …}`.
//   Tagged wrap (opaque frozen `{type, tag, payload}` object)
//     → `::Tag<payload>` where `<payload>` is the payload's
//     printed form, with ParenGroup wrap for identifier-shaped
//     scalars (`::Tag(42)`, `::Tag(true)`) so the parser splits
//     cleanly at the tag boundary.
//
// `isTaggedInstance(instance)` always holds at this entry —
// `dispatchQlangValue` routes through the `TaggedInstance`
// handler off `describeType`.
function printTaggedInstance(instance, indent) {
  const tagLiteral = instance[TAG_HEADER_SYMBOL].literal;
  if (Array.isArray(instance)) {
    return tagLiteral + printListLike('[', ']', ' ', [...instance], indent);
  }
  if (instance instanceof Set) {
    return tagLiteral + printListLike('#[', ']', ' ', [...instance], indent);
  }
  if (instance instanceof Map) {
    return tagLiteral + printMapLike('{', instance, indent);
  }
  // Opaque wrap object — read `.payload` directly.
  const payloadPrint = printValue(instance.payload, indent);
  if (TAG_PAYLOAD_NEEDS_PAREN_RE.test(payloadPrint)) {
    return `${tagLiteral}(${payloadPrint})`;
  }
  return tagLiteral + payloadPrint;
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
