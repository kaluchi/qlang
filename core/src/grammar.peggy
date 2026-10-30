// [QSSYN#step], [QSSYN#line], [QSQUO#step], [QSSYN#doc], [QSSYN#comment]

{{
  import { isNameStart, isNameContinue } from '../src/name-chars.mjs';
  import { canonicalFlags, regexProblem, regexRefusal, REGEX_FLAGS } from '../src/regex-read.mjs';
  import { makeKeyword, isKeyword, isDoc, isPath, makeRegex, makePath, makeDoc, makeTag, makeTagged, errorAtRest, ERROR_TAG } from '../src/types.mjs';
  import { makeSet } from '../src/ordering.mjs';
  import { QlangError } from '../src/errors.mjs';
  import { quoteOf, callOf, bindOf, constructOf, failOf, groupOf, isComputingStep, partsOfALiteral, isOfTheKindOfErrors } from '../src/steps.mjs';
  import { forEachPart } from '../src/parsed-parts.mjs';

  // [QSHST#tokens]
  class Backquoted {
    constructor(text, code) {
      this.text = text;
      this.code = code;
    }
  }

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

  class Refused {
    constructor(message, at) {
      this.message = message;
      this.at = at;
    }
  }
}}

{
  const commentTrivia = options.commentTrivia;

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

  function span() {
    const { source, start, end } = range();
    return { source, start: pointOf(start), end: pointOf(end) };
  }

  function after() {
    const { source, end } = range();
    return { source, start: pointOf(end), end: pointOf(end + 1) };
  }

  function openerOf(doc) {
    const { source, start } = doc.span;
    return { source, start, end: pointOf(start.offset + (input.startsWith('|~~|', start.offset) ? 4 : 3)) };
  }

  function lastOf(length) {
    const { source, end } = range();
    return { source, start: pointOf(end - length), end: pointOf(end) };
  }
  function recordComment(type, content) {
    const loc = span();
    commentTrivia.set(loc.start.offset, { type, content, location: loc });
  }

  // [QSSYN#refusal]
  function keepNestedBlock() {
    const loc = span();
    options.nestedBlocks?.set(loc.end.offset, loc.start);
  }

  const reads = new WeakMap();

  function part(value, parts = [], at = span()) {
    const read = { value, span: at, parts };
    if (typeof value === 'object' && value !== null) reads.set(value, read);
    return read;
  }

  const sourceOf = read => input.slice(read.span.start.offset, read.span.end.offset);

  // [QSLIT#closed]
  const asWritten = {
    of: value => sourceOf(reads.get(value)),
    stepOf: literal => sourceOf(reads.get(literal)),
    computesWithin: literal => reads.has(literal) && computingReadsOf(reads.get(literal)).length > 0
  };

  // [QSLIT#closed], [QSQUO#step]
  function computingReadsOf(read) {
    const computing = [];
    forEachPart(read, held => {
      if (!isComputingStep(held.value)) return partsOfALiteral(held.value).length > 0;
      computing.push(held);
      return false;
    });
    return computing;
  }

  // [QSQUO#step]
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

  function taken(content) {
    if (built.read !== undefined) return built.read;
    const read = part(built.value, built.parts);
    if (content !== undefined) read.content = content;
    return read;
  }

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

  function wordStepRead(word) {
    through(() => quoteOf([word.value], asWritten), () => word);
    return { read: word };
  }

  // [QSNAM#declare]
  function chainOf(head, tail) {
    const { value, parts } = pipelineOf('|', head, tail);
    return { value: groupOf(value), parts };
  }

  // [QSSYN#step]
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

  // [QSQUO#step], [QSERR#rest], [QSHST#tokens]
  function taggedRead(head, payload, at) {
    if (head.value.name === ERROR_TAG.name && isOfTheKindOfErrors(payload.value)) return Object.assign(part(payload.value, [head, ...payload.parts], at), { head: { ...head.span, end: (payload.head ?? head.span).end } });
    return Object.assign(part(constructOf(new Map([['tag', head.value], ['payload', payload.value]])), [payload], at), { head: head.span });
  }

  // [QSERR#rest]
  function errorRead(tag, entries, at = span()) {
    if (tag === null) return entriesRead(facts => errorAtRest(facts), entries, [], at);
    return taggedRead(tag, entriesRead(facts => errorAtRest(facts), entries, [], { ...at, start: tag.span.end }), at);
  }

  // [QSLIT#closed]
  function fromTheTag(head) {
    const { source, end } = range();
    return { source, start: head.span.start, end: pointOf(end) };
  }

  // [QSHST#tokens]
  function textRead(parts) {
    const { source, start } = range();
    return { ...proseJoined(parts), text: { source, start: pointOf(start), end: pointOf(start + text().trimEnd().length) } };
  }

  function backquotedRead(run) {
    const { source, start, end } = range();
    return new Backquoted(text(), { source, start: pointOf(start + run), end: pointOf(end - run) });
  }

  const docRead = ({ segments, text, backquoted }) => Object.assign(part(makeDoc(segments.map(segment => (typeof segment === 'string' ? segment : segment.value))), segments.filter(segment => typeof segment !== 'string')), { text, backquoted });

  // [QSLIT#json]
  function refuseMixedSpellings() {
    error('a map writes its keys one way, as keywords, `{:a 1 :b 2}`, or as the strings of JSON, `{"a": 1, "b": 2}`');
  }

  function refuseCombinatorSpacing(combinator) {
    error(`a combinator is set off by whitespace on both sides: write \` ${combinator} \``);
  }

  // [QSSYN#combinator]
  function refuseCombinatorAfterCombinator(first, second) {
    if (second === '|') error(`\`|\` written after \`${first}\` is the habit of a pipe before every step: write \`a ${first} b\``);
    error(`\`${second}\` written after \`${first}\`: a combinator stands once between two steps, write \`a ${second} b\``);
  }

  // [QSSYN#refusal]
  function refuseInfix(operator) {
    if (operator === '&&') error('`&&` is no operator of qlang: conditions of one value hold together by `allOf`, `allOf (gt 1) (lt 3)`');
    if (operator === '=>') error('`=>` is no operator of qlang: code is written bare where a verb takes it, the value it runs on `it`, `map (add 1)`');
    if (operator === '=') error('`=` is no operator of qlang: a name is declared by its keyword, `:x 1;`, and two values compare by `eq`, `eq 2`');
    const verb = { '*': 'mul', '+': 'add', '-': 'sub', '%': 'mod', '==': 'eq', '!=': 'ne', '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte' }[operator];
    error(`\`${operator}\` is no operator of qlang: a verb does its work on the value in the pipe, \`${verb} 2\``);
  }

  // [QSSYN#doc]
  let docsInASpan = 0;

  // [D404]
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

  function pathAlone(pipeline) {
    return pipeline !== null && pipeline.value.length === 1 && isPath(pipeline.value[0]) ? pipeline.parts[0] : null;
  }

  function refuseUnreadRegex(source, written) {
    const flags = canonicalFlags(written);
    if (flags === null) error(`a regex takes the flags ${[...REGEX_FLAGS].map(flag => '`' + flag + '`').join(', ')}, each once after its closing quote, \`#"error"i\``);
    const problem = regexProblem(source, flags);
    if (problem !== null) error(regexRefusal(source, flags, problem));
  }

  // [QSLIT#number]
  const leadsWithAZero = whole => whole.length > 1 && whole[0] === '0';
}

