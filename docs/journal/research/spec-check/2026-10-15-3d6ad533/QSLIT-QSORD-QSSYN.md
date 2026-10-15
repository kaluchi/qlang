<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 3d6ad533 and checking docs/spec/QSLIT-values-and-literals.md, docs/spec/QSORD-one-order.md and docs/spec/QSSYN-grammar.md, on 2026-10-15 from 07:04 to 07:18 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 3d6ad533. -->

### design · QSORD#desc

«It owns its comparisons, `gt`, `gte`, `lt` and `lte`, which rank its payloads of any kinds by the one order … the comparisons of the core compare within one kind.» В QSCND#compare: «a value of another kind is refused as `::number/gt/value/KindNotTakenError`». На странице `::desc`: «Every comparison agrees with it, `gt` and `lt` as `sort` and `max`». Правило QSBLD#input «An input holds the value of its kind the walk of its tags reaches» пропускает `::desc#1` во вход `::number/gt` как число, потому что обход тегов доходит до числового payload.

```qlang
> 2 | gt (1 | desc)
true

> 1 | desc | lt 2 !| type
::desc/lt/value/KindNotTakenError

> get [2 ~(1 | desc)] | sort
[2 ::desc#1]

> "a" | gt (1 | desc) !| type
::string/gt/value/KindNotTakenError
```

Одна и та же пара получает три ответа. Число сравнивается с `::desc` по его payload и без разворота. Сам `::desc` отказывает числу. Единый порядок ставит число раньше `::desc`. Какой ответ был бы согласован: отказ под `value`, как требует QSCND#compare, или сравнение по единому порядку, как обещает страница `::desc`?

### design · QSSYN#combinator

«Steps are joined by a combinator … One combinator stands between two steps». Пример в QSSYN#line: `"[3 1 2] sort"` отвергается с сообщением «steps are joined by `|`». При этом объявление, записанное после шага на той же строке, присоединяется без комбинатора. Кейсы `QSSYN/line.jsonl` `a-declaration-on-the-next-line-ends-a-command-body` и `a-keyword-on-a-later-line-opens-a-declaration-of-its-own` держат то же самое для следующей строки. Глава этого правила не формулирует.

```qlang
> [1 2] :y 2 | y
2

> "[1 2] :y 2" | parse | map ~(type)
[::vec ::bind]

> "[1 2] sort" | parse !| get /message
steps are joined by `|`: write `a | b`
```

У одного вопроса, нужен ли `|` между двумя шагами одной строки, два ответа: объявление (`::bind`) обходится без `|`, любой другой шаг его требует. Что было бы согласованным поведением: объявление тоже требует комбинатора, или глава признаёт за объявлением особое место?

### design · QSLIT#tag

«A kind of the core reads its payload, a value of its own kind or, for a set, a quote and a doc, a vector». Отказ `::set` называет `:expected #[::vec]`, как и отказ `::vec`. Тем не менее `::set` принимает вектор под чужим тегом и quote, а `::vec` те же значения отвергает. В кейсах `QSLIT/tag.jsonl` `the-vector-kind-refuses-a-quote-…` и `the-map-kind-refuses-a-map-under-a-tag-…` отказ задан только для `::vec` и `::map`.

```qlang
> ::Box[2 1] | tag ::set
#[1 2]

> ::Box[2 1] | tag ::vec !| get [~(type) /expected]
[::vec/PayloadKindNotTakenError #[::vec]]

> ~(b | a) | tag ::set | type
::set

> ::set{:a 1} !| get [~(type) /expected]
[::set/PayloadKindNotTakenError #[::vec]]
```

Под одними и теми же словами «a vector» с одинаковым `:expected #[::vec]` два конструктора ядра понимают разное. `::set` к тому же молча снимает `::Box`. Как согласованно должно пониматься «a vector»: только голый вектор или всё, до чего обход доходит до `::vec`?

### design · QSLIT#closed

Глава утверждает: «A literal is a value its text alone fixes», «its parts are literals, fixed by its text alone», «a function of its literal alone». QSLIT#tag добавляет: «a label laid over a value already under it stands once, `::Lab::Lab[1]` reading `::Lab[1]`». Тег, которого не объявляет ни одна декларация, «lays itself over a payload as it is». QSBLD#label говорит: «A label declared by its page alone lays its tag over a payload as it is».

