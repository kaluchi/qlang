<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 3d6ad533 and checking docs/spec/QSPTH-paths.md, docs/spec/QSNUM-numbers.md and docs/spec/QSCOL-collections.md, on 2026-10-15 from 07:04 to 07:14 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 3d6ad533. -->

### implementation · QSNUM#arithmetic

Глава: «`round` to the digits its call gives … half away from zero». Кейс `round-rounds-half-away-from-zero` и страница `::number/round` («A half rounds away from zero, as the digits are written») говорят то же. Число, которое меньше половины, дерево округляет вверх:

```qlang
> get [~(1.4999999999999998 | round) ~(0.49999999999999994 | round) ~(1.0000000000000002 | round 15)]
[2 1 1.000000000000001]

> [1.4999999999999998 0.49999999999999994] | map ~(lt 1.5)
[true true]
```

Глава и кейс задают округление к ближайшему, а при ровной половине — от нуля. `core/src/runtime/arith.mjs:47` перед округлением прибавляет к модулю `Number.EPSILON`, и значения чуть ниже половины переходят через неё. Вопрос: что должна ответить согласованная реализация для значения ниже половины — `1` для `1.4999999999999998 | round` и `0` для `0.49999999999999994 | round`?

### design · QSPTH#query

Глава говорит: «`query` … answers `null` where … `null` stands on the path». В QSPTH#get сказано: «A path reads beneath the tags over each value it meets». Значение под тегом `query` читает сквозь тег, а null под тегом отказывает:

```qlang
> {:a ::T#null} | query /a/b !| type
::path/SubjectHasNoPartsError

> {:a null} | query /a/b
null

> ::Box{:a 1} | query /a
1
```

Два правила вместе требуют увидеть null под тегами, а дерево отличает null от null под тегом. Вопрос: должна ли мягкая проверка null читать сквозь теги так же, как чтение части?

### design · QSPTH#key

Глава говорит: «A key alone is the path of one segment … a keyword, a number or a string … any other value given to `get` or `query` is a template and answers as it is». В QSPTH#get сказано: «`get` … refuses a miss». Когда вычисленный ключ оказывается null или boolean, строгий `get` молча возвращает сам ключ:

```qlang
> {:true 1 :k null :f true} | get [~(get (get /k)) ~(get (get /f)) ~(get /missing !| type)]
[null true ::path/KeyNotInMapError]
```

У одного вопроса две дороги. Путь читается строго. Вычисленный ключ null или `true` становится шаблоном и тихо отвечает самим собой, хотя `groupBy` и `toKeyword` относят `true` к `:true`. Вопрос: как отвечать на ключ, вычисленный при вызове, если он не ключевое слово, не строка и не число — отказом под входом или чтением?

### text · QSCOL#algebra

Глава: «on vectors, which fold the sets or maps they hold … A value that is no set or map is refused at its index». Страница `::vec/minus` говорит иначе: «a map loses the keys of the next, which is a map, a set or a vector of keys … The first value is a set or a map, refused at its index when it is neither, a value after it the algebra has no rule for is refused with the pair». Страница `::vec/inter` говорит то же. Дерево следует страницам:

```qlang
> get [~([{:a 1 :b 2} [:a]] | minus) ~([{:a 1} 5] | minus !| type) ~([{:a 1} 5] | union !| get [~(type) /index])]
[{:b 2} ::vec/minus/KindsMismatchedError [::vec/union/ElementNotSetOrMapError 1]]

> ::vec/minus | doc | content | contains "a value after it the algebra has no rule for is"
true
```

Предложение главы верно только для `union`. Для `minus` и `inter` вектор ключей после map принимается, а позднее значение не отказывается по индексу.

### conflict · QSPTH#has

Глава: «On a vector and a set `has` … reads a path … so a path held as an element is asked for by `contains`». Страницы говорят, что `contains` спрашивает то же, что `has`:

```
$ grep -n "asks the same\|same of a vector" core/lib/qlang/vec.qlang core/lib/qlang/set.qlang
core/lib/qlang/vec.qlang:680:      same of a vector.
core/lib/qlang/set.qlang:1269:      at all is `empty | not`. `contains` asks the same of a set.
```

(vec.qlang:679 кончается на «`contains` asks the».)

```qlang
> get [~([/a] | get [~(has /a) ~(contains /a)]) ~(#[/a] | get [~(has /a) ~(contains /a)])]
[[false true] [false true]]
```

