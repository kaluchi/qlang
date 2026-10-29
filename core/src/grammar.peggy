// PEG grammar for the qlang pipeline query language.
//
// A text is its declarations, each ended by `;`, and at most one query after
// them: a declaration a keyword with its page or its body, the body one
// step or a chain, a tag name and the commands joined to it up to the `;`,
// and the query the steps a combinator joins, each a command, a name followed
// by its modifiers, each one word [QSSYN#step]. A line break is whitespace
// wherever whitespace stands [QSSYN#line]. Every combinator is set off by whitespace on
// both sides.
//
// Every rule answers a part, the record of a step its constructor builds or
// a literal, its span, which names the source the caller gives, and the parts
// it holds; a rule a constructor holds is refused at the part its refusal
// names [QSQUO#step], a quote of a doc among it [QSSYN#doc].
//
// A comment, `|~| …` to the end of its line or `|~ … ~|`, is
// whitespace wherever whitespace stands [QSSYN#comment]; the parser
// records each on the side, `options.commentTrivia`, for the tools. The
// doc forms, `|~~| …` and `|~~ … ~~|`, are the doc literal, which
// documents the declaration whose slot it stands in [QSSYN#doc].

{{
  import { isNameStart, isNameContinue } from '../src/name-chars.mjs';
  import { canonicalFlags, regexProblem, regexRefusal, REGEX_FLAGS } from '../src/regex-read.mjs';
  import { makeKeyword, isKeyword, isDoc, isPath, makeRegex, makePath, makeDoc, makeTag, makeTagged, errorAtRest, ERROR_TAG } from '../src/types.mjs';
  import { makeSet } from '../src/ordering.mjs';
  import { QlangError } from '../src/errors.mjs';
  import { quoteOf, callOf, bindOf, constructOf, failOf, groupOf, isComputingStep, partsOfALiteral, isOfTheKindOfErrors, isGroupStep } from '../src/steps.mjs';
  import { forEachPart } from '../src/parsed-parts.mjs';

  // A span between backquotes in the prose of a doc: its text and the span of
  // the code its runs of backquotes hold [QSHST#tokens].
  class Backquoted {
    constructor(text, code) {
      this.text = text;
      this.code = code;
    }
  }

  // The segments of a doc, its prose, each run of it one string, and the parts
  // of the quotes among it, with the spans of the code its spans between
  // backquotes hold [QSHST#tokens].
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

  // The opener of a doc read, where a refusal of the doc points.
  function openerOf(doc) {
    const { source, start } = doc.span;
    return { source, start, end: pointOf(start.offset + (input.startsWith('|~~|', start.offset) ? 4 : 3)) };
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

  // A block nested in a comment or in the prose of a doc, by the offset where
  // it closes, for a caller that names what a source left open [QSSYN#refusal].
  function keepNestedBlock() {
    const loc = span();
    options.nestedBlocks?.set(loc.end.offset, loc.start);
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
    forEachPart(read, held => {
      if (!isComputingStep(held.value)) return partsOfALiteral(held.value).length > 0;
      computing.push(held);
      return false;
    });
    return computing;
  }

  // The records a rule builds, kept for its action where they keep the rules
  // of a step; a broken rule is refused at the part it names, and a throw of a
  // constructor that is no refusal passes as it is [QSQUO#step].
  let built = null;

  function accepted(build) {
    try {
      built = build();
      return true;
    } catch (thrown) {
      if (!(thrown instanceof Refused)) throw thrown;
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

  // The chain a declaration's body is, a tag name and the commands joined to
  // it, in the group of its steps [QSNAM#declare].
  function chainOf(head, tail) {
    const { value, parts } = pipelineOf('|', head, tail);
    return { value: groupOf(value), parts };
  }

  // A text, its declarations at the head of the steps of its query [QSSYN#step].
  function textOf(declarations, query) {
    const parts = [...declarations, ...(query === null ? [] : query.parts)];
    return { value: quoteRead(parts), parts };
  }

  function callFieldsOf(name, modifiers) {
    const fields = new Map([['name', makeKeyword(name)]]);
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
  // [QSQUO#step], [QSERR#rest], [QSHST#tokens].
  function taggedRead(head, payload, at) {
    if (head.value.name === ERROR_TAG.name && isOfTheKindOfErrors(payload.value)) return Object.assign(part(payload.value, [head, ...payload.parts], at), { head: { ...head.span, end: (payload.head ?? head.span).end } });
    return Object.assign(part(constructOf(new Map([['tag', head.value], ['payload', payload.value]])), [payload], at), { head: head.span });
  }

  // An error literal, a tag before its bang the tagged literal of it,
  // `::Late!{…}` the literal `::Late::error!{…}` [QSERR#rest].
  function errorRead(tag, entries, at = span()) {
    if (tag === null) return entriesRead(facts => errorAtRest(facts), entries, [], at);
    return taggedRead(tag, entriesRead(facts => errorAtRest(facts), entries, [], { ...at, start: tag.span.end }), at);
  }

  // What a word under a tag read, from its tag [QSLIT#closed].
  function fromTheTag(head) {
    const { source, end } = range();
    return { source, start: head.span.start, end: pointOf(end) };
  }

  // The segments of a doc, the span of its text to its last word and the spans
  // of the code between its backquotes [QSHST#tokens].
  function textRead(parts) {
    const { source, start } = range();
    return { ...proseJoined(parts), text: { source, start: pointOf(start), end: pointOf(start + text().trimEnd().length) } };
  }

  // A span between backquotes, its runs of backquotes as many on each side
  // [QSHST#tokens].
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

  // The docs a span between backquotes opened and did not close [QSSYN#doc].
  let docsInASpan = 0;

  // The offsets where a rule failed: a read there fails at once, a read aloud
  // where the failure was read aloud [D404].
  const FAILED_SILENTLY = 1;
  const FAILED_ALOUD = 2;

  function knownToFail(failures) {
    const known = failures[offset()];
    return known === FAILED_ALOUD || (known === FAILED_SILENTLY && peg$silentFails > 0);
  }

  function failedHere(failures) {
    const key = offset();
    if (failures[key] !== FAILED_ALOUD) failures[key] = peg$silentFails > 0 ? FAILED_SILENTLY : FAILED_ALOUD;
    return false;
  }

  const failuresOf = () => new Uint8Array(input.length + 1);
  const groupFailures = failuresOf();
  const quoteFailures = failuresOf();
  const taggedFailures = failuresOf();
  const nestedDocFailures = failuresOf();
  const nestedCommentFailures = failuresOf();

  // The path a quote holds alone, a leading pipe before it among it, or null.
  function pathAlone(pipeline) {
    return pipeline !== null && pipeline.value.length === 1 && isPath(pipeline.value[0]) ? pipeline.parts[0] : null;
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
  = _ p:Text _ { return p; }
  / _ { return part(quoteOf([], asWritten)); }

// ── Texts ──────────────────────────────────────────────────────────

// A text, a query of the command line, a source, the code of a quote or of a
// group: its declarations, each ended by `;`, the last one by the end of the
// text where no query follows, and at most one query after them [QSSYN#step].
Text
  = head:Declaration tail:(_ ";" _ @Declaration)* query:QueryAfterTheDeclarations
    &{ return accepted(() => textOf([head, ...tail], query)); }
    { return taken(); }
  / Pipeline

// What follows the declarations of a text: `;` and the query, `;` at its end,
// or its end; a `|` or a `!|` after a declaration is refused, and so is any
// other word, each naming the `;` [QSSYN#refusal].
QueryAfterTheDeclarations
  = _ ";" _ query:Pipeline { return query; }
  / _ ";" { return null; }
  / &(_ (!. / ")")) { return null; }
  / _ "!|" { error('a failure of a declaration is the failure of its text, which no `!|` of the text catches: a declaration ends with `;`, and a failure of the text is caught where the text is read, `~(…) | answer !| …`'); }
  / _ &("|" !"~") "|" { error('a declaration ends with `;`, which joins it to the query after it: write `:name body; query`'); }
  / _ &. { error('a declaration ends with `;` before what follows it: write `:name body; …`'); }

// A declaration where a step of the query stands is refused: the
// declarations of a text stand at its head, before its query [QSSYN#step].
DeclarationInTheQuery
  = &Declaration Declaration
    { error('a declaration stands at the head of its text, before the query, each ended by `;`: write `:x 1; [1 2] | x`'); }

// ── Pipelines ──────────────────────────────────────────────────────

Pipeline
  = leadingComb:(LeadingCombinator __)? head:PipelineHead tail:ContinuationUnit*
    &{ return accepted(() => pipelineOf(leadingComb === null ? '|' : leadingComb[0], head, tail)); }
    { return taken(); }
  / &(LeadingCombinator __ Combinator) first:LeadingCombinator __ second:Combinator
    { refuseCombinatorAfterCombinator(first, second); }
  / c:LeadingCombinator _ !. &{ options.stepMissed = c; return false; }

// The `!"~"` lookahead keeps the openers of a comment `|~`, `|~|`, `|~~`,
// `|~~|` from reading as a pipe; a pipe written before `!|` stands for it
// at the head as between two steps [QSSYN#combinator].
LeadingCombinator
  = "!|" / "|" &(__ "!|") __ "!|" { return '!|'; } / "|" !"~" { return '|'; }

Combinator
  = "!|" { return '!|'; }
  / "|" !"~" { return '|'; }

PipelineHead
  = PipelineStep
  / &(LeadingCombinator NonSpace) c:LeadingCombinator { refuseCombinatorSpacing(c); }

// A tag name where a declaration's name stands declares nothing: a
// name is declared by its keyword, and a value under a tag touches its
// payload [QSNAM#address], [QSSYN#step].
TagDeclarationRefusal
  = &(TagLit _h1 !Combinator (DocOpen / Word)) TagLit _h1 !Combinator (DocOpen / Word)
    { error('a name is declared by its keyword, `:Box |~~ A parcel. ~~|`, and a value under a tag touches its payload, `::Box[…]`'); }

ContinuationUnit
  = _ DocBeforeDeclaration
  / _ DocAfterStep
  / __ DeclarationInTheQuery
  / __ c:Combinator __ step:PipelineStep { return { combinator: c, step }; }
  / __ c:PipedCombinator __ step:PipelineStep { return { combinator: c, step }; }
  / StepMissedAtTheEnd
  / SpacingRefusal

// A combinator the source ends with, comments after it read as whitespace,
// misses its step: the parser keeps it for the refusal of the source, which
// names it beside the continuations [QSSYN#refusal].
StepMissedAtTheEnd
  = __ c:(PipedCombinator / Combinator) _ !. &{ options.stepMissed = c; return false; }

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
  = ( _ &"|~" "|~" { error('`|~` opens a comment that is never closed; code runs on the value in the pipe by a verb, `| apply ~(…)`'); }
    / _ &(Combinator _ [)\]}]) c:Combinator { error(`\`${c}\` joins two steps, and the step after it is missing`, lastOf(c.length)); }
    / __ &(PipedCombinator __ Combinator) PipedCombinator __ second:Combinator { refuseCombinatorAfterCombinator('!|', second); }
    / __ !PipedCombinator &(Combinator __ Combinator) first:Combinator __ second:Combinator { refuseCombinatorAfterCombinator(first, second); }
    / &Combinator c:Combinator { refuseCombinatorSpacing(c); }
    / __ &(Combinator NonSpace) c:Combinator { refuseCombinatorSpacing(c); }
    / &(!"/" Word) Word { error('words are set off by whitespace; only a first modifier that opens with a parenthesis may touch the name of its command, `f(a) (b)`'); }
    / _ &"," "," { error('modifiers are separated by spaces, not by commas: `f a b`', lastOf(1)); }
    / _ &";" ";" { error('`;` ends a declaration, and a text holds one query after its declarations: steps are joined by `|`, and one query asks several things by a template, `get [~(…) ~(…)]`', lastOf(1)); }
    / _h1 &Word { error('steps are joined by `|`: write `a | b`', after()); }
    / __ &Word { error('steps are joined by `|`, at the end of a line or at the start of the next: a line break is a space', after()); }
    )

PipelineStep
  = DocStep
  / DeclarationInTheQuery
  / TagDeclarationRefusal
  / Step

// A doc where a step stands, read once whatever follows it: before a
// declaration it is refused, since a doc documents the declaration whose slot
// it stands in, and a doc after it with no combinator is refused as a note in
// a pipeline [QSSYN#doc].
DocStep
  = head:DocLit tail:(&(_ DocOpen) _ @DocLit)* declared:(_ &Declaration)?
    {
      if (declared !== null) error('a doc stands in the slot of the declaration it documents: write `:name |~~ … ~~| body`');
      if (tail.length > 0) error('a doc is a value, which stands at the head or where a verb takes it; a note inside a pipeline is a comment, `|~ … ~|`', openerOf(tail[0]));
      return head;
    }

// A doc documents the declaration whose slot it stands in, between the
// name and the body; written before a declaration it is refused, since
// no step reads a doc it hands to the next [QSSYN#doc].
DocBeforeDeclaration
  = &(DocLit (_ DocLit)* _ Declaration) DocLit (_ DocLit)* _
    { error('a doc stands in the slot of the declaration it documents: write `:name |~~ … ~~| body`'); }

// A doc written after a step with no combinator is refused: a note in a
// pipeline is a comment, which is whitespace, and a doc as a value stands
// at the head or where a verb takes it [QSSYN#doc].
DocAfterStep
  = &DocOpen DocOpen
    { error('a doc is a value, which stands at the head or where a verb takes it; a note inside a pipeline is a comment, `|~ … ~|`'); }

DocOpen
  = LineDocOpen / BlockDocOpen

PlainComment
  = LinePlainComment
  / BlockPlainComment

// ── Comment tokens ─────────────────────────────────────────────────
//
// Longer openers are tried first: `|~~|` before `|~|`, `|~~` before
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

// Inside a block comment the openers of a line are bare tokens, the block
// forms nest, and the closer of the other block form is content; a block
// that failed at an offset fails there again at once [D404]. A nested block
// is kept by the offset where it closes, where the caller asks, which names
// the opener of a source cut short inside it [QSSYN#refusal].
NestedLineDocSpan
  = "|~~|"
    { return text(); }
NestedLinePlainSpan
  = "|~|"
    { return text(); }
NestedBlockDocSpan
  = &{ return !knownToFail(nestedDocFailures); } "|~~" !"|" BlockDocContent "~~|"
    { keepNestedBlock(); return text(); }
  / &{ return failedHere(nestedDocFailures); } "|~~"
NestedBlockPlainSpan
  = &{ return !knownToFail(nestedCommentFailures); } "|~" ![|~] BlockPlainContent "~|"
    { keepNestedBlock(); return text(); }
  / &{ return failedHere(nestedCommentFailures); } "|~"

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
  / DotStepRefusal

// The path of jq refused naming the path, read by `get` where a step stands
// and written bare where a modifier does, and a dot alone naming `it` [QSSYN#step].
DotStepRefusal
  = &DottedPath path:DottedPath
    { error(`\`${text()}\` is no path: a part is read by \`get\` and a path, which opens with a slash, \`get ${path}\``); }
  / DotAlone

DotModifierRefusal
  = &DottedPath path:DottedPath
    { error(`\`${text()}\` is no path: a path opens with a slash, \`${path}\``); }
  / DotAlone

DottedPath
  = "." head:(DotIndex / $DotKey) tail:("."? @DotIndex / "." @$DotKey)*
    { return '/' + [head, ...tail].join('/'); }

DotKey
  = KeywordName
  / QuotedKeywordName

DotIndex
  = "[" @$("-"? [0-9]+) "]"

DotAlone
  = &("." ([ \t\n\r|)\]}] / !.)) "."
    { error('`.` is no value: the value itself is `it`'); }

// A path written before a word, the method call of other languages,
// `/ne ""`, or the read of a part before a word, `/tags count`: a part is
// read by `get`, and a verb is called by its name alone, which a path of
// one name may have meant.
PathBeforeWord
  = "/" name:KeywordName &(_h1 !Combinator !"!|" Word) _h1 next:$Word
    { error(`\`/${name}\` is a path, a value: a part is read by \`get\`, \`get /${name} | ${next}\`, and a verb is called by its name alone, \`${name} ${next}\``); }
  / path:$("/" KeySegment)+ &(_h1 !Combinator !"!|" Word) _h1 next:$Word
    { error(`\`${path}\` is a path, a value: a part is read by \`get\`, \`get ${path} | ${next}\``); }

// A command's modifiers are words; the first may touch the name when
// it opens with a parenthesis, so `filter(gt(1))` reads as `filter` with
// the group `(gt(1))`. A keyword with its page after the first modifier is
// the declaration after a chain no `;` ended, refused naming the `;` [QSSYN#line].
Command
  = callName:CallName touching:(&"(" @ModifierWord)? rest:(__ @ModifierWord)*
    &{
      const modifiers = touching === null ? rest : [touching, ...rest];
      const declared = modifiers.findIndex((modifier, at) => at > 0 && isKeyword(modifier.value) && modifiers[at + 1] !== undefined && isDoc(modifiers[at + 1].value));
      if (declared !== -1) error(`a declaration after a chain begins after the \`;\` that ends the chain: write \`…;\` before \`${sourceOf(modifiers[declared])}\``, modifiers[declared].span);
      return accepted(() => ({ value: through(() => callOf(callFieldsOf(callName, modifiers), asWritten), facts => modifiers[facts.index]), parts: modifiers }));
    }
    { return taken(); }

// A declaration: a keyword, then the doc literals of its slot and an
// optional body, each after whitespace, a line break among it
// [QSNAM#address], [QSSYN#line]; a lone `:foo` is a keyword, its name and its slot
// read once [D404].
Declaration
  = key:BindName docs:(__ @DocSlot)? body:(__ @DeclarationBody)?
    & { return docs !== null || body !== null; }
    &{ return accepted(() => bindOfReads(key, docs, body)); }
    { return taken(); }

BindName
  = Keyword

DocSlot
  = first:DocLit rest:(_ @DocLit)*
    { return [first, ...rest]; }

// The body of a declaration: the chain that builds from a tag name, the tag
// name and the commands joined to it up to the `;`, or one step [QSNAM#declare].
DeclarationBody
  = Chain
  / Step

Chain
  = head:TagLit tail:ChainStep+
    &{ return accepted(() => chainOf(head, tail)); }
    { return taken(); }

ChainStep
  = __ "|" !"~" __ step:Command { return { combinator: '|', step }; }

// ── Words ──────────────────────────────────────────────────────────
//
// A word is a literal, a path, a name, a quote or a pipeline in
// parentheses; every part of a literal is a literal [QSLIT#closed].

Word
  = ParenGroup
  / TagWord
  / ErrorLit
  / SetLit
  / VecLit
  / MapLit
  / QuoteLit
  / ShortQuoteLit
  / Path
  / Name
  / AtomLit

// The element of a literal and the modifier of a command, which a doc value
// may be too [QSSYN#doc].
Element
  = Word
  / DocLit

ModifierWord
  = Element
  / DotModifierRefusal

Name
  = callName:CallName
    { return part(callOf(callFieldsOf(callName, []), asWritten)); }

// A name with a path, the path of a noun and the name of a verb that
// lives on it, calls the verb by its address, as the keyword and the tag
// name carry a path [QSDSP#walk]: `vec/count` is the `count` of vectors.
CallName
  = head:Ident tail:("/" @KeywordName)*
    { return [head, ...tail].join('/'); }

// A word under a tag, its tag read once and what touches it read after it
// [QSLIT#closed], [QSERR#rest]: `::Tag!{…}` the error literal laid through
// the label of its tag, `::tag<payload>` a payload under a tag through its
// kind, the payload touching the tag by a sign that continues the literal,
// a number, a boolean, null or a path, whose literal would continue the
// tag's name, by `#`, `::Width#5`; parentheses after a tag, the sign of
// code, are refused, and `::tag` alone is the tag name. What touches a tag
// that failed at an offset fails there again at once [D404].
TagWord
  = head:TagLit tagged:(
      &{ return !knownToFail(taggedFailures); } @(
          entries:ErrorBraces
          { return errorRead(head, entries, fromTheTag(head)); }
        / "#" payload:PayloadAfterHash
          { return taggedRead(head, payload, fromTheTag(head)); }
        / &("(" _ PayloadAfterHash _ ")") "(" _ payload:PayloadAfterHash _ ")"
          { error(`a number, a boolean, null or a path touches its tag by \`#\`: write \`::${head.value.name}#${sourceOf(payload)}\``, fromTheTag(head)); }
        / &("(" _ TaggedPayload _ ")") "(" _ payload:TaggedPayload _ ")"
          { error(`a literal touches its tag by its own sign: write \`::${head.value.name}${sourceOf(payload)}\``, fromTheTag(head)); }
        / &ParenGroup group:ParenGroup
          { error(`the parentheses after a tag hold code, which a literal does not run: a value computed goes under a tag by \`tag\`, write \`${input.slice(group.content.start.offset, group.content.end.offset)} | tag ::${head.value.name}\``, fromTheTag(head)); }
        / payload:TaggedPayload
          { return taggedRead(head, payload, fromTheTag(head)); }
        )
    / &{ return failedHere(taggedFailures); }
    )?
    { return tagged ?? head; }

PayloadAfterHash
  = NumberLit
  / BooleanLit
  / NullLit
  / Path

TaggedPayload
  = TagWord
  / ErrorLit
  / RegexLit
  / SetLit
  / VecLit
  / MapLit
  / QuoteLit
  / ShortQuoteLit
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

// A group that failed at an offset fails there again at once [D404].
ParenGroup
  = "(" &{ return !knownToFail(groupFailures); } _ p:Text _ ")"
    {
      const read = part(groupOf(p.value), p.parts);
      read.content = p.span;
      return read;
    }
  / "(" &{ return failedHere(groupFailures); }

// A quote holds the pipeline it is written around, a leading combinator
// included (`~(!| get /trace)`), `~()` the empty quote; a name or a tag name
// alone may drop the parentheses, `~add`, `~::T`, and a path is refused [QSSYN#step];
// a quote that failed at an offset fails there again at once [D404].
QuoteLit
  = "~(" &{ return !knownToFail(quoteFailures); } _ pipeline:Text? _ ")"
    {
      const path = pathAlone(pipeline);
      if (path !== null) error(`the quote of a path answers the path, which no verb wants: give the path bare, \`${sourceOf(path)}\``);
      const read = pipeline === null ? part(quoteOf([], asWritten)) : part(pipeline.value, pipeline.parts);
      read.content = pipeline === null ? null : pipeline.span;
      return read;
    }
  / "~(" &{ return failedHere(quoteFailures); }

ShortQuoteLit
  = "~" pipeline:(TagLit / Name)
    {
      const read = part(quoteOf([pipeline.value], asWritten), [pipeline]);
      read.content = pipeline.span;
      return read;
    }
  / &("~" Path) "~" path:Path
    { error(`the quote of a path answers the path, which no verb wants: give the path bare, \`${sourceOf(path)}\``); }
  / "~" &[{[]
    { error('a quote is written `~(…)`, its code in parentheses; `{…}` is a map and `[…]` a vector'); }

// The balance reading of a `~(…)` span inside a comment or a doc nested in
// one, where the span is prose: parentheses nest, and a string or a comment token
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

// A character of a `~(…)` span.
QuoteSpanChar
  = .

// A doc value, in a line form and a block form, read as its segments: a
// `~(…)` outside a span between backquotes is a quote, a span between
// backquotes is prose whole, and the rest is prose [QSQUO#literal], [QSSYN#doc].
// The printer writes the block form. A parse error names its opening `doc` and
// its prose among the continuations [QSSYN#refusal].
DocLit
  = LineDocOpen text:LineDocText &LineDocEnd
    { return docRead(text); }
  / BlockDocOpen text:BlockDocText "~~|"
    { return docRead(text); }

LineDocOpen "doc"
  = "|~~|"

BlockDocOpen "doc"
  = "|~~" !"|"

LineDocText
  = parts:LineDocPart* { return textRead(parts); }

// The end of the line a line doc reads its prose to, past the lines a quote of
// it runs on across.
LineDocEnd
  = "\r\n" / "\n" / !.

BlockDocText
  = parts:BlockDocPart* { return textRead(parts); }

// A run of prose free of `~`, a backquote, `:` and, in a block, `|` is
// one part: a quote begins at `~` or at the `::` of its tags, a span
// between backquotes at a backquote, as markdown reads it, a run of them
// closing at a run of as many and a run with no such closer prose, and in
// a block a nested comment or doc at `|`; a `~(` outside a span is a quote,
// and a line doc's line ends at `\n` or `\r\n` [QSSYN#doc].
LineDocPart
  = ProseRunOfALine { return text(); }
  / DocQuote
  / open:$("`"+) (!(close:$("`"+) &{ return close.length === open.length; }) ($("`"+) / ProseOfALine))* close:$("`"+) &{ return close.length === open.length; } { return backquotedRead(open.length); }
  / "`"+ { return text(); }
  / !DocQuoteOpens @ProseOfALine

BlockDocPart
  = ProseRunOfABlock { return text(); }
  / DocQuote
  / open:$("`"+) &{ docsInASpan = 0; return true; } (!(close:$("`"+) &{ return close.length === open.length; }) ($("`"+) / DocInASpan / !"~~|" ProseOfABlock))* close:$("`"+) &{ return close.length === open.length; } { return backquotedRead(open.length); }
  / "`"+ { return text(); }
  / NestedLineDocSpan
  / NestedLinePlainSpan
  / NestedBlockDocSpan
  / NestedBlockPlainSpan
  / "~|"
  / !"~~|" !DocQuoteOpens c:. { return c; }

// The characters of the prose of a doc, a span of prose inside it among it,
// which a refusal names beside the literals that close what it opened [QSSYN#refusal].
ProseRunOfALine "character of prose"
  = [^~`:\r\n]+

ProseOfALine "character of prose"
  = [^\r\n]
  / @"\r" !"\n"

ProseRunOfABlock "character of prose"
  = [^~`:|]+

ProseOfABlock "character of prose"
  = [^`]

// A doc nested in a span between backquotes of a block is its prose [QSSYN#doc].
DocInASpan "character of prose"
  = "|~~|"
  / "|~~" &{ docsInASpan += 1; return true; }
  / "~~|" &{ return docsInASpan > 0; } &{ docsInASpan -= 1; return true; }

ProseOfAString "character of prose"
  = !["\\] @QuoteSpanChar

// A quote of a doc, under the stack of tags written before it, which gives it
// its role [QSSLF#doc] and is its head [QSHST#tokens].
DocQuote
  = tags:DocQuoteTag* quote:QuoteLit
    { return tags.length === 0 ? quote : Object.assign(part(tags.reduceRight((inner, tagName) => makeTagged(makeTag(tagName), inner), quote.value), [quote]), { head: { ...span(), end: quote.span.start } }); }

// Where a quote of a doc opens, a `~(` under the tags written before it,
// which no prose reads [QSSYN#doc].
DocQuoteOpens
  = DocQuoteTag* "~("

DocQuoteTag
  = "::" @TagName

// ── Literals ───────────────────────────────────────────────────────

// An error literal, `!{…}`, the literal of an error at rest, whose
// literal under a tag, `::Tag!{…}`, is a word under its tag [QSERR#rest].
ErrorLit
  = entries:ErrorBraces
    { return errorRead(null, entries); }

ErrorBraces
  = "!{" _ "}"
    { return []; }
  / "!{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ "}"
    { return [head, ...tail]; }

// Braces with string keys and commas are JSON syntax for a map, whose keys
// read as the keywords of their strings; where its entries end, the other
// spelling is refused, and so is an entry of two values [QSLIT#json], [QSLIT#closed].
MapLit
  = "{" _ head:JsonMapEntry tail:(_ "," _ @JsonMapEntry)* _ ("}" / &(("," _)? Keyword) { refuseMixedSpellings(); })
    { return entriesRead(map => map, [head, ...tail]); }
  / "{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ ("}" / &(("," _)? StringLit _ ":") { refuseMixedSpellings(); } / &(!Keyword Element) { error('a map entry holds one literal, `{:k 1}`, and a shape computed is built by `get`: `get {:k ~(f x)}`'); })
    { return entriesRead(map => map, [head, ...tail]); }
  / "{" _ "}"
    { return part(new Map()); }

JsonMapEntry
  = key:StringLit _ ":" _ value:Element
    { return { key: part(makeKeyword(key.value), [], key.span), value }; }

QlangMapEntry
  = key:Keyword __ value:Element
    { return { key, value }; }

// A regex, read as written: a backslash passes to the engine with the
// character after it, but for `\"`, a quote in the regex that does not end
// it, and the flags may follow the closing quote, `#"error"i`
// [QSTXT#regex].
RegexLit
  = "#\"" chars:RegexChar* "\"" written:$RegexFlag*
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
  / &"#{" "#{"
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
  / &(!"/" Element) Element { error('the words of a literal are set off by whitespace: `[1 2]`'); }

// A path, a value of its own [QSPTH#value]: a segment is a bare key, a quoted
// key, a keyword of names joined by `/` after `:`, or an index; the slash alone, with no
// segment begun after it, names no path, the value itself being `it`, and a
// question mark after a segment, the habit of a read that may miss, leads to
// `query` [QSSYN#step].
Path
  = &("/" KeySegment ("/" KeySegment)* "?") segments:("/" @$KeySegment "?"?)+
    { error(`a part that may be missing is read by \`query\`, which answers null where it misses: write \`query /${segments.join('/')}\``); }
  / "/" first:KeySegment rest:("/" @KeySegment)*
    { return part(makePath([first, ...rest])); }
  / "/" !KeySegment !('"' / ":")
    { error('the slash alone names no path: the value itself is `it`'); }

KeySegment
  = ":" name:NamespacedName { return name; }
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
// domain match no production, and a leading zero is refused [QSLIT#number].
// `text()` reads empty inside a semantic predicate, so the predicate reads
// its labels.
NumberLit "number within the finite double range"
  = sign:"-"? whole:[0-9]+ frac:("." [0-9]+)? exp:([eE] [+\-]? [0-9]+)?
    &{ const matched = (sign || '') + whole.join('')
                     + (frac ? '.' + frac[1].join('') : '')
                     + (exp  ? exp[0] + (exp[1] || '') + exp[2].join('') : '');
       return Number.isFinite(Number(matched)); }
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

// A keyword is a name or any text in quotes after `:`, a bare name in
// quotes that name, `:"name"` the keyword `:name` [QSLIT#keyword].
Keyword
  = ":" name:QuotedKeywordName  { return part(makeKeyword(name)); }
  / ":" name:NamespacedName     { return part(makeKeyword(name)); }

// A name after `:` or `::`, its segments joined by `/`, read once
// [QSNAM#address].
NamespacedName
  = head:KeywordName tail:("/" @KeywordName)*
    { return [head, ...tail].join('/'); }

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

// The letters of a name, `core/src/name-chars.mjs`, each a code point, a
// letter past the first plane of Unicode two code units [QSNAM#letters].
IdentStart "name"
  = c:$([\uD800-\uDBFF] [\uDC00-\uDFFF] / .) &{ return isNameStart(c); } { return c; }
IdentTail  "letters of a name"
  = c:$([\uD800-\uDBFF] [\uDC00-\uDFFF] / .) &{ return isNameContinue(c); } { return c; }

// ── Whitespace ─────────────────────────────────────────────────────
//
// `_` is optional whitespace, `__` required whitespace, a line break among
// it [QSSYN#line], and `_h1` whitespace within a line, which a refusal reads to
// name a word written beside another on its line; a comment is whitespace,
// read where its `|` stands [QSSYN#comment].

_   = Whitespace*
__  = Whitespace+
_h1 = InlineSpace+

Whitespace "whitespace" = [ \t\n\r] / &"|" @PlainComment

InlineSpace "whitespace" = [ \t] / &"|" @PlainComment

NonSpace = [^ \t\n\r]
