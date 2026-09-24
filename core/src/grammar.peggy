// PEG grammar for the qlang expression language.
//
// A step is a command, a name followed by its modifiers, each one word
// [D10]. At the top level a line is a step: a command's modifiers end
// with their line, and a line that neither ends nor begins with a
// combinator continues the pipeline through `|` [D11, D43]. Inside
// brackets a newline is whitespace. Every combinator is set off by
// whitespace on both sides.
//
// Every produced node carries `.location` (peggy's start/end offsets,
// lines and columns) and `.text` (the matched source slice). The
// post-parse pass in src/parse.mjs adds `.id` and `.parent` on every
// node and `.source`/`.uri`/`.parseId`/`.schemaVersion` on the root.
//
// Comments are steps with identity semantics, in four forms sharing
// the `|~` family: `|~|` line plain, `|~ … ~|` block plain, `|~~|` line
// doc, `|~~ … ~~|` block doc. The leading `|` of a comment token
// absorbs the combinator before it, and the step after a plain comment
// written without a combinator carries the absorbed marker
// (`combinator: null`) on its continuation unit.

{{
  function node(type, fields, loc, txt) {
    return { type, ...fields, location: loc, text: txt };
  }

  function withDocs(step, docs) {
    return { ...step, docs };
  }

  // A unit may be an array of units when a block comment absorbed the
  // combinator after it and ate its follower.
  function flattenUnits(unit) {
    if (Array.isArray(unit)) return unit.flatMap(flattenUnits);
    return [unit];
  }

  function absorbedUnit(step) {
    return { combinator: null, step };
  }

  function followerUnitsOf(follower) {
    return Array.isArray(follower) ? follower : [absorbedUnit(follower)];
  }

  // A doc-attached sequence in continuation position hands its first
  // element the pipe its doc comment absorbed.
  function absorbedSequence(step) {
    if (Array.isArray(step)) return [{ combinator: '|', step: step[0] }, ...step.slice(1)];
    return { combinator: '|', step };
  }

  // The docs of a doc-attached sequence ride the step after them; plain
  // comments interleaved with them stand as identity steps before it.
  function attachDocs(firstDoc, rest, step) {
    const docs = [];
    const plainSteps = [];
    for (const item of [firstDoc, ...rest.map(t => t[1])]) {
      if (item.type === 'LineDocComment' || item.type === 'BlockDocComment') docs.push(item.content);
      else plainSteps.push(item);
    }
    const existingDocs = Array.isArray(step.docs) ? step.docs : [];
    const bound = withDocs(step, [...docs, ...existingDocs]);
    bound.docPrefixStart = firstDoc.location.start.offset;
    if (plainSteps.length === 0) return bound;
    return [
      plainSteps[0],
      ...plainSteps.slice(1).map(p => ({ combinator: '|', step: p })),
      absorbedUnit(bound)
    ];
  }

  function bindStepNode(key, docs, rest, loc, txt) {
    const params = rest && rest.params ? rest.params : null;
    const body = rest && rest.body ? rest.body : null;
    const fields = { key, docs: docs || null, params, body };
    if (docs && typeof docs._start === 'number') fields.docPrefixStart = docs._start;
    return node('BindStep', fields, loc, txt);
  }

  // The same reading as `walk.mjs::isPlainCommentStep`, spelled here
  // because the generated parser is its own compilation unit.
  const PLAIN_COMMENT_STEP_TYPES = new Set(['LinePlainComment', 'BlockPlainComment']);
  function isPlainCommentStep(astNode) {
    return PLAIN_COMMENT_STEP_TYPES.has(astNode.type);
  }
}}

