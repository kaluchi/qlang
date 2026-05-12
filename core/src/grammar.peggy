// PEG grammar for the qlang expression language.
//
// Mirrors the Grammar section of docs/qlang-spec.md.
//
// Generated parser exports `parse(source)` returning an AST whose
// nodes are JS objects with a discriminator `type` field. Comma is
// optional whitespace; newlines are whitespace.
//
// Every produced node carries source metadata for tooling:
//   .location  — peggy `{ start: {offset, line, column}, end: ... }`
//   .text      — original source substring matched by the rule
//
// Post-parse decoration in src/parse.mjs adds .id and .parent on
// every node and .source/.uri/.parseId/.parsedAt/.schemaVersion on
// the root.
//
// Comments are first-class PipeSteps with identity semantics. Four
// forms share the `|~` character family:
//   |~|         line plain       — identity step, content to newline
//   |~ ... ~|   block plain      — identity step, content to ~|
//   |~~|        line doc         — attach content to next OperandCall
//   |~~ ... ~~| block doc        — attach content to next OperandCall
//
// The leading `|` in every comment token absorbs the pipeline
// combinator that would otherwise have preceded the step.

{{
  // Build a node with location and text from peggy's action helpers.
  // location() returns { start: {offset, line, column}, end: ... }
  // text() returns the matched substring of the input source.
  function node(type, fields, loc, txt) {
    return { type, ...fields, location: loc, text: txt };
  }

  // Attach a docs Vec to a raw step node, preserving its other
  // fields (including .location and .text from the parsed step).
  function withDocs(step, docs) {
    return { ...step, docs };
  }

  // Flatten a unit (which may be an array of compound units) into a
  // list of single units. Used by Pipeline to handle BlockPlainComment
  // forms that absorb the trailing combinator and emit two adjacent
  // units (the comment step plus the eaten follower step).
  function flattenUnits(unit) {
    if (Array.isArray(unit)) return unit.flatMap(flattenUnits);
    return [unit];
  }
}}

Query
  = _ p:Pipeline _ { return p; }

// PipelineInLiteral — Pipeline variant used as a MapEntry value,
// as a PipelineList element (inside Vec/Set body), and as an
// ArgList argument (inside an OperandCall's captured-arg slot).
// Differs from the full Pipeline in one dimension: plain comment
// tokens (`|~|`, `|~ ~|`) are NOT valid heads or continuations
// here, so the `_L` inside-literal whitespace can absorb them as
// section-divider / per-entry-annotation separators in the outer
// body context without the comment being greedily consumed by
// this Pipeline's tail.
//
// Users who want a multi-step pipeline with inline comment
// absorption as a literal element wrap the expression in a
// ParenGroup — `(mul(2) |~ why ~| add(1))` — whose inner
// Pipeline uses the full grammar and preserves comment-absorbing
// semantics. This mirrors the existing ParenGroup role for
// escaping outer-context precedence.
//
// The `leadingFail` prefix (`!| step`) stays valid because a
// conduit body or captured-arg sub-pipeline may legitimately
// start on the fail-track (for instance, `let(:handler, !| /kind)`).
// Explicit combinators between steps (`|`, `*`, `>>`, `!|`) also
// remain valid — only the bare comment-as-continuation and the
// absorbing comment-with-follower variants are excluded.
PipelineInLiteral
  = leadingFail:("!|" _)? head:RawStep tail:(_L ExplicitContinuation)*
  {
    const hasLeadingFail = !!leadingFail;
    const rest = tail.map(t => t[1]);
    if (rest.length === 0 && !hasLeadingFail) return head;
    const fields = {
      steps: [head, ...rest.map(u => ({ combinator: u.combinator, step: u.step }))]
    };
    if (hasLeadingFail) fields.leadingFail = true;
    return node('Pipeline', fields, location(), text());
  }

