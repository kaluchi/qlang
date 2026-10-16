> A check of the chapters `QSTXT`, `QSCND`, `QSQUO` for D323 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `c0ee20a9`, itself the baseline; run 2026-10-15, 11:10–11:20 UTC. A path it names reads as `git show c0ee20a9:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qlang`, `grep` and `git ls-files` allowed, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.

### design · QSCND#coalesce

«a call whose alternatives are all values puts the subject first, so `query /timeout | coalesce 30` reads the timeout, else 30».

```qlang
> {:t null} | coalesce (get /t) 30
{:t null}

> {:t null} | coalesce (get /t) ~(30)
30

> {:t null} | coalesce /t 30
30
```

Оба правила записаны так, как задуманы: альтернатива, вычисленная при вызове, отвечает сама собой, а вызов, где все альтернативы — значения, ставит субъект первым. Вместе они дают вот что: альтернатива `(get /t)` либо читается, либо уступает место субъекту, и это решает не она, а то, есть ли среди остальных альтернатив код. Перенос `30` в кавычку `~(30)` меняет ответ с `{:t null}` на `30`, хотя первая альтернатива та же. Вопрос: какой согласованный ответ должна давать альтернатива, вычисленная при вызове, независимо от вида соседних альтернатив?

### design · QSCND#compare