{
  function assemblePipeline(leadingComb, headRaw, tail, loc, txt) {
    const hasLeadingComb = leadingComb !== null;
    const headUnits = Array.isArray(headRaw) ? headRaw : [headRaw];
    const head = headUnits[0];
    const rest = [...headUnits.slice(1), ...tail.flatMap(flattenUnits)];
    if (hasLeadingComb && isPlainCommentStep(head)) {
      const firstOperandUnit = rest.find(u => !isPlainCommentStep(u.step));
      if (firstOperandUnit !== undefined && firstOperandUnit.combinator !== null) {
        error('a leading combinator and an explicit combinator both address the first operand step after a comment head');
      }
    }
    if (rest.length === 0 && !hasLeadingComb) return head;
    const fields = { steps: [head, ...rest.map(u => ({ combinator: u.combinator, step: u.step }))] };
    if (hasLeadingComb) fields.leadingCombinator = leadingComb[0];
    return node('Pipeline', fields, loc, txt);
  }

  function refuseCombinatorSpacing(combinator) {
    error(`a combinator is set off by whitespace on both sides: write \` ${combinator} \``);
  }
}

Query
  = _ p:LinePipeline _ { return p; }

// ── Pipelines ──────────────────────────────────────────────────────
//
// `Pipeline` reads inside brackets and `LinePipeline` at the top level;
// the rules prefixed `Line` differ from their bracketed twins only in
// where a command's modifiers end and in the pipe a line break stands
// for.

Pipeline
  = leadingComb:(LeadingCombinator __)? headRaw:PipelineHead tail:ContinuationUnit*
    { return assemblePipeline(leadingComb, headRaw, tail, location(), text()); }

LinePipeline
  = leadingComb:(LeadingCombinator __)? headRaw:LinePipelineHead tail:LineContinuationUnit*
    { return assemblePipeline(leadingComb, headRaw, tail, location(), text()); }

// The `!"~"` lookahead keeps the comment markers `|~`, `|~|`, `|~~`,
// `|~~|` from reading as a pipe.
LeadingCombinator
  = "!|" / "|" !"~" { return '|'; } / "*"

Combinator
  = "!|" { return '!|'; }
  / "|" !"~" { return '|'; }
  / "*"  { return '*'; }

PipelineHead
  = c:BlockPlainComment _ follower:FollowerUnit { return [c, ...followerUnitsOf(follower)]; }
  / c:LinePlainComment _ follower:FollowerUnit { return [c, ...followerUnitsOf(follower)]; }
  / DocAttachedSequence
  / PlainCommentStep
  / BindStep
  / Step
  / c:LeadingCombinator &NonSpace { refuseCombinatorSpacing(c); }

LinePipelineHead
  = c:BlockPlainComment _ follower:LineFollowerUnit { return [c, ...followerUnitsOf(follower)]; }
  / c:LinePlainComment _ follower:LineFollowerUnit { return [c, ...followerUnitsOf(follower)]; }
  / LineDocAttachedSequence
  / PlainCommentStep
  / LineBindStep
  / LineStep
  / c:LeadingCombinator &NonSpace { refuseCombinatorSpacing(c); }

ContinuationUnit
  = _ c:PlainCommentStep _ follower:FollowerUnit
    { return [{ combinator: '|', step: c }, ...followerUnitsOf(follower)]; }
  / _ u:AbsorbedCommentContinuation { return u; }
  / _ step:DocLit { return { combinator: '|', step }; }
  / __ step:BindStep { return { combinator: '|', step }; }
  / __ c:Combinator __ step:StepAfterCombinator { return { combinator: c, step }; }
  / SpacingRefusal

// A break with a combinator at neither end stands for `|` at the top
// level.
LineContinuationUnit
  = _ c:PlainCommentStep _ follower:LineFollowerUnit
    { return [{ combinator: '|', step: c }, ...followerUnitsOf(follower)]; }
  / _ u:LineAbsorbedCommentContinuation { return u; }
  / _ step:DocLit { return { combinator: '|', step }; }
  / __ step:LineBindStep { return { combinator: '|', step }; }
  / __ c:Combinator __ step:LineStepAfterCombinator { return { combinator: c, step }; }
  / _h Newline _ !Combinator step:LineStepAfterCombinator { return { combinator: '|', step }; }
  / SpacingRefusal

