> A check of the chapters `QSPTH`, `QSNUM`, `QSCOL` for D319 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `c91769c4`, itself the baseline; run 2026-10-15, 09:34–09:54 UTC. A path it names reads as `git show c91769c4:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qlang`, `grep` and `git ls-files` allowed, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.

### implementation · QSPTH#query

«`query` reads a path as `get` does and answers `null` where … `null` stands on the path» и в QSPTH#get: «A path reads beneath the tags over each value it meets». Под тегом map читается мягко, а null под тегом вызывает отказ, как будто у значения нет частей:

```qlang
> get [~({:a null} | query /a/b) ~({:a ::T{}} | query /a/b) ~({:a ::T#null} | query /a/b !| type) ~(::T#null | query /a !| type)]
[null null ::path/SubjectHasNoPartsError ::path/SubjectHasNoPartsError]
```

Глава читает путь сквозь теги и для null на пути велит отвечать null, а дерево отказывает, если null стоит под тегом. В `readPath` (`core/src/path-read.mjs:50`) проверяется `current === null` до снятия тегов. Вопрос: что должен ответить `query` на null под тегом, чтобы оба правила раздела выполнялись вместе?

### design · QSNUM#combine

«each object a number or a path read against the subject». На один и тот же вопрос «это значение не число» значение, вычисленное при вызове, и путь отвечают отказами разных мест:

```qlang
> {:a "x" :b 1} | get [~(sumOf "x" 1 !| type) ~(sumOf /a 1 !| type) ~(subOf "x" 1 !| type) ~(subOf /a /b !| type)]
[::any/sumOf/numbers/ElementKindNotTakenError ::vec/sum/ElementNotNumberError ::any/subOf/minuend/KindNotTakenError ::number/sub/SubjectNotNumberError]
```

Значение отказывается под входом слова, а путь под словом рецепта (`impl ~(get numbers | sum)`), и это поведение закреплено кейсом `QSCOL/reduce.jsonl:19`. Вопрос: под каким адресом согласованно отказывать в нечисле, которое прочитал путь?

### design · QSPTH#has

«`has` on a map takes a key as `get` takes one … On a vector and a set `has` asks whether an element equal to the value stands». Один и тот же ключ `0` для `get` всегда означает место или ключ, а для `has` на map означает ключ, на векторе же — элемент:

```qlang
> [5 6] | get [~(get 0) ~(has 0) ~(has /0)]
[5 false true]

> {:"0" 5} | get [~(get 0) ~(has 0) ~(has /0)]
[5 true true]
```

Два пути отвечают на один вопрос «читает ли `get` здесь часть» по-разному в зависимости от вида субъекта. Вопрос: чем должен быть ключ (не путь), отданный `has`, чтобы `has k` отвечал так же, как `get k`?

### design · QSPTH#key

«Every place that takes a key of a map reads a string so: `minus` and `inter` … each a keyword or a string». В QSPTH#has сказано, что число называет «the key of its text». Страница `::map/minus` говорит «each a keyword or a string, as `get` reads a key», но `get` читает и число:

```qlang
> {:"1" 5 :b 2} | get [~(has 1) ~(get 1) ~(put 1 9) ~(delete 1) ~(minus [1] !| type) ~(inter #[1] !| type)]
[true 5 {:"1" 9 :b 2} {:b 2} ::map/minus/KeyNotKeywordOrStringError ::map/inter/KeyNotKeywordOrStringError]

> [[1 5]] | toMap
{:"1" 5}
```

`has`, `get`, `put`, `delete` и `toMap` принимают число как ключ, а `minus` и `inter` его отвергают. Вопрос: какой набор видов должен называть ключ map во всех местах, где ключ принимается?

### design · QSCOL#algebra

«`unionOf` unites the maps or the sets its call computes … one part answers itself». У входа `parts` нет видов. Одна часть любого вида возвращается как есть, две нечасти дают отказ чужого слова, а quote исполняется. Векторная свёртка и `sumOf` на те же вопросы отвечают иначе:

```qlang
> {:a 7 :b 8 :m {:x 1}} | get [~(unionOf /a) ~(unionOf /a /b !| type) ~([7] | union !| type) ~(unionOf ~(get /m)) ~(sumOf ~(get /a) !| type)]
[7 ::call/KindAnswersNoVerbError ::vec/union/ElementNotSetOrMapError {:x 1} ::any/sumOf/numbers/ElementKindNotTakenError]
```