// [QSSYN#comment]
Query
  = _ p:Text _ { return p; }
  / _ { return part(quoteOf([], asWritten)); }

// [QSSYN#step]
Text
  = head:Declaration tail:(_ ";" _ @Declaration)* query:QueryAfterTheDeclarations
    &{ return accepted(() => textOf([head, ...tail], query)); }
    { return taken(); }
  / Pipeline

// [QSSYN#refusal]
QueryAfterTheDeclarations
  = _ ";" _ query:Pipeline { return query; }
  / _ ";" { return null; }
  / &(_ (!. / ")")) { return null; }
  / _ "!|" { error('a failure of a declaration is the failure of its text, which no `!|` of the text catches: a declaration ends with `;`, and a failure of the text is caught where the text is read, `~(…) | answer !| …`'); }
  / _ &("|" !"~") "|" { error('a declaration ends with `;`, which joins it to the query after it: write `:name body; query`'); }
  / _ &. { error('a declaration ends with `;` before what follows it: write `:name body; …`'); }

// [QSSYN#step]
DeclarationInTheQuery
  = &Declaration Declaration
    { error('a declaration stands at the head of its text, before the query, each ended by `;`: write `:x 1; [1 2] | x`'); }

Pipeline
  = leadingComb:(LeadingCombinator __)? head:PipelineHead tail:ContinuationUnit*
    &{ return accepted(() => pipelineOf(leadingComb === null ? '|' : leadingComb[0], head, tail)); }
    { return taken(); }
  / &(LeadingCombinator __ Combinator) first:LeadingCombinator __ second:Combinator
    { refuseCombinatorAfterCombinator(first, second); }
  / c:LeadingCombinator _ !. &{ options.stepMissed = c; return false; }

