> A pentimento audit of cases--core for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–00:02 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### vestige · core/src/types.mjs:39

«export function isErrorValue(v) { return isValueClass(v, 'error'); }» — его пара `makeErrorValue` (types.mjs:424) экспортирована корнем пакета, и хосты по ним узнают сбой.

Слой: имя осталось от модели, где сбой был «значением-ошибкой». Язык же говорит «An error rests as a value and flies as a failure», а первая страница — «No value holds a failure». `isErrorValue` отвечает `true` как раз для сбоя в полёте, ошибку в покое строит `errorAtRest`, а `ordering.mjs` называет то же самое `RAISED_KIND`: у одного понятия три имени.
Чистый лист: предикат и конструктор названы словом языка (`isFailure`, `makeFailure`), и «error value» нигде не обозначает сбой.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -E "function isErrorValue|isValueClass\(v, 'error'\)|export const errorAtRest|RAISED_KIND" -- core/src
core/src/ordering.mjs:25:const RAISED_KIND   = 14;
core/src/ordering.mjs:38:  if (isErrorValue(value)) return RAISED_KIND;
core/src/ordering.mjs:126:    case RAISED_KIND: {
core/src/types.mjs:39:export function isErrorValue(v) {
core/src/types.mjs:40:  return isValueClass(v, 'error');
core/src/types.mjs:154:export const errorAtRest = facts => makeTagged(ERROR_TAG, facts);

$ qplay 'get [~(get [1 ~("x" | add 1)] !| tag) ~(!{:a 1} | tag) ~([!{:a 1} 1] | sort | count)]' < /dev/null
[::number/add/SubjectNotNumberError ::error 2]
```

### subordination · core/src/ordering.mjs:24

«// [QSREQ#cases]» стоит над «const RAISED_KIND   = 14;». Единый порядок ранжирует сбой «after every value, by its tag and then its facts» (так сказано в заголовке `core/test/unit/QSORD/order.test.mjs:6`).

Слой: правило порядка языка подогнано под нужду раннера кейсов и равенства vitest — это глава процесса, а QSVOX#order говорит «The process brings no entity into the language». Ни один раздел QSORD этого правила не содержит, и запрос до этой ветки не доходит.
Чистый лист: порядок ранжирует только значения, а раннер сравнивает печать ошибки в покое, которую держит catch (так `raises` уже и записан).

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -E "QSREQ#cases|RAISED_KIND   =" -- core/src/ordering.mjs
core/src/ordering.mjs:24:// [QSREQ#cases]
core/src/ordering.mjs:25:const RAISED_KIND   = 14;

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -i -E "failure|raised" -- docs/spec/QSORD-one-order.md

$ qplay '[1 2] | map ~(add "x") | sort !| trace | last | skipped' < /dev/null
~(sort)
```

### shim · core/src/eval.mjs:623

«if (caughtError instanceof QlangError && caughtError.address === payloadRefusal) return refused();» — и тремя строками ниже: «return isErrorValue(made) && made.tag.name === payloadRefusal ? refused() : made;».

Слой: у одного отказа два носителя. Первый — JS-класс из `declareRefusal`: его бросают, а `errorFromQlang` (error-convert.mjs:44) переводит в сбой. Второй — сбой, который сразу строит `refusalUnder`. Поэтому `answerMadeBy` ловит один и тот же отказ в обеих формах; в одном `eval.mjs` 16 бросков и 17 построений.
Чистый лист: у отказа один носитель и одна точка перевода, так что проверка сводится к одному сравнению тега.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n "payloadRefusal" -- core/src/eval.mjs
core/src/eval.mjs:33:  notGivenAddress, notReadAddress, payloadRefusalName, subjectRefusalAddress, FN_CALL_ADDRESS, ANY_KIND_NAME
core/src/eval.mjs:307:    if (payload.each) layKindsRefusal(payloadRefusalName(false), payload.page);
core/src/eval.mjs:308:    if (payload.kinds !== null) layKindsRefusal(payloadRefusalName(payload.each), payload.page);
core/src/eval.mjs:618:  const payloadRefusal = `${kindName}/${payloadRefusalName(false)}`;
core/src/eval.mjs:623:    if (caughtError instanceof QlangError && caughtError.address === payloadRefusal) return refused();
core/src/eval.mjs:626:  return isErrorValue(made) && made.tag.name === payloadRefusal ? refused() : made;
core/src/eval.mjs:1025:  const refusalOf = each => `${tagName}/${payloadRefusalName(each)}`;

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -c -E "throw new [A-Z][A-Za-z]+Error\(" -- core/src/eval.mjs core/src/steps.mjs core/src/chain.mjs core/src/path-read.mjs; git grep -c "refusalUnder(" -- core/src/eval.mjs
core/src/chain.mjs:8
core/src/eval.mjs:16
core/src/path-read.mjs:2
core/src/steps.mjs:11
core/src/eval.mjs:17
```

### vestige · core/src/types.mjs:424

«makeErrorValue(tag, facts, { originalError = null, told = null } = {})» — каждый сбой несёт JS-объект броска.

Слой: это остаток модели, где отказ был классом исключения и проверялся через `instanceof`. В исходниках всех воркспейсов `originalError` только копируется из сбоя в сбой; читают его одни тесты (`'originalError must preserve the JS throw instance'`).
Чистый лист: сбой держит только тег и факты, а тесты проверяют `!| tag` и факты.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -E "\.originalError\b" -- core/src playground/src lsp/src site/src stdio/src
core/src/eval-trace.mjs:49:  return makeErrorValue(error.tag, facts, { originalError: error.originalError });
core/src/eval.mjs:369:  return withPipeValue(state, makeErrorValue(refused.tag, facts, { originalError: refused.originalError }));
core/src/eval.mjs:711:  return makeErrorValue(failure.tag, factsInOrder(failure.tag, new Map([...poured, ...failure.facts]), scope), { originalError: failure.originalError, told: failure.told });

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -c -E "\.originalError\b" -- core/test playground/test
core/test/helpers/error-assertions.mjs:3
core/test/helpers/error-assertions.mjs:3
core/test/unit/QSHST/door.test.mjs:2
core/test/unit/QSHST/notebook.test.mjs:2
core/test/unit/QSNAM/verb.test.mjs:1
core/test/unit/QSSLF/axis.test.mjs:3
playground/test/helpers/cli-error-assertions.mjs:3
```

### subordination · core/src/index.mjs:7

«partOf, forEachPart, partAtOffset, findNameOccurrences, tagWrittenBy, tagHeadEnd, readsItsSubject, bindingNamesVisibleAt, CALL_SPELLING, TAG_SPELLING» — а рядом `isVerbBody`, `answerKindsOf`, `shownFor`, `servesTheSubject`.

Слой: функции видимости по курсору, вхождений, ховера и offer определены в ядре, ни один модуль ядра их не вызывает, а читает только `lsp/src/features.mjs`. Десять меток `[QSLSP#…]` в `core/src` делают главу сервера правилом кода ядра, а `ruleRefusalsOf` и `kindsSharedBy` экспортированы ради теста playground.
Чистый лист: ядро отдаёт части парсера, а курсор, ховер и вхождения считает `lsp/src`.
Дополняет D412 (часть 1): там названы тестовые файлы, но не экспорты корня пакета, не метки `[QSLSP#…]` в коде ядра и не экспорт ради чужого теста.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -l -w -e bindingNamesVisibleAt -e isVerbBody -e answerKindsOf -e shownFor -e servesTheSubject -e findNameOccurrences -- "*.mjs"
core/src/chain.mjs
core/src/dispatch.mjs
core/src/index.mjs
core/src/nouns.mjs
core/src/parsed-parts.mjs
core/test/unit/QSDSP/walk.test.mjs
core/test/unit/QSLEX/term.test.mjs
core/test/unit/QSLSP/offer.test.mjs
core/test/unit/QSLSP/reach.test.mjs
core/test/unit/QSLSP/server.test.mjs
core/test/unit/QSLSP/symbols.test.mjs
lsp/src/features.mjs
scripts/retired-words.mjs

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -c -E "\[QSLSP#" -- core/src; git grep -l -w -e ruleRefusalsOf -e kindsSharedBy -- "*.mjs"
core/src/chain.mjs:1
core/src/dispatch.mjs:1
core/src/name-chars.mjs:2
core/src/nouns.mjs:3
core/src/parsed-parts.mjs:3
core/src/index.mjs
core/src/nouns.mjs
core/test/unit/QSBLD/input.test.mjs
core/test/unit/QSERR/site.test.mjs
playground/test/QSERR/site.test.mjs
```

### subordination · core/lib/qlang.qlang:179

На первой странице: «An answer prints within the budget of every answer, and whole in the REPL of the command line». Глава `::qlang/hosts` добавляет: «The playground reads JSON from stdin as values… `print | stdio/out` writes an answer whole».

Слой: каталог ядра писали, когда playground был единственным хостом, и страницы языка до сих пор описывают его REPL, его stdin и потоки `::stdio`. Ядро же их не держит.
Чистый лист: страницы ядра говорят о границе любого хоста («хост может печатать ответ целиком»), а REPL, stdin и потоки описывает страница `::host` в playground.

```
$ qplay '::qlang | doc | content | lines | filter ~(contains "REPL")' < /dev/null
["REPL of the command line; one past it prints as"]

$ qplay '::qlang/hosts | doc | content | lines | filter ~(contains "playground") | count' < /dev/null
5

$ qplay '::qlang/hosts | doc | content | contains "The playground reads JSON"' < /dev/null
true
```

### subordination · core/src/highlight.mjs:89

«spans.push({ ...inner, start: from + inner.start, end: from + inner.end, italic: true })» — токен ядра несёт стиль начертания.

Слой: факт «токен стоит внутри цитаты» назван решением одного маляра — курсивом. QSHST#tokens такого поля не знает, а playground (SGR `3`), site (`.italic`) и vscode (`hljs-emphasis`) просто наследуют это решение ядра.
Чистый лист: токен называет то, что он пишет (`inQuote`), а как это покрасить, решает каждый хост.
Дополняет D412 (часть 1): там `highlight.mjs` назван чтением инструментов, но не поле стиля в токенах ядра.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -i italic -- core/src docs/spec/QSHST-hosts.md
core/src/highlight.mjs:89:  for (const inner of tokenize(source.slice(from, to), verbNames)) spans.push({ ...inner, start: from + inner.start, end: from + inner.end, italic: true });

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -i italic -- playground/src site/src/lib vscode/src lsp/src
playground/src/highlight-ansi.mjs:31:function sgrFor(kind, italic) {
playground/src/highlight-ansi.mjs:33:  if (base === undefined) return italic ? '\x1b[3m' : undefined;
playground/src/highlight-ansi.mjs:34:  return italic ? `\x1b[3;${base}m` : `\x1b[${base}m`;
playground/src/highlight-ansi.mjs:39:  for (const { start, end, kind, italic } of tokenize(source, verbNames)) {
playground/src/highlight-ansi.mjs:41:    const ansi = sgrFor(kind, italic);
site/src/lib/qlang-highlight.js:3:// of the core's `tokenize` a span whose class is its kind, `italic` beside it
site/src/lib/qlang-highlight.js:14:    .map(({ start, end, kind, italic }) => `<span class="${italic ? `${kind} italic` : kind}">${escaped(source.slice(start, end))}</span>`)
vscode/src/markdown-block.js:40:  return tokenize(source, verbNames).map(({ start, end, kind, italic }) => {
vscode/src/markdown-block.js:41:    const coat = italic ? `${CLASS_OF_KIND[kind] ?? ''} hljs-emphasis`.trim() : CLASS_OF_KIND[kind];
```

### archaism · core/test/conformance/QSNAM/declare.jsonl:1

«a-name-holds-the-value-in-the-pipe», «a-name-holds-the-value-for-the-steps-after», «names-hold-the-values-of-several-stages». Глава с ними согласна: «a value of the subject is named for the steps after it by `with`» (QSNAM:16).

Слой: имена держат модель, где имя связывало значение в трубе для следующих шагов. Но `with` называет части для одного шаблона, и QSPTH#template говорит «no name leaves the call».
Чистый лист: эти кейсы лежат в QSPTH/template и называются по правилу `with` («names the subject for the quotes of its template»), а глава говорит «for one template».

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -o -E "\"name\":\"(a-name-holds-the-value[a-z-]*|names-hold-the-values-of-several-stages)\"" -- core/test/conformance/QSNAM/declare.jsonl
core/test/conformance/QSNAM/declare.jsonl:1:"name":"a-name-holds-the-value-in-the-pipe"
core/test/conformance/QSNAM/declare.jsonl:2:"name":"a-name-holds-the-value-for-the-steps-after"
core/test/conformance/QSNAM/declare.jsonl:3:"name":"names-hold-the-values-of-several-stages"

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -e "named for the steps after it" -e "no name leaves the call" -- docs/spec
docs/spec/QSNAM-names-and-scope.md:16:value of the subject is named for the steps after it by `with`

$ qplay '5 | with {:n ~it} ~(n) | apply ~(n) !| tag' < /dev/null
::call/UnknownNameError
```

### archaism · core/test/conformance/QSLIT/tag.jsonl:35

«a-kind-whose-wraps-names-no-kind-takes-no-payload». Заголовки тестов: «names no refusal of a kind that writes no wraps and no field» и «…for a kind whose wraps names no kind» (`core/test/unit/QSERR/site.test.mjs:260, 266`).

Слой: `wraps` — прежнее имя команды `accepts`, его вывел из употребления D450. Регулярка лексикона ловит только `` `wraps` ``, `| wraps` и `kind/wraps`, а голое слово в имени кейса и в заголовках проходит мимо.
Чистый лист: «a kind whose accepts names no kind…» в кейсе и тестах, а словарь отказывает и голому слову.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -o -w -E "wraps|\"name\":\"a-kind-whose-wraps[a-z-]*\"|regex: /.wraps[^,]*, written: '[^']*', by: 'D[0-9]+'" -- core/test/conformance/QSLIT/tag.jsonl core/test/unit/QSERR/site.test.mjs scripts/retired-words.mjs
core/test/conformance/QSLIT/tag.jsonl:35:"name":"a-kind-whose-wraps-names-no-kind-takes-no-payload"
core/test/unit/QSERR/site.test.mjs:260:wraps
core/test/unit/QSERR/site.test.mjs:266:wraps
scripts/retired-words.mjs:108:regex: /`wraps`|\|\s*wraps\b|\bkind\/wraps\b/, written: 'the payload a kind accepts, the command `accepts`', by: 'D450'

$ qplay '::kind | manifest | get [~(has ::kind/wraps) ~(has ::kind/accepts)]' < /dev/null
[false true]
```

### archaism · core/test/conformance/QSQUO/apply.jsonl:23

«open-runs-a-quote-from-null» с запросом `~(it) | answer`. Ещё одиннадцать кейсов «…-opens-to-…» запускают `parse | answer`.

Слой: имена держат модель, где цитату из null запускал `open`. Теперь `open` открывает страницу ссылки и цитату отвергает, а запускает её `answer`.
Чистый лист: «answer-runs-a-quote-from-null», «…-read-by-parse-answers-…».

```
$ qplay 'get [~(~(it) | answer) ~(~(it) | open !| tag)]' < /dev/null
[null ::link/open/SubjectNotLinkError]

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -o -E "\"name\":\"[a-z-]*open[a-z-]*\"" -- core/test/conformance/QSQUO/apply.jsonl
core/test/conformance/QSQUO/apply.jsonl:1:"name":"a-number-literal-read-by-parse-opens-to-the-number"
core/test/conformance/QSQUO/apply.jsonl:2:"name":"a-string-literal-read-by-parse-opens-to-the-string"
core/test/conformance/QSQUO/apply.jsonl:3:"name":"a-keyword-literal-read-by-parse-opens-to-the-keyword"
core/test/conformance/QSQUO/apply.jsonl:4:"name":"a-vector-literal-read-by-parse-opens-to-the-vector"
core/test/conformance/QSQUO/apply.jsonl:5:"name":"a-map-literal-read-by-parse-opens-to-the-map"
core/test/conformance/QSQUO/apply.jsonl:6:"name":"a-set-literal-read-by-parse-opens-to-the-set"
core/test/conformance/QSQUO/apply.jsonl:7:"name":"a-source-that-starts-from-a-number-opens-to-its-answer"
core/test/conformance/QSQUO/apply.jsonl:8:"name":"a-source-that-filters-and-counts-a-vector-opens-to-the-count"
core/test/conformance/QSQUO/apply.jsonl:9:"name":"a-source-that-reads-a-field-of-its-map-opens-to-the-field"
core/test/conformance/QSQUO/apply.jsonl:10:"name":"a-source-that-maps-its-vector-opens-to-the-images"
core/test/conformance/QSQUO/apply.jsonl:11:"name":"a-source-that-catches-its-own-failure-opens-to-the-catch"
core/test/conformance/QSQUO/apply.jsonl:23:"name":"open-runs-a-quote-from-null"
```

### archaism · core/test/conformance/QSERR/flow.jsonl:31

«a-full-application-whose-subject-is-an-error-answers-it» с запросом `5 | mul (!{:k 1} | raise) 2`.

Слой: имя держит модель «полного применения», где `mul a b` перемножал два аргумента в обход субъекта. Сейчас субъект всегда значение в трубе, лишний аргумент отвергается, а кейс отвечает `1` только потому, что сбой модификатора приходит раньше проверки арности. Соседний flow.jsonl:35 называет это правило своими словами.
Чистый лист: такого кейса нет (его правило держит flow.jsonl:35), а слово «full application» не встречается ни в главе, ни на странице, ни в коде.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -E "a-full-application|an-error-among-the-modifiers-answers-before" -- core/test/conformance/QSERR/flow.jsonl
core/test/conformance/QSERR/flow.jsonl:31:{"name":"a-full-application-whose-subject-is-an-error-answers-it","query":"5 | mul (!{:k 1} | raise) 2 !| get /k","expect":"1"}
core/test/conformance/QSERR/flow.jsonl:35:{"name":"an-error-among-the-modifiers-answers-before-the-args-meet-the-arity","query":":number/s (::fn | takes :k |~~ The k. ~~| /0 ::number | impl ~(mul k)); 5 | s (!{:k 1} | raise) 2 !| tag","expect":"::error"}

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -i -E "full application|partial application" -- docs/spec core/lib core/src

$ qplay 'get [~(5 | mul 3 2 !| tag) ~(5 | mul (!{:k 1} | raise) 2 !| get /k)]' < /dev/null
[::number/mul/ArgsBeyondInputsError 1]
```

### archaism · core/test/conformance/QSBLD/recipe.jsonl:2

«a-recipe-reads-no-value-of-a-sentence», «a-value-the-sentence-names-reaches-no-selector-of-a-verb» и ещё четыре: «a-body-begun-on-a-later-line-is-a-sentence» (QSSYN/line.jsonl:11).

Слой: «sentence» — прежнее имя текста (объявления и запрос); QSSYN#step теперь говорит «A text…». Сегодня то же слово значит прозу утверждения закона (law.qlang:7), а в `parse.mjs:20` — сообщение отказа, которое хранится рядом с `message` (`this.sentence`): одно слово на три вещи.
Чистый лист: в кейсах «text», в парсере одно поле `message`.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -c -w -i sentence -- core/test/conformance core/lib docs/spec/QSSYN-grammar.md docs/spec/QSNAM-names-and-scope.md docs/spec/QSBLD-functions-and-kinds.md; git grep -c -w -E "A text|a text|its text" -- docs/spec/QSSYN-grammar.md docs/spec/QSNAM-names-and-scope.md
core/lib/qlang/any.qlang:1
core/lib/qlang/law.qlang:1
core/test/conformance/QSBLD/recipe.jsonl:5
core/test/conformance/QSSYN/line.jsonl:1
docs/spec/QSNAM-names-and-scope.md:7
docs/spec/QSSYN-grammar.md:7

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -w sentence -- core/lib core/src/parse.mjs core/src/error-convert.mjs
core/lib/qlang/any.qlang:1368:      page, the sentence of the claim, and its query, which answers
core/lib/qlang/law.qlang:7:      proves, its page the sentence of the claim. The chain of a function
core/src/error-convert.mjs:58:  if (parseError.sentence) d.set('message', parseError.sentence);
core/src/parse.mjs:20:    this.sentence = opts.sentence ?? null;
core/src/parse.mjs:42:    const sentence = unclosed?.message ?? (atTheEnd ? stepMissedAtTheEnd(source) : undefined);
core/src/parse.mjs:44:    throw new SourceParseError(sentence ?? (err.expected === null ? err.message : expectedSentence(err.expected, err.found)), location, opts.uri ?? null, {
core/src/parse.mjs:48:      sentence
```

### vestige · core/src/runtime/lang-runtime.mjs:39

«export async function langRuntime(opts = {})» возвращает «new Map(templateScope)».

Слой: имя называет то, чем значение не является. Глава зовёт runtime «the evaluator with its table of primitives» (QSHST:99) и сама вынуждена пояснять «`langRuntime` answers the scope of the root». Внутри `templateScope` занимает слово языка «template» (шаблон `get`) под копию корня.
Чистый лист: `rootScope()` с внутренним «pristine root», без «runtime» и «template».

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -E "templateScope|_templateScopeByLocator = " -- core/src/runtime/lang-runtime.mjs; git grep -n -F "answers the scope of the root" -- docs/spec
core/src/runtime/lang-runtime.mjs:36:const _templateScopeByLocator = new WeakMap();
core/src/runtime/lang-runtime.mjs:41:  let templatePromise = _templateScopeByLocator.get(locator);
core/src/runtime/lang-runtime.mjs:44:    _templateScopeByLocator.set(locator, templatePromise);
core/src/runtime/lang-runtime.mjs:46:  const templateScope = await templatePromise;
core/src/runtime/lang-runtime.mjs:47:  return new Map(templateScope);
core/src/runtime/lang-runtime.mjs:62:  const templateScope = await declareRoot(new Map(), sources);
core/src/runtime/lang-runtime.mjs:64:  return templateScope;
docs/spec/QSHST-hosts.md:215:caller; and `langRuntime` answers the scope of the root. A host puts its
```

### archaism · core/src/dispatch.mjs:1

Модуль `dispatch.mjs` держит `walkToKinds`, `subjectOfCall`, `runPrimitive` и двери. Рядом `dispatchQlangValue(pipeValue, handlers, …)` — переключатель принтера и кодека JSON по форме значения. Заголовок теста: «the axes resolve the binding the evaluator dispatches» (`core/test/unit/QSSLF/axis.test.mjs:95`).

Слой: «dispatch» — термин модели ООП-диспетчеризации. В главах и каталоге его нет ни разу (там «walk» и «residence»), а в коде он закрывает два разных смысла, причём параметр принтера назван `pipeValue`.
Чистый лист: модуль назван словом главы (walk), а переключатель принтера — по тому, что он делает, «by the form of a value».

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -c -i dispatch -- docs/spec core/lib core/src; git grep -n "function dispatchQlangValue" -- core/src
core/src/eval-trace.mjs:1
core/src/eval.mjs:1
core/src/index.mjs:1
core/src/notebook.mjs:1
core/src/print-value.mjs:2
core/src/runtime/json.mjs:4
core/src/runtime/predicates.mjs:1
core/src/print-value.mjs:23:export function dispatchQlangValue(pipeValue, handlers, ...extraArgs) {
```

### subordination · core/src/name-chars.mjs:9

«const UNIT = '(?![\\u{10000}-\\u{10FFFF}])';» под меткой «// [QSLSP#extension]». Заголовок теста: «…as the parser reads a character a code unit».

Слой: правило языка о буквах имени зависит от того, что генератор парсера читает code unit (`c:.`). Поэтому готская буква имени не начинает, хотя глава говорит «a letter of any script», а регекс, экспортированный ядром для редактора, повторяет это ограничение.
Чистый лист: грамматика читает code point, и одна регулярка букв имени служит и парсеру, и редактору.

```
$ qplay 'apply ~(:𐌰 5; 𐌰)' < /dev/null | head -3
|~| raised, and no !| caught it
::quote/ParseError!{
  :source "apply ~(:𐌰 5; 𐌰)"

$ qplay 'get [~(apply ~(:имя 5; имя)) ~(:"𐌰" | tag) ~("𐌰" | count)]' < /dev/null
[5 ::keyword 1]

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -E "QSLSP#extension|const UNIT|NAME_REGEX = " -- core/src/name-chars.mjs; git grep -n -F "begins with a letter of any script" -- docs/spec; git grep -n -F "as the parser reads a character a code unit" -- core/test
core/src/name-chars.mjs:1:// [QSNAM#letters], [QSLSP#extension]
core/src/name-chars.mjs:8:// [QSLSP#extension]
core/src/name-chars.mjs:9:const UNIT = '(?![\\u{10000}-\\u{10FFFF}])';
core/src/name-chars.mjs:10:export const NAME_REGEX = new RegExp(`${UNIT}${START}(?:${UNIT}${CONTINUE})*`, 'u');
docs/spec/QSNAM-names-and-scope.md:86:A name a step can call begins with a letter of any script or `_` and
core/test/unit/QSNAM/letters.test.mjs:14:  it('reads no letter past the first plane of Unicode in the regex of a name, as the parser reads a character a code unit', async () => {
```

### archaism · core/test/conformance/QSPTH/key.jsonl:7

«query-json-object-string-key» с запросом `::json{:a 1 :b 2 :c 3} | query "b"`. Рядом «a-key-json-lacks-is-refused» (QSPTH/get.jsonl:4) — там запрос `{:a 1} | get /b`, и JSON в нём нет вовсе.

Слой: кейсы держат модель, где объект JSON был значением особого вида `::json`. Сегодня JSON — синтаксис карты, а `::json` — тег, который не объявляет ни одна декларация.
Чистый лист: `{"a": 1, "b": 2} | query "b"` под именем вроде «query-reads-a-string-key-of-a-map», а у второго кейса «a-key-a-map-lacks-is-refused».

```
$ qplay 'get [~(::json{:a 1 :b 2 :c 3} | tag) ~(::json | doc !| tag) ~({"a": 1} | tag)]' < /dev/null
[::json ::any/doc/UnknownNameError ::map]

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -E "query-json-object-string-key|a-key-json-lacks-is-refused" -- core/test/conformance/QSPTH
core/test/conformance/QSPTH/get.jsonl:4:{"name":"a-key-json-lacks-is-refused","query":"{:a 1} | get /b","raises":"::path/KeyNotInMapError!{\n  :found {:a 1}\n  :key :b\n  :nearest [:a]\n  :path /b\n  :trace ::trace[::frame[{:a 1} ~(get /b)]]\n}"}
core/test/conformance/QSPTH/key.jsonl:7:{"name":"query-json-object-string-key","query":"::json{:a 1 :b 2 :c 3} | query \"b\"","expect":"2"}
```

### archaism · core/test/conformance/QSSLF/axis.jsonl:21

«docs-not-found-names-the-docs-axis», «not-found-carries-the-binding-name», «a-docs-refusal-names-the-tags-near-its-name» (QSSLF/near.jsonl:5).

Слой: имена держат модель, где была ось `docs`, отказ «not found» и факт «binding name». Сейчас ось называется `doc`, отказ — `::any/doc/UnknownNameError`, факт — `name`.
Чистый лист: «doc-refuses-a-tag-nothing-declares-as-an-unknown-name», «…carries-the-name-asked».

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -o -E "\"name\":\"(docs-not-found[a-z-]*|not-found-carries[a-z-]*|a-docs-refusal[a-z-]*)\",\"query\":\"[^\"]*\"" -- core/test/conformance/QSSLF
core/test/conformance/QSSLF/axis.jsonl:21:"name":"docs-not-found-names-the-docs-axis","query":"::nosuchbinding | doc !| tag"
core/test/conformance/QSSLF/axis.jsonl:22:"name":"not-found-carries-the-binding-name","query":"::nosuchbinding | source !| name"
core/test/conformance/QSSLF/near.jsonl:5:"name":"a-docs-refusal-names-the-tags-near-its-name","query":"::strng | doc !| nearest | has ::string"

$ qplay 'get [~(::nosuchbinding | doc !| tag) ~(::any | manifest | get [~(has ::any/doc) ~(has ::any/docs)])]' < /dev/null
[::any/doc/UnknownNameError [true false]]
```

### drift · core/test/conformance/QSSYN/refusal.jsonl:33

«a-line-past-the-excerpt-of-an-alert-is-cut-around-the-point…»; заголовок теста: «cuts a line past the excerpt of an alert…» (`core/test/unit/QSSYN/refusal.test.mjs:68`).

Слой: «excerpt» здесь обозначает комнату факта, триста символов, которую QSSYN#refusal так и называет — «the room of a fact of an alert». Но `::excerpt` — это карта фактов сбоя, напечатанного сверх комнат: одно слово на две вещи.
Чистый лист: «a-line-past-the-room-of-a-fact-is-cut-around-the-point».

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -o -E "a-line-past-the-excerpt-of-an-alert|cuts a line past the excerpt of an alert|the room of a fact of an alert" -- core/test/conformance/QSSYN/refusal.jsonl core/test/unit/QSSYN/refusal.test.mjs docs/spec/QSSYN-grammar.md
core/test/conformance/QSSYN/refusal.jsonl:33:a-line-past-the-excerpt-of-an-alert
core/test/unit/QSSYN/refusal.test.mjs:68:cuts a line past the excerpt of an alert

$ qplay 'get [~(::excerpt | doc | content | lines | first) ~(::qlang | doc | content | contains "three hundred characters")]' < /dev/null
["An excerpt tells the facts of a failure a host prints past the room" true]
```

### drift · core/lib/qlang/host.qlang:31

«Answers the screen of the host a session is in, its state in sections». На странице `::host` из первого экрана: «`::host | status` shows its screen». Кейс QSNAM/binding.jsonl:20 — «…answers-its-kinds-its-env-and-its-status».

Слой: «screen» разом значит печать первых страниц («the first screen»), экран работы («The screen of the work, `npm run desk`») и секции состояния хоста — одно слово на три вещи, которые читатель примет за одну. Сам `::host | status` не формулирует ни одна глава.
Чистый лист: у каждой из трёх вещей своё слово, и раздел QSHST говорит, что отвечает `status`.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -w -i screen -- core/lib/qlang.qlang core/lib/qlang/host.qlang docs/spec/QSVOX-the-texts-and-their-voices.md docs/spec/QSPRN-printing-and-codecs.md
core/lib/qlang.qlang:2:   its page, the first screen a session reads, the refusal of an answer
core/lib/qlang.qlang:964:            host writes, `::host | status` answers its screen, the sections
core/lib/qlang/host.qlang:2:   page, which the host writes, its screen, the kinds that lie on it and
core/lib/qlang/host.qlang:11:      `:host |~~ … ~~|;`. `::host | status` answers its screen, the
core/lib/qlang/host.qlang:31:  |~~ Answers the screen of the host a session is in, its state in
docs/spec/QSPRN-printing-and-codecs.md:279:`count` counts a string, which is never smaller than the first screen,
docs/spec/QSVOX-the-texts-and-their-voices.md:15:The screen of the work, `npm run desk`, and the sensors under
docs/spec/QSVOX-the-texts-and-their-voices.md:67:the screen of the work, the aim and the records in transit and open, where

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -i -E "host \| status|::host/status" -- docs/spec
```

### drift · playground/lib/qlang/playground.qlang:12

«`qplay -i ['<query>']` opens a session of cells» — со страницы `::host` первого экрана.

Слой: здесь REPL назван сессией, хотя QSLEX#grep оставляет «session» только для разговора модели, а клетки хоста называет «a notebook». Первый экран так склеивает два понятия, которые читатель модели примет за одно.
Чистый лист: «opens a REPL, a notebook of cells, the query its first».

```
$ qplay '::host | doc | content | lines | filter ~(contains "session")' < /dev/null
["`qplay -i ['<query>']` opens a session of cells, the query its first,"]

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -e "the conversation of a model alone" -e "and a notebook the cells a host runs over one scope" -- docs/spec
docs/spec/QSLEX-the-words-and-the-names.md:54:the conversation of a model alone, the word of the harness its transcripts
docs/spec/QSLEX-the-words-and-the-names.md:55:are read by, and a notebook the cells a host runs over one scope
```

### shim · core/src/steps.mjs:92

«const TEMPLATE_WITHIN = 80;» — рядом с «export const LINE_WIDTH = 80;» (print-value.mjs:154).

Слой: один факт, ширина строки, записан дважды. `steps.mjs` не может импортировать принтер (принтер сам импортирует `steps.mjs`), и число скопировали, хотя QSLIT#closed называет это «a line, eighty characters».
Чистый лист: ширина строки — одна константа в модуле ниже обоих, откуда её читают и шаблон отказа, и принтер.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -E "TEMPLATE_WITHIN = |LINE_WIDTH = " -- core/src; git grep -n -F "a template past a line, eighty" -- docs/spec
core/src/print-value.mjs:154:export const LINE_WIDTH = 80;
core/src/steps.mjs:92:const TEMPLATE_WITHIN = 80;
docs/spec/QSLIT-values-and-literals.md:221:`get [::Box[~(x)] 1]` [QSPTH#template], a template past a line, eighty
```

### shim · core/src/scope-keys.mjs:2

«export const TAG_SIGIL = '::';» — знак тега живёт в модуле ключей области видимости. Обходят его `errors.mjs` («super(`::${address}`, facts)») и `root.mjs` («const DECLARED_TWICE = '::bind/NameDeclaredTwiceError';»).

Слой: литерал языка лежит не под своим понятием и написан в трёх модулях. Адрес `bind/NameDeclaredTwiceError` к тому же повторён строкой, хотя `BindNameDeclaredTwiceError` (errors.mjs:90) его уже держит.
Чистый лист: знак тега определён рядом с `makeTag`, а адрес отказа выводится из `makeTag(address).literal` и класса отказа.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -E "TAG_SIGIL = |DECLARED_TWICE = |super\(.::" -- core/src
core/src/errors.mjs:45:      super(`::${address}`, facts);
core/src/runtime/root.mjs:30:const DECLARED_TWICE = '::bind/NameDeclaredTwiceError';
core/src/scope-keys.mjs:2:export const TAG_SIGIL = '::';
```

### vestige · core/src/runtime/bootstrap.mjs:17

«qlang bootstrap: '#…' must resolve to a source of the language — add an entry to package.json#imports or the import map».

Слой: сообщение дефекта загрузки называет механизмы платформ — `package.json#imports` Node и import map браузера. Глава требует «The refusals of the boot stand under `::builtin` and name no platform», и страница этого же отказа платформ не называет.
Чистый лист: сообщение говорит словами страницы: хост показывает, где стоят источники, или передаёт свой локатор.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -e "The refusals of the boot stand under" -e "no platform:" -- docs/spec/QSHST-hosts.md; git grep -n -e "qlang bootstrap:" -e "package.json#imports or the import map" -- core/src
docs/spec/QSHST-hosts.md:132:its package. The refusals of the boot stand under `::builtin` and name
docs/spec/QSHST-hosts.md:133:no platform: `::builtin/SourceLoadError` holds `:origin`, the source, as
core/src/runtime/bootstrap.mjs:17:  ({ origin }) => `qlang bootstrap: '#${origin.name}' must resolve to a source of the language — ` +
core/src/runtime/bootstrap.mjs:18:    'add an entry to package.json#imports or the import map');

$ qplay '::builtin/BootstrapSourceMissingError | doc | content' < /dev/null
A source of the language resolved to nothing, so the root
lacks what it declares; `:origin` names the source. The host
maps the source where its package says the sources of the
language stand, or hands the runtime a locator of its own.
```

### vestige · playground/test/integration/QSCLI/repl.test.mjs:4

«starts the REPL by -i, prompts, and closes with the code 0 on .exit» и «lists the commands of the REPL on .help and stays open» (:26).

Слой: REPL держит мета-команды по привычке REPL Node (`.exit`, `.help`) и вторую справку в JS-строке `REPL_HELP` рядом со страницей `::host`. Ни мета-команд, ни клавиши `Ctrl+J` из этой справки нет ни в одной главе и ни на одной странице.
Чистый лист: REPL закрывается по Ctrl+D, как сказано в QSCLI#line-editor, а справка — одна, страница `::host | doc`.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -F -e ".exit" -e ".help" -e "Meta commands" -- playground/src/repl.mjs playground/test/integration/QSCLI/repl.test.mjs docs/spec/QSCLI-the-command-line.md
playground/src/repl.mjs:20:const REPL_HELP = `Meta commands:
playground/src/repl.mjs:21:  .help    list meta commands
playground/src/repl.mjs:22:  .exit    close the REPL (Ctrl+D on an empty line works too)
playground/src/repl.mjs:104:      if (line === '.exit') {
playground/src/repl.mjs:108:      if (line === '.help') {
playground/test/integration/QSCLI/repl.test.mjs:4:it('starts the REPL by -i, prompts, and closes with the code 0 on .exit', async () => {
playground/test/integration/QSCLI/repl.test.mjs:5:  const { exitCode, stderr } = await runCli(['-i'], { stdin: '.exit\n' });
playground/test/integration/QSCLI/repl.test.mjs:12:    stdin: '42 | mul 2\n.exit\n'
playground/test/integration/QSCLI/repl.test.mjs:20:    stdin: ':any/double ~(mul 2)\n21 | double\n.exit\n'
playground/test/integration/QSCLI/repl.test.mjs:26:it('lists the commands of the REPL on .help and stays open', async () => {
playground/test/integration/QSCLI/repl.test.mjs:28:    stdin: '.help\n.exit\n'
playground/test/integration/QSCLI/repl.test.mjs:31:  expect(stdout).toMatch(/Meta commands/);
playground/test/integration/QSCLI/repl.test.mjs:32:  expect(stdout).toMatch(/\.exit/);

$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -F -e "Ctrl+J" -e "meta command" -- docs/spec playground/lib playground/src/repl.mjs
playground/src/repl.mjs:21:  .help    list meta commands
playground/src/repl.mjs:26:  Ctrl+Enter / Ctrl+J insert a soft newline at the cursor — keep
```

### pentimento · playground/test/QSCLI/answer.test.mjs:71

«refuses --json, JSON read by `::stdio | in | parseJson`» и «refuses --raw, a text read as it came by `in`» (:75).

Слой: заголовки хранят историю — отдельно проверено отсутствие двух выведенных флагов и рассказано, что пришло им на смену. Это противопоставление тому, чего в дереве нет. Правило главы и так отвергает любой незнакомый флаг с двумя дефисами, и её проба проверяет `--width=80`.
Чистый лист: один тест правила на флаге, которого не было ни в одном дереве.

```
$ cd D:/git/qlang-worktrees/closeout-pentimento && git grep -n -E "refuses --(json|raw)|--width" -- playground/test/QSCLI/answer.test.mjs
playground/test/QSCLI/answer.test.mjs:71:  it('refuses --json, JSON read by `::stdio | in | parseJson`', () => {
playground/test/QSCLI/answer.test.mjs:75:  it('refuses --raw, a text read as it came by `in`', () => {

$ qplay --json '1' < /dev/null 2>&1
qplay: --json is no flag of the playground, which `qplay --help` lists
```