Для пути, который лежит в векторе или множестве как элемент, глава и дерево разводят `has` и `contains`, а страницы `::vec/has` и `::set/has` их отождествляют.

### conflict · QSPTH#value

Глава: «A path prints in one spelling that reads back as itself, `/"0"` printing `/0`». Страница `::path` вместе со своим законом `printsAsWritten` утверждает другое:

```qlang
> ::path | doc | content | contains "A path prints as it is written"
true

> [/"0" /:name] | map ~(print)
["/0" "/name"]
```

По главе путь печатается одним каноническим написанием, по странице — так, как его написали.

### conflict · QSPTH#template

Глава: «A quote under a tag, a doc, a function and a kind are answered as they are». Страница `::any/get` сначала говорит «each quote run», а потом в списке значений, которые возвращаются как есть, называет quote без тега:

```qlang
> ::any/get | doc | content | contains "a quote, a doc, a function and a kind among them"
true

> {:a 1} | get [~(get /a) ::T~(get /a)]
[1 ::T~(get /a)]
```

Глава возвращает как есть только quote под тегом. Страница противоречит и главе, и самой себе.

### conflict · QSPTH#key

Глава: «a keyword, a number or a string, one segment of its text». Страница `::any/get` («a keyword, a string or a whole number») и страница отказа `::any/put/path` (any.qlang:2170, «a keyword, a string or a whole number») ограничивают ключ целым числом. Дерево читает и пишет дробный ключ по его тексту:

```qlang
> [::any/get ::any/put] | map ~(doc | content | contains "whole number")
[true false]

> get [~({:"1.5" 7} | get 1.5) ~({} | put 1.5 2)]
[7 {:"1.5" 2}]
```

Глава и дерево допускают любое число, страницы — только целое.

### design · QSPTH#words

Глава: «`toPath` reads a path from a vector of keys and places … an element that is no key as `::vec/toPath/ElementNotKeyError`». В QSPTH#key ключом названо «a keyword, a number or a string». Сегмент `1.5` строится из строки, а из числа — нет, хотя `get 1.5` читает тот же сегмент:

```qlang
> get [~({:"1.5" 7} | get 1.5) ~([:a 1.5] | toPath !| type) ~([:a "1.5"] | toPath)]
[7 ::vec/toPath/ElementNotKeyError /a/"1.5"]
```

Две дороги к одному сегменту расходятся: ключ одиночный и ключ внутри `toPath`. Вопрос: дробное число — это ключ своего текста везде или нигде?

### design · QSPTH#words

В QSCND#convert сказано: «a kind answering its own word as itself». В QSPTH#words `toPath` есть только у вектора и строки, и путь оказывается единственным видом, у которого нет своего `to`-слова:

```qlang
> get [~(/a | toPath !| type) ~([:a] | toPath | toPath !| type) ~([1] | toVec) ~(#[1] | toSet) ~({:a 1} | toMap) ~(:a | toKeyword)]
[::call/KindAnswersNoVerbError ::call/KindAnswersNoVerbError [1] #[1] {:a 1} :a]
```

Правило QSCND#convert не выполняется для `::path`. Вопрос: должен ли `/a | toPath` отвечать самим собой, как отвечают остальные виды?

### conflict · QSCOL#within

Глава: «it applies its code, a quote or a path». Страница `::tagged/within` говорит: «The code is a quote». Дерево принимает путь:

```qlang
> ::tagged/within | doc | content | contains "The code is a quote"
true

> ::Box{:a {:b 1}} | within /a
::Box{:b 1}
```

Страница сужает вход по сравнению с главой и деревом.

### design · QSCOL#algebra

На один вопрос — объединить множество с map — три дороги дают разные отказы. Глава описывает две из них по отдельности: «a set beside a map as a pair the algebra has no rule for, `KindsMismatchedError`» и «a value of another kind is refused under the input»:

```qlang
> get [~([#[1] {:a 1}] | union !| type) ~(#[1] | union {:a 1} !| type) ~(5 | unionOf #[1] {:a 1} !| type)]
[::vec/union/KindsMismatchedError ::set/union/other/KindNotTakenError ::set/union/other/KindNotTakenError]
```

Свёртка вектора называет пару видов, а вызов с входом и `unionOf` называют отказ входа. Вопрос: какой отказ должна давать согласованная алгебра для пары «множество и map», если пара задана любым из трёх способов?