Pipeline
  = leadingFail:("!|" _)? headRaw:PipelineHead tail:(_ ContinuationUnit)*
  {
    // PipelineHead may return either a single AST node (the first
    // step) or an array of [headStep, ...continuationUnits] when
    // the head is a BlockPlainComment that absorbed its trailing
    // combinator and ate a follower step.
    //
    // `leadingFail` is an optional `!|` prefix that applies the first
    // step on the fail-track. If present, we force a Pipeline node
    // (even for a single step) and stamp `leadingFail: true` on it so
    // the evaluator routes the first step through the `!|` combinator
    // instead of evalNode directly. Without the prefix, a single-step
    // pipeline collapses to the bare step node so `astChildrenOf`
    // and downstream walkers see a Primary at the query root.
    const hasLeadingFail = !!leadingFail;
    const headUnits = Array.isArray(headRaw) ? headRaw : [headRaw];
    const head = headUnits[0];
    const headTail = headUnits.slice(1);
    const rest = [...headTail, ...tail.flatMap(t => flattenUnits(t[1]))];
    if (rest.length === 0 && !hasLeadingFail) return head;
    const pipelineFields = {
      steps: [head, ...rest.map(u => ({ combinator: u.combinator, step: u.step }))]
    };
    if (hasLeadingFail) pipelineFields.leadingFail = true;
    return node('Pipeline', pipelineFields, location(), text());
  }

// The first unit of a pipeline has no preceding combinator
// (virtually, its leading `|` in a comment-led form is absorbed
// from the implicit query start). A leading comment (block or
// line, plain or doc) may also absorb its trailing combinator and
// eat a follower; in that case PipelineHead returns an array
// [commentStep, ...followerUnits].
PipelineHead
  = LeadingBlockPlainAbsorbing
  / LeadingLinePlainAbsorbing
  / DocAttachedSequence
  / PlainCommentStep
  / BindStep
  / RawStep

LeadingBlockPlainAbsorbing
  = c:BlockPlainComment _ follower:FollowerUnit
  {
    const followerUnits = Array.isArray(follower) ? follower : [{ combinator: '|', step: follower }];
    return [c, ...followerUnits];
  }

LeadingLinePlainAbsorbing
  = c:LinePlainComment _ follower:FollowerUnit
  {
    const followerUnits = Array.isArray(follower) ? follower : [{ combinator: '|', step: follower }];
    return [c, ...followerUnits];
  }

// Continuations after the first step. Comment-led units are tried
// first so their leading `|` is absorbed as the combinator into the
// comment token rather than matched as a bare Combinator.
//
// `DocLitContinuation` catches a standalone doc-comment in
// continuation position (no following operand-call to attach to) —
// the doc-token's leading `|` absorbs the implicit `|` combinator
// from the previous step, the doc itself becomes a Primary step
// that evaluates into a Doc-value.
ContinuationUnit
  = BlockPlainCommentAbsorbing
  / LinePlainCommentAbsorbing
  / AbsorbedCommentContinuation
  / DocLitContinuation
  / BindStepContinuation
  / ExplicitContinuation

// BindStepContinuation — next BindStep follows previous step
// without an explicit combinator. The keyword in head-position is
// itself the separator; no `|` between adjacent BindSteps. The
// combinator stamped on the step-wrapper is `|` (pipeValue flows
// through, BindStep is transparent so this only matters for what
// the next step sees as pipeValue).
BindStepContinuation
  = step:BindStep
  { return { combinator: '|', step }; }

DocLitContinuation
  = step:DocLit
  { return { combinator: '|', step }; }

// Block plain comment that absorbs BOTH leading and trailing
// combinators. The leading `|` of `|~` is the combinator from the
// previous step; the trailing `|` of `~|` is the combinator to the
// following step. Returns an array of units which Pipeline flattens.
BlockPlainCommentAbsorbing
  = c:BlockPlainComment _ follower:FollowerUnit
  {
    const followerUnits = Array.isArray(follower) ? follower : [{ combinator: '|', step: follower }];
    return [
      { combinator: '|', step: c },
      ...followerUnits
    ];
  }

// Line plain comment that absorbs BOTH leading and trailing
// combinators. The leading `|` of `|~|` is the combinator from the
// previous step; the trailing combinator is virtually absorbed —
// after the content up to newline, the next step follows without
// any explicit `|`. Returns an array of units which Pipeline
// flattens. Structurally mirrors BlockPlainCommentAbsorbing so the
// line and block forms are interchangeable for combinator purposes.
LinePlainCommentAbsorbing
  = c:LinePlainComment _ follower:FollowerUnit
  {
    const followerUnits = Array.isArray(follower) ? follower : [{ combinator: '|', step: follower }];
    return [
      { combinator: '|', step: c },
      ...followerUnits
    ];
  }

// What can follow a comment whose trailing combinator is absorbed:
// another absorbing comment (block or line), a doc-attached step,
// another plain comment, or a bare RawStep. May return an array
// when the follower is itself a chain of absorbing comments.
FollowerUnit
  = c:BlockPlainComment _ inner:FollowerUnit
  {
    const innerUnits = Array.isArray(inner) ? inner : [{ combinator: '|', step: inner }];
    return [
      { combinator: '|', step: c },
      ...innerUnits
    ];
  }
  / c:LinePlainComment _ inner:FollowerUnit
  {
    const innerUnits = Array.isArray(inner) ? inner : [{ combinator: '|', step: inner }];
    return [
      { combinator: '|', step: c },
      ...innerUnits
    ];
  }
  / DocAttachedSequence
  / PlainCommentStep
  / RawStep