// A combinator written against its neighbour, a pipe written against a
// tilde, which opens a comment, and a word written against the word
// before it; a slash written against a word is the dangling segment of
// a projection, which the parser names by the key it expected.
SpacingRefusal
  = _ "|~" { error('`|~` opens a comment that is never closed; a pipe before a quote is written `| ~(…)`'); }
  / c:Combinator { refuseCombinatorSpacing(c); }
  / __ c:Combinator &NonSpace { refuseCombinatorSpacing(c); }
  / &(!"/" Word) Word { error('words are set off by whitespace; only the first modifier of a command may touch its name, `f(a) (b)`'); }

FollowerUnit
  = c:PlainCommentStep _ inner:FollowerUnit { return [{ combinator: '|', step: c }, ...followerUnitsOf(inner)]; }
  / DocAttachedSequence
  / PlainCommentStep
  / BindStep
  / Step

LineFollowerUnit
  = c:PlainCommentStep _ inner:LineFollowerUnit { return [{ combinator: '|', step: c }, ...followerUnitsOf(inner)]; }
  / LineDocAttachedSequence
  / PlainCommentStep
  / LineBindStep
  / LineStep

AbsorbedCommentContinuation
  = step:DocAttachedSequence { return absorbedSequence(step); }
  / step:PlainCommentStep { return { combinator: '|', step }; }

LineAbsorbedCommentContinuation
  = step:LineDocAttachedSequence { return absorbedSequence(step); }
  / step:PlainCommentStep { return { combinator: '|', step }; }

StepAfterCombinator
  = DocAttachedSequence
  / BindStep
  / Step

LineStepAfterCombinator
  = LineDocAttachedSequence
  / LineBindStep
  / LineStep

// One or more doc comments, optionally interleaved with plain ones,
// attached to the declaration or the `as` after them; each doc comment
// is one entry of the step's `docs`. Before any other step a doc
// comment is a standalone doc value.
DocAttachedSequence
  = firstDoc:DocComment rest:(_ DocOrPlainItem)* _ step:DocAttachableStep
    { return attachDocs(firstDoc, rest, step); }

LineDocAttachedSequence
  = firstDoc:DocComment rest:(_ DocOrPlainItem)* _ step:LineDocAttachableStep
    { return attachDocs(firstDoc, rest, step); }

DocAttachableStep
  = BindStep
  / step:Command & { return step.name === 'as'; } { return step; }

LineDocAttachableStep
  = LineBindStep
  / step:LineCommand & { return step.name === 'as'; } { return step; }

DocOrPlainItem
  = DocComment
  / PlainCommentStep

DocComment
  = LineDocComment
  / BlockDocComment

PlainCommentStep
  = LinePlainComment
  / BlockPlainComment

// ── Comment tokens ─────────────────────────────────────────────────
//
// Longer markers are tried first: `|~~|` before `|~|`, `|~~` before
// `|~`. A block comment nests, and a quote span inside it is opaque,
// so neither a nested closer nor one inside a quote ends it.

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

QuoteSpan
  = "~(" content:QuoteContent ")"
    { return '~(' + content + ')'; }

// Inside a block comment the line markers are bare tokens, the block
// forms nest, and the closer of the other block shape is content.
NestedLineDocSpan
  = "|~~|"
    { return text(); }
NestedLinePlainSpan
  = "|~|"
    { return text(); }
NestedBlockDocSpan
  = "|~~" !"|" BlockDocContent "~~|"
    { return text(); }
NestedBlockPlainSpan
  = "|~" ![|~] BlockPlainContent "~|"
    { return text(); }