// [QSSYN#combinator]
LeadingCombinator
  = "!|" / "|" &(__ "!|") __ "!|" { return '!|'; } / "|" !"~" { return '|'; }

Combinator
  = "!|" { return '!|'; }
  / "|" !"~" { return '|'; }

PipelineHead
  = PipelineStep
  / &(LeadingCombinator NonSpace) c:LeadingCombinator { refuseCombinatorSpacing(c); }

// [QSNAM#address], [QSSYN#step]
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

// [QSSYN#refusal]
StepMissedAtTheEnd
  = __ c:(PipedCombinator / Combinator) _ !. &{ options.stepMissed = c; return false; }

// [QSSYN#refusal]
InfixOperator
  = $("==" / "!=" / "<=" / ">=" / "&&" / "=>" / [*+%<>=])
  / @"-" &[ \t\r\n]

// [QSERR#catch]
PipedCombinator
  = "|" __ "!|" { return '!|'; }

// [QSSYN#combinator]
SpacingRefusal
  = ( _ &"|~" "|~" { error('`|~` opens a comment that is never closed; code runs on the value in the pipe by a verb, `| apply (…)`'); }
    / _ &InfixOperator operator:InfixOperator { refuseInfix(operator); }
    / _ &(Combinator _ [)\]}]) c:Combinator { error(`\`${c}\` joins two steps, and the step after it is missing`, lastOf(c.length)); }
    / __ &(PipedCombinator __ Combinator) PipedCombinator __ second:Combinator { refuseCombinatorAfterCombinator('!|', second); }
    / __ !PipedCombinator &(Combinator __ Combinator) first:Combinator __ second:Combinator { refuseCombinatorAfterCombinator(first, second); }
    / &Combinator c:Combinator { refuseCombinatorSpacing(c); }
    / __ &(Combinator NonSpace) c:Combinator { refuseCombinatorSpacing(c); }
    / &(!"/" Word) Word { error('words are set off by whitespace; only a first modifier that opens with a parenthesis may touch the name of its command, `f(a) (b)`'); }
    / _ &"," "," { error('modifiers are separated by spaces, not by commas: `f a b`', lastOf(1)); }
    / _ &";" ";" { error('`;` ends a declaration, and a text holds one query after its declarations: steps are joined by `|`, and one query asks several things by a template, `get [(…) (…)]`', lastOf(1)); }
    / _h1 &Word { error('steps are joined by `|`: write `a | b`', after()); }
    / __ &Word { error('steps are joined by `|`, at the end of a line or at the start of the next: a line break is a space', after()); }
    )

PipelineStep
  = DocStep
  / DeclarationInTheQuery
  / TagDeclarationRefusal
  / Step

