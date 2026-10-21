// PEG grammar for the qlang pipeline query language.
//
// A step is a command, a name followed by its modifiers, each one word
// [QSSYN#step]. A line break is whitespace, and around a declaration it tells
// where the declaration ends: a keyword that begins a line opens a
// declaration of its own, which ends the modifiers of a command before
// it [QSSYN#line], and the body of a name with a path begun on a later
// line runs on to the next declaration [QSSYN#line]. Every combinator is set
// off by whitespace on both sides.
//
// Every rule answers a part, the record of a step its constructor builds or
// a literal, its span, which names the source the caller gives, and the parts
// it holds; a rule a constructor holds is refused at the part its refusal
// names, but in a `~(…)` of a doc tried as code, whose try a rule of a step
// and a refusal the grammar does not pass over there fail, a refusal it
// passes over letting the quote read as code [QSQUO#step], [QSSYN#doc].
//
// A comment, `|~| …` to the end of its line or `|~ … ~|`, is
// whitespace wherever whitespace stands [QSSYN#comment]; the parser
// records each on the side, `options.commentTrivia`, for the tools. The
// doc forms, `|~~| …` and `|~~ … ~~|`, are the doc literal, which
// documents the declaration whose slot it stands in [QSSYN#doc].

{{
  import { isNameStart, isNameContinue } from '../src/name-chars.mjs';
  import { canonicalFlags, regexProblem, regexRefusal, REGEX_FLAGS } from '../src/regex-read.mjs';
  import { keyword, isKeyword, isPath, makeRegex, makePath, makeDoc, makeTag, makeTagged, errorAtRest, ERROR_TAG } from '../src/types.mjs';
  import { makeSet } from '../src/ordering.mjs';
  import { QlangError } from '../src/errors.mjs';
  import { quoteOf, callOf, bindOf, constructOf, failOf, groupOf, standsAsCommand, computes, partsOfALiteral, isOfTheKindOfErrors, isGroupStep } from '../src/steps.mjs';
  import { walkParts } from '../src/walk.mjs';

  // A span between backquotes in the prose of a doc: its text and the span of
  // the code its runs of backquotes hold [QSHST#tools].
  class Backquoted {
    constructor(text, code) {
      this.text = text;
      this.code = code;
    }
  }

  // The segments of a doc, its prose, each run of it one string, and the parts
  // of the quotes among it, with the spans of the code its spans between
  // backquotes hold [QSHST#tools].
  function proseJoined(parts) {
    const segments = [];
    const backquoted = [];
    for (const part of parts) {
      if (part instanceof Backquoted) backquoted.push(part.code);
      const segment = part instanceof Backquoted ? part.text : part;
      if (typeof segment === 'string' && typeof segments[segments.length - 1] === 'string') segments[segments.length - 1] += segment;
      else segments.push(segment);
    }
    return { segments, backquoted };
  }

  // A rule a constructor holds, refused at the part it names.
  class Refused {
    constructor(message, at) {
      this.message = message;
      this.at = at;
    }
  }
}}

