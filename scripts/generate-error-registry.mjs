// One-shot generator: collect every per-site error class declared in
// core/src/**/*.mjs (`declareSubjectError` / `declareModifierError` /
// `declareElementError` / `declareComparabilityError` /
// `declareShapeError` / `declareArityError` factory call sites, plus
// direct `class Foo extends QlangError|QlangInvariantError|ArityError|
// EffectLaunderingError` declarations) and emit
// `core/lib/qlang/error/registry.qlang` — a grouped `BindStep`
// catalog of tag-binding declarations
//
//   ::TagName
//     |~~ <prose derived from the throw site's structured args> ~~|
//     {:qlang/kind :tag}
//
// Sections are grouped by the originating operand's `:category` keyword
// in `core.qlang`, so arith / string / vec-reducer / container-selector /
// reflective / format / set-op / parse / projection / combinator-track
// throws each cluster under their own banner. Tags whose operand has no
// catalog entry (combinator-only, parse-time, codec, dispatch invariant,
// etc.) land in a final "Runtime invariants" / "Combinator + projection"
// section.
//
// The generator's purpose is to make every referenced `::Tag` known
// to env so `evalBareTypeKeyword` resolves it and `!{:thrown ::Tag
// …}` literals round-trip. Per-tag payload-shape validation lives
// on the tag binding's `:qlang/impl` Quote body — see
// `core/src/eval.mjs::evalTaggedLit`.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ── Step 1: extract structured factory invocations ────────────────
//
// Each declare* factory call carries the per-site identity (className)
// plus the structured args that build the diagnostic message. The
// generator captures className → factoryKind + args so prose
// composition stays canonical (factory message templates are the
// source of truth, the catalog mirrors them).

const factoryInfo = new Map();

const FACTORY_PATTERNS = [
  // declareSubjectError('Foo', 'op', 'expected' | ['e1','e2',...])
  {
    re: /declareSubjectError\(\s*'([A-Z][A-Za-z0-9_]*)'\s*,\s*'([^']+)'\s*,\s*((?:'[^']+'|\[[^\]]+\]))/g,
    parse: (m) => ({
      kind: 'subject',
      className: m[1],
      operand: m[2],
      expectedType: parseExpected(m[3])
    })
  },
  // declareModifierError('Foo', 'op', position, 'expected')
  {
    re: /declareModifierError\(\s*'([A-Z][A-Za-z0-9_]*)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*,\s*((?:'[^']+'|\[[^\]]+\]))/g,
    parse: (m) => ({
      kind: 'modifier',
      className: m[1],
      operand: m[2],
      position: Number(m[3]),
      expectedType: parseExpected(m[4])
    })
  },
  // declareElementError('Foo', 'op', 'expected')
  {
    re: /declareElementError\(\s*'([A-Z][A-Za-z0-9_]*)'\s*,\s*'([^']+)'\s*,\s*((?:'[^']+'|\[[^\]]+\]))/g,
    parse: (m) => ({
      kind: 'element',
      className: m[1],
      operand: m[2],
      expectedType: parseExpected(m[3])
    })
  },
  // declareComparabilityError('Foo', 'op')
  {
    re: /declareComparabilityError\(\s*'([A-Z][A-Za-z0-9_]*)'\s*,\s*'([^']+)'/g,
    parse: (m) => ({
      kind: 'comparability',
      className: m[1],
      operand: m[2]
    })
  },
  // declareShapeError('Foo', ...) — body too freeform to parse, stash
  // className only; prose comes from PROSE_OVERRIDES below.
  {
    re: /declareShapeError\(\s*'([A-Z][A-Za-z0-9_]*)'/g,
    parse: (m) => ({ kind: 'shape', className: m[1] })
  },
  // declareArityError('Foo', ...) — same callback-only shape.
  {
    re: /declareArityError\(\s*'([A-Z][A-Za-z0-9_]*)'/g,
    parse: (m) => ({ kind: 'arity', className: m[1] })
  }
];

// ── Step 2: enumerate direct class declarations ──────────────────
//
// Per-site error classes that do not go through the operand-errors
// factories (codec, parser, registry, session, walk). Each declares
// itself with `class Foo extends <Base> { … }` and stamps `this.name`
// + `this.fingerprint`. The generator captures className → bare
// "direct" record; prose comes from PROSE_OVERRIDES.

// Abstract roots — the registry never carries them as fingerprints.
const ABSTRACT_BASES = new Set([
  'QlangError', 'QlangTypeError', 'QlangInvariantError',
  'ArityError', 'EffectLaunderingError'
]);

// Includes the bare `Error` base for ParseError and any other host-level
// throw site that bridges the Error-prototype boundary into qlang's
// fail-track pipeline.
const directClassRe = /class\s+([A-Z][A-Za-z0-9_]*)\s+extends\s+(Qlang[A-Za-z]*Error|ArityError|EffectLaunderingError|Error)\b/g;

// ── Step 3: walk core/src ────────────────────────────────────────

function walkDir(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkDir(p, acc);
    else if (name.endsWith('.mjs')) acc.push(p);
  }
  return acc;
}