Глава говорит «maps or sets», а дерево возвращает число и не проверяет вид ни под `::any/unionOf/parts`, ни для одной части. Вопрос: что должен ответить `unionOf` на часть, которая не map и не set, и на quote, если `sumOf` его отвергает?

### design · QSCOL#algebra

«A set of sets folds as the vector of its elements, its input left out … `{:a 1} | union` refused as `::map/union/other/NotGivenError`». Страница `::set/union` добавляет то, чего в главе нет: «The other value is a set, or null». Null, вычисленный при вызове, set читает как опущенный вход, а map отвергает:

```qlang
> get [~(#[#[1] #[2]] | union null) ~({:a 1} | union null !| type)]
[#[1 2] ::map/union/other/KindNotTakenError]
```

Получается, что значение null и опущенный вход у set — одно и то же, а у map — разное, и правило про null в главе не названо. Вопрос: что согласованно означает null на месте `other` для обоих видов?

### design · QSPTH#value

«JSON writes its literal as a string». В QSPTH#words: `toPath` читает строку «in the form of JSON Pointer». Путь, записанный через `json`, обратно через `toPath` не возвращается:

```qlang
> [/a/0 /"a b" /:a/b/:c] | map ~(:p it | json | parseJson | toPath | eq p)
[true false false]

> /"a b" | json | parseJson | toPath | segments
[:"\"a b\""]
```

У текста пути два кодека: JSON пишет литерал qlang, а `toPath` читает JSON Pointer. Вопрос: какой текст пути должен проходить через JSON туда и обратно?

### conflict · core/src/runtime/format.mjs:37

«A path writes its literal, JSON Pointer's form [QSPTH#value]». Глава называет это литералом. Литерал и JSON Pointer расходятся у сегмента в кавычках и у ключа со слешем:

```
$ grep -n "JSON Pointer" core/src/runtime/format.mjs
37:  // A path writes its literal, JSON Pointer's form [QSPTH#value].
```

```qlang
> /:a/b/:c | json | parseJson | toPath | segments
[:":a" :b :":c"]
```

Комментарий утверждает, что это одна форма, а по главе и по дереву это две разные формы.

### text · QSCOL#algebra

«`minus` and `inter` take after a map the keys a vector names … refused as the pair, `KindsMismatchedError` …, a set beside a map among them». Страница `::vec/minus` говорит: «a map loses the keys of the next, which is a map, a set or a vector of keys». В свёртке set после map читается как набор ключей:

```qlang
> [{:a 1 :b 2} #[:a]] | get [~(minus) ~(inter) ~(union !| get [~(type) /leftType /rightType])]
[{:b 2} {:a 1} [::vec/union/KindsMismatchedError ::map ::set]]
```

Глава называет ключи только вектора и перечисляет «a set beside a map» среди отвергаемых пар, а страница и дерево берут ключи set для `minus` и `inter`.

### text · QSPTH#key

