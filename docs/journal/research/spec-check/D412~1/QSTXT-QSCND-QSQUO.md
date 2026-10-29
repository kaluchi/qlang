> A check of the chapters `QSTXT`, `QSCND`, `QSQUO` for D412 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–00:03 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### design · QSCND#coalesce

Глава: «Each alternative is read in its turn: code, a quote or a path, runs against the subject, and a value answers itself». QSDSP#walk: «A word reads a value it takes from its subject or from code as a kind the same way, beneath every tag over it».

```qlang
> null | coalesce ::R~(7)
::R~(7)

> get [~([1 2] | map ::R~(add 1)) ~(5 | allOf ::R~(gt 1)) ~(null | coalesce ::R~(7) 8 !| tag)]
[[2 3] true ::any/coalesce/AlternativesValuesAloneError]

> [::any/coalesce ::any/allOf ::vec/map] | map ~(binding | value | inputs | map /kinds)
[[null] [[#[::boolean ::path ::quote]]] [#[::path ::quote]]]
```

`map` и `allOf` запускают цитату под тегом как код. Для `coalesce` у входа `alternatives` виды не названы, и та же цитата для него значение: она не запускается, а с другим значением рядом попадает под отказ `AlternativesValuesAloneError`. Какой согласованный ответ дать альтернативе, если это цитата или путь под тегом?

### design · QSCND#coalesce

QSCND#coalesce: «and so does a value computed at the call that is a failure [QSQUO#modifier]». QSCND#boolean ссылается на тот же раздел: «and an error computed at the call at its own [index] … [QSQUO#modifier]».

```qlang
> get [~({} | allOf (get /a) !| tag) ~({} | coalesce (get /a) 0 !| tag)]
[::any/allOf/ConditionsElementKindNotTakenError ::path/KeyNotInMapError]
```

Оба входа запускают код и принимают значения. Провал, вычисленный при вызове, `allOf` отказывает под своим входом, а `coalesce` передаёт как есть. Дерево решает это по тому, называет ли вход вид `::quote` (`core/src/eval.mjs:997`). Какой согласованный ответ дать такому провалу на входе, который берёт и код, и значение?

### conflict · QSCND#boolean

