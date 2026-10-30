> A pentimento audit of qlang--builtin for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `9778080c`, on the baseline `9780e1ed`; run 2026-10-30, 15:12–15:40 UTC. A path it names reads as `git show 9778080c:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### vestige · core/lib/qlang/any.qlang:2972
«/1 #[::keyword ::map ::number ::path ::string ::tagged ::vec]». Это виды входа `body` у `with`, хотя страница входа говорит «The template answered, as `get` takes it».
Слой: это виды пути `get` до D496, когда `get` читал отдельный ключ (виды шаблона плюс `KINDS_OF_A_KEY_ALONE`). D496 убрал отдельный ключ из `get`, а `with` эти виды сохранил. Поэтому `with [/b] :b` и `with [/b] 5` отвечают литералом там, где `get` отказывает, вопреки странице и имени кейса `with-refuses-a-body-get-takes-not`, а `true` при этом отвергается.
Чистый лист: тело `with` берёт ровно то, что берёт `get`, `#[::map ::path ::quote ::tagged ::vec]`: одна запись видов шаблона на оба глагола.
```
$ qplay 'get [({:b 7} | with [/b] :b) ({:b 7} | with [/b] 5) ({:b 7} | get :b !| tag) ({:b 7} | with [/b] true !| tag) (::any/with | binding | value | inputs | get /1 | get /kinds) (::any/get | binding | value | inputs | get /0 | get /kinds)]' < /dev/null
[:b 5 ::any/get/PathKindNotTakenError ::any/with/BodyKindNotTakenError #[::keyword ::map ::number ::path ::string ::tagged ::vec] #[::map ::path ::quote ::tagged ::vec]]

$ grep -n "KINDS_OF_A_KEY_ALONE =" core/src/path-read.mjs
17:export const KINDS_OF_A_KEY_ALONE = Object.freeze(['keyword', 'number', 'string']);

$ grep -o '"name":"with-refuses-a-body-get-takes-not"' core/test/conformance/QSPTH/template.jsonl
"name":"with-refuses-a-body-get-takes-not"

$ grep -n "A key alone is no path of" docs/journal/replaced/D496.md
99:`map {:name /name :count (get /tags | count)}`. A key alone is no path of
```

### vestige · core/lib/qlang/any.qlang:99
«| proves :ConditionsElementKindNotTakenError/readsAMissingFieldSoftly … ~({:active true} | allOf (query /verified | eq true) | not)». То же стоит в `anyOf` (стр. 168), и в `core/lib/qlang/bind.qlang:207` «| proves :SubjectNotGivenError/takesAValueOfTheSubjectByWith».
Слой: законы стоят под отказами той модели, где группа вычислялась при вызове.
- По D197 условие `allOf` было «a boolean computed at the call as every modifier is», и мягкое чтение поля чинило отказ элемента.
- До D496 тело, читающее субъект, отвергалось как `SubjectNotGivenError` с починкой через `with`.

Теперь пропущенное поле отвечает `::path/KeyNotInMapError`, null из `query` даёт `ConditionsAnswerKindNotTakenError`, а `:n count;` объявляет программу.
Чистый лист: под каждым отказом стоит починка именно этого отказа:
- под `ConditionsElementKindNotTakenError` — значение другого вида;
- мягкое чтение — под `ConditionsAnswerKindNotTakenError`;
- под `SubjectNotGivenError` — тело на одном пути неудачи, которое его и вызывает.
```
$ qplay 'get [({:active true} | allOf (get /verified) !| tag) ({:active true} | allOf (query /verified) !| tag) ({:active true} | allOf null !| tag) (::any/allOf/ConditionsElementKindNotTakenError | laws | keys) (::any/anyOf/ConditionsElementKindNotTakenError | laws | keys)]' < /dev/null
[::path/KeyNotInMapError ::any/allOf/ConditionsAnswerKindNotTakenError ::any/allOf/ConditionsElementKindNotTakenError [:readsAMissingFieldSoftly] [:readsAMissingFieldSoftly]]

$ qplay 'get [(~(:n count; [1 2 3] | n) | answer) (~(:x (!| 1 | count);) | answer !| get [tag name]) (::bind/SubjectNotGivenError | laws | keys)]' < /dev/null
[3 [::bind/SubjectNotGivenError :count] [:refusesABodyOnTheFailTrackAlone :takesAValueOfTheSubjectByWith]]

$ grep -n -e "boolean computed at the call as every modifier is" -e "a field a record may lack read softly" docs/journal/replaced/D197.md
10:boolean computed at the call as every modifier is, or a quote or a path
25:names the two repairs, a field a record may lack read softly, `allOf

