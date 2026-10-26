import { it, expect } from 'vitest';
import { RETIRED_WORDS } from '../../../../scripts/retired-words.mjs';

const refused = text => RETIRED_WORDS.some(({ regex }) => regex.test(text));

it('refuses in every spelling a generic word the texts write in no sense: in prose, capitalised, plural, in the name of a case and of a law, inside a name and in a constant', () => {
  for (const text of [
    'a pattern of text', 'Patterns', 'core/src/pattern.mjs', 'PATTERN_FLAGS', 'patternProblem', 'refuseUnreadPattern', ':TextNotPatternError/refusesARegex', 'a-pattern-has-no-string',
    'the outline of a value', ':answersTheOutline', 'OUTLINES', 'an outlined box',
    'a marker of a comment', 'Markers', 'stripPasteMarkers', 'a-marker-prints-on-one-line',
    'in its place', 'the place of the args', 'Places', 'get-refuses-a-place-past-the-end', ':refusesAPlacePastTheEnd', 'placeIn', 'mergedPlaces', 'MISSED_PLACE',
    'the trail of a failure', 'Trails', 'makeTrail', 'TRAIL_TAG', 'KEY_TRAILS',
    'the kernel', 'a sigil', 'mints a tag', 'minted', 'deflects', 'a deflection', 're-lift', 'relifted', 'fail-apply', 'a plain comment'
  ]) expect(refused(text), text).toBe(true);
});

it('leaves the words that share the letters of a word refused whole, and the words written instead', () => {
  for (const text of [
    'a regex', 'the shape of a value', 'the leaves of a value', 'the opener of a comment', 'an excerpt', 'the selector of an input', '::frame/path', ':arity',
    'replace', 'replaced', 'a placeholder', 'Placeholder', 'workplace', 'placement', 'a stint',
    'trim_trailing_whitespace', 'a trailing newline', 'Trailing', 'the Nissan XTrail', 'a makeTrailer helper', 'a TRAILER of a print',
    'Minty', 'reflects', 'lift', 'a plain map'
  ]) expect(refused(text), text).toBe(false);
});

it('refuses the names the chain, the slot of a kind and the node under an anchor once had, and the refusals named by a kind', () => {
  for (const text of [
    '::holds', 'qlang/holds', 'SignatureNotCommandsError', 'RecipeNotBuiltinError', 'kind/impl/recipe', 'signatureOf', 'readSignature', 'readKindSignature', 'EMPTY_SIGNATURE',
    'core/src/runtime/signature.mjs', 'callMemberOn', 'isMemberValue', 'nearestMembers', 'memberRecordOf', 'memberRefusalOf', 'recordAlongPath', 'the membership a set answers',
    'a path of anchors', 'ConstructorNotBuiltinError', 'ConditionNotBooleanError', 'ElementNotNumberError', 'ElementNotSetOrMapError', 'RowNotMapError', 'any/out/SubjectNotStringError',
    'AddressNotStringError', 'AnswerNotStringError', 'PairTagNotTagError', 'RecipeNotCodeError', 'PayloadNotSixNumbersError', 'TagNotKindError', 'KeyNotKeywordOrStringError',
    'ValueMeetsWordError', 'isWord', 'declaresWord', 'fn/params', '| params', '~(params', '`params`', 'typeKeyword', '::any/source/name', 'source/NameKindNotTakenError',
    '::boolean/and/right', 'or/RightKindNotTakenError', '::fn/takes/objects', '::kind/reads/objects', 'objectNotTaken'
  ]) expect(refused(text), text).toBe(true);
});

it('leaves the help of a signature, a member of a series, the recipe of a function, a check of the gate and the refusals named by the role', () => {
  for (const text of [
    'signature help', 'signatureHelpAtOffset', 'a member of a series', 'the recipe of a verb', 'a recipe written alone', 'the check of the conventions', 'the constructor of a kind',
    '::kind/impl/constructor', 'chainOfFn', 'nodeUnderAnchor', 'a vector of anchors', 'ElementKindNotTakenError', 'ConditionKindNotTakenError', 'TagNamesAValueError',
    'ValueMeetsVerbError', 'isVerb', 'the inputs a function declares', '::any/source/anchor', '::boolean/and/condition',
    '::fn/takes/modifiers', 'modifierNotTaken', 'an object of JSON', 'an object of JavaScript'
  ]) expect(refused(text), text).toBe(false);
});

it('refuses the names the trace, the step that failed and the evaluation depth once had', () => {
  for (const text of ['TrailNotFramesError', '::frame/step', 'brokeAt', 'frameBelow']) expect(refused(text), text).toBe(true);
});

it('leaves the frame of a trace, the step that failed, the evaluation depth and a case that broke', () => {
  for (const text of [
    'a frame of the trace holds the subject its step met', '::frame/failed', 'failedAt', 'depthBelow', 'one deeper in the evaluation depth', 'a stack frame',
    'tell a repair from a case that broke', 'a law broke at the edges of its literals', 'a reader\'s own verb `:number/step`', '!| step'
  ]) expect(refused(text), text).toBe(false);
});