BlockPlainContent
  = chars:(
      QuoteSpan
      / NestedLineDocSpan
      / NestedLinePlainSpan
      / NestedBlockDocSpan
      / NestedBlockPlainSpan
      / "~~|"
      / (!"~|" .)
    )*
    { return chars.map(c => typeof c === 'string' ? c : c[1]).join(''); }

BlockDocContent
  = chars:(
      QuoteSpan
      / NestedLineDocSpan
      / NestedLinePlainSpan
      / NestedBlockDocSpan
      / NestedBlockPlainSpan
      / "~|"
      / (!"~~|" .)
    )*
    { return chars.map(c => typeof c === 'string' ? c : c[1]).join(''); }

// ── Steps ──────────────────────────────────────────────────────────

// A step is a command, a word or a doc; a name alone is a command
// without modifiers.
Step
  = Command
  / Word
  / DocLit

LineStep
  = LineCommand
  / Word
  / DocLit

// A command's modifiers are words; the first may touch the name when
// it opens with a parenthesis, so `filter(gt(1))` reads as `filter` with
// the group `(gt(1))`. At the top level the modifiers end with the line.
Command
  = name:Ident first:(FirstModifierSeparator @ModifierWord)? rest:(__ @ModifierWord)*
    { return node('OperandCall', { name, args: first === null ? [] : [first, ...rest] }, location(), text()); }

LineCommand
  = name:Ident first:(FirstLineModifierSeparator @ModifierWord)? rest:(_h1 @ModifierWord)*
    { return node('OperandCall', { name, args: first === null ? [] : [first, ...rest] }, location(), text()); }

FirstModifierSeparator
  = __ / &"("

FirstLineModifierSeparator
  = _h1 / &"("

// A declaration: a keyword or a tag name, then an optional doc, an
// optional vector of keyword parameters and an optional body, each of
// which may take a line of its own. A body is a step other than a bare
// keyword or tag name; a lone `:foo` is a keyword.
BindStep
  = key:BindName docs:(__ @DocPrefix)? rest:(__ @BindRest)?
    & { return docs !== null || rest !== null; }
    { return bindStepNode(key, docs, rest, location(), text()); }

LineBindStep
  = key:BindName docs:(__ @DocPrefix)? rest:(__ @LineBindRest)?
    & { return docs !== null || rest !== null; }
    { return bindStepNode(key, docs, rest, location(), text()); }

BindName
  = key:Keyword         { return key; }
  / key:BareTypeKeyword { return key; }

// The doc prefix after the name; plain comments between its docs stay
// layout. `docs._start` carries the prefix's offset to the tools.
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
      docs._start = first.location.start.offset;
      return docs;
    }

// A parameter vector holds keywords only; any other vector is a body.
BindRest
  = params:Params _? body:BindBody { return { params, body }; }
  / body:BindBody                  { return { params: null, body }; }

LineBindRest
  = params:Params _? body:LineBindBody { return { params, body }; }
  / body:LineBindBody                  { return { params: null, body }; }

Params
  = "[" _L head:Keyword tail:((Whitespace / PlainCommentStep)+ @Keyword)* _L "]"
    { return [head, ...tail]; }
  / "[" _L "]" { return []; }

BindBody
  = body:Step
    & { return body.type !== 'Keyword' && body.type !== 'BareTypeKeyword'; }
    { return body; }

LineBindBody
  = body:LineStep
    & { return body.type !== 'Keyword' && body.type !== 'BareTypeKeyword'; }
    { return body; }

// ── Words ──────────────────────────────────────────────────────────
//
// A word is a literal, a projection, a name, a quote or a pipeline in
// parentheses. Inside a literal every element is a word, so a command
// with modifiers stands there in parentheses.

Word
  = ParenGroup
  / ErrorLit
  / SetLit
  / VecLit
  / MapLit
  / QuoteLit
  / ShortQuoteLit
  / TaggedLit
  / BareTypeKeyword
  / Projection
  / Name
  / Scalar

// The element of a literal, which a doc value may be too; a doc after
// a command is the next step, never its modifier.
Element
  = Word
  / DocLit