// Comment-led continuation: the leading `|` of the comment token is
// the combinator from the previous step. When DocAttachedSequence
// returns a head-shape compound array (plain comments interleaved
// with docs), the first element is bare and needs to be wrapped
// with the absorbed combinator before being handed to the
// Pipeline flatten step.
AbsorbedCommentContinuation
  = step:DocAttachedSequence {
    if (Array.isArray(step)) {
      return [
        { combinator: '|', step: step[0] },
        ...step.slice(1)
      ];
    }
    return { combinator: '|', step };
  }
  / step:PlainCommentStep { return { combinator: '|', step }; }

// Explicit combinator + next step. The step may itself carry doc
// comments after the combinator (e.g. `| |~~| doc text` where the
// user wrote an explicit `|` before the doc; the combinator and the
// doc's absorbed `|` coexist, the latter being a no-op).
ExplicitContinuation
  = c:Combinator _ step:StepAfterCombinator
  { return { combinator: c, step }; }

StepAfterCombinator
  = DocAttachedSequence
  / RawStep

// One or more doc comments, optionally interleaved with plain
// comments, followed by a def or as operand call. Each doc comment
// produces ONE entry in the `docs` Vec attached to the operand call
// node. The semantic predicate restricts attachment to def / as —
// the only operands that read `.docs` (def stores them on the
// resulting snapshot or conduit; as stores them on the snapshot).
// A doc-prefix in front of any other OperandCall (filter, mul, ...)
// fails this rule and backtracks; the Doc then evaluates as a
// standalone Doc-value through the DocLit Primary alternative and
// the operand follows as the next pipe-step.
//
// Adjacent line docs do NOT concatenate — each is its own entry.
// Block docs preserve internal newlines as a single multi-line entry.
//
// When no plain comments are interleaved, the rule returns a single
// operand-call node with `.docs` populated. When interleaved plains
// are present, the rule returns a compound array that Pipeline
// flattens into multiple steps (plain identity steps first, then
// the doc-attached operand call).
DocAttachedSequence
  = firstDoc:DocComment rest:(_ DocOrPlainItem)* _ step:OperandCall
    & { return step.name === 'def' || step.name === 'as'; }
  {
    const allItems = [firstDoc, ...rest.map(t => t[1])];
    const docs = [];
    const plainSteps = [];
    for (const item of allItems) {
      if (item.type === 'LineDocComment' || item.type === 'BlockDocComment') {
        docs.push(item.content);
      } else {
        plainSteps.push(item);
      }
    }
    const bound = withDocs(step, docs);
    if (plainSteps.length === 0) return bound;
    // Head-shape compound array: first element is the bare step,
    // remaining elements carry explicit combinator wrappers. This
    // matches the convention used by LeadingBlockPlainAbsorbing
    // so Pipeline's head flattener can consume either directly.
    return [
      plainSteps[0],
      ...plainSteps.slice(1).map(p => ({ combinator: '|', step: p })),
      { combinator: '|', step: bound }
    ];
  }

// A single item that may appear in a doc-attached prefix: either a
// doc comment (contributes to the docs Vec) or a plain comment
// (emits as a standalone identity step before the binding). Doc
// forms are tried first because `|~~` is a longer prefix than `|~`.
DocOrPlainItem
  = DocComment
  / PlainCommentStep

DocComment
  = LineDocComment
  / BlockDocComment

PlainCommentStep
  = LinePlainComment
  / BlockPlainComment

// --- Comment tokens --------------------------------------------
//
// PEG ordered choice: longer patterns first. `|~~|` (4 chars) is
// tried before `|~|` (3 chars); `|~~` (3-char opener) before `|~`
// (2-char opener). Closing markers `~~|` / `~|` are similarly
// disambiguated inside content rules via negative lookahead.

LineDocComment
  = "|~~|" content:LineCommentContent
  { return node('LineDocComment', { content }, location(), text()); }

BlockDocComment
  = "|~~" !"|" content:BlockDocContent "~~|"
  { return node('BlockDocComment', { content }, location(), text()); }

LinePlainComment
  = "|~|" content:LineCommentContent
  { return node('LinePlainComment', { content }, location(), text()); }

