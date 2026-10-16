> A check of the chapters `QSSLF`, `QSPRN`, `QSHST` for D319 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `c91769c4`, itself the baseline; run 2026-10-15, 09:34–09:57 UTC. A path it names reads as `git show c91769c4:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qlang`, `grep` and `git ls-files` allowed, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.

### conflict · QSSLF#axis

В главе: «`source` every declaration written under its address, null for a node a chain lays, a law and a chapter among them». Страница `::any/source` даёт другое правило: «`::Tag | source` reads what was written under the tag, a refusal its own declaration … A binding no step declared, a value a host bound, answers null». Комментарий `core/src/runtime/axis.mjs:9` повторяет страницу: «null for a binding no step declared, a value a host bound».

```qlang
> ::any/source | doc | content | contains "a refusal its own declaration"
true

> ::number/add/SubjectNotNumberError | source
null

> ::call/UnknownNameError | source | type
::null

> ::vec/count/answer | source
null
```

Страница и комментарий говорят, что refusal читает своё собственное объявление, а null бывает у значения, которое связал host. Глава и дерево дают null для каждого узла, который выкладывает цепочка, в том числе для каждого refusal.

### conflict · QSHST#answer

В главе: «the subject of each later stop giving way to an `::elision` marker where the marker prints shorter». Первая страница говорит «A failure … prints as an alert: the subject where it arose cut to an excerpt, and each subject it passed an ::elision», а страница `::elision`: «A failure the host prints is an alert, each subject it passed such a marker».

```qlang
> ::qlang | doc | content | contains "each subject it passed an ::elision"
true

> ::elision | doc | content | contains "each subject it passed such a marker"
true
```

```
$ qlang '[1 "x"] | map ~(add 1)' < /dev/null
|~| raised, and no !| caught it
::number/add/SubjectNotNumberError!{
  :actualType ::string
  :trail [
    {
      :step ~(add 1)
      :subject "x"
      :skipped ~()
    }
    {
      :step ~(map ~(add 1))
      :subject [1 "x"]
      :skipped ~()
    }
  ]
}
|~| `add` adds to a number: two fields of one record add by `sumOf /x
|~| /y`, a vector adds to each element by `map`, `map ~(add 1)`, a
|~| string joins by `append`, and text that holds a number is read first
|~| by `toNumber`.
```

Обе страницы делают маркер безусловным для каждого пройденного subject. Глава и дерево ставят маркер только там, где он печатается короче.

### conflict · QSHST#source

В главе: «A `::builtin{}` written in the recipe of a word a reader declares is the value it is: the word's address answers its function as a value, and its bare name reaches no word». В QSNAM#address: «The value says what the node is: … a function or a quote under a label a word … Written as a step, an address reads what it declared, a word run and any other value itself».

```qlang
> :any/v (::fn | impl ::builtin{}) | 5 | get [~(any/v | type) ~(v !| type)]
[::fn ::call/UnknownNameError]

> :any/w (::fn | impl ~(add 1)) | 5 | get [~(any/w) ~(w)]
[6 6]
```

По QSNAM#address функция под label есть слово, которое адрес запускает, а голое имя вызывает. QSHST#source и дерево для функции, чей recipe читателя — `::builtin{}`, делают узел данными.

### implementation · QSPRN#elide

В главе: «A marker holds `:size`, what it stands for, a part that already gave way whole counting as one element and a text its characters as `count` counts them». Страница `::elision`: «`:size` counts the elements, the entries or the characters it stands for». У одной и той же строки под тегом `:size` в алерте и в `elide` расходится:

```qlang
> 100 | range | map ~("a") | join "" | tag ::Box | count
100

> 100 | range | map ~("a") | join "" | tag ::Box | :b it | get [~(b) 1] | elide 60 | get /0/size
100
```

