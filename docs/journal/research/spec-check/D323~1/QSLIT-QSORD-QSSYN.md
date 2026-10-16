> A check of the chapters `QSLIT`, `QSORD`, `QSSYN` for D323 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `c0ee20a9`, itself the baseline; run 2026-10-15, 11:10–11:24 UTC. A path it names reads as `git show c0ee20a9:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qlang`, `grep` and `git ls-files` allowed, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.

### design · QSSYN#line

«A declaration joins a value or a group before it on its own line with no combinator, `[1 2] :y 2 | y` answering `2`». По [QSSYN#step] тег и путь тоже значения, которые стоят в голове. Но две другие фразы той же главы отвечают на этот же текст иначе: «A tag name in the place of a declaration's name is refused» и «a path followed by a word is refused naming the verb it meant». Число, строка, паттерн, null, вектор, ошибка и цитата присоединяют объявление, а тег и путь отвергаются. Сообщение о пути при этом предлагает вызвать глагол `a :y`.

```qlang
> "[1 2] :y 2 | y" | parse | apply it
2

> "5 :y 2 | y" | parse
~(5 | :y 2 | y)

> "::vec :y 2 | y" | parse !| get /message
a name is declared by its keyword, `:Box |~~ A parcel. ~~|`, and a value under a tag touches its payload, `::Box[…]`

> "/a :y 2 | y" | parse !| get /message
`/a` is a path, a value: a part is read by `get`, `get /a | :y`, and a verb is called by its name alone, `a :y`
```

Правило [QSSYN#line] о значении перед объявлением расходится с двумя отказами [QSSYN#step]. Вопрос: присоединяет ли объявление тег и путь так же, как любое другое значение, или их отказ должен быть частью правила [QSSYN#line]?

### implementation · QSSYN#refusal

«A refusal the grammar writes holds a `:message` that names the habit it met». Если первый сегмент пути в кавычках не закрыт, грамматика отвечает отказом «слэш один», хотя исходник такого не пишет. Тот же незакрытый сегмент на втором месте получает обычные продолжения с закрывающей `"`.

```qlang
> "get /\"first name" | parse !| get /message
the slash alone names no path: the value itself is `it`

> "[/\"x]" | parse !| get /message
the slash alone names no path: the value itself is `it`

> "get /a/\"b c" | parse !| query [/message /expected]
[null [:any-character "\\" "\""]]
```

Отказ `"/" !KeySegment` (`core/src/grammar.peggy:825`) срабатывает там, где сегмент начат, но не закрыт, и вытесняет продолжения другой ошибки. Это противоречит фразе главы «looks ahead before it reads, so the continuations of another error stand as they are». Вопрос: какой ответ согласован — продолжения с `"`, как для второго сегмента, или сообщение, которое называет открытую кавычку?

### design · QSORD#set

«A word over a set answers … a vector where it answers an order of its own, `sort` and `reverse`». [QSDSP#residence] говорит: «a set, a quote and a doc are vectors to a word of vectors, each answered back as its own kind». Поэтому голое имя и адрес отвечают на один вопрос по-разному. `vec/reverse` над множеством молча теряет обращение: ответ снова собирается в одном порядке.

```qlang
> get [~(#[3 1] | reverse) ~(#[3 1] | vec/reverse) ~(#[3 1] | sort | type) ~(#[3 1] | vec/sort | type)]
[[3 1] #[1 3] ::vec ::set]
```

Оба правила верны каждое по-своему, но вместе дают для `reverse` два ответа по двум дорогам. Вопрос: что должен ответить `vec/reverse` над множеством — вектор, как `::set/reverse`, или отказ, если слово возвращает свой вид, а вид заново упорядочивает ответ?

### conflict · QSLIT#tag

Глава: «a label laid over a value already under it stands once, `::Lab::Lab[1]` reading `::Lab[1]`, but for `::desc`». Страница `::tagged/payload` говорит то же. Страница `::any/tag` говорит без исключения: «A tag over a tagged value nests it.»

```qlang
> :Lab |~~ L. ~~| | [1] | tag ::Lab | tag ::Lab
::Lab[1]

> ::any/tag | doc | content | contains "A tag over a tagged value nests it"
true

> ::tagged/payload | doc | content | contains "a label stands once over a value already under it"
true
```

Страница `tag` и её закон `:nestsATaggedValue` (с двумя разными метками) расходятся с главой и со страницей `payload`, когда метка ложится поверх самой себя.

### text · QSSYN#comment

«A comment, `|~| …` to the end of its line or `|~ … ~|`, which nests»; в [QSSYN#doc]: «a `~(…)` … is a segment of code where it reads as code, and prose where it does not». Дерево держит правило, которого глава не формулирует. `~(` внутри комментария или блочного дока читается до парной `)`, и закрывающий маркер внутри этой пары ничего не закрывает. Так написано в `core/src/grammar.peggy:326`: «a quote span inside it is opaque, so neither a nested closer nor one inside a quote ends it». Это же держит кейс `plain-block-preserves-quote-mention-with-nested-plain`. В итоге одинаковый комментарий или док закрывается или нет в зависимости от того, стоит ли `)` дальше в исходнике.

```qlang
> "[|~ ~(x ~|]" | parse
~([])

> "(|~ ~(x ~|)" | parse !| type
::quote/ParseError

> "[|~~ ~(x ~~|]" | parse
~([|~~ ~(x ~~|])

> "(|~~ ~(x ~~|)" | parse !| get /message
`|~~` opened at line 1, column 2 is never closed; `~~|)` completes the source
```

Правило, которое держат грамматика и кейс, в главе отсутствует. Для дока фраза «prose where it does not» не говорит, что такая проза поглощает `~~|`.

### text · QSLIT#string

«…and holds a line break or a tab written raw as it is». Страница `::string` говорит шире: «any other character raw between them». Дерево действительно держит сырые управляющие символы.

```qlang
> "\"a\u0001b\"" | parse | apply it | count
3

> "\"a\rb\"" | parse | apply it | count
3

> ::string | doc | content | contains "any other character raw"
true
```

Глава называет только перевод строки и табуляцию. Правило, которое держат страница и дерево, ею не сформулировано.

### conflict · core/src/highlight.mjs:164

Комментарий в блоке, который цитирует [QSSYN#doc]: «The binding key — Keyword `:name` or TagLit `::Tag`». Глава ([QSSYN#step]): «A tag name in the place of a declaration's name is refused». Грамматика тоже допускает только ключевое слово.

```sh
$ grep -n "Keyword \`:name\` or TagLit" core/src/highlight.mjs
164:        // The binding key — Keyword `:name` or TagLit `::Tag` —
$ grep -n -A1 "^BindName" core/src/grammar.peggy
451:BindName
452-  = Keyword
```

```qlang
> "::Box [] | 1" | parse !| type
::quote/ParseError
```

Комментарий кода называет форму, которую глава и грамматика отвергают.

### case · QSORD#sort

`{"name":"a-key-of-a-sort-is-code-a-host-runs","query":"[{:a 2} {:a 1}] | sort /a | first | get /a","expect":"1"}`. Имя заявляет правило о коде, который исполняет хост: «a primitive names the inputs it runs as code» из [QSHST#source]. В [QSORD#sort] этого правила нет, а запрос показывает только сортировку по пути.

```qlang
> [{:a 2} {:a 1}] | sort /a | first | get /a
1
```

Имя кейса называет правило другой секции, а запрос его не показывает.

### case · QSSYN#step

`{"name":"a-word-after-a-literal-step","query":"1 2", …"steps are joined by `|`: write `a | b`"…}`. Этот кейс показывает правило [QSSYN#line] «any other step is joined by a combinator». Его ответ — тот же отказ, что и в пробе той секции.

```qlang
> "1 2" | parse !| get /message
steps are joined by `|`: write `a | b`

> "[3 1 2] sort" | parse !| get /message
steps are joined by `|`: write `a | b`
```

Кейс стоит в `step.jsonl`, а показывает правило секции `line`.

### case · QSORD#desc

«a desc of a desc stands twice, its reversals undoing each other, so it ranks as the value does». В `QSORD/desc.jsonl` нет кейса на то, как ранжируется desc от desc. Единственный кейс про двойной desc — `QSLIT/tag.jsonl` `desc-laid-over-a-desc-stands-twice`, и он показывает только то, что тег стоит дважды.

```qlang
> [1 3 2] | sort ~(desc | desc)
[1 2 3]
```

Это правило секции держит только проба главы, кейса на него нет.

### case · QSORD#order

«…a quote by its steps…». Ни один кейс `QSORD/order.jsonl` не ранжирует две цитаты между собой: в `sort-orders-every-kind-of-the-core` и `a-quote-a-doc-an-elision-and-a-desc-rank-after-a-map-in-that-order` по одной цитате.

```qlang
> [~(b) ~(a | b) ~(a)] | sort
[~(a) ~(a | b) ~(b)]
```

Порядок внутри вида «цитата» ни один кейс не держит.

### apophasis · QSLIT#json

«A map is a map whatever its keys say, a key named `type` among them». Фраза отрицает прочтение, которое правило уже исключает: «an object's keys read as keywords». То, что держат кейсы `a-map-with-a-key-named-type-is-a-map` и `a-map-with-a-key-named-error-is-no-failure`, можно было сказать как то, что выполняется.

```qlang
> {"type": "quote", "source": "hi"} | type
::map
```

Фраза говорит, чем карта не является, вместо того чтобы сказать, чем она является.