BlockPlainComment
  = "|~" ![|~] content:BlockPlainContent "~|"
  { return node('BlockPlainComment', { content }, location(), text()); }

LineCommentContent
  = chars:[^\n]* { return chars.join(''); }

// Quote-spans inside a block comment / block doc are preserved
// verbatim so the inner Quote's content (which may include `~|`
// or `~~|` substrings) does not trip the outer block-comment
// close marker. QuoteSpan tracks `~{` / `}` balance same as
// QuoteContent, so the span returned matches exactly the inner
// `~{...}` source slice including its delimiters.
QuoteSpan
  = "~{" content:QuoteContent "}"
    { return '~{' + content + '}'; }

BlockPlainContent
  = chars:(QuoteSpan / (!"~|" .))*
    { return chars.map(c => typeof c === 'string' ? c : c[1]).join(''); }

BlockDocContent
  = chars:(QuoteSpan / (!"~~|" .))*
    { return chars.map(c => typeof c === 'string' ? c : c[1]).join(''); }

// --- Combinators ------------------------------------------------
//
// `|` has a negative lookahead `!"~"` so it does not match when the
// following character is `~` (which would make it the start of a
// comment token `|~` / `|~~` / `|~|` / `|~~|`). Comment continuations
// are also tried first in ContinuationUnit, so this is a safety net.
//
// `!|` is the fail-track dual of `|`. It fires its step only when
// pipeValue is an error value; on a non-error pipeValue it deflects
// (identity pass-through). No lookahead is needed because `!|` starts
// with `!` which does not prefix any other combinator, and `!{`
// (ErrorLit) is distinguishable by its second char.

Combinator
  = ">>" { return '>>'; }
  / "!|" { return '!|'; }
  / "|" !"~" { return '|'; }
  / "*"  { return '*'; }

// --- Raw steps (non-comment) -----------------------------------
//
// `RawStep` is the bare-Primary form of a step. The binding-form
// `BindStep` is introduced separately at the Pipeline-step level
// (see `PipelineHead` and the `BindStepContinuation` alternative
// of `ContinuationUnit`); it is intentionally NOT folded into
// `RawStep` because `RawStep` is shared by `PipelineInLiteral` —
// inside Vec/Set/Map/ArgList element positions the grammar must
// stay "Keyword is just a keyword value", so `[:a 42]` parses as
// a Vec of two keywords + a number, not as a binding.

RawStep
  = Primary

// --- BindStep — declarative binding form -----------------------
//
// `:name body` / `:name docs body` / `:name docs` / `::Tag body` /
// `:name [:p ...] body` — keyword (or BareTypeKeyword) in
// head-position, optional doc-prefix in spec-slot, optional Vec
// of keyword-params, optional body (any Primary except a bare
// Keyword/BareTypeKeyword — for those wrap in ParenGroup). The
// predicate at the end fails the rule if neither docs nor body
// nor params is present, so a lone `:foo` falls back to a plain
// Keyword Primary.
//
// BindStep is transparent for pipeValue — it writes the binding
// into env and lets the incoming pipeValue pass through unchanged.
// Pure-literal bodies snapshot at decl-time; impure bodies become
// conduits captured against the lexical envRef.
BindStep
  = key:BindName __ docs:DocPrefix? _? rest:BindRest?
    & { return docs !== null || rest !== null; }
    {
      const params = rest && rest.params ? rest.params : null;
      const body = rest && rest.body ? rest.body : null;
      return node('BindStep', { key, docs: docs || null, params, body }, location(), text());
    }

BindName
  = key:Keyword         { return key; }
  / key:BareTypeKeyword { return key; }

// DocPrefix in BindStep sits AFTER the name. No combinator-absorb
// behaviour (the name already separated this step from the
// previous). Sequence of consecutive doc-comments accumulates into
// a Vec of contents; plain comments interleaved are dropped (they
// are layout sugar, not part of attached docs). Returns null when
// no doc-comment found.
DocPrefix
  = first:DocComment rest:(_ DocOrPlainItem)*
    {
      const items = [first, ...rest.map(r => r[1])];
      const docs = [];
      for (const item of items) {
        if (item.type === 'LineDocComment' || item.type === 'BlockDocComment') {
          docs.push(item.content);
        }
      }
      return docs;
    }

