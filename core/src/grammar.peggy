// PEG grammar for the qlang expression language.
//
// A step is a command, a name followed by its modifiers, each one word
// [D10]. A line break is whitespace wherever whitespace stands, so a
// combinator joins two steps and whitespace a declaration as well, and a
// keyword that begins a line opens a declaration of its own, which ends
// the modifiers of a command before it [D243]. Every combinator is set off
// by whitespace on both sides.
//
// Every node carries `.location`, its span, the offsets, lines and
// columns `span()` reads, and `.text`, the source it matched; the pass
// after the parse in src/parse.mjs adds `.id` and `.parent` on every node
// and `.source`, `.uri` and `.comments` on the root.
//
// A plain comment, `|~| …` to the end of its line or `|~ … ~|`, is
// whitespace wherever whitespace stands [D81]; the parser records each on
// the side, `options.commentTrivia`, for the tools. The doc forms,
// `|~~| …` and `|~~ … ~~|`, are the doc literal, which documents the
// declaration whose slot it stands in [D83].

{{
  import { isNameStart, isNameContinue, readsAsBareKeyword } from '../src/name-chars.mjs';
  import { canonicalFlags, patternProblem, patternRefusal, PATTERN_FLAGS } from '../src/pattern.mjs';

  function node(type, fields, loc, txt) {
    return { type, ...fields, location: loc, text: txt };
  }

  // The segments of a doc: its prose, each run of it one string, and the
  // quote nodes among it.
  function proseJoined(parts) {
    const segments = [];
    for (const part of parts) {
      if (typeof part === 'string' && typeof segments[segments.length - 1] === 'string') segments[segments.length - 1] += part;
      else segments.push(part);
    }
    return segments;
  }
}}