{
  const commentTrivia = options.commentTrivia;

  // The offsets where the lines of the input begin, which `span()` reads
  // a part's lines and columns from.
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

  // What the rule read, in the form of `location()`.
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

  // The last characters of what the rule read, where a refusal of the
  // sign written last points.
  function lastOf(length) {
    const { source, end } = range();
    return { source, start: pointOf(end - length), end: pointOf(end) };
  }
  // A comment the parser read as whitespace, kept by its offset,
  // since a branch the parser abandons reads the same comment again.
  function recordComment(type, content) {
    const loc = span();
    commentTrivia.set(loc.start.offset, { type, content, location: loc, text: text() });
  }

  // The part of a value read, the last read of each value kept, which a
  // refusal of a rule writes as the text wrote it.
  const reads = new WeakMap();

  function part(value, parts = [], at = span()) {
    const read = { value, span: at, parts };
    if (typeof value === 'object' && value !== null) reads.set(value, read);
    return read;
  }

  const sourceOf = read => input.slice(read.span.start.offset, read.span.end.offset);

  // How a rule reads and writes the parts it names: as the text wrote them,
  // a value a later entry of its key gives way to among them and a value no
  // read is kept of, a number, a string, a boolean or null, holding none, and
  // a literal with each part of it that computes written as its quote
  // [QSLIT#closed].
  const asWritten = {
    of: value => sourceOf(reads.get(value)),
    quoting: literal => quotedSource(reads.get(literal)),
    computesWithin: literal => reads.has(literal) && computingReadsOf(reads.get(literal)).length > 0
  };

  function quotedSource(read) {
    const start = read.span.start.offset;
    let written = sourceOf(read);
    for (const computing of computingReadsOf(read).reverse()) {
      const inner = isGroupStep(computing.value) ? input.slice(computing.content.start.offset, computing.content.end.offset) : sourceOf(computing);
      written = written.slice(0, computing.span.start.offset - start) + `~(${inner})` + written.slice(computing.span.end.offset - start);
    }
    return written;
  }

  // The parts of a literal that compute, searched where `partsOfALiteral`
  // searches the values [QSLIT#closed], [QSQUO#step].
  function computingReadsOf(read) {
    const computing = [];
    walkParts(read, held => {
      if (!computes(held.value)) return partsOfALiteral(held.value).length > 0;
      computing.push(held);
      return false;
    });
    return computing;
  }

  // The records a rule builds, kept for its action where they keep the rules
  // of a step; a broken rule is refused at the part it names, but in the
  // quote of a doc, where it fails the try of its rule, and a throw of a
  // constructor that is no refusal passes as it is [QSQUO#step].
  let built = null;

  function accepted(build) {
    try {
      built = build();
      return true;
    } catch (thrown) {
      if (!(thrown instanceof Refused)) throw thrown;
      if (docQuoteDepth > 0) return false;
      error(thrown.message, thrown.at);
    }
  }

  function through(construct, refusedRead) {
    try {
      return construct();
    } catch (refusal) {
      if (!(refusal instanceof QlangError)) throw refusal;
      throw new Refused(refusal.facts.message, refusedRead(refusal.facts).span);
    }
  }

  // The part of what a rule built, its span the rule's, and the span of a
  // pipeline in parentheses, its content.
  function taken(content) {
    if (built.read !== undefined) return built.read;
    const read = part(built.value, built.parts);
    if (content !== undefined) read.content = content;
    return read;
  }

  // The quote of a pipeline, each step after `!|` the step of the fail track
  // that holds it, answering the first rule of its steps in the order written
  // but the rules a step holds itself, a modifier's and a group's among them,
  // answered when it is read [QSQUO#step].
  function pipelineOf(leadingCombinator, head, tail) {
    const parts = [];
    for (const { combinator, step } of [{ combinator: leadingCombinator, step: head }, ...tail]) {
      try {
        parts.push(combinator === '!|' ? failRead(step) : step);
      } catch (refusal) {
        quoteRead(parts);
        throw refusal;
      }
    }
    return { value: quoteRead(parts), parts };
  }

  const quoteRead = parts => through(() => quoteOf(parts.map(read => read.value), asWritten), facts => parts[facts.index]);

  function failRead(step) {
    const fail = through(() => failOf(quoteOf([step.value], asWritten), asWritten), () => step);
    return part(fail, [step], step.span);
  }

  // A word read as a step answers the rules it holds itself when it is read,
  // as a modifier and a group do [QSQUO#step].
  function wordStepRead(word) {
    through(() => quoteOf([word.value], asWritten), () => word);
    return { read: word };
  }

  // A body begun on a later line: one step, or a sentence of them in the
  // group of its steps [QSSYN#line].
  function sentenceOf(head, tail) {
    if (tail.length === 0) return { read: head };
    const { value, parts } = pipelineOf('|', head, tail);
    return { value: groupOf(value), parts };
  }

  function callFieldsOf(name, modifiers) {
    const fields = new Map([['name', keyword(name)]]);
    if (modifiers.length > 0) fields.set('modifiers', Object.freeze(modifiers.map(modifier => modifier.value)));
    return fields;
  }

  function bindOfReads(key, docs, body) {
    const fields = new Map([['name', key.value]]);
    if (docs !== null) fields.set('docs', Object.freeze(docs.map(doc => doc.value)));
    if (body !== null) fields.set('body', body.value);
    const value = through(() => bindOf(fields, asWritten), () => key);
    return { value, parts: [key, ...(docs ?? []), ...(body === null ? [] : [body])] };
  }

  function entriesRead(make, entries, heads = [], at = span()) {
    return part(make(new Map(entries.map(({ key, value }) => [key.value.name, value.value]))), [...heads, ...entries.flatMap(({ key, value }) => [key, value])], at);
  }

  // A tagged literal, the construction of its tag over its payload, its head
  // the tag, but `::error` before an error literal, which is that literal
  // [QSQUO#step], [QSERR#rest], [QSHST#tools].
  function taggedRead(head, payload, at = span()) {
    if (head.value.name === ERROR_TAG.name && isOfTheKindOfErrors(payload.value)) return Object.assign(part(payload.value, [head, ...payload.parts], at), { head: { ...head.span, end: (payload.head ?? head.span).end } });
    return Object.assign(part(constructOf(new Map([['tag', head.value], ['payload', payload.value]])), [payload], at), { head: head.span });
  }

  // An error literal, a tag before its bang the tagged literal of it,
  // `::Late!{…}` the literal `::Late::error!{…}` [QSERR#rest].
  function errorRead(tag, entries) {
    if (tag === null) return entriesRead(facts => errorAtRest(ERROR_TAG, facts), entries);
    return taggedRead(tag, entriesRead(facts => errorAtRest(ERROR_TAG, facts), entries, [], { ...span(), start: tag.span.end }));
  }

  // The segments of a doc, the span of its text to its last word and the spans
  // of the code between its backquotes [QSHST#tools].
  function textRead(parts) {
    const { source, start } = range();
    return { ...proseJoined(parts), text: { source, start: pointOf(start), end: pointOf(start + text().trimEnd().length) } };
  }

  // A span between backquotes, its runs of backquotes as many on each side
  // [QSHST#tools].
  function backquotedRead(run) {
    const { source, start, end } = range();
    return new Backquoted(text(), { source, start: pointOf(start + run), end: pointOf(end - run) });
  }

  const docRead = ({ segments, text, backquoted }) => Object.assign(part(makeDoc(segments.map(segment => (typeof segment === 'string' ? segment : segment.value))), segments.filter(segment => typeof segment !== 'string')), { text, backquoted });

  // A map writes its keys one way, as keywords or as the strings of JSON
  // [QSLIT#json].
  function refuseMixedSpellings() {
    error('a map writes its keys one way, as keywords, `{:a 1 :b 2}`, or as the strings of JSON, `{"a": 1, "b": 2}`');
  }

  function refuseCombinatorSpacing(combinator) {
    error(`a combinator is set off by whitespace on both sides: write \` ${combinator} \``);
  }

  // A combinator after a combinator is the habit of a pipe before every
  // step, which gives way to the combinator before it, so `!| |` keeps the
  // catch; a combinator stands once between two steps [QSSYN#combinator].
  function refuseCombinatorAfterCombinator(first, second) {
    if (second === '|') error(`\`|\` written after \`${first}\` is the habit of a pipe before every step: write \`a ${first} b\``);
    error(`\`${second}\` written after \`${first}\`: a combinator stands once between two steps, write \`a ${second} b\``);
  }

  // How deep the parser is in a `~(…)` of a doc it tries as code, whose try a
  // rule of a step and a refusal the grammar does not pass over there fail, a
  // refusal it passes over letting the quote read as code [QSSYN#doc].
  let docQuoteDepth = 0;

  // How deep the parser is in a look ahead for a declaration that opens on
  // a later line, which ends the modifiers of a command before it [QSSYN#line].
  let lookingAhead = 0;

  // Whether the parser reads the span of a `~(` of a line doc, which reads no
  // line break [QSSYN#doc].
  let spanOfALine = false;

  // The path a quote holds alone, a leading pipe before it among it, or null.
  function pathAlone(pipeline) {
    return pipeline !== null && pipeline.value.length === 1 && isPath(pipeline.value[0]) ? pipeline.parts[0] : null;
  }

  // Whether the engine reads a regex a literal writes with its flags [QSTXT#regex].
  function regexRead(source, written) {
    const flags = canonicalFlags(written);
    return flags !== null && regexProblem(source, flags) === null;
  }

  function refuseUnreadRegex(source, written) {
    const flags = canonicalFlags(written);
    if (flags === null) error(`a regex takes the flags ${[...REGEX_FLAGS].map(flag => '`' + flag + '`').join(', ')}, each once after its closing quote, \`#"error"i\``);
    const problem = regexProblem(source, flags);
    if (problem !== null) error(regexRefusal(source, flags, problem));
  }

  // Whether the whole part of a number leads with a zero [QSLIT#number].
  const leadsWithAZero = whole => whole.length > 1 && whole[0] === '0';
}

