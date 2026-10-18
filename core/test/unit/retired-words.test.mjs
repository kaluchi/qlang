// The retired terms of the chain, of the slot of a kind, of the node an
// axis reads, of the trace a failure leaves, of a refusal and of the
// boundary of a host, each held by the lexicon of retired terms as one
// pattern of its one sense [QSWRK#documents], [D359], [D360], [D361], which
// refuses the term where it is written, in prose, a name of the code or the
// name of a case, and leaves the words of another sense.

import { describe, it, expect } from 'vitest';
import { RETIRED_WORDS } from '../../../scripts/retired-words.mjs';

const refused = text => RETIRED_WORDS.some(({ pattern }) => pattern.test(text));

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

  it('refuses each retired term of the trace, of the step that failed and of the evaluation depth where it is written [D359]', () => {
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
      'leaves the budget intact for recursion that terminates', 'the frames of the evaluator', 'the budget of the evaluator'
    ]) expect(refused(text), text).toBe(true);
  });

  it('refuses a frame for the scope of a source where it is written [D359]', () => {
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

  it('leaves the words of another sense beside the trace: a frame of a trace, the budget of a print, and a case, a law, a tag and a stream that broke [D359]', () => {
    for (const text of [
      'a frame of the trace holds the subject its step met', 'the frame of `map`', 'a frame a line', 'the frame of its step',
      'trim_trailing_whitespace', 'a trailing newline', 'trailing-separator-leaves-empty', 'Trailing',
      '[QSERR#trail]', 'the step that failed', 'failedAt', 'a reader\'s own verb `:number/step`', 'reduce 0 ~(step)', '!| step',
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
      'the steps a failure skips stay on the frame of the step that failed', 'the key that broke the order', 'the code that broke it'
    ]) expect(refused(text), text).toBe(false);
  });

  it('refuses each retired term of a refusal, of a conversion, of an empty subject and of the error a catch holds where it is written [D360]', () => {
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

  it('refuses the position of an element named as a place where it is written [D360]', () => {
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

  it('leaves the words of another sense beside a refusal: the place of the args, of a frame, of a payload and of a text, the read of an elision, a bracket opened and the end of the source [D360]', () => {
    for (const text of [
      'The place of the args the input reads, a path or a quote.', 'An input whose place the args leave out is refused.', 'A place read by `query` gives a default.',
      'a modifier that failed is refused by its place', 'The input `multiplier` reads the first place of the args', 'How many places the inputs of the verb read', 'Args past the places its inputs read are refused.',
      '`place` reads a frame, which the trace of a failure holds', 'The frame of `map` holds the place of the element its code failed on', 'The subject of the frame reads the part by its place.',
      'the-frame-of-a-step-that-ran-no-code-on-a-part-names-no-place', 'The place of the payload the field reads, a path or a quote.',
      'A point is a place in source text', 'the place where a reading stopped', 'a caret under the place its `:location` names', 'scan-meets-an-empty-match-at-every-place', 'an empty match met at every place',
      'is declared under the noun of its place', '`coalesce` puts a fallback in the place of null.', 'A sum subtracted is computed in its place.', 'the text that takes the place of each match',
      'where a path stands in the place of the value it names', 'Two digits keep two places after the point.', 'Any value, its place in the one order turned around.',
      'saves the draft of the place it leaves and loads the next place\'s', 'a key written twice standing in its first place with its last value', 'the values change nothing in place',
      '`:read` continues the query to it, `!| get /trace/1/0`', 'an ::elision marker whose :read continues the query', 'the-read-of-a-marker-answers-what-it-left-out', 'elide 10 | last | get /read',
      'the marker of an elision', 'the read of a part before a word', 'answers the refusal of its read', 'an-input-given-a-path-names-its-repair', ':repair/namesAWrittenPathAlone',
      '`[` opened at line 1, column 1 is never closed', 'an-unclosed-bracket-names-where-it-opened', 'closes a span at a run of as many backquotes as opened it',
      'the scope a call opens', '`open` runs a quote, a link or a snippet', 'the error at rest a catch holds', ':raisesAnErrorAtRestAsItself',
      '::keyword/toNumber/NameNotNumberError', '::keyword/toTag/NameNotTagError', '::vec/toPath/SubjectEmptyError', ':SubjectEmptyError/refusesTheEmptyVector', ':numbers/EmptyError/refusesNoNumber',
      'a valid identifier', 'IdentStart', ':any-character', ':end-of-source', ':"letters of a name"', 'findNameOccurrences', 'a character class of a pattern',
      'the args of the call, which the inputs of its function read by their places', 'its inputs read from the args by their places',
      'its own place read through the field again', 'a link opens to the answer of its query', 'a value turned by `desc` opens to the value it turned',
      'a leading `!|` opens a step of the fail track', 'A link opens to a value its query answers',
      'an-error-literal-a-kind-refuses-is-caught-at-rest-as-a-value-that-prints', 'the-frame-of-map-over-a-set-names-the-index-in-its-one-order'
    ]) expect(refused(text), text).toBe(false);
  });

  it('refuses each retired term of the boundary of a host where it is written [D361]', () => {
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

  it('leaves the words of another sense beside the boundary of a host: the code of the language, the command impl and its plural, a builtin and its plural, the environment, a plain value, the host\'s uri and the codec of JSON [D361]', () => {
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
      'the expression of the engine a pattern reads as', 'the core met function hello, a value of no kind of the language',
      'pick one of the impls that end a generated chain', 'the impls, each a quote', 'a source that declares two builtins hands a primitive for each',
      'the status of a response that fails', 'a host', ':origin', '`:origin` names the source', 'the origin of a binding',
      'the needs of the host boundary', 'verbNames', '`::builtin` holds its fields as a map', 'builtin/ForeignValueError', 'BuiltinForeignValueError',
      'isBuiltinDescriptor', 'A builtin marks a verb a host answers by a primitive', 'streamPrimitives', 'tablePrimitives', 'the current scope', 'the environment of the process'
    ]) expect(refused(text), text).toBe(false);
  });
});
