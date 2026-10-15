<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at c91769c4 and checking docs/spec/QSLIT-values-and-literals.md, docs/spec/QSORD-one-order.md and docs/spec/QSSYN-grammar.md, on 2026-10-15 from 09:34 to 09:51 UTC. Its prompt is `scripts/spec-check-prompt.txt` at c91769c4. -->

### design · QSORD#desc

«`::desc` … owns its comparisons, `gt`, `gte`, `lt` and `lte`, which rank its payloads of any kinds by the one order as `sort` does, so `min`, `max` and `sort` read it alike … the comparisons of the core compare within one kind». На странице `::desc`: «Every comparison agrees with it, `gt` and `lt` as `sort` and `max`».

```qlang
> 3 | gt ::desc#2
true

> [3 ::desc#2] | max
::desc#2

> ::desc#2 | lt 3 !| type
::desc/lt/value/KindNotTakenError
```

`gt` у числа читает `::desc#2` сквозь тег как 2 и отвечает, что 3 больше. `max` по единому порядку отвечает, что больше `::desc#2`. А `lt` у desc отказывает числу. Так одна и та же пара получает три разных ответа. Какое поведение было бы согласованным: должен ли вход сравнения у ядра принимать значение под `::desc` как число, или его сравнение должно совпадать с тем, как его ранжирует `sort`?

### design · QSLIT#tag

«A kind of the core reads its payload, a value of its own kind or, for a set, a quote and a doc, a vector».

```qlang
> ::set~(b | a)
#[::call{:name :a} ::call{:name :b}]

> ::vec~(a | b) !| type
::vec/PayloadKindNotTakenError

> ::set::Box[3 1]
#[1 3]

> ::vec::Box[1] !| type
::vec/PayloadKindNotTakenError
```

Для `::vec` «value of its own kind» исключает цитату, множество и вектор под тегом. Это держат кейсы `the-vector-kind-refuses-a-quote-whose-steps-payload-reads` и `the-vector-kind-refuses-a-set-which-toVec-turns`. Для `::set`, `::quote` и `::doc` «a vector» означает любое значение формы вектора. Цитата становится множеством записей шагов, а тег `::Box` молча сбрасывается. Слово «вектор» читается двумя разными способами. Какой из них должен быть общим для конструкторов ядра?

### design · QSORD#set

«`#[…]` is its literal, `distinct` and `toSet` answer it». Закон `::vec/toSet`: «`toSet` answers what `distinct` answers». Страница `toSet`: «as `distinct` answers».

```qlang
> ::Box[2 1 2] | distinct
::Box#[1 2]

> ::Box[2 1 2] | toSet
#[1 2]
```

У `distinct` стоит `returns ::vec`, поэтому теги субъекта остаются; закон `keepsTheTagOfTheSubject`. У `toSet` стоит `returns ::set`, и теги уходят. Две дороги к одному множеству расходятся на векторе под тегом. Какой ответ согласован для обеих?

### conflict · QSORD#order

В главе: «strings by their UTF-16 code units». На странице `::vec/sort`: «strings order by their characters». На странице `::string`: «by their characters». В QSTXT#string символ — это кодовая точка, и `count` считает так же.

```qlang
> ["\uFFFF" "\uD83D\uDE00"] | map ~(count)
[1 1]

> ["\uFFFF" "\uD83D\uDE00"] | sort | first | eq "\uD83D\uDE00"
true
```

При порядке по кодовым точкам U+FFFF шёл бы раньше U+1F600. Дерево и глава ставят эмодзи первым, по кодовым единицам. Страницы называют порядок по символам.

### conflict · QSORD#order

В главе: «string, pattern, keyword, tag name, path, vector». Страницы описывают соседство иначе. `::string`: «Strings rank after numbers and before keywords». `::keyword`: «after strings and before tags». `::tag`: «Tags rank after keywords and before vectors». `::vec`: «vectors rank after tags and before sets».

```qlang
> [[1] /a ::t :k #"a" "s"] | sort
["s" #"a" :k ::t /a [1]]
```

Страница `::set` описывает соседей вплотную, «after vectors and before maps». В той же манере страницы пропускают образец между строкой и ключевым словом и путь между тегом и вектором.

### conflict · QSLIT#tag

Страница `::tagged/payload`: «`value | tag ::Foo | payload` answers the value, whatever its kind». В главе: «a label laid over a value already under it stands once», и вид ядра читает свою полезную нагрузку как само значение.

```qlang
> 5 | tag ::number | payload !| type
::tagged/payload/SubjectNotTaggedError

> :Lab |~~ L. ~~| | ::Lab[1] | :v it | tag ::Lab | payload | eq v
false
```

Глава и дерево ограничивают обращение `tag`/`payload`. Страница утверждает его для любого вида.

### conflict · QSORD#set

Страница `::qlang/values`: «the constructor of the kind attaches the tag to the payload or refuses it … and builds no other value» и «A kind of the core reads a payload of its own kind under its tag as the value itself, `::set[2 1]` printing `#[1 2]`». В главе: «Its constructor orders what it is given and holds each element once».

```qlang
> ::set[2 1] | payload | eq [2 1]
false
```

Конструктор множества строит другое значение, упорядоченное и без повторов. `[2 1]` — вектор, а не «payload of its own kind». Страница противоречит и QSORD#set, и QSLIT#tag («for a set … a vector»).

### conflict · QSLIT#closed

