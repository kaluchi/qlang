<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 985a4b82 and checking docs/spec/QSLIT-values-and-literals.md, docs/spec/QSORD-one-order.md and docs/spec/QSSYN-grammar.md, on 2026-10-15 from 08:05 to 08:21 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 985a4b82. -->

### conflict · QSLIT#tag

«A kind of the core reads its payload, a value of its own kind or, for a set, a quote and a doc, a vector, so `::number"5"` is refused». В QSERR#rest: «At rest an error is … a map of facts under `::error`». А сам вид `::error` в каталоге объявлен без `wraps` и принимает любой payload. Получается ошибка в покое, которая не держит карту фактов, и `raise` её отвергает.

```qlang
> ::error[1] | get [~(type) ~(payload) ~(payload | type)]
[::error [1] ::vec]

> ::error[1] | raise !| type
::map/raise/SubjectNotMapError

> ::error[1] | trail !| type
::path/IndexNotIntegerError

> ::number"5" !| type
::number/PayloadKindNotTakenError
```

Правило главы о payload видов ядра и правило QSERR#rest о карте фактов расходятся с объявлением `::error` в `core/lib`, которое payload не ограничивает.

### implementation · QSLIT#closed

«A group or a name written inside a container is refused by the parser, which names the template of `get` [QSPTH#template]». QSPTH#template говорит: «A container under a tag in the template … is read and laid back under its tags». Но исправление, которое предлагает отказ, переписывает только самый внутренний контейнер. Предложенный шаблон теряет тег и внешние скобки и строит другое значение.

```qlang
> "[::Box[x]]" | parse !| get /message
a literal computes nothing: a shape computed is built by `get`, its parts paths and quotes, write `get [~(x)]`

> "::Box[(1 | add 1)]" | parse !| get /message
a literal computes nothing: a shape computed is built by `get`, its parts paths and quotes, write `get [~(1 | add 1)]`

> get [~(1 | add 1)]
[2]

> get ::Box[~(1 | add 1)]
::Box[2]
```

Отказ называет шаблон, но ответ этого шаблона не совпадает с тем, что выражал отвергнутый литерал. Вопрос: должно ли исправление сохранять стопку тегов и внешние контейнеры исходного литерала?

### conflict · QSLIT#tag

«a label laid over a value already under it stands once, `::Lab::Lab[1]` reading `::Lab[1]`». Страница `::any/desc` утверждает обратное: «A desc of a desc ranks as the value does». Дерево следует странице: `::desc` складывается в стопку, и именно на этом стоит её порядок. Остальные виды ядра действительно стоят однократно.

```qlang
> ::desc::desc#5
::desc::desc#5

> [1 3 2] | sort ~(desc | desc)
[1 2 3]

> :Lab |~~ L. ~~| | ::Lab::Lab[1]
::Lab[1]

> ::link::link~(a)
::link~(a)
```

Глава формулирует однократность для всякой метки, а страница `::any/desc` и дерево делают для `::desc` исключение, которого глава не называет.

### design · QSORD#desc

«It owns its comparisons … the comparisons of the core compare within one kind». На странице `::desc`: «Every comparison agrees with it, `gt` and `lt` as `sort` and `max`». Вход `gt` числа принимает значение, обход тегов которого доходит до `::number` (QSBLD#input). Поэтому сравнение числа с `::desc` или с любым тегированным числом отвечает иначе, чем единый порядок. В обратную сторону то же сравнение отвергается.

```qlang
> 2 | gt (1 | desc)
true

> [::desc#1 2] | sort
[2 ::desc#1]

> 1 | desc | lt 2 !| type
::desc/lt/value/KindNotTakenError

> 2 | gt ::Box#1
true

> [2 ::Box#1] | sort
[2 ::Box#1]
```

На вопрос «стоит ли 2 после этого значения» `gt` и `sort` отвечают по-разному, а перестановка сторон даёт отказ вместо ответа. Вопрос: какое согласованное поведение ждать от `number/gt` для значения под `::desc` или под чужим тегом — ответ единого порядка или отказ по виду, симметричный `desc/lt`?

### text · QSSYN#line

«A declaration joins the step before it on its own line with no combinator, `[1 2] :y 2 | y` answering `2`, while any other step is joined by one». Это верно только после шага, который не команда. После команды ключевое слово на той же строке читается как её модификатор (`ModifierGap` в `core/src/grammar.peggy:400`).

```qlang
> [1 2] :y 2 | y
2

> 5 | (add 1) :y 2 | y
2

> 5 | add 1 :y 2 | y !| type
::number/add/ArgsBeyondInputsError

> [1] | append :y 2 | y !| type
::vec/append/ArgsBeyondInputsError
```

Предложение главы утверждает правило шире, чем его держат грамматика и единственный кейс (`a-declaration-joins-the-step-before-it-on-its-line`, литерал перед объявлением).

### design · QSSYN#combinator

«a pipe written before `!|` stands for the combinator after it, and any other combinator after a combinator is refused, after `| !|` as after `!|`, one written against its neighbour with a message that names the space». «A pipeline, a group and a quote may open with a combinator». Между шагами `| !|` означает `!|`, а `!| |` отвергается с `:message`. В голове конвейера, группы или цитаты `| !|` отвергается, а `!| |` получает только `:expected`/`:found`, без сообщения. Сюда же относится запятая между модификаторами: в скобках она получает сообщение о форме команды, на верхнем уровне — нет.

```qlang
> "x" | add 1 | !| 0
0

> "| !| 0" | parse !| get [~(query /message) /found]
[null "!"]

> "5 | !| | 0" | parse !| get [~(query /message) ~(query /found)]
["`|` written after `!|` is the habit of a pipe before every step: write `a !| b`" null]

> "!| | 0" | parse !| get [~(query /message) /found]
[null "|"]

> "5 | add 1, 2" | parse !| get [~(query /message) ~(query /found)]
[null ","]

> "[1] | append (1, 2)" | parse !| get [~(query /message)]
["modifiers are separated by spaces, not by commas: `f a b`"]
```

Одна и та же запись комбинаторов (и одна привычка с запятой) читается по-разному в голове и между шагами. Вопрос: как согласованно читать ведущий `| !|` и с каким отказом встречать `!| |` и запятую в любом месте?

### conflict · QSSYN#step

В главе: «A value stands at the head of a query, of a group and of a quote, after a declaration, and as a modifier». В QSSYN#line: «a keyword alone on its line before a combinator or the end of the source is the modifier above». Страница `::qlang/pipeline` говорит иначе: «a value stands … after the declarations that open one» и «a keyword that begins a line opens a declaration of its own». Дерево следует главе.

```qlang
> 5 | :x 1 | [1 2] | count
2

> {:a 1} | apply ("get\n:a" | parse)
1

> "get\n:a" | parse
~(get :a)
```

Страница сужает место значения до объявлений в начале и не знает ключевого слова-модификатора на отдельной строке; глава и дерево допускают и то и другое.

### design · QSSYN#refusal

«A refusal the grammar writes holds a `:message` …; any other holds the continuations … as `:expected` and what it met as `:found` … A form another language writes is refused with the form of this one: a set written with braces names `#[`, a quote written with braces names its parentheses». Обе формы чужого языка отвергаются с сообщением, но набор фактов у них разный. Сообщение для `#{` пишет `formMeantAt` в `core/src/parse.mjs:111`, а не грамматика, и оно идёт вместе с `:expected` и `:found`.

```qlang
> "#{1}" | parse !| keys
#[:expected :found :location :marker :message :source :trail :uri]

> "~{/age | doc}" | parse !| keys
#[:location :marker :message :source :trail :uri]
```

Два отказа из одного предложения главы отвечают разной формой фактов, и ни одна из двух ветвей главы не описывает `#{`. Вопрос: какую форму фактов должен держать отказ формы чужого языка?

### case · QSORD#order

`{"name":"a-doc-ranks-by-its-segments-a-run-of-prose-before-a-quote","query":"[|~~ z ~~| |~~ ~(b) ~~|] | sort",…}`. Обе доки открываются прозой, и порядок решает сравнение строк `" "` и `" z "`, а не «prose before a quote». Если бы цитата шла раньше прозы, ответ был бы тем же.

```qlang
> [|~~ z ~~| |~~ ~(b) ~~|] | map ~segments
[[" z "] [" " ~(b) " "]]

> [[~(b)] ["z"]] | map ~(tag ::doc) | sort | map ~segments
[["z"] [~(b)]]
```

Кейс не показывает правило из своего имени. Кроме того, место doc и desc в порядке видов (после quote, перед прочими тегами) не держит ни один кейс раздела.

```qlang
> [::desc#1 ::elision{:size 1} ~(a) |~~ a ~~| {:a 1}] | sort | map ~type
[::map ::quote ::doc ::elision ::desc]
```

### case · QSLIT#atoms

`{"name":"an-error-comes-back-from-the-atoms-of-its-facts","query":"#[1 :k :trail ::FooError] | get [/3 ~(…)] | tag | raise",…}`. В атомах нет `::error`. Кейс кладёт `::FooError` прямо на карту, и ошибкой значение делает `raise` (правило QSERR#raise), а не `tag` из тега и payload, как пишет раздел.

```qlang
> ::FooError!{:k 1} | get [~(type) ~(payload | type) ~(payload | payload)]
[::FooError ::error {:k 1}]

> [::FooError {:k 1}] | tag | eq ::FooError!{:k 1}
false
```

Кейс показывает правило QSERR#raise, а возврат ошибки в покое через `tag` не держит.

### case · QSLIT#tag

Ни один кейс не держит «a label laid over a value already under it stands once» и `::any/tag/name/KindNotTakenError`.

```qlang
> 5 | tag :Foo !| type
::any/tag/name/KindNotTakenError
```

```sh
$ grep -rlF 'tag/name/KindNotTakenError' core/test/conformance core/lib docs/spec
core/lib/qlang/any.qlang
docs/spec/QSLIT-values-and-literals.md

$ grep -rlF '::Lab::Lab' core/test/conformance docs/spec
docs/spec/QSLIT-values-and-literals.md
```

Оба правила раздела в кейсах отсутствуют.

### case · QSLIT#string

«holds a line break or a tab written raw as it is». В `QSLIT/string.jsonl` есть только экранированные `\n` и `\t`; сырой перенос строки и табуляцию не держит ни один кейс.

```qlang
> "a	b" | eq "a\tb"
true
```

Правило о сырых символах кейсов не имеет.

### case · QSLIT#json

«one comma between every two … a map of keyword keys and a set are written with whitespace». Отказы для `[1,,2]`, `[1,]`, `{"a": 1 "b": 2}`, `{:a 1, :b 2}` и `#[1, 2]` не держит ни один кейс `QSLIT/json.jsonl`.

```qlang
> "[1,,2]" | parse !| type
::quote/ParseError

> "{:a 1, :b 2}" | parse !| type
::quote/ParseError

> "#[1, 2]" | parse !| type
::quote/ParseError
```

Правила запятых раздел формулирует, а кейсы их не держат.

### case · QSORD#sort

Раздел называет `::map/sort/key/…` и `::vec/min/key/…`, а также «an error at rest a key answers ranks as the one order ranks it» и «a value that is no container answers none of them». Кейс есть только для `::vec/sort/key/KindNotTakenError`.

```qlang
> {:a 1} | sort 5 !| type
::map/sort/key/KindNotTakenError

> [1] | min 5 !| type
::vec/min/key/KindNotTakenError

> [{:a 2 :e !{:k 1}} {:a 1 :e !{:k 1}}] | sort ~(get [/e /a]) | map /a
[1 2]

> "cab" | sort !| type
::call/KindAnswersNoVerbError
```

Эти четыре правила кейсов не имеют.

### case · QSSYN#step

Ни один кейс не держит «`filter(gt(1))` … a call written by habit that runs where its input takes a value and is refused where it takes code». Отказ для цитаты пути с ведущим `|` («a leading `|` before it among it») тоже без кейса.

```qlang
> 5 | add(1)
6

> [1 2] | filter(gt(1)) !| type
::vec/filter/predicate/KindNotTakenError

> "[{:n 1}] | map ~(| /n)" | parse !| get /message
the quote of a path answers the path, which no word wants: give the path bare, `/n`
```

```sh
$ grep -rlE 'filter\(gt\(|~\(\| /' core/test/conformance docs/spec
docs/spec/QSSYN-grammar.md
```

Правила есть только в главе.

### text · core/src/grammar.peggy:164

Код цитирует `[QSLIT#tag]` для правила «literal computes nothing», которое глава формулирует в QSLIT#closed. Сам `[QSLIT#closed]` не цитирует ничто.

```sh
$ grep -n 'QSLIT#tag' core/src/eval.mjs core/src/grammar.peggy core/src/walk.mjs core/src/path-read.mjs core/src/primitives.mjs
core/src/eval.mjs:197:// subject [QSLIT#tag]; a failure lives in the pipe alone, so the first a part
core/src/eval.mjs:966:// as it is where no kind answers the tag [QSLIT#tag], [QSBLD#input], never
core/src/eval.mjs:988:// constructor attaches the tag or refuses the payload [QSLIT#tag].
core/src/eval.mjs:1055:// whose quotes are written in the step [QSQUO#held], [QSLIT#tag].
core/src/grammar.peggy:164:  // doc that writes one reads as prose [QSLIT#tag].
core/src/grammar.peggy:483:// parentheses; every part of a literal is a literal [QSLIT#tag].
core/src/grammar.peggy:529:// the sign of code, are refused [QSLIT#tag]. `::tag` alone is the tag name.
core/src/walk.mjs:69:// literals [QSLIT#tag], a path among them [QSPTH#value], a quote, whose code
core/src/path-read.mjs:22:// of code or prose [QSLIT#tag].
core/src/primitives.mjs:124:// its paths and its other values handed as they are [QSLIT#tag].

$ grep -rlF 'QSLIT#closed' core cli lsp scripts docs/spec
```

Блоки `eval.mjs:197`, `grammar.peggy:164`, `grammar.peggy:483`, `walk.mjs:69` и `primitives.mjs:124` держат правило QSLIT#closed, а цитируют QSLIT#tag.

### text · core/src/ordering.mjs:1

«first by kind, null, boolean, number, string, pattern, keyword, tag name, vector, set, map, quote, doc, elision and desc». В QSORD#order между tag name и vector стоит path, и строка 26 того же файла (`PATH_KIND = 6.5`) это держит.

```sh
$ sed -n 1,3p core/src/ordering.mjs
// One order ranks every value [QSORD#order]: first by kind, null,
// boolean, number, string, pattern, keyword, tag name, vector, set, map,
// quote, doc, elision and desc, then every other tag by its name; within
```

Комментарий к единому порядку пропускает вид, который глава и код ставят в этот порядок.
