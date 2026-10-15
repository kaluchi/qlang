<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 3d6ad533 and checking docs/spec/QSTXT-text.md, docs/spec/QSCND-conditions-and-conversions.md and docs/spec/QSQUO-code-as-data.md, on 2026-10-15 from 07:04 to 07:19 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 3d6ad533. -->

### design · QSCND#coalesce

«a call whose alternatives are all values puts the subject first». Здесь `null`, вычисленный при вызове, не уступает место значению 30: на его место встаёт субъект. Ответ зависит и от того, есть ли в том же вызове код:

```qlang
> {:t null} | coalesce (get /t) 30
{:t null}

> {:t null} | coalesce ~(get /t) 30
30

> {:t null} | coalesce /missing (get /t) 30
30
```

Один и тот же `null` из `(get /t)` и из `~(get /t)` даёт разные ответы, а добавление в вызов кода меняет то, что отвечает значение. Какой ответ был бы согласованным для альтернативы-значения, которая равна `null`?

### design · QSQUO#held

По «a quote a call answered or a group computed» код в собственной полосе. По «A quote written in a step, an object of a call…» код шага. Вместе они дают одной цитате с одним и тем же print два ответа в зависимости от обёртки:

```qlang
> :k 10 | [1 2] | map ~(add k)
[11 12]

> :k 10 | [1 2] | map (~(add k)) !| get [~(type) /name]
[::call/ValueWithheldError :k]

> :k 5 | 1 | apply ~(k)
5

> :k 5 | ~(k) | apply it !| get [~(type) /name]
[::call/ValueWithheldError :k]
```

Рядом в том же разделе стоит «A quote stays the value its print shows», а одинаково напечатанные цитаты отвечают по-разному. Что согласованно ответила бы цитата, которую группа просто возвращает без изменений?

### design · QSQUO#modifier