// A source of whitespace alone, comments among it, is the empty
// pipeline, which answers the value it is handed, as the empty quote
// does [QSSYN#comment].
Query
  = _ p:Pipeline _ { return p; }
  / _ { return part(quoteOf([], asWritten)); }

// ── Pipelines ──────────────────────────────────────────────────────

Pipeline
  = leadingComb:(LeadingCombinator __)? head:PipelineHead tail:ContinuationUnit*
    &{ return accepted(() => pipelineOf(leadingComb === null ? '|' : leadingComb[0], head, tail)); }
    { return taken(); }
  / &{ return docQuoteDepth === 0; } &(LeadingCombinator __ Combinator) first:LeadingCombinator __ second:Combinator
    { refuseCombinatorAfterCombinator(first, second); }

// The `!"~"` lookahead keeps the comment markers `|~`, `|~|`, `|~~`,
// `|~~|` from reading as a pipe; a pipe written before `!|` stands for it
// at the head as between two steps [QSSYN#combinator].
LeadingCombinator
  = "!|" / "|" &(__ "!|") __ "!|" { return '!|'; } / "|" !"~" { return '|'; }

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
  = &{ return docQuoteDepth === 0; } &(TagLit _h1 !Combinator (DocOpen / Word)) TagLit _h1 !Combinator (DocOpen / Word)
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
// tilde, which opens a comment, a combinator with no step after it before a
// closing bracket, the end of the source named where the parse reads it, a
// combinator after `| !|`, a semicolon after a step [QSSYN#combinator], a
// word written against the word before it, and a step that follows a step
// with no combinator between them; a slash written against a word is the
// dangling segment of a path, which the parser names by the key it expected.
SpacingRefusal
  = &{ return docQuoteDepth === 0; }
    ( _ &"|~" "|~" { error('`|~` opens a comment that is never closed; code runs on the value in the pipe by a verb, `| apply ~(…)`'); }
    / _ &(Combinator _ [)\]}]) c:Combinator { error(`\`${c}\` joins two steps, and the step after it is missing`, lastOf(c.length)); }
    / __ &(PipedCombinator __ Combinator) PipedCombinator __ second:Combinator { refuseCombinatorAfterCombinator('!|', second); }
    / __ !PipedCombinator &(Combinator __ Combinator) first:Combinator __ second:Combinator { refuseCombinatorAfterCombinator(first, second); }
    / &Combinator c:Combinator { refuseCombinatorSpacing(c); }
    / __ &(Combinator NonSpace) c:Combinator { refuseCombinatorSpacing(c); }
    / &(!"/" Word) Word { error('words are set off by whitespace; only a first modifier that opens with a parenthesis may touch the name of its command, `f(a) (b)`'); }
    / _ &"," "," { error('modifiers are separated by spaces, not by commas: `f a b`', lastOf(1)); }
    / _ &";" ";" { error('`;` joins neither steps nor queries: steps are joined by `|`, and one query asks several by a template, `get [~(…) ~(…)]`', lastOf(1)); }
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
  = &{ return docQuoteDepth === 0; } &(DocLit (_ DocLit)* _ BindStep) DocLit (_ DocLit)* _
    { error('a doc stands in the slot of the declaration it documents: write `:name |~~ … ~~| body`'); }