for (const file of walkDir('core/src')) {
  const content = readFileSync(file, 'utf8');
  for (const { re, parse } of FACTORY_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const info = parse(m);
      factoryInfo.set(info.className, info);
    }
  }
  for (const m of content.matchAll(directClassRe)) {
    const className = m[1];
    if (ABSTRACT_BASES.has(className)) continue;
    if (factoryInfo.has(className)) continue;
    factoryInfo.set(className, { kind: 'direct', className, base: m[2] });
  }
}

// ── Step 4: parse `:throws` lists from authored qlang lib so the
// generator can map every referenced ::Tag to its originating
// operand and category. core.qlang BindStep entries carry
// `:throws [::Tag …]` + `:category :keyword`; sweep for those pairs.

const QLANG_LIB_FILES = [
  'core/lib/qlang/core.qlang',
  'core/lib/qlang/error.qlang',
  'core/lib/qlang/error/observe.qlang',
  'core/lib/qlang/error/guards.qlang'
];

// tag → { operand, category } — first-seen wins (the canonical
// catalog binding; subsequent throws-vec mentions overlap on tags
// shared between sibling operands are tolerated).
const tagOrigin = new Map();
const tagSet = new Set();

for (const path of QLANG_LIB_FILES) {
  const content = readFileSync(path, 'utf8');
  // Each BindStep block: `:operand … :category :catKW … :throws [::Tag …]`
  // We capture every BindStep header (`:opname` at line start, or
  // `::TagName` for tag-bindings) plus the next `:category` kw
  // and `:throws [...]` list within the same descriptor body.
  const bindStepRe = /^(::?\w[\w/-]*)\s*$/gm;
  let bindMatch;
  const headers = [];
  while ((bindMatch = bindStepRe.exec(content)) !== null) {
    headers.push({ name: bindMatch[1], offset: bindMatch.index });
  }
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].offset;
    const end = i + 1 < headers.length ? headers[i + 1].offset : content.length;
    const block = content.slice(start, end);
    const operandName = headers[i].name.replace(/^:/, '').replace(/^:/, '');
    const catMatch = /:category\s+:([\w-]+)/.exec(block);
    const category = catMatch ? catMatch[1] : null;
    const throwsMatch = /:throws\s+\[([^\]]*)\]/.exec(block);
    if (!throwsMatch) continue;
    const tagListRaw = throwsMatch[1];
    const tagRe = /::([A-Z][A-Za-z0-9_]*)/g;
    let tm;
    while ((tm = tagRe.exec(tagListRaw)) !== null) {
      const tag = tm[1];
      tagSet.add(tag);
      if (!tagOrigin.has(tag)) {
        tagOrigin.set(tag, { operand: operandName, category });
      }
    }
  }
}

// Also surface every tag the JS side knows about — these need a
// registry entry even if `:throws` Vecs do not mention them yet
// (combinator-track errors, parser, codec, registry, session).
for (const className of factoryInfo.keys()) tagSet.add(className);

// Skip tags that are themselves tag-bindings declared in core.qlang
// (`::conduit`, `::qlang`, `::json`) — they have their own entries
// and would be duplicated by the registry catalog.
const skipTags = new Set(['conduit', 'qlang', 'json']);