Глава: «A condition answers a boolean, … the condition of an invariant and of a law among them [QSDSP#walk], or is refused under the verb that runs it». Против этого QSSLF#laws: «a law passing only where it answers `true`», и страница `::any/runLaws`: «`:ok` whether the answer is true, so a law that answers false or an error fails».

```qlang
> :Box |~~ B. ~~|; :Box/m |~~ M. ~~| ::law~(1); ::Box | runLaws | map ~(get [/actual /error /ok])
[[1 null false]]

> [1] | filter ~(1) !| tag
::vec/filter/ConditionKindNotTakenError

> :Box |~~ B. ~~| (::kind | holds :k |~~ k. ~~| ~(1)); ::Box[1] !| get [~(tag) ~(found)]
[::Box/k [1]]

> :Box |~~ B. ~~| (::kind | holds :k |~~ k. ~~| ~(false)); ::Box[1] !| get [~(tag) ~(found)]
[::Box/k [1]]
```

Закон, ответивший не булевым значением, не отказан, а просто не проходит; так говорят QSSLF#laws и страница `runLaws`. Инвариант с ответом `1` отказан точно так же, как с ответом `false`. «Or is refused» из QSCND#boolean дерево держит только для `filter` и ему подобных.

### design · QSTXT#search

Глава: «`contains`, `startsWith` and `endsWith` ask a string for a text». В QSTXT#match `replace` «read by code points», а в QSTXT#string строка считается кодовыми точками.

```qlang
> get [~("😀" | split "\uD83D" | map ~count) ~("😀" | contains "\uD83D") ~("😀" | startsWith "\uD83D") ~("😀" | replace "\uD83D" "x") ~("😀" | contains #"\uD83D")]
[[0 1] true true "😀" false]
```

Текстовая игла у `split`, `contains` и `startsWith` находит половину суррогатной пары, и `split` режет символ пополам. `replace` с текстом и `contains` с регексом читают ту же строку по кодовым точкам и этой половины не видят. По каким единицам согласованно ищется текстовая игла?

### design · QSTXT#string

Глава: «`trim` answers it without the whitespace at its two ends». QSHST#source: «A string that holds the mark holds the character, which the grammar reads as no whitespace». Грамматика определяет `Whitespace "whitespace" = [ \t\n\r]` (`core/src/grammar.peggy:1120`).

```sh
$ printf '"\302\240a\357\273\277"' | qplay 'get [~(count) ~(trim | count)]'
[3 1]

$ printf '"[1\302\2402]"' | qplay 'parse !| expected'
[:whitespace "," "]"]

$ printf '"[1\357\273\2772]"' | qplay 'parse !| expected'
[:whitespace "," "]"]
```

Слово «whitespace» у `trim` и у парсера называет два разных множества. Неразрывный пробел и U+FEFF `trim` срезает как пробелы, а парсер на тех же символах отказывает и ждёт `:whitespace`. Страница `::string/trim` называет «spaces, tabs, line breaks and the no-break space» и не упоминает U+FEFF. Что согласованно считать пробелом?

### design · QSTXT#split

QSTXT#split: «`split` cuts a string at … every match of a regex, … a separator at an end or two together leave empty pieces». QSTXT#match: «`scan` … an empty match met before every code point and at the end».

```qlang
> get [~("ab" | scan #"x*") ~("ab" | replace #"x*" "-") ~("ab" | split #"x*") ~("ab" | split #"^") ~("ab" | split #"b")]
[["" "" ""] "-a-b-" ["a" "b"] ["ab"] ["a" ""]]
```

`scan` и `replace` встречают пустое совпадение в начале и в конце строки. `split` с тем же регексом там не режет, хотя непустое совпадение в конце оставляет пустой кусок; ответ дерева держит кейс `split-by-an-empty-match-cuts-at-code-points`. Считать ли пустое совпадение на конце строки разрезом?

### design · QSCND#boolean

Глава: «`and` and `or` join a boolean subject with the `:condition` the call gives». В QSDSP#answer `and` и `or` в список комбинаторов не входят, поэтому для них действует «an input of any other step steers it and shares no tag».

```qlang
> get [~(::Ok#true | and false) ~(false | and ::Ok#true) ~(::Ok#true | and false | eq (false | and ::Ok#true)) ~(::Ok#true | and ::No#true) ~(::Ok#1 | add ::No#1 !| tag)]
[::Ok#false false false ::Ok#true ::call/KindsMismatchedError]
```

`and` сохраняет теги субъекта и роняет теги условия. Поэтому `a | and b` и `b | and a` не равны по `eq`, а два разных тега, которые `add` отказывает парой, `and` соединяет молча. Под какими тегами согласованно отвечает соединение двух условий?

### design · QSCND#compare

Глава: «The order ranks every value, the kinds among themselves, while a comparison relates two values of one kind: a pair of two kinds is refused as the pair».

```qlang
> get [~(5 | gt "a" !| tag) ~(::Box#5 | gt ::Box#"a") ~([::Box#5 ::Box#"a"] | max) ~([5 "a"] | max !| tag)]
[::call/KindsMismatchedError false ::Box#"a" ::call/KindsMismatchedError]
```

Голые число и строку сравнение отказывает парой. Под одним общим тегом оно молча ранжирует их по общему порядку, и `max` выбирает строку. Сравнение «payloads of any kinds» QSORD#desc оговаривает только для `::desc`. Распространяется ли отказ пары двух видов на нагрузки под общим тегом?

### text · QSQUO#modifier

Глава: «refuses a value computed at the call that none of its kinds takes, a failure among it, one level under the verb by the input's name raised, the value the input's `found`». Против этого кейс `a-failed-modifier-whose-label-refuses-its-error-at-rest-answers-that-refusal`.

```qlang
> :Late |~~ Late. ~~| (::kind | accepts |~~ The facts. ~~| ::map); [1] | filter (::Late{:by 3} | raise) !| tag
::Late/PayloadKindNotTakenError

> :Late |~~ Late. ~~|; [1] | filter (::Late{:by 3} | raise) !| tag
::vec/filter/PredicateKindNotTakenError
```

Кейс раздела держит правило, которого глава не формулирует. Провал сначала кладётся в покой через метку своего тега, и если метка отказывает, её отказ отвечает вместо отказа входа. QSERR#catch говорит так только о `!|`.

### design · QSCND#boolean

В главе `5 | if 1 ~(1) ~(2) !| tag` даёт `::any/if/ConditionKindNotTakenError`. Там же: «A quote that answers another kind is refused at its index, `::any/allOf/ConditionKindNotTakenError`, … a condition of another kind … is refused as `ElementKindNotTakenError`».

```qlang
> get [~(5 | if 1 ~(1) ~(2) !| tag) ~(5 | allOf 1 !| tag) ~(5 | allOf ~(1) !| tag)]
[::any/if/ConditionKindNotTakenError ::any/allOf/ConditionsElementKindNotTakenError ::any/allOf/ConditionKindNotTakenError]
```

Одно последнее имя `ConditionKindNotTakenError` у `if`, `and` и `or` отказывает значение, вычисленное при вызове, а у `allOf`, `cond` и `filter` отказывает ответ кода. То же значение при вызове `allOf` отказывает под другим именем. Согласованно ли одним именем называть отказ значения при вызове и отказ ответа цитаты?

### text · QSQUO#step

QSQUO#step: «`get` a path and a container, `tag` a tag name, `apply` a quote, and any other value 'a step is a command' [QSSYN#step]». QSSYN#step: «a path, a container literal and a tagged literal naming `get`».

```qlang
> get [~([1 ::construct{:tag ::Width :payload 5}] | tag ::quote !| message) ~("5 | ::Width#5" | parse !| message)]
["a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`" "a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`"]
```

Литерал под тегом над числом не путь и не контейнер. По QSQUO#step он получил бы «a step is a command», а QSSYN#step и дерево называют для него `get`.

### text · QSQUO#parse

QSQUO#parse: «and any other quote writes its steps on one line». QSPRN#print: «A step of a quote whose line, its pipe among it, passes eighty characters is laid on lines».

```qlang
> ~(foo aaaaaaaaaaaa bbbbbbbbbbbb cccccccccccc dddddddddddd eeeeeeeeeeee ffffffffffff gggggg) | toString | lines | count
8
```

Цитата из одного шага не подходит ни под «all declarations», ни под «several steps», значит по QSQUO#parse она пишется в одну строку. По QSPRN#print, как и в дереве, она ложится на 8 строк.

### text · QSCND#convert

QSCND#convert: «a kind answering its own verb with itself under the tags it came with». QSTXT#regex: «each with the flags its call gives instead of its own». Страница `::regex/toRegex`: «given flags … it answers its source with those flags».

```qlang
> get [~(#"a"m | toRegex "i") ~(#"a"m | toRegex "i" | eq #"a"m) ~(::T{:a 1} | toMap) ~(::W"s" | toString)]
[#"a"i false ::T{:a 1} ::W"s"]
```

Общее правило QSCND#convert не выполняется для `::regex/toRegex` с флагами: такой вызов отвечает другим регексом, и это правило знают QSTXT#regex, страница и кейсы.

### text · QSTXT#string

Глава: «takes and drops by its code points, a letter of any script, an emoji and a combining mark each one». Страница `::string/count`: «a skin tone, a flag or a joined emoji counts each of its code points».

```qlang
> get [~("🇺🇸" | count) ~("👍🏽" | count) ~("🇺🇸" | take 1 | count)]
[2 2 1]
```

По главе эмодзи считается за одно, а по странице и закону `countsEachCodePointOfATonedEmoji` эмодзи из нескольких кодовых точек считается по каждой, и `take 1` берёт половину флага.

### case · QSTXT#string

Правило «counts … takes and drops by its code points» не держит ни один кейс `QSTXT/string.jsonl`. В файле нет ни одного символа за базовой плоскостью, поэтому подсчёт кодовыми единицами UTF-16 прошёл бы все его кейсы.

```sh
$ LC_ALL=C.UTF-8 grep -c -P '[\x{10000}-\x{10FFFF}]' core/test/conformance/QSTXT/string.jsonl
0
```

```qlang
> get [~("😀x" | count) ~("😀x" | take 1) ~("😀x" | drop 1)]
[2 "😀" "x"]
```

### design · QSCND#convert

Глава: «`desc`, a verb of any value, turns its subject, its recipe taking `::desc` off a value under it and laying it over any other». QSLIT#tag: «A tag the value is of already … changes nothing».

```qlang
> get [~(::Box::desc#5 | desc) ~(::Box::desc#5 | is ::desc) ~([::Box::desc#1 ::Box::desc#2] | sort) ~([::Box::desc#1 ::Box::desc#2] | sort ~(desc))]
[::Box::desc#5 true [::Box::desc#2 ::Box::desc#1] [::Box::desc#2 ::Box::desc#1]]
```

Значение лежит под `::desc` по `is`, но внешний тег у него другой. `desc` не поворачивает его ни в какую сторону, и `sort ~(desc)` ранжирует его так же, как `sort`. Что должен отвечать поворот для значения, чей `::desc` стоит под другим тегом?

### design · QSTXT#match

QSTXT#string: «`append` and `prepend` write a text at one end, a keyword written as its name». QSTXT#split: «`join` … between a separator, a keyword written as its name».

```qlang
> get [~("abc" | replace "a" :x !| tag) ~("bc" | prepend :x) ~(["a" "b"] | join :x)]
[::string/replace/WithKindNotTakenError "xbc" "axb"]
```

`replace` тоже пишет текст в строку, но его вход `with` отказывает ключевое слово, которое `append`, `prepend` и `join` пишут как его имя. Должен ли текст, который глагол пишет в строку, согласованно принимать ключевое слово?

### case · QSCND#convert

Кейс `every-atom-turns-into-the-text-of-its-literal` своим именем утверждает правило, которое раздел опровергает. По разделу ключевое слово и имя тега превращаются в свои имена, а у регекса и пути, атомов по QSLIT#atoms, строки нет.

```qlang
> get [~(:a | toString) ~(::vec | toString) ~(#"a" | toString !| tag)]
["a" "vec" ::call/KindAnswersNoVerbError]

> /a | toString !| tag
::call/KindAnswersNoVerbError
```

### case · QSQUO#step

Правило «a throw of the parser that is no refusal of the text, the overflow of its stack under a nest too deep among it, passes as it is, which `parse` answers as `::quote/ParseError` with its message» не держит ни один кейс, только юнит-тест.

```qlang
> 20000 | range | map ~("[") | join "" | parse !| get [~(tag) ~(message)]
[::quote/ParseError "Maximum call stack size exceeded"]
```

```sh
$ git grep -l -e "deep nest" -e "Maximum call stack" -- core/test
core/test/unit/QSQUO/step.test.mjs
```

### drift · QSQUO#step

Глава: «so inside a container, a field or a payload a step is an element step». Из текстов, которые говорят, что держится, «element step» встречается только здесь. То же самое QSERR#trace, страница `::construct` и `steps.mjs` называют «part of a literal».

```sh
$ git grep -n -e "element step" -e "part of a literal" -e "isPartOfALiteral =" -- docs/spec core/lib core/src/steps.mjs CLAUDE.md
core/lib/qlang/construct.qlang:46:        |~~ A payload computes nothing, as every part of a literal: a name
core/src/steps.mjs:43:const isPartOfALiteral = value => isLiteral(value) || isConstructStep(value) || isComputingStep(value);
docs/spec/QSERR-errors.md:197:there among it, and a part of a literal, which is one step, answer within
docs/spec/QSQUO-code-as-data.md:54:or a payload a step is an element step. The parser reads a text into these
```

### conflict · core/src/runtime/json.mjs:136

Метка `[QSQUO#modifier]` стоит над `json` и `parseJson`, а `stdio/src/table.mjs:1` ставит её же над `table`. Ни у одного из этих глаголов нет модификатора или входа кода. Их правила лежат в QSPRN#json и QSPRN#print.

```sh
$ git grep -n -e "^// \[" -e "registerPrimitive" -- core/src/runtime/json.mjs stdio/src/table.mjs
core/src/runtime/json.mjs:1:// [QSSLF#catalog], [QSPRN#json]
core/src/runtime/json.mjs:5:import { registerPrimitive } from '../primitives.mjs';
core/src/runtime/json.mjs:14:// [QSHST#door]
core/src/runtime/json.mjs:85:// [QSLIT#json]
core/src/runtime/json.mjs:136:// [QSQUO#modifier]
core/src/runtime/json.mjs:139:registerPrimitive('any/json', subject => JSON.stringify(toPlain(subject)));
core/src/runtime/json.mjs:140:registerPrimitive('string/parseJson', subject => {
stdio/src/table.mjs:1:// [QSDSP#residence], [QSQUO#modifier]
stdio/src/table.mjs:8:// [QSPRN#print]
```

### conflict · core/src/runtime/sequence.mjs:300

Метки расходятся с разделами QSTXT:
- `[QSTXT#string]` стоит над `vec/join`, а правило `join` глава даёт в QSTXT#split.
- `string/count` и `string/take` стоят под `[QSERR#trace]` и `[QSERR#site]`, а их правило кодовых точек — QSTXT#string.
- `string-primitives.mjs:18` ставит `[QSTXT#string]` над `contains`, `startsWith` и `endsWith`, чьё правило — QSTXT#search.

```sh
$ git grep -n -e "^// \[QSTXT" -e "^// \[QSERR#trace\]" -e "^// \[QSERR#site\]" -e "'string/count'" -e "'string/take'" -e "'vec/join'" -e "'string/contains'" -- core/src/runtime/sequence.mjs core/src/runtime/string-primitives.mjs
core/src/runtime/sequence.mjs:13:// [QSERR#trace]
core/src/runtime/sequence.mjs:18:registerPrimitive('string/count', text => Array.from(text).length);
core/src/runtime/sequence.mjs:267:// [QSERR#site]
core/src/runtime/sequence.mjs:268:registerPrimitive('string/take', (text, count) => Array.from(text).slice(0, Math.max(0, count)).join(''));
core/src/runtime/sequence.mjs:300:// [QSTXT#string], [QSCOL#sequence]
core/src/runtime/sequence.mjs:303:registerStateReader('vec/join', (subject, separator, state) => {
core/src/runtime/string-primitives.mjs:1:// [QSTXT#string]
core/src/runtime/string-primitives.mjs:12:// [QSTXT#split]
core/src/runtime/string-primitives.mjs:18:// [QSTXT#string]
core/src/runtime/string-primitives.mjs:30:registerPrimitive('string/contains',   (subject, needle) => (isRegex(needle) ? containsMatch(subject, needle) : subject.includes(needle)));
```

### pentimento · core/lib/qlang/regex.qlang:22

Страница `::regex`: «a group of flags, `(?i:…)`, and a group name written twice, which only later engines read, do not parse».

```qlang
> ::regex | doc | content | contains "which only later engines"
true
```

Оборот «which only later engines read» оправдывает отказ движками вне дерева. Проверить его по дереву нельзя, тогда как правило уже сказано как то, что держится: диалект ECMAScript 2018.