// A doc written after a step with no combinator is refused: a note in a
// pipeline is a comment, which is whitespace, and a doc as a value stands
// at the head or where a verb takes it [QSSYN#doc].
DocAfterStep
  = &{ return docQuoteDepth === 0; } &DocOpen DocOpen
    { error('a doc is a value, which stands at the head or where a verb takes it; a note inside a pipeline is a comment, `|~ … ~|`'); }

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
// forms nest, and the closer of the other block form is content.
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
  / word:Word &{ return accepted(() => wordStepRead(word)); } { return taken(); }
  / DocLit
  / DotRefusal

// A dot before a key, the path of jq, and a dot alone, refused [QSSYN#step].
DotRefusal
  = &{ return docQuoteDepth === 0; } &("." KeywordName) "." head:KeywordName tail:("." @KeywordName)*
    { error(`\`${text()}\` is no path: a part is read by \`get\` and a path, which opens with a slash, \`get /${[head, ...tail].join('/')}\``); }
  / &{ return docQuoteDepth === 0; } &("." !KeywordName ![0-9]) "."
    { error('`.` is no value: the value itself is `it`'); }

// A path written before a word, the method call of other languages,
// `/ne ""`, or the read of a part before a word, `/tags count`: a part is
// read by `get`, and a verb is called by its name alone.
PathBeforeWord
  = &{ return docQuoteDepth === 0; } "/" name:KeywordName &(_h1 !Combinator !"!|" Word) _h1 next:$Word
    { error(`\`/${name}\` is a path, a value: a part is read by \`get\`, \`get /${name} | ${next}\`, and a verb is called by its name alone, \`${name} ${next}\``); }