// ── Step 5: prose composition ────────────────────────────────────

// Type-keyword vocabulary canonical capitalisation for diagnostic
// prose. Single source of truth — the same list `core.qlang`'s type
// vocabulary section pins.
function capType(name) {
  if (name === 'string')   return 'String';
  if (name === 'number')   return 'Number';
  if (name === 'boolean')  return 'Boolean';
  if (name === 'keyword')  return 'Keyword';
  if (name === 'tag-keyword') return 'TagKeyword';
  if (name === 'null')     return 'Null';
  if (name === 'any')      return 'value';
  if (name === 'vec')      return 'Vec';
  if (name === 'map')      return 'Map';
  if (name === 'set')      return 'Set';
  if (name === 'integer')  return 'Integer';
  if (name === 'quote')    return 'Quote';
  if (name === 'doc')      return 'Doc';
  if (name === 'json-object') return 'JsonObject';
  if (name === 'json-array')  return 'JsonArray';
  if (name === 'predicate-lambda')  return 'predicate-lambda';
  if (name === 'key-lambda')        return 'key-lambda';
  if (name === 'comparator-lambda') return 'comparator-lambda';
  if (name === 'pipeline')          return 'pipeline';
  return name;
}

function joinExpected(expected) {
  const labels = expected.map(capType);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return labels.slice(0, -1).join(', ') + ', or ' + labels[labels.length - 1];
}

// Operand-name presentation: combinators stay verbatim (`*`, `>>`,
// `!|`), regular operands wrap in backticks for a code-token feel.
function fmtOperand(name) {
  if (/^[a-zA-Z@][\w@/-]*$/.test(name)) return '`' + name + '`';
  if (name === '*') return 'distribute (`*`)';
  if (name === '>>') return 'merge (`>>`)';
  if (name === '!|') return 'fail-apply (`!|`)';
  return '`' + name + '`';
}

