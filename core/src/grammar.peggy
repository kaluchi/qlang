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
// A plain comment, `|~| …` to the end of its line or `|~ … ~|`, is
// whitespace wherever whitespace stands [D81]; the parser records each on
// the side, `options.commentTrivia`, for the tools. The doc forms,
// `|~~| …` and `|~~ … ~~|`, are the doc literal, which documents the
// declaration whose slot it stands in [D83].

{{
  function node(type, fields, loc, txt) {
    return { type, ...fields, location: loc, text: txt };
  }
}}

{
  const commentTrivia = options.commentTrivia;

  // A plain comment the parser read as whitespace, kept by its offset,
  // since a branch the parser abandons reads the same comment again.
  function recordComment(type, content) {
    const loc = location();
    commentTrivia.set(loc.start.offset, { type, content, location: loc, text: text() });
  }

  function assemblePipeline(leadingComb, head, tail, loc, txt) {
    const hasLeadingComb = leadingComb !== null;
    if (tail.length === 0 && !hasLeadingComb) return head;
    const fields = { steps: [head, ...tail] };
    if (hasLeadingComb) fields.leadingCombinator = leadingComb[0];
    return node('Pipeline', fields, loc, txt);
  }

  function refuseCombinatorSpacing(combinator) {
    error(`a combinator is set off by whitespace on both sides: write \` ${combinator} \``);
  }
}

// A source of whitespace alone, comments among it, is the empty
// pipeline, which answers the value it is handed, as the empty quote
// does [D81].
Query
  = _ p:LinePipeline _ { return p; }
  / _ { return node('Blank', {}, location(), text()); }

// ── Pipelines ──────────────────────────────────────────────────────
//
// `Pipeline` reads inside brackets and `LinePipeline` at the top level;
// the rules prefixed `Line` differ from their bracketed twins only in
// where a command's modifiers end and in the pipe a line break stands
// for.

Pipeline
  = leadingComb:(LeadingCombinator __)? head:PipelineHead tail:ContinuationUnit*
    { return assemblePipeline(leadingComb, head, tail, location(), text()); }

LinePipeline
  = leadingComb:(LeadingCombinator __)? head:LinePipelineHead tail:LineContinuationUnit*
    { return assemblePipeline(leadingComb, head, tail, location(), text()); }

// The `!"~"` lookahead keeps the comment markers `|~`, `|~|`, `|~~`,
// `|~~|` from reading as a pipe.
LeadingCombinator
  = "!|" / "|" !"~" { return '|'; } / "*"

Combinator
  = "!|" { return '!|'; }
  / "|" !"~" { return '|'; }
  / "*"  { return '*'; }

PipelineHead
  = DocBeforeDeclaration
  / BindStep
  / Step
  / c:LeadingCombinator &NonSpace { refuseCombinatorSpacing(c); }

LinePipelineHead
  = LineDocBeforeDeclaration
  / LineBindStep
  / LineStep
  / c:LeadingCombinator &NonSpace { refuseCombinatorSpacing(c); }

// A doc literal's opening `|` is the pipe to the doc value it is.
ContinuationUnit
  = _ DocBeforeDeclaration
  / _ step:DocLit { return { combinator: '|', step }; }
  / __ step:BindStep { return { combinator: '|', step }; }
  / __ c:Combinator __ step:StepAfterCombinator { return { combinator: c, step }; }
  / SpacingRefusal

// A break with a combinator at neither end stands for `|` at the top
// level.
LineContinuationUnit
  = _ LineDocBeforeDeclaration
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

StepAfterCombinator
  = DocBeforeDeclaration
  / BindStep
  / Step

LineStepAfterCombinator
  = LineDocBeforeDeclaration
  / LineBindStep
  / LineStep

// A doc documents the declaration whose slot it stands in, between the
// name and the body; written before a declaration it is refused, since
// no step reads a doc it hands to the next [D83].
DocBeforeDeclaration
  = DocLit (_ DocLit)* _ &BindStep
    { error('a doc stands in the slot of the declaration it documents: write `:name |~~ … ~~| body`'); }

LineDocBeforeDeclaration
  = DocLit (_ DocLit)* _ &LineBindStep
    { error('a doc stands in the slot of the declaration it documents: write `:name |~~ … ~~| body`'); }

PlainComment
  = LinePlainComment
  / BlockPlainComment

// ── Comment tokens ─────────────────────────────────────────────────
//
// Longer markers are tried first: `|~~|` before `|~|`, `|~~` before
// `|~`. A block comment nests, and a quote span inside it is opaque,
// so neither a nested closer nor one inside a quote ends it.

LinePlainComment
  = "|~|" content:LineCommentContent
  { recordComment('LinePlainComment', content); }

BlockPlainComment
  = "|~" ![|~] content:BlockPlainContent "~|"
  { recordComment('BlockPlainComment', content); }

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
  = callName:CallName first:(FirstModifierSeparator @ModifierWord)? rest:(__ @ModifierWord)*
    { return node('OperandCall', { ...callName, args: first === null ? [] : [first, ...rest] }, location(), text()); }

LineCommand
  = callName:CallName first:(FirstLineModifierSeparator @ModifierWord)? rest:(_h1 @ModifierWord)*
    { return node('OperandCall', { ...callName, args: first === null ? [] : [first, ...rest] }, location(), text()); }

FirstModifierSeparator
  = __ / &"("

FirstLineModifierSeparator
  = _h1 / &"("

