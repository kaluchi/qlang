<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 985a4b82 and checking docs/spec/QSTXT-text.md, docs/spec/QSCND-conditions-and-conversions.md and docs/spec/QSQUO-code-as-data.md, on 2026-10-15 from 08:05 to 08:17 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 985a4b82. -->

### design · QSCND#coalesce

«An alternative is code, a quote or a path, which runs against the subject, or a value, which answers itself; a call whose alternatives are all values puts the subject first». Здесь один и тот же вопрос, «поле `/t`, а если его нет, то 30», задан двумя путями: через значение, вычисленное при вызове, и через путь. Ответы расходятся. Значение `null` из `(get /t)` превращает вызов в вызов «из одних значений», и первым становится субъект целиком. Путь `/t` такого переключения не делает.

```qlang
> {:t null} | get [~(coalesce (get /t) 30) ~(coalesce /t 30)]
[{:t null} 30]
```

Расходятся правило «всё из значений → субъект первым» и правило «значение отвечает само собой»: от вида одной альтернативы зависит, участвует ли субъект вообще. Вопрос: какое поведение было бы согласованным, если альтернатива, вычисленная при вызове, может дать `null` и тем самым поменять роль субъекта?

### design · QSCND#coalesce · QSQUO#held

QSCND#coalesce: «Code that answers a failure is taken as no value, as null is». QSQUO#held: значение читателя, прочитанное из удерживаемого кода, «is refused under its name as `::call/ValueWithheldError`». Вместе эти правила превращают отказ области видимости в молчаливое «нет значения». Цитата, записанная в шаге, отвечает 6. Та же цитата, вычисленная группой или положенная в имя, молча даёт `null` или запасной вариант, хотя `apply` на той же цитате отказывает.

```qlang
> :k 1 | 5 | get [~(coalesce ~(add k)) ~(coalesce (~(add k))) ~(apply (~(add k)) !| type)]
[6 null ::call/ValueWithheldError]

> :k 1 | :q ~(add k) | 5 | get [~(coalesce q ~("none")) ~(apply q !| type)]
["none" ::call/ValueWithheldError]
```

Расходятся «код, вернувший отказ, — это не значение» и «удержанное имя отказывает под своим именем». QSQUO#modifier выделяет для удержанного имени исключение («whose refusal passes as it is»), но только для отказа входа. Вопрос: какое поведение было бы согласованным для `ValueWithheldError` внутри альтернативы `coalesce`?

### design · QSCND#compare