// PROSE_OVERRIDES — manually-curated prose for callback-only factories
// (Shape / Arity) and for direct class declarations. Each entry maps a
// className to a one-sentence diagnostic.
const PROSE_OVERRIDES = {
  // Subject/Shape errors with custom-template factories
  ProjectionSubjectNotMapError: 'Projection `/key` requires a Map, Vec, or value-class subject; null subject and other shapes lift to this error.',
  ProjectionKeyNotInMapError: 'Projection `/key` — the named key is absent from the Map subject (strict-miss). Use `at(:key)` for null-coalescing access.',
  ProjectionIndexOutOfBoundsError: 'Projection `/n` — the integer index resolves outside the Vec subject\'s `[0, length)` range.',
  ProjectionVecKeyNotIntegerError: 'Projection segment is a non-numeric string but the subject is a Vec — Vec indices must be integer offsets.',
  ProjectionFieldNotOnValueClassError: 'Projection segment is not a publicly-projectable field on the value-class subject (Quote / Doc / …).',

  TaggedLitTagNotFoundError: '`::tag` constructor invocation failed — the tag is not a registered tag-binding in env.',
  TaggedLitNotTagBindingError: '`::tag` constructor invocation failed — the env binding under `::tag` is not a tag-binding descriptor Map.',
  TagBindingHasNoConstructorError: 'Tag-binding has no registered constructor — `:qlang/impl` is missing or wrong-shaped (expected a primitive Keyword or a Quote-impl body). The user-supplied payload is captured on the descriptor as `:payloadValue` / `:payloadType`; the actual `:qlang/impl` value as `:actualValue` / `:actualType`; the expected slot shape as `:expectedType [:keyword :quote]`.',

  ApplyToNonFunctionError: 'Identifier resolves to a non-function value — captured arguments cannot be applied.',
  AsNameNotKeywordError: '`as` requires a Keyword captured-arg (the binding name).',

  ConduitArityMismatchError: 'Conduit invocation supplied a captured-arg count different from the conduit\'s declared parameter list.',
  ConduitParameterNoCapturedArgsError: 'Conduit-parameter proxies are nullary — passing captured arguments to a parameter reference raises this error.',
  ConduitArityInvalidError: '`::conduit[…]` payload Vec must have either 2 elements (`[params body]`) or 3 elements (`[:self params body]`).',
  ConduitSelfNameNotKeywordError: '`::conduit` self-name (3-element payload form) must be a Keyword.',
  ConduitParamsNotVecError: '`::conduit` params slot must be a Vec of Keywords.',
  ConduitParamNotKeywordError: '`::conduit` params Vec must contain only Keywords; one element is some other type.',
  ConduitBodyNotQuoteError: '`::conduit` body slot must be a Quote-value carrying the body source.',
  ConduitPayloadNotVecError: '`::conduit[…]` payload must be a Vec; a non-Vec payload raises this error.',
  ConduitBodyMissingSourceError: '`makeConduit` refuses a body AST that has no `.text` source slice — `printValue` round-trip would otherwise emit a non-parseable placeholder.',

  EffectLaunderingAtBindStepParseError: 'BindStep declaration body references an `@`-effectful identifier, but the binding name itself is not `@`-prefixed — laundering caught at parse time.',
  EffectLaunderingAtCallError: 'Identifier resolves to an `@`-effectful function, but the lookup name is not `@`-prefixed — laundering caught at the call site.',

  AxisBindingNotFoundError: 'Axis-operand (`source` / `docs` / `examples`) could not find a `BindStep` for the requested binding name across loaded modules.',
  SourceSubjectNotKeywordOrTagError: '`source` requires a Keyword (`:foo`) or TagKeyword (`::Foo`) subject.',
  DocsSubjectNotKeywordOrTagError: '`docs` requires a Keyword (`:foo`) or TagKeyword (`::Foo`) subject.',
  ExamplesSubjectNotKeywordOrTagError: '`examples` requires a Keyword (`:foo`) or TagKeyword (`::Foo`) subject.',
  RunExamplesSubjectShapeError: '`runExamples` requires a Keyword (binding name) or a descriptor Map carrying a `:name` String.',

  ReifyArityOverflowError: '`reify` accepts 0 or 1 captured arguments, not more.',
  ReifyKeyNotKeywordError: '`reify(:name)` requires a Keyword captured-arg (the binding name to look up).',

  UseSubjectNotMapError: '`use` (bare form) requires a Map subject — its entries become the merged bindings.',
  UseNamespaceNotKeywordError: '`use(:ns)` requires a Keyword captured-arg naming the namespace to import.',
  UseNamespaceNotFoundError: '`use(:ns)` — namespace not in env and no host-provided locator can resolve it.',
  UseNamespaceNotMapError: '`use(:ns)` — env binding under `:ns` is not a Map; cannot import as a namespace.',
  UseNamespaceElementNotKeywordError: '`use([:ns1 :ns2 …])` — every element of the namespace Vec must be a Keyword.',
  UseNamespaceCollisionError: '`use(#{:ns1 :ns2 …})` — two namespaces export a name under the same identifier; Set-form rejects collisions.',
  UseNameNotExportedError: '`use(:ns, #{:name1 …})` — selection filter names an identifier the namespace does not export.',

  CoalesceNoAlternativesError: '`coalesce` requires at least one captured alternative sub-pipeline.',
  FirstTruthyNoAlternativesError: '`firstTruthy` requires at least one captured alternative sub-pipeline.',
  CondNoBranchesError: '`cond` requires at least one (predicate, branch) pair plus an optional trailing default.',

  FilterVecOrSetPredArityInvalidError: '`filter` over Vec or Set requires a predicate conduit with 0 or 1 params (`[:x]` binds the element). 2 params (`[:k :v]`) only meaningful on Map.',
  FilterMapPredArityInvalidError: '`filter` over Map requires a predicate conduit with 0, 1, or 2 params (`[:k :v]` binds key + value).',
  EveryVecOrSetPredArityInvalidError: '`every` over Vec or Set requires a predicate conduit with 0 or 1 params (`[:x]` binds the element). 2 params (`[:k :v]`) only meaningful on Map.',
  EveryMapPredArityInvalidError: '`every` over Map requires a predicate conduit with 0, 1, or 2 params (`[:k :v]` binds key + value).',
  AnyVecOrSetPredArityInvalidError: '`any` over Vec or Set requires a predicate conduit with 0 or 1 params (`[:x]` binds the element). 2 params (`[:k :v]`) only meaningful on Map.',
  AnyMapPredArityInvalidError: '`any` over Map requires a predicate conduit with 0, 1, or 2 params (`[:k :v]` binds key + value).',

  GroupByKeyNotKeywordError: '`groupBy(/key)` — the key sub-pipeline must produce a Keyword for every Vec element; one element produced a non-keyword.',
  IndexByKeyNotKeywordError: '`indexBy(/key)` — the key sub-pipeline must produce a Keyword for every Vec element; one element produced a non-keyword.',

  SortWithCmpResultNotNumberError: '`sortWith` comparator must return a Number; one comparison produced a non-Number.',
  AscPairNotMapError: '`asc(/key)` comparator subject must be a pair Map (`{ :left x :right y }`).',
  DescPairNotMapError: '`desc(/key)` comparator subject must be a pair Map (`{ :left x :right y }`).',
  NullsFirstPairNotMapError: '`nullsFirst(/key)` comparator subject must be a pair Map (`{ :left x :right y }`).',
  NullsLastPairNotMapError: '`nullsLast(/key)` comparator subject must be a pair Map (`{ :left x :right y }`).',

  UnionBareEmptyError: '`union` (bare form) requires a non-empty Vec of operands to fold.',
  MinusBareEmptyError: '`minus` (bare form) requires a non-empty Vec of operands to fold.',
  InterBareEmptyError: '`inter` (bare form) requires a non-empty Vec of operands to fold.',
  UnionPairIncompatibleError: '`union` pair operands have incompatible container types — Set+Set or Map+Map only.',
  MinusPairIncompatibleError: '`minus` pair operands have incompatible container types — Set+Set, Map+Map, or Map+Set only.',
  InterPairIncompatibleError: '`inter` pair operands have incompatible container types — Set+Set, Map+Map, or Map+Set only.',

  // Direct-class registrations
  ParseError: 'Parser failure — source did not match the grammar.',
  DivisionByZeroError: 'Division by zero — `div(_, 0)` raises this error.',
  UnresolvedIdentifierError: 'Identifier lookup failed — no env binding under that name.',

  PrimitiveKeyNotStringError: 'Primitive registry — bind() received a non-string handle.',
  PrimitiveKeyAlreadyBoundError: 'Primitive registry — two runtime modules tried to bind the same primitive name.',
  PrimitiveRegistrySealedError: 'Primitive registry — bind() called after the registry was sealed at langRuntime bootstrap.',
  PrimitiveKeyUnboundError: 'Primitive registry — `:qlang/impl` handle on a descriptor Map points to a primitive that was never bound.',

  SessionPayloadInvalidError: 'Session deserialization — payload is malformed (missing required fields).',
  SessionSchemaVersionMismatchError: 'Session deserialization — payload `:schemaVersion` does not match the current SESSION_SCHEMA_VERSION.',
  SessionConduitSourceMissingError: 'Session deserialization — a conduit binding entry has no `:source` to re-parse.',
  SessionBindingKindUnknownError: 'Session deserialization — a binding entry carries an unknown `:kind`.',

  AstNodeTypeUnknownError: 'AST → AST-Map codec — encountered an AST node whose `.type` is not in the codec\'s known shape table.',
  AstMapMalformedError: 'AST-Map → AST codec — input Map is malformed (missing required field, wrong shape).',
  AstMapKindUnknownError: 'AST-Map → AST codec — `:qlang/kind` discriminator names a kind the codec does not know.',

  TaggedJSONUnencodableValueError: '`toTaggedJSON` cannot encode a function / conduit / snapshot value — use `serializeSession` for the binding-aware path.',
  MalformedTaggedJSONError: '`fromTaggedJSON` received a JSON shape it does not recognise as a tagged-value envelope.',

  UnknownAstNodeTypeError: 'Evaluator dispatch — encountered an AST node whose `.type` is not in `AST_NODE_EVALUATORS`. Runtime invariant violation, never reaches user code.',
  UnknownCombinatorKindError: 'Combinator dispatch — encountered a combinator kind not in `COMBINATOR_EVALUATORS`. Runtime invariant violation.',
  FunctionValueLeakedToPrintError: '`printValue` / `toPlain` invariant — a raw function value reached render. Wrap host operands in a descriptor Map carrying `:qlang/kind :builtin` and `:qlang/impl` instead of binding the function via `session.bind`.',

  Rule10ArityOverflowError: 'Rule 10 — operand call supplied more captured arguments than the operand\'s declared maximum arity.',
  ValueOpArityMismatchError: 'Dispatch invariant — `valueOp` impl received an unexpected captured-arg count for its declared arity.',
  HigherOrderOpArityMismatchError: 'Dispatch invariant — `higherOrderOp` impl received an unexpected captured-arg count.',
  NullaryOpArgsProvidedError: 'Dispatch invariant — nullary operand received captured arguments.',
  OverloadedOpUnsupportedArityError: 'Dispatch invariant — overloaded operand has no impl for the supplied captured-arg count.',
  StateOpArityMismatchError: 'Dispatch invariant — `stateOp` impl received an unexpected captured-arg count.',
  StateOpVariadicMissingCapturedError: 'Dispatch invariant — `stateOpVariadic` registration is missing the `captured` range argument.',
  HigherOrderOpVariadicMissingCapturedError: 'Dispatch invariant — `higherOrderOpVariadic` registration is missing the `captured` range argument.',

  DistributeSubjectNotVecError: 'Distribute combinator (`*`) — subject must be a Vec for per-element forking.',
  MergeSubjectNotVecError: 'Merge combinator (`>>`) — subject must be a Vec for one-level flattening.',

  KeywordSubjectNotStringOrKeywordError: '`keyword` involution requires a String or Keyword subject.',

  EvalSubjectNotMapOrQuoteError: '`eval` requires a Map (AST-Map) or Quote (source-form) subject.',
  ParseSubjectNotStringOrQuoteError: '`parse` requires a String or Quote subject.',

  ErrorDescriptorNotMapError: '`error` lift requires a Map descriptor (the error\'s payload).'
};