ModifierWord
  = Word

Name
  = name:Ident
    { return node('OperandCall', { name, args: [] }, location(), text()); }

// `::tag<payload>` constructs a value through the tag's constructor,
// the payload touching the name; `::tag` alone is the tag name itself.
TaggedLit
  = "::" tag:TagName payload:Element
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
  / "(" _ Pipeline _ "," { error('the argument comma left the language: modifiers are separated by spaces, `f a b`'); }

// A quote holds the pipeline it is written around, a leading combinator
// included (`~(* inc | sort)`, `~(!| /trail)`); `~()` is the empty
// quote. A single name, projection or tag name may drop the
// parentheses, `~add`, `~/age`.
QuoteLit
  = "~(" _ pipeline:Pipeline? _ ")"
    { return node('QuoteLit', { pipeline }, location(), text()); }

ShortQuoteLit
  = "~" pipeline:(Projection / BareTypeKeyword / Name)
    { return node('QuoteLit', { pipeline }, location(), text()); }

// The balance reading of a `~(…)` span inside a comment or a doc, where
// the span is prose: parentheses nest, and a string or a comment token
// ends on its own closer, so the outer `)` is reached only when nothing
// nests at the cursor.
QuoteContent
  = parts:QuotePart* { return parts.join(''); }

QuotePart
  = NestedParenSpan
  / QuoteStringSpan
  / QuoteBlockDocSpan
  / QuoteBlockPlainSpan
  / QuoteLineDocSpan
  / QuoteLinePlainSpan
  / QuoteChar

NestedParenSpan
  = "(" inner:QuoteContent ")"
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
  = ![()] c:. { return c; }

// A doc value, in a line form and a block form; the printer writes the
// block form.
DocLit
  = "|~~|" content:LineCommentContent
    { return node('DocLit', { content }, location(), text()); }
  / "|~~" !"|" content:BlockDocContent "~~|"
    { return node('DocLit', { content }, location(), text()); }

// ── Literals ───────────────────────────────────────────────────────

ErrorLit
  = "!{" _L "}"
    { return node('ErrorLit', { entries: [] }, location(), text()); }
  / "!{" _L head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _L "}"
    { return node('ErrorLit', { entries: [head, ...tail] }, location(), text()); }

// Braces with string keys and commas are JSON syntax for a map, whose
// keys read as the keywords of their strings; a literal mixing the two
// spellings is refused.
MapLit
  = "{" _L head:JsonMapEntry tail:(_L "," _L @JsonMapEntry)* _L "}"
    { return node('MapLit', { entries: [head, ...tail] }, location(), text()); }
  / "{" _L head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _L "}"
    { return node('MapLit', { entries: [head, ...tail] }, location(), text()); }
  / "{" _L "}"
    { return node('MapLit', { entries: [] }, location(), text()); }
  / "{" _L QlangMapEntry (_L QlangMapEntry)* _L !"}" !Keyword Element
    { error('a map entry holds one word; a command with modifiers or a pipeline stands in parentheses there: `{:k (f x)}`'); }

JsonMapEntry
  = key:StringLit _L ":" _L value:Element
    { return node('MapEntry', { key: node('Keyword', { name: key.value }, key.location, key.text), value }, location(), text()); }

QlangMapEntry
  = key:Keyword __ value:Element
    { return node('MapEntry', { key, value }, location(), text()); }

SetLit
  = "#[" _L "]"
    { return node('SetLit', { elements: [] }, location(), text()); }
  / "#[" _L elements:ElementList _L "]"
    { return node('SetLit', { elements }, location(), text()); }

// Brackets with commas are JSON syntax for a vector; whitespace-separated
// elements are the vector's own.
VecLit
  = "[" _L head:Element tail:(_L "," _L @Element)+ _L "]"
    { return node('VecLit', { elements: [head, ...tail] }, location(), text()); }
  / "[" _L elements:ElementList _L "]"
    { return node('VecLit', { elements }, location(), text()); }
  / "[" _L "]"
    { return node('VecLit', { elements: [] }, location(), text()); }