```qlang
> ::Lab::Lab[1]
::Lab::Lab[1]

> :Lab |~~ L. ~~| | ::Lab::Lab[1]
::Lab[1]

> :Lab |~~ L. ~~| | ::Lab[1] | tag ::Lab | payload
[1]
```

Один и тот же текст литерала даёт два значения в зависимости от того, есть ли у `Lab` страница. При этом метка «by its page alone» не кладёт тег «as it is», а схлопывает его. Что было бы согласованным: литерал определяется своим текстом, или декларация тега в scope участвует в его значении? Ни один кейс `QSLIT/*.jsonl` не держит правило «stands once».

```qlang
$ grep -rn 'Lab' D:/git/qlang/core/test/conformance/QSLIT; echo end
end
```

### conflict · QSORD#order

В главе: «Values order first by kind: null, boolean, number, string, pattern, keyword, tag name, path, vector, set, map, quote, doc, elision and desc, and after them every other tag by its name, the labels, the errors … among them». Страница `::vec/sort` (`core/lib/qlang/vec.qlang:958`) говорит иначе: «Kinds come first, null, boolean, number, string, keyword, tag name, vector, set, map, quote, doc, error, elision and desc, then every other tag by its name». На странице ошибка стоит отдельным видом перед elision, а pattern и path отсутствуют.

```qlang
> [::error{:k 1} ::elision{:size 1} ::desc#1 ::A[1]] | sort
[::elision{:size 1} ::desc#1 ::A[1] !{:k 1}]
```

Дерево и глава ставят ошибку среди прочих тегов по имени, после elision и desc. Страница слова ставит её перед ними.

### conflict · QSLIT#kind

«Every value has a kind: the outermost tag of its stack, and for a value with no tag of its own, the kind of the core its literal implies. … `#[…]` the set, … `~(…)` the quote, `|~~ … ~~|` the doc, `!{…}` the error, `/a` the path … `payload` … refusing a value under no tag». В QSORD#set: «under the tag `::set` … its payload is that vector». В QSERR#rest: «a map of facts under `::error`».

```qlang
> #[2 1] | payload
[1 2]

> !{:a 1} | payload
{:a 1}

> /a | payload !| type
::tagged/payload/SubjectNotTaggedError
```

QSLIT#kind ставит set, quote, doc и error в один ряд с path, как значения «with no tag of its own». Другие главы и `payload` считают первые четыре значениями под тегом, а path нет.

### conflict · QSORD#sort

«Each takes a key, null, a quote or a path, another kind refused under the word's key». На странице `::vec/sort` (`core/lib/qlang/vec.qlang:969`): «a value computed at the call is refused, one key is given». На `::vec/min` (`:275`): «a value computed at the call is refused».

```qlang
> [2 1] | sort null
[1 2]

> [2 1] | sort 5 !| type
::vec/sort/key/KindNotTakenError
```

Глава и дерево принимают значение `null`, вычисленное при вызове. Страницы говорят, что любое такое значение отвергается.

### text · QSSYN#refusal

Глава: «A source the parser refuses answers `::quote/ParseError` with its `:source`». Страница факта `::quote/ParseError/source` (`core/lib/qlang/quote.qlang:74`): «The line of the text where the reading stopped.»

```qlang
> "[1\n2\n3 |" | parse !| get [/source /marker /location]
["3 |" "  ^" ::span[7 3 3 8 3 4]]
```

В `:source` лежит строка, на которой остановилось чтение, а не сам источник, как читается «its `:source`».

### implementation · lsp/src/features.mjs:242

