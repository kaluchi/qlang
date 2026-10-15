<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 3d6ad533 and checking docs/spec/QSSLF-the-language-describes-itself.md, docs/spec/QSPRN-printing-and-codecs.md and docs/spec/QSHST-hosts-and-the-command-line.md, on 2026-10-15 from 07:04 to 07:17 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 3d6ad533. -->

### implementation · QSPRN#elide

«A marker holds `:size`, what it stands for»; страница `::elision`: «`:size` counts the elements, the entries or the characters it stands for». Если последний элемент вектора уже заменён маркером, код (`vectorParts` в `core/src/elide.mjs:113`) принимает этот маркер за маркер остатка от деления вектора пополам и прибавляет его `:size` к счёту элементов. Ни один кейс в `QSPRN/elide.jsonl` этого не проверяет.

```qlang
> ::elision | doc | content | contains "`:size` counts the elements, the entries or the characters it"
true

> 200 | range | map ~("a") | join "" | :s it | get [[~(s)] [1]] | :v it | elide 60 | get /0 | get [/size ~(get /read | :r it | v | apply r | get [~(type) ~(count)])]
[200 [::vec 1]]

> 200 | range | map ~("a") | join "" | :s it | get [[1 2 3 4 5 6 7 8 9 10 ~(s)] [0]] | elide 120
[
  [
    1
    2
    3
    4
    5
    ::elision{
      :size 205
      :read ~(get /0 | drop 5)
    }
  ]
  [0]
]
```

Маркер заменяет вектор из одного элемента, а его `:size` равен 200. Маркер заменяет шесть элементов, а его `:size` равен 205. Глава и страница расходятся с деревом. Каким должен быть `:size` маркера, если среди частей, которые он заменяет, уже есть маркер?

### design · QSSLF#axis

«A tag nothing declares whose last name ends in `Error` reads the record of the address before it». В QSSLF#manifest: «a name nothing declares is refused as `::any/manifest/UnknownNameError`».

```qlang
> ::number/add/SubjectNotNumbrError | doc | eq (::number/add | doc)
true

> ::number/add/SubjectNotNumbrError | manifest
#[::number/add/ArgsBeyondInputsError ::number/add/SubjectNotNumberError ::number/add/addend ::number/add/answer]

> ::number/add/SubjectNotNumbrErr | doc !| get [~(type) /nearest]
[::any/doc/UnknownNameError [::number/add/SubjectNotNumberError]]
```

Оба правила записаны как задумано, но вместе дают такой результат: опечатка в имени отказа, которое оканчивается на `Error`, молча читает страницу и manifest слова, без отказа и без `:nearest`. Та же опечатка без суффикса получает отказ и ближайшее имя. Каким должен быть ответ оси на адрес, оканчивающийся на `Error`, которого не объявляет ни одно правило и ни один источник?

### design · QSSLF#laws

«`runLaws` runs each …, the laws of a member when it is given its anchor, `::qlang | runLaws :errors`». В QSSLF#axis: «`laws`, `explain`, `manifest` and `tutorial` take no member, refusing one as `::any/manifest/ArgsBeyondInputsError` and its kin».

```qlang
> ::qlang | runLaws :errors | count
8

> ::qlang | laws :errors !| type
::any/laws/ArgsBeyondInputsError

> ::qlang | tutorial :errors !| type
::any/tutorial/ArgsBeyondInputsError
```

На один вопрос, законы члена имени, две дороги отвечают по-разному: `runLaws` и `doc` берут якорь, а `laws` и `tutorial` его отклоняют. Каким должен быть единый ответ осей на якорь?

### design · QSSLF#laws

«`tutorial` answers the pair of a name's page and its laws, a name nothing declares refused as `doc` refuses it». В QSERR#site: «Every place that refuses has a tag of its own, its address». В QSNAM#owner: «A word written in the language and a word of the host answer alike».

```qlang
> ::nothere | tutorial !| type
::any/doc/UnknownNameError

> ::nothere | laws !| type
::any/laws/UnknownNameError

> ::nothere | runLaws !| type
::any/runLaws/UnknownNameError
```

`tutorial` написан шагами, и его отказ получает адрес `doc`. Соседние оси, примитивы хоста, отказывают под собственным адресом. Под каким адресом должен отказывать на необъявленное имя word, написанный на языке?

### text · QSSLF#explain

«a value whose kind nothing declares is refused as `::any/explain/UnknownNameError`». По QSSLF#axis значение под необъявленным тегом читается по первому объявленному виду, а по QSLIT#kind вид есть у каждого значения. Отказ здесь получает имя, которое ничто не объявляет.