ElementList
  = head:Element tail:(LiteralGap @Element)*
    { return [head, ...tail]; }

// The words of a literal are set off by whitespace or a comment, so a
// call written by habit, `[mul(2)]`, is refused where it would read as
// two elements.
LiteralGap
  = (Whitespace / PlainCommentStep)+
  / &(!"/" Element) Element { error('the words of a literal are set off by whitespace, and a command with modifiers stands there in parentheses, `[(f x)]`'); }

// `/` alone is the identity projection; a segment is a bare key, a
// quoted key, a namespaced keyword after `:`, or an index.
Projection
  = "/" first:KeySegment rest:("/" @KeySegment)*
    { return node('Projection', { keys: [first, ...rest] }, location(), text()); }
  / "/"
    { return node('Projection', { keys: [] }, location(), text()); }

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

// A number is a finite double, so digits naming a magnitude outside
// that domain match no production. `text()` reads empty inside a
// semantic predicate, so the predicate reads its labels.
NumberLit "number within the finite double range"
  = sign:"-"? whole:[0-9]+ frac:("." [0-9]+)? exp:([eE] [+\-]? [0-9]+)?
    &{ const matched = (sign || '') + whole.join('')
                     + (frac ? '.' + frac[1].join('') : '')
                     + (exp  ? exp[0] + (exp[1] || '') + exp[2].join('') : '');
       return Number.isFinite(Number(matched)); }
    { return node('NumberLit', { value: Number(text()) }, location(), text()); }

BooleanLit
  = "true"  !IdentTail { return node('BooleanLit', { value: true }, location(), text()); }
  / "false" !IdentTail { return node('BooleanLit', { value: false }, location(), text()); }

NullLit
  = "null" !IdentTail { return node('NullLit', {}, location(), text()); }

// `:name` and `:"any text"` read as the same keyword.
Keyword
  = ":" name:QuotedKeywordName  { return node('Keyword', { name }, location(), text()); }
  / ":" name:NamespacedName     { return node('Keyword', { name }, location(), text()); }
  / ":" name:KeywordName        { return node('Keyword', { name }, location(), text()); }

NamespacedName
  = head:Ident tail:("/" @Ident)+
    { return head + tail.map(t => '/' + t).join(''); }

QuotedKeywordName
  = '"' chars:DoubleStringChar* '"' { return chars.join(''); }

// A name after `:` or `/` may be a reserved word.
KeywordName
  = first:IdentStart rest:IdentTail*
    { return first + rest.join(''); }

Ident
  = !ReservedWord first:IdentStart rest:IdentTail*
    { return first + rest.join(''); }

ReservedWord
  = ("true" / "false" / "null") !IdentTail

// UAX #31 `ID_Start` / `ID_Continue`, with `@` starting a name and `_`
// and `-` continuing one.
IdentStart "identifier start (letter, underscore, or @-sigil)"
  = c:. &{ return /^[@_\p{ID_Start}]$/u.test(c); } { return c; }
IdentTail  "identifier continue (letter, digit, hyphen, underscore)"
  = c:. &{ return /^[\p{ID_Continue}_\-]$/u.test(c); } { return c; }

// ── Whitespace ─────────────────────────────────────────────────────
//
// `_` is optional whitespace, `__` required whitespace, `_h` and `_h1`
// optional and required whitespace within a line, `_L` whitespace
// inside a literal, where a plain comment is whitespace too.

_   = Whitespace*
_L  = (Whitespace / PlainCommentStep)*
__  = Whitespace+
_h  = [ \t]*
_h1 = [ \t]+

Newline = "\r"? "\n"

Whitespace = [ \t\n\r]

NonSpace = [^ \t\n\r]