it('refuses the names a refusal, a conversion, an empty subject, the repair of a path, the read of a parser and the error at rest once had', () => {
  for (const text of [
    '::keyword/toTag/NameNotNameError', 'StringToTagTextNotNameError', '::vec/toPath/EmptyError', 'VecToPathEmptyError', ':EmptyError/refusesTheEmptyVector',
    ':KindAnswersNoVerbError/namesTheReadOfAPath', ':read/namesAWrittenPathAlone', 'withReadOfPath', 'readOfPathSubject', 'readOfRefusedPath',
    'caretOf', 'excerptAroundLocation', 'the identifier start', 'a char-class', 'end-of-input', 'classKeyword', 'findIdentifierOccurrences',
    'an opened error', 'opened failures', 'AnOpenedError', ':readsAnErrorOnceOpened', ':opensAFailureToItsFacts'
  ]) expect(refused(text), text).toBe(true);
});

it('leaves the refusals written instead, the read of a part, the caret beneath a refused line, a bracket opened and the scope a call opens', () => {
  for (const text of [
    '::keyword/toTag/NameNotTagError', '::vec/toPath/SubjectEmptyError', ':repair/namesAWrittenPathAlone', '`:read` continues the query to it',
    'the `:marker` beneath the `:source`', 'carries :ParseError/marker', 'markedLineOf',
    'a valid identifier', 'IdentStart', ':end-of-source', 'findNameOccurrences', '`[` opened at line 1, column 1 is never closed', 'the scope a call opens',
    '`open` runs a quote, a link or a snippet', 'the error at rest a catch holds'
  ]) expect(refused(text), text).toBe(false);
});

it('refuses the names the boundary of a host once had', () => {
  for (const text of [
    'cliSource.impls', 'impls?', 'impls: {}', '{ uri, source, impls }', '`impls`', 'hostImplOf', 'HOST_IMPLS', 'declareHostValue', 'isHostDeclared', 'bindPrim', 'bindStateReader',
    'implsUnder', 'PRIMITIVE_REGISTRY.bind', 'the kernel', '::builtin/ImplementationNotHandedError', '::builtin/ImplementationNamesNoBuiltinError', 'BuiltinAddressBoundTwiceError',
    '::unknown', 'UNKNOWN_KIND', '<host-fn helloFn>', 'printFallback', 'toPlainFallback', 'JsonValueNotEncodableError', 'NumberNotFiniteLeakedToPrintError', 'finiteNumberOrLift',
    'logicalName', 'a logical name', ':uri', 'get /uri', 'ParseError/uri', 'envAfterCell', 'session.env', 'createSession({ env', 'session.bind', 'bind(name, value)',
    'builtinNames', 'noBuiltins', 'builtin completions', 'makeIoImpls', 'formatImpls', 'a plain function', 'an expression language'
  ]) expect(refused(text), text).toBe(true);
});

it('leaves the code of the language, the command impl, the primitives a host hands, the environment, the scope and the uri a host hands', () => {
  for (const text of [
    'Reference implementation of the qlang pipeline query language', 'the implementation and its page in the catalog share one key', '| impl ::builtin{}', '::fn/impl',
    'the primitives a host hands beside its source', 'registerPrimitive', '::builtin/PrimitiveNotHandedError', '::builtin/AddressRegisteredTwiceError', 'process.env',
    '`env | keys` lists the names a query declared', 'notebook.scope', 'scopeAfterCell', '`createNotebook({ scope?, sources? })`', 'evalOpts.uri', 'textDocument.uri',
    '::unknownTag', '::bind/NameDeclaredTwiceError', 'verbNames', 'streamPrimitives', 'a plain map'
  ]) expect(refused(text), text).toBe(false);
});

it('refuses the names the read of text into code, the template, the read of a print and the shape once had', () => {
  for (const text of [
    '::quote/parse', ':readsATuple', ':readsATupleSoftly', '"10 | add 3" | parse | apply it', 'parse | apply(it)',
    'shapeKindOf', 'foldersShaped', ':any/intoShape', ':readsByThePathsOfTheData', ':readsThePathThroughTheKeyItShows', ':standsOverTheSchemaShapeAnswers',
    'the-paths-of-the-data-read-its-shape', 'a-shape-reads-the-set-of-atoms-by-path'
  ]) expect(refused(text), text).toBe(true);
});

it('leaves parse of a string, open of a link, the tuple of a shape and the names of the shape written instead', () => {
  for (const text of [
    '"add 1" | parse', '"#[3 1 3]" | parse | open', '5 | apply ~(add 1)', '::string/parse', '::quote/ParseError', ':readsTuplesIndexByIndex', 'a shape reads a tuple index by index',
    'get-reads-two-fields-of-one-record-by-a-template', 'coreKindOf', 'foldersOfForm', 'intoTemplate', ':readsByTheKeyItShows'
  ]) expect(refused(text), text).toBe(false);
});