// BindRest covers the trailing `params body` (parametric conduit)
// or `body` (value/literal). Params is a Vec of Keywords only —
// if the `[...]` contains anything non-Keyword, params fails and
// the alternative falls through to body-only where the same
// `[...]` is parsed as a VecLit body.
BindRest
  = params:Params _? body:BindBody { return { params, body }; }
  / body:BindBody                  { return { params: null, body }; }

Params
  = "[" _L head:Keyword tail:(_L Keyword)* _L "]"
    { return [head, ...tail.map(t => t[1])]; }
  / "[" _L "]" { return []; }

// BindBody is a Primary EXCEPT bare Keyword / BareTypeKeyword —
// `:foo :bar` would be meaningless as a binding (key + keyword-
// value, where the name reference is redundant); the predicate
// rejects those shapes so the parser backtracks to two consecutive
// Primary steps instead. To bind a key explicitly to a keyword
// value, wrap in ParenGroup: `:status (:active)`.
BindBody
  = body:Primary
    & { return body.type !== 'Keyword' && body.type !== 'BareTypeKeyword'; }
    { return body; }

Primary
  = ParenGroup
  / ErrorLit
  / SetLit
  / VecLit
  / MapLit
  / QuoteLit
  / DocLit
  / TaggedLit
  / BareTypeKeyword
  / Projection
  / OperandCall
  / Scalar

// TaggedLit / BareTypeKeyword — type-namespace identifiers under a
// `::` prefix. `::tag<payload>` (TaggedLit) constructs a value
// through the type's registered constructor; `::tag` alone
// (BareTypeKeyword) is an identifier reference to the type binding
// itself.
//
// Tag and payload are *atomic* — no whitespace permitted between
// them. `::tag[1 2]` is one TaggedLit; `::tag [1 2]` is the
// BareTypeKeyword `::tag` followed by a separate Vec primary at the
// outer Pipeline / Vec / arg position. Whitespace forces splitting
// — same rule that distinguishes `/foo` projection from `/ foo`
// (which isn't legal). Scalar / identifier payload wraps through
// ParenGroup: `::tag(42)`, `::tag(foo)`, `::tag(a | b)`.
//
// Tag name accepts NamespacedName (`::ns/sub/leaf`) symmetric with
// keyword namespacing — same TagName production used by both.
//
// PEG ordered choice tries TaggedLit first; if no Primary follows
// the tag identifier, parsing backtracks to BareTypeKeyword so a
// bare reference like `::duration | spec` parses cleanly.
TaggedLit
  = "::" tag:TagName payload:Primary
    { return node('TaggedLit', { tag, payload }, location(), text()); }

BareTypeKeyword
  = "::" tag:TagName
    { return node('BareTypeKeyword', { tag }, location(), text()); }

TagName
  = NamespacedName
  / Ident

ParenGroup
  = "(" _ p:Pipeline _ ")"
    { return node('ParenGroup', { pipeline: p }, location(), text()); }

// QuoteLit captures content verbatim as a source string. AST is
// parsed lazily by the runtime so a Quote may hold a pipeline
// fragment beginning with a combinator (`* inc | sort`) — eager
// parse would reject such a fragment.
//
// `~{...}` delimiter — paired (open ≠ close). Content matches an
// ordinary qlang `Pipeline` greedy-style; whatever the Pipeline
// rule can't consume (leading combinator, stray separator,
// whitespace) falls through to `QuoteChar` which accepts every
// byte except `}`. Balance derives entirely from the standard
// qlang grammar — `MapLit` / `SetLit` / `VecLit` / `ErrorLit` /
// `ParenGroup` / `QuoteLit` / string literals / comment tokens
// each end on their own closer, so the outer `}` is reached only
// when nothing nests at the cursor. No separate escape mechanism —
// valid qlang never carries unbalanced `{` / `}` / `` ` `` outside
// a string literal or comment.
//
// `src` (not `source`) — `parse.mjs` stamps `ast.source` on the
// root node, which would override a QuoteLit field of the same
// name when the QuoteLit is the entire query. The AST keeps `src`;
// the runtime Quote value-class projects `:source` on its own Map
// shape.
QuoteLit
  = "~{" content:QuoteContent "}"
    { return node('QuoteLit', { src: content }, location(), text()); }

QuoteContent
  = parts:QuotePart* { return parts.join(''); }

QuotePart
  = NestedQuoteSpan
  / Pipeline { return text(); }
  / QuoteStringSpan
  / QuoteBlockDocSpan
  / QuoteBlockPlainSpan
  / QuoteLineDocSpan
  / QuoteLinePlainSpan
  / QuoteChar

NestedQuoteSpan
  = "~{" inner:QuoteContent "}"
    { return text(); }