Вступление QSLIT: «A literal is a value its text alone fixes». Страница `::qlang/values`: «a literal reads neither the scope nor the value in the pipe». QSLIT#tag и QSBLD#label делают значение тегового литерала зависимым от деклараций области.

```qlang
> [::Lab::Lab[1]]
[::Lab::Lab[1]]

> :Lab |~~ L. ~~| | [::Lab::Lab[1]]
[::Lab[1]]

> :x 5 | ::x[1] !| type
::construct/TagNotKindError
```

Один и тот же текст литерала даёт разные значения, смотря что объявила область.

### conflict · QSLIT#closed

Страница `::map`: «A map literal is the shape of an answer, each value computed against the subject». В главе: «A literal is closed … its parts are literals, fixed by its text alone». Форму вычисляет `get` над шаблоном [QSPTH#template].

```qlang
> {:who /first} | get /who | type
::path

> "{:first \"Ann\"} | {:who /first}" | parse !| get /message
a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`
```

### conflict · QSSYN#line

В главе: «its steps run on, joined by `|`, to the next declaration or a value written after `|`». Страница `::qlang/pipeline`: «the body of a name with a path begun on the line after the name runs on through the steps joined to it up to the next declaration».

```qlang
> ":number/f\n  ~(add 1)\n| 5 | f" | parse | apply it
6
```

Значение после `|` заканчивает предложение. Это держит и кейс `a-body-begun-on-a-later-line-is-a-sentence`. Страница его не называет и ведёт тело до следующей декларации.

### implementation · QSSYN#doc

«Inside a doc, a span between backquotes is prose, as markdown reads it». QSSLF/doc держит это кейсом `a-quote-between-backquotes-is-prose`.

```qlang
> |~~ a `~(add 1)` b ~~| | segments
[" a `~(add 1)` b "]

> |~~ a ``~(add 1)`` c ~~| | segments
[" a ``" ~(add 1) "`` c "]
```

В markdown цепочка из двух обратных кавычек открывает кодовый спан, который закрывает такая же цепочка. Грамматика (`core/src/grammar.peggy:693`, `:702`) видит пустые спаны из одиночных кавычек, и цитата между ними становится кодом. Какое поведение согласовано с «as markdown reads it» для спана с цепочкой длиннее одной кавычки?

### text · QSORD#desc

QSLIT#tag ссылается сюда: «but for `::desc`, whose reversals stack [QSORD#desc]». Сам раздел QSORD#desc о наложении desc на desc ничего не говорит. Это правило держат кейс QSLIT/tag `desc-laid-over-a-desc-stands-twice`, страница `::any/desc` («A desc of a desc ranks as the value does») и её закон `ranksTurnedTwiceAsTheValue`.

```qlang
> ::desc::desc#5 | payload | type
::desc

> [1 3 2] | sort ~(desc | desc)
[1 2 3]
```

### text · core/src/runtime/tagged.mjs:72

Комментарий над конструктором, цитирующий [QSORD#desc]: «`::desc(…)` — any value turned to descend». В главе литерал записан `::desc#5`, а форму со скобками грамматика отвергает.

```qlang
> "::desc(5)" | parse !| get /message
a number, a boolean, null or a path touches its tag by `#`: write `::desc#5`
```

### text · core/src/grammar.peggy:290

Сообщение отказа: «only the first modifier of a command may touch its name, `f(a) (b)`». В главе QSSYN#step: «The first modifier of a command may touch its name where it opens with a parenthesis».

```qlang
> "[1] | map~(add 1)" | parse !| get /message
words are set off by whitespace; only the first modifier of a command may touch its name, `f(a) (b)`
```

Здесь отвергнут именно первый модификатор. Сообщение называет правило без условия про скобку.

### case · QSSYN#line

«A keyword that begins a line with a doc or a step after it, on its line or a later one, opens a declaration of its own … a keyword alone on its line before a combinator or the end of the source is the modifier above». Ни один кейс не держит ключевое слово, стоящее одно на строке перед строкой декларации. Дерево делает его модификатором команды выше, хотя по первому предложению после него идёт шаг на следующей строке.

```qlang
> "[1] | append\n:y\n:z 2\n| z" | parse
~([1] | append :y | :z 2 | z)
```

### case · QSORD#desc

Правило «rank its payloads of any kinds by the one order» не держит ни один кейс раздела. В `desc.jsonl` сравниваются только полезные нагрузки одного вида. Разновидовый случай есть только в пробе главы.

```qlang
> 1 | desc | gt ("a" | desc)
true
```

### case · QSLIT#tag

`{"name":"an-undeclared-tag-declares-no-node","query":"[::AutoFoo[1] ::AutoFoo[2]] | (::AutoFoo | binding) !| type",…}` и `{"name":"an-undeclared-tag-alone-names-no-binding","query":"::AutoBareOnly | binding !| type",…}` (`tag.jsonl:24-25`). Они показывают отказ оси для имени, которое ничто не объявляет: «any other name nothing declares is refused under the axis» [QSSLF#axis]. Как тег ложится на полезную нагрузку, они не показывают.

```qlang
> ::AutoBareOnly | binding !| type
::any/binding/UnknownNameError
```

### apophasis · QSSYN#step

«after `!|` a value is the recovery the catch answers, and a path, which the habit wrote there to read a fact of the error, is refused as after `|`». Придаточное «which the habit wrote there to read a fact of the error» объясняет, зачем пишут эту форму, вместо того чтобы сказать, что действует.

```qlang
> "!{:k 1} | raise !| /k" | parse !| type
::quote/ParseError
```