// A command's modifiers are words; the first may touch the name when
// it opens with a parenthesis, so `filter(gt(1))` reads as `filter` with
// the group `(gt(1))`.
Command
  = callName:CallName first:(FirstModifierSeparator @ModifierWord)? rest:(ModifierGap @ModifierWord)*
    &{
      const modifiers = first === null ? [] : [first, ...rest];
      return accepted(() => ({ value: through(() => callOf(callFieldsOf(callName, modifiers), asWritten), facts => modifiers[facts.index]), parts: modifiers }));
    }
    { return taken(); }

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
// `:foo` is a keyword.
BindStep
  = key:BindName & { return key.value.name.includes('/'); } docs:(__ @DocSlot)? body:DefinitionBody?
    & { return docs !== null || body !== null; }
    &{ return accepted(() => bindOfReads(key, docs, body)); }
    { return taken(); }
  / key:BindName docs:(__ @DocSlot) body:ChainBody
    &{ return accepted(() => bindOfReads(key, docs, body)); }
    { return taken(); }
  / key:BindName docs:(__ @DocSlot)? body:Body?
    & { return docs !== null || body !== null; }
    &{ return accepted(() => bindOfReads(key, docs, body)); }
    { return taken(); }

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
    & { return !isKeyword(body.value) || !later; }
    { return body; }

// Whether the whitespace before a body crosses a line.
BodyBreak
  = _h1 !Whitespace { return false; }
  / __ { return true; }

// The body of a definition, a name with a path, begun on a later line is a
// sentence, its steps joined by a combinator up to the next declaration or
// a value that heads the sentence after it; on the line of its name it is
// one step, as a body is [QSSYN#line]. The body of a bare name with its page,
// begun on a later line with a tag name, is the sentence that builds from
// the noun it names, `:Box |~~ … ~~| ::kind | wraps …` [QSSYN#line]; any other
// body of a bare name is one step.
ChainBody
  = !(_h1 !Whitespace) __ !TaggedLit head:TagLit tail:BodySentenceStep*
    &{ return accepted(() => sentenceOf(head, tail)); }
    { return taken(); }

DefinitionBody
  = _h1 !Whitespace body:Step { return body; }
  / __ head:Step & { return !isKeyword(head.value); } tail:BodySentenceStep*
    &{ return accepted(() => sentenceOf(head, tail)); }
    { return taken(); }

// A later step of a body begun on a later line: a command, or after `!|`
// the recovery, a value among them.
BodySentenceStep
  = __ c:Combinator __ !BindStep step:Step & { return c === '!|' || standsAsCommand(step.value); }
    { return { combinator: c, step }; }
  / __ c:PipedCombinator __ !BindStep step:Step
    { return { combinator: c, step }; }

// ── Words ──────────────────────────────────────────────────────────
//
// A word is a literal, a path, a name, a quote or a pipeline in
// parentheses; every part of a literal is a literal [QSLIT#closed].

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

// The element of a literal and the modifier of a command, which a doc value
// may be too [QSSYN#doc].
Element
  = Word
  / DocLit

ModifierWord
  = Word
  / DocLit
  / DotRefusal

Name
  = callName:CallName
    { return part(callOf(callFieldsOf(callName, []), asWritten)); }

// A name with a path, the path of a noun and the name of a verb that
// lives on it, calls the verb by its address, as the keyword and the tag
// name carry a path [QSDSP#walk]: `vec/count` is the `count` of vectors.
CallName
  = head:Ident tail:("/" @KeywordName)+
    { return [head, ...tail].join('/'); }
  / Ident

// `::tag<payload>` puts a payload under a tag through its kind, the
// payload touching the tag by a sign that continues the literal, a number,
// a boolean, null or a path, whose literal would continue the tag's name,
// by `#`, `::Width#5`; parentheses after a tag,
// the sign of code, are refused [QSLIT#closed]. `::tag` alone is the tag name.
TaggedLit
  = head:TagLit "#" payload:PayloadAfterHash
    { return taggedRead(head, payload); }
  / &{ return docQuoteDepth === 0; } &("::" TagName "(" _ PayloadAfterHash _ ")") "::" tag:TagName "(" _ payload:PayloadAfterHash _ ")"
    { error(`a number, a boolean, null or a path touches its tag by \`#\`: write \`::${tag}#${sourceOf(payload)}\``); }
  / &{ return docQuoteDepth === 0; } &("::" TagName "(" _ TaggedPayload _ ")") "::" tag:TagName "(" _ payload:TaggedPayload _ ")"
    { error(`a literal touches its tag by its own sign: write \`::${tag}${sourceOf(payload)}\``); }
  / &{ return docQuoteDepth === 0; } &("::" TagName ParenGroup) "::" tag:TagName group:ParenGroup
    { error(`the parentheses after a tag hold code, which a literal does not run: a value computed goes under a tag by \`tag\`, write \`${input.slice(group.content.start.offset, group.content.end.offset)} | tag ::${tag}\``); }
  / head:TagLit payload:TaggedPayload
    { return taggedRead(head, payload); }

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
    { return part(makeTag(tag)); }