{
  const commentTrivia = options.commentTrivia;

  // The offsets where the lines of the input begin, which `span()` reads
  // a node's lines and columns from.
  const lineStarts = [0];
  for (let at = input.indexOf('\n'); at !== -1; at = input.indexOf('\n', at + 1)) lineStarts.push(at + 1);

  function pointOf(offset) {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (lineStarts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return { offset, line: low + 1, column: offset - lineStarts[low] + 1 };
  }

  // What the rule read, in the shape of `location()`.
  function span() {
    const { source, start, end } = range();
    return { source, start: pointOf(start), end: pointOf(end) };
  }

  // The character after what the rule read, where a refusal of the word
  // that follows points.
  function after() {
    const { source, end } = range();
    return { source, start: pointOf(end), end: pointOf(end + 1) };
  }

  // A plain comment the parser read as whitespace, kept by its offset,
  // since a branch the parser abandons reads the same comment again.
  function recordComment(type, content) {
    const loc = span();
    commentTrivia.set(loc.start.offset, { type, content, location: loc, text: text() });
  }

  // A step is a command: a value stands at the head of a pipeline and
  // after a declaration, where it is the subject, and a value written as
  // a later step is refused, a path after `!|` as well, each refusal
  // naming the word the habit meant [D248].
  const VALUE_STEPS = new Set(['Projection', 'VecLit', 'MapLit', 'SetLit', 'ErrorLit', 'TaggedLit', 'TagLit', 'QuoteLit', 'DocLit', 'NumberLit', 'StringLit', 'BooleanLit', 'NullLit', 'Keyword', 'RegexLit']);

  function refuseValueStep(step) {
    if (step.type === 'Projection') error(`a path is a value, which the word that takes it reads: write \`get ${step.text}\``, step.location);
    if (step.type === 'TagLit') error(`a tag goes over the value in the pipe by \`tag\`: write \`tag ${step.text}\``, step.location);
    if (step.type === 'QuoteLit') error('code runs on the value in the pipe by `apply`: write `apply ~(…)`', step.location);
    if (step.type === 'VecLit' || step.type === 'MapLit' || step.type === 'SetLit' || step.type === 'TaggedLit') error('a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`', step.location);
    error('a step is a command: a value stands at the head, where it is the subject, or as what a word takes', step.location);
  }

  function refuseValueSteps(leadingComb, head, tail) {
    if (docQuoteDepth > 0) return;
    if (leadingComb !== null && leadingComb[0] === '!|' && head.type === 'Projection') refuseValueStep(head);
    let afterDeclaration = head.type === 'BindStep';
    for (const { combinator, step } of tail) {
      if (combinator === '!|') {
        if (step.type === 'Projection') refuseValueStep(step);
      } else if (VALUE_STEPS.has(step.type) && !afterDeclaration) {
        refuseValueStep(step);
      }
      afterDeclaration = step.type === 'BindStep';
    }
  }

  function assemblePipeline(leadingComb, head, tail, loc, txt) {
    const hasLeadingComb = leadingComb !== null;
    refuseValueSteps(leadingComb, head, tail);
    if (tail.length === 0 && !hasLeadingComb) return head;
    const fields = { steps: [head, ...tail] };
    if (hasLeadingComb) fields.leadingCombinator = leadingComb[0];
    return node('Pipeline', fields, loc, txt);
  }

  function refuseCombinatorSpacing(combinator) {
    error(`a combinator is set off by whitespace on both sides: write \` ${combinator} \``);
  }

  // A combinator after a combinator is the habit of a pipe before every
  // step, which gives way to the combinator before it, so `!| |` keeps the
  // catch; a combinator stands once between two steps [D46].
  function refuseCombinatorAfterCombinator(first, second) {
    if (second === '|') error(`\`|\` written after \`${first}\` is the habit of a pipe before every step: write \`a ${first} b\``);
    error(`\`${second}\` written after \`${first}\`: a combinator stands once between two steps, write \`a ${second} b\``);
  }

  // How deep the parser is in a `~(…)` of a doc it tries as code: there
  // a shape it refuses elsewhere fails the try, and the span reads as
  // prose [D19].
  let docQuoteDepth = 0;

  // Whether a step can call the name a declaration writes: a bare name,
  // and no word of a literal, which a step reads as its value, alone but
  // for a label, which its tag reaches [D152].
  const LITERAL_WORDS = new Set(['true', 'false', 'null']);

  function nameCalled(name, body) {
    return readsAsBareKeyword(name) && (body === null || !LITERAL_WORDS.has(name));
  }

  function refuseNameNoStepCalls(key, body) {
    if (!readsAsBareKeyword(key.name)) {
      error(`\`${key.text}\` names nothing a step can call: a name begins with a letter or \`_\`, \`:first_name 5\``, key.location);
    }
    if (!nameCalled(key.name, body)) {
      error(`\`${key.text}\` is the word of a literal, which a step reads as the value: declare another name`, key.location);
    }
  }

  // Whether the engine reads a pattern a literal writes with its flags
  // [D246].
  function patternRead(source, written) {
    const flags = canonicalFlags(written);
    return flags !== null && patternProblem(source, flags) === null;
  }

  function refuseUnreadPattern(source, written) {
    const flags = canonicalFlags(written);
    if (flags === null) error(`a pattern takes the flags ${[...PATTERN_FLAGS].map(flag => '`' + flag + '`').join(', ')}, each once after its closing quote, \`#"error"i\``);
    const problem = patternProblem(source, flags);
    if (problem !== null) error(patternRefusal(source, flags, problem));
  }
}

// A source of whitespace alone, comments among it, is the empty
// pipeline, which answers the value it is handed, as the empty quote
// does [D81].
Query
  = _ p:Pipeline _ { return p; }
  / _ { return node('Blank', {}, span(), text()); }

// ── Pipelines ──────────────────────────────────────────────────────

Pipeline
  = leadingComb:(LeadingCombinator __)? head:PipelineHead tail:ContinuationUnit*
    { return assemblePipeline(leadingComb, head, tail, span(), text()); }

// The `!"~"` lookahead keeps the comment markers `|~`, `|~|`, `|~~`,
// `|~~|` from reading as a pipe.
LeadingCombinator
  = "!|" / "|" !"~" { return '|'; }

Combinator
  = "!|" { return '!|'; }
  / "|" !"~" { return '|'; }

PipelineHead
  = DocBeforeDeclaration
  / BindStep
  / TagDeclarationRefusal
  / Step
  / &{ return docQuoteDepth === 0; } &(LeadingCombinator NonSpace) c:LeadingCombinator { refuseCombinatorSpacing(c); }

// A tag name in the place of a declaration's name declares nothing: a
// name is declared by its keyword, and a value under a tag touches its
// payload [D152].
TagDeclarationRefusal
  = &{ return docQuoteDepth === 0; } TagLit _h1 !Combinator (DocOpen / Word)
    { error('a name is declared by its keyword, `:Box |~~ A parcel. ~~|`, and a value under a tag touches its payload, `::Box[…]`'); }

ContinuationUnit
  = _ DocBeforeDeclaration
  / _ DocAfterStep
  / __ step:BindStep { return { combinator: '|', step }; }
  / __ c:Combinator __ step:StepAfterCombinator { return { combinator: c, step }; }
  / __ c:PipedCombinator __ step:StepAfterCombinator { return { combinator: c, step }; }
  / SpacingRefusal

// A pipe written before `!|`, the habit of a pipe before every step,
// stands for it [D130].
PipedCombinator
  = "|" __ "!|" { return '!|'; }

// A combinator written against its neighbour, a pipe written against a
// tilde, which opens a comment, a word written against the word before
// it, and a step that follows a step with no combinator between them;
// a slash written against a word is the dangling segment of a
// projection, which the parser names by the key it expected.
SpacingRefusal
  = &{ return docQuoteDepth === 0; }
    ( _ &"|~" "|~" { error('`|~` opens a comment that is never closed; a pipe before a quote is written `| ~(…)`'); }
    / __ !PipedCombinator &(Combinator __ Combinator) first:Combinator __ second:Combinator { refuseCombinatorAfterCombinator(first, second); }
    / &Combinator c:Combinator { refuseCombinatorSpacing(c); }
    / __ &(Combinator NonSpace) c:Combinator { refuseCombinatorSpacing(c); }
    / &(!"/" Word) Word { error('words are set off by whitespace; only the first modifier of a command may touch its name, `f(a) (b)`'); }
    / _h1 &Word { error('steps are joined by `|`: write `a | b`', after()); }
    / __ &Word { error('steps are joined by `|`, at the end of a line or at the start of the next: a line break is a space', after()); }
    )

StepAfterCombinator
  = DocBeforeDeclaration
  / BindStep
  / TagDeclarationRefusal
  / Step

// A doc documents the declaration whose slot it stands in, between the
// name and the body; written before a declaration it is refused, since
// no step reads a doc it hands to the next [D83].
DocBeforeDeclaration
  = &{ return docQuoteDepth === 0; } &DocOpen DocLit (_ DocLit)* _ &BindStep
    { error('a doc stands in the slot of the declaration it documents: write `:name |~~ … ~~| body`'); }

// A doc written after a step with no combinator is refused: a note in a
// pipeline is a comment, which is whitespace, and a doc as a value stands
// at the head or where a word takes it [D248].
DocAfterStep
  = &{ return docQuoteDepth === 0; } &DocOpen DocOpen
    { error('a doc is a value, which stands at the head or where a word takes it; a note inside a pipeline is a comment, `|~ … ~|`'); }

DocOpen
  = LineDocOpen / BlockDocOpen

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
  / ProjectionBeforeWord
  / Word
  / DocLit

// A path written before a word, the method call of other languages,
// `/ne ""`: a verb is called by its name alone.
ProjectionBeforeWord
  = &{ return docQuoteDepth === 0; } "/" name:KeywordName &(_h1 !Combinator !"!|" Word)
    { error('`/' + name + '` is a path, a value; a verb is called by its name alone, `' + name + ' …`'); }

// A command's modifiers are words; the first may touch the name when
// it opens with a parenthesis, so `filter(gt(1))` reads as `filter` with
// the group `(gt(1))`.
Command
  = callName:CallName first:(FirstModifierSeparator @ModifierWord)? rest:(ModifierGap @ModifierWord)*
    { return node('Call', { ...callName, args: first === null ? [] : [first, ...rest] }, span(), text()); }

FirstModifierSeparator
  = ModifierGap / &"("

// The whitespace before a modifier: on the same line, or on a later one
// that does not open a declaration [D66], [D243].
ModifierGap
  = _h1 !Whitespace
  / __ !BindStep

// A declaration: a keyword, then the doc literals of its slot and an
// optional body, each of which may take a line of its own [D152]; a lone
// `:foo` is a keyword. The name it writes is one a step can call [D152].
BindStep
  = key:BindName docs:(__ @DocSlot)? body:Body?
    & { return docs !== null || body !== null; }
    & { return docQuoteDepth === 0 || nameCalled(key.name, body); }
    { refuseNameNoStepCalls(key, body); return node('BindStep', { key, docs, body }, span(), text()); }

BindName
  = Keyword

DocSlot
  = first:DocLit rest:(_ @DocLit)*
    { return [first, ...rest]; }

// A body is a step read once after the whitespace before it: a keyword is
// a body on the line of its declaration's name or doc, since on a later
// line it opens a declaration of its own, and a tag name, which opens
// none [D152], is the body on a later line too [D66].
Body
  = later:BodyBreak body:Step
    & { return body.type !== 'Keyword' || !later; }
    { return body; }

// Whether the whitespace before a body crosses a line.
BodyBreak
  = _h1 !Whitespace { return false; }
  / __ { return true; }

// ── Words ──────────────────────────────────────────────────────────
//
// A word is a literal, a projection, a name, a quote or a pipeline in
// parentheses. Inside a literal every element is a word, so a command
// with modifiers stands there in parentheses.

Word
  = ParenGroup
  / ErrorLit
  / RegexLit
  / SetLit
  / VecLit
  / MapLit
  / QuoteLit
  / ShortQuoteLit
  / TaggedLit
  / TagLit
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
    { return node('Call', { ...callName, args: [] }, span(), text()); }

// A name with a path, the path of a noun and the name of a verb that
// lives on it, calls the verb by its address, as the keyword and the tag
// name carry a path [D34]: `vec/count` is the `count` of vectors.
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
    { return node('TaggedLit', { tag, payload }, span(), text()); }

TagLit
  = "::" tag:TagName
    { return node('TagLit', { tag }, span(), text()); }

// A tag's name lives apart from the values, so a name after `::` may be
// a reserved word, as after `:` and `/`: `::null` is the kind of null
// [D32].
TagName
  = NamespacedName
  / KeywordName

ParenGroup
  = "(" _ p:Pipeline _ ")"
    { return node('ParenGroup', { pipeline: p }, span(), text()); }
  / &{ return docQuoteDepth === 0; } "(" _ Pipeline _ "," { error('modifiers are separated by spaces, not by commas: `f a b`'); }

// A quote holds the pipeline it is written around, a leading combinator
// included (`~(!| /trail)`); `~()` is the empty quote. A single name,
// projection or tag name may drop the parentheses, `~add`, `~/age`.
QuoteLit
  = "~(" _ pipeline:Pipeline? _ ")"
    &{ return docQuoteDepth === 0 || pipeline?.type !== 'Projection'; }
    {
      if (pipeline?.type === 'Projection') error(`the quote of a path answers the path, which no word wants: give the path bare, \`${pipeline.text}\``);
      return node('QuoteLit', { pipeline }, span(), text());
    }

ShortQuoteLit
  = "~" pipeline:(TagLit / Name)
    { return node('QuoteLit', { pipeline }, span(), text()); }
  / &{ return docQuoteDepth === 0; } "~" path:Projection
    { error(`the quote of a path answers the path, which no word wants: give the path bare, \`${path.text}\``); }

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

// A doc value, in a line form and a block form, read as its segments: a
// `~(…)` that reads as code is a quote, a span between backquotes is
// prose whole, and the rest is prose [D19], [D43]; a line doc's quote
// stays on its line. The printer writes the block form. A parse error
// names its opening `doc` among the continuations, where its markers
// would read as a comment's [D7].
DocLit
  = LineDocOpen segments:LineDocSegments
    { return node('DocLit', { segments, content: text().slice(4) }, span(), text()); }
  / BlockDocOpen segments:BlockDocSegments "~~|"
    { return node('DocLit', { segments, content: text().slice(3, -3) }, span(), text()); }

LineDocOpen "doc"
  = "|~~|"

BlockDocOpen "doc"
  = "|~~" !"|"

LineDocSegments
  = parts:LineDocPart* { return proseJoined(parts); }

// A run of prose free of `~`, a backquote, `:` and, in a block, `|` is
// one part: a quote begins at `~` or at the `::` of its tags, a span
// between backquotes at a backquote, and in a block a nested comment or
// doc at `|`.
LineDocPart
  = [^~`:\n]+ { return text(); }
  / quote:DocQuote &{ return !quote.text.includes('\n'); } { return quote; }
  / "`" [^`\n]* "`" { return text(); }
  / [^\n]

BlockDocSegments
  = parts:BlockDocPart* { return proseJoined(parts); }

BlockDocPart
  = [^~`:|]+ { return text(); }
  / DocQuote
  / "`" (!"`" !"~~|" .)* "`" { return text(); }
  / QuoteSpan
  / NestedLineDocSpan
  / NestedLinePlainSpan
  / NestedBlockDocSpan
  / NestedBlockPlainSpan
  / "~|"
  / !"~~|" c:. { return c; }

// A quote of a doc, under the stack of tags written before it, which
// gives it its role [D108]: the try counts its depth on the way in and
// gives it back on the way out, having read a quote or not; the second
// branch fails always, after its predicate gave the depth back.
DocQuote
  = &{ docQuoteDepth++; return true; } tags:DocQuoteTag* quote:QuoteLit &{ docQuoteDepth--; return true; }
    { return tags.length === 0 ? quote : node('DocTaggedQuote', { tags, quote }, span(), text()); }
  / &{ docQuoteDepth--; return false; } "~("

DocQuoteTag
  = "::" @TagName

// ── Literals ───────────────────────────────────────────────────────

// An error literal, `!{…}`, the literal of an error at rest, and the
// literal of one under a tag, `::Tag!{…}`, the tag written before the
// bang and laid through its label [D13].
ErrorLit
  = tag:ErrorLitTag? "!{" _ "}"
    { return node('ErrorLit', { tag, entries: [] }, span(), text()); }
  / tag:ErrorLitTag? "!{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ "}"
    { return node('ErrorLit', { tag, entries: [head, ...tail] }, span(), text()); }