// [QSSYN#doc]
DocStep
  = head:DocLit tail:(&(_ DocOpen) _ @DocLit)* declared:(_ &Declaration)?
    {
      if (declared !== null) error('a doc stands in the slot of the declaration it documents: write `:name |~~ … ~~| body`');
      if (tail.length > 0) error('a doc is a value, which stands at the head or where a verb takes it; a note inside a pipeline is a comment, `|~ … ~|`', openerOf(tail[0]));
      return head;
    }

DocBeforeDeclaration
  = &(DocLit (_ DocLit)* _ Declaration) DocLit (_ DocLit)* _
    { error('a doc stands in the slot of the declaration it documents: write `:name |~~ … ~~| body`'); }

DocAfterStep
  = &DocOpen DocOpen
    { error('a doc is a value, which stands at the head or where a verb takes it; a note inside a pipeline is a comment, `|~ … ~|`'); }

DocOpen
  = LineDocOpen / BlockDocOpen

Comment
  = LineComment
  / BlockComment

LineComment
  = "|~|" content:LineCommentContent
  { recordComment('LineComment', content); }

BlockComment
  = "|~" ![|~] content:BlockCommentContent "~|"
  { recordComment('BlockComment', content); }

LineCommentContent
  = chars:[^\n]* { return chars.join(''); }

QuoteSpan
  = "~(" content:QuoteContent ")"
    { return '~(' + content + ')'; }

// [D404], [QSSYN#refusal]
NestedLineDocSpan
  = "|~~|"
    { return text(); }
NestedLineCommentSpan
  = "|~|"
    { return text(); }
NestedBlockDocSpan
  = &{ return !knownToFail(nestedDocFailures); } "|~~" !"|" BlockDocContent "~~|"
    { keepNestedBlock(); return text(); }
  / &{ return failedHere(nestedDocFailures); } "|~~"
NestedBlockCommentSpan
  = &{ return !knownToFail(nestedCommentFailures); } "|~" ![|~] BlockCommentContent "~|"
    { keepNestedBlock(); return text(); }
  / &{ return failedHere(nestedCommentFailures); } "|~"

BlockCommentContent
  = chars:(
      QuoteSpan
      / NestedLineDocSpan
      / NestedLineCommentSpan
      / NestedBlockDocSpan
      / NestedBlockCommentSpan
      / "~~|"
      / (!"~|" .)
    )*
    { return chars.map(c => typeof c === 'string' ? c : c[1]).join(''); }

BlockDocContent
  = chars:(
      QuoteSpan
      / NestedLineDocSpan
      / NestedLineCommentSpan
      / NestedBlockDocSpan
      / NestedBlockCommentSpan
      / "~|"
      / (!"~~|" .)
    )*
    { return chars.map(c => typeof c === 'string' ? c : c[1]).join(''); }

Step
  = Command
  / PathBeforeWord
  / word:Word &{ return accepted(() => wordStepRead(word)); } { return taken(); }
  / DocLit
  / DotStepRefusal

// [QSSYN#step]
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

PathBeforeWord
  = "/" name:KeywordName &(_h1 !Combinator !"!|" Word) _h1 next:$Word
    { error(`\`/${name}\` is a path, a value: a part is read by \`get\`, \`get /${name} | ${next}\`, and a verb is called by its name alone, \`${name} ${next}\``); }
  / path:$("/" KeySegment)+ &(_h1 !Combinator !"!|" Word) _h1 next:$Word
    { error(`\`${path}\` is a path, a value: a part is read by \`get\`, \`get ${path} | ${next}\``); }

// [QSSYN#line]
Command
  = callName:CallName touching:(&"(" @ModifierWord)? rest:(__ @ModifierWord)*
    &{
      const modifiers = touching === null ? rest : [touching, ...rest];
      const declared = modifiers.findIndex((modifier, at) => at > 0 && isKeyword(modifier.value) && modifiers[at + 1] !== undefined && isDoc(modifiers[at + 1].value));
      if (declared !== -1) error(`a declaration after a chain begins after the \`;\` that ends the chain: write \`…;\` before \`${sourceOf(modifiers[declared])}\``, modifiers[declared].span);
      return accepted(() => ({ value: through(() => callOf(callFieldsOf(callName, modifiers), asWritten), facts => modifiers[facts.index]), parts: modifiers }));
    }
    { return taken(); }

