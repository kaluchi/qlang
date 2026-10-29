> A check of the chapters `QSERR` for D412 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–00:08 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### implementation · QSERR#rest

«`::Foo!{…}` is `::Foo::error{…}`» и «The kind of errors and the kind of each refusal take the excerpt of the facts a host prints too, `::X::excerpt{…}` and `::error::excerpt{…}`»; QSLIT#tag: «The tag's kind lays the tag over the payload the literal writes, … or refuses it naming why the payload does not fit».

```qlang
> ::number/add/AddendKindNotTakenError::error::excerpt{:addend/found/count 3410} !| get [~(tag) ~(message)]
[::call/HostFailureError "facts is not iterable"]

> ::error::excerpt{:rows/count 5000} | tag ::number/add/AddendKindNotTakenError !| get [~(tag) ~(message)]
[::call/HostFailureError "facts is not iterable"]

> ::number/add/AddendKindNotTakenError::error{:addend/found 5} | eq ::number/add/AddendKindNotTakenError!{:addend/found 5}
true
```

Вид отказа принимает и `::error{…}`, и excerpt, но на их соединении (excerpt под `::error`) не кладёт тег и не отказывает: ответом становится JS-ошибка его же двери (`underKind`/`slotOfTheFacts`, `core/src/eval.mjs:1062–1074`), выданная как `::call/HostFailureError`. Какой ответ был бы согласованным: тот же excerpt под отказом, как `::X::error{…}` есть `::X!{…}`, или отказ вида с причиной, по которой payload не подходит?

### design · QSERR#site

«its kind wires `subject`, each input, `surplus` for the args past the inputs and `answer`, each a value of `::fn/slot` read by its name and its parts by theirs»

```qlang
> "x" | add 1 !| subject | get [~(tag) ~(is ::fn/slot) ~(count !| tag) ~(manifest | has ::map/count) ~(doc | eq (::map | doc)) ~(found)]
[::number/add/subject false ::call/KindAnswersNoVerbError true true "x"]

> 1 | add "x" !| addend | get [~(tag) ~(is ::fn/slot) ~(doc | eq (::number/add/addend | doc))]
[::number/add/addend false true]

> ::number/add/subject | binding !| tag
::any/binding/UnknownNameError
```

Слот вердикта лежит под тегом адреса своей роли. Проход закрывает его видом `::fn/slot`: части читаются по именам, `count` отказан. Но `is` не видит в нём `::fn/slot`. Оси читают `subject` глагола без `on` (этот адрес не объявлен ни одним узлом) как `::map` — со страницей и `manifest` карты, чьи глаголы слот отказывает, — а `addend` читают как узел входа. Что здесь согласовано: слот как значение `::fn/slot` и для `is`, и для осей, и для прохода — или значение под адресом роли, и тогда узел есть у каждой роли каждого вердикта?

### conflict · QSERR#rest

Кейс `rest.jsonl:31`: `"name":"an-error-literal-of-a-refusal-holds-its-facts-to-the-kinds-its-refusal-wires"`, `"query":"::number/add/SubjectNotNumberError!{:subject/expected 5} !| tag"`, `"expect":"::number/add/subject/ExpectedKindNotTakenError"`. Против него QSERR#site: «Every site that refuses has a tag of its own, its address» и «the refusal of the kinds of an input, a field or a payload is a node the chain lays, with a page of its own», а также QSERR#rest: «Its facts are read by their names».

```qlang
> ::number/add/SubjectNotNumberError!{:subject/expected 5} !| get [~(tag) ~(get /found) ~(doc | eq (::error | doc))]
[::number/add/subject/ExpectedKindNotTakenError 5 true]

> ::number/add/SubjectNotNumberError!{:subject/expected 5} !| found !| tag
::fn/slot/found/SubjectNotSlotError

> get [~(::number/add/subject/ExpectedKindNotTakenError | doc !| tag) ~(::fn/slot{:expected 5} !| tag)]
[::any/doc/UnknownNameError ::fn/slot/ExpectedKindNotTakenError]
```

Кейс закрепляет тег по адресу, которого не объявляет ни один узел. У такого отказа нет страницы (пойманная ошибка читает страницу `::error`), его `found` читается путём, но не по имени. Глава же требует от отказа по правилу узла со своей страницей и фактов, читаемых по именам, а сам вид `::fn/slot` отказывает ту же часть объявленным `::fn/slot/ExpectedKindNotTakenError`.

### design · QSERR#print

