> A pentimento audit of cases--core for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `9778080c`, on the baseline `9780e1ed`; run 2026-10-30, 15:12–15:42 UTC. A path it names reads as `git show 9778080c:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### shim · core/src/eval.mjs:416

«for (const key of facts.keys()) if (key.endsWith(EXPECTED_OF_A_SLOT)) return key.slice(0, -EXPECTED_OF_A_SLOT.length);» и на :394 «const written = modifiers.findIndex(modifier => isPath(modifier) …».

Слой: `:repair` отказа по пути не хранится вызовом, а заново вычисляется из того значения, которое вызов вернул. Слот ищется по суффиксу `/expected` в ключе факта, модификатор — по первому пути с теми же сегментами. Это прямо нарушает [QSREQ#rigor] «a fact of a call is kept by the call and never by a value it received». Если путь в вызове написан дважды, ремонт переписывает тот модификатор, который вызов как раз принял.

Чистый лист: вызов сам помнит отказавший вход и индекс модификатора, который этот вход прочёл, и по нему пишет `:repair`; из фактов ничего обратно не читается.

```
> :map/twice (::fn | takes :at |~~ The path. ~~| /0 | takes :n |~~ The factor. ~~| /1 ::number | impl ~(get at | mul n)); {:a 2} | get [(twice /a /a !| get [tag repair]) (twice /a (get /a))] < /dev/null
[[::map/twice/NKindNotTakenError ~(twice (get /a) /a)] 4]
```
```
$ git grep -n -E "EXPECTED_OF_A_SLOT\.length|modifiers\.findIndex" -- core/src/eval.mjs | cut -c1-110
core/src/eval.mjs:394:  const written = modifiers.findIndex(modifier => isPath(modifier)
core/src/eval.mjs:416:  for (const key of facts.keys()) if (key.endsWith(EXPECTED_OF_A_SLOT)) return key.slice
```

### vestige · core/src/steps.mjs:190

«fields: { name: isKeyword, modifiers: vecOfOneAtLeast(isWord) }, required: ['name']» (то же для `BIND` и `CONSTRUCT`).

Слой: у записей языка два механизма полей.
- `::call`, `::bind` и `::construct` держат поля во второй таблице JavaScript и отказывают общим `…/PayloadNotSchemaError :field`.
- `::binding`, тоже запись языка, держит свои пять частей цепочкой своего вида (`wires`) и отказывает по роли.

«Schema» после `Not` не называет ни вида, ни ролей, как требует [QSERR#site], и этого слова нет ни в одной главе и ни на одной странице. `legend` шага не называет ни одного поля, хотя [QSPRN#legend] обещает части каждого вида.

Чистый лист: один механизм — поля записей шагов объявляет цепочка вида, как у `::binding`. Тогда `legend` и `manifest` их называют, а отказ называет часть по роли.

```
> get [(::binding{:name :rate} !| tag) (::bind{:name :rate} !| get [tag field]) (::call{:name 1} !| get [tag field])] < /dev/null
[::binding/DocsNotGivenError [::bind/PayloadNotSchemaError :body] [::call/PayloadNotSchemaError :name]]

> [::call ::bind ::construct ::binding] | map (legend | print | lines | count) < /dev/null
[1 1 1 6]
```
```
$ git grep -n -i -w -E "schemas?" -- core/lib docs/spec
core/lib/qlang/string.qlang:1143:        ~("#/components/schemas" | toPath | print | eq "/components/schemas")
```

### archaism · lsp/test/showcase.qlang:59

«A quote, `~(…)`, is code: `apply` runs it on the value in the pipe, `map` on each element, `filter` to keep the elements it holds of.» и на :98 «A quote of one word names the verb the fold calls with the element as its first arg».

Слой: витрина языкового сервера учит модели, в которой код передавался цитатой. Цитату, написанную в шаге, язык отвергает во всех четырёх названных глаголах, а примеры под этими строками сами пишут код голым. Это добавка к слою «the model of the quote of one word» из части 13 D339.

Чистый лист: код пишется голым, `map (mul 2)`; цитата — это код, хранимый как значение, который имя передаёт глаголу: `:double ~(mul 2); [1 2] | map double`.

```
> get [(5 | apply ~(add 1) !| tag) ([1 2 3] | map ~(mul 2) !| tag) ([1 2 3] | filter ~(gt 1) !| tag) ([1 2 3] | reduce 0 ~add !| tag)] < /dev/null
[::any/apply/CodeQuotedError ::vec/map/CodeQuotedError ::vec/filter/PredicateQuotedError ::vec/reduce/ReducerQuotedError]
```
```
$ git grep -n -o -E "A quote(, .~\(…\)., is code| of one word names the verb the fold calls)" -- lsp/test/showcase.qlang
lsp/test/showcase.qlang:59:A quote, `~(…)`, is code
lsp/test/showcase.qlang:98:A quote of one word names the verb the fold calls
```

### subordination · core/src/parse.mjs:78

«return `Expected ${listed} but ${…} found.`;» (parse.mjs:81).

Слой: ядро сочиняет второй рассказ того же отказа — английскую фразу в форме сообщения peggy. Её несёт только JS-сообщение `SourceParseError`. Отказ языка `::quote/ParseError` в этом случае держит `:expected` и `:found` и никакого `:message` ([QSSYN#refusal]). Фразу читают диагностика языкового сервера и три теста.

Чистый лист: рассказ один — факты отказа языка; сервер строит диагностику из них, и ядро не держит предложение для инструмента.

```
> "\"a\" | :" | parse !| get [(payload | keys) expected] < /dev/null
[[:source :marker :expected :location :origin :trace] ["\"" :name]]
```
```
$ git grep -n -F "message: e.message," -- lsp/src/features.mjs
lsp/src/features.mjs:98:        message: e.message,

$ git grep -c -F "found.');" -- core/test/unit/QSSYN/refusal.test.mjs
core/test/unit/QSSYN/refusal.test.mjs:3
```

### drift · core/src/grammar.peggy:853

«error('the words of a literal are set off by whitespace: `[1 2]`')».

Слой: здесь «the words of a literal» — это элементы контейнерного литерала. Во всех остальных текстах этими словами называют `true`, `false` и `null`: в главах, в каталоге и в соседнем отказе `steps.mjs:167`. Добавка к `word` из части 13 D339: два смысла одной фразы звучат в двух отказах одного парсера.

Чистый лист: «the elements of a literal are set off by whitespace», как [QSLIT#json] говорит «A vector separates its elements».

```
> get [("[1[2]]" | parse !| message) (":true 5 | 7" | parse !| message)] < /dev/null
["the words of a literal are set off by whitespace: `[1 2]`" "`:true` is the word of a literal, which a step reads as the value: declare another name"]
```
```
$ git grep -c -i -E "words? of (a|the) literals?" -- docs/spec core/lib core/src
core/lib/qlang/any.qlang:1
core/lib/qlang/bind.qlang:2
core/lib/qlang/call.qlang:2
core/lib/qlang/fn.qlang:2
core/lib/qlang/kind.qlang:2
core/src/grammar.peggy:1
core/src/steps.mjs:1
docs/spec/QSBLD-functions-and-kinds.md:2
docs/spec/QSLIT-values-and-literals.md:2
docs/spec/QSNAM-names-and-scope.md:2
docs/spec/QSPTH-paths.md:1
```

### archaism · core/src/parse.mjs:27

«'parse() expects a string source'».

Слой: сообщение написано 2026-04-14 и называет функцию `parse()`. Этот экспорт 2026-10-24 переименован в `parseSource` (95169244). Сообщение доходит до языка как `:message` отказа `::quote/ParseError`, когда хост отдаёт ячейке не строку (`core/test/unit/QSQUO/parse.test.mjs:16-19`). Читатель примет его за глагол `parse`, а тот отвергает не-строку иначе.

Чистый лист: сообщение словами языка о том, что вручил хост, без имени функции JavaScript.

```
> 42 | parse !| tag < /dev/null
::string/parse/SubjectNotStringError
```
```
$ git grep -n -F "parse() expects a string source" -- core/src core/test
core/src/parse.mjs:27:      'parse() expects a string source',
core/test/unit/QSQUO/parse.test.mjs:12:    expect(refused.message, String(source)).toBe('parse() expects a string source');
core/test/unit/QSQUO/parse.test.mjs:18:  const refusal = makeErrorValue(makeTag('quote/ParseError'), new Map([['message', 'parse() expects a string source']]));

$ git log --format="%h %ad" --date=short -S "export function parseSource" -- core/src/parse.mjs
95169244 2026-10-24
```

### archaism · core/src/chain.mjs:278

«function placeOf(selector)», «export function wiringAtPlaces(kind)» (:268), «place: placeOf(selector)» (:201).

Слой: D437 убрала слово `place` «whole, in every spelling» в пользу `selector`, но оно живёт в 34 строках пяти модулей ядра (`partAtThePlace`, `atPlaces`, `wiringAtPlaces`). Причина в том, что проверка (17) в `scripts/check-conventions.mjs` читает только комментарии и прозу, но не идентификаторы. При этом тест лексикона отвергает ровно такие имена. Два `placeOf` к тому же значат разное: в chain.mjs:278 — путь чтения поля, в rooms.mjs:32 — запись алерта.

Чистый лист: слова, которые записала D437, — `selector` и его чтение, а у записи факта в `rooms.mjs` — своё имя.

```
$ git grep -c -P "\b[pP]laces?\b|(?<=[a-zA-Z])Places?(?![a-z])|\bplaces?(?=[A-Z])" -- core/src
core/src/chain.mjs:5
core/src/eval.mjs:3
core/src/rooms.mjs:16
core/src/runtime/legend-primitives.mjs:8
core/src/runtime/root.mjs:2

$ git grep -n -E "placeOf = |function placeOf" -- core/src
core/src/chain.mjs:278:function placeOf(selector) {
core/src/rooms.mjs:32:const placeOf = (name, value) => ({ name, value, entries: [], parts: [] });

$ git grep -n -o -F "'placeIn', 'mergedPlaces', 'MISSED_PLACE'" -- core/test/unit/QSLEX/term.test.mjs
core/test/unit/QSLEX/term.test.mjs:11:'placeIn', 'mergedPlaces', 'MISSED_PLACE'
```

### archaism · core/src/grammar.peggy:413

«LinePlainComment … { recordComment('LinePlainComment', content); }», а также `BlockPlainComment`, `NestedLinePlainSpan`, `QuoteBlockPlainSpan`.

Слой: «plain comment», который D347 заменила на «a comment», живёт в именах правил и в поле `type` записей `root.comments`. Эти записи несут ещё `content` и `text`, но ни один модуль их не читает: художник берёт только `location` (`highlight.mjs:42`). Держит их лишь тест.

Чистый лист: правила `LineComment` и `BlockComment`, а в записи комментария — только пролёт, который красят инструменты.

```
$ git grep -c -F "PlainComment" -- core/src core/test lsp/src playground/src site/src
core/src/grammar.peggy:9
core/test/unit/QSSYN/comment.test.mjs:2

$ git grep -n -o -E "root\.comments|comment\.type|comment\.content" -- core/src core/test lsp/src playground/src site/src stdio/src
core/src/highlight.mjs:42:root.comments
core/src/parse.mjs:55:root.comments
core/test/unit/QSSYN/comment.test.mjs:10:comment.type
core/test/unit/QSSYN/comment.test.mjs:10:comment.content

$ git grep -n -F "plain comments" -- scripts/retired-words.mjs
scripts/retired-words.mjs:15:  { regex: /\bplain comments?\b/i, written: 'a comment', by: 'D347' },
```

### archaism · core/src/steps.mjs:186

«const isWord = value => holdsALiteral(value) || isGroupStep(value) || (isCallStep(value) && !value.has('modifiers'));».

Слой: это точное имя, которое D352 убрала, и тест лексикона числит его среди отвергнутых. Здесь оно получило третий смысл — модификатор вызова. Та же щель проверки держит `TAG_SIGIL` (scope-keys.mjs:2) — слово, которое D347 убрала. Рядом знак тега по-прежнему пишется сырым ещё в трёх модулях; это добавка к «the sign of a tag» из части 13 D339.

Чистый лист: `isModifier`, а знак тега берётся из `makeTag(name).literal`, без константы под отменённым словом.

```
$ git grep -n -o -w -E "isWord" -- core/src core/test/unit/QSLEX/term.test.mjs
core/src/steps.mjs:186:isWord
core/src/steps.mjs:192:isWord
core/test/unit/QSLEX/term.test.mjs:32:isWord

$ git grep -n -F "bisWord" -- scripts/retired-words.mjs
scripts/retired-words.mjs:20:  { regex: /\bisWord\b/, written: 'whether a name under a label is a verb, `isVerb`', by: 'D352' },

$ git grep -n -E "TAG_SIGIL = |'::bind/|::quote\[|super\(.::" -- core/src
core/src/errors.mjs:45:      super(`::${address}`, facts);
core/src/print-value.mjs:65:  return isPathAlone(quote) ? `::quote[${printPath(quote[0])}]` : '~(' + printQuoteSource(quote, view) + ')';
core/src/runtime/root.mjs:30:const DECLARED_TWICE = '::bind/NameDeclaredTwiceError';
core/src/scope-keys.mjs:2:export const TAG_SIGIL = '::';

$ git grep -n -F "bsigils" -- scripts/retired-words.mjs
scripts/retired-words.mjs:14:  { regex: /\bsigils?\b/i, written: 'the sign of a literal', by: 'D347' },
```

### archaism · core/test/conformance/QSCOL/reduce.jsonl:9

«reduce-folds-with-the-quote-of-a-bare-word» над запросом `reduce 0 add`; «a-quote-of-one-word-after-a-leading-pipe-is-the-short-form» над `reduce 0 (| add)` (:28); заголовок «folds by the one call of a quote…» над `reduce 0 (add)` (`core/test/unit/D417.test.mjs:10`).

Слой: имена держат модель, где свёртка получала цитату одного слова. Запросы под ними пишут код голым, а цитату в этом шаге язык отвергает. Это добавка к слою части 13 D339.

Чистый лист: имена по правилу [QSCOL#reduce] и словами языка: короткая форма — это шаг кода из одного вызова без модификаторов, написанный голым.

```
> [1 2 3] | reduce 0 ~add !| tag < /dev/null
::vec/reduce/ReducerQuotedError
```
```
$ git grep -n -o -E "\"name\":\"[^\"]*quote[^\"]*\",\"query\":\"[^\"]*\"" -- core/test/conformance/QSCOL/reduce.jsonl
core/test/conformance/QSCOL/reduce.jsonl:9:"name":"reduce-folds-with-the-quote-of-a-bare-word","query":"[1 2 3] | reduce 0 add"
core/test/conformance/QSCOL/reduce.jsonl:28:"name":"a-quote-of-one-word-after-a-leading-pipe-is-the-short-form","query":"[1 2 3] | reduce 0 (| add)"

$ git grep -n -o -F "folds by the one call of a quote" -- core/test/unit/D417.test.mjs
core/test/unit/D417.test.mjs:10:folds by the one call of a quote
```

### vestige · core/src/types.mjs:408

«const WIRINGS_THE_ROOT_HANDS = new Map();» … «return makeTagged(FRAME_TAG, payload, WIRINGS_THE_ROOT_HANDS.get(FRAME_TAG.name)(payload));» (:416).

Слой: при загрузке корень кладёт в общую на весь процесс таблицу провязку каждого вида, чьи части читаются по пути (`::point` по `/0 /1 /2`, `::binding`, `::frame`). Читается она только для `::frame`. При этом модуль значений сам заново пишет имена частей кадра: `SUBJECT_OF_A_FRAME`, `'unfinished'`, `'path'` (:419-423).

Чистый лист: кадр строится и читается по провязке своего вида там, где он делается: одна провязка, одно написание имён частей, без таблицы на все виды.

```
$ git grep -n -E "WIRINGS_THE_ROOT_HANDS|takeWiring\(name" -- core/src | cut -c1-120
core/src/runtime/root.mjs:65:      if (wiring !== null) takeWiring(name, wiring);
core/src/types.mjs:408:const WIRINGS_THE_ROOT_HANDS = new Map();
core/src/types.mjs:411:  WIRINGS_THE_ROOT_HANDS.set(kindName, wiring);
core/src/types.mjs:416:  return makeTagged(FRAME_TAG, payload, WIRINGS_THE_ROOT_HANDS.get(FRAME_TAG.name)(payload));
```
```
> ::point | legend | print | lines | drop 1 < /dev/null
["|~ offset /0 ::number · The offset of the point from the start of the text, counted from zero ~|" "|~ line /1 ::number · The line of the point, counted from one ~|" "|~ column /2 ::number · The column of the point in its line, counted from one ~|"]
```

### shim · core/src/eval.mjs:1151

«function partsOfATemplate(literal) { if (isConstructStep(literal)) return BUILDS_A_VALUE_OF_CODE.has(literal.get('tag').name) ? [] : [literal.get('payload')]; …».

Слой: один факт — из каких частей состоит литерал или шаблон — вычисляется четырьмя функциями в трёх модулях, и у каждой свои исключения: функция и вид, цитата и док, теговый и голый контейнер, запись вызова и объявления.

Чистый лист: одно чтение частей литерала в модуле шагов, с исключениями в одном месте.

```
$ git grep -n -E "function (partsOfTemplate|partsOfATemplate|partsOfALiteral|partsOfAContainer)\b" -- core/src
core/src/eval.mjs:1151:function partsOfATemplate(literal) {
core/src/path-read.mjs:31:export function partsOfTemplate(value) {
core/src/steps.mjs:46:function partsOfAContainer(value) {
core/src/steps.mjs:75:export function partsOfALiteral(value) {
```

### drift · core/test/conformance/QSSLF/page.jsonl:8

«the-first-screen-holds-its-weight» над `::qlang | doc | print | count | lte 13664`; так же названы кейсы :4 и :5 над `::qlang | doc | links`.

Слой: кейсы называют «first screen» первую страницу. По [QSPRN#budget] первый экран — это `[::qlang ::host] | map (get [it doc])`, а [QSSLF#page] говорит «the first page prints within 13664». Сам первый экран в эту границу не укладывается. Добавка к `screen` из части 13 D339.

Чистый лист: «the-first-page-…» для страницы `::qlang`; «first screen» — только для двух страниц, которые получает сессия.

```
> get [(::qlang | doc | print | count) ([::qlang ::host] | map (get [it doc]) | print | count)] < /dev/null
[11513 15779]
```
```
$ git grep -n -o -E "\"name\":\"the-first-screen-holds-its-weight\",\"query\":\"[^\"]*\"" -- core/test/conformance/QSSLF/page.jsonl
core/test/conformance/QSSLF/page.jsonl:8:"name":"the-first-screen-holds-its-weight","query":"::qlang | doc | print | count | lte 13664"
```

### vestige · playground/test/helpers/cli-notebook.mjs:13

«export const cliNames = await answerOf(`[${names.join(' ')}] | filter (binding | origin | eq :stdio) | map print`);».

Слой: имя хранит существительное `::cli`, которое D477 заменила на `::stdio`. Значение — слова потоков, а не командной строки, и по нему тесты законов, ссылок и страниц playground (`QSSLF/laws`, `doc`, `page`) проверяют только их.

Чистый лист: `stdioNames` — имя того, что в нём лежит.

```
> get [([::stdio ::stdio/in ::vec/table] | map (binding | origin)) (::cli | doc !| tag)] < /dev/null
[[:stdio :stdio :stdio] ::any/doc/UnknownNameError]
```
```
$ git grep -n -o -F "filter (binding | origin | eq :stdio)" -- playground/test/helpers
playground/test/helpers/cli-notebook.mjs:13:filter (binding | origin | eq :stdio)
```

### drift · core/test/conformance/QSBLD/input.jsonl:76

«map-takes-the-tail-of-the-bare-verb-its-last-input-takes», «the-call-a-tail-forms-takes-a-tail-of-its-own», «the-last-branch-of-if-takes-the-tail» (:76-81); `withTheTail` (eval.mjs:1017).

Слой: главы и каталог формулируют правило как «the modifiers past the inputs of a verb are the modifiers of the bare verb its last input takes» ([QSQUO#modifier], [QSBLD#input]). Кейсы и код зовут его «tail» — словом, которого для этого понятия нет ни в одной главе и ни на одной странице. В других местах «tail» значит остаток текста (QSNAM/scope.jsonl:28) и продолжение запроса (vec.qlang:30); в QSMSR это `| tail -1` в shell-пробе.

Чистый лист: одно имя правила во всех текстах — «the modifiers past the inputs».

```
$ git grep -c -w -i "tail" -- docs/spec core/lib core/test/conformance
core/lib/qlang/vec.qlang:1
core/test/conformance/QSBLD/input.jsonl:7
core/test/conformance/QSNAM/scope.jsonl:1
docs/spec/QSMSR-the-measures.md:1

$ git grep -n -w "tail" -- core/lib/qlang/vec.qlang
core/lib/qlang/vec.qlang:30:      `drop 20 | take 20`, the rest of it the same query with a tail.
```

### archaism · core/test/conformance/QSPRN/json.jsonl:11

«json-quote-renders-as-source», «json-doc-renders-as-source» (:12).

Слой: «renders as source» — слова модели кодека, отдававшего цитату её исходником. [QSPRN#json] говорит «a quote, a doc and a tag name as their prints». А `source` в языке — ось, читающая объявление: от значения-цитаты она отвечает объявлением `:quote`.

Чистый лист: «json-writes-a-quote-as-its-print», «json-writes-a-doc-as-its-print».

```
> get [(~(count) | json | eq (~(count) | print | json)) (|~~ hello ~~| | json | eq (|~~ hello ~~| | print | json)) (~(count) | source | toString | lines | first)] < /dev/null
[true true ":quote"]
```

### vestige · core/src/errors.mjs:63

«export function declareForeignError(address, buildMessage) { … const Cls = class extends Error {».

Слой: это третий способ объявить отказ — класс от голого `Error`, не отказ и не дефект. Он служит одному `::builtin/SourceLoadError`, хотя [QSERR#site] относит загрузчики к дефектам рантайма, а соседний `::builtin/BootstrapSourceMissingError` объявлен через `declareDefect`. Слово «foreign» в ядре уже значит две другие вещи: значение никакого вида (`ForeignValueError`, `foreignPartOf`) и исключение JavaScript внутри примитива (`errorFromForeign`).

Чистый лист: `::builtin/SourceLoadError` объявлен через `declareDefect`, как сосед, а «foreign» значит только значение никакого вида.

```
$ git grep -n -E "declareForeignError\(|class extends (QlangError|QlangDefect|Error) " -- core/src | cut -c1-100
core/src/errors.mjs:43:  const Cls = class extends QlangError {
core/src/errors.mjs:54:  const Cls = class extends QlangDefect {
core/src/errors.mjs:63:export function declareForeignError(address, buildMessage) {
core/src/errors.mjs:65:  const Cls = class extends Error {
core/src/source-load-error.mjs:5:export const BuiltinSourceLoadError = declareForeignError('builtin/

$ git grep -h -o -E "\b\w*[Ff]oreign\w*\b" -- core/src | sort | uniq -c
      4 BuiltinForeignValueError
      1 ForeignValueError
     11 accountOfForeign
      3 declareForeignError
      3 errorFromForeign
      9 foreign
      5 foreignPartOf
      6 refuseForeign
```

### drift · core/src/ordering.mjs:28

«function kindOf(value) { if (value === null || value === undefined) return NULL_KIND; …» — функция возвращает целое от 0 до 14.

Слой: в трёх модулях три функции `kindOf` с тремя смыслами: ранг вида в едином порядке, сорт записи шага `'bind' | 'call' | … | 'literal'` и имя тега. Вид же в языке один — тег, который отвечает `tag`. Добавка к «the `kind` of a token» из части 13 D339.

Чистый лист: `kindOf` только там, где ответ — вид; ранг называется `rankOf`, сорт шага — своим именем.

```
$ git grep -n -E "(function|const) kindOf\b" -- core lsp playground stdio site | cut -c1-150
core/src/ordering.mjs:28:function kindOf(value) {
core/test/helpers/read-text.mjs:14:export const kindOf = ({ value }) => (isBindStep(value) ? 'bind' : isCallStep(value) ? 'call' : isConstructStep(val
lsp/src/features.mjs:45:const kindOf = value => tagOf(value).name;
```

### archaism · core/test/conformance/QSBLD/recipe.jsonl:16

«fractal-composition-three-levels» над запросом с входом `keyFn` и отказом `KeyFnNotCodeError`. Рядом: «error-test-in-a-template», «code-that-answers-the-kind-lets-the-consumer-count-failures», «cond-only-evaluates-matching-branch», «number-literal-inside-the-finite-domain-parses», «unique-keys-form-a-lookup-map».

Слой: это имена словами других языков и раннего питча. «fractal composition» больше нигде в дереве не встречается и тянется с перестройки 2026-04-14. Ни «fractal», ни «consumer», ни «evaluates», ни «domain», ни «lookup» нет в главе раздела кейса, а [QSREQ#cases] требует называть правило словами языка.

Чистый лист: например «a-verb-calls-a-verb-through-its-input-at-three-levels», «ok-in-a-template-asks-whether-the-step-before-stood», «cond-runs-only-the-branch-of-the-predicate-that-holds».

```
$ git grep -n -o -E "\"name\":\"(fractal-composition-three-levels|error-test-in-a-template|code-that-answers-the-kind-lets-the-consumer-count-failures|cond-only-evaluates-matching-branch|number-literal-inside-the-finite-domain-parses|unique-keys-form-a-lookup-map)\"" -- core/test/conformance
core/test/conformance/QSBLD/recipe.jsonl:16:"name":"fractal-composition-three-levels"
core/test/conformance/QSCND/branch.jsonl:41:"name":"cond-only-evaluates-matching-branch"
core/test/conformance/QSCOL/group.jsonl:18:"name":"unique-keys-form-a-lookup-map"
core/test/conformance/QSERR/catch.jsonl:3:"name":"error-test-in-a-template"
core/test/conformance/QSERR/flow.jsonl:3:"name":"code-that-answers-the-kind-lets-the-consumer-count-failures"
core/test/conformance/QSLIT/number.jsonl:12:"name":"number-literal-inside-the-finite-domain-parses"

$ grep -c -w -i -E "fractal|consumer|evaluates|lookup|domain" docs/spec/QSBLD-functions-and-kinds.md docs/spec/QSERR-errors.md docs/spec/QSCND-conditions-and-conversions.md docs/spec/QSLIT-values-and-literals.md docs/spec/QSCOL-collections.md
docs/spec/QSBLD-functions-and-kinds.md:0
docs/spec/QSERR-errors.md:0
docs/spec/QSCND-conditions-and-conversions.md:0
docs/spec/QSLIT-values-and-literals.md:0
docs/spec/QSCOL-collections.md:0

$ git log --format="%h %ad" --date=short -S "fractal-composition" -- core/test/conformance | tail -1
bc11e56d 2026-04-14
```

### archaism · core/src/grammar.peggy:949

«IdentStart "name"», «IdentTail  "letters of a name"», правило `Ident` на :941.

Слой: правила хранят словарь «identifier start/continue», который D360 убрала из продолжений. Рядом стоят `isNameStart` и `isNameContinue`, которые эти же правила вызывают. Тест лексикона отвергает «the identifier start», но вносит `IdentStart` в список слов, которые оставляет, — исключение, которое сберегает старое имя.

Чистый лист: правила названы так, как `name-chars.mjs` и [QSNAM#letters] называют понятие: начало имени и буквы имени. Исключения в лексиконе не нужно.

```
$ git grep -n -E "^(Ident|IdentStart|IdentTail)\b" -- core/src/grammar.peggy
core/src/grammar.peggy:941:Ident
core/src/grammar.peggy:949:IdentStart "name"
core/src/grammar.peggy:951:IdentTail  "letters of a name"

$ git grep -n -o -F -e "'the identifier start'" -e "'a valid identifier', 'IdentStart'" -- core/test/unit/QSLEX/term.test.mjs
core/test/unit/QSLEX/term.test.mjs:61:'the identifier start'
core/test/unit/QSLEX/term.test.mjs:70:'a valid identifier', 'IdentStart'
```

### pentimento · core/test/qlang/atoms.qlang:22

«The kinds of the atoms, a verb, since a recipe reads no value a text names.»

Слой: страница оправдывает выбор формы («a verb, since…») — по [QSVOX#pentimento] это пентименто. Довод к тому же верен лишь отчасти. С D500 (в транзите) программа под меткой несёт значения своего текста, а `:any/atomsOf` на atoms.qlang:61, который читает `atomKinds`, как раз такая программа; цитата-рецепт функции значений текста по-прежнему не видит. Что читает тело слова — вопрос открытой D281, и эта строка добавляет к ней пример довода, ставшего неверным.

Чистый лист: страница говорит только, что это за имя: «The kinds of the atoms.»

```
> :limit 4; :number/big gt limit; [1 5 10] | filter big < /dev/null
[5 10]
```

### archaism · core/test/unit/QSORD/order.test.mjs:28

«the one order tells an Array, a Map and a Set under a tag from one under none», «rejects tagged Map vs untagged Map» (:34), «Map×Set minus refuses…» (QSCOL/algebra.test.mjs:12, :18), «renders a binding record as the tagged Map it is» (QSPRN/print.test.mjs:118).

Слой: заголовки называют значения классами JavaScript, а действие — словом «renders». [QSREQ#marks] требует говорить правило словами раздела: вектор, мапа, множество, печать.

Чистый лист: «the one order tells a vector, a map and a set under a tag from one under none», «prints a binding as the record under its tag it is».

```
$ git grep -n -o -F -e "Map×Set minus refuses" -e "Map×Set inter refuses" -e "rejects tagged Map vs untagged Map" -e "an Array, a Map and a Set under a tag" -e "renders a binding record as the tagged Map it is" -- core/test/unit
core/test/unit/QSCOL/algebra.test.mjs:12:Map×Set minus refuses
core/test/unit/QSCOL/algebra.test.mjs:18:Map×Set inter refuses
core/test/unit/QSORD/order.test.mjs:28:an Array, a Map and a Set under a tag
core/test/unit/QSORD/order.test.mjs:34:rejects tagged Map vs untagged Map
core/test/unit/QSPRN/print.test.mjs:118:renders a binding record as the tagged Map it is
```

### vestige · core/src/types.mjs:241

«export const BINDING_TAG     = makeTag(BINDING_TAG_NAME);» … «export const SET_TAG         = makeTag(SET_TAG_NAME);».

Слой: таблица выровнена по имени в 15 знаков, хотя самое длинное из десяти её имён — 11. Ширину задали `PARSE_ERROR_TAG` и `TAG_BINDING_TAG` — тег `::ParseError` и связывание `tag` эпохи `makeTagKeyword` — которые из таблицы ушли.

Чистый лист: таблица выровнена по своему длиннейшему имени или не выровнена вовсе.

```
$ git show a2097f79c:core/src/types.mjs | grep -n -E "^export const (PARSE_ERROR|TAG_BINDING)_TAG"
340:export const PARSE_ERROR_TAG = makeTagKeyword('ParseError');
343:export const TAG_BINDING_TAG = makeTagKeyword('tag');

$ grep -n -E "^export const [A-Z_]+_TAG {2,}=" core/src/types.mjs
241:export const BINDING_TAG     = makeTag(BINDING_TAG_NAME);
242:export const BUILTIN_TAG     = makeTag(BUILTIN_TAG_NAME);
243:export const DESC_TAG        = makeTag('desc');
244:export const DOC_TAG         = makeTag(DOC_TAG_NAME);
245:export const EXCERPT_TAG     = makeTag('excerpt');
246:export const CELL_TAG        = makeTag('cell');
247:export const LEGEND_TAG      = makeTag('legend');
248:export const ERROR_TAG       = makeTag('error');
249:export const QUOTE_TAG       = makeTag(QUOTE_TAG_NAME);
250:export const SET_TAG         = makeTag(SET_TAG_NAME);
```