```
$ qlang '100 | range | map ~("a") | join "" | tag ::Box | within ~(add 1)' < /dev/null
|~| raised, and no !| caught it
::number/add/SubjectNotNumberError!{
  :actualType ::string
  :trail [
    {
      :step ~(add 1)
      :subject "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      :skipped ~()
    }
    {
      :step ~(within ~(add 1))
      :subject ::elision{
        :size 107
        :read ~(!| get /trail/1/subject)
      }
      :skipped ~()
    }
  ]
}
|~| `add` adds to a number: two fields of one record add by `sumOf /x
|~| /y`, a vector adds to each element by `map`, `map ~(add 1)`, a
|~| string joins by `append`, and text that holds a number is read first
|~| by `toNumber`.
```

У subject позднего шага алерт считает символы печати (`passedOver` в `core/src/elide.mjs:256`), а не символы текста, как требуют глава и `elide`. Что должен отвечать `:size` маркера пройденного subject, чтобы мера совпадала с маркером `elide` той же части?

### design · QSPRN#print

В главе: «A kind answers `print` under its own label, and the print of a value finds the `print` of each part by the walk of that part … Every host prints an answer through `print`». В QSNAM#owner: «a word a reader declared under [a noun of the root] answers the reader's own calls».

```qlang
> :number/print ~("n") | 5 | print
n

> :number/print ~("n") | [5] | print
[5]

> :number/print ~("n") | 5
5

> :Box |~~ B ~~| | :Box/print ~("box") | ::Box#1
box
```

Если читатель объявил `print` на kind ядра, у одного и того же значения два ответа: «n», когда его печатает свой вызов читателя, и «5», когда это часть значения или ответ host. Для label самого читателя печать одна на всех дорогах. Как должна отвечать печать числа как части значения и как ответа host, если читатель дал `::number` свой `print`?

### design · QSSLF#axis

В главе: «a name by its tag, the address of its node … a label may declare a `doc` of its own, which its values answer before the word of every value». В QSDSP#tagname: «a word of the noun's values refuses a tag name under the word».

```qlang
> :vec/doc ~("a reader page") | [1 2] | doc
a reader page

> :vec/doc ~("a reader page") | ::vec | doc !| type
::vec/doc/SubjectNotVecError

> :vec/doc ~("a reader page") | ::vec | any/doc | type
::doc
```

Если читатель объявил `doc` на label, тег этого label больше не читает свою страницу осью `doc` и получает refusal слова читателя. Должна ли ось по тегу, `::vec | doc`, отвечать страницей узла, как отвечает `any/doc`?

### design · QSSLF#doc

В главе: «`tag ::doc` builds a doc from a vector of strings and quotes … a payload that is no vector refused as `::doc/PayloadKindNotTakenError`». Страница `::vec` про payload: «a vector under a tag of its own, a quote and a doc among them, gives the vector beneath by `payload`, each refused here».

```qlang
> #["b" "a"] | tag ::doc
|~~ab~~|

> #["b" "a"] | tag ::vec !| type
::vec/PayloadKindNotTakenError

> ::Box["a" "b"] | tag ::doc
|~~ab~~|

> |~~ a ~~| | tag ::quote
~(" a ")
```

Конструкторы `::doc` и `::quote` берут как «vector» множество, вектор под тегом и doc. Для множества порядок сегментов прозы получается из one order. `::vec` каждый из этих payload отвергает. Какие payload должны считаться «vector» у конструкторов kinds ядра, которые читают вектор?

### design · QSSLF#laws

В главе: «`runLaws` runs each … the laws of a member when it is given its anchor, `::qlang | runLaws :errors`». В QSSLF#axis: «`laws`, `explain`, `manifest` and `tutorial` take no member, refusing one as `::any/manifest/ArgsBeyondInputsError` and its kin».

```qlang
> ::qlang | runLaws :errors | count
8

> ::qlang | laws :errors !| type
::any/laws/ArgsBeyondInputsError

> ::qlang/errors | laws | count
8
```

На один вопрос, законы члена, две соседние оси отвечают по-разному: `runLaws` берёт anchor, а `laws` и `tutorial` его отвергают. Должны ли `laws` и `runLaws` принимать член одинаково?

### design · QSHST#answer

В главе: «a budget is asked for, `| elide N` in the query or `--budget=N` before it, which prints every answer as `elide` cuts it … a `--budget` that is no positive count … refused with a usage line and the code 2».