«The kind of the value a literal step answers [QSLIT#kind]». Таблица `KIND_OF_LITERAL` не содержит `Path` и `ErrorLit`. QSLIT#kind называет оба: «`!{…}` the error, `/a` the path».

```qlang
$ grep -n 'NumberLit: .number., StringLit' D:/git/qlang/lsp/src/features.mjs; grep -n 'QuoteLit: .quote., DocLit' D:/git/qlang/lsp/src/features.mjs
243:  NumberLit: 'number', StringLit: 'string', RegexLit: 'regex', BooleanLit: 'boolean', NullLit: 'null',
245:  QuoteLit: 'quote', DocLit: 'doc', TagLit: 'tag'
```

```qlang
> /a | type
::path
```

Блок, который цитирует раздел, не знает двух видов, которые литерал этого раздела подразумевает. После `/a |` и `!{…} |` `kindsAfterStep` возвращает `null`. Что было бы согласованным: таблица следует перечню QSLIT#kind полностью?

### case · QSORD#order

Правила «paths segment by segment, each segment by its code units, an index among them, so `/10` ranks before `/9`» и «a doc by its segments in turn, a run of prose before a quote» не держит ни один кейс. Кейс `sort-orders-docs-by-their-text` (`[|~~ b ~~| |~~ a ~~|] | sort`) своим именем называет порядок по тексту, которого дерево не держит.

```qlang
> [/9 /10] | sort | map ~(print)
["/10" "/9"]

> [|~~ z ~~| |~~ ~(b) ~~|] | sort
[|~~ ~(b) ~~| |~~ z ~~|]

$ grep -rn '/10\b' D:/git/qlang/core/test/conformance/QSORD; echo end
end
```

### case · QSORD#sort

Правило «Each takes a key, null, a quote or a path, another kind refused under the word's key, `::vec/sort/key/KindNotTakenError`, `::map/sort/key/…` and `::vec/min/key/…`» в `QSORD/sort.jsonl` не держит ни один кейс.

```qlang
> [2 1] | sort 5 !| type
::vec/sort/key/KindNotTakenError

$ grep -rn 'key/KindNotTakenError' D:/git/qlang/core/test/conformance/QSORD; echo end
end
```

### case · QSLIT#number

Правила «one smaller than the least reads as `0`, and digits past a double's precision round» не держит ни один кейс из 15 в `QSLIT/number.jsonl`.

```qlang
> [1e-400 9007199254740993]
[0 9007199254740992]

$ grep -n 'e-4\|9007' D:/git/qlang/core/test/conformance/QSLIT/number.jsonl; echo end
end
```

### case · QSLIT#closed

Правило «inside an error literal names the facts built by `get` and made an error by `raise`» не держит ни один кейс.

```qlang
> "!{:a (1 | add 1)}" | parse !| get /message
an error literal computes nothing: facts computed are built by `get` and `raise` makes them an error, write `get {:a ~(1 | add 1)} | raise`

$ grep -rln 'error literal computes nothing' D:/git/qlang/core/test/conformance; echo end
end
```

### case · QSSYN#combinator

Кейс `a-recipe-may-open-with-a-combinator`: `:vec/m (::fn | takes :n … | impl ~(map ~(add n))) | [1 2] | m`. Ни recipe, ни группа в этом запросе не открываются комбинатором, так что правило «a group and a quote may open with a combinator» кейс не показывает.

```qlang
$ grep -n 'a-recipe-may-open-with-a-combinator' D:/git/qlang/core/test/conformance/QSSYN/combinator.jsonl | cut -c1-220
8:{"name":"a-recipe-may-open-with-a-combinator","query":":vec/m (::fn | takes :n |~~ The n. ~~| ~(query /0 1) ::number | impl ~(map ~(add n))) | [1 2] | m","expect":"[2 3]"}
```

Имя кейса называет правило, которого его запрос не содержит.

### case · QSLIT#atoms

Кейс `the-step-of-an-error-literal-comes-back-as-the-error-at-rest-it-is`: `~(!{:k 1}) | get [~(first)] | tag ::quote`. Он не разбирает значение на атомы и форму. Он показывает правило QSQUO#step: «an error literal as the error at rest it writes».

```qlang
> ~(!{:k 1}) | get [~(first)] | tag ::quote
~(!{:k 1})
```

### apophasis · QSORD#order

«The part JSON has follows the order of jq, but for strings past the basic plane, which jq ranks by code point; a kind JSON lacks stands beside the one it resembles.» Предложение обосновывает порядок через другой инструмент и описывает, что тот делает. Само правило выше уже названо как действующее: «strings by their UTF-16 code units».

```qlang
> ["\uFFFF" "😀"] | sort | map ~(json)
["\"😀\"" "\"￿\""]
```
