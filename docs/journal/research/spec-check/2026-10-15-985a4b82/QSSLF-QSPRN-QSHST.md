<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 985a4b82 and checking docs/spec/QSSLF-the-language-describes-itself.md, docs/spec/QSPRN-printing-and-codecs.md and docs/spec/QSHST-hosts-and-the-command-line.md, on 2026-10-15 from 08:05 to 08:22 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 985a4b82. -->

### design · QSSLF#laws
Закон данных ничего не может сказать о своём имени. В главе сказано: «A law is a query that answers `true` … declared under the name whose claim it proves» и «`runLaws` runs each as held code on null [QSQUO#held]». В QSQUO#held сказано: «A value that scope names is withheld: read by a step, by a tag…». Закон под именем, которое держит значение, не прочтёт это значение ни голым именем, ни через тег. При этом кейс `the-tutorial-of-a-name-is-its-page-and-its-laws` (а также `a-law-reads-as-the-pair-of-its-page-and-its-query` и законы страницы `::any/laws`) объявляет именно такой закон, «k answers five.». Будучи запущен, этот закон не выполняется:

```qlang
> :k |~~ Answers five. ~~| 5 | :k/answersFive |~~ k answers five. ~~| ::law~(k | eq 5) | ::k | runLaws | first | get [/ok ~(get /error | type)]
[false ::call/ValueWithheldError]

> :k 5 | :k/answersFive ::law~(::k | binding | get /value | eq 5) | ::k | runLaws | first | get [/ok ~(get /error | type)]
[false ::call/ValueWithheldError]
```

Правило «закон доказывает утверждение имени» и правило «held code не видит значений читателя» вместе дают закон, который о данных ничего доказать не может. Вопрос: как закон, объявленный под именем данных, должен читать это имя?

### conflict · QSPRN#json
Глава говорит: «a value under a tag as the object `{"$tag": name, "payload": …}` … an error at rest two such layers, the tag of its site over `error`». То же говорят страница `::any/json` и её закон. Страница `::string/parseJson` говорит иначе: «of an error as a map of its `$error`». Форму `$error` держат `core/src/runtime/format.mjs:55` (комментарий над ним ссылается на `[QSPRN#json]`) и тест `core/test/unit/print-value-extras.test.mjs:100`.

```qlang
> !{:a 1} | json | parseJson
{
  :"$tag" "error"
  :payload {:a 1}
}

> ::string/parseJson | doc | content | contains "of an error as a map of its `$error`"
true

> ::any/json | laws | get /writesAnErrorAtRestUnderItsTag | get /1
~(::error{:k 1} | json | parseJson | keys | eq #[:"$tag" :payload])
```

```sh
$ grep -n "\$error" core/src/runtime/format.mjs
55:  error:   e => ({ $error: { $tag: e.tag.name, facts: toPlain(e.descriptor) } })
```

Глава, страница `json` и её закон называют одну JSON-форму ошибки, а страница `parseJson` и код, ссылающийся на этот раздел, — другую.

### implementation · QSPRN#json
По главе `json` пишет «a quote, a doc and a tag name as their prints». В QSPRN#print сказано: «a quote of a path alone as `::quote[/a]`». Но `json` такой цитаты пишет форму, которую парсер отказывается читать:

```qlang
> [/age] | tag ::quote | get [~(print) ~(json)]
["::quote[/age]" "\"~(/age)\""]

> [/age] | tag ::quote | json | parseJson | parse !| type
::quote/ParseError
```

Код `json` расходится с печатью цитаты по пути. Вопрос: каким должен быть JSON-текст такой цитаты, чтобы он совпадал с её печатью?

### implementation · QSPRN#elide
По главе маркер держит `:size`, то есть «what it stands for», а для строки ещё `:head`, «the first characters of its text». Кейсы `a-string-past-its-budget-gives-way-whole` и `a-doc-gives-way-whole-with-the-head-of-its-text` приравнивают `:size` к `count`, а QSTXT#string считает строку по кодовым точкам. Дерево же считает UTF-16-единицы и режет `:head` посреди суррогатной пары:

```qlang
> 201 | range | map ~("😀") | join "" | drop 1 | prepend "x" | :s it | {:a 1} | put /s s | :v it | elide 50 | get /s | get [/size ~(get /read | :r it | v | apply r | count)]
[401 201]

> 201 | range | map ~("😀") | join "" | drop 1 | prepend "x" | :s it | {:a 1} | put /s s | elide 50 | get /s/head | print
"x😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀�"
```

Маркер говорит, что стоит за 401 символ, хотя пропущенная строка — 201 символ. Вопрос: в каких единицах `:size` и `:head` должны считать текст?

### design · QSPRN#elide
Глава: «a part gives way only where the least it gives way to prints shorter than it». Страница `::any/elide` выводит из этого «so a budget never lengthens a print», то же утверждает `core/src/elide.mjs:9`. Каждая часть сама по себе это правило соблюдает, но когда маркер встаёт на место строки, объемлющая карта переходит на многострочную раскладку, и печать становится длиннее:

```qlang
> {:s "a long line of text to leave out, which runs on long enough that its marker prints shorter than it" :n 1} | :v it | get [~(v | print | count) ~(v | elide 40 | print | count)]
[110 116]

> ::any/elide | doc | content | contains "so a budget never lengthens a print"
true
```

Правило, сформулированное для отдельной части, и раскладка печати вместе удлиняют ответ, который бюджет должен был сократить. Вопрос: какую печать должно мерить сравнение — части или ответа целиком?

### design · QSSLF#doc
Глава: «A doc lays each tag of a quote's role through the tag's label, so a tag that takes no quote refuses the doc». QSQUO#step хранит литерал в цитате «as itself». Кейс `a-doc-a-quote-holds-writes-its-text-as-written` держит док `|~~ see ::vec~(x) ~~|` внутри цитаты. Сегмент этого дока, полученный через `first`, — значение `::vec` над цитатой. Его не допускает ни один конструктор, и его печать читается обратно как отказ:

```qlang
> ~(|~~ see ::vec~(x) ~~|) | first | segments | get /1 | :v it | get [~(v | payload) ~(v | count) ~(v | print)]
[~(x) 1 "::vec~(x)"]

> ~(|~~ see ::vec~(x) ~~|) | first | :d it | print | parse | apply it !| type
::vec/PayloadKindNotTakenError

> ~(|~~ see ::vec~(x) ~~|) | apply it !| type
::vec/PayloadKindNotTakenError
```

Один и тот же док отвечает по-разному: вычисленный — отказом, а взятый как шаг цитаты — значением, которое противоречит QSLIT#tag и не читается обратно (QSPRN#print). Вопрос: что должен отвечать док, который цитата держит как шаг?

### design · QSSLF#axis
Глава: «A tag nothing declares whose last name ends in `Error` reads the record of the address before it». QSSLF#near: «a tag nothing declares … are refused with `:nearest`». В результате опечатка в имени объявленного отказа молча читает страницу слова и не получает `:nearest`, а опечатка на уровень выше получает:

```qlang
> ::number/add/SubjectNotNumbrError | doc | eq (::number/add | doc)
true

> ::number/add/SubjectNotNumberError | doc | eq (::number/add | doc)
false

> ::number/ad/SubjectNotNumberError | doc !| get [~(type) /nearest]
[::any/doc/UnknownNameError [::number/add/SubjectNotNumberError]]
```

Два правила отвечают на один вопрос («ничем не объявленный тег») по-разному, в зависимости от суффикса. Вопрос: как ось должна отличать отказ, который рантайм поднимает по правилу, от опечатки в имени объявленного отказа?

### conflict · QSHST#source
QSHST#source: «A `::builtin{}` written in the recipe of a word a reader declares is the value it is: the word's address answers its function as a value, and its bare name reaches no word». QSNAM#address: «The value says what the node is: … a function or a quote under a label a word» и «Written as a step, an address reads what it declared, a word run…».

```qlang
> :any/v (::fn | impl ::builtin{}) | 5 | any/v
::fn[~() ::builtin{}]

> :any/w (::fn | impl ~(add 1)) | 5 | any/w
6

> :any/v (::fn | impl ::builtin{}) | ::any | manifest | has ::any/v
true
```

QSNAM считает функцию под меткой словом, которое адрес запускает. QSHST для той же функции с рецептом `::builtin{}` оставляет её значением, хотя сам называет её «a word a reader declares».

### design · QSPRN#span
Глава: span — это «the offset of its start …, the parser counting the offset from zero». QSTXT#string: «A string counts, takes and drops by its code points». Смещение спана считается в UTF-16-единицах, поэтому `drop` по нему промахивается:

```qlang
> "\"😀\" ]" | parse !| get /location
::span[5 1 6 6 1 7]

> "\"😀\" ]" | :s it | parse !| get /location | start | offset | :o it | s | drop o | print
""

> "\"a\" ]" | :s it | parse !| get /location | start | offset | :o it | s | drop o | print
"]"
```

На вопрос «где в тексте» спан и слова строк отвечают в разных единицах. Вопрос: в каких единицах должно считаться смещение?

### design · QSPRN#json
Глава: `parseJson` отказывает числу за пределами double «with its `:path`, the vector of the keys, strings as JSON writes them, and the places to it». Факт `:path`, который объявляет `::error`, — это `::path`, «The path a read followed». Один факт с одним именем держит два вида значений:

```qlang
> {:a 1} | get /b !| get /path | type
::path

> "{\"a\": [1e400]}" | parseJson !| get /path | type
::vec

> ::error/path | binding | get /value
::path

> ::string/parseJson/NumberNotFiniteError/path | binding | get /value
::vec
```

Место внутри значения в одном случае — путь, в другом — вектор. Вопрос: каким значением факт `:path` должен называть место?

### implementation · QSSLF#axis
Глава: `doc` отказывает «an element that is no keyword as `::any/doc/anchor/ElementNotKeywordError` with its `:index`». Для множества якорей `:index` — это место в пути из одного якоря, а не место элемента в множестве. Кейс `an-anchor-of-a-set-that-is-no-keyword-is-refused` проверяет только тип:

```qlang
> ::qlang | doc #[:pipeline ::x] !| get [~(type) /index]
[::any/doc/anchor/ElementNotKeywordError 0]

> ::qlang | doc [:pipeline ::x] !| get [~(type) /index]
[::any/doc/anchor/ElementNotKeywordError 1]
```

`::x` стоит на месте 1 множества, а отказ называет место 0.

### conflict · QSSLF#catalog
Глава: «how the name behaves is told by its laws …, so a behaviour the prose tells and a law proves is told by the law alone» и «its links and snippets standing in its prose where it names them». Страница `json` своей прозой рассказывает поведение, которое доказывает её закон, и ставит ссылки после прозы, а не там, где их называет:

```qlang
> ::any/json | doc | content | lines | filter ~(contains "a set as an array")
["      value alike; a set as an array; a value under a tag as an object"]

> ::any/json | laws | get /writesASetAsAnArray | get /1
~(#[1 2 3] | json | eq "[1,2,3]")

> ::any/json | doc | segments | map ~type
[::string ::link ::string ::link ::string]
```

Форма страницы, которую задаёт глава, и страницы каталога (`json`, `elide` и другие) расходятся.

### conflict · QSSLF#catalog
Глава: «The first page tells the language whole …, each rule once with an example whose answer it states». На первой странице есть примеры без ответа, и одно правило сказано дважды (п. 2 и п. 6):

```qlang
> ::qlang | doc | content | lines | filter ~(contains "Several steps stand in one quote")
["      Several steps stand in one quote, `map ~(get /price | mul 2)`, and"]

> ::qlang | doc | content | lines | filter ~(contains "`get /users | filter /active | sort /age | map /name` reads")
["      `get /users | filter /active | sort /age | map /name` reads the"]

> ::qlang | doc | content | lines | filter ~(contains "a literal reads no name and no")
["      everything between is literal: a literal reads no name and no"]

> ::qlang | doc | content | lines | filter ~(contains "A literal computes nothing")
["      6. Building answers. A literal computes nothing, so an answer of a"]
```

Глава требует от первой страницы того, чего та не делает.

### text · QSHST#answer
Глава: «an error whose tag no declaration names is written without prose». Дерево и тест держат ещё одно правило: ошибка вида `::error` (тег объявлен, страница есть) тоже пишется без прозы. Это `cli/src/run.mjs:17`, `cli/test/main.test.mjs:345` («a failure of the kind of errors, which no site refused»), а глава его не формулирует:

```qlang
> ::error | doc | type
::doc
```

```sh
$ qlang '{:k 1} | raise' < /dev/null
|~| raised, and no !| caught it
!{
  :k 1
  :trail [
    {
      :step ~(raise)
      :subject {:k 1}
      :skipped ~()
    }
  ]
}
$ grep -n "ERROR_KIND" cli/src/run.mjs
17:  if (!isErrorValue(cellEntry.result) || cellEntry.result.tag.name === ERROR_KIND) return cellEntry;
24:const ERROR_KIND = 'error';
```

Правило, которое держат код и тест, в главе не сказано.

### conflict · QSSLF#explain
Глава: `explain` отказывает «as `::any/explain/UnknownNameError`». В QSSLF#laws оборот «refused as `doc` refuses it» означает отказ под тегом `doc` (кейс `the-tutorial-of-a-name-nothing-declares-is-refused-as-doc-refuses-it`). Страницы `::any/explain` и `::any/laws` тем же оборотом пишут «refused as `binding` refuses it», хотя отказ стоит под их собственным тегом:

```qlang
> ::nothere | tutorial !| type
::any/doc/UnknownNameError

> ::Nothing | explain !| type
::any/explain/UnknownNameError

> ::any/explain | doc | content | contains "refused as `binding` refuses it"
true
```

Если читать оборот так, как его употребляет глава, страницы называют отказ под другим тегом.

### text · core/src/eval.mjs:168
Код ссылается на разделы, которые не формулируют его правила. Блок открытия ошибки через `!|` (это правило QSERR#catch) ссылается на `[QSSLF#doc]`. Отказ «with the addresses where the word lives» (QSDSP#refusal) ссылается на `[QSSLF#catalog]`, `core/src/eval.mjs:471`. Правило ближних имён (QSSLF#near) в тесте ссылается на `[QSHST#answer]`. Код корня (`core/src/runtime/root.mjs`), который держит правила QSHST#source, ссылается только на QSDSP#residence, и QSHST#source не цитирует никто:

```sh
$ grep -n "QSSLF#doc\], a value passing" core/src/eval.mjs
168:// error [QSSLF#doc], a value passing, a label's refusal answering for the
$ grep -n "addresses where the word lives \[QSSLF#catalog\]" core/src/eval.mjs
471:// with the addresses where the word lives [QSSLF#catalog], and a name that
$ grep -n "^// An unresolved name names the names nearest to it \[QSHST#answer\]" core/test/unit/nearest-names.test.mjs
1:// An unresolved name names the names nearest to it [QSHST#answer]: within an
$ grep -rn "QSHST#source" core cli lsp scripts | wc -l
0
```

Ссылки указывают на разделы, в которых этих правил нет.

### case · QSHST#source
Кейс `a-builtin-in-a-reader-recipe-is-the-value-it-is` должен показывать «the word's address answers its function as a value». Он читает `~(::any/v | type)`, то есть литерал тега в голове, а не адрес как шаг:

```qlang
> :any/v (::fn | impl ::builtin{}) | 5 | get [~(::any/v | type) ~(v !| type)]
[::tag ::call/UnknownNameError]

> :any/v (::fn | impl ::builtin{}) | 5 | any/v
::fn[~() ::builtin{}]
```

Первая половина кейса показывает тип любого литерала тега, а не правило раздела.

### case · QSSLF#catalog
У раздела один кейс, `the-page-of-tagged-values-tells-a-value-under-a-tag`. Он проверяет фразу одной страницы. Ни одно правило раздела им не подтверждается: «told by the law alone», порядок истории слова и вида, раскладка цепочки и объявления, «the page of a kind names the concept it serves».

```qlang
> ::tagged | doc | content | contains "A value under a tag"
true
```

### case · QSPRN#span
Глава распространяет «an element that is no number as `…/ElementKindNotTakenError` with its `:index`» и на `::point`. Кейса для точки нет, закона у этого отказа тоже нет:

```qlang
> ::point[1 "x" 3] !| get [~(type) /index]
[::point/ElementKindNotTakenError 1]

> ::point/ElementKindNotTakenError | laws | count
0

> ::span/ElementKindNotTakenError | laws | count
1
```

Правило для точки не подтверждает ни один кейс.

### apophasis · QSHST#shell
«The reading is the command line's, at the boundary where the shell hands its arguments, and the core reads paths of the language alone.» Предложение обосновывает, где чтение размещено, и говорит, чем ядро не занимается. Само правило (командная строка читает запрос от слэша после корня MSYS) уже сказано выше в том же разделе.

```sh
$ grep -n "core reads paths of the language alone" docs/spec/QSHST-hosts-and-the-command-line.md
143:where the shell hands its arguments, and the core reads paths of the
```

Строка 143 — продолжение этого предложения: оно занимает строки 141–143 главы.