// A declaration: a keyword or a tag name, then the doc literals of its
// slot and an optional body, each of which may take a line of its own.
// A body is a step other than a bare keyword or tag name; a lone `:foo`
// is a keyword.
BindStep
  = key:BindName docs:(__ @DocSlot)? body:(_h1 @KindBody / __ @BindBody)?
    & { return docs !== null || body !== null; }
    { return node('BindStep', { key, docs, body }, location(), text()); }

LineBindStep
  = key:BindName docs:(__ @DocSlot)? body:(_h1 @LineKindBody / __ @LineBindBody)?
    & { return docs !== null || body !== null; }
    { return node('BindStep', { key, docs, body }, location(), text()); }

BindName
  = key:Keyword         { return key; }
  / key:BareTypeKeyword { return key; }

DocSlot
  = first:DocLit rest:(_ @DocLit)*
    { return [first, ...rest]; }

BindBody
  = body:Step
    & { return body.type !== 'Keyword' && body.type !== 'BareTypeKeyword'; }
    { return body; }

LineBindBody
  = body:LineStep
    & { return body.type !== 'Keyword' && body.type !== 'BareTypeKeyword'; }
    { return body; }

// A keyword or a tag name is a body on the line of its declaration's
// name or doc; on a later line it opens a declaration of its own [D66].
KindBody
  = body:Step
    & { return body.type === 'Keyword' || body.type === 'BareTypeKeyword'; }
    { return body; }

LineKindBody
  = body:LineStep
    & { return body.type === 'Keyword' || body.type === 'BareTypeKeyword'; }
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
  = callName:CallName
    { return node('OperandCall', { ...callName, args: [] }, location(), text()); }

// A name with a path, the path of a noun and the name of a verb that
// lives on it, calls the verb by its address, as the keyword and the tag
// name carry a path [D62]: `vec/count` is the `count` of vectors.
CallName
  = head:Ident tail:("/" @KeywordName)+
    {
      const verb = tail[tail.length - 1];
      const noun = [head, ...tail.slice(0, -1)].join('/');
      return { name: `${noun}/${verb}`, address: { noun, verb } };
    }
  / name:Ident { return { name }; }

// `::tag<payload>` constructs a value through the tag's constructor,
// the payload touching the name; `::tag` alone is the tag name itself.
TaggedLit
  = "::" tag:TagName payload:Element
    { return node('TaggedLit', { tag, payload }, location(), text()); }

BareTypeKeyword
  = "::" tag:TagName
    { return node('BareTypeKeyword', { tag }, location(), text()); }

// A tag's name lives apart from the values, so a name after `::` may be
// a reserved word, as after `:` and `/`: `::null` is the kind of null
// [D32].
TagName
  = NamespacedName
  / KeywordName

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
  = "!{" _ "}"
    { return node('ErrorLit', { entries: [] }, location(), text()); }
  / "!{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ "}"
    { return node('ErrorLit', { entries: [head, ...tail] }, location(), text()); }

// Braces with string keys and commas are JSON syntax for a map, whose
// keys read as the keywords of their strings; a literal mixing the two
// spellings is refused.
MapLit
  = "{" _ head:JsonMapEntry tail:(_ "," _ @JsonMapEntry)* _ "}"
    { return node('MapLit', { entries: [head, ...tail] }, location(), text()); }
  / "{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ "}"
    { return node('MapLit', { entries: [head, ...tail] }, location(), text()); }
  / "{" _ "}"
    { return node('MapLit', { entries: [] }, location(), text()); }
  / "{" _ QlangMapEntry (_ QlangMapEntry)* _ !"}" !Keyword Element
    { error('a map entry holds one word; a command with modifiers or a pipeline stands in parentheses there: `{:k (f x)}`'); }

JsonMapEntry
  = key:StringLit _ ":" _ value:Element
    { return node('MapEntry', { key: node('Keyword', { name: key.value }, key.location, key.text), value }, location(), text()); }

QlangMapEntry
  = key:Keyword __ value:Element
    { return node('MapEntry', { key, value }, location(), text()); }

SetLit
  = "#[" _ "]"
    { return node('SetLit', { elements: [] }, location(), text()); }
  / "#[" _ elements:ElementList _ "]"
    { return node('SetLit', { elements }, location(), text()); }

// Brackets with commas are JSON syntax for a vector; whitespace-separated
// elements are the vector's own.
VecLit
  = "[" _ head:Element tail:(_ "," _ @Element)+ _ "]"
    { return node('VecLit', { elements: [head, ...tail] }, location(), text()); }
  / "[" _ elements:ElementList _ "]"
    { return node('VecLit', { elements }, location(), text()); }
  / "[" _ "]"
    { return node('VecLit', { elements: [] }, location(), text()); }

ElementList
  = head:Element tail:(LiteralGap @Element)*
    { return [head, ...tail]; }

// The words of a literal are set off by whitespace, a comment among it,
// so a call written by habit, `[mul(2)]`, is refused where it would read
// as two elements.
LiteralGap
  = __
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
  = head:KeywordName tail:("/" @KeywordName)+
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
// optional and required whitespace within a line; a plain comment is
// whitespace, and its line breaks end no line [D81].

_   = Whitespace*
__  = Whitespace+
_h  = InlineSpace*
_h1 = InlineSpace+

Newline = "\r"? "\n"

Whitespace "whitespace" = [ \t\n\r] / PlainComment

InlineSpace "whitespace" = [ \t] / PlainComment

NonSpace = [^ \t\n\r]
