// The retired terms of the chain, of the slot of a kind, of the node an
// axis reads, of the trace a failure leaves, of a refusal, of the boundary
// of a host, of the read of text into code and back, of the elision, of the
// template, of the read of a print and of the shape of a value, each held
// by the lexicon of retired terms as one regex of its one sense, which
// refuses the term where it is written, in prose, a name of the code or the
// name of a case, and leaves the words of another sense, and the generic
// words the texts that state what holds write in no sense, which it refuses
// whole [QSWRK#documents].

import { describe, it, expect } from 'vitest';
import { RETIRED_WORDS } from '../../../scripts/retired-words.mjs';

const refused = text => RETIRED_WORDS.some(({ regex }) => regex.test(text));

describe('the lexicon of retired terms [QSWRK#documents]', () => {
  it('refuses each retired term of the chain, of the slot of a kind and of the node where it is written', () => {
    for (const text of [
      'a-name-of-a-signature-declared-twice-is-refused', 'the signature of a function', 'readSignature', 'readKindSignature',
      'EMPTY_SIGNATURE', 'core/src/runtime/signature.mjs',
      'a-kind-takes-no-recipe-but-the-hosts', 'the-recipe-of-a-kind-command-is-the-check-of-a-host',
      'a-reader-kind-with-the-check-of-its-host-lays-its-tag', 'the check its host hands a kind of the core', 'a kind of no recipe keeps its tag',
      'a-path-of-anchors-reads-an-input-of-a-verb-under-a-label', 'the membership a set answers',
      'reads the member of the subject', 'a member a value lacks names the verbs near', 'a concept is a member of the root noun',
      'a-member-a-value-lacks-names-the-verbs-near', 'a-member-of-a-noun-stays-out-of-the-scope', 'the-chapters-are-members-of-the-topic-of-the-language',
      'a-kind-of-no-recipe-keeps-its-tag-after-sort', 'the check of a kind',
      'callMemberOn', 'isMemberValue', 'nearestMembers', 'memberRecordOf', 'memberRefusalOf', 'recordAlongPath'
    ]) expect(refused(text), text).toBe(true);
  });

  it('refuses each retired term of the trace, of the step that failed and of the evaluation depth where it is written [QSWRK#documents]', () => {
    for (const text of [
      'the trail of a failure', 'Trails are read by trail', '`:trail` among the facts', '`::trail[]`', '`!| get /trail/1/0`',
      'core/src/eval-trail.mjs', 'a-raised-error-holds-its-trail', 'quote-with-leading-combinator-trail-style',
      'makeTrail', 'isTrail', 'withTrail', 'resumingItsTrail', 'TRAIL_TAG', 'RESUMING_THEIR_TRAIL',
      '::error/TrailNotFramesError', 'ErrorTrailNotFramesError',
      '::frame/step', '!| trail | map ~step', 'trace | first | step', 'trace-of-a-frame-read-by-map-~step',
      'the step that broke', 'the steps from the one that broke', 'the element its code broke on', 'its predicate broke at',
      'the-frame-of-map-names-the-index-of-the-element-its-code-broke-on', 'the-frame-of-sort-names-the-index-its-key-broke-at',
      'the reducer that broke', 'its reducer broke on the element', 'the key that broke', 'brokeAt',
      'frameBelow', 'the budget of frames', 'one frame below the call', 'a-modifier-of-an-atom-meets-the-budget-a-frame-below-its-call',
      'the frames of a runaway meet a budget', 'one more nested frame of evaluation', 'the frames one evaluation may nest',
      'the evaluation depth budget', 'a location set by a deeper frame', 'the deepest frame nestState admits', 'the refused frame',
      'a-quote-written-as-a-modifier-runs-no-frame',
      '`subject`, `step`, `skipped` and `place`, verbs of `::frame`, read a frame', '`::frame["x" ~(add 1 | mul 2)] | step` answering `~(add 1)`',
      '`step` reads a frame, which the trace of a failure holds', 'the element the code of `map` broke on',
      'The frame the budget refused.', 'itself without end, is refused on the frame past it', 'the frame past the budget refuses',
      'depth of the frames nested under the query', 'meet the budget of frames one below',
      'rootState opens depth 0; withPipeValue and withEnv stay on the frame', 'nestState descends one frame with the inner pair',
      'nestState admits the frame at EVAL_DEPTH_LIMIT', 'Each call runs a frame: an input',
      '`add 1`, which broke on `"x"`', '`map`, which broke where its code ran', '`mul 2`, which broke on',
      'the path of the part, where it broke, null where it ran it on no part', 'that broke, the first broken and the rest left unrun',
      'an input read from its place meets the budget', 'a read with no state meets the budget by it alone.',
      'leaves the budget intact for recursion that terminates', 'the frames of the evaluator', 'the budget of the evaluator',
      'QSERR#trail', 'Trail of a failure', 'the trails of two failures', 'makeTrails', 'theTrailEnd', 'TRAILS_KEY', 'KEY_TRAILS'
    ]) expect(refused(text), text).toBe(true);
  });

  it('refuses a frame for the scope of a source where it is written [QSWRK#documents]', () => {
    for (const text of ['no frame of its source before them', 'each source a cell run in a frame over the root', 'the frames of the sources']) {
      expect(refused(text), text).toBe(true);
    }
  });

  it('leaves the words of another sense, the help of the language server and the series of the benchmark among them', () => {
    for (const text of [
      'signature help', 'signatureHelpAtOffset', 'SignatureInformation', 'activeSignature', 'deliberately wide signatures',
      'a member of a series', 'the members of each series past its two latest', 'the recipe of a verb',
      'the check of the conventions', 'the check of the chapters', 'answers a bare out-of-range magnitude with an empty path'
    ]) expect(refused(text), text).toBe(false);
  });

  it('leaves the words of another sense beside the trace: a frame of a trace, the budget of a print, and a case, a law, a tag and a stream that broke [QSWRK#documents]', () => {
    for (const text of [
      'a frame of the trace holds the subject its step met', 'the frame of `map`', 'a frame a line', 'the frame of its step',
      'trim_trailing_whitespace', 'a trailing newline', 'trailing-separator-leaves-empty', 'Trailing',
      'the step that failed', 'failedAt', 'a reader\'s own verb `:number/step`', 'reduce 0 ~(step)', '!| step',
      'tell a repair from a case that broke', 'a broken case', 'the tag that broke it its `:actualValue`',
      'stream broke', 'a law broke', 'a quote left broken in a page', 'breaks an invariant',
      'a law broke at the edges of its literals', 'the stream broke on a bad byte', 'whether a repair moved it or the case broke',
      'the stream which broke on a bad byte', 'a law which broke at the edges of its literals',
      'the case `a-doc-is-no-trace` broke on the tree', 'the stream, where it broke, names its byte',
      'depthBelow', 'one deeper in the evaluation depth', 'a stack frame reads', 'a synchronized frame',
      'the budget of a print', 'elide within a budget', 'an answer whose print fits the budget stays whole',
      'an answer whose print meets the budget stays whole', 'the print leaves the budget intact',
      'the frame of a trace', 'the scope of a source', 'the subject of every frame past the first',
      'the frames nested under the frame of `map`', 'the frame below it in the print',
      'the frame of `map` stands a frame below the frame of `count` in the print', 'the frame of the raise lies one frame below the catch',
      'the frames one below another print a frame a line', 'the deepest frame of a trace is its first',
      'the steps a failure skips stay on the frame of the step that failed', 'the key that broke the order', 'the code that broke it',
      'the Nissan XTrail', 'a makeTrailer helper', 'a TRAILER of a print'
    ]) expect(refused(text), text).toBe(false);
  });

  it('refuses each retired term of a refusal, of a conversion, of an empty subject and of the error a catch holds where it is written [QSWRK#documents]', () => {
    for (const text of [
      '::keyword/toTag/NameNotNameError', '::string/toTag/TextNotNameError', 'KeywordToTagNameNotNameError', 'StringToTagTextNotNameError', ':NameNotNameError/refusesASpace',
      '::vec/toPath/EmptyError', 'VecToPathEmptyError', ':EmptyError/refusesTheEmptyVector',
      ':KindAnswersNoVerbError/namesTheReadOfAPath', 'an-input-given-a-path-names-its-read', 'a-name-called-on-a-path-names-its-read', ':read/namesAWrittenPathAlone',
      'A path given for the multiplier names the read of its field.', 'withReadOfPath', 'readOfPathSubject', 'readOfRefusedPath',
      'The read a step was likely meant for where a path stands', 'naming as `:read` the read the call was likely meant for',
      'The source does not read as qlang: `:marker` points where the reading stopped', 'carries :ParseError/marker', '"#{1}" | parse !| get [~(keys) /marker]',
      ':source "[1 2" :marker "    ^"', 'excerptAroundLocation',
      ':"identifier start (letter or underscore)"', ':"identifier continue (letter, digit, hyphen, underscore)"', '[:char-class]', ':end-of-input',
      'A peggy char-class reads as `:char-class`', 'classKeyword', 'findIdentifierOccurrences',
      'an-opened-error-raised-again-is-the-error', 'an-error-a-catch-opened-from-an-empty-written-trace-raised-again-is-itself',
      ':readsAnErrorOnceOpened', ':raisesAnOpenedErrorAsItself', ':asksAnOpenedFailure', 'An opened error is a value of `::error` and of its refusal.',
      'that raised it to the `!|` that opened it', 'an error a catch opened, raised again, is itself', 'An error opened by a catch and raised again is the error it was.',
      '`!|` opened the page of the refusal it carries', 'answers the refusal of the kind, which the catch opens', 'an opened error\'s among them', 'a failure opened by the catch',
      ':opensAFailureToItsFacts', '`!|` opens a failure to its facts.', 'a host prints it as the error at rest `!|` opens it to',
      'the-error-literal-under-the-tag-of-a-kind-opens-to-a-value-that-prints', 'the-refusal-of-a-doc-s-quote-opens-to-a-value-that-prints'
    ]) expect(refused(text), text).toBe(true);
  });

  it('refuses the position of an element named as a place where it is written [QSWRK#documents]', () => {
    for (const text of [
      'get-refuses-a-place-past-the-end', 'A vector grows by `append`, not by a place past its end.', 'A negative place past the start is refused as it was written.',
      '`/-1`, a negative place counting from the end', ':readsTuplesPlaceByPlace', 'a vector key place by place', 'two tuples of one length place by place',
      'segments-answers-the-keys-and-places-of-a-path', 'Answers the keys and places of the path', 'a vector of keys and places becomes',
      'a-doc-is-read-by-places-as-a-vector-is', 'a-quote-a-function-and-a-kind-read-by-place', 'A vector is read by a place, not a field.', 'A set reads by place as its vector does',
      'a-path-reads-a-step-of-a-quote-by-its-place', 'a-condition-of-cond-is-named-by-its-place-from-zero', 'its elements read by their places', 'the groups by their places',
      'Its elements are read by their place from zero, `get /0`',
      'desc-turns-one-place-of-a-vector-key-to-descend', 'A place of a vector key descends alone', 'so `/0` reads the place of a vector', '`desc` reverses a place of it',
      'turns its own place alone', 'a vector\'s own places are its', 'shape-reads-vectors-of-one-length-whose-places-part-as-tuples',
      'one that answers another kind is refused at its place', 'an-anchor-of-a-set-that-is-no-keyword-is-refused-at-its-place-in-the-set', 'its place in the set its `:index`',
      'A vector key ranks by its first place.', 'a-vector-key-ranks-by-its-next-place-among-ties', 'A vector key breaks the ties of its first place by its next.', 'A first place of `eq null` puts null last.',
      'call is computed at every place, the first among them', 'the shape of each place across them', 'where every place holds one shape', 'so a path of the data through a place reads it',
      'query-answers-null-for-a-missing-place', 'a key or a place missing on the way', 'or a place that is not there is refused', 'where it missed, the key or the place',
      'Each element is a key, a keyword or a string, or a place', 'put-replaces-a-place-a-vector-holds', 'delete-takes-a-place-out', 'A place is taken out of a vector',
      'a key taken out of a map, or a place out of a vector', 'a-quoted-digit-is-the-segment-a-place-is', 'a-path-reads-a-key-then-a-place-then-a-key',
      'a-path-reads-a-place-from-the-end-between-two-keys', 'a-path-reads-a-place-then-a-key', 'A key answers its keyword and a place its number.',
      'shape-keeps-the-places-of-two-tuples-that-part', 'the place in the args, from zero, of the predicate', '`:index` naming a place in its one order', 'a place in the one order, which a key names none of',
      'a-place-of-a-key-that-fails-answers-the-call', 'An element of one place is no pair', 'An element of three places is no pair either.', 'Vectors of one length, two places or more',
      'a key that ranks by several places', 'a place as its number and a key as its keyword', 'a place as a whole number', 'a segment that names no place', 'The segment the path read, which names no place.',
      'a key names no place of a set', 'A fraction is no place, and is refused at its index.', 'a place within a place among', 'A place reads within a vector or a set', 'A place reads the key of a map that spells it.',
      'a shape for each place', 'equal images each in its place', 'the vector of its text and then each group in its place', 'The place of the element refused, counted from zero.',
      '`:index` the place of an element in its one order', '`:index` holds the place read', 'The place the path read, counted from the end when negative.',
      'The index a set is refused at is the place in its one order', 'the place a segment names', 'the keys near it, or the place and the length',
      'and the places to it', 'The key an atom\'s place is read by', 'each segment a key of a map or a place of', 'and `desc` turns the key, or one place of it, to descend',
      'data, its first place missing there', 'as the place its digits name', 'a place past either end', 'which a map reads as a key and a vector as a place',
      'the first place first', 'each later one among the elements the places before it rank alike', 'a number on a value read by place',
      'A frame is read by the verbs written over its places', 'The elements beside the fact that names the place of each in a refusal',
      'the-frame-of-map-over-a-set-names-the-place-in-its-order',
      ':ranksByTheFirstPlace', ':breaksTiesByTheNextPlace', ':answersTheErrorOfAPlace', ':replacesAPlace', ':turnsOnePlaceOfAVectorKey', ':readsTheKeyOfAMapByThePlace',
      ':answersKeysAndPlaces', ':namesThePlaceInTheOneOrderOfASet', ':refusesAPatternOfPlacesAlone', ':refusesAFieldMissingAtTheFirstPlace', ':takesAPlaceOut',
      ':IndexOutOfBoundsError/refusesAPlacePastTheEnd', ':IndexOutOfBoundsError/refusesAPlaceBeforeTheStart', 'placeIn', 'mergedPlaces', 'placeKey'
    ]) expect(refused(text), text).toBe(true);
  });

  it('leaves the words of another sense beside a refusal: the place of the args, of a frame, of a payload and of a text, the read of an elision, a bracket opened and the end of the source [QSWRK#documents]', () => {
    for (const text of [
      'The place of the args the input reads, a path or a quote.', 'An input whose place the args leave out is refused.', 'A place read by `query` gives a default.',
      'a modifier that failed is refused by its place', 'The input `multiplier` reads the first place of the args', 'How many places the inputs of the verb read', 'Args past the places its inputs read are refused.',
      '`place` reads a frame, which the trace of a failure holds', 'The frame of `map` holds the place of the element its code failed on', 'The subject of the frame reads the part by its place.',
      'the-frame-of-a-step-that-ran-no-code-on-a-part-names-no-place', 'The place of the payload the field reads, a path or a quote.',
      'A point is a place in source text', 'the place where a reading stopped', 'a caret under the place its `:location` names', 'scan-meets-an-empty-match-at-every-place', 'an empty match met at every place',
      'is declared under the noun of its place', '`coalesce` puts a fallback in the place of null.', 'A sum subtracted is computed in its place.', 'the text that takes the place of each match',
      'where a path stands in the place of the value it names', 'Two digits keep two places after the point.', 'Any value, its place in the one order turned around.',
      'saves the draft of the place it leaves and loads the next place\'s', 'a key written twice standing in its first place with its last value', 'the values change nothing in place',
      '`:read` continues the query to it, `!| get /trace/1/0`', 'an ::elision whose :read continues the query', 'the-read-of-an-elision-answers-what-it-left-out', 'elide 10 | last | get /read',
      'the elision of a text', 'the read of a part before a word', 'answers the refusal of its read', 'an-input-given-a-path-names-its-repair', ':repair/namesAWrittenPathAlone',
      '`[` opened at line 1, column 1 is never closed', 'an-unclosed-bracket-names-where-it-opened', 'closes a span at a run of as many backquotes as opened it',
      'the scope a call opens', '`open` runs a quote, a link or a snippet', 'the error at rest a catch holds', ':raisesAnErrorAtRestAsItself',
      '::keyword/toNumber/NameNotNumberError', '::keyword/toTag/NameNotTagError', '::vec/toPath/SubjectEmptyError', ':SubjectEmptyError/refusesTheEmptyVector', ':numbers/EmptyError/refusesNoNumber',
      'a valid identifier', 'IdentStart', ':any-character', ':end-of-source', ':"letters of a name"', 'findNameOccurrences', 'a character class of a regex',
      'the args of the call, which the inputs of its function read by their places', 'its inputs read from the args by their places',
      'its own place read through the field again', 'a link opens to the answer of its query', 'a value turned by `desc` opens to the value it turned',
      'a leading `!|` opens a step of the fail track', 'A link opens to a value its query answers',
      'an-error-literal-a-kind-refuses-is-caught-at-rest-as-a-value-that-prints', 'the-frame-of-map-over-a-set-names-the-index-in-its-one-order'
    ]) expect(refused(text), text).toBe(false);
  });

  it('refuses each retired term of the boundary of a host where it is written [QSWRK#documents]', () => {
    for (const text of [
      'A source is `{ uri, source, impls? }`', 'the `impls` of its sources', 'Object.keys(cliSource.impls)', 'const impls = {};', 'impls: {}',
      '`impls?` names what a source hands', 'the source { uri, source, impls } a host hands',
      'a failure of a host\'s implementation', 'A failure of the host\'s implementation: an error', 'the implementation its host handed.',
      'runs the implementation the host handed beside the source', 'runs a host name through the implementation handed beside its source',
      'no implementation is handed for any/hello', 'Two modules of the runtime bound an implementation under one address',
      'a module of the runtime binds its implementations as it loads', 'The table of the language\'s implementations is sealed',
      'the answers of its implementations', 'an implementation of a host that fails in a call', 'A JavaScript error escaping an implementation',
      'The implementations of the language by the address of the verb', 'The implementations under a noun, by address',
      'Each module binds the implementations of the language\'s verbs', 'which alone reaches an implementation',
      'The descriptor of an implementation a host hands', 'refuses it by the implementation a host hands beside its source',
      'each implementation is a plain function over the subject', 'Each implementation is bound under the address of the verb',
      'A host verb whose implementation throws a raw Error',
      'the implementations stay readable after seal', 'hands a source of the language the implementations under its noun',
      'refuses an implementation handed for a verb of steps', 'hostImplOf', 'HOST_IMPLS', 'declareHostValue', 'isHostDeclared',
      'bindPrim', 'bindStateReader', 'bindReaderOfPassedTags', 'implsUnder', 'The idiom: `export const add = PRIMITIVE_REGISTRY.bind(key, impl);`',
      'the refusals of the kernel no reader reaches by a query', 'The kernel is the evaluator with its table of primitives',
      '::builtin/ImplementationNotHandedError', 'BuiltinImplementationNotHandedError', '::builtin/ImplementationNamesNoBuiltinError',
      '::builtin/AddressBoundTwiceError', 'BuiltinAddressBoundTwiceError',
      'typeOf answers `::unknown` for a raw object', 'UNKNOWN_KIND', '"<host-fn helloFn>"', 'printFallback', 'toPlainFallback',
      '::builtin/JsonValueNotEncodableError', '::builtin/NumberNotFiniteLeakedToPrintError', 'finiteNumberOrLift',
      'The error carries `:host`, `:logicalName` and `:sourceLocation`', 'logicalName', 'The platform resolved a `#qlang/<ns>` logical name to a path',
      '`:uri` names the source', '"add (" | parse !| get /uri', 'carries :ParseError/uri', 'the :uri of parse', 'get /:uri',
      'envAfterCell', 'session.env', 'sessionInstance.env', '`createSession({ env?, sources? })` answers a session',
      'installs a value under a name; `env` is the current scope.', 'a session keeps the current env', 'the initial env of a session', 'the env Map a cell writes',
      'session.bind', 'sessionInstance.bind', '`bind(name, value)` installs a value under a name', 'null for a value a host bound',
      'A value a host binds is a binding without a page or a source.', 'A host binds a value as a binding without a doc',
      'a function a host bound in the environment prints as a string', 'a failure a host binds as the value of a name', 'The host-bound tally counts the depths',
      'highlightAnsi(src, builtinNames)', 'const noBuiltins = new Set();', 'With no builtin names supplied', 'returns more than 60 builtin completions',
      'makeIoImpls', 'formatImpls',
      'a module binding its implementations as it loads', 'the host hands the implementations beside its source', 'a host handed an implementation for it',
      'Two modules bound an implementation', 'a descriptor that binds no implementation', 'it binds the implementations once', 'the modules bind their implementations',
      'the verb runs by its host\'s implementation', 'the implementations of the language\'s verbs are registered', 'an implementation is a plain closure over the subject',
      'the implementations under one address', 'the implementation under an address', 'the implementations under its noun', 'an implementation handed beside its source',
      'the implementations of the host', 'the implementation of its host', 'the implementation a host hands', 'the implementation its host hands', 'the answers of the implementations',
      'each a plain function over the value the walk served', 'Their primitives are plain functions over the served subject',
      'Expression language for transforming immutable values through pipelines.', 'qlang — pipeline expression language',
      'PEG grammar for the qlang expression language.'
    ]) expect(refused(text), text).toBe(true);
  });

  it('leaves the words of another sense beside the boundary of a host: the code of the language, the command impl and its plural, a builtin and its plural, the environment, a plain value, the host\'s uri and the codec of JSON [QSWRK#documents]', () => {
    for (const text of [
      'Reference implementation of the qlang pipeline query language', 'its reference implementation lives in the repository',
      'the one key the implementation and its page in the catalog share', 'implementation spells a target it met',
      'with the pages of the catalog and with the implementation', 'the implementation lines that spell a target', 'an implementation or a design finding',
      '`impl` gives a function its recipe', 'the command `impl`', '| impl ::builtin{}', '::fn/impl', 'a primitive of the host',
      'the primitives a host hands beside its source', '`{ uri, source, primitives }`', 'registerPrimitive', 'PRIMITIVE_REGISTRY.register',
      'the runtime, the evaluator with its table of primitives', '::builtin/PrimitiveNotHandedError', '::builtin/AddressRegisteredTwiceError',
      'process.env', 'the environment Node gives the process', '`env | keys` lists the names a query declared', 'state.env', 'envSet', 'withEnv',
      'core/src/env-keys.mjs', 'session.scope', 'scopeAfterCell', '`createSession({ scope?, sources? })`',
      'a plain map', '`{:a 1}` a plain map beside `::Box{:a 1}`', 'a plain vector of what each answered', 'plain Enter (CR), which submits',
      'plain text world', 'evalOpts.uri', 'uri: cellUri', 'parse(source, { uri })', 'the host\'s field `uri`', 'fileUri', 'textDocument.uri',
      'toPlain', 'fromPlain', '::call/UnknownNameError', '::unknownTag', 'an unknown AST node type', '::bind', '::binding',
      '::bind/NameDeclaredTwiceError', 'binds `limit` in the scope', 'a name the scope binds to a value', '`|` and `!|` bind alike',
      'the expression of the engine a regex reads as', 'the core met function hello, a value of no kind of the language',
      'pick one of the impls that end a generated chain', 'the impls, each a quote', 'a source that declares two builtins hands a primitive for each',
      'the status of a response that fails', 'a host', ':origin', '`:origin` names the source', 'the origin of a binding',
      'the needs of the host boundary', 'verbNames', '`::builtin` holds its fields as a map', 'builtin/ForeignValueError', 'BuiltinForeignValueError',
      'isBuiltinDescriptor', 'A builtin marks a verb a host answers by a primitive', 'streamPrimitives', 'tablePrimitives', 'the current scope', 'the environment of the process'
    ]) expect(refused(text), text).toBe(false);
  });
  it('refuses each retired term of the read of text into code and back, of the elision, of the regex, of the template and of the read of a print where it is written [QSWRK#documents]', () => {
    for (const text of [
      '::quote/parse', '`::quote/parse` reads text into a quote and prints a quote as its text', 'quote/parse',
      'what does not fit given way to markers under `::elision`', 'the marker of a text keeping its first characters under `:head`', 'ending with a marker of the rest',
      'A marker\'s `:size` counts what it stands for', 'its parts that did not fit given way to markers', 'The marker of a string keeps its first characters.', ':keepsAPartShorterThanItsMarker',
      'A part whose marker prints no shorter than it stays.', 'A vector keeps its first elements and ends with a marker of the rest.', 'its marker keeping the first characters of its text',
      'the kind of the marker of what a view left out', 'every part left out gives way to a marker', 'each subject it passed such a marker where the marker prints shorter',
      'an ::elision marker whose :read continues the query', 'fit gives way to ::elision markers whose :read continues', 'the-read-of-a-marker-answers-what-it-left-out',
      'a-vector-past-its-budget-ends-with-a-marker', 'the-size-of-a-marker-counts-what-it-left-out', 'the-read-of-a-string-marker-answers-the-string',
      'a-part-no-longer-than-its-marker-stays-under-a-budget', 'the-top-keeps-its-first-element-and-a-marker-of-the-rest', 'the-read-of-the-marker-of-a-quote-answers-the-quote',
      'a-marker-counts-a-part-that-gave-way-whole-as-one-element', 'a-marker-of-a-text-counts-and-keeps-its-characters', 'a-marker-prints-on-one-line', 'a-vector-that-holds-a-marker-stays-on-one-line',
      'the marker of an elision', 'the `:read` of every marker applied to the value taken', 'Long enough that the marker standing for it prints shorter than it.',
      'what does not fit given way to markers that read it', 'prints a value past its budget with a marker that reads the rest', 'A marker of `::elision` stands on one line whatever it holds',
      'a part beneath the top gives way whole to its marker', 'each marker\'s `:read` continues the query beneath', 'isMarker', 'the marker of a quote', 'the size of a marker',
      'the read of the marker', 'each subject it passed such a marker', ':size of a marker counts what it stands for', 'markers under `::elision` stand for what a view left out',
      'longer than its marker', 'A part no longer than its marker stays.', 'what is left out an `::elision` marker whose `:read` continues the',
      'caller asked for, what does not fit given way to markers that read it, on', 'subject it passed an ::elision where the marker prints shorter,',
      'is an `::elision` marker, whose `:read` continues the query to', 'what does not fit given way to markers under `::elision`, and a',
      'the marker of a text keeping its first characters under `:head`; a', 'those until it fits, ending with a marker of the rest, a set', 'marker\'s `:size` counts what it stands for, a text by its',
      'given way to markers.', 'The marker of a text counts and keeps characters as `count`', 'A vector keeps its first elements and ends with a marker of',
      'A doc beneath the top gives way whole, its marker keeping the', '`::elision`, the kind of the marker of what a view left out, and the',
      'flag, and every part left out gives way to a marker; an answer', 'is an alert, each subject it passed such a marker where the marker',
      'half of its elements and ending with a marker of the rest, and a map, a', 'shorter than it. A marker holds', 'A marker is a map under `::elision`, the tag stamped on the map.',
      'The marker a part gives way to whole: a text\'s with its head, a vector\'s', 'The least a part gives way to: the top its first element and a marker of',
      'A subject the failure only passed, given way whole where its marker is', 'so does a marker of what a view left out, whatever it holds, so what',
      'way, and the `:read` of every marker applied to the value taken answering', 'keeps the top as it is where its first element and a marker of the rest print no shorter',
      'keeps a part whose marker prints no shorter than it, so a budget never lengthens a print [QSPRN#elide]', 'shown once, and the read of every marker continuing the query beneath `!|`.',
      'gives a map and a string it passed way whole, and keeps what prints shorter than its marker', 'them [QSPRN#elide], a part giving way where its marker prints shorter. A',
      '`::elision` marker where the marker prints shorter, each subject', 'steps and its place; each marker\'s `:read` continues the query beneath',
      'by two. A marker of `::elision` stands on one line whatever it holds, so a', 'beneath the top gives way whole to its marker, and a vector or a set to',
      'its first half and a marker of the rest, halving until it gives way', 'counting the print a host writes. A marker holds `:size`, what it stands',
      'how to bound an answer, `elide`, and what the `::elision` marker of a', 'A vector\'s elements before the marker of its rest, a marker an element',
      'The marker of a vector\'s rest, whose read drops the elements kept.', 'A vector or a set keeping its first elements and ending with a marker of',
      '[QSORD#order], the reads of its markers written against the order of the', 'marker for each subject it passed, the failure itself staying', 'a marker of ::elision stands for a part left out',
      'A pattern, `#"…"`, is a value of its own kind', 'bright magenta — a pattern `#"…"`', 'wraps a pattern literal, its flags among it', '`#"` a pattern of text',
      'a tag, a vector, a set, a pattern, a map', 'keywords rank after patterns', 'which answers the pattern itself', 'The verbs that read text by a pattern live under `::string`.',
      'A pattern reads text by code points', 'nor does a pattern the engine cannot read', 'A pattern is no string', 'Text becomes a pattern by `toRegex`', 'a pattern prints as its literal',
      'patterns rank after strings, by their text and then their flags', '`#"\\d+"` is a pattern.', 'JSON writes a pattern as its literal',
      'turns patterns and the strings that hold their sources into patterns', 'The flags of the pattern written in a string, the pattern\'s own', 'A pattern given flags answers its source',
      'A pattern answers itself', 'a text or a pattern, `#"[,;]"`', 'A pattern cuts at every match', 'A pattern is asked whether a match stands anywhere', 'a pattern at the start of the text',
      'A vector, a set, a map and a pattern have no `toString`', 'Answers the first match of the pattern the call gives', 'The groups a pattern names come as a map', 'The pattern the text is read by',
      'Text is no pattern', 'A pattern that names no group is refused', 'The pattern whose groups are named', 'A pattern that is no pattern and no string is refused.', 'and this pattern names none',
      'the whole match of a pattern', 'a `$<name>` of a group the pattern lacks', 'Answers the pattern whose source the string holds', 'a text that writes the literal of a pattern whole',
      'reads the string as the source of a pattern', 'null, boolean, number, string, pattern, keyword, tag name', 'Two patterns are one when their text and their flags are', 'The engine of a pattern',
      'the pieces of a text between the matches of a pattern', 'A text looked for as a pattern of itself', 'A pattern\'s replacement names the parts of a match',
      'The pattern, the keyword, the tag name', 'which `pattern.mjs` hands to the engine', 'core/src/pattern.mjs', 'PATTERN_FLAGS', 'patternProblem', 'patternRefusal', 'patternLiteral',
      'refuseUnreadPattern', 'PatternCharacter', 'PatternFlag', ':"character of a pattern"', 'Expected end-of-source, flag of a pattern or whitespace',
      'a-pattern-has-no-string-its-text-being-its-literal', 'a-tag-lays-itself-over-a-pattern', 'patterns-rank-after-strings-by-text-then-flags', 'a-quote-holds-a-pattern-as-a-step',
      'capture-refuses-a-pattern-that-names-no-group', 'toRegex-reads-a-pattern-kept-in-data', 'a-name-holds-a-pattern-and-a-verb-takes-it', 'match-refuses-a-text-for-a-pattern',
      'a-pattern-flagged-m-anchors-at-every-line', 'capture-answers-null-where-the-pattern-matches-nothing', 'a-pattern-is-a-value-of-its-own-kind', 'a-pattern-reads-back-from-its-print',
      'a-pattern-the-engine-cannot-read-does-not-parse', 'json-writes-a-pattern-as-its-literal', 'a-quote-in-a-pattern-does-not-end-it', 'a-pattern-reads-letters-of-any-script',
      'a-pattern-takes-flags-as-a-string-does', 'a-pattern-refuses-letters-of-no-flag', 'toRegex-with-no-flags-keeps-a-pattern-and-gives-a-string-none',
      'a-string-takes-null-for-no-flags-as-a-pattern-takes-it-for-its-own', 'numbers, strings, patterns, keywords, tag names and paths', 'paints a pattern literal as `regexp`',
      'a character class of a pattern', 'the expression of the engine a pattern reads as', 'tell a pattern from a text by its kind', 'take a pattern alone', 'what the groups of the pattern capture',
      'The text or the pattern looked for, computed against the subject', 'The needle is a text or a pattern, which', 'What is looked for, a pattern or a text.', 'a pattern at the end of the text',
      'The pattern every match of which is read', 'a pattern keeping its own', 'the pattern\'s own', 'the pattern the call gives', '`::regex` reads its payload as the pattern it is',
      'turns the strings that hold their sources into patterns by `toRegex`', 'toRegex turns text into a pattern', 'pattern of text, `#"\\d+"`',
      'a-name-of-a-group-the-pattern-lacks-stands-beside-named-groups', 'a-two-digit-group-the-pattern-lacks-reads-as-the-group-of-its-first-digit',
      'a-pattern-prints-as-written-its-flags-in-their-order', 'two-patterns-are-one-when-their-text-and-flags-are', 'wraps a pattern literal, its flags among it, in the bright-magenta escape pair',
      '`"42" | toNumber | add 1` answering `43`. A pattern, `#"…"`, is', 'tag, `[` a vector, `#[` a set, `#"` a pattern of text, `{` a',
      'A string, a keyword, a tag, a vector, a set, a pattern, a map,', 'keyword as its name, `"draft"`, and keywords rank after patterns',
      'refusal, and `toRegex`, which answers the pattern itself. The verbs', 'that read text by a pattern live under `::string`.',
      'A pattern of text, `#"\\d+ms"`, which the verbs of a string read text', '`#"^error"im`. A pattern reads text by code points, as Unicode',
      'read, do not parse, nor does a pattern the engine cannot read, and', 'A pattern is no string: `split "."` cuts a text at its dots, and',
      '`split #"[.,;]"` at any of three marks. Text becomes a pattern by', 'and a pattern prints as its literal, which `print` writes. JSON',
      'and patterns rank after strings, by their text and then their flags.', '`::regex` reads its payload as the pattern it is; text becomes',
      'A pattern reads text by code points, a class of Unicode among', 'JSON writes a pattern as its literal, which `parse | apply it`', 'A pattern prints as its literal and reads back as itself.',
      'A pattern is no string, so a text cuts at a dot and a pattern', 'Patterns rank after strings and before keywords, by their', 'Answers the pattern itself, so `map ~toRegex` turns patterns and',
      'the strings that hold their sources into patterns; given flags, as', 'The pattern itself, or its source with the flags.', 'A pattern given flags answers its source with them.',
      'A pattern answers itself, so patterns and their sources turn', 'into patterns.', 'A pattern reads text, its match and its groups.', 'The text or the pattern the subject is cut at, computed',
      'The separator is a text or a pattern, `#"[,;]"`; a keyword', 'A pattern cuts at every match, its groups left out of the', '`lower | contains "h"`. The needle is a text or a pattern, which',
      'The text or the pattern looked for, computed against the', 'The needle is a text or a pattern, `#"\\d+"`; a keyword gives', 'A pattern is asked whether a match stands anywhere.',
      '`startsWith (:ab | toString)`, and a pattern at the start of', '`endsWith (:bc | toString)`, and a pattern at the end of the',
      '`"null"`. A vector, a set, a map and a pattern have no `toString`:', 'Answers the first match of the pattern the call gives as a vector,',
      'part in the match is `null`. The groups a pattern names come as a map', 'The pattern the text is read by, `#"(\\d+)ms"`.', 'The pattern is a `#"…"`; text that holds one becomes a pattern',
      'Text is no pattern; `toRegex` reads it as one.', 'Answers the groups the pattern names in its first match as a map,', 'took no part is `null`. A pattern that names no group is refused;',
      'The pattern whose groups are named, `#"(?<level>\\w+)"`.', 'The pattern is a `#"…"` that names its groups, `(?<name>…)`.', '`capture` answers the groups a pattern names, `(?<level>\\w+)`,',
      'and this pattern names none: `match` answers its groups by', 'A pattern that names no group is refused.', 'Answers the text of every match of the pattern, in order, `[]`',
      'The pattern every match of which is read, `#"\\d+"`.', 'The pattern is a `#"…"`; text becomes one by `toRegex`.', 'every match of the pattern: `"a-b-c" | replace "-" "+"` answers',
      '`"a+b+c"`. The pattern is a `#"…"` or a text looked for as it is.', 'a group, a named group and the whole match of a pattern,',
      '`"12.10.2026"`, a `$<name>` of a group the pattern lacks standing as', 'A `$<name>` of a group the pattern lacks stands as written,',
      'Answers the pattern whose source the string holds, with the flags', '`#"\\d+"` and `"error" | toRegex "i"` answers `#"error"i`, a pattern',
      'one. A source that is no pattern is refused with the reason, and so', 'is a text that writes the literal of a pattern whole, as `json`',
      'The flags of the pattern written in a string, none when the', '`toRegex` reads the string as the source of a pattern, and it', 'Why the source is no pattern, and its repair where one shows.',
      '`toRegex` reads the source of a pattern, and this text writes', 'A string reads as the pattern whose source it holds.', 'The literal of a pattern is refused, and `parse | apply it`',
      'first, null, boolean, number, string, pattern, keyword, tag name,', 'Two patterns are one when their text and their flags are QSTXT#pattern.',
      'A pattern of text, read as written: a backslash passes to the engine', '\'regex\'       Pattern literal `#"…"`, its flags among it QSTXT#pattern',
      'boolean, number, string, pattern, keyword, tag name, path, vector, set,', 'The patterns of text: a source the engine reads as it is written, in',
      'engineOf(source, flags, extra?) → the expression of the engine a pattern', 'patternProblem(source, flags) → what keeps a source from being a',
      'patternRefusal(source, flags, problem) → the sentence that refuses a', 'literal whose source is no pattern: the reason, and the repair of the',
      'patternLiteral(source, flags) → the literal a pattern writes: its source', 'A string reads as the source of a pattern with the flags the call gives,',
      'none for null, and a text that writes the literal of a pattern whole is', 'The verbs of a string that read its text by a pattern: whether a match',
      'The engine of a pattern that matches the empty text at once, which', 'answers the groups the pattern holds, every one of them unmatched.',
      'The pieces of a text between the matches of a pattern, as the pieces of', 'a text between its separators: what the groups of the pattern capture',
      'A text looked for as a pattern of itself, every character the engine', 'A pattern\'s replacement names the parts of a match, `$1`, `$<name>`,',
      '`$&`, a `$<name>` of a group the pattern lacks standing as written; a', 'The replacement with each `$<name>` of a group the pattern lacks escaped,',
      '`count` counts, so no character falls in halves, and a pattern cuts it at', 'The pattern, the keyword, the tag name, the path, the error and the',
      'A pattern of text, the value of a `#"…"` literal: its source as written', 'and its flags, which `pattern.mjs` hands to the engine QSTXT#pattern.',
      'numbers, strings, patterns, keywords, tag names and paths, each once, in the one', 'classifies a pattern literal, its quote escape and its flags among it QSTXT#pattern',
      'implies the vector, `{…}` the map, `#"…"` the pattern, `::regex`, `/a`', 'strings, patterns, keywords, tag names and paths, each once and in the',
      'A pattern of text is a value of the kind `::regex`, written `#"\\d+ms"`:', 'quote, each once, and print in that order; the pattern reads text by',
      'is no pattern is refused by the parser with the reason, and the repair', 'flags its call gives in the place of its own, a pattern keeping its own',
      '`contains`, `split` and `replace` tell a pattern from a text by its kind;', '`match`, `capture` and `scan` take a pattern alone, refusing a text as',
      'first match as a map, or null, refusing a pattern that names no group;', 'a dollar by `$$`, a group the pattern lacks standing as written, but for',
      '`toRegex` reads a string as the source of a pattern, its input `flags` a', 'A pattern, read as itself.', 'whether the pattern names other groups or none.',
      'The pattern the source writes, with its flags.', 'Whether the engine reads a pattern a literal writes with its flags', 'with the character after it, but for `\\"`, a quote in the pattern that',
      'A pattern writes its literal, which JSON has no form for QSTXT#pattern.', 'A pattern writes its literal, its flags after it QSTXT#pattern.', '`capture` takes a pattern alone',
      'the pattern literals of a page',
      '::string/toRegex/TextNotPatternError', 'StringToRegexTextNotPatternError', ':TextNotPatternError/refusesTheLiteralOfARegex',
      '::string/capture/PatternNamesNoGroupError', 'StringCapturePatternNamesNoGroupError', ':PatternNamesNoGroupError/refusesARegexOfNumberedGroupsAlone', '| throws :PatternNamesNoGroupError',
      '| takes :pattern', '::string/match/pattern/KindNotTakenError', '::string/replace/pattern', 'StringMatchPatternKindNotTakenError', 'the input `:pattern`',
      ':pattern/KindNotTakenError/refusesAString', '| throws :pattern/KindNotTakenError', '::string/capture/pattern/KindNotTakenError', '::string/scan/pattern/KindNotTakenError',
      'StringCapturePatternKindNotTakenError', 'StringScanPatternKindNotTakenError', 'StringReplacePatternKindNotTakenError', '`::string/match/pattern/KindNotTakenError`. `contains` asks for a match',
      ':readsATuple', ':readsATupleSoftly', 'get-reads-a-tuple', 'query-reads-a-tuple-softly', '`get` over a template answers a tuple', 'reads a tuple of two fields', 'a template answers a tuple',
      'tuples the templates of `get` answer', 'Tuples the templates of `get` answer', 'the tuple a template answers', '`query` reads a tuple softly',
      'each marker\'s :read continues the query beneath',
      '"10 | add 3" | parse | apply it', 'print | parse | apply it | eq v', 'error values round-trip through parse | apply(it)', 'reads back by `parse | apply it`', '"add 1" | parse | apply it',
      'pattern: the literal reads back by `parse | apply it`, its',
      'each a pattern of one sense with the term written in its place', 'as one pattern of its one sense', 'a pattern of the one sense it had', 'the conventions build their patterns from it',
      'a repaired kind a pattern finds', 'never by a pattern over the text of a print', 'ANSI escape pattern present', 'by the pattern that finds it',
      'the folders of that shape as one alternation of a pattern', 'RETIRED_WORDS.some(({ pattern }) => pattern.test(text))', 'filesUnder(repoRoot, dir, pattern)', 'a pattern for each term',
      'the lexicon holds two patterns', 'the source of the pattern of each term', 'the flags of the pattern the lexicon holds', 'the first match of the pattern in a line',
      'the groups of the pattern a script reads', 'a word becomes a pattern of the lexicon', 'the folders turn into patterns of the walk', 'a loop over a pattern of the lexicon',
      'the term is the pattern itself', 'a script finds the text by a pattern', 'a printer that tells a spelling from the text by a pattern', 'a word of another sense is no pattern of the lexicon',
      'each pattern reads text the conventions read', 'a pattern cuts no word of another sense', 'patterns rank by the order the table writes them', 'the pattern the call gives to git grep',
      'a pattern whose groups capture the name of a case', 'a text or a pattern a check finds', 'the engine a pattern of JavaScript runs on', 'a name holds a pattern of the lexicon',
      'the pattern prints the words it found', 'a pattern keeping its generic sense', 'each pattern of the lexicon is a JavaScript RegExp, not a `::regex`', 'the pattern of the grammar that paints `#"` as a regexp',
      'a pattern of the lexicon that finds `toRegex` where it is written', 'the source of a pattern of the lexicon', 'and the tokenizer of patterns paints until it has loaded', 'Embedders hosting qlang in a browser tab copy this pattern:'
    ]) expect(refused(text), text).toBe(true);
  });

  it('leaves marker for the signs of a comment, the end of a paste and unfinished work, tuple for the form of a shape, `parse` of a string, `open` of a link and a snippet, and `apply` of code on a subject [QSWRK#documents]', () => {
    for (const text of [
      'the comment markers `|~`, `|~|`, `|~~`', 'Longer markers are tried first', 'Inside a block comment the line markers are bare tokens',
      'a-parse-error-names-no-marker-of-a-comment-among-its-continuations', '|~ doc-close marker ~~| mentioned here ~|', 'holds a |~| line marker mention here', 'plain-close marker', 'line-doc marker',
      'The block-marker design picks', 'the marker has no addressable role there, so consuming only the marker bytes preserves', 'a block comment that holds a doc marker and code',
      'closes a doc inside a quote of a doc at its own marker', 'paints a line-marker mention inside plain block', 'the longer marker read first', 'a marker inside it among it',
      'a bracketed paste whose begin marker opens a chunk, read up to its end marker', 'A gathered paste lands with every bracket marker it holds taken out.', 'stripPasteMarkers',
      'strips BPM markers from a single-chunk wrapped paste', 'inserts single-line paste content when markers arrive in separate data events', 'its bracket markers taken out',
      'the placeholder markers', 'Forbidden framing / markers', 'leaves no marker of work undone', 'captures a parse error on the cell entry as both a host-error marker and a lifted ErrorValue',
      'yields the marker (empty) for an empty Vec', '::Marker[]', 'the marker of a comment, `|~|`', 'the marker of the end of a paste', 'a marker of the rest of the line',
      'the marker prints nothing of the comment', 'the paste marker counts as no character', 'the comment marker that reads a doc', 'each marker of a block comment',
      'the read of the marker of a comment', 'a line that holds a marker of a comment', 'the size of a marker of a block comment', 'the paste ends with a marker',
      'a doc gives way to a marker of a comment', 'the marker standing for the end of a paste', 'an ::elision whose :read continues the query', 'the elision of a text keeping its first characters',
      'a part whose elision prints no shorter than it stays',
      'a regex, a value of `::regex`', '`#"\\d+"` is a regex', '::string/toRegex/TextNotRegexError', '| takes :regex',
      ':needle', 'Vectors of one length that part index by index are tuples.', ':readsTuplesIndexByIndex', 'tupleOf', 'two tuples of one length index by index', 'a shape reads a tuple index by index',
      'shape-merges-a-tuple-with-a-list-of-another-length-into-one-element', 'shape-keeps-each-index-of-two-tuples-that-part', 'get-reads-two-fields-of-one-record-by-a-template',
      ':readsTwoFieldsByATemplate', 'query-reads-each-path-of-a-template-softly', 'shape reads a tuple', 'a shape reads a tuple of two kinds', 'a shape reads a tuple of a string and a number',
      '"add 1" | parse', '"#[3 1 3]" | parse | open', '`open` runs a link and a snippet alike', '5 | apply ~(add 1)', '5 | apply ("add 3" | parse)', '::string/parse', '::quote/ParseError',
      'quote/ParseError', '::quote/toString', 'core/test/conformance/QSQUO/parse.jsonl', 'a-quote-written-as-text-by-toString-reads-back-by-parse',
      'the paste marker is left out of the line the reader takes', 'a comment marker prints shorter than a doc', 'the end-of-paste marker gives way to the next chunk',
      'the marker `|~|` of a comment reads to the end of the line, `:read` aside', 'a line comment, its marker `|~|`, runs to the end of the line; an elision prints no comment',
      'the comment markers are left out of the highlighted span', 'the bracketed paste markers are left out of the budget of a line', 'its markers of a comment',
      'a shape reads a tuple index by index, `get /0` reading its first index',
      '`shape` writes a tuple of two fields as a shape for each index', 'a tuple is a vector of one length; `query` reads it softly as any vector', 'the template of `get` is no tuple',
      'A gathered paste lands with every bracket marker it holds left out.', '::string/capture/RegexNamesNoGroupError', 'StringCaptureRegexNamesNoGroupError',
      ':RegexNamesNoGroupError/refusesARegexOfNumberedGroupsAlone',
      'reads a bracketed paste up to its end marker, a pause past the window inside it', 'shapes or more a tuple, vectors of one length that part index by',
      'capture-refuses-a-regex-that-names-no-group', 'reads a bracketed paste whose begin marker\'s escape is split',
      'a line that holds a marker of a block comment', 'a doc gives way to a marker of a block comment'
    ]) expect(refused(text), text).toBe(false);
  });

  it('refuses in every sense where it is written a generic word the texts that state what holds write in no sense [QSWRK#documents]', () => {
    for (const text of [
      'Answers the outline of a value, the set of its leaves', '`paths` answers the outline of a value and `shape` its schema',
      ':answersTheOutline', 'The outline holds the path and the kind of every leaf.', 'and of a failure and the outline of a value among them',
      'outline and its words', '// ── Document Symbols (Outline) ──', '4. Ctrl+Shift+O — Outline', 'OUTLINES', 'an outlined box'
    ]) expect(refused(text), text).toBe(true);
  });

  it('leaves the words written in its place: the shape, the leaves, the symbols of a document and the schema of a step [QSWRK#documents]', () => {
    for (const text of [
      'Answers the shape of a value, its structure beneath its tags', '`paths` answers the leaves of a value', ':answersTheLeaves',
      '// ── Document Symbols ──', '4. Ctrl+Shift+O — Document Symbols', 'the fields a record of a step holds against its schema',
      '::bind/PayloadNotSchemaError'
    ]) expect(refused(text), text).toBe(false);
  });

  it('refuses each name the shape and its other senses gave way to where it is written [D363]', () => {
    for (const text of [
      'shapeKindOf', 'foldersShaped', ':any/intoShape', ':readsByThePathsOfTheData', ':readsThePathsOfTheDataThroughIt',
      ':readsThePathThroughTheKeyItShows', ':standsOverTheSchemaShapeAnswers', 'the-paths-of-the-data-read-its-shape',
      'shape-reads-the-path-of-the-data-through-the-key-a-fold-shows', 'shape-reads-a-record-null-in-some-through-its-mark',
      'a-shape-reads-the-set-of-atoms-by-path'
    ]) expect(refused(text), text).toBe(true);
  });

  it('leaves the words written in their place and the shape of a value: the read every value takes, the schema of a step, the kind of the core, the form of a folder and of code, the template of the atoms and the kinds of the codec [QSWRK#documents]', () => {
    for (const text of [
      'A shape is read as every value is: a path reads it beneath the tags over each part it meets, its marks among them', ':readsAPartBeneathItsTag',
      ':answersAPartBeneathItWithoutTheMark', ':readsByTheKeyItShows', ':readsAListByItsOneElement', 'a-shape-reads-a-list-by-its-one-element',
      'a-shape-answers-a-part-read-beneath-a-mark-without-the-mark', 'a-shape-reads-a-fold-by-the-key-it-shows', 'a-shape-reads-a-tuple-by-its-indices',
      'The shape of a part of the data is the shape of that part', 'checks the fields the printer reads against its schema',
      'A record\'s payload is a Map whose fields each fit the schema', 'a required field left out does not fit the schema', 'the schema of the steps of a quote',
      'coreKindOf', 'The kind of the core a container holds beneath its tag', 'then the kind of the core beneath them, then the verbs every value answers',
      'an untagged vector or map holds the tag on itself', 'collections that hold their tag on themselves', 'payload strips the header off every kind of payload under a tag',
      'the top keeps its shape, a vector or a set there halving to its first element', 'a container under a tag keeps its shape, its parts giving way within',
      'the data keeps its shape, so the verbs of the payload\'s kind still serve it', 'A shape is the structure of a value beneath its tags',
      'foldersOfForm', 'The folders of the research by the form of what each holds', 'the folders of that form as one alternation of a regex',
      'intoTemplate', 'Every value comes apart into the set of its atoms and a template', 'The atoms of the subject and its template.',
      'a-template-reads-a-value-back-from-the-set-of-its-atoms', 'A template of `get` builds a shape from the value', 'Under `map` a template builds the shape of each element.',
      'A map\'s elements are its values, and its keys travel with them', 'A map keeps its keys, each with its shape.',
      'null for code of any other form or a name of no verb', 'What the rule read, in the form of `location()`.',
      'Every value answers, and the kinds of qlang alone give way at this boundary', '`toPlain` writes a value in the kinds of JSON, for `json` and a host',
      'the lift of JSON into the values of qlang all fire against a real session', 'An answer of a new shape is built by `get` over a template',
      'a query names the shape of what it reads', 'a subject of another shape is refused, a vector of another length among them', 'a :trace of another shape'
    ]) expect(refused(text), text).toBe(false);
  });
});