// Per-tag operand override when the canonical operand cannot be derived
// from the structured factory args (combinator-track errors, projection,
// dispatch wrappers).
const OPERAND_OVERRIDES = {
  DistributeSubjectNotVecError: '*',
  MergeSubjectNotVecError: '>>',
  ProjectionSubjectNotMapError: '/',
  ProjectionKeyNotInMapError: '/',
  ProjectionIndexOutOfBoundsError: '/',
  ProjectionVecKeyNotIntegerError: '/',
  ProjectionFieldNotOnValueClassError: '/',
  TaggedLitTagNotFoundError: '::tag',
  TaggedLitNotTagBindingError: '::tag',
  TagBindingHasNoConstructorError: '::tag',
  ApplyToNonFunctionError: 'identifier-lookup',
  ConduitArityMismatchError: 'conduit-call',
  ConduitParameterNoCapturedArgsError: 'conduit-parameter',
  EffectLaunderingAtBindStepParseError: 'BindStep',
  EffectLaunderingAtCallError: 'identifier-lookup',
  Rule10ArityOverflowError: 'rule10',
  ValueOpArityMismatchError: 'dispatch',
  HigherOrderOpArityMismatchError: 'dispatch',
  NullaryOpArgsProvidedError: 'dispatch',
  OverloadedOpUnsupportedArityError: 'dispatch',
  StateOpArityMismatchError: 'dispatch',
  StateOpVariadicMissingCapturedError: 'dispatch',
  HigherOrderOpVariadicMissingCapturedError: 'dispatch',
  PrimitiveKeyNotStringError: 'primitive-registry',
  PrimitiveKeyAlreadyBoundError: 'primitive-registry',
  PrimitiveRegistrySealedError: 'primitive-registry',
  PrimitiveKeyUnboundError: 'primitive-registry',
  SessionPayloadInvalidError: 'session',
  SessionSchemaVersionMismatchError: 'session',
  SessionConduitSourceMissingError: 'session',
  SessionBindingKindUnknownError: 'session',
  AstNodeTypeUnknownError: 'ast-codec',
  AstMapMalformedError: 'ast-codec',
  AstMapKindUnknownError: 'ast-codec',
  TaggedJSONUnencodableValueError: 'codec',
  MalformedTaggedJSONError: 'codec',
  UnknownAstNodeTypeError: 'eval-dispatch',
  UnknownCombinatorKindError: 'eval-dispatch',
  FunctionValueLeakedToPrintError: 'print-invariant',
  ParseError: 'parse',
  ConduitBodyMissingSourceError: 'conduit-mint',
  AxisBindingNotFoundError: 'axis',
  RunExamplesSubjectShapeError: 'runExamples',
  ReifyArityOverflowError: 'reify',
  ReifyKeyNotKeywordError: 'reify',
  UnresolvedIdentifierError: 'identifier-lookup'
};