У двух входов, которые оба принимают и значения, и код, одна и та же неудача, вычисленная при вызове, обрабатывается двумя способами. `allOf` отказывает под своим входом, `coalesce` передаёт неудачу как ответ (QSCND#coalesce: «a value computed at the call that is a failure is the answer of the call [QSQUO#modifier]»):

```qlang
> {} | allOf (get /x) ~(true) !| get [~(type) /actualType]
[::any/allOf/conditions/ElementKindNotTakenError ::path/KeyNotInMapError]

> {} | coalesce (get /x) ~(1) !| type
::path/KeyNotInMapError
```

Правило QSQUO#modifier («An input that takes code … refuses … a failure among it» / «An input of a value hands the failure … on») не говорит, какая ветвь действует для входа, который принимает и то и другое. Какой ответ был бы согласованным?

### design · QSCND#coalesce

QSPTH#code: «an input that takes any value … takes the path as the value it is». Вход `coalesce` принимает любое значение, но путь, вычисленный при вызове, он читает как код. Если вычисленное значение не путь, оно отвечает само собой, и субъект встаёт первым:

```qlang
> {:p /a :a 5} | put /q (get /p)
{
  :p /a
  :a 5
  :q /a
}

> {:p /a :a 5} | coalesce (get /p)
5

> {:p "s" :a 5} | coalesce (get /p)
{:p "s" :a 5}

> {:p /a :a true} | allOf (get /p)
true
```

Значение, вычисленное при вызове, получает разную роль в зависимости от того, оказалось ли оно путём. Какой ответ согласован?

### text · QSQUO#parse

«any other quote prints on one line». Цитата, где не все шаги объявления, но один шаг занимает несколько строк, печатается в несколько строк. Так же это правило записано в комментарии `core/src/quote.mjs:282` («and so does a quote of several steps one of which takes several lines»):

```qlang
> ~(:a ~(:b 1 | :c 2) | count) | print
~(:a ~(:b 1
| :c 2)
| count)
```

Предложение главы расходится с правилом, которое записано в коде и которое соблюдает дерево.

### text · QSQUO#modifier

«refuses a value computed at the call that none of its kinds takes, a failure among it, under its own address». Если неудача — `::call/ValueWithheldError`, вход кода её не отклоняет, а передаёт дальше. Это держит кейс `QSQUO/held.jsonl` «a-name-withheld-as-the-code-of-a-word-is-refused-under-its-name» и ветка `eval.mjs:950`:

```qlang
> :f ~(add 1) | :g ~([1 2] | map f) | apply g !| get [~(type) /name]
[::call/ValueWithheldError :f]

> :g ~([1 2] | map nosuch) | apply g !| type
::vec/map/code/KindNotTakenError
```

Глава не формулирует это исключение, которое держат кейс и код.

### text · QSTXT#pattern

«`toRegex` reads a string as a pattern and answers a pattern as its source, each with the flags its call gives in the place of its own». Страница `::regex/toRegex` говорит «Answers the pattern itself». Без флагов шаблон сохраняет свои флаги, а строка остаётся без флагов:

```qlang
> #"a"m | toRegex
#"a"m

> "a" | toRegex
#"a"
```

Глава описывает случай без флагов иначе, чем страница. Ни один кейс этот случай не держит.

### text · QSTXT#search

«`contains` asks a vector and a set for an element, as `has` does». QSPTH#has говорит, что `has` читает путь как путь, «so a path held as an element is asked for by `contains`»:

```qlang
> [/a] | get [~(contains /a) ~(has /a)]
[true false]

> [[1] 2] | get [~(contains /0/0) ~(has /0/0)]
[false true]
```

«as `has` does» расходится с QSPTH#has, где для путей ответы `has` и `contains` разные.

### text · QSQUO#parse

«a `:message` where the parser names the form meant or the `:expected` of the place it stopped». QSSYN#refusal говорит, что у незакрытого источника есть и то и другое:

```qlang
> "[1" | parse !| keys
#[:expected :location :marker :message :source :trail :uri]
```

«or» расходится с QSSYN#refusal.

### conflict · ::any/coalesce

На странице сказано: «An alternative that is no quote answers itself, and a call of such alternatives alone puts the subject first»; вход описан так: «each a quote run against the subject or a value». Глава говорит «An alternative is code, a quote or a path»:

```qlang
> {:t null} | coalesce /t 30
30
```

По странице путь `/t` — «no quote», то есть вызов из одних значений и ответом был бы субъект. По главе путь — это код. Страница `::any/allOf` тоже называет только «a quote», хотя глава говорит «a quote or a path».

### conflict · core/lib/qlang/string.qlang:1113

На странице `::string/toTag` сказано «names joined by `it`». QSNAM#letters и QSLIT#keyword: имена соединяются через `/`:

```
$ sed -n '1113,1114p' core/lib/qlang/string.qlang
      `"vec" | toTag | manifest`. The text is a name, or names joined by
      `it`; text that names no tag is refused. `toString` turns the tag
```

```qlang
> "vec/count" | toTag
::vec/count
```

Страница называет другой разделитель, чем главы.

### conflict · core/src/runtime/control.mjs:42

Комментарий, который ссылается на [QSCND#coalesce], приводит пример `get /timeout | coalesce 30` как «reads the subject first». В главе пример `query /timeout | coalesce 30`, а закон `passesAnErrorBeforeIt` говорит, что ошибка предыдущего шага проходит мимо вызова:

```qlang
> {} | get /timeout | coalesce 30 !| type
::path/KeyNotInMapError
```

Пример в комментарии противоречит главе и странице.

### conflict · core/test/unit/run-laws.test.mjs:94

«A law runs in the scope of the session that asked for it, so a name a source of the root declared resolves there [QSCND#boolean]». QSQUO#held: «a law the root declares runs in a lane over the root alone». В QSCND#boolean правила об области видимости нет:

```
$ sed -n '94,95p' core/test/unit/run-laws.test.mjs
    // A law runs in the scope of the session that asked for it, so a
    // name a source of the root declared resolves there [QSCND#boolean].
```

```qlang
> :first 5 | ::vec/first | runLaws | map /ok | distinct
#[true]
```

Комментарий описывает область видимости закона иначе, чем QSQUO#held, и ссылается на раздел, где такого правила нет.

### case · QSCND#compare

Отказы раздела нигде в `QSCND/compare.jsonl` не держатся: `::number/gt/value/KindNotTakenError` и `::call/KindAnswersNoVerbError` для boolean, pattern и null. Сравнения строк, ключевых слов и тегов там тоже нет:

```
$ grep -rl "gt/value/KindNotTakenError" core/test/conformance
core/test/conformance/QSDSP/residence.jsonl
```

```qlang
> true | gt false !| get [~(type) /addresses]
[::call/KindAnswersNoVerbError #[::desc/gt ::keyword/gt ::number/gt ::string/gt ::tag/gt]]
```

### case · QSCND#boolean

Кейсов нет ни на `::any/allOf/conditions/EmptyError`, ни на `::any/allOf/ConditionNotBooleanError` (это проба самой главы), ни на условие-путь:

```
$ grep -rlE "allOf/conditions/EmptyError|allOf/ConditionNotBooleanError" core/test/conformance
```

```qlang
> 5 | allOf !| type
::any/allOf/conditions/EmptyError
```

### case · QSQUO#step

`::bind/PayloadNotSchemaError`, `::quote/PayloadKindNotTakenError`, `::quote/ReadBackDiffersError` и `::quote[/age]` (печать и обратное чтение) названы в главе, но кейсов на них нет. В QSQUO#apply так же нет кейса на `::any/apply/args/NotTakenError` и на `open` от null:

```
$ grep -rlE "PayloadNotSchemaError|quote/PayloadKindNotTakenError|quote/ReadBackDiffersError|apply/args/NotTakenError" core/test/conformance
```

```qlang
> 5 | tag ::quote !| type
::quote/PayloadKindNotTakenError

> {:a 1} | apply /a [1] !| type
::any/apply/args/NotTakenError

> ~(it) | open
null
```

### case · QSTXT#string

Для `lines` (`\r\n`, перенос в конце, пустая строка) и для подсчёта по кодовым точкам (комбинирующий знак) кейсов нет. Их держат только законы `::string/lines` и `::string/count`, хотя QSWRK#cases требует: «a requirement a law proves as well stays a case»:

```
$ grep -c "| lines" core/test/conformance/QSTXT/string.jsonl
1
```

```qlang
> "a\r\nb\r\n" | lines
["a" "b"]

> "e\u0301" | count
2
```

### case · QSTXT/pattern.jsonl:8

«a-pattern-has-no-string-its-text-being-its-literal» (`#"a" | toString !| type` → `::call/KindAnswersNoVerbError`) показывает набор видов `toString`. Это правило QSCND#convert, а не QSTXT#pattern. Похожий случай — `QSQUO/modifier.jsonl:10` «a-modifier-is-computed-against-the-subject-of-its-step» (`mulOf /price /qty`): это проба QSNUM#combine и QSPTH#code.

```qlang
> #"a" | toString !| get /nearest
[:json :print]
```