«`gt`, `gte`, `lt` and `lte` … compare the subject with a value of its kind by the one order [QSORD#order]: a value of another kind is refused»; страница `::number/gt`: «Numbers compare with numbers: … a value under `::desc` each compare with their own kind by a `gt` of their own».

```qlang
> 5 | gt (3 | desc)
true

> get [5 ~(3 | desc)] | sort
[5 ::desc#3]

> 7 | lt ::Box#5
false

> get [7 ::Box#5] | max
::Box#5
```

Вход `value` у `::number/gt` проходит теги значения до числа ([QSBLD#input]). Поэтому `::desc#3` сравнивается как `3`, а разворот порядка, ради которого `desc` существует, теряется. Сравнение через `::Box` даёт ответ, противоположный одному порядку, по которому ранжируют `sort` и `max`, хотя глава говорит, что сравнение идёт «by the one order». Вопрос: должны ли `gt`/`lt` между значениями под разными тегами совпадать с одним порядком или отказывать, как отказывает `1 | desc | gt 2`?

### conflict · core/lib/qlang/boolean.qlang:186

Страница отказа `::boolean/or/SubjectNotBooleanError` предлагает такую починку: «and of one record by `anyOf (/role | eq "admin") (/role | eq "owner")`».

```qlang
> {:role "admin"} | anyOf (/role | eq "admin") (/role | eq "owner")
false

> {:role "admin"} | anyOf (get /role | eq "admin") (get /role | eq "owner")
true
```

```sh
$ grep -n "anyOf (/role" D:/git/qlang/core/lib/qlang/boolean.qlang
186:            `anyOf (/role | eq "admin") (/role | eq "owner")`.
```

В починке путь стоит в голове группы как значение, и `eq` сравнивает строку с самим путём. Это расходится с [QSSYN#step] и первой страницей («A path is a value and does nothing by itself»), а также со словами той же страницы `or` выше (строка 164), где написано `(get /role | eq "admin")`.

### design · QSQUO#held

«A quote stays the value its print shows, and the meaning of held code is its text and the vocabulary»; [QSQUO#modifier]: «An input that takes code takes a quote or a path, a group that computes a quote among them».

```qlang
> :k 1 | 5 | apply ~(add k)
6

> :k 1 | 5 | apply (~(add k)) !| type
::call/ValueWithheldError

> ~(add k) | eq (~(add k))
true
```

Вход `code` принимает оба значения, и они равны, их print один и тот же. Но кавычка, вычисленная группой, отвечает отказом там, где написанная отвечает `6`. Получается, что смысл кода зависит не от его текста, а от дороги, по которой он пришёл. Вопрос: какой согласованный ответ должен давать вход кода на одно и то же значение кавычки, пришедшее разными дорогами?

### design · QSTXT#split

«`split` and `join` round-trip by one separator string. `join` writes the elements … between a separator, a keyword written as its name»; [QSTXT#search]: «a word that reads text refuses a keyword for its text»; [QSTXT#string]: «`append` and `prepend` write a text at one end, a keyword written as its name».

```qlang
> get [~(["a" "b"] | join :x) ~("axb" | split :x !| type) ~("x" | append :a) ~("xa" | endsWith :a !| type)]
["axb" ::string/split/separator/KindNotTakenError "xa" ::string/endsWith/suffix/KindNotTakenError]
```

Один и тот же ключевой знак как текст принимают `join`, `append` и `prepend`, а обратные им слова `split`, `endsWith` и `startsWith` его отвергают. Поэтому круг `join`/`split` по одному разделителю размыкается, когда разделитель — keyword. Вопрос: какой единый ответ должен дать keyword там, где слово ждёт текст?

### case · QSCND#convert

«A value is read as another kind by a word of its own kind named `to` and the kind it answers, a kind answering its own word as itself.»

```qlang
> /a | toPath !| get [~(type) /addresses]
[::call/KindAnswersNoVerbError #[::string/toPath ::vec/toPath]]
```

```sh
$ grep -c "toPath" D:/git/qlang/core/test/conformance/QSCND/convert.jsonl
0
```

Своё слово отвечают `::string`, `::number`, `::keyword`, `::tag`, `::set`, `::vec`, `::map` и `::regex`, а `::path` слово `toPath` не отвечает. Ни один кейс QSCND#convert не держит правило «a kind answering its own word as itself» для пути, и здесь дерево и предложение главы расходятся.

### case · QSTXT#match

«a replacement string of a pattern names the parts of a match by `$1`, … a group the pattern lacks standing as written».

```qlang
> "abc" | replace #"(b)" "[$10]"
a[b0]c

> "abc" | replace #"(b)" "[$2]"
a[$2]c
```

```sh
$ grep -c '\$10' D:/git/qlang/core/test/conformance/QSTXT/match.jsonl
0
```

Группы 10 в паттерне нет, но `$10` не остаётся как написано: дерево читает его как `$1` и `0`. Кейсы держат границу правила только для `$<zz>`, а о номерной группе, которой нет в паттерне, не говорит ни один кейс.

### text · QSQUO#parse

«A quote whose steps are all declarations prints one declaration a line, …, a step that takes several lines prints on them, and any other quote prints on one line.»

```qlang
> "5 | :x |~~ one\n two ~~| 1 | add x" | parse | parse
5
| :x |~~ one
 two ~~| 1
| add x
```

```sh
$ grep -n "several steps one of\|which takes several lines" D:/git/qlang/core/src/quote.mjs
282:// catalog writes it [QSQUO#parse], and so does a quote of several steps one of
283:// which takes several lines, the commands of a signature among them [QSBLD#fn].
```

Комментарий кода и дерево печатают кавычку, где один шаг многострочный, по шагу на строку, каждый после первого со своей трубой. Предложение главы говорит только, что сам многострочный шаг печатается на своих строках, а остальное — на одной.

### case · QSTXT#search

«`contains` asks a vector and a set for an element, a path among them, which `has` reads as the path it is»; «a word that reads text refuses a keyword for its text».

```qlang
> [/a] | contains /a
true
```

```sh
$ grep -c "contains /" D:/git/qlang/core/test/conformance/QSTXT/search.jsonl
0
```

Ни один кейс раздела не держит поиск пути как элемента вектора или множества. Отказ keyword-иглы показан только пробой главы: в `search.jsonl` отвергается лишь число `42`.

### case · QSTXT#string

«`append` and `prepend` write a text at one end, a keyword written as its name.»

```qlang
> "x" | prepend :a
ax
```

```sh
$ grep -cE '\| (append|prepend) :' D:/git/qlang/core/test/conformance/QSTXT/string.jsonl
0
```

Это правило держат проба главы и законы страниц `::string/append` и `::string/prepend`, но ни один кейс раздела.

### case · QSCND#quantify

Кейс `{"name":"any-short-circuits","query":"[1 2 99] | any ~(gt 50)","expect":"true"}`.

```qlang
> get [~([true "x"] | any ~(gt 0) !| type) ~([true "x"] | any ~(it)) ~(["x" true] | any ~(it) !| type)]
[::number/gt/value/KindNotTakenError true ::vec/any/ConditionNotBooleanError]
```

```sh
$ grep -n "any-short-circuits" D:/git/qlang/core/test/conformance/QSCND/quantify.jsonl
11:{"name":"any-short-circuits","query":"[1 2 99] | any ~(gt 50)","expect":"true"}
```

В этом кейсе решающий элемент стоит последним, так что остановку он не показывает. Правило «`any` … stopping at the first that decides» держит только проба `[true "x"] | any ~(it)`, а кейса для `any` нет. Для `every` его держит `[false 1] | every ~(it)`.

### apophasis · QSTXT#pattern

«A pattern whose matching backtracks without end runs as long as its matching does.»

```qlang
> "aaa" | contains #"(a+)+b"
false
```

Предложение не задаёт правила, которое мог бы держать кейс. Оно говорит лишь, что граница отсутствует: у бесконечного бэктрекинга нет ни отказа, ни бюджета.