function operandOf(tag) {
  if (OPERAND_OVERRIDES[tag]) return OPERAND_OVERRIDES[tag];
  const info = factoryInfo.get(tag);
  if (info && info.operand) return info.operand;
  if (tagOrigin.has(tag)) return tagOrigin.get(tag).operand;
  return null;
}

function parseExpected(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    return [...trimmed.matchAll(/'([^']+)'/g)].map(m => m[1]);
  }
  // Single quoted string
  return [trimmed.replace(/'/g, '')];
}

function describe(tag) {
  if (PROSE_OVERRIDES[tag]) return PROSE_OVERRIDES[tag];
  const info = factoryInfo.get(tag);
  if (!info) return `${tag} — see operand documentation.`;

  const op = info.operand ? fmtOperand(info.operand) : '';

  if (info.kind === 'subject') {
    return `Subject of ${op} must be ${joinExpected(info.expectedType)}.`;
  }
  if (info.kind === 'modifier') {
    return `Captured argument at position ${info.position} of ${op} must be ${joinExpected(info.expectedType)}.`;
  }
  if (info.kind === 'element') {
    return `Element of ${op} input collection must be ${joinExpected(info.expectedType)}.`;
  }
  if (info.kind === 'comparability') {
    return `Operands of ${op} are not pairwise-comparable scalars.`;
  }
  return `${tag} — see operand documentation.`;
}

// ── Step 6: family grouping ──────────────────────────────────────
//
// Groups tags by their originating operand's category. The category
// list mirrors core.qlang's catalog ordering so the generated
// registry reads parallel to the catalog when scanned top-to-bottom.

const CATEGORY_SECTION_ORDER = [
  ['arith', 'Arithmetic operand throws'],
  ['string', 'String operand throws'],
  ['container-reducer', 'Container-reducer throws'],
  ['vec-reducer', 'Vec / Vec-or-Set reducer throws'],
  ['indexed-access', 'Indexed-access (`at`) throws'],
  ['container-selector', 'Container-selector (filter / every / any) throws'],
  ['vec-transformer', 'Vec-transformer throws'],
  ['comparator', 'Comparator-builder throws'],
  ['set-op', 'Set / set-op throws'],
  ['map-op', 'Map-op throws'],
  ['predicate', 'Predicate-operand throws'],
  ['type-classifier', 'Type-classifier throws'],
  ['type-conversion', 'Type-conversion throws'],
  ['format', 'Format-operand throws'],
  ['error', 'Error-operand throws'],
  ['control', 'Control-flow throws'],
  ['reflective', 'Reflective-operand throws'],
  ['axis', 'Axis-operand throws']
];

const CATEGORY_LABEL = new Map(CATEGORY_SECTION_ORDER);

const RUNTIME_SECTION_ORDER = [
  ['projection',     'Projection (`/key`) throws',          ['/']],
  ['combinator',     'Combinator track-dispatch throws',    ['*', '>>']],
  ['tag-binding',    'Tag-binding (::tag / ::conduit) throws', ['::tag', 'conduit-call', 'conduit-parameter', 'conduit-mint']],
  ['identifier',     'Identifier-lookup + effect-laundering throws', ['identifier-lookup', 'BindStep']],
  ['parse',          'Parser throws',                       ['parse']],
  ['ast-codec',      'AST / value codec throws',            ['ast-codec', 'codec']],
  ['eval-dispatch',  'Evaluator + Rule 10 dispatch invariants', ['eval-dispatch', 'dispatch', 'rule10']],
  ['primitive-registry', 'Primitive-registry invariants',   ['primitive-registry']],
  ['session',        'Session-codec throws',                ['session']],
  ['print-invariant','Render invariants',                   ['print-invariant']]
];

function sectionOf(tag) {
  if (tagOrigin.has(tag)) {
    const cat = tagOrigin.get(tag).category;
    if (cat && CATEGORY_LABEL.has(cat)) return CATEGORY_LABEL.get(cat);
  }
  const op = operandOf(tag);
  if (op) {
    for (const [, label, opList] of RUNTIME_SECTION_ORDER) {
      if (opList.includes(op)) return label;
    }
  }
  return 'Misc throws';
}

// Sort keys: operand name first (so siblings cluster — AddLeftNotNumberError
// next to AddRightNotNumberError), then tag name within an operand.
function sortKeyFor(tag) {
  const op = operandOf(tag) ?? 'zzz';
  return op + '\0' + tag;
}

// ── Step 7: emit ────────────────────────────────────────────────

const allTags = [...tagSet]
  .filter(t => !skipTags.has(t.toLowerCase()))
  .sort();

const bySection = new Map();
for (const tag of allTags) {
  const section = sectionOf(tag);
  if (!bySection.has(section)) bySection.set(section, []);
  bySection.get(section).push(tag);
}
for (const tags of bySection.values()) {
  tags.sort((a, b) => sortKeyFor(a).localeCompare(sortKeyFor(b)));
}

// Render in the order of CATEGORY_SECTION_ORDER followed by
// RUNTIME_SECTION_ORDER, then 'Misc throws' as the trailing bucket.
const sectionRenderOrder = [
  ...CATEGORY_SECTION_ORDER.map(([, label]) => label),
  ...RUNTIME_SECTION_ORDER.map(([, label]) => label),
  'Misc throws'
];

let out = `|~ Catalog of named-error tag-bindings — one entry per JS-side
   throw site declared in \`core/src/operand-errors.mjs\` plus the
   special runtime sources (ParseError, foreign-error names,
   axis-operand failures, registry / dispatch / session / parse /
   print invariants). Each declaration registers the tag in env
   so \`evalBareTypeKeyword\` resolves it and authors can write
   \`!{:thrown ::Tag …}\` literals and \`::Tag | docs\` axis
   navigations.

   Sections group by the originating operand's \`:category\`
   (matching the catalog ordering of \`core.qlang\`) plus a tail
   of runtime-invariant sections (projection, combinator
   track-dispatch, parse, codec, dispatch, registry, session,
   print). The file is regenerable through
   \`scripts/generate-error-registry.mjs\` when a new throw site
   lands in \`operand-errors.mjs\`.

   \`evalTaggedLit\`'s universal named-error shorthand (the
   \`implKey === undefined && isErrorValue(payloadValue)\` branch
   in \`core/src/eval.mjs::evalTaggedLit\`) re-stamps \`:thrown
   ::Tag\` onto a freshly-evaluated ErrorLit payload, so
   \`::Tag!{…}\` literals round-trip through parse → eval → print
   without per-tag JS code. Per-tag payload-shape validators
   register through \`:qlang/impl\` Quote bodies on the
   tag-binding descriptor; the resolver branch one step above
   the universal shorthand picks them up automatically. ~|

`;

for (const sectionLabel of sectionRenderOrder) {
  const tags = bySection.get(sectionLabel);
  if (!tags || tags.length === 0) continue;
  out += `|~ ──────────────── ${sectionLabel} ──────────────── ~|\n\n`;
  for (const tag of tags) {
    out += `::${tag}\n  |~~ ${describe(tag)} ~~|\n  {:qlang/kind :tag}\n\n`;
  }
}

writeFileSync('core/lib/qlang/error/registry.qlang', out.trimEnd() + '\n');
console.log(`wrote core/lib/qlang/error/registry.qlang with ${allTags.length} tags across ${[...bySection.keys()].length} sections`);