ErrorLitTag
  = "::" @TagName

// Braces with string keys and commas are JSON syntax for a map, whose
// keys read as the keywords of their strings; a literal mixing the two
// spellings is refused.
MapLit
  = "{" _ head:JsonMapEntry tail:(_ "," _ @JsonMapEntry)* _ "}"
    { return node('MapLit', { entries: [head, ...tail] }, span(), text()); }
  / "{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ "}"
    { return node('MapLit', { entries: [head, ...tail] }, span(), text()); }
  / "{" _ "}"
    { return node('MapLit', { entries: [] }, span(), text()); }
  / &{ return docQuoteDepth === 0; } "{" _ QlangMapEntry (_ QlangMapEntry)* _ !"}" !Keyword Element
    { error('a map entry holds one word; a command with modifiers or a pipeline stands in parentheses there: `{:k (f x)}`'); }

JsonMapEntry
  = key:StringLit _ ":" _ value:Element
    { return node('MapEntry', { key: node('Keyword', { name: key.value }, key.location, key.text), value }, span(), text()); }

QlangMapEntry
  = key:Keyword __ value:Element
    { return node('MapEntry', { key, value }, span(), text()); }

// A pattern of text, read as written: a backslash passes to the engine
// with the character after it, but for `\"`, a quote in the pattern that
// does not end it, and the flags may follow the closing quote,
// `#"error"i` [D246].
RegexLit
  = "#\"" chars:RegexChar* "\"" written:$[a-zA-Z]*
    &{ return docQuoteDepth === 0 || patternRead(chars.join(''), written); }
    {
      const pattern = chars.join('');
      refuseUnreadPattern(pattern, written);
      return node('RegexLit', { pattern, flags: canonicalFlags(written) }, span(), text());
    }