«A failure prints as the error at rest a catch holds, the trace it left among its facts, and its print read back by `parse | answer` and raised resumes that trace»; QSERR#alert: «`::X::excerpt{…}` …, which the kind of its tag reads back».

```qlang
> :Late |~~ Late. ~~| (::kind | accepts |~~ The facts. ~~| ::map); ::Late{:by 3} | raise
|~| raised, and no !| caught it
::Late!{
  :by 3
  :trace ::trace[::frame[::Late{:by 3} ~(raise)]]
}

> :Late |~~ Late. ~~| (::kind | accepts |~~ The facts. ~~| ::map); "::Late!{:by 3 :trace ::trace[::frame[::Late{:by 3} ~(raise)]]}" | parse | answer !| tag
::Late/PayloadKindNotTakenError

> :Late |~~ L ~~| (::kind | accepts |~~ f ~~| #[::map ::error]); ::Late::excerpt{:rows/count 5000} !| get [~(tag) ~(expected)]
[::Late/PayloadKindNotTakenError #[::error ::map]]
```

```sh
$ qplay ':Late |~~ L ~~| (::kind | accepts |~~ f ~~| #[::map ::error]); get {:rows ~(5000 | range)} | tag ::Late | raise' < /dev/null | sed -n 2p
::Late::excerpt{
```