// [QSNAM#address], [QSSYN#line], [D404]
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

// [QSNAM#declare]
DeclarationBody
  = Chain
  / Step

Chain
  = head:TagLit tail:ChainStep+
    &{ return accepted(() => chainOf(head, tail)); }
    { return taken(); }

ChainStep
  = __ "|" !"~" __ step:Command { return { combinator: '|', step }; }

// [QSLIT#closed]

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

// [QSSYN#doc]
Element
  = Word
  / DocLit

ModifierWord
  = Element
  / DotModifierRefusal

Name
  = callName:CallName
    { return part(callOf(callFieldsOf(callName, []), asWritten)); }

// [QSDSP#walk]
CallName
  = head:CallNameHead tail:("/" @KeywordName)*
    { return [head, ...tail].join('/'); }

// [QSLIT#closed], [QSERR#rest], [D404]
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

// [QSLIT#kind]
TagName
  = NamespacedName

// [D404]
ParenGroup
  = "(" &{ return !knownToFail(groupFailures); } _ p:Text _ ")"
    {
      const read = part(groupOf(p.value), p.parts);
      read.content = p.span;
      return read;
    }
  / "(" &{ return failedHere(groupFailures); }

// [QSSYN#step], [D404]
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

QuoteContent
  = parts:QuotePart* { return parts.join(''); }

QuotePart
  = NestedParenSpan
  / QuoteStringSpan
  / QuoteBlockDocSpan
  / QuoteBlockCommentSpan
  / QuoteLineDocSpan
  / QuoteLineCommentSpan
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

QuoteBlockCommentSpan
  = "|~" !"~" !"|" QuoteBlockCommentChar* "~|" { return text(); }

QuoteBlockCommentChar
  = !"~|" QuoteSpanChar

QuoteLineDocSpan
  = "|~~|" ProseOfALine* { return text(); }

QuoteLineCommentSpan
  = "|~|" ProseOfALine* { return text(); }

QuoteChar
  = ![()] @QuoteSpanChar

QuoteSpanChar
  = .

// [QSQUO#literal], [QSSYN#doc], [QSSYN#refusal]
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

LineDocEnd
  = "\r\n" / "\n" / !.

BlockDocText
  = parts:BlockDocPart* { return textRead(parts); }

// [QSSYN#doc]
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
  / NestedLineCommentSpan
  / NestedBlockDocSpan
  / NestedBlockCommentSpan
  / "~|"
  / !"~~|" !DocQuoteOpens c:. { return c; }

// [QSSYN#refusal]
ProseRunOfALine "character of prose"
  = [^~`:\r\n]+

ProseOfALine "character of prose"
  = [^\r\n]
  / @"\r" !"\n"

ProseRunOfABlock "character of prose"
  = [^~`:|]+

