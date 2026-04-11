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
ContinuationUnit
  = BlockPlainCommentAbsorbing
  / LinePlainCommentAbsorbing
  / AbsorbedCommentContinuation
  / ExplicitContinuation

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
// comments, followed by an operand call. Each doc comment produces
// ONE entry in the `docs` Vec attached to the operand call node.
// Binding operands (let, as) consume docs and store them on the
// conduit/snapshot; other operands ignore docs (harmless metadata).
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

DocCommentList
  = head:DocComment tail:(_ DocComment)*
  { return [head.content, ...tail.map(t => t[1].content)]; }

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

BlockPlainContent
  = chars:(!"~|" .)* { return chars.map(c => c[1]).join(''); }

BlockDocContent
  = chars:(!"~~|" .)* { return chars.map(c => c[1]).join(''); }

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
// With `let` and `as` promoted to regular operand calls in
// langRuntime, RawStep collapses to just Primary. No special
// grammar constructs for binding — `let(:name, body)` and
// `as(:name)` parse as ordinary OperandCall nodes.

RawStep
  = Primary

Primary
  = ParenGroup
  / ErrorLit
  / SetLit
  / VecLit
  / MapLit
  / Projection
  / OperandCall
  / Scalar

ParenGroup
  = "(" _ p:Pipeline _ ")"
    { return node('ParenGroup', { pipeline: p }, location(), text()); }

ErrorLit
  = "!{" _ "}"
    { return node('ErrorLit', { entries: [] }, location(), text()); }
  / "!{" _ entries:MapEntries _ "}"
    { return node('ErrorLit', { entries }, location(), text()); }

MapLit
  = "{" _ "}"
    { return node('MapLit', { entries: [] }, location(), text()); }
  / "{" _ entries:MapEntries _ "}"
    { return node('MapLit', { entries }, location(), text()); }

MapEntries
  = head:MapEntry tail:(_ ","? _ MapEntry)*
    { return [head, ...tail.map(t => t[3])]; }

// A MapEntry may be preceded by a run of doc comments that attach
// as metadata to the entry. At eval time (src/eval.mjs::evalMapLit,
// evalErrorLit) the accumulated docs are folded into the entry's
// value Map as a `:docs` Vec of strings — this is how the Variant-B
// manifest migration preserves the readable `|~~ ... ~~|` writing
// experience for built-in descriptors while eliminating the
// let(:let, ...) self-shadow and the three-hop bootstrap enrichment
// path that the fake-conduit manifest required.
//
// Only consecutive doc comments are consumed as the prefix — plain
// comment interleaving between docs (`|~~| a ~~| |~ note ~| |~~| b`)
// is not supported here by design, mirroring the absence of plain-
// comment support inside Map/Set/Vec literals generally. Doc comments
// preceding a MapEntry with a non-Map value (a scalar, Vec, Set, etc)
// still parse cleanly; the evaluator drops the docs silently in that
// case since there is no target Map to stamp them onto.
MapEntry
  = docs:MapEntryDocPrefix? _ key:Keyword __ value:Pipeline
    { return node('MapEntry', { key, value, docs: docs ?? [] }, location(), text()); }

MapEntryDocPrefix
  = head:DocComment rest:(_ DocComment)*
    { return [head.content, ...rest.map(t => t[1].content)]; }

SetLit
  = "#{" _ "}"
    { return node('SetLit', { elements: [] }, location(), text()); }
  / "#{" _ elements:PipelineList _ "}"
    { return node('SetLit', { elements }, location(), text()); }

VecLit
  = "[" _ "]"
    { return node('VecLit', { elements: [] }, location(), text()); }
  / "[" _ elements:PipelineList _ "]"
    { return node('VecLit', { elements }, location(), text()); }

PipelineList
  = head:Pipeline tail:(_ ","? _ Pipeline)*
    { return [head, ...tail.map(t => t[3])]; }

OperandCall
  = name:Ident !IdentTail args:(_ "(" _ ArgList? _ ")")?
    { return node('OperandCall', { name, args: args ? (args[3] || []) : null }, location(), text()); }

ArgList
  = head:Pipeline tail:(_ ","? _ Pipeline)*
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

KeySegment
  = ":" name:NamespacedName { return name; }
  / ":" name:Ident          { return name; }
  / QuotedKeywordName
  / Ident

Scalar
  = StringLit
  / NumberLit
  / BooleanLit
  / NilLit
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
  / "n" { return '\n'; }
  / "t" { return '\t'; }
  / "r" { return '\r'; }

NumberLit
  = sign:"-"? whole:[0-9]+ frac:("." [0-9]+)?
    { const txt = (sign || '') + whole.join('') + (frac ? '.' + frac[1].join('') : '');
      return node('NumberLit', { value: Number(txt) }, location(), text()); }

BooleanLit
  = "true"  !IdentTail { return node('BooleanLit', { value: true }, location(), text()); }
  / "false" !IdentTail { return node('BooleanLit', { value: false }, location(), text()); }

NilLit
  = "nil" !IdentTail { return node('NilLit', {}, location(), text()); }

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
  / ":" name:Ident              { return node('Keyword', { name }, location(), text()); }

NamespacedName
  = head:Ident tail:("/" Ident)+
    { return head + tail.map(t => '/' + t[1]).join(''); }

QuotedKeywordName
  = '"' chars:DoubleStringChar* '"' { return chars.join(''); }

Ident
  = !ReservedWord first:IdentStart rest:IdentTail*
    { return first + rest.join(''); }

ReservedWord
  = ("true" / "false" / "nil") !IdentTail

IdentStart = [@_a-zA-Z]
IdentTail  = [a-zA-Z0-9_-]

// --- Whitespace ------------------------------------------------
//
// `_` is optional whitespace, `__` is required whitespace (used to
// separate an Ident from a following token). Comment tokens are
// full PipeSteps, not whitespace — they are not consumed here.

_  = Whitespace*
__ = Whitespace+

Whitespace = [ \t\n\r]