it('refuses the names the holder of a tag, the scope, the run of a pipeline and the parts of the parser once had', () => {
  for (const text of [
    'wrapperConstructor', ':PayloadNotOneStepError/wrapsAPipelineInAGroup', 'rewrap', 'Rewrapped', 'rewrapping',
    'state.env', 'withEnv', 'envSet', 'envHas', 'envMerge', 'nextEnv', 'bodyEnv', 'core/src/env-keys.mjs',
    'evalBody', 'answerOfBody', 'quoteOfBody', 'stepsOfBody', 'CALL_BINDS_KEY', 'capturedState', 'resolveBinaryReducer',
    'the AST', 'ASTs', 'walkAst', 'findAstNodeAtOffset', 'astNode', 'AST_NODE_EVALUATORS', 'QUOTE_AST_SLOT', 'stepOfNode', 'docOfNode', 'partNode', 'nodeClosedAt',
    '::quote/ReadBackDiffersError', 'readBackOrRefuse'
  ]) expect(refused(text), text).toBe(true);
});

it('refuses the commands a kind named its payload and its parts by, wraps and reads', () => {
  for (const text of ['`wraps` names its payload and its kinds', '::kind | wraps |~~ The parts. ~~| ::vec', '::kind/wraps | doc', '`reads` a field the payload holds', '| reads :w |~~ The width. ~~| /w', '::kind/reads | doc']) {
    expect(refused(text), text).toBe(true);
  }
});

it('leaves the commands accepts and wires, the scope, the run of a pipeline, the parts the parser keeps and the tree of names', () => {
  for (const text of [
    '`accepts` names its payload and its kinds', '| wires :w |~~ The width. ~~| /w', 'a path reads the part', 'a conversion, a wrapper, a second table', 'unwraps the underlying QlangError', 'lays the tag back through its kind',
    'state.scope', 'withScope', 'scopeSet', 'core/src/scope-keys.mjs', 'evalPipeline', 'closeQuote', 'foldingCodeOf', 'forEachPart', 'partAtOffset',
    'a node the root holds', 'nodeOf', 'the tree of names', 'Astro', 'PAST', 'FAST_PATH', 'lastIndexOf'
  ]) expect(refused(text), text).toBe(false);
});

it('refuses the names the defect of the runtime, a check by what it finds, the data of a task and the facts of an error once had', () => {
  for (const text of [
    'QlangInvariantError', 'declareInvariantError', 'refusalDeclarationDrift', 'baselineDrift', 'cli/test/error-tag-catalog-drift.test.mjs', 'the drift test',
    'scripts/benchmark/inputs/users.json', 'sets/V/inputs/orders.json', 'the files of `inputs/`', 'inputsDir', 'task.input', 'the input files',
    'errorVal.descriptor.get(fact)'
  ]) expect(refused(text), text).toBe(true);
});

it('leaves the defect, the drift a reader finds, the input of a function and the descriptor of a primitive', () => {
  for (const text of [
    'QlangDefect', 'declareDefect', 'the kind of an invariant, `::invariant`', 'a pentimento and a drift', '::fn/inputs/SubjectNotFnError', 'inputTokens',
    'scripts/benchmark/data/users.json', 'the descriptor of a primitive', 'isBuiltinDescriptor', 'runPrimitive(descriptor, served)'
  ]) expect(refused(text), text).toBe(false);
});

it('refuses the names of the units of the work and of the notebook of a host that the work retired', () => {
  for (const text of [
    'the move of the baseline', 'moves the baseline', 'before the baseline moved', 'the walk of the baseline', 'scripts/baseline-walk.mjs', 'walkOfBaseline', 'createSession',
    'core/src/walk.mjs', 'walkParts(read, visit)', 'walkSourceTree', 'walkRefusalScanRoots', 'by the walk of the door'
  ]) expect(refused(text), text).toBe(true);
});

it('leaves the stint, the closeout, the reconciliation, the notebook and the walk of the tags', () => {
  for (const text of [
    'a stint, one branch', 'the closeout of a stint', 'the reconciliation of the tree with its baseline', 'scripts/reconciliation.mjs', '`createNotebook({ scope })`',
    'the baseline, the last merge on master', 'Shift+F12 finds the references', 'the walk of a value\'s tags', 'core/src/parsed-parts.mjs', 'the scan of the door'
  ]) expect(refused(text), text).toBe(false);
});

it('refuses the names the cut of a value to a budget once had', () => {
  for (const text of ['elide', 'x | elide 4000', '::elision', 'an elision of the rest', 'Elisions', 'elided', 'ELISION_TAG']) expect(refused(text), text).toBe(true);
});

it('leaves the excerpt, the concentrate of a failure and the words beside the cut', () => {
  for (const text of ['excerpt', '::excerpt', 'x | excerpt 4000', 'the concentrate of a failure', 'an ellipsis on each side', 'delight', 'the alert of a failure']) expect(refused(text), text).toBe(false);
});