QuoteStringSpan
  = '"' chars:QuoteStringChar* '"' { return text(); }

QuoteStringChar
  = "\\" .
  / [^"\\]

QuoteBlockDocSpan
  = "|~~" !"|" QuoteBlockDocChar* "~~|" { return text(); }

QuoteBlockDocChar
  = !"~~|" .

QuoteBlockPlainSpan
  = "|~" !"~" !"|" QuoteBlockPlainChar* "~|" { return text(); }

QuoteBlockPlainChar
  = !"~|" .

QuoteLineDocSpan
  = "|~~|" [^\n]* { return text(); }

QuoteLinePlainSpan
  = "|~|" [^\n]* { return text(); }

QuoteChar
  = !"}" c:. { return c; }

// DocLit — standalone doc-comment as a Primary value-form. Two
// surface variants share one AST node type:
//   |~~| ...        line form (until newline), input convenience
//   |~~ ... ~~|     block form, output canonical
// Both produce the same Doc value-class at eval time; printValue
// only emits the block form (line-form newline closes the token, so
// multi-line round-trip would be lossy).
//
// LineDocComment / BlockDocComment AST nodes are kept distinct
// (used by DocAttachedSequence for attached-prefix attachment to
// def/as) — DocLit is its own AST node so the JS-side evaluator
// can route standalone literals to a Doc-value while the attached
// path keeps stamping `.docs` strings on the following operand-call.
DocLit
  = "|~~|" content:LineCommentContent
    { return node('DocLit', { content }, location(), text()); }
  / "|~~" !"|" content:BlockDocContent "~~|"
    { return node('DocLit', { content }, location(), text()); }

// ErrorLit — qlang descriptor literal `!{...}`. Always uses qlang
// MapEntry shape (keyword key, whitespace separator); JSON-style
// commas inside an ErrorLit body raise a parse error.
ErrorLit
  = "!{" _L "}"
    { return node('ErrorLit', { entries: [] }, location(), text()); }
  / "!{" _L head:MapEntry tail:(_L MapEntry)* _L "}"
    { return node('ErrorLit', { entries: [head, ...tail.map(t => t[1])] }, location(), text()); }

// MapLit — mode-discriminated by markers per §II.11.1:
//   {}                          — empty, defaults to qlang Map at
//                                 top level (eval may inherit JSON
//                                 from a parent JSON container).
//   {"k": 1, "k2": 2}           — JSON Object: string-keyed entries
//                                 separated by `:` and commas.
//   {:k 1 :k2 2}                — qlang Map: keyword-keyed entries
//                                 separated by whitespace.
//   {:k 1, :k2 2}               — mode conflict (keyword key with
//                                 comma separator) → parse error.
//   {"k": 1 "k2": 2}            — mode conflict (string key without
//                                 comma) → parse error.
// Order of alternatives: JSON-form first (requires explicit comma
// markers), then qlang-form. Empty case last.
MapLit
  = "{" _L head:JsonMapEntry tail:(_L "," _L JsonMapEntry)* _L "}"
    { return node('JsonObjectLit', { entries: [head, ...tail.map(t => t[3])] }, location(), text()); }
  / "{" _L head:QlangMapEntry tail:(_L QlangMapEntry)* _L "}"
    { return node('MapLit', { entries: [head, ...tail.map(t => t[1])] }, location(), text()); }
  / "{" _L "}"
    { return node('MapLit', { entries: [] }, location(), text()); }

// JSON map entry: `"key": value` separated by colon.
JsonMapEntry
  = key:StringLit _L ":" _L value:PipelineInLiteral
    { return node('MapEntry', { key: node('Keyword', { name: key.value }, key.location, key.text), value }, location(), text()); }

// qlang map entry: `:key value` separated by required whitespace.
QlangMapEntry
  = key:Keyword __ value:PipelineInLiteral
    { return node('MapEntry', { key, value }, location(), text()); }

// Backward-compatibility alias: existing AST consumers reference
// `MapEntry` by node type without distinguishing the surface form
// they came from. JSON / qlang-mode entries both carry the same
// `MapEntry` discriminator and shape.
MapEntry = QlangMapEntry / JsonMapEntry

SetLit
  = "#{" _L "}"
    { return node('SetLit', { elements: [] }, location(), text()); }
  / "#{" _L elements:PipelineList _L "}"
    { return node('SetLit', { elements }, location(), text()); }

// VecLit — mode-discriminated by separator per §II.11.1:
//   []                          — empty, defaults to qlang Vec at
//                                 top level.
//   [1, 2, 3]                   — JSON Array: comma-separated.
//   [1 2 3]                     — qlang Vec: whitespace-separated.
//   [1]                         — single element, qlang Vec.
// Mixed separators inside a single literal raise a parse error
// because the chosen alternative (whichever PEG ordered choice
// commits to) won't match the second element shape.
VecLit
  = "[" _L head:PipelineInLiteral tail:(_L "," _L PipelineInLiteral)+ _L "]"
    { return node('JsonArrayLit', { elements: [head, ...tail.map(t => t[3])] }, location(), text()); }
  / "[" _L head:PipelineInLiteral tail:(_L PipelineInLiteral)* _L "]"
    { return node('VecLit', { elements: [head, ...tail.map(t => t[1])] }, location(), text()); }
  / "[" _L "]"
    { return node('VecLit', { elements: [] }, location(), text()); }

// SetLit / ErrorLit / ArgList retain their ad-hoc whitespace-or-
// comma list form — neither is a JSON-shaped construct, and an
// ArgList comma is the required argument separator (not a
// container marker).
PipelineList
  = head:PipelineInLiteral tail:(_L ","? _L PipelineInLiteral)*
    { return [head, ...tail.map(t => t[3])]; }

OperandCall
  = name:Ident !IdentTail args:(_ "(" _L ArgList? _L ")")?
    { return node('OperandCall', { name, args: args ? (args[3] || []) : null }, location(), text()); }

ArgList
  = head:PipelineInLiteral tail:(_L ","? _L PipelineInLiteral)*
    { return [head, ...tail.map(t => t[3])]; }

// Projection accepts both bare identifier segments and quoted-string
// segments. The quoted form lifts the [@_a-zA-Z][a-zA-Z0-9_-]* identifier
// restriction so any JSON object key — including digit-leading,
// space-containing, sigil-containing, or empty strings — can be projected.
// Each `KeySegment` produces a plain string slot in `node.keys`, so
// downstream consumers (eval.mjs::evalProjection) do not care which
// surface form was used.
Projection
  = "/" first:KeySegment rest:("/" KeySegment)*
    { return node('Projection', { keys: [first, ...rest.map(r => r[1])] }, location(), text()); }

// KeySegment bare forms — ordered by specificity:
//   1. KeywordName handles the ID_Start-led case (letters, `@`,
//      `_` first char; covers typical keys like `/name`, `/@tag`,
//      `/_meta`). Must come before the IdentTail+ fallback so
//      letter-led paths do not route through the looser rule.
//   2. RelaxedKeyName handles digit-led or hyphen-led segments
//      (`/0`, `/items/0/name`, `/-1`). These forms never appear as
//      qlang identifiers in source but surface as JSON object keys
//      (`{"0": …}`) and as Vec indices under the polymorphic
//      projection in eval.mjs::projectSegment.
KeySegment
  = ":" name:NamespacedName { return name; }
  / ":" name:KeywordName    { return name; }
  / QuotedKeywordName
  / KeywordName
  / RelaxedKeyName

RelaxedKeyName
  = chars:IdentTail+ { return chars.join(''); }

Scalar
  = StringLit
  / NumberLit
  / BooleanLit
  / NullLit
  / Keyword

StringLit
  = '"' chars:DoubleStringChar* '"'
    { return node('StringLit', { value: chars.join('') }, location(), text()); }

DoubleStringChar
  = !('"' / "\\") char:. { return char; }
  / "\\" esc:EscapeChar { return esc; }

EscapeChar
  = '"' { return '"'; }
  / "\\" { return "\\"; }
  / "/" { return '/'; }
  / "n" { return '\n'; }
  / "t" { return '\t'; }
  / "r" { return '\r'; }
  / "b" { return '\b'; }
  / "f" { return '\f'; }
  / "u" hex:$(HexDigit HexDigit HexDigit HexDigit) { return String.fromCharCode(parseInt(hex, 16)); }

HexDigit
  = [0-9a-fA-F]

NumberLit
  = sign:"-"? whole:[0-9]+ frac:("." [0-9]+)? exp:([eE] [+\-]? [0-9]+)?
    { const txt = (sign || '') + whole.join('')
                + (frac ? '.' + frac[1].join('') : '')
                + (exp  ? exp[0] + (exp[1] || '') + exp[2].join('') : '');
      return node('NumberLit', { value: Number(txt) }, location(), text()); }

BooleanLit
  = "true"  !IdentTail { return node('BooleanLit', { value: true }, location(), text()); }
  / "false" !IdentTail { return node('BooleanLit', { value: false }, location(), text()); }

NullLit
  = "null" !IdentTail { return node('NullLit', {}, location(), text()); }

// Keyword has two surface forms:
//   :name        — bare identifier, restricted to [@_a-zA-Z][a-zA-Z0-9_-]*
//   :"any text"  — quoted form, accepts any string including the empty
//                  string, digit-leading names, sigils, spaces, and the
//                  full DoubleStringChar escape set (\n, \t, \r, \", \\)
//
// Both forms produce a Keyword node with the same `.name` shape, so
// downstream `keyword(name)` interns them through the same code path:
// `:foo` and `:"foo"` are === identical at the runtime value level.
// The quoted form is what makes "every JSON object key has a qlang
// literal" hold, completing the lossless JSON interop guarantee.
Keyword
  = ":" name:QuotedKeywordName  { return node('Keyword', { name }, location(), text()); }
  / ":" name:NamespacedName     { return node('Keyword', { name }, location(), text()); }
  / ":" name:KeywordName        { return node('Keyword', { name }, location(), text()); }

NamespacedName
  = head:Ident tail:("/" Ident)+
    { return head + tail.map(t => '/' + t[1]).join(''); }

QuotedKeywordName
  = '"' chars:DoubleStringChar* '"' { return chars.join(''); }

// KeywordName is like Ident but without the !ReservedWord guard.
// Used in Keyword and KeySegment where the leading `:` or `/`
// already places us in a separate namespace — `:null`, `:true`,
// `/false` are unambiguous there and should be allowed.
KeywordName
  = first:IdentStart rest:IdentTail*
    { return first + rest.join(''); }

Ident
  = !ReservedWord first:IdentStart rest:IdentTail*
    { return first + rest.join(''); }

ReservedWord
  = ("true" / "false" / "null") !IdentTail

// Unicode-aware identifier character classes, following UAX #31
// `ID_Start` / `ID_Continue` — the same Unicode category set JS,
// Python 3, and Rust accept in identifiers. `@` joins `ID_Start` as
// the effect-marker sigil; `_` and `-` join `ID_Continue` because
// qlang's idiomatic keyword form is kebab-case (`:user-id`,
// `:before-count`). Cyrillic, Greek, CJK ideographs, Hebrew, Arabic
// all parse bare — `/имя`, `/元素`, `/данные/пользователь` need no
// quoting. Supplementary-plane characters (emoji, mathematical
// alphanumerics) sit outside peggy's one-UTF-16-unit `.` match and
// stay accessible through the quoted `/"…"` projection form.
//
// The character is captured with `.` then validated via a semantic
// predicate; the regex literal runs with the `u` flag so
// `\p{ID_Start}` / `\p{ID_Continue}` resolve against the Unicode
// property tables.
IdentStart "identifier start (letter, underscore, or @-sigil)"
  = c:. &{ return /^[@_\p{ID_Start}]$/u.test(c); } { return c; }
IdentTail  "identifier continue (letter, digit, hyphen, underscore)"
  = c:. &{ return /^[\p{ID_Continue}_\-]$/u.test(c); } { return c; }

// --- Whitespace ------------------------------------------------
//
// `_` is optional whitespace, `__` is required whitespace (used to
// separate an Ident from a following token). Pipeline-level
// comment tokens are full PipeSteps and are parsed separately by
// PipelineHead / ContinuationUnit, so `_` does not consume them.
//
// `_L` is inside-literal whitespace — it absorbs plain comment
// tokens as whitespace-equivalent. Used inside MapLit / ErrorLit
// / SetLit / VecLit body positions and inside ArgList / MapEntries
// / PipelineList separator positions, where a plain comment serves
// as a section divider or per-entry annotation and carries no value
// role. Comment tokens matched here are silently consumed — they
// never enter the AST — so walkers, reify, astNodeToMap, and the
// AST-as-data surface are unaffected by whether an author sprinkles
// section dividers between entries.
//
// Doc comments (`|~~|`, `|~~ ~~|`) are NOT part of `_L`. In
// pipeline position they attach to the following def / as call via
// DocAttachedSequence; standalone, they evaluate to a Doc-value via
// the DocLit Primary alternative. Inside a literal body they are
// not valid — a doc-comment ahead of a MapEntry key, Vec element,
// or Set element fails to parse.

_  = Whitespace*
_L = (Whitespace / PlainCommentStep)*
__ = Whitespace+

Whitespace = [ \t\n\r]
