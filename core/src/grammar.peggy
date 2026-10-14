// PEG grammar for the qlang expression language.
//
// A step is a command, a name followed by its modifiers, each one word
// [QSSYN#step]. A line break is whitespace, and around a declaration it tells
// where the declaration ends: a keyword that begins a line opens a
// declaration of its own, which ends the modifiers of a command before
// it [QSSYN#line], and the body of a name with a path begun on a later
// line runs on to the next declaration [QSBLD#fn]. Every combinator is set
// off by whitespace on both sides.
//
// Every node carries `.location`, its span, the offsets, lines and
// columns `span()` reads, and `.text`, the source it matched; the pass
// after the parse in src/parse.mjs adds `.id` and `.parent` on every node
// and `.source`, `.uri` and `.comments` on the root.
//
// A plain comment, `|~| …` to the end of its line or `|~ … ~|`, is
// whitespace wherever whitespace stands [QSSYN#comment]; the parser
// records each on the side, `options.commentTrivia`, for the tools. The
// doc forms, `|~~| …` and `|~~ … ~~|`, are the doc literal, which
// documents the declaration whose slot it stands in [QSSYN#doc].

{{
  import { isNameStart, isNameContinue, readsAsBareKeyword, LITERAL_WORDS } from '../src/name-chars.mjs';
  import { canonicalFlags, patternProblem, patternRefusal, PATTERN_FLAGS } from '../src/pattern.mjs';
  import { builtFrom } from '../src/walk.mjs';

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
  // naming the word the habit meant [QSPTH#value].
  const VALUE_STEPS = new Set(['Path', 'VecLit', 'MapLit', 'SetLit', 'ErrorLit', 'TaggedLit', 'TagLit', 'QuoteLit', 'DocLit', 'NumberLit', 'StringLit', 'BooleanLit', 'NullLit', 'Keyword', 'RegexLit']);

  function refuseValueStep(step) {
    if (step.type === 'Path') error(`a path is a value, which the word that takes it reads: write \`get ${step.text}\``, step.location);
    if (step.type === 'TagLit') error(`a tag goes over the value in the pipe by \`tag\`: write \`tag ${step.text}\``, step.location);
    if (step.type === 'QuoteLit') error('code runs on the value in the pipe by `apply`: write `apply ~(…)`', step.location);
    if (step.type === 'VecLit' || step.type === 'MapLit' || step.type === 'SetLit' || step.type === 'TaggedLit') error('a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`', step.location);
    error('a step is a command: a value stands at the head, where it is the subject, or as what a word takes', step.location);
  }

  function refuseValueSteps(leadingComb, head, tail) {
    if (docQuoteDepth > 0) return;
    if (leadingComb !== null && leadingComb[0] === '!|' && head.type === 'Path') refuseValueStep(head);
    let afterDeclaration = head.type === 'BindStep';
    for (const { combinator, step } of tail) {
      if (combinator === '!|') {
        if (step.type === 'Path') refuseValueStep(step);
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
  // catch; a combinator stands once between two steps [QSERR#site].
  function refuseCombinatorAfterCombinator(first, second) {
    if (second === '|') error(`\`|\` written after \`${first}\` is the habit of a pipe before every step: write \`a ${first} b\``);
    error(`\`${second}\` written after \`${first}\`: a combinator stands once between two steps, write \`a ${second} b\``);
  }

  // How deep the parser is in a `~(…)` of a doc it tries as code: there
  // a shape it refuses elsewhere fails the try, and the span reads as
  // prose [QSSLF#doc].
  let docQuoteDepth = 0;

  // How deep the parser is in a look ahead for a declaration that opens on
  // a later line, which ends the modifiers of a command before it [QSSYN#line].
  let lookingAhead = 0;

  // Whether a step can call the name a declaration writes: a bare name,
  // and no word of a literal, which a step reads as its value, alone but
  // for a label, which its tag reaches, declared by its page [QSNAM#address] or by
  // the chain that builds a kind from `::kind` [QSBLD#kind].
  function nameCalled(name, body) {
    return readsAsBareKeyword(name) && (body === null || builtFrom(body) === 'kind' || !LITERAL_WORDS.has(name));
  }

  // A literal holds literals: a group or a name written inside one would
  // compute, which a literal does not, and is refused naming the template
  // of paths and quotes `get` computes a shape from, while the code of a
  // doc that writes one reads as prose [QSLIT#tag].
  const COMPUTED_PARTS = new Set(['ParenGroup', 'Call']);

  const readsAsLiteral = parts => docQuoteDepth === 0 || !parts.some(part => COMPUTED_PARTS.has(part.type));

  function refuseComputedParts(parts) {
    const computed = parts.filter(part => COMPUTED_PARTS.has(part.type));
    if (computed.length === 0) return;
    const start = range().start;
    let written = text();
    for (const part of computed.reverse()) {
      const inner = part.type === 'ParenGroup' ? part.pipeline.text : part.text;
      written = written.slice(0, part.location.start.offset - start) + `~(${inner})` + written.slice(part.location.end.offset - start);
    }
    error(`a literal computes nothing: a shape computed is built by \`get\`, its parts paths and quotes, write \`get ${written}\``);
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
  // [QSTXT#pattern].
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
// does [QSSYN#comment].
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
// payload [QSNAM#address].
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
// stands for it [QSERR#catch].
PipedCombinator
  = "|" __ "!|" { return '!|'; }

// A combinator written against its neighbour, a pipe written against a
// tilde, which opens a comment, a word written against the word before
// it, and a step that follows a step with no combinator between them;
// a slash written against a word is the dangling segment of a path,
// which the parser names by the key it expected.
SpacingRefusal
  = &{ return docQuoteDepth === 0; }
    ( _ &"|~" "|~" { error('`|~` opens a comment that is never closed; code runs on the value in the pipe by a word, `| apply ~(…)`'); }
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
// no step reads a doc it hands to the next [QSSYN#doc].
DocBeforeDeclaration
  = &{ return docQuoteDepth === 0; } &DocOpen DocLit (_ DocLit)* _ &BindStep
    { error('a doc stands in the slot of the declaration it documents: write `:name |~~ … ~~| body`'); }

// A doc written after a step with no combinator is refused: a note in a
// pipeline is a comment, which is whitespace, and a doc as a value stands
// at the head or where a word takes it [QSPTH#value].
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
  / PathBeforeWord
  / Word
  / DocLit

// A path written before a word, the method call of other languages,
// `/ne ""`: a verb is called by its name alone.
PathBeforeWord
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
// that does not open a declaration [QSSYN#line].
ModifierGap
  = _h1 !Whitespace
  / __ !DeclarationOpens

// Whether a declaration opens here [QSSYN#line]: a keyword with its doc or with
// the step its body opens with, read no further than that opening; inside
// a quote of a doc a declaration is read whole, within which a keyword
// alone opens one, and the depth `lookingAhead` counts is given back
// whether the declaration is read or not.
DeclarationOpens
  = &{ return docQuoteDepth === 0; } BindName (__ DocOpen / _h1 !Whitespace StepOpens / __ !Keyword StepOpens)
  / &{ return lookingAhead > 0; } BindName
  / &{ return docQuoteDepth > 0; } &{ lookingAhead++; return true; } BindStep &{ lookingAhead--; return true; }
  / &{ return docQuoteDepth > 0; } &{ lookingAhead--; return false; } "~("

// A step opens here: no combinator, no closing bracket and no end.
StepOpens
  = !Combinator ![)\]},] .

// A declaration: a keyword, then the doc literals of its slot and an
// optional body, each of which may take a line of its own [QSNAM#address]; a lone
// `:foo` is a keyword. The name it writes is one a step can call [QSNAM#address].
BindStep
  = key:BindName & { return key.name.includes('/'); } docs:(__ @DocSlot)? body:DefinitionBody?
    & { return docs !== null || body !== null; }
    & { return docQuoteDepth === 0 || nameCalled(key.name, body); }
    { refuseNameNoStepCalls(key, body); return node('BindStep', { key, docs, body }, span(), text()); }
  / key:BindName docs:(__ @DocSlot) body:ChainBody
    & { return docQuoteDepth === 0 || nameCalled(key.name, body); }
    { refuseNameNoStepCalls(key, body); return node('BindStep', { key, docs, body }, span(), text()); }
  / key:BindName docs:(__ @DocSlot)? body:Body?
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
// none [QSNAM#address], is the body on a later line too [QSSYN#line].
Body
  = later:BodyBreak body:Step
    & { return body.type !== 'Keyword' || !later; }
    { return body; }

// Whether the whitespace before a body crosses a line.
BodyBreak
  = _h1 !Whitespace { return false; }
  / __ { return true; }

// The body of a definition, a name with a path, begun on a later line is a
// sentence, its steps joined by a combinator up to the next declaration or
// a value that heads the sentence after it; on the line of its name it is
// one step, as a body is [QSBLD#fn]. The body of a bare name with its page,
// begun on a later line with a tag name, is the sentence that builds from
// the noun it names, `:Box |~~ … ~~| ::kind | wraps …` [QSBLD#kind]; any other
// body of a bare name is one step.
ChainBody
  = !(_h1 !Whitespace) __ !TaggedLit head:TagLit tail:BodySentenceStep*
    { return assemblePipeline(null, head, tail, span(), text()); }

DefinitionBody
  = _h1 !Whitespace body:Step { return body; }
  / __ head:Step & { return head.type !== 'Keyword'; } tail:BodySentenceStep*
    { return assemblePipeline(null, head, tail, span(), text()); }

// A later step of a body begun on a later line: a command, or after `!|`
// the recovery, a value among them.
BodySentenceStep
  = __ c:Combinator __ !BindStep step:Step & { return c === '!|' || !VALUE_STEPS.has(step.type); }
    { return { combinator: c, step }; }
  / __ c:PipedCombinator __ !BindStep step:Step
    { return { combinator: c, step }; }

// ── Words ──────────────────────────────────────────────────────────
//
// A word is a literal, a path, a name, a quote or a pipeline in
// parentheses; every part of a literal is a literal [QSLIT#tag].

Word
  = ParenGroup
  / ErrorLit
  / SetLit
  / VecLit
  / MapLit
  / QuoteLit
  / ShortQuoteLit
  / TaggedLit
  / TagLit
  / Path
  / Name
  / AtomLit

// The element of a literal and the object of a command, which a doc value
// may be too [QSBLD#fn].
Element
  = Word
  / DocLit

ModifierWord
  = Word
  / DocLit

Name
  = callName:CallName
    { return node('Call', { ...callName, args: [] }, span(), text()); }

// A name with a path, the path of a noun and the name of a verb that
// lives on it, calls the verb by its address, as the keyword and the tag
// name carry a path [QSDSP#walk]: `vec/count` is the `count` of vectors.
CallName
  = head:Ident tail:("/" @KeywordName)+
    {
      const verb = tail[tail.length - 1];
      const noun = [head, ...tail.slice(0, -1)].join('/');
      return { name: `${noun}/${verb}`, address: { noun, verb } };
    }
  / name:Ident { return { name }; }

// `::tag<payload>` puts a payload under a tag through its constructor, the
// payload touching the tag by a sign that continues the literal, a number,
// a boolean, null or a path, whose literal would continue the tag's name,
// by `#`, `::Width#5`; parentheses after a tag,
// the sign of code, are refused [QSLIT#tag]. `::tag` alone is the tag name.
TaggedLit
  = "::" tag:TagName "#" payload:PayloadAfterHash
    { return node('TaggedLit', { tag, payload }, span(), text()); }
  / &{ return docQuoteDepth === 0; } "::" tag:TagName "(" _ payload:PayloadAfterHash _ ")"
    { error(`a number, a boolean, null or a path touches its tag by \`#\`: write \`::${tag}#${payload.text}\``); }
  / &{ return docQuoteDepth === 0; } "::" tag:TagName "(" _ payload:TaggedPayload _ ")"
    { error(`a literal touches its tag by its own sign: write \`::${tag}${payload.text}\``); }
  / &{ return docQuoteDepth === 0; } "::" tag:TagName group:ParenGroup
    { error(`the parentheses after a tag hold code, which a literal does not run: a value computed goes under a tag by \`tag\`, write \`${group.pipeline.text} | tag ::${tag}\``); }
  / "::" tag:TagName payload:TaggedPayload
    { return node('TaggedLit', { tag, payload }, span(), text()); }

PayloadAfterHash
  = NumberLit
  / BooleanLit
  / NullLit
  / Path

TaggedPayload
  = ErrorLit
  / RegexLit
  / SetLit
  / VecLit
  / MapLit
  / QuoteLit
  / ShortQuoteLit
  / TaggedLit
  / TagLit
  / StringLit
  / Keyword
  / DocLit

TagLit
  = "::" tag:TagName
    { return node('TagLit', { tag }, span(), text()); }

// A tag's name lives apart from the values, so a name after `::` may be
// a reserved word, as after `:` and `/`: `::null` is the kind of null
// [QSLIT#kind].
TagName
  = NamespacedName
  / KeywordName

ParenGroup
  = "(" _ p:Pipeline _ ")"
    { return node('ParenGroup', { pipeline: p }, span(), text()); }
  / &{ return docQuoteDepth === 0; } "(" _ Pipeline _ "," { error('modifiers are separated by spaces, not by commas: `f a b`'); }

// A quote holds the pipeline it is written around, a leading combinator
// included (`~(!| get /trail)`); `~()` is the empty quote. A single name
// or tag name may drop the parentheses, `~add`, `~::T`.
QuoteLit
  = "~(" _ pipeline:Pipeline? _ ")"
    &{ return docQuoteDepth === 0 || pipeline?.type !== 'Path'; }
    {
      if (pipeline?.type === 'Path') error(`the quote of a path answers the path, which no word wants: give the path bare, \`${pipeline.text}\``);
      return node('QuoteLit', { pipeline }, span(), text());
    }

ShortQuoteLit
  = "~" pipeline:(TagLit / Name)
    { return node('QuoteLit', { pipeline }, span(), text()); }
  / &{ return docQuoteDepth === 0; } "~" path:Path
    { error(`the quote of a path answers the path, which no word wants: give the path bare, \`${path.text}\``); }
  / &{ return docQuoteDepth === 0; } "~" &[{[]
    { error('a quote is written `~(…)`, its code in parentheses; `{…}` is a map and `[…]` a vector'); }

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
// prose whole, and the rest is prose [QSQUO#literal], [QSSLF#doc]; a line doc's quote
// stays on its line. The printer writes the block form. A parse error
// names its opening `doc` among the continuations, where its markers
// would read as a comment's [QSHST#answer].
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
// gives it its role [QSSLF#doc], the depth `docQuoteDepth` counts given back
// whether a quote is read or not.
DocQuote
  = &{ docQuoteDepth++; return true; } tags:DocQuoteTag* quote:QuoteLit &{ docQuoteDepth--; return true; }
    { return tags.length === 0 ? quote : node('DocTaggedQuote', { tags, quote }, span(), text()); }
  / &{ docQuoteDepth--; return false; } "~("

DocQuoteTag
  = "::" @TagName

// ── Literals ───────────────────────────────────────────────────────

// An error literal, `!{…}`, the literal of an error at rest, and the
// literal of one under a tag, `::Tag!{…}`, the tag written before the
// bang and laid through its label [QSERR#rest].
ErrorLit
  = tag:ErrorLitTag? "!{" _ "}"
    { return node('ErrorLit', { tag, entries: [] }, span(), text()); }
  / tag:ErrorLitTag? "!{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ "}"
    &{ return readsAsLiteral([head, ...tail].map(entry => entry.value)); }
    { refuseComputedParts([head, ...tail].map(entry => entry.value)); return node('ErrorLit', { tag, entries: [head, ...tail] }, span(), text()); }

ErrorLitTag
  = "::" @TagName

// Braces with string keys and commas are JSON syntax for a map, whose
// keys read as the keywords of their strings; a literal mixing the two
// spellings is refused.
MapLit
  = "{" _ head:JsonMapEntry tail:(_ "," _ @JsonMapEntry)* _ "}"
    &{ return readsAsLiteral([head, ...tail].map(entry => entry.value)); }
    { refuseComputedParts([head, ...tail].map(entry => entry.value)); return node('MapLit', { entries: [head, ...tail] }, span(), text()); }
  / "{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ "}"
    &{ return readsAsLiteral([head, ...tail].map(entry => entry.value)); }
    { refuseComputedParts([head, ...tail].map(entry => entry.value)); return node('MapLit', { entries: [head, ...tail] }, span(), text()); }
  / "{" _ "}"
    { return node('MapLit', { entries: [] }, span(), text()); }
  / &{ return docQuoteDepth === 0; } "{" _ QlangMapEntry (_ QlangMapEntry)* _ !"}" !Keyword Element
    { error('a map entry holds one literal, `{:k 1}`, and a shape computed is built by `get`: `get {:k ~(f x)}`'); }

JsonMapEntry
  = key:StringLit _ ":" _ value:Element
    { return node('MapEntry', { key: node('Keyword', { name: key.value }, key.location, key.text), value }, span(), text()); }

QlangMapEntry
  = key:Keyword __ value:Element
    { return node('MapEntry', { key, value }, span(), text()); }

// A pattern of text, read as written: a backslash passes to the engine
// with the character after it, but for `\"`, a quote in the pattern that
// does not end it, and the flags may follow the closing quote,
// `#"error"i` [QSTXT#pattern].
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
    &{ return readsAsLiteral(elements); }
    { refuseComputedParts(elements); return node('SetLit', { elements }, span(), text()); }

// Brackets with commas are JSON syntax for a vector; whitespace-separated
// elements are the vector's own.
VecLit
  = "[" _ head:Element tail:((_ "," _ @Element)+ / (LiteralGap @Element)*) _ "]"
    &{ return readsAsLiteral([head, ...tail]); }
    { refuseComputedParts([head, ...tail]); return node('VecLit', { elements: [head, ...tail] }, span(), text()); }
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
  / &{ return docQuoteDepth === 0; } &(!"/" Element) Element { error('the words of a literal are set off by whitespace: `[1 2]`'); }

// A path, a value of its own [QSPTH#value]: a segment is a bare key, a quoted
// key, a namespaced keyword after `:`, or an index; the slash alone names
// no path, the value itself being `it`, and a question mark after a
// segment, the habit of a read that may miss, leads to `query`.
Path
  = &{ return docQuoteDepth === 0; } written:$("/" KeySegment ("?"? "/" KeySegment)* "?"?) &{ return written.includes('?'); }
    { error(`a part that may be missing is read by \`query\`, which answers null where it misses: write \`query ${written.replaceAll('?', '')}\``); }
  / "/" first:KeySegment rest:("/" @KeySegment)*
    { return node('Path', { keys: [first, ...rest] }, span(), text()); }
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

AtomLit
  = StringLit
  / NumberLit
  / BooleanLit
  / NullLit
  / Keyword
  / RegexLit

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
    { if (whole.length > 1 && whole[0] === '0') error(`a number is written without a leading zero: write \`${text().replace(/^(-?)0+(?=\d)/, '$1')}\``);
      return node('NumberLit', { value: Number(text()) }, span(), text()); }

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
// of its name from a declaration that opens a later line [QSSYN#line]; a plain
// comment is whitespace [QSSYN#comment].

_   = Whitespace*
__  = Whitespace+
_h1 = InlineSpace+

Whitespace "whitespace" = [ \t\n\r] / PlainComment

InlineSpace "whitespace" = [ \t] / PlainComment

NonSpace = [^ \t\n\r]