`raise` кладёт тег метки читателя в обход её вида (QSERR#raise: «a map under a tag as the error of the outermost tag»), а улов и литерал кладут его через вид (QSERR#catch, кейс `catch.jsonl:19`). Поэтому хост печатает провал литералом, который при обратном чтении отказан. С excerpt'ом так же, даже под меткой `#[::map ::error]`, которая по QSERR#catch ошибку покоя держит. Что согласовано: проверять метку уже при `raise` — или в улове, литерале и excerpt'е принимать то, что сделал `raise`?

### conflict · QSERR#catch

«A failure lives in the pipe alone: `|` passes it by, and `!|` alone catches it»; QSERR#flow: «Code a verb runs that answers a failure answers the verb»; QSCND#coalesce: «An alternative passes to the next where it answers null, … or the refusal of a read `query` answers null for, a key a map lacks, …».

```qlang
> get [~({} | coalesce ~(get /missing) 30) ~({} | get /missing !| tag)]
[30 ::path/KeyNotInMapError]
```

QSERR#catch и #flow отдают провал, которым ответил код глагола, одному `!|`; исключения названы только `settle` и `runLaws`, и те держат провал как данные. А QSCND#coalesce и страница `::any/coalesce` позволяют `coalesce` проглотить отказ чтения своей альтернативы без всякого `!|`.

### conflict · core/lib/qlang.qlang:824

Страница `::qlang/errors`: «The facts name what refused and hold the value refused, but where the step refused its subject, which the first frame of the trace holds»; QSERR#site: «The verdict pours every slot the call filled, …: a refusal of a part of the subject lays it under `subject`».

```qlang
> get [~(::qlang/errors | doc | content | contains "hold the value refused, but where\nthe step refused its subject, which the first frame of the\ntrace holds") ~("x" | add 1 !| get [~(subject | found) ~(trace | first | subject)])]
[true ["x" "x"]]
```

По странице отказ субъекта не держит отказанное значение среди фактов. Глава, кейс `site.jsonl:33` и дерево держат его как `subject/found`.

### design · QSERR#trace

«The kind `::trace` alone holds what a trace is: a vector of frames …, plain or under `::trace`» и «The kind holds a trace wherever one is laid: its literal and `tag ::trace`; `raise`, …; and the kind of a refusal, which holds the `:trace` of its error at rest to `::trace`».

```qlang
> get [~({:trace [::frame[1 ~(pre)]]} | raise !| get /trace) ~([::frame[1 ~(pre)]] | tag ::trace) ~(::number/add/SubjectNotNumberError!{:subject/found "x" :trace [::frame[1 ~(pre)]]} !| get [~(tag) ~(expected)])]
[::trace[::frame[1 ~(pre)]] ::trace[::frame[1 ~(pre)]] [::number/add/SubjectNotNumberError/TraceKindNotTakenError #[::trace]]]
```

`raise` и `tag ::trace` кладут простой вектор кадров под `::trace`, а дверь вида отказа тот же вектор отказывает как не `::trace`. Что согласовано: класть простой вектор кадров под `::trace` и в двери отказа — или отказывать его на всех трёх дорогах?

### text · QSERR#rest

«an error at rest holds no excerpt as a fact, which its kind refuses as a value of another kind»; кейс `rest.jsonl:32` `an-error-at-rest-holds-no-excerpt-as-a-fact`.

```qlang
> get [~(!{:a ::excerpt{:b 1}} | get /a | tag) ~(::excerpt{:b 1} | add 1 !| subject | found | tag) ~(::number/add/SubjectNotNumberError!{:subject/found ::excerpt{:b 1}} | subject | found | tag)]
[::excerpt ::excerpt ::excerpt]

> get [~(::number/add/AddendKindNotTakenError!{:trace ::excerpt{:failed []}} !| tag) ~(::number/add/AddendKindNotTakenError!{:trace 5} !| tag)]
[::number/add/AddendKindNotTakenError/TraceKindNotTakenError ::number/add/AddendKindNotTakenError/TraceKindNotTakenError]
```

Предложение расходится с соседним в той же секции («holds each fact it holds to the kinds its kind wires») и с QSPRN#excerpt, где excerpt стоит частью факта («an error at rest and an excerpt by their facts»). Excerpt держится как факт везде, где вид факта его принимает. Кейс с этим именем показывает только правило QSERR#trace о виде `:trace`: `:trace 5` отказан точно так же.

### conflict · QSERR#rest

QSLIT#tag и QSNAM#address: «the tag of a refusal, an invariant's among them, lays the kind of the refusal over an error at rest alone [QSERR#rest]»; QSBLD#label: «which lays the verdict of its kind over an error at rest alone [QSERR#rest]»; QSERR#rest: «The kind of errors and the kind of each refusal take the excerpt of the facts a host prints too».

```qlang
> get [~(::number/add/AddendKindNotTakenError{:a 1} !| get [~(tag) ~(expected)]) ~(::vec/take/CountNotIntegerError::excerpt{:a 1} | tag)]
[[::number/add/AddendKindNotTakenError/PayloadKindNotTakenError #[::error ::excerpt]] ::vec/take/CountNotIntegerError]
```

Три главы со ссылкой на QSERR#rest оставляют тегу отказа одну только ошибку покоя. QSERR#rest и `:expected` вида отказа дают ему ещё и excerpt.

### conflict · core/lib/qlang/error.qlang:30

Страница `::error`: «a host prints it as its error at rest, the trace it left among its facts, and as the excerpt of its facts, `::error::excerpt{…}` under its tag»; QSERR#alert: «as the excerpt of its facts under its tag, `::X::excerpt{…}`, a failure of no refusal `::error::excerpt{…}`».

```qlang
> ::error | doc | content | contains "as the excerpt of its facts, `::error::excerpt{…}`\nunder its tag"
true
```

```sh
$ qplay '1 | add (3410 | range)' < /dev/null | sed -n 2p
::number/add/AddendKindNotTakenError::excerpt{
```

Страница пишет excerpt провала под тегом его отказа как `::X::error::excerpt{…}`, а глава и печать хоста — как `::X::excerpt{…}`. Написание страницы под тегом отказа отвечает `::call/HostFailureError` (см. первую находку).

### conflict · QSERR#site

«A last name names a kind after `Not` there alone and as the kind a conversion of its address reads, `::string/toNumber/TextNotNumberError`, so a name moves only with its word»

```sh
$ grep -n "NotIn" D:/git/qlang-worktrees/closeout-spec/scripts/refusal-kinds.mjs
4:// address reads, `string/toNumber/TextNotNumberError`, a container after `NotIn`,
5:// `path/KeyNotInMapError`, naming none, so the name moves only with the word,

$ grep -n "A refusal names a kind after" D:/git/qlang-worktrees/closeout-spec/scripts/check-conventions.mjs
113://   (20) A refusal names a kind after `Not` only as the label its subject
```

```qlang
> {} | get /a !| tag
::path/KeyNotInMapError
```

Комментарий `scripts/refusal-kinds.mjs` вводит исключение «a container after `NotIn` … naming none». Его не знают ни глава, ни заголовок проверки (20) в `scripts/check-conventions.mjs`, а `::path/KeyNotInMapError`, называющий `Map` после `Not`, проходит проверку только благодаря ему.

### conflict · QSERR#site

«a refusal of a slot is named by the slot, its first letter raised, before the rule or the name the chain declares»; QSPTH#verbs: «refused as `::string/toPath/NotPointerError`»; QSHST#cell: «refuses a cell it does not hold as `::cell/answer/NotHeldError`».

```qlang
> get [~("a" | toPath !| get [~(tag) ~(payload | keys)]) ~(::cell"000000000000" | answer !| get [~(tag) ~(payload | keys)]) ~("x" | toNumber !| tag)]
[[::string/toPath/NotPointerError #[:subject/found :trace]] [::cell/answer/NotHeldError #[:subject/found :trace]] ::string/toNumber/TextNotNumberError]
```

Оба отказа — отказы субъекта (их факт `subject/found`), но перед правилом в имени нет ни слота, ни роли, как у соседнего `TextNotNumberError`. Правило именования QSERR#site расходится с именами в QSPTH#verbs и QSHST#cell.

### text · QSERR#site

«a value of none of the kinds a slot takes refused as `KindNotTakenError` or `ElementKindNotTakenError` after it, and a payload of none of the kinds of a kind as `PayloadKindNotTakenError` or `ElementKindNotTakenError`»

```qlang
> get [~([1 "x"] | sum !| get [~(tag) ~(subject | expected)]) ~([1] | concat 5 !| tag) ~(5 | raise !| tag)]
[[::vec/sum/ElementKindNotTakenError #[::number]] ::vec/concat/VectorsElementKindNotTakenError ::any/raise/SubjectKindNotTakenError]
```

Отказ элемента субъекта лежит под слотом `subject`, но в имени слота нет — как у элемента payload вида. Это правило держат кейсы (`site.jsonl:6`, `QSCOL/sequence.jsonl:43,52,63`) и дерево, а глава оговаривает его только для payload'а вида. Её правило слота дало бы `SubjectElementKindNotTakenError` — по образцу `VectorsElementKindNotTakenError` у входа и `SubjectKindNotTakenError` у самого субъекта.

### text · QSCOL#group

«A key of another kind is refused at its element under the verb as `…/KeyKindNotTakenError`»

```qlang
> get [~([{:k [1]}] | groupBy /k !| tag) ~([1 2] | groupBy 5 !| tag)]
[::vec/groupBy/KeyAnswerKindNotTakenError ::vec/groupBy/KeyKindNotTakenError]
```

Собственные кейсы секции (`QSCOL/group.jsonl:8,21,28`) и QSERR#site («the key an element files under as `KeyAnswerKindNotTakenError`») называют отказ ключа элемента `KeyAnswerKindNotTakenError`. `…/KeyKindNotTakenError` в дереве — это отказ самого входа `key`.

### text · QSERR#print

«so a host prints it as any failure and draws nothing below it»

```sh
$ qplay '[01' < /dev/null | sed -n '7,8p'
}
|~| The source does not read as qlang: `:marker` puts a caret beneath
```

Предложение расходится со вторым предложением той же секции («the playground writes the content of the refusal's page below») и с QSCLI#answer («nothing drawn below its alert but the page»): под алертом отказанного текста playground печатает страницу.

### text · docs/spec/QSERR-errors.md:4

«its trace holds a frame for each step it passed»; то же на первой странице (`core/lib/qlang.qlang:161`): «a frame for each step it passed».

```qlang
> "x" | add 1 | mul 2 | count !| trace | get [~(count) ~(last | skipped)]
[1 ~(mul 2 | count)]
```

QSERR#trace и страница `::trace` дают кадр только шагу, который поднял провал или передал его дальше. Шаги, мимо которых провал прошёл (`|` «passes it by»), присоединяются к последнему кадру.

### text · QSERR#trace

«the part it refused itself, an element of `sum`, `avg`, `zip`, `join`, `toPath`, `toMap` and a fold of the algebra, …»

```qlang
> get [~([1 null 3] | max !| get [~(tag) ~(trace | last | path)]) ~({:a 1 :b "x"} | min !| get [~(tag) ~(trace | last | path)])]
[[::call/KindsMismatchedError /1] [::call/KindsMismatchedError /b]]
```

В перечне частей, которые шаг называет путём кадра, нет пары, отказанной `min` и `max`. QSORD#sort («refused where its second stands»), его кейс и дерево называют её путём второго элемента.

### conflict · core/lib/qlang/frame.qlang:85

Закон `::frame/readsItsPartsByTheirNames`: «A path reads the parts of a frame by the names its kind wires.»

```qlang
> ::frame | laws | get [~(get /readsItsPartsByTheirNames | first | content) ~(get /refusesTheIndexOfAPart | first | content)]
["A path reads the parts of a frame by the names its kind wires." "No path reads beneath the tag of a frame, by an index nor by a\nname."]

> "x" | add 1 !| trace | first | get /subject !| tag
::path/TagClosedError
```

Страница закона говорит о чтении путём, но его запрос читает части по именам. Соседний закон `refusesTheIndexOfAPart` и QSERR#trace («no path reads beneath the tag of a frame») путь отказывают.

### conflict · core/lib/qlang/error.qlang:1

Комментарий источника: «`::error`, the kind every error is a value of»; QSERR#rest: «the walk of its tags meets no `::error`, so it is a value of its refusal alone».

```sh
$ sed -n 1p D:/git/qlang-worktrees/closeout-spec/core/lib/qlang/error.qlang
|~ `::error`, the kind every error is a value of, and what is declared
```

```qlang
> "x" | add 1 !| get [~(tag) ~(is ::error) ~(payload | tag)]
[::number/add/SubjectNotNumberError false ::error]
```

Комментарий называет `::error` видом каждой ошибки. Глава и `is` относят к `::error` только payload под тегом отказа.

### conflict · QSERR#raise

Кейс `raise.jsonl:10`: `"name":"the-bang-raises-an-error"`, `"query":"!{:k 1} | raise | count !| tag"`; QSERR#raise: «Raising is an act, and `raise` alone performs it».

```qlang
> get [~(!{:k 1} | count) ~(!{:k 1} !| tag) ~(::error | laws | get /writesAnErrorAtRestByItsBang | first | content)]
[1 !{:k 1} "The bang writes an error at rest of the kind of errors."]
```

Имя кейса приписывает подъём bang'у. Глава, закон `::error/writesAnErrorAtRestByItsBang` и кейс `catch.jsonl:12` (`an-error-literal-passes-the-fail-track-by`) приписывают подъём `raise`, а bang'у оставляют ошибку покоя.

### pentimento · core/lib/qlang/error.qlang:13

Страница `::error`: «a reader learning a tool fails often, and the failure brings what the reader needs at the moment it is cheapest to give». Страница `::qlang/errors` (`core/lib/qlang.qlang:807–811`): «A failure does not throw: … A reader learning a tool fails often, and the failure is where what it needs is cheapest to give.»

```qlang
> get [~(::error | doc | content | contains "reader learning a tool fails often, and the failure brings what\nthe reader needs at the moment it is cheapest to give") ~(::qlang/errors | doc | content | contains "A failure does not throw")]
[true true]
```

Эти предложения обосновывают замысел обращением к читателю и говорят о том, чего нет («does not throw»), хотя правило уже сказано утвердительно («a step that fails answers an error»). Ни прогон, ни кейс, ни чтение дерева их не проверяют.

### drift · QSERR#site

Кейс `site.jsonl:7`: `"name":"a-count-that-is-no-whole-number-breaks-the-law-of-its-input"`, `"query":"\"ab\" | take 1.5 !| tag"`.

```qlang
> "ab" | take 1.5 !| get [~(tag) ~(tag | binding | value | tag)]
[::string/take/CountNotIntegerError ::invariant]
```

Имя кейса называет инвариант (`holds`, `::invariant`) словом «law», которым тексты называют другой вид — `::law` команды `proves`.

### drift · QSERR#rest

Кейс `rest.jsonl:24` и QSHST#source пользуются словом «error value» для разных вещей.

```sh
$ grep -n -o '"name":"an-error-value-is-no-raised-error","query":"[^"]*"' D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSERR/rest.jsonl
24:"name":"an-error-value-is-no-raised-error","query":"::error{:k 1} | count"

$ sed -n '75,76p' D:/git/qlang-worktrees/closeout-spec/docs/spec/QSHST-hosts.md
[QSERR#trace]; a failure of the host's own world is the error
value `makeErrorValue` makes of a tag and a map of its facts, and a host
```

QSERR называет эти две вещи «error at rest» и «failure». «Error value» в имени кейса означает первую, а в QSHST#source и в `core/README.md:86` — вторую.

### case · QSERR#alert

«A failure holds its facts whole as it flies, and `!|` meets it live, a step after the catch reading each fact as the failure met it.»

```sh
$ git -C D:/git/qlang-worktrees/closeout-spec ls-files core/test/conformance/QSERR
core/test/conformance/QSERR/catch.jsonl
core/test/conformance/QSERR/flow.jsonl
core/test/conformance/QSERR/print.jsonl
core/test/conformance/QSERR/raise.jsonl
core/test/conformance/QSERR/rest.jsonl
core/test/conformance/QSERR/site.jsonl
core/test/conformance/QSERR/trace.jsonl
```

```qlang
> 1 | add (3410 | range) !| addend | found | count
3410
```

Глава называет требованиями каждой секции кейсы её файла, но файла `alert` нет. Вычислимое правило секции держит только юнит-тест `core/test/unit/QSERR/alert.test.mjs`.

### case · QSERR#print

«its print read back by `parse | answer` and raised resumes that trace»

```sh
$ grep -c "print | parse | answer | raise" D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSERR/print.jsonl D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSERR/trace.jsonl
D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSERR/print.jsonl:0
D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSERR/trace.jsonl:0
```

```qlang
> "x" | add 1 !| print | parse | answer | raise | count !| trace | map ~(get [~(failed) ~(skipped)])
[[~(add 1) ~(count)]]
```

Это правило держат проба главы и дерево, но ни один кейс.

### case · QSERR#site

Кейс `site.jsonl:19`: `"name":"a-refusal-links-the-page-of-the-site-it-guards"`, `"query":"::path/KeyNotInMapError | doc | links | map ~open | any ~(eq (::path | doc))"`. В секции: «a refusal of the language's own steps sits under the record or the kind that holds the rule, `::call`, `::bind`, `::construct`, `::fail`, `::group`, `::quote` and `::error`, and links the page of its site».

```qlang
> [::call ::bind ::construct ::fail ::group ::quote ::error] | map ~(with {:site ~it} ~(manifest | filter ~(binding | name | toString | endsWith "Error") | map ~(doc | links | map ~(answer) | has site) | get [~(count) ~(every ~(it))]))
[[13 true] [10 true] [4 true] [3 true] [2 true] [5 true] [1 true]]
```

Кейс показывает ссылку отказа чтения пути, о которой секция ничего не говорит. Правило ссылки для отказов шагов языка дерево держит, но ни один кейс его не показывает.

### case · QSERR#catch

Кейс `catch.jsonl:29`: `"name":"a-catch-among-the-declarations-of-a-text-is-refused"`, `"query":"\":a 1 !| :b 2\" | parse !| tag"`.

```qlang
> ":a 1 !| :b 2" | parse !| get [~(tag) ~(message)]
[::quote/ParseError "a failure of a declaration is the failure of its text, which no `!|` of the text catches: a declaration ends with `;`, and a failure of the text is caught where the text is read, `~(…) | answer !| …`"]
```

Кейс показывает отказ парсера из QSSYN#step («The parser refuses, each naming the `;`, … a `!|` among the declarations»). В QSERR#catch этого правила нет.

### text · QSERR#trace

«A raised error holds the facts of its site and, after them, its trace under `:trace`»

```qlang
> {:trace [::frame[1 ~(pre)]] :a 2} | raise !| payload | entries | map ~first
[:trace :a]
```

По QSERR#site той же главы («an error a reader writes holds its facts as written, a `:trace` it writes where it stands») и по дереву записанный `:trace` стоит перед фактами, а не после них.

### text · scripts/sensors/run-probes.mjs:183

«The print of an error begins with its literal, `::Tag!{` or `!{`, a failure's under the line that says it was raised [QSERR#rest].»

```sh
$ grep -n "The print of an error begins\|failure's under the line\|const readsAsError" D:/git/qlang-worktrees/closeout-spec/scripts/sensors/run-probes.mjs
183:// The print of an error begins with its literal, `::Tag!{` or `!{`, a
184:// failure's under the line that says it was raised [QSERR#rest].
185:const readsAsError = text => /^(\|~\| raised, and no !\| caught it\s+)?(::[\w/.-]+)?!\{/.test(text);

$ qplay '1 | add (3410 | range)' < /dev/null | sed -n 2p
::number/add/AddendKindNotTakenError::excerpt{
```

По QSERR#alert провал, у которого какой-то факт не уместился, печатается как `::X::excerpt{…}`. Такой формы не знают ни комментарий, ни регулярное выражение под ним.

### conflict · QSPTH#template

«`settle` asks each question of a vector, a set or a map of them»; страница `::any/settle`: «and the questions a vector or a map».

```qlang
> get [~({:a 1 :b 2} | settle #[/a /b] | map /value) ~(5 | settle ~(add 1) !| questions | expected) ~(::any/settle | doc | content | contains "the questions a\nvector or a map")]
[[1 2] #[::map ::vec] true]
```

Глава (и дерево, которое принимает множество) расходится со страницей `::any/settle` и с `:expected #[::map ::vec]` её отказа. Этот отказ бросает код под меткой `[QSERR#catch]` (`core/src/runtime/path-primitives.mjs:58`).