```qlang
> ::Nobody#1 | explain | page | eq (::number | doc)
true

> ::Nothing | explain !| type
::any/explain/UnknownNameError
```

Значения с необъявленным видом не бывает. Предложение называет этот отказ для такого значения, тогда как отказ получает имя, которое ничто не объявляет.

### conflict · QSSLF#catalog

«how the name behaves is told by its laws …, so a behaviour the prose tells and a law proves is told by the law alone». Страницы каталога пересказывают в прозе то же поведение, которое доказывает их закон.

```qlang
> ::span/start | get [~(doc | content | contains "`::span[0 1 1 4 1 5] | start`") ~(laws | get /answersThePointItStartsAt | get /1)]
[true ~(::span[0 1 1 4 1 5] | start | eq ::point[0 1 1])]

> ::number/add | get [~(doc | content | contains "`::Width#2 | add 3` answering `::Width#5`") ~(laws | get /answersUnderTheTag | get /1)]
[true ~(::Width#2 | add 3 | eq ::Width#5)]
```

Глава требует, чтобы поведение было сказано только законом. Страницы `::span/start` и `::number/add` (и `::any/tutorial`, «under the tag of `doc`» рядом с законом `refusesANameNothingDeclares`) говорят его дважды.

### conflict · QSSLF#explain

«The page of a refusal says what failed …, and its laws hold the recovery through `!|`». У отказов `::span` и `::point` страница есть, а законов нет. В `QSPRN/span.jsonl` нет кейса на правило QSPRN#span «`5 | start` refused as `::span/start/SubjectNotSpanError`».

```qlang
> ::span/start/SubjectNotSpanError | get [~(doc | type) ~(laws)]
[::doc {}]

> 5 | start !| type
::span/start/SubjectNotSpanError
```

```qlang
$ grep -c "SubjectNotSpanError" D:/git/qlang/core/test/conformance/QSPRN/span.jsonl
0
```

Страницы `::span/start`, `::span/end`, `::point/offset`, `::point/line` и `::point/column` для их отказов расходятся с главой.

### text · QSHST#answer

«The command line writes every answer as the language prints it, …, a string as its text». Проба под этим предложением показывает литерал строки:

```qlang
> {:a 1} | json
{"a":1}
```

В главе проба записана как `"{\"a\":1}"`. Это не то, что пишет командная строка, и проба противоречит предложению, под которым стоит.

### conflict · core/src/runtime/axis.mjs:2

Комментарий: «a keyword `:foo` reads the record its scope holds under the name» (цитирует [QSSLF#axis]). В QSSLF#axis: «A value is read by its kind, `5 | doc` the page of `::number`, a keyword among values».

```qlang
> :x |~~ mine ~~| 1 | :x | doc | eq (::keyword | doc)
true
```

Комментарий в начале модуля говорит одно, а глава и функция `declaringRecordOf` в том же файле (строка 53) говорят другое.

### case · QSSLF#axis

`QSSLF/axis.jsonl:12`: `{"name":"a-keyword-names-a-binding-of-its-scope","query":"::count | doc !| type",…}`. Запрос берёт имя тега, а не ключевое слово, и показывает отказ на тег, который ничто не объявляет. Само имя кейса говорит обратное главе.

```qlang
> ::count | doc !| type
::any/doc/UnknownNameError

> :count 5 | :count | doc | eq (::keyword | doc)
true
```

Имя кейса говорит, что ключевое слово читает привязку своей области видимости. Глава и дерево читают ключевое слово по его виду.

### case · QSHST#source

«A `::builtin{}` written in the recipe of a word a reader declares is the value it is: the word's address answers its function as a value, and its bare name reaches no word». Кейсы 1–4 `QSHST/source.jsonl` показывают другое: литерал `::builtin{…}` внутри кода quote или в имени есть значение. Ни один кейс не держит рецепт `impl ::builtin{}`.

```qlang
> :any/v (::fn | impl ::builtin{}) | 5 | any/v | type
::fn

> :any/v (::fn | impl ::builtin{}) | 5 | get [~(::any/v | type) ~(v !| type)]
[::tag ::call/UnknownNameError]
```

```qlang
$ grep -c "impl ::builtin" D:/git/qlang/core/test/conformance/QSHST/source.jsonl
0
```

Дерево держит это правило, но ни один кейс его не показывает.

### case · QSPRN#json

«`parseJson` … refuses a text that is no JSON with the reason, and a number past the doubles with its `:path`…»; «`parseJson` reads such an object back as the plain map it is»; «an error at rest two such layers». Ни у одного из этих правил нет кейса в `QSPRN/json.jsonl`.

```qlang
> "[1, 2" | parseJson !| type
::string/parseJson/TextNotJsonError

> ::Box#1 | json | parseJson
{:"$tag" "Box" :payload 1}

> "{\"a\": {\"b c\": [1, 1e400]}}" | parseJson !| get /path
["a" "b c" 1]
```

```qlang
$ grep -c "\$tag\|parseJson" D:/git/qlang/core/test/conformance/QSPRN/json.jsonl
1
```

Единственное совпадение там — кейс `json` для `::Box#1`. Правила чтения обратно ни один кейс не держит.

### case · QSSLF#axis

Отказы, которые называет глава, `::any/doc/anchor/KindNotTakenError`, `::any/manifest/ArgsBeyondInputsError` «and its kin», а в QSSLF#laws и QSSLF#explain `::any/laws/UnknownNameError`, `::any/runLaws/UnknownNameError`, `::any/explain/UnknownNameError` и в QSSLF#doc `::doc/PayloadKindNotTakenError`, не держит ни один кейс.

```qlang
> ::qlang | doc 5 !| type
::any/doc/anchor/KindNotTakenError

> 5 | tag ::doc !| type
::doc/PayloadKindNotTakenError
```

```qlang
$ grep -rc "SubjectNotErrorError\|SubjectNotSpanError\|parseJson/TextNotJsonError\|parseJson/NumberNotFiniteError\|laws/UnknownNameError\|runLaws/UnknownNameError\|explain/UnknownNameError\|anchor/KindNotTakenError\|doc/PayloadKindNotTakenError\|laws/ArgsBeyondInputsError\|manifest/ArgsBeyondInputsError" D:/git/qlang/core/test/conformance/QSSLF D:/git/qlang/core/test/conformance/QSPRN D:/git/qlang/core/test/conformance/QSERR
D:/git/qlang/core/test/conformance/QSSLF/axis.jsonl:0
D:/git/qlang/core/test/conformance/QSSLF/catalog.jsonl:0
D:/git/qlang/core/test/conformance/QSSLF/doc.jsonl:0
D:/git/qlang/core/test/conformance/QSSLF/explain.jsonl:0
D:/git/qlang/core/test/conformance/QSSLF/laws.jsonl:0
D:/git/qlang/core/test/conformance/QSSLF/manifest.jsonl:0
D:/git/qlang/core/test/conformance/QSSLF/near.jsonl:0
D:/git/qlang/core/test/conformance/QSSLF/page.jsonl:0
D:/git/qlang/core/test/conformance/QSPRN/elide.jsonl:0
D:/git/qlang/core/test/conformance/QSPRN/json.jsonl:0
D:/git/qlang/core/test/conformance/QSPRN/print.jsonl:0
D:/git/qlang/core/test/conformance/QSPRN/span.jsonl:0
D:/git/qlang/core/test/conformance/QSERR/catch.jsonl:0
D:/git/qlang/core/test/conformance/QSERR/flow.jsonl:0
D:/git/qlang/core/test/conformance/QSERR/print.jsonl:0
D:/git/qlang/core/test/conformance/QSERR/raise.jsonl:0
D:/git/qlang/core/test/conformance/QSERR/rest.jsonl:0
D:/git/qlang/core/test/conformance/QSERR/site.jsonl:0
D:/git/qlang/core/test/conformance/QSERR/trail.jsonl:0
```

Глава называет эти отказы, а ни один кейс их не показывает.

### case · QSSLF#explain

«`trail` is a word of errors, `42 | trail` refused.» То же правило есть в QSERR#trail («refuses a subject that is no error as `::error/trail/SubjectNotErrorError`»). Ни в `QSSLF/explain.jsonl`, ни в `QSERR/trail.jsonl` кейса на него нет (в выводе grep выше `explain.jsonl:0` и `trail.jsonl:0`).

```qlang
> 42 | trail !| type
::error/trail/SubjectNotErrorError
```

Правило стоит в двух главах, и ни один кейс его не держит. В QSSLF#explain оно к тому же не относится к правилу самой секции.

### text · QSSLF#manifest

«its words, its refusals, its pages and the inputs and answer of a word». QSBLD#fn и QSBLD#chain называют и `subject` узлом, который кладёт цепочка, и manifest его перечисляет:

```qlang
> :Shop |~~ A shop. ~~| | :Shop/hours (::fn | on |~~ The shop. ~~| ::tag | impl ~("9")) | ::Shop/hours | manifest
#[::Shop/hours/subject]
```

Перечисление в главе пропускает узел `subject`, который держат дерево и QSBLD.

### text · QSSLF#doc

«`::link`, which `links` answers and `open` follows to a page». Кейс 25 в `QSSLF/doc.jsonl` («a-link-opens-to-the-answer-of-its-query») держит другое:

```qlang
> |~~ ::link~(1 | add 1) ~~| | links | first | open
2
```

Глава говорит, что `open` ведёт к странице, а кейс и QSQUO#apply («`open` … runs a quote from null») отвечают ответом запроса, каким бы он ни был.

### case · core/src/nearest-names.mjs:1

Комментарии кода цитируют секции, которые не формулируют их правило: `nearest-names.mjs:1` цитирует [QSHST#answer] для ближайших имён, правила QSSLF#near. `verb.mjs:31`, `tagged.mjs:56` и `arith.mjs:5` цитируют [QSSLF#catalog] для «a number is a finite double», правила QSLIT#number и QSNUM#arithmetic.

```qlang
$ grep -n "QSSLF#catalog\]\|QSHST#answer\]: the" D:/git/qlang/core/src/runtime/verb.mjs D:/git/qlang/core/src/runtime/tagged.mjs D:/git/qlang/core/src/runtime/arith.mjs D:/git/qlang/core/src/nearest-names.mjs
D:/git/qlang/core/src/runtime/verb.mjs:25:// needs: where the word lives [QSSLF#page], [QSSLF#catalog].
D:/git/qlang/core/src/runtime/verb.mjs:31:// map; a number is a finite double [QSSLF#catalog].
D:/git/qlang/core/src/runtime/verb.mjs:67:// [QSDSP#answer], [QSSLF#catalog], and at once where it is of the kind and the
D:/git/qlang/core/src/runtime/tagged.mjs:25:// The constructors of the core's kinds [QSLIT#kind], [QSSLF#catalog]: each
D:/git/qlang/core/src/runtime/tagged.mjs:56:// the doubles' range is refused here, once for every word [QSSLF#catalog].
D:/git/qlang/core/src/runtime/tagged.mjs:121:// [QSDSP#answer], [QSSLF#catalog].
D:/git/qlang/core/src/runtime/arith.mjs:5:// brought under `::number` [QSSLF#catalog].
D:/git/qlang/core/src/nearest-names.mjs:1:// The names an unresolved name was likely meant to be [QSHST#answer]: the

$ grep -n "finite\|double" D:/git/qlang/docs/spec/QSSLF-the-language-describes-itself.md
```

Метки ведут не к тем секциям, правило которых держат эти блоки (QSWRK#marks).

### conflict · QSSLF#catalog

«A declaration is laid out its name on a line, each doc of its slot on the lines after it indented two, and its value after them». QSWRK#catalog формулирует то же правило иначе: «its value on the line after them; a keyword value stays on the line of its doc».

```qlang
$ grep -n "keyword value stays" D:/git/qlang/docs/spec/QSWRK-the-work.md
460:on the line of its doc.
```

Две главы задают для одной раскладки разные правила для значения-ключевого слова.

### case · QSPRN#print

`QSPRN/print.jsonl:9`: `{"name":"doc-with-backticks-in-content","query":"|~~ see ~(mul 2) for ref ~~|",…}`. В запросе нет обратных кавычек.

```qlang
> |~~ see ~(mul 2) for ref ~~|
|~~ see ~(mul 2) for ref ~~|
```

Имя кейса называет правило, которого запрос не показывает.

### case · QSSLF#page

`QSSLF/page.jsonl:4`: предикат `every ~(false !| true | not)` отвечает `true` на любой элемент. Кейс проверяет только то, что `map ~open` не падает.

```qlang
> [1 "x"] | every ~(false !| true | not)
true
```

Предикат кейса ничего не говорит об открытых страницах, которые называет его имя.

### apophasis · QSHST#input

«reads standard input to its end, waiting on a slow producer as every reader of a pipe does». Сравнение «as every reader of a pipe does» обосновывает правило, вместо того чтобы его сформулировать.

```qlang
$ grep -n "every reader of a pipe does" D:/git/qlang/docs/spec/QSHST-hosts-and-the-command-line.md
130:end, waiting on a slow producer as every reader of a pipe does, and
```

### apophasis · QSHST#source

«What a host loads and what a source declares are two things, and the language knows only the second.» Предложение говорит, чего язык не знает, там, где правило можно сказать как то, что выполняется.

```qlang
$ grep -n "two things" D:/git/qlang/docs/spec/QSHST-hosts-and-the-command-line.md
10:What a host loads and what a source declares are two things, and the
```