ProseOfABlock "character of prose"
  = [^`]

// [QSSYN#doc]
DocInASpan "character of prose"
  = "|~~|"
  / "|~~" &{ docsInASpan += 1; return true; }
  / "~~|" &{ return docsInASpan > 0; } &{ docsInASpan -= 1; return true; }

ProseOfAString "character of prose"
  = !["\\] @QuoteSpanChar

// [QSSLF#doc], [QSHST#tokens]
DocQuote
  = tags:DocQuoteTag* quote:QuoteLit
    { return tags.length === 0 ? quote : Object.assign(part(tags.reduceRight((inner, tagName) => makeTagged(makeTag(tagName), inner), quote.value), [quote]), { head: { ...span(), end: quote.span.start } }); }

// [QSSYN#doc]
DocQuoteOpens
  = DocQuoteTag* "~("

DocQuoteTag
  = "::" @TagName

// [QSERR#rest]
ErrorLit
  = entries:ErrorBraces
    { return errorRead(null, entries); }

ErrorBraces
  = "!{" _ "}"
    { return []; }
  / "!{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ "}"
    { return [head, ...tail]; }

// [QSLIT#json], [QSLIT#closed]
MapLit
  = "{" _ head:JsonMapEntry tail:(_ "," _ @JsonMapEntry)* _ ("}" / &(("," _)? Keyword) { refuseMixedSpellings(); })
    { return entriesRead(map => map, [head, ...tail]); }
  / "{" _ head:QlangMapEntry tail:(LiteralGap @QlangMapEntry)* _ ("}" / &(("," _)? StringLit _ ":") { refuseMixedSpellings(); } / &(!Keyword Element) { error('a map entry holds one literal, `{:k 1}`, and a shape computed is built by `get`: `get {:k (f x)}`'); })
    { return entriesRead(map => map, [head, ...tail]); }
  / "{" _ "}"
    { return part(new Map()); }

JsonMapEntry
  = key:StringLit _ ":" _ value:Element
    { return { key: part(makeKeyword(key.value), [], key.span), value }; }

QlangMapEntry
  = key:Keyword __ value:Element
    { return { key, value }; }

// [QSTXT#regex]
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

// [QSSYN#refusal]
SetLit
  = "#[" _ "]"
    { return part(makeSet([])); }
  / &"#{" "#{"
    { error('a set is written `#[…]`, the vector in the one order without duplicates; `{…}` is a map'); }
  / "#[" _ elements:ElementList _ "]"
    { return part(makeSet(elements.map(element => element.value)), elements); }

VecLit
  = "[" _ head:Element tail:((_ "," _ @Element)+ / (LiteralGap @Element)*) _ "]"
    { return part(Object.freeze([head, ...tail].map(element => element.value)), [head, ...tail]); }
  / "[" _ "]"
    { return part(Object.freeze([])); }

ElementList
  = head:Element tail:(LiteralGap @Element)*
    { return [head, ...tail]; }

LiteralGap
  = __
  / &(!"/" Element) Element { error('the elements of a literal are set off by whitespace: `[1 2]`'); }

// [QSPTH#value], [QSSYN#step]
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
  = chars:NameLetter+ { return chars.join(''); }

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

// [QSLIT#number]
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
  = "true"  !NameLetter { return part(true); }
  / "false" !NameLetter { return part(false); }

NullLit
  = "null" !NameLetter { return part(null); }

// [QSLIT#keyword]
Keyword
  = ":" name:QuotedKeywordName  { return part(makeKeyword(name)); }
  / ":" name:NamespacedName     { return part(makeKeyword(name)); }

// [QSNAM#address]
NamespacedName
  = head:KeywordName tail:("/" @KeywordName)*
    { return [head, ...tail].join('/'); }

QuotedKeywordName
  = '"' chars:DoubleStringChar* '"' { return chars.join(''); }

KeywordName
  = first:NameStart rest:NameLetter*
    { return first + rest.join(''); }

CallNameHead
  = !ReservedWord first:NameStart rest:NameLetter*
    { return first + rest.join(''); }

ReservedWord
  = ("true" / "false" / "null") !NameLetter

// [QSNAM#letters]
NameStart "name"
  = c:$([\uD800-\uDBFF] [\uDC00-\uDFFF] / .) &{ return isNameStart(c); } { return c; }
NameLetter  "letters of a name"
  = c:$([\uD800-\uDBFF] [\uDC00-\uDFFF] / .) &{ return isNameContinue(c); } { return c; }

// [QSSYN#line], [QSSYN#comment]

_   = Whitespace*
__  = Whitespace+
_h1 = InlineSpace+

Whitespace "whitespace" = [ \t\n\r] / &"|" @Comment

InlineSpace "whitespace" = [ \t] / &"|" @Comment

NonSpace = [^ \t\n\r]
