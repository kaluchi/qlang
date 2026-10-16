> A check of the chapters `QSPTH`, `QSNUM`, `QSCOL` for D323 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `c0ee20a9`, itself the baseline; run 2026-10-15, 11:10–11:22 UTC. A path it names reads as `git show c0ee20a9:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qlang`, `grep` and `git ls-files` allowed, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.

### implementation · QSCOL#reduce

«A quote of one word is the short form: the fold calls the word as the pipe calls it… Any other code runs on the pair». В QSQUO#literal: «Two quotes are equal when their steps are». Цитата `~(| add)` равна `~(add)` и печатается так же, но свёртка обрабатывает её как код над парой:

```qlang
> ~(| add) | get [~(eq ~(add)) ~(print)]
[true "~(add)"]

> [1 2 3] | reduce 0 ~(add)
6

> [1 2 3] | reduce 0 ~(| add) !| type
::number/add/SubjectNotNumberError
```

Короткую форму `reduce` выбирает по форме дерева разбора (`resolveBinaryReducer`, `core/src/eval.mjs:1125`, проверяет `astNode?.type !== 'Call'`), а не по шагам цитаты. Поэтому два равных значения сворачиваются по-разному. Что ответило бы согласованное поведение: короткая форма для всех цитат, чьи шаги — одно слово, или никакой короткой формы для значения, которое печатается как `~(add)`?

### design · QSNUM#combine

«each object a number or a path read against the subject». В QSERR#site: «The refusal of an input's value lives under the input». Одно и то же нечисло, переданное значением или путём, отказывается в разных местах. Значение, прочитанное по пути, вообще не сверяется с видами входа: отказ даёт внутреннее слово рецепта, под адресом другой роли.

```qlang
> {:x "a"} | get [~(sumOf /x !| get [~(type) /index]) ~(sumOf (get /x) !| get [~(type) /index]) ~(mulOf /x !| type) ~(mulOf (get /x) !| type) ~(subOf /x 1 !| type) ~(subOf (get /x) 1 !| type) ~(divOf /x 1 !| type)]
[[::vec/sum/ElementNotNumberError 0] [::any/sumOf/numbers/ElementKindNotTakenError 0] ::number/mul/multiplier/KindNotTakenError ::any/mulOf/factors/ElementKindNotTakenError ::number/sub/SubjectNotNumberError ::any/subOf/minuend/KindNotTakenError ::number/div/SubjectNotNumberError]

> {:a 1} | get [~(unionOf 5) ~(unionOf "x") ~(unionOf 5 6 !| type) ~(unionOf [1] [2] !| type) ~(unionOf /a !| type)]
[5 "x" ::call/KindAnswersNoVerbError ::vec/union/ArgsBeyondInputsError 1]
```

У `mulOf /x` уменьшаемое отказано как множитель `mul`, у `subOf /x` — как субъект `sub`. `unionOf` с одной частью отвечает числом, хотя глава говорит «unites the maps or the sets». Текущий ответ закреплён кейсом `core/test/conformance/QSERR/site.jsonl:27` `each-value-the-call-gives-is-refused-with-its-index` (`::vec/sum/ElementNotNumberError`). Получается, что значение, вычисленное при вызове, и путь отвечают на один вопрос по-разному. Что ответило бы согласованное поведение: должно ли значение, прочитанное по пути, сверяться с видами входа и отказываться под ним?

### implementation · QSPTH#query

«`query` reads a path as `get` does and answers `null` where … `null` stands on the path». В QSPTH#get: «A path reads beneath the tags over each value it meets». Кейс `query-answers-null-through-null` это закрепляет. Null под тегом `query` не пропускает, хотя карту под тегом читает:

```qlang
> {:a null} | query /a/b
null

> {:a ::T{:b 1}} | query /a/b
1

> {:a ::T#null} | query /a/b !| type
::path/SubjectHasNoPartsError
```

`readPath` (`core/src/path-read.mjs:50`) проверяет `current === null` до `beneathTags`. Что ответило бы согласованное поведение: null для пути через null под тегом, раз путь читает под тегами любого встреченного значения?

### design · QSPTH#key