### text · QSPTH#value

Парсер, страница `::path` («The value itself is `it`, never a path») и страница `::vec/toPath` («A path names one segment at least») держат правило, что путь содержит хотя бы один сегмент, а одиночный `/` отказывается. Глава этого правила не формулирует, и кейса для него нет:

```qlang
> "[1] | get /" | parse !| get /message
the slash alone names no path: the value itself is `it`
```

Правило существует в грамматике и на страницах, но в QSPTH#value его нет.

### case · QSPTH#template

template.jsonl:14 `query-of-a-path-hands-the-value-as-the-key`, `{:email {:home "a@b"}} | query (get /email) !| get /actualValue`. Отказа здесь нет, шаг `!|` ничего не делает, и ожидаемый ответ — просто шаблон, возвращённый как есть:

```qlang
> get [~({:email {:home "a@b"}} | query (get /email) !| get /actualValue) ~({:email {:home "a@b"}} | query (get /email))]
[{:home "a@b"} {:home "a@b"}]
```

Кейс показывает правило QSPTH#key («any other value … is a template and answers as it is»), а не правило, которое называет его имя.

### case · QSPTH#template

template.jsonl:15–16 `map-passes-a-failed-element-by-code-of-one-value` / `…-of-one-quote`, `get [1 ~("x" | add 1)] | map ~(0)`. До `map` дело не доходит: отказ даёт сам шаблон.

```qlang
> get [1 ~("x" | add 1)] !| type
::number/add/SubjectNotNumberError
```

Кейсы показывают правило QSPTH#template «A part that answers a failure is the answer of the template» (и QSERR#flow), а их имена описывают поведение `map`.

### case · QSPTH#words, QSPTH#has, QSPTH#value

Ни один кейс не держит `::vec/toPath/EmptyError`, `::string/toPath/NotPointerError`, `#[]` у `paths` для атома, чтение пути через `has` на векторе и множестве, `::map/has/key/KindNotTakenError`, а также `/"0"`, равный `/0`:

```qlang
> get [~([] | toPath !| type) ~("a" | toPath !| type) ~(5 | paths) ~([1 [2]] | has /1/0) ~({:a 1} | has [1] !| type) ~(/"0" | eq /0)]
[::vec/toPath/EmptyError ::string/toPath/NotPointerError #[] true ::map/has/key/KindNotTakenError true]
```

### case · QSNUM#arithmetic, QSNUM#combine

Ни один кейс не держит `::number/mod/divisor/ZeroError`, оба отказа `range`, сохранение тегов субъекта, отрицательное число разрядов `15 | round -1`, отказ `::any/sumOf/numbers/EmptyError` и правило «два» для `subOf`/`divOf`:

```qlang
> get [~(7 | mod 0 !| type) ~(2.5 | range !| type) ~(1e10 | range !| type) ~(::W#2.7 | floor) ~(15 | round -1)]
[::number/mod/divisor/ZeroError ::number/range/CountNotIntegerError ::number/range/CountTooLargeError ::W#2 20]

> get [~({:a 1} | sumOf !| type) ~({:a 1} | subOf /a 1 1 !| type)]
[::any/sumOf/numbers/EmptyError ::any/subOf/ArgsBeyondInputsError]
```

### case · QSCOL#reduce, QSCOL#algebra, QSCOL#within, QSCOL#sequence

Ни один кейс не держит следующие правила:
- `reduce`: `reducer/NotGivenError` и `reducer/KindNotTakenError`;
- `within`: `SubjectNotTaggedError`;
- `zip`: отказ элемента, который не вектор, по индексу;
- `unionOf`: `EmptyError` и теги первой части;
- `minus` на map: одиночный ключ.

```qlang
> get [~([1] | reduce 0 !| type) ~([1] | reduce 0 (add 1) !| type)]
[::vec/reduce/reducer/NotGivenError ::vec/reduce/reducer/KindNotTakenError]

> get [~(5 | within ~(add 1) !| type) ~([[1] 2] | zip !| get [~(type) /index]) ~({} | unionOf !| type) ~(5 | unionOf ::T{:a 1} {:b 2}) ~({:a 1} | minus :a !| type)]
[::tagged/within/SubjectNotTaggedError [::vec/zip/ElementNotVecError 1] ::any/unionOf/parts/EmptyError ::T{:a 1 :b 2} ::map/minus/keys/KindNotTakenError]
```