RegexChar
  = "\\\"" { return '"'; }
  / $("\\" .)
  / [^"\\]

SetLit
  = "#[" _ "]"
    { return node('SetLit', { elements: [] }, span(), text()); }
  / "#[" _ elements:ElementList _ "]"
    { return node('SetLit', { elements }, span(), text()); }

// Brackets with commas are JSON syntax for a vector; whitespace-separated
// elements are the vector's own.
VecLit
  = "[" _ head:Element tail:((_ "," _ @Element)+ / (LiteralGap @Element)*) _ "]"
    { return node('VecLit', { elements: [head, ...tail] }, span(), text()); }
  / "[" _ "]"
    { return node('VecLit', { elements: [] }, span(), text()); }

ElementList
  = head:Element tail:(LiteralGap @Element)*
    { return [head, ...tail]; }

// The words of a literal are set off by whitespace, a comment among it,
// so a call written by habit, `[mul(2)]`, is refused where it would read
// as two elements.
LiteralGap
  = __
  / &{ return docQuoteDepth === 0; } &(!"/" Element) Element { error('the words of a literal are set off by whitespace, and a command with modifiers stands there in parentheses, `[(f x)]`'); }

// A path, a value of its own [D248]: a segment is a bare key, a quoted
// key, a namespaced keyword after `:`, or an index; the slash alone names
// no path, the value itself being `it`.
Projection
  = "/" first:KeySegment rest:("/" @KeySegment)*
    { return node('Projection', { keys: [first, ...rest] }, span(), text()); }
  / &{ return docQuoteDepth === 0; } "/" !KeySegment
    { error('the slash alone names no path: the value itself is `it`'); }

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
    { return node('StringLit', { value: chars.join('') }, span(), text()); }

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
    { return node('NumberLit', { value: Number(text()) }, span(), text()); }

BooleanLit
  = "true"  !IdentTail { return node('BooleanLit', { value: true }, span(), text()); }
  / "false" !IdentTail { return node('BooleanLit', { value: false }, span(), text()); }

NullLit
  = "null" !IdentTail { return node('NullLit', {}, span(), text()); }

// `:name` and `:"any text"` read as the same keyword.
Keyword
  = ":" name:QuotedKeywordName  { return node('Keyword', { name }, span(), text()); }
  / ":" name:NamespacedName     { return node('Keyword', { name }, span(), text()); }
  / ":" name:KeywordName        { return node('Keyword', { name }, span(), text()); }

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

// The letters of a name, `core/src/name-chars.mjs`.
IdentStart "identifier start (letter or underscore)"
  = c:. &{ return isNameStart(c); } { return c; }
IdentTail  "identifier continue (letter, digit, hyphen, underscore)"
  = c:. &{ return isNameContinue(c); } { return c; }

// ── Whitespace ─────────────────────────────────────────────────────
//
// `_` is optional whitespace, `__` required whitespace, and `_h1`
// whitespace within a line, which tells a body or a modifier on the line
// of its name from a declaration that opens a later line [D66]; a plain
// comment is whitespace [D81].

_   = Whitespace*
__  = Whitespace+
_h1 = InlineSpace+

Whitespace "whitespace" = [ \t\n\r] / PlainComment

InlineSpace "whitespace" = [ \t] / PlainComment

NonSpace = [^ \t\n\r]