«A key alone is the path of one segment where `get`, `query` and the words that write take a path… any other value given to `get` or `query` is a template». Ключ под тегом (по QSDSP#walk «a tag over a value passes to the words of its payload») слова читают двумя разными дорогами:

```qlang
> {:a 1} | get [~(get ::K:a) ~(has ::K:a) ~(put ::K:a 2) ~(delete ::K:a !| type) ~(put ::N#0 5) ~(has ::S"a")]
[::K:a true {:a 2} {} {:a 1 :"0" 5} true]

> {:a 1} | query ::K:a
::K:a
```

`get` и `query` отвечают ключом под тегом как шаблоном, без чтения. `has`, `put` и `delete` читают ключ под тегом как ключ. Что ответило бы согласованное поведение для одного и того же значения в роли пути?

### design · QSPTH#key

«Every place that takes a key of a map reads a string so: `minus` and `inter` on a map take … each a keyword or a string». В QSPTH#has: «a number naming the key of its text». Страница `::map/minus` говорит «each a keyword or a string, as `get` reads a key». При этом `get` читает и число:

```qlang
> {:"1" 5} | get [~(has 1) ~(get 1) ~(query 1) ~(put 1 6) ~(delete 1)]
[true 5 5 {:"1" 6} {}]

> {:"1" 5} | minus [1] !| type
::map/minus/KeyNotKeywordOrStringError

> {:"1" 5} | inter #[1] !| type
::map/inter/KeyNotKeywordOrStringError
```

`toMap` тоже принимает число как ключ: кейс `QSCND/convert` `toMap-builds-a-map-from-pairs` даёт `:"3"`. Выходит, ключ карты, записанный числом, одни слова берут, а другие отвергают. Что ответило бы согласованное поведение?

### design · QSCOL#group

«a string or a number under the keyword of its text». В QSCND#convert: «`toKeyword` files a value as `groupBy` files a key». В `core/src/runtime/vec.mjs:262`: «the one `toKeyword` turns it into». Страница `::vec/toMap/KeyNotKeywordError`: «The key of a pair is a value `toKeyword` names».

```qlang
> [~(::W#1 | toKeyword) ~(::S"a" | toKeyword) ~([::W#1] | groupBy !| type) ~([::S"a"] | indexBy !| type) ~([[::W#1 2]] | toMap !| type)] | map ~(apply it)
[:"1" :a ::vec/groupBy/KeyNotKeywordError ::vec/indexBy/KeyNotKeywordError ::vec/toMap/KeyNotKeywordError]
```

Число и строку под тегом `toKeyword` раскладывает, а `groupBy`, `indexBy` и `toMap` отвергают, хотя по тексту ключ раскладывается одинаково на всех трёх дорогах. QSCOL#sequence при этом читает «a number beneath the tags over an element» для `sum`. Что ответило бы согласованное поведение?

### design · QSCOL#sequence

«A vector and a set answer … `zip` reads vectors side by side». В QSDSP#residence: «a set, a quote and a doc are vectors to a word of vectors, each answered back as its own kind». В QSORD#set: «a vector where it answers an order of its own … or the images of the elements». У множества нет своего `zip`, поэтому ответ слова вектора возвращается множеством и теряет кортежи:

```qlang
> [[1 1] [2 2]] | zip
[[1 2] [1 2]]

> #[[1 1] [2 2]] | zip
#[[1 2]]

> ::set | manifest | has ::set/zip
true
```

Последняя проба ответила `false` (ответ записан неверно; следует читать `false`): своего `zip` у `::set` нет. По правилам, взятым вместе, «side by side» над множеством отвечает множеством кортежей, и кортеж на один индекс пропадает. Что ответило бы согласованное поведение: вектор, как у `map` и `reverse`, или множество?

### design · QSPTH#query

«Its second input is a default, answered as it is where the path misses». В QSCND#coalesce: «An alternative is code, a quote or a path, which runs against the subject». У двух дорог к значению по умолчанию один вопрос и разные ответы:

```qlang
> {:a 1} | get [~(query /b /a) ~(coalesce /b /a) ~(query /b ~(get /a)) ~(coalesce /b ~(get /a))]
[/a 1 ~(get /a) 1]
```

Значение по умолчанию у `query` держит путь и цитату как данные, а `coalesce` их выполняет. Что ответило бы согласованное поведение?

### text · QSPTH#code

«The inputs of `get`, `query` and `has` … take a path and read it». QSPTH#query говорит, что второй вход `query` «answered as it is», и дерево берёт путь как значение:

```qlang
> {:a 1} | query /b /a
/a
```

Фраза о «the inputs of `query`» противоречит QSPTH#query для входа `default`: тот относится к входам, которые «take the path as the value it is».

### design · QSCOL#reduce

«A quote of one word is the short form… Any other code runs on the pair». В остальном языке `~(add 1)` и `~(it | add 1)` значат одно и то же, а в свёртке — разное:

```qlang
> 5 | get [~(apply ~(add 1)) ~(apply ~(it | add 1))]
[6 6]

> [1 2 3] | get [~(reduce 0 ~(add)) ~(reduce 0 ~(it | add) !| type)]
[6 ::number/add/SubjectNotNumberError]
```

QSQUO#held говорит «the meaning of held code is its text and the vocabulary», но смысл редьюсера задаёт форма цитаты: одно слово или несколько шагов. Что ответило бы согласованное поведение?

### design · QSPTH#key

«A key alone is the path of one segment… any other value given to `get` or `query` is a template». В QSPTH#template: «any other value of it as it is». Один и тот же ключ на верхнем уровне читается, а в шаблоне остаётся собой. Вычисленный вектор ключей тоже не читается:

```qlang
> [10 20] | get 1
20

> [10 20] | get [1]
[1]

> {:ks ["a" "b"] :a 1 :b 2} | get (get /ks)
["a" "b"]

> {:ks ["a" "b"] :a 1 :b 2} | get (get /ks | first)
1
```

Получается, что значение, вычисленное при вызове, и тот же ключ внутри шаблона отвечают по-разному. Что ответило бы согласованное поведение?

### design · QSPTH#has

«`has` on a map takes a key… On a vector and a set `has` asks whether an element equal to the value stands». В QSCOL#map: «Its elements are its values». В QSDSP#walk: «A word means one act wherever it resolves».

```qlang
> {:a 1} | get [~(has 1) ~(vals | has 1)]
[false true]
```

У вектора `has` спрашивает об элементе, у карты — о ключе, хотя элементы карты — её значения. Что ответило бы согласованное поведение?

### case · QSCND#convert

«a kind answering its own word as itself». Каждый вид со словом `to…` отвечает им собой. Исключение — путь: его `toPath` (QSPTH#words) дерево отвергает, и ни один кейс правила для `::path` не держит.

```qlang
> [~([1] | toVec) ~(#[1] | toSet) ~({:a 1} | toMap) ~(:a | toKeyword) ~("s" | toString) ~(5 | toNumber) ~(::x | toTag) ~(#"a" | toRegex)] | map ~(apply it !| type)
[[1] #[1] {:a 1} :a "s" 5 ::x #"a"]

> /a | toPath !| type
::call/KindAnswersNoVerbError
```

Правило главы не держит ни один кейс, а дерево для `::path` ему не следует.

### case · QSNUM#arithmetic

«A subject that is no number is refused as `::number/add/SubjectNotNumberError` and an object as `::number/add/addend/KindNotTakenError`», «a fraction refused as `::number/round/digits/NotIntegerError`», «`[]` from zero and below». В `QSNUM/arithmetic.jsonl` нет ни одного из этих кейсов. Отказ по долям у `round` держит только QSERR#site, отказ входа — QSERR, QSBLD и другие. Для отрицательного счёта `range` кейса нет совсем:

```sh
$ grep -rlF 'round/digits/NotIntegerError' core/test/conformance
core/test/conformance/QSERR/site.jsonl
$ grep -rlF 'add/addend/KindNotTakenError' core/test/conformance
core/test/conformance/QSBLD/answer.jsonl
core/test/conformance/QSBLD/input.jsonl
core/test/conformance/QSERR/flow.jsonl
core/test/conformance/QSERR/site.jsonl
core/test/conformance/QSPTH/template.jsonl
core/test/conformance/QSSLF/manifest.jsonl
```

Правила секции держат кейсы чужих секций, а в её собственном файле таких кейсов нет.

### case · QSCOL#filter

«a map keeping its keys and a set its kind; a predicate that answers no boolean is refused at its index, a map's at its key, and one that answers a failure hands it on». В `QSCOL/filter.jsonl` нет ни множества, ни отказа по ключу карты, ни переданного провала. Отказ по ключу лежит в QSERR#site:

```sh
$ grep -cF '#[' core/test/conformance/QSCOL/filter.jsonl
0
$ grep -rlF 'filter-over-a-map-names-the-entry-that-refused' core/test/conformance
core/test/conformance/QSERR/site.jsonl
```

Три правила секции в её собственном файле кейсами не закреплены.

### case · QSCOL#sequence

«a fraction refused as `::vec/take/count/NotIntegerError` and a value of another kind as `…/count/KindNotTakenError`». Кейсы этого правила стоят только в QSERR#site и QSDSP#residence:

```sh
$ grep -rlF 'take/count/NotIntegerError' core/test/conformance
core/test/conformance/QSERR/site.jsonl
```

Правило секции держат кейсы других секций, а не её файл.

### case · QSPTH#query

`core/test/conformance/QSPTH/query.jsonl:28` `{"name":"an-index-of-a-vector-is-refused-by-its-input","query":"[1 2] | query /a !| type","expect":"::path/IndexNotIntegerError"}`. Имя кейса говорит об отказе входа, но отказ идёт от чтения пути, под `::path`:

```qlang
> [1 2] | query /a !| type
::path/IndexNotIntegerError
```

Имя кейса называет правило («refused by its input»), которое его ответ не показывает. Ответ показывает правило QSPTH#query «refuses as `get` does».
