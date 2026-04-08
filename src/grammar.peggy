// PEG grammar for the qlang expression language.
//
// Mirrors the Grammar section of docs/jdt-query-lang-spec.md.
//
// Generated parser exports `parse(source)` returning an AST whose
// nodes are JS objects with a discriminator `type` field. Comma is
// optional whitespace; newlines are whitespace.
//
// Comments are first-class PipeSteps with identity semantics. Four
// forms share the `|~` character family:
//   |~|         line plain       — identity step, content to newline
//   |~ ... ~|   block plain      — identity step, content to ~|
//   |~~|        line doc         — attach content to next RawStep
//   |~~ ... ~~| block doc        — attach content to next RawStep
//
// The leading `|` in every comment token absorbs the pipeline
// combinator that would otherwise have preceded the step.

{{
  // Helpers shared across actions.
  function vec(type, fields) { return { type, ...fields }; }

  // Attach a docs Vec to a raw step node, preserving its other fields.
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
  = headRaw:PipelineHead tail:(_ ContinuationUnit)*
  {
    // PipelineHead may return either a single AST node (the first
    // step) or an array of [headStep, ...continuationUnits] when
    // the head is a BlockPlainComment that absorbed its trailing
    // combinator and ate a follower step.
    const headUnits = Array.isArray(headRaw) ? headRaw : [headRaw];
    const head = headUnits[0];
    const headTail = headUnits.slice(1);
    const rest = [...headTail, ...tail.flatMap(t => flattenUnits(t[1]))];
    if (rest.length === 0) return head;
    return vec('Pipeline', {
      steps: [head, ...rest.map(u => ({ combinator: u.combinator, step: u.step }))]
    });
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
// the combinator from the previous step.
AbsorbedCommentContinuation
  = step:DocAttachedSequence { return { combinator: '|', step }; }
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

// One or more consecutive doc comments followed (eventually) by a
// RawStep. Each doc comment produces ONE entry in the `docs` Vec.
// Adjacent line docs do NOT concatenate — each is its own entry.
// Block docs preserve internal newlines as a single multi-line entry.
DocAttachedSequence
  = docs:DocCommentList _ c:Combinator? _ step:RawStep
  { return withDocs(step, docs); }

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
  { return vec('LineDocComment', { content }); }

BlockDocComment
  = "|~~" !"|" content:BlockDocContent "~~|"
  { return vec('BlockDocComment', { content }); }

LinePlainComment
  = "|~|" content:LineCommentContent
  { return vec('LinePlainComment', { content }); }

BlockPlainComment
  = "|~" ![|~] content:BlockPlainContent "~|"
  { return vec('BlockPlainComment', { content }); }

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

Combinator
  = ">>" { return '>>'; }
  / "|" !"~" { return '|'; }
  / "*"  { return '*'; }

// --- Raw steps (non-comment) -----------------------------------

RawStep
  = LetStep
  / AsStep
  / Primary

LetStep
  = "let" __ name:Ident _ "=" _ body:Primary
    { return vec('LetStep', { name, body, docs: [] }); }

AsStep
  = "as" __ name:Ident
    { return vec('AsStep', { name, docs: [] }); }

Primary
  = ParenGroup
  / SetLit
  / VecLit
  / MapLit
  / Projection
  / OperandCall
  / Scalar

ParenGroup
  = "(" _ p:Pipeline _ ")" { return vec('ParenGroup', { pipeline: p }); }

MapLit
  = "{" _ "}" { return vec('MapLit', { entries: [] }); }
  / "{" _ entries:MapEntries _ "}" { return vec('MapLit', { entries }); }

MapEntries
  = head:MapEntry tail:(_ ","? _ MapEntry)*
    { return [head, ...tail.map(t => t[3])]; }

MapEntry
  = key:Keyword __ value:Pipeline
    { return { key, value }; }

SetLit
  = "#{" _ "}" { return vec('SetLit', { elements: [] }); }
  / "#{" _ elements:PipelineList _ "}" { return vec('SetLit', { elements }); }

VecLit
  = "[" _ "]" { return vec('VecLit', { elements: [] }); }
  / "[" _ elements:PipelineList _ "]" { return vec('VecLit', { elements }); }

PipelineList
  = head:Pipeline tail:(_ ","? _ Pipeline)*
    { return [head, ...tail.map(t => t[3])]; }

OperandCall
  = name:Ident !IdentTail args:(_ "(" _ ArgList? _ ")")?
    { return vec('OperandCall', { name, args: args ? (args[3] || []) : null }); }

ArgList
  = head:Pipeline tail:(_ ","? _ Pipeline)*
    { return [head, ...tail.map(t => t[3])]; }

Projection
  = "/" first:Ident rest:("/" Ident)*
    { return vec('Projection', { keys: [first, ...rest.map(r => r[1])] }); }

Scalar
  = StringLit
  / NumberLit
  / BooleanLit
  / NilLit
  / Keyword

StringLit
  = '"' chars:DoubleStringChar* '"'
    { return vec('StringLit', { value: chars.join('') }); }

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
    { const text = (sign || '') + whole.join('') + (frac ? '.' + frac[1].join('') : '');
      return vec('NumberLit', { value: Number(text) }); }

BooleanLit
  = "true"  !IdentTail { return vec('BooleanLit', { value: true }); }
  / "false" !IdentTail { return vec('BooleanLit', { value: false }); }

NilLit
  = "nil" !IdentTail { return vec('NilLit', {}); }

Keyword
  = ":" name:Ident { return vec('Keyword', { name }); }

Ident
  = !ReservedWord first:IdentStart rest:IdentTail*
    { return first + rest.join(''); }

ReservedWord
  = ("let" / "as" / "true" / "false" / "nil") !IdentTail

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