// A tag's name lives apart from the values, so a name after `::` may be
// a word of the literals, as after `:` and `/`: `::null` is the kind of null
// [QSLIT#kind].
TagName
  = NamespacedName
  / KeywordName

ParenGroup
  = "(" _ p:Pipeline _ ")"
    {
      const read = part(groupOf(p.value), p.parts);
      read.content = p.span;
      return read;
    }

// A quote holds the pipeline it is written around, a leading combinator
// included (`~(!| get /trace)`); `~()` is the empty quote. A single name
// or tag name may drop the parentheses, `~add`, `~::T`.
QuoteLit
  = "~(" _ pipeline:Pipeline? _ ")"
    &{ return docQuoteDepth === 0 || pathAlone(pipeline) === null; }
    {
      const path = pathAlone(pipeline);
      if (path !== null) error(`the quote of a path answers the path, which no verb wants: give the path bare, \`${sourceOf(path)}\``);
      const read = pipeline === null ? part(quoteOf([], asWritten)) : part(pipeline.value, pipeline.parts);
      read.content = pipeline === null ? null : pipeline.span;
      return read;
    }

ShortQuoteLit
  = "~" pipeline:(TagLit / Name)
    {
      const read = part(quoteOf([pipeline.value], asWritten), [pipeline]);
      read.content = pipeline.span;
      return read;
    }
  / &{ return docQuoteDepth === 0; } &("~" Path) "~" path:Path
    { error(`the quote of a path answers the path, which no verb wants: give the path bare, \`${sourceOf(path)}\``); }
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
  = "\\" QuoteSpanChar
  / ProseOfAString

QuoteBlockDocSpan
  = "|~~" !"|" QuoteBlockDocChar* "~~|" { return text(); }

QuoteBlockDocChar
  = !"~~|" QuoteSpanChar

QuoteBlockPlainSpan
  = "|~" !"~" !"|" QuoteBlockPlainChar* "~|" { return text(); }

QuoteBlockPlainChar
  = !"~|" QuoteSpanChar

QuoteLineDocSpan
  = "|~~|" ProseOfALine* { return text(); }

QuoteLinePlainSpan
  = "|~|" ProseOfALine* { return text(); }

QuoteChar
  = ![()] @QuoteSpanChar

// A character of a `~(…)` span, which in a line doc is no line break [QSSYN#doc].
QuoteSpanChar
  = c:. &{ return c !== '\n' || !spanOfALine; } { return c; }

// A doc value, in a line form and a block form, read as its segments: a
// `~(…)` that reads as code is a quote, a span between backquotes is
// prose whole, and the rest is prose [QSQUO#literal], [QSSYN#doc]; a line doc's quote
// stays on its line. The printer writes the block form. A parse error
// names its opening `doc` and its prose among the continuations [QSSYN#refusal].
DocLit
  = LineDocOpen text:LineDocText
    { return docRead(text); }
  / BlockDocOpen text:BlockDocText "~~|"
    { return docRead(text); }

LineDocOpen "doc"
  = "|~~|"

BlockDocOpen "doc"
  = "|~~" !"|"

LineDocText
  = parts:LineDocPart* { return textRead(parts); }

BlockDocText
  = parts:BlockDocPart* { return textRead(parts); }

// A run of prose free of `~`, a backquote, `:` and, in a block, `|` is
// one part: a quote begins at `~` or at the `::` of its tags, a span
// between backquotes at a backquote, as markdown reads it, a run of them
// closing at a run of as many and a run with no such closer prose, and in
// a block a nested comment or doc at `|`; a `~(` that reads as no code
// reads to the `)` that pairs it as prose, in a line doc on its line, where
// its quote is tried as code within the line [QSSYN#doc].
LineDocPart
  = ProseRunOfALine { return text(); }
  / &{ return !input.includes('\n', location().start.offset); } quote:DocQuote { return quote; }
  / &{ return input.includes('\n', location().start.offset); } &(quote:DocQuote &{ return !sourceOf(quote).includes('\n'); }) quote:DocQuote { return quote; }
  / LineQuoteSpan
  / open:$("`"+) (!(close:$("`"+) &{ return close.length === open.length; }) ($("`"+) / ProseOfALine))* close:$("`"+) &{ return close.length === open.length; } { return backquotedRead(open.length); }
  / "`"+ { return text(); }
  / ProseOfALine