«`gt`, `gte`, `lt` and `lte` … compare the subject with a value of its kind by the one order [QSORD#order]: a value of another kind is refused». QSORD#desc: «`::desc` is a kind whose order is the reverse of its payload's». Вход числа принимает `::desc#2`, потому что обход тегов доходит до числа [QSBLD#input]. Дальше сравнение идёт по полезной нагрузке по возрастанию, без разворота. В итоге `gt` расходится с единым порядком, по которому `sort` ставит 3 раньше `::desc#2`, а обратное сравнение отказывает.

```qlang
> get [~(3 | gt (2 | desc)) ~(get [3 ~(2 | desc)] | sort | first) ~(2 | desc | lt 3 !| type)]
[true 3 ::desc/lt/value/KindNotTakenError]
```

Расходятся правило входа «значение того вида, до которого доходит обход», «единый порядок» и «значение другого вида отклоняется». Вопрос: что согласованно ответить на `3 | gt (2 | desc)`, если `::desc` сам владеет своими сравнениями?

### conflict · QSCND#convert

Глава: «`toString` writes … a boolean and null by their literals», то же утверждает кейс `every-atom-turns-into-the-text-of-its-literal`. Страница `::string/toString`: «A vector, a set, a map, null and a pattern have no `toString`».

```qlang
> ::string/toString | doc | content | contains "a map, null and a pattern have no `toString`"
true

> null | toString | print
"null"

> ::null | manifest | has ::null/toString
true
```

Глава и её кейс противоречат странице `::string/toString` в вопросе, отвечает ли null на `toString`.

### implementation · QSCND#boolean

«a condition of another kind than a boolean, a path or a quote, an error computed at the call among it, is refused as `ElementKindNotTakenError` at the first such index». Если до вычисленного отказа стоит число, дерево называет индекс отказа, а не первый неподходящий.

```qlang
> get [~(5 | allOf 3 true !| get /index) ~(5 | allOf 3 (1 | div 0) !| get /index)]
[0 1]
```

Глава называет индекс 0. Дерево следует порядку из QSQUO#modifier («a call computes them in their order up to the first that answers a failure», см. `core/src/eval.mjs:910`) и называет 1. Кейс `all-of-computes-every-condition-at-the-call` ставит на индекс 0 `false`, поэтому этого порядка он не проверяет. Вопрос: какое поведение было бы согласованным, если неподходящий вид стоит раньше отказа?

### implementation · QSCND#convert

«A value is read as another kind by a word of its own kind named `to` and the kind it answers, a kind answering its own word as itself». Каждый целевой вид отвечает на своё слово самим собой, кроме `::path`.

```qlang
> get [~(#"a" | toRegex | type) ~(::vec | toTag) ~(/a | toPath !| type)]
[::regex ::vec ::call/KindAnswersNoVerbError]

> /a | toPath !| get [~(type) /addresses /read]
[::call/KindAnswersNoVerbError #[::string/toPath ::vec/toPath] ~(get /a | toPath)]
```

Предложение главы расходится с деревом: под `::path` нет `toPath`. Кейса на это нет ни в одну сторону. Вопрос: что согласованно ответить на `/a | toPath`, учитывая чтение `:read` из QSPTH#words?

### implementation · QSTXT#string

«`lower` and `upper` fold its case letter by letter as Unicode maps it». То же сказано в комментарии `core/src/runtime/string.mjs:44`. Дерево приводит регистр с учётом контекста: финальная сигма зависит от соседних букв, поэтому результат для строки целиком отличается от побуквенного.

```qlang
> "ΣΑΣ" | get [~(lower) ~(split "" | map ~lower | join "")]
["σας" "σασ"]
```

Слова «letter by letter» в главе и в комментарии расходятся с деревом. Ни кейс, ни страница `::string/lower` («every letter in lower case, of any script») побуквенности не утверждают. Вопрос: какое приведение регистра согласовано с текстом?

### design · QSTXT#pattern

«`toRegex` … each with the flags its call gives in the place of its own, a pattern keeping its own and a string taking none where the call gives none». QSDSP#walk: «A word means one act wherever it resolves». Вход `flags` у `::regex/toRegex` принимает `#[::null ::string]`, у `::string/toRegex` только `::string`. Поэтому явный `null` для шаблона означает «флагов нет», а для строки — отказ.

```qlang
> get [~(#"a"m | toRegex null) ~("a" | toRegex null !| type)]
[#"a"m ::string/toRegex/flags/KindNotTakenError]
```

Два вида, отвечающие на одно действие `toRegex`, по-разному понимают «вызов не дал флагов». Страница `::regex/toRegex` при этом говорит «as `string/toRegex` takes them». Вопрос: какое поведение было бы согласованным для `toRegex null`?

### case · QSTXT#match

Раздел называет правила, которые не держит ни один кейс: отказ тексту у `match`/`capture`/`scan` («refusing a text as `::string/match/pattern/KindNotTakenError`»), `^`/`$` под флагом `m`, `` $` ``, `$'` и `$$`, «`::string/replace/with/AnswerNotStringError`», «`::string/toRegex/flags/KindNotTakenError`», а также `null` у `capture` при отсутствии совпадения. Дерево всё это отвечает.

```
$ grep -rlE 'AnswerNotStringError|match/pattern/KindNotTaken|toRegex/flags/KindNotTaken|if/then/KindNotTaken|map/every/ConditionNotBoolean|map/any/ConditionNotBoolean' D:/git/qlang/core/test/conformance
```

```qlang
> "abc" | match "a" !| type
::string/match/pattern/KindNotTakenError

> "a\nb" | get [~(contains #"^b$") ~(contains #"^b$"m)]
[false true]

> "xay" | replace #"a" "[$`|$'|$$]"
x[x|y|$]y

> "a" | replace #"a" ~(1) !| type
::string/replace/with/AnswerNotStringError

> "a" | toRegex 5 !| type
::string/toRegex/flags/KindNotTakenError

> "abc" | capture #"(?<n>x)"
null
```

Правила раздела расходятся с его файлом кейсов: для них в `match.jsonl` нет строки.

### case · QSCND#branch · QSCND#quantify

QSCND#branch: «a branch of another kind, `::any/if/then/KindNotTakenError`». QSCND#quantify: отказ предиката «at its `:key` over a map». Ни в `branch.jsonl`, ни в `quantify.jsonl` нет кейса на эти отказы: в `quantify.jsonl` все кейсы `ConditionNotBooleanError` про векторы, с `:index`. Тот же grep выше ничего не вывел.

```qlang
> 5 | if true 1 2 !| type
::any/if/then/KindNotTakenError

> {:a true :b 1} | every ~(it) !| get [~(type) /key]
[::map/every/ConditionNotBooleanError :b]
```

Правила разделов расходятся с их файлами кейсов: эти правила не держит ни один кейс.

### text · QSCND#compare

«a subject of a kind none of them resides on, a boolean, a vector, a set, a map, a pattern or null, as `::call/KindAnswersNoVerbError`». Перечень дан как исчерпывающий, без «among them», но так же отказывают путь, цитата и другие виды.

```qlang
> /a | gt /b !| get [~(type) /addresses]
[::call/KindAnswersNoVerbError #[::desc/gt ::keyword/gt ::number/gt ::string/gt ::tag/gt]]

> ~(a) | gt ~(b) !| type
::call/KindAnswersNoVerbError
```

Предложение перечисляет часть видов как все. Правило же, по первой половине того же предложения и по кейсу `a-kind-with-no-comparison-names-the-kinds-that-have-one`, касается любого вида, на котором сравнения не живут.