```qlang
> 30 | range | elide 0 | count
2

> 30 | range | elide 2.5 | count
2
```

```
$ qlang --budget=0 '30 | range' < /dev/null
qlang: --budget expects a positive count of characters, got '0'

$ qlang --budget=2.5 '30 | range' < /dev/null
qlang: --budget expects a positive count of characters, got '2.5'
```

Две дороги к одному бюджету расходятся: `elide` принимает любое число, а флаг отвергает ноль и дробь. Какой бюджет должны принимать обе дороги?

### text · QSHST#source

В главе: «A host's setting is the first value of its pipe, and a host's command starts from its own noun». QSHST#input: «otherwise from `::qlang`, the noun of the language».

```qlang
> ::cli | binding | get /origin
:cli
```

```
$ qlang 'it' < /dev/null
::qlang
```

Собственный noun командной строки — `::cli`, а без входа она стартует из `::qlang`. Предложение в QSHST#source расходится с QSHST#input, если «a host's command» значит запуск host.

### text · QSSLF#manifest

В главе: «answers the set of the nodes declared one name under the name its subject reads: its words, its refusals, its pages and the inputs, the subject and the answer of a word». Страница `manifest` говорит шире: «the set of the names declared one name under the name».

```qlang
> ::vec | manifest | filter ~(toString | split "/" | last | eq "payload")
#[::vec/payload]

> :Box |~~ A box. ~~| (::kind | reads :w |~~ The width. ~~| /w ::number | holds :TooWideError |~~ At most ten. ~~| ~(get /w | lte 10)) | ::Box | manifest
#[::Box/TooWideError ::Box/w]
```

В перечне главы нет полей и payload у kind, а страница и дерево их перечисляют.

### case · QSSLF#page

Кейсы `the-first-screen-opens-every-page-it-names-in-one-query` и `every-link-of-the-first-screen-opens-a-page` держат один и тот же query с одним ответом.

```
$ grep -c '"query":"::qlang | doc | links | map ~open | every ~(type | eq ::doc)"' core/test/conformance/QSSLF/page.jsonl
2
```

Второй кейс не показывает никакого правила сверх первого.

### case · QSSLF#axis

Ни один кейс в `axis.jsonl` не держит два правила раздела. Первое: «A tag nothing declares whose last name ends in `Error` reads the record of the address before it». Второе: «A name declared without a page answers null».

```qlang
> ::number/add/FooError | binding | get /name
:number/add

> :x 1 | ::x | doc
null
```

### case · QSSLF#laws

Правило «Every law of the core passes» кейс `every-example-of-the-core-passes` держит только для узлов на одно имя под каждым label (`kinds | map ~(manifest) | flat`). Законы самих kinds и законы под refusals слов в него не попадают.

```qlang
> kinds | map ~(manifest) | flat | has ::number
false

> ::number | runLaws | count
5

> kinds | map ~(manifest) | flat | has ::number/add/SubjectNotNumberError
false

> ::number/add/SubjectNotNumberError | runLaws | count
1
```

### case · QSHST#source

Кейсы `a-descriptor-a-name-holds-runs-nothing` (`::builtin{} | :c it | get [1 2 3] | c | type`) и `a-descriptor-a-query-assembles-is-a-value` показывают голое имя, которое держит значение-данные. Recipe слова в них нет. Это правило QSNAM#value («A bare name that holds a value answers the value»), а не правило раздела о `::builtin{}` в recipe слова.

```qlang
> ::builtin{} | :c it | get [1 2 3] | c | type
::builtin
```

### apophasis · QSSLF#doc

«A span between backquotes holds a fragment of the language that is no query to run.» Предложение обосновывает уже сказанное правило («a span between backquotes … are prose») через то, чем фрагмент не является.

```qlang
> |~~ write `~(add 1)` here ~~| | segments | count
1
```

### apophasis · QSSLF#axis

«A tag nothing declares whose last name ends in `Error` reads the record of the address before it, a refusal the runtime raises by rule having no node of its own». Придаточное объясняет, почему правило такое, хотя правило уже сказано.

```qlang
> ::number/gte/value/NotGivenError | doc | eq (::number/gte/value | doc)
true
```