BlockDocPart
  = ProseRunOfABlock { return text(); }
  / DocQuote
  / open:$("`"+) (!(close:$("`"+) &{ return close.length === open.length; }) ($("`"+) / !"~~|" ProseOfABlock))* close:$("`"+) &{ return close.length === open.length; } { return backquotedRead(open.length); }
  / "`"+ { return text(); }
  / QuoteSpan
  / NestedLineDocSpan
  / NestedLinePlainSpan
  / NestedBlockDocSpan
  / NestedBlockPlainSpan
  / "~|"
  / !"~~|" c:. { return c; }

// The characters of the prose of a doc, a span of prose inside it among it,
// which a refusal names beside the literals that close what it opened [QSSYN#refusal].
ProseRunOfALine "character of prose"
  = [^~`:\n]+

ProseOfALine "character of prose"
  = [^\n]

ProseRunOfABlock "character of prose"
  = [^~`:|]+

ProseOfABlock "character of prose"
  = [^`]

ProseOfAString "character of prose"
  = !["\\] @QuoteSpanChar

// A `~(` of a line doc that reads as no code, read as prose to the `)` that
// pairs it on its line, `spanOfALine` holding while the span is read [QSSYN#doc].
LineQuoteSpan "character of prose"
  = &{ spanOfALine = true; return true; } prose:QuoteSpan &{ spanOfALine = false; return true; } { return prose; }
  / &{ spanOfALine = false; return false; } "~("

// A quote of a doc, under the stack of tags written before it, which gives it
// its role [QSSLF#doc] and is its head [QSHST#tools], the depth `docQuoteDepth` counts given
// back whether a quote is read or not.
DocQuote
  = &{ docQuoteDepth++; return true; } tags:DocQuoteTag* quote:QuoteLit &{ docQuoteDepth--; return true; }
    { return tags.length === 0 ? quote : Object.assign(part(tags.reduceRight((inner, tagName) => makeTagged(makeTag(tagName), inner), quote.value), [quote]), { head: { ...span(), end: quote.span.start } }); }
  / &{ docQuoteDepth--; return false; } "~("

DocQuoteTag
  = "::" @TagName

// ── Literals ───────────────────────────────────────────────────────

// An error literal, `!{…}`, the literal of an error at rest, and the
// literal of one under a tag, `::Tag!{…}`, the tag written before the
// bang and laid through its label [QSERR#rest].
ErrorLit
  = tag:TagLit? "!{" _ "}"
    { return errorRead(tag, []); }
  / tag:TagLit? "!{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ "}"
    { return errorRead(tag, [head, ...tail]); }

// Braces with string keys and commas are JSON syntax for a map, whose
// keys read as the keywords of their strings; where its entries end, the
// other spelling is refused, and so is an entry of two values.
MapLit
  = "{" _ head:JsonMapEntry tail:(_ "," _ @JsonMapEntry)* _ ("}" / &{ return docQuoteDepth === 0; } &("," _ Keyword) { refuseMixedSpellings(); })
    { return entriesRead(map => map, [head, ...tail]); }
  / "{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ ("}" / &{ return docQuoteDepth === 0; } &(StringLit _ ":") { refuseMixedSpellings(); } / &{ return docQuoteDepth === 0; } &(!Keyword Element) { error('a map entry holds one literal, `{:k 1}`, and a shape computed is built by `get`: `get {:k ~(f x)}`'); })
    { return entriesRead(map => map, [head, ...tail]); }
  / "{" _ "}"
    { return part(new Map()); }

JsonMapEntry
  = key:StringLit _ ":" _ value:Element
    { return { key: part(keyword(key.value), [], key.span), value }; }

QlangMapEntry
  = key:Keyword __ value:Element
    { return { key, value }; }

// A regex, read as written: a backslash passes to the engine with the
// character after it, but for `\"`, a quote in the regex that does not end
// it, and the flags may follow the closing quote, `#"error"i`
// [QSTXT#regex].
RegexLit
  = "#\"" chars:RegexChar* "\"" written:$RegexFlag*
    &{ return docQuoteDepth === 0 || regexRead(chars.join(''), written); }
    {
      const source = chars.join('');
      refuseUnreadRegex(source, written);
      return part(makeRegex(source, canonicalFlags(written)));
    }

RegexChar
  = "\\\"" { return '"'; }
  / $("\\" .)
  / RegexSourceCharacter

RegexSourceCharacter "character of a regex"
  = [^"\\]

RegexFlag "flag of a regex"
  = [a-zA-Z]

// A set written with braces, the form of another language, is refused
// naming its own [QSSYN#refusal].
SetLit
  = "#[" _ "]"
    { return part(makeSet([])); }
  / &{ return docQuoteDepth === 0; } &"#{" "#{"
    { error('a set is written `#[…]`, the vector in the one order without duplicates; `{…}` is a map'); }
  / "#[" _ elements:ElementList _ "]"
    { return part(makeSet(elements.map(element => element.value)), elements); }

// Brackets with commas are JSON syntax for a vector; whitespace-separated
// elements are the vector's own.
VecLit
  = "[" _ head:Element tail:((_ "," _ @Element)+ / (LiteralGap @Element)*) _ "]"
    { return part(Object.freeze([head, ...tail].map(element => element.value)), [head, ...tail]); }
  / "[" _ "]"
    { return part(Object.freeze([])); }

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
// key, a keyword of names joined by `/` after `:`, or an index; the slash alone, with no
// segment begun after it, names no path, the value itself being `it`, and a
// question mark after a segment, the habit of a read that may miss, leads to
// `query`.
Path
  = &{ return docQuoteDepth === 0; } &("/" KeySegment ("/" KeySegment)* "?") written:$("/" KeySegment ("?"? "/" KeySegment)* "?"?)
    { error(`a part that may be missing is read by \`query\`, which answers null where it misses: write \`query ${written.replaceAll('?', '')}\``); }
  / "/" first:KeySegment rest:("/" @KeySegment)*
    { return part(makePath([first, ...rest])); }
  / &{ return docQuoteDepth === 0; } "/" !KeySegment !('"' / ":")
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
    { return part(chars.join('')); }

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

HexDigit "hexadecimal digit"
  = [0-9a-fA-F]

// A number is a finite double, so digits naming a magnitude outside that
// domain match no production, and a leading zero is refused [QSLIT#number]
// but in a quote of a doc, where it fails the try [QSSYN#doc]. `text()` reads
// empty inside a semantic predicate, so the predicate reads its labels.
NumberLit "number within the finite double range"
  = sign:"-"? whole:[0-9]+ frac:("." [0-9]+)? exp:([eE] [+\-]? [0-9]+)?
    &{ const matched = (sign || '') + whole.join('')
                     + (frac ? '.' + frac[1].join('') : '')
                     + (exp  ? exp[0] + (exp[1] || '') + exp[2].join('') : '');
       return Number.isFinite(Number(matched)) && (docQuoteDepth === 0 || !leadsWithAZero(whole)); }
    { if (leadsWithAZero(whole)) {
        const digits = whole.join('').replace(/^0+/, '') || '0';
        const written = (sign || '') + digits + (frac ? '.' + frac[1].join('') : '') + (exp ? exp[0] + (exp[1] || '') + exp[2].join('') : '');
        error(`a number is written without a leading zero: write \`${written}\``);
      }
      return part(Number(text())); }

BooleanLit
  = "true"  !IdentTail { return part(true); }
  / "false" !IdentTail { return part(false); }

NullLit
  = "null" !IdentTail { return part(null); }

// `:name` and `:"any text"` read as the same keyword.
Keyword
  = ":" name:QuotedKeywordName  { return part(keyword(name)); }
  / ":" name:NamespacedName     { return part(keyword(name)); }
  / ":" name:KeywordName        { return part(keyword(name)); }

NamespacedName
  = head:KeywordName tail:("/" @KeywordName)+
    { return head + tail.map(t => '/' + t).join(''); }

QuotedKeywordName
  = '"' chars:DoubleStringChar* '"' { return chars.join(''); }

// A name after `:` or `/` may be a word of the literals.
KeywordName
  = first:IdentStart rest:IdentTail*
    { return first + rest.join(''); }

Ident
  = !ReservedWord first:IdentStart rest:IdentTail*
    { return first + rest.join(''); }

ReservedWord
  = ("true" / "false" / "null") !IdentTail

// The letters of a name, `core/src/name-chars.mjs` [QSNAM#letters].
IdentStart "name"
  = c:. &{ return isNameStart(c); } { return c; }
IdentTail  "letters of a name"
  = c:. &{ return isNameContinue(c); } { return c; }

// ── Whitespace ─────────────────────────────────────────────────────
//
// `_` is optional whitespace, `__` required whitespace, and `_h1`
// whitespace within a line, which tells a body or a modifier on the line
// of its name from a declaration that opens a later line [QSSYN#line]; a
// comment is whitespace [QSSYN#comment].

_   = Whitespace*
__  = Whitespace+
_h1 = InlineSpace+

Whitespace "whitespace" = [ \t\n\r] / PlainComment

InlineSpace "whitespace" = [ \t] / PlainComment

NonSpace = [^ \t\n\r]