«any other value given to `get` or `query` is a template and answers as it is [QSPTH#template]». Вычисленный шаблон, внутри которого есть путь, не отвечается «as it is», путь в нём читается:

```qlang
> {:a [/b] :b 2} | get [~(get (get /a)) ~(get /a)]
[[2] [/b]]
```

По QSPTH#template шаблон отвечает прочитанными путями, а фраза «answers as it is» говорит обратное.

### text · QSCOL#map

«The words a vector has beyond these, `distinct`, `groupBy`, `flat` and `contains` among them, a map answers by `vals` first». Сама map этих слов не знает, `vals` пишет читатель:

```qlang
> {:a 1} | distinct !| get [~(type) /addresses]
[::call/KindAnswersNoVerbError #[::set/distinct ::vec/distinct]]
```

Предложение говорит, что map отвечает на эти слова, а дерево и пример главы (`{:a 1} | vals | contains 1`) требуют, чтобы `vals` написал читатель.

### text · QSCOL#sequence

«`reverse`, the reverse of a set a vector and of a vector under a tag the vector under it». «The vector under it» читается как payload без тега. Страница `::vec/reverse` говорит «keeps the kind of the subject, a vector under a tag»:

```qlang
> ::Box[1 2] | reverse
::Box[2 1]
```

Фраза главы допускает чтение «без тега», а страница и дерево тег сохраняют.

### text · core/src/grammar.peggy:311

Код ссылается на QSPTH#value по правилам, которые формулирует другой раздел: отказ шагу-значению и doc после шага (QSSYN#step, QSSYN#doc), отказ значению после головы quote (QSQUO#step), членство через `has` (QSPTH#has):

```
$ grep -n "QSPTH#value" core/src/grammar.peggy core/src/runtime/quote-steps.mjs core/src/runtime/map.mjs
core/src/grammar.peggy:91:  // naming the word the habit meant [QSPTH#value].
core/src/grammar.peggy:311:// at the head or where a word takes it [QSPTH#value].
core/src/grammar.peggy:813:// A path, a value of its own [QSPTH#value]: a segment is a bare key, a quoted
core/src/runtime/quote-steps.mjs:29:// [QSPTH#value], is refused where it is made.
core/src/runtime/map.mjs:29:// held [QSPTH#value]; `contains` asks the membership alone.
```

В QSPTH#value нет ни doc, ни шага после головы, ни `has`. Цитаты в строках 91, 311, `quote-steps.mjs:29` и `map.mjs:29` указывают не на тот раздел, правило которого держит блок.

### case · QSCOL#sequence

`sum-overflow-lifts-not-finite` и `sum-overflow-holds-its-subject-on-the-trail` показывают правило QSNUM#arithmetic («one past the doubles is refused as `::number/NotFiniteError`») и QSERR#trail. У самого `sum` в QSCOL#sequence правила о переполнении нет:

```
$ grep -n "sum-overflow" core/test/conformance/QSCOL/sequence.jsonl
11:{"name":"sum-overflow-lifts-not-finite","query":"[1e308 1e308] | sum !| type","expect":
12:{"name":"sum-overflow-holds-its-subject-on-the-trail","query":"[1e308 1e308] | sum !| g
```

Кейсы лежат в файле раздела, правила которого они не показывают.

### case · QSPTH#template

«a kind whose field takes a number refuses a path written at that field» — ни один кейс раздела этого не держит, хотя дерево правило выполняет:

```
$ grep -c "reads :" core/test/conformance/QSPTH/template.jsonl
0
```

```qlang
> :Box |~~ B ~~| (::kind | reads :w |~~ w ~~| /w ::number) | {:w 1} | get [::Box{:w /w}] !| type
::Box/w/KindNotTakenError
```

У правила раздела нет кейса.

### case · QSPTH#code

«an input that takes any value, the value of `put`, `append`, `eq`, takes the path as the value it is» — в файле раздела кейса нет:

```
$ grep -cE "(append|put :?[a-z]+) /" core/test/conformance/QSPTH/code.jsonl
0
```

```qlang
> [1] | append /a
[1 /a]
```

У правила раздела нет кейса.

### case · QSPTH#get

«a vector, a set, a doc, a quote, a function and a kind read by place» — кейсы раздела показывают только вектор, set и doc:

```
$ grep -cE '"query":"(::fn|::kind|~\()' core/test/conformance/QSPTH/get.jsonl
0
```

```qlang
> ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by)] | get /0
~(takes :by |~~ How much. ~~| /0)
```

У чтения по месту для quote, функции и kind нет кейса.

### case · QSCOL#within

«it applies its code, a quote or a path» — кейса с путём нет:

```
$ grep -c "within /" core/test/conformance/QSCOL/within.jsonl
0
```

```qlang
> ::Box{:a 1} | within /a
::Box#1
```

У правила раздела нет кейса.

### case · QSNUM#combine

«`subOf` and `divOf` two» — кейсы держат только лишние объекты (`subOf-takes-two-values`). Нехватку не держит ни один:

```
$ grep -nE '"query":"[^"]*(subOf|divOf)' core/test/conformance/QSNUM/combine.jsonl | cut -c1-60
2:{"name":"subOf-subtracts-the-second-field-from-the-first",
4:{"name":"divOf-divides-the-first-field-by-the-second","que
11:{"name":"subOf-takes-two-values","query":"{:a 1} | subOf
```

```qlang
> {:a 1} | subOf /a !| type
::any/subOf/subtrahend/NotGivenError
```

У отказа при одном объекте или без объектов нет кейса.

### case · QSNUM#combine

В одном файле два кейса с одинаковым запросом и одинаковым ответом:

```
$ grep -n "mulOf /price /qty" core/test/conformance/QSNUM/combine.jsonl | cut -c1-80
6:{"name":"mulOf-multiplies-the-args-it-is-given","query":"{:price 4 :qty 3} | m
12:{"name":"a-word-that-combines-reads-each-value-from-its-args","query":"{:pric
```

У двух имён одно требование.