$ grep -n "a-body-that-reads-the-subject-is-refused-naming-with" docs/journal/replaced/D496.md
296:a-body-that-reads-the-subject-is-refused-naming-with,
```

### vestige · core/lib/qlang/builtin.qlang:108
«`:origin` names the source and `:tagName` the refusal, for a name declared again `::bind/NameDeclaredTwiceError` with `:name` the name.»
Слой: дефекты корня из `declareDefect` несут факты-объекты JavaScript в обход провязки.
- `RootSourceNotDeclaredError`, `PrimitiveNotHandedError`, `RootValueNotWordError` и `BootstrapSourceMissingError` поднимаются с `origin`, `name`, `tagName`, которых их вид не провязывает.
- Соседние `PrimitiveNamesNoBuiltinError` и `SourceLoadError` свои факты провязали.
- `:tagName` держит строку `'::bind/NameDeclaredTwiceError'`, а не тег: имя говорит то, чем значение не является.

Чистый лист: каждый отказ `::builtin` провязывает факты, которые несёт: источник ключевым словом, отказ тегом. Правило [QSERR#site] с `RefusalFactNotDeclaredError` держит и дефекты корня.
Дополняет D339, часть 13 («The facts of a refusal»): отказов корня там нет.
```
$ grep -n -o -E "throw new Builtin(RootSourceNotDeclared|PrimitiveNotHanded|RootValueNotWord|BootstrapSourceMissing)Error\(\{[^}]*\}" core/src/runtime/root.mjs core/src/runtime/lang-runtime.mjs
core/src/runtime/root.mjs:53:throw new BuiltinRootSourceNotDeclaredError({ origin, tagName: answered.pipeValue.tag.literal }
core/src/runtime/root.mjs:57:throw new BuiltinRootValueNotWordError({ origin, name: makeKeyword(value[0]) }
core/src/runtime/root.mjs:60:throw new BuiltinRootSourceNotDeclaredError({ origin, tagName: DECLARED_TWICE, name: makeKeyword(again) }
core/src/runtime/root.mjs:69:throw new BuiltinPrimitiveNotHandedError({ origin, name: makeKeyword(name) }
core/src/runtime/lang-runtime.mjs:60:throw new BuiltinBootstrapSourceMissingError({ origin: makeKeyword(uri) }

$ grep -n "DECLARED_TWICE =" core/src/runtime/root.mjs
30:const DECLARED_TWICE = '::bind/NameDeclaredTwiceError';

$ qplay '[::builtin/RootSourceNotDeclaredError ::builtin/PrimitiveNotHandedError ::builtin/RootValueNotWordError ::builtin/BootstrapSourceMissingError ::builtin/PrimitiveNamesNoBuiltinError ::builtin/SourceLoadError] | map (manifest | map (binding | name | toString | split "/" | last))' < /dev/null
[["expected" "found" "index" "trace"] ["expected" "found" "index" "trace"] ["expected" "found" "index" "trace"] ["expected" "found" "index" "trace"] ["expected" "found" "index" "name" "origin" "sharedWith" "trace"] ["cause" "expected" "found" "index" "origin" "sourceLocation" "trace"]]
```

### archaism · core/lib/qlang.qlang:599
«a query, a cell of a session and a source of the root are written alike»; то же в `core/lib/qlang/builtin.qlang:84`: «the scope it hands a session or a query».
Слой: «session» здесь означает записную книжку хоста, слово от `createSession`, которое D431 сменил на `createNotebook`. Прошлый прогон (D339~1) заменил «session» ячеек на «notebook» в страницах `::host` и playground, а эти две фразы каталога ядра остались. Осталось и поле `written` записи D361 в лексиконе: оно велит писать `createSession({ scope })`, которое строка 102 отвергает.
Чистый лист: «a cell of a notebook» и «the scope it hands a notebook or `evalQuery`», как пишет [QSHST#door]; «session» означает только разговор модели [QSLEX#grep].
```
$ qplay 'get [(::qlang/names | doc | content | split "\n" | join " " | contains "a query, a cell of a session and a source of the root") (::builtin/ForeignValueError | doc | content | split "\n" | join " " | contains "the scope it hands a session or a query")]' < /dev/null
[true true]

$ grep -n -e "createSession" scripts/retired-words.mjs
80:  { regex: /\benvAfterCell\b|\bsession(?:Instance)?\.env\b|createSession\(\{\s*env\b/, written: 'the scope a session keeps, `session.scope`, `createSession({ scope })` and the entry\'s `scopeAfterCell`', by: 'D361' },
102:  { regex: /\bcreateSession\b/, written: 'the notebook of a host, `createNotebook`', by: 'D431' },

$ grep -n "hands a notebook or" docs/spec/QSHST-hosts.md
219:declaration, and the scope a host hands a notebook or `evalQuery` is held
```

### shim · core/lib/qlang.qlang:550
«| proves :pipeline/failsOnAMiss |~~ A miss is an error. ~~| ~({:name "Ann"} | get /nmae !| tag | eq ::path/KeyNotInMapError)». Это дословно закон `::any/get/refusesAMissedKey`.
Слой: законы глав `::qlang/…` и законы глаголов писались копией запроса для своей страницы, а не ссылкой. Из 15 пар законов с одним запросом 8 не касаются первой страницы:
- главы `pipeline`, `values`, `errors`, `verbs` повторяют законы `get`, `tag`, `frame/skipped`, `add`;
- `::any/it`↔`::number/mul`, `::doc/links`↔`::link/open` и `::quote/answer`↔`::string/parse` повторяют друг друга.

Чистый лист: закон стоит один раз, под именем, чьё утверждение он доказывает, а глава ведёт к нему ссылкой.
Дополняет D339, части 12–13: там названы лишь «the laws of the first page beside the laws of the verbs they repeat».
```
$ qplay 'get [(::host | kinds | toVec | map (with {:n it} (laws | entries | map (get [(n) first (last | last | toString)]))) | flat) (::host | kinds | toVec | map manifest | flat | map (with {:n it} (laws | entries | map (get [(n) first (last | last | toString)]))) | flat)] | flat | groupBy (get /2) | filter (count | gt 1) | vals | map (map (get [/0 /1])) | get [count (filter (every (get /0 | ne ::qlang)))]' < /dev/null
[15 [[[::any/get :refusesAMissedKey] [::qlang/pipeline :failsOnAMiss]] [[::any/it :answersTheSubject] [::number/mul :computesTheMultiplierAgainstTheSubject]] [[::any/tag :readsTheOutermostTag] [::qlang/values :readsTheOuterTag]] [[::any/tag :readsAnErrorAtRest] [::qlang/errors :namesTheSite]] [[::doc/links :opensWhereItLeads] [::link/open :opensThePageItNames]] [[::frame/skipped :runsAgainByApply] [::qlang/errors :runsTheSkippedStepsAgain]] [[::number/add :answersUnderTheTag] [::qlang/verbs :answersUnderTheTags]] [[::quote/answer :runsTextReadByParse] [::string/parse :answersASourceWithItsOwnValue]]]]
```

### vestige · core/lib/qlang.qlang:463
«| proves :values/isToldByHowItsPrintOpens |~~ A string, a keyword, a tag, … each print as their kind opens. ~~|» с запросом `… | map tag | eq [...]`.
Слой: закон о начале печати повторяет приём `:values/impliesTheKinds` (`map tag`) и печать не читает вовсе, так что фраза главы «A value is told by how its print opens» законом не доказана.
Чистый лист: закон читает начало печати, `map (print | take 2)`.
Дополняет D339, часть 12: эта копия закона ещё и оставляет своё утверждение без доказательства.
```
$ qplay 'get [(::qlang/values | laws | get /isToldByHowItsPrintOpens | first | content) (::qlang/values | laws | get /isToldByHowItsPrintOpens | last | toString | contains "map tag") (::qlang/values | laws | get /impliesTheKinds | last | toString | contains "map tag") (["tea" :tea ::Tea [1] #[1] #"tea" {:tea 1} ~(tea) !{:tea 1}] | map (print | take 2))]' < /dev/null
["A string, a keyword, a tag, a vector, a set, a regex, a map,\na quote and an error at rest each print as their kind opens." true true ["\"t" ":t" "::" "[1" "#[" "#\"" "{:" "~(" "!{"]]
```

### drift · core/test/conformance/QSSLF/page.jsonl:8
«"name":"the-first-screen-holds-its-weight","query":"::qlang | doc | print | count | lte 13664"». Так же названы кейсы в строках 4–5.
Слой: D27 («The first screen is a screen») называл первым экраном страницу `::qlang` и закрепил её вес 13664 на базисе f679cfe. Теперь главы зовут эту страницу first page ([QSSLF#page]), а first screen — это `[::qlang ::host]` под бюджетом ([QSMSR#benchmark], [QSPRN#budget]). Прошлый прогон поправил `qlang.qlang:2`, но три имени кейсов остались.
Чистый лист: кейсы называются `the-first-page-…`, и у «first screen» один смысл.
Дополняет D339, часть 13 (термин `screen`).
```
$ grep -o -E '"name":"the-first-screen-[a-z-]*","query":"[^"]*"' core/test/conformance/QSSLF/page.jsonl
"name":"the-first-screen-opens-every-page-it-names-in-one-query","query":"::qlang | doc | links | map open | every (tag | eq ::doc)"
"name":"the-first-screen-names-the-concepts","query":"::qlang | doc | links | map open | filter (tag | eq ::doc) | count | gt 5"
"name":"the-first-screen-holds-its-weight","query":"::qlang | doc | print | count | lte 13664"

$ grep -n -e "first screen is a screen" -e "there, 13664" docs/journal/replaced/D27.md
1:# D27 · The first screen is a screen, and the page of the language holds the weight it has
10:Decision. The first screen is a screen, what a terminal shows at once.
19:there, 13664, so a sentence enters it only where another leaves or

$ grep -n -e "first screen" -e "first page prints" docs/spec/QSMSR-the-measures.md docs/spec/QSPRN-printing-and-codecs.md docs/spec/QSSLF-the-language-describes-itself.md
docs/spec/QSMSR-the-measures.md:13:first screen, the pages of the language and of the playground as
docs/spec/QSPRN-printing-and-codecs.md:286:`count` counts a string, which is never smaller than the first screen,
docs/spec/QSSLF-the-language-describes-itself.md:305:first page prints within 13664 characters.

$ qplay 'get [(::qlang | doc | print | count) ([::qlang ::host] | map (get [it doc]) | print | count)]' < /dev/null
[11513 15779]
```

### archaism · core/lib/qlang/any.qlang:2205
«Answers the subject of the step that writes the code it stands in, the S of that step»
Слой: по моему чтению, буква `S` — обозначение субъекта шага из формальной записи модели, которой нет ни в одной главе и ни на одной странице. Во всём каталоге это единственная страница с « S ».
Чистый лист: «the subject of the step that writes the code», как пишут [QSPTH#it] и [QSQUO#held].
```
$ qplay 'get [(::any/self | doc | content | contains "the S of that step") (::host | kinds | toVec | map manifest | flat | map doc | filter (eq null | not) | filter (content | contains " S ") | count)]' < /dev/null
[true 1]
```

### vestige · core/lib/qlang/absent.qlang:11
«It marks the element of a vector or a set empty in some, over the shape of the rest and outside `::nullable`: `[{:age 30} {:age 25 :name "Bob"}] | shape` answers …»
Слой: фразу об элементе вставили перед примером, который был примером правила ключей. Это запрос закона `marksAKeySomeRecordsLack`, и элемента вектора в нём нет. Прошлый прогон исправил голову файла, но не этот пример.
Чистый лист: под фразой об элементе стоит пример элемента, `[{:labels [{:name "bug"}]} {:labels []}] | shape`, под фразой о ключе — пример ключа.
```
$ qplay 'get [(::absent | doc | content | split "\n" | join " " | contains "It marks the element of a vector or a set empty in some, over the shape of the rest and outside `::nullable`: `[{:age 30} {:age 25 :name \"Bob\"}] | shape`") ([{:age 30} {:age 25 :name "Bob"}] | shape) (::absent | laws | get /marksAKeySomeRecordsLack | last)]' < /dev/null
[true ::shape[{:age ::number :name ::absent::string}] ~([{:age 30} {:age 25 :name "Bob"}] | shape | eq ::shape[{:age ::number :name ::absent::string}])]
```

### drift · core/lib/qlang/bind.qlang:35
«`:docs` its pages and `:body` its body, the step after its name and its pages»
Слой: это модель, где каждый док слота был отдельной страницей. Теперь доки слота — части одной страницы: `doc` отвечает одним `::doc`, а провязка `::binding` зовёт их «The docs of its page».
Чистый лист: «`:docs` the docs of its page … after its name and its page».
```
$ grep -n "its pages" core/lib/qlang/bind.qlang
35:      `:docs` its pages and `:body` its body, the step after its name and
36:      its pages, which runs once where the declaration stands.

$ qplay ':Box |~~ A box. ~~| |~~ It holds parcels. ~~|; get [(::Box | binding | docs | count) (::Box | doc | tag) (::binding/docs | doc | content)]' < /dev/null
[2 ::doc "The docs of its page, one for each doc of the slot of its\ndeclaration."]
```

### shim · core/src/runtime/json.mjs:73
«export function fromPlain(plainVal)» и `toPlain` (стр. 42), экспорты корня пакета. Страница `::builtin/ForeignValueError` пишет: «a host builds a value of the language from the data it holds parsed by `fromPlain`».
Слой: это первая дорога подъёма JSON (по прошлому прогону, 2026-04-15), которую `parseJson` сменил своим `fromJsonText`. Её держат только README пакета и страница каталога, называющая функцию JavaScript; ни один модуль дерева вне тестов ядра её не импортирует.
Чистый лист: пакет экспортирует то, что читает рабочее пространство, а страница каталога называет слова языка.
Дополняет D339, часть 13 (`{"$error": …}`, который не пишет ни один хост): не читают не только обработчик ошибки, но и сами экспорты.
```
$ grep -rln -w -e toPlain -e fromPlain --exclude-dir=node_modules --exclude-dir=test --include=*.mjs --include=*.js --include=*.qlang --include=*.md core playground stdio lsp site vscode scripts
core/lib/qlang/builtin.qlang
core/README.md
core/src/index.mjs
core/src/runtime/json.mjs
```

### shim · core/lib/qlang/any.qlang:2123
«`::vec/sort | runLaws | count` answering `15`»
Слой: число законов `sort`, которое считает команда, переписано в прозу страницы `runLaws`. Правило о счёте в прозе ([QSVOX#pentimento]) до каталога не дотягивается, и число разойдётся с первым новым законом `sort`.
Чистый лист: пример без числа, `::vec/sort | runLaws | map /ok`.
Дополняет D339, часть 12.
```
$ qplay 'get [(::vec/sort | laws | count) (::any/runLaws | doc | content | split "\n" | join " " | contains "`::vec/sort | runLaws | count` answering `15`")]' < /dev/null
[15 true]

$ grep -n "a count in markdown" docs/spec/QSVOX-the-texts-and-their-voices.md
102:holds; and a count in markdown prose that a command answers, which the
```

### shim · core/lib/qlang.qlang:158
«where a fact past three hundred characters stands as the ::cell its host keeps it in»
Слой: комнаты алерта (константы ядра `ROOM_OF_A_FACT` и `ROOM_OF_AN_ALERT`) переписаны словами в шести строках четырёх источников. Бюджет ответа язык, напротив, отдаёт фактом `:budget` и числом в прозе не пишет.
Чистый лист: комната читается так же, как бюджет, фактом, а страницы называют её, не повторяя числа.
Дополняет D339, часть 12.
```
$ grep -rn -c -i -E "three hundred|two thousand" core/lib playground/lib | grep -v ":0$"
core/lib/qlang/excerpt.qlang:1
core/lib/qlang/quote.qlang:1
core/lib/qlang.qlang:3
playground/lib/qlang/playground.qlang:1

$ grep -n -E "ROOM_OF_A_FACT =|ROOM_OF_AN_ALERT =|ANSWER_BUDGET =" core/src/rooms.mjs
8:export const ANSWER_BUDGET = 16000;
11:export const ROOM_OF_A_FACT = 300;
12:export const ROOM_OF_AN_ALERT = 2000;

$ qplay '::qlang/AnswerBeyondBudgetError | manifest | map (binding | name | toString | split "/" | last) | filter (contains "budget")' < /dev/null
["budget"]
```

### subordination · core/lib/qlang/any.qlang:1869
«the text a host shows for an answer other than a string»
Слой: соглашение одного режима playground, где строка выходит своим текстом, записано на странице глагола ядра как правило всякого хоста. При этом REPL и сайт показывают строку её литералом ([QSPRN#print]).
Чистый лист: страница `print` говорит, что печать — это текст, читающийся обратно в значение; что хост пишет вместо строки, говорит страница этого хоста.
Дополняет D339, часть 13 (`boundAnswer`, меряющий текст одного хоста): тот же разрез стоит и в каталоге.
```
$ qplay '::any/print | doc | content | split "\n" | join " " | contains "the text a host shows for an answer other than a string"' < /dev/null
true

$ qplay '"x"' < /dev/null
x

$ printf '"x"\n' | qplay -i 2>&1 | grep -c '"x"'
1

$ grep -n "a string as its text and its REPL" docs/spec/QSPRN-printing-and-codecs.md
70:a string as its text and its REPL and the site an answer as its literal,
```

### archaism · core/lib/qlang/any.qlang:280
«| proves :runsARecordedSuffixAgain |~~ The steps a trace skipped run again on a value. ~~|»
Слой: по моему чтению, «recorded suffix» — имя прежней модели для шагов, пропущенных неудачей; язык зовёт их `skipped`. В каталоге `:suffix` — вход `string/append` и `string/endsWith`, так что одно слово держит два смысла.
Чистый лист: закон называется `runsTheSkippedStepsAgain`.
```
$ qplay 'get [(::any/apply | laws | keys | filter (toString | contains "Suffix")) (::any/apply | laws | get /runsARecordedSuffixAgain | first | content) (::string/append | binding | value | inputs | map /name) (::string/endsWith | binding | value | inputs | map /name) (::frame/skipped | doc | content | lines | first)]' < /dev/null
[[:runsARecordedSuffixAgain] "The steps a trace skipped run again on a value." [:suffix] [:suffix] "Answers the steps the failure skipped after the step that failed, a"]
```

### subordination · core/src/runtime/shape-primitives.mjs:17
«registerPrimitive('any/paths', …)»: модуль `::shape` не держит ни одного глагола `::shape`.
Слой: группировка по роли живёт и в модулях, названных по существительному.
- `shape-primitives.mjs` держит `any/paths` и `any/shape`.
- `path-primitives.mjs` держит двенадцать глаголов, из них лишь два `::path`.
- Оси разделены между `axis.mjs` (`binding`, `source`, `doc`) и `manifest.mjs` (`manifest`, `laws`, `runLaws`).

Чистый лист: примитивы существительного стоят рядом с его страницей ([QSLEX#grep]), и имя модуля называет то, что он держит.
Дополняет D339, часть 13 («The homes of the primitives»): там названы модули по роли и `tagged-primitives.mjs`, а здесь — модули, чьё имя существительного говорит не то, что в них лежит.
```
$ grep -c -E "register(Primitive|StateReader)\('" core/src/runtime/shape-primitives.mjs core/src/runtime/path-primitives.mjs
core/src/runtime/shape-primitives.mjs:2
core/src/runtime/path-primitives.mjs:12

$ grep -o -E "register(Primitive|StateReader)\('(shape|path)/[A-Za-z]+'" core/src/runtime/shape-primitives.mjs core/src/runtime/path-primitives.mjs
core/src/runtime/path-primitives.mjs:registerPrimitive('path/segments'
core/src/runtime/path-primitives.mjs:registerPrimitive('path/toPath'

$ grep -o -E "registerStateReader\('any/[A-Za-z]+'" core/src/runtime/axis.mjs core/src/runtime/manifest.mjs
core/src/runtime/axis.mjs:registerStateReader('any/binding'
core/src/runtime/axis.mjs:registerStateReader('any/source'
core/src/runtime/axis.mjs:registerStateReader('any/doc'
core/src/runtime/manifest.mjs:registerStateReader('any/manifest'
core/src/runtime/manifest.mjs:registerStateReader('any/laws'
core/src/runtime/manifest.mjs:registerStateReader('any/runLaws'
```

### vestige · core/src/runtime/control.mjs:1
«// [QSBLD#fn], [QSQUO#literal], [QSDSP#walk], [QSCND#boolean]» над `any/if`; в `core/src/runtime/tagged-primitives.mjs:7` — «// [QSDSP#walk], [QSDSP#answer], [QSSLF#catalog]» над `tagged/within`.
Слой: метки пережили прежнее содержимое блоков.
- Правило `if` стоит в [QSCND#branch], а эта метка есть лишь ниже, над `cond`.
- Правило `within` стоит в [QSCOL#within].
- Правил [QSBLD#fn], [QSQUO#literal] и [QSSLF#catalog] эти блоки не держат.

Чистый лист: `// [QSCND#branch], [QSCND#boolean]` над `if` и `// [QSCOL#within]` над `within`.
Дополняет D412, часть 3: ещё две метки, которые никакая проверка не сверяет с правилом блока, как метка `json.mjs:136`, которую взял прошлый прогон.
```
$ grep -n -E "^// \[|registerPrimitive\('(any/if|tagged/within)'" core/src/runtime/control.mjs core/src/runtime/tagged-primitives.mjs
core/src/runtime/control.mjs:1:// [QSBLD#fn], [QSQUO#literal], [QSDSP#walk], [QSCND#boolean]
core/src/runtime/control.mjs:14:registerPrimitive('any/if', runsAsCode(['then', 'else'], async (subject, condition, thenCode, elseCode) =>
core/src/runtime/control.mjs:17:// [QSCND#boolean]
core/src/runtime/control.mjs:31:// [QSCND#coalesce]
core/src/runtime/control.mjs:43:// [QSCND#branch]
core/src/runtime/tagged-primitives.mjs:1:// [QSDSP#walk]
core/src/runtime/tagged-primitives.mjs:7:// [QSDSP#walk], [QSDSP#answer], [QSSLF#catalog]
core/src/runtime/tagged-primitives.mjs:8:registerPrimitive('tagged/within', runsAsCode(['code'], async (subject, code) => await code(payloadBeneath(subject))));
core/src/runtime/tagged-primitives.mjs:10:// [QSLIT#kind], [QSLIT#tag]
core/src/runtime/tagged-primitives.mjs:13:// [QSDSP#residence], [QSLIT#tag]

$ grep -n -E "^## (branch|within)$" docs/spec/QSCND-conditions-and-conversions.md docs/spec/QSCOL-collections.md
docs/spec/QSCND-conditions-and-conversions.md:89:## branch
docs/spec/QSCOL-collections.md:296:## within
```

### subordination · core/lib/qlang.qlang:1006
«the playground of the command line, `qplay`, is one»
Слой: это остаток главы хостов, которая была страницей командной строки. Прошлый прогон убрал из каталога ядра REPL, stdin и потоки, а имя одного потребителя осталось — единственная такая строка во всём `core/lib` и `core/src`.
Чистый лист: каталог ядра говорит то, что верно в любом хосте, а имя программы пишет страница `::host` в источнике самого хоста.
Дополняет D339, часть 13 («The core naming its consumers»).
```
$ grep -rn -i -w -E "qplay|playground" core/lib core/src
core/lib/qlang.qlang:1006:            `::builtin{}`; the playground of the command line, `qplay`, is
```
