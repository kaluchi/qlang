<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 985a4b82 and checking docs/spec/QSPTH-paths.md, docs/spec/QSNUM-numbers.md and docs/spec/QSCOL-collections.md, on 2026-10-15 from 08:05 to 08:22 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 985a4b82. -->

### design · QSNUM#combine

«each object a number or a path read against the subject». Если объект — строка, записанная в вызове, отказ приходит от самого слова. Если та же строка прочитана по пути, отказ приходит из шагов рецепта, под адресом слова, которого читатель не писал:

```qlang
> {:x "1" :y 2} | get [~(sumOf "1" /y !| type) ~(sumOf /x /y !| type) ~(subOf /x /y !| type) ~(mulOf /x /y !| type) ~(divOf /y 0 !| type)]
[::any/sumOf/numbers/ElementKindNotTakenError ::vec/sum/ElementNotNumberError ::number/sub/SubjectNotNumberError ::number/mul/multiplier/KindNotTakenError ::number/div/divisor/ZeroError]

> {:x "1" :y 2} | subOf /x /y !| get /trail | map /step
[~(sub (pair | last)) ~(subOf /x /y)]
```

Значение и путь — два пути к одному вопросу («это не число»), и отвечают они по-разному. В трейле при этом стоит внутренний шаг рецепта `~(sub (pair | last))`. Это расходится с [QSERR#site] («The refusal of an input's value lives under the input»). Вопрос: под каким адресом согласованное поведение отказывает в нечисловом значении, прочитанном по пути, — под входом `numbers`/`minuend`/`divisor` слова `…Of` или под словом рецепта?

### design · QSCOL#algebra

«`unionOf` unites the maps or the sets its call computes». Вход `parts` не объявляет видов, а рецепт читает его как шаблон `get`. Поэтому цитата в части выполняется, число отвечает само собой, а пара чисел отказывает под `union`. `sumOf` ту же цитату отвергает:

```qlang
> {:a {:x 1}} | get [~(unionOf ~(get /a)) ~(sumOf ~(get /a/x) !| type)]
[{:x 1} ::any/sumOf/numbers/ElementKindNotTakenError]

> 5 | get [~(unionOf 3) ~(unionOf 3 4 !| get [~(type) /name])]
[3 [::call/KindAnswersNoVerbError :union]]
```

То, что `unionOf` выполняет цитату, держит кейс `QSQUO/held.jsonl:29` («a-word-that-reads-its-args-whole-runs-the-readers-quote-in-its-step»). Ни QSCOL#algebra, ни QSPTH#code, где `unionOf` назван среди входов, которые «take a path and read it», этого не говорят. Вопрос: что должны принимать части слов, комбинирующих значения одного субъекта, — одинаковый набор видов (значение, путь, цитата?) и одинаковую дорогу отказа?

### design · QSPTH#code

«takes a path as the code that reads it from each value it runs on, as `get` reads it». Путь и его цитата `~(get /n)` ломаются по-разному. С цитатой трейл держит элемент, на котором чтение промахнулось. С путём не остаётся ни элемента, ни его индекса. `:actualType ::map` не совпадает с субъектом первой остановки (вектором), и всё же `:actualValue` опущен, хотя [QSERR#site] опускает его только «where it equals the subject the first stop holds»:

```qlang
> [{:n 1} {:m 2}] | map ~(get /n) !| get [~(trail | map /subject) ~(has :actualValue)]
[[{:m 2} [{:n 1} {:m 2}]] false]

> [{:n 1} {:m 2}] | map /n !| get [~(trail | map /subject) ~(has :actualValue) /actualType]
[[[{:n 1} {:m 2}]] false ::map]
```

Вопрос: должен ли отказ кода-пути держать прочитанный элемент так же, как его держит цитата `get`?

### design · QSCOL#algebra

«A fold takes a set or a map first, a value of another kind refused at its index». Карта под тегом в свёртке принимается, множество под тегом отвергается. Та же развилка есть у `flat` и `zip`. Страница `::vec/flat` при этом говорит «An element that is a vector splices its elements whatever tag it stands under, so a set … splice too», а страница `::vec/zip` — «Each element is a vector, a set …»:

```qlang
> [::T{:a 1} {:b 2}] | union
{:a 1 :b 2}

> [::T#[1] #[2]] | union !| get [~(type) /index]
[::vec/union/ElementNotSetOrMapError 0]

> [::T[1 2] [3]] | flat
[1 2 3]

> [::T#[1 2] [3]] | flat
[::T#[1 2] 3]

> [::T#[1 2] [3]] | zip !| get [~(type) /index]
[::vec/zip/ElementNotVecError 0]
```

Значение под тегом в субъекте доходит до слов своего вида: `::Box#[1 2] | union #[3]` отвечает `::Box#[1 2 3]` (кейс `a-tag-over-a-set-comes-back-on-union`). Элемент под тегом при этом читается по-разному в зависимости от того, лежит ли под тегом вектор, карта или множество. Вопрос: что согласованное поведение отвечает для элемента под тегом — проход к виду под тегами (как у субъекта) или отказ для любого тега?

### design · QSCOL#sequence

«`zip` reads vectors side by side». У множества векторов ответ — множество, и два равных столбца сливаются: пропадает строка, которую `zip` вектора даёт.

```qlang
> #[[1 1] [2 2]] | zip
#[[1 2]]

> [[1 1] [2 2]] | zip
[[1 2] [1 2]]
```

Правило [QSDSP#residence] («each answered back as its own kind») и правило [QSORD#set] («a vector where it answers … the images of the elements») вместе дают для `zip` ответ, теряющий данные. Вопрос: какого вида должен быть ответ `zip` над множеством?

### design · QSPTH#key

«Every place that takes a key of a map reads a string so: `minus` and `inter` … each a keyword or a string». QSPTH#has при этом говорит «a number naming the key of its text». Одно и то же число называет ключ для `get`, `has`, `put`, `delete`, но не для `minus` и `inter`:

```qlang
> {:"1" 5 :b 2} | get [~(has 1) ~(get 1) ~(put 1 9) ~(delete 1) ~(minus [1] !| type) ~(inter #[1] !| type)]
[true 5 {:"1" 9 :b 2} {:b 2} ::map/minus/KeyNotKeywordOrStringError ::map/inter/KeyNotKeywordOrStringError]
```

Вопрос: называет ли число ключ карты во всех местах, которые берут ключ, или ни в одном?

### design · QSPTH#has

«On a vector and a set `has` asks whether an element equal to the value stands, and reads a path». Число в `has` над вектором — элемент, в `get` над тем же вектором — место, а в `has` над картой — ключ:

```qlang
> [5 6] | get [~(has 0) ~(has /0) ~(get 0)]
[false true 5]

> {:"0" 5} | get [~(has 0) ~(has /0) ~(get 0)]
[true true 5]
```

Вопрос: должен ли ключ-одиночка (число, строка, ключевое слово) в `has` читаться как путь одного сегмента, как в `get` и `query` ([QSPTH#key]), или как элемент, как сейчас у вектора и множества?

### design · QSCOL#group

«two values that file under one keyword meet, the second refused as `KeyTakenError`». `toMap`, которое по [QSCND#convert] раскладывает ключ «as `groupBy` files a key», та же встреча не останавливает: последняя пара молча побеждает.

```qlang
> [[1 :a] ["1" :b]] | toMap
{:"1" :b}

> [[1 :a] ["1" :b]] | indexBy /0 !| get [~(type) /key /taken /index]
[::vec/indexBy/KeyTakenError :"1" 1 1]
```

Блок `core/src/runtime/convert.mjs:98-100` выводит правило «the last holds» для `toMap` из [QSCOL#map], хотя QSCOL#map о `toMap` ничего не говорит. Вопрос: встречаются ли `1` и `"1"` при построении карты из пар так же, как при `indexBy`?

### design · QSCOL#algebra

«A set of sets folds as the vector of its elements, its input left out». Явный `null` во входе тоже запускает свёртку (страница `::set/union`: «The other value is a set, or null»). Поэтому вычисленный `other`, оказавшийся `null`, меняет смысл вызова с объединения элементов на свёртку:

```qlang
> #[#[1] #[2]] | union null
#[1 2]

> #[#[1] #[2]] | union #[]
#[#[1] #[2]]
```

У карты то же отсутствие входа отвергается (`{:a 1} | union` → `::map/union/other/NotGivenError`). Вопрос: должен ли пропуск входа и `null`, данный значением, отвечать одинаково, и одинаково ли для `::set` и `::map`?

### design · QSPTH#query

«Its second input is a default, answered as it is where the path misses». Путь, данный как умолчание, не читается, а у `coalesce` тот же путь читается. QSCND#coalesce ставит эти две дороги рядом («`query /timeout | coalesce 30`»):

```qlang
> {:b 2} | get [~(query /a /b) ~(coalesce /a /b)]
[/b 2]
```

Вопрос: читается ли путь в умолчании `query` так же, как в альтернативе `coalesce`?

### design · QSPTH#key

«A key alone is the path of one segment … any other value given to `get` or `query` is a template». Тот же ключ внутри шаблона — литерал:

```qlang
> {:a 1 :b 2} | get [~(get :a) ~(get [:a :b]) ~(get #[:a]) ~(get {:x :a})]
[1 [:a :b] #[:a] {:x :a}]
```

Вопрос: должен ли ключ в позиции части шаблона читаться так же, как ключ, данный `get` одиночкой?

### text · QSCOL#algebra

«The words of sets and of maps answer under the subject's tags». Свёртка множества карт оставляет тег позади, свёртка множества множеств — нет. Это правило [QSDSP#answer] для ответа другого вида, а предложение главы его не оговаривает:

```qlang
> ::T#[#[1] #[2]] | union
::T#[1 2]

> ::T#[{:a 1} {:b 2}] | union
{:a 1 :b 2}
```

Предложение главы расходится со страницей `::set/union` (returns `#[::map ::set]`) и с [QSDSP#answer].

### conflict · QSPTH#has

Глава: «`has` on a map takes a key as `get` takes one, a keyword, a string, a number or a path». Проза страницы `::map/has` перечисляет «the key the call gives, a keyword, a string or a number» и пути не называет. Вход `::map/has/key` той же страницы называет путь:

```qlang
> ::map/has | get [~(doc | content | contains "path") ~(::map/has/key | doc | content | contains "path")]
[false true]

> {:a {:b 1}} | has /a/b
true
```

Проза страницы расходится с главой и со своим собственным входом.

### case · QSPTH#words, QSPTH#key, QSCOL#algebra

Дерево держит правила этих разделов, но ни один кейс их не держит:
- QSPTH#words: `::vec/toPath/ElementNotKeyError`, «a leading `#` of a fragment».
- QSPTH#key: `::map/inter/keys/KindNotTakenError`, `::map/inter/KeyNotKeywordOrStringError`.
- QSCOL#algebra: `::map/union/other/KindNotTakenError`, `KindsMismatchedError` с `:leftType` и `:rightType`.

```qlang
> get [~([:a 1.5] | toPath !| type) ~("#/a" | toPath) ~({:a 1} | inter :a !| type) ~({:a 1} | inter [1] !| type) ~({:a 1} | union [1] !| type) ~([#[1] {:a 1}] | union !| get [~(type) /leftType /rightType])]
[::vec/toPath/ElementNotKeyError /a ::map/inter/keys/KindNotTakenError ::map/inter/KeyNotKeywordOrStringError ::map/union/other/KindNotTakenError [::vec/union/KindsMismatchedError ::set ::map]]
```

```sh
$ grep -rhoE 'toPath/ElementNotKeyError|toPath \\"#|map/inter/keys/KindNotTakenError|map/inter/KeyNotKeywordOrStringError|map/union/other/KindNotTakenError|KindsMismatchedError' D:/git/qlang/core/test/conformance | wc -l
0
```

Правила, которые глава называет по имени, не держит ни один кейс.

### case · QSCOL#group

«its `:key` the keyword, `:taken` the value that filed under it first and `:index` the element that met it». Кейсы `group.jsonl:14` и `:16` читают `:key` и `:taken`, а `:index` у `KeyTakenError` не показывает ни один кейс:

```qlang
> [:x ::x] | groupBy !| get [~(type) /key /taken /index]
[::vec/groupBy/KeyTakenError :x :x 1]
```

Факт `:index`, названный в главе, ни один кейс не держит.

### case · QSCOL#each

`each.jsonl:12` «map-runs-in-the-scope-of-the-call», `:k 10 | [1 2] | map ~(add k)` → `[11 12]`, показывает правило [QSQUO#held] («the call runs it in the scope of the step that wrote it»). QSCOL#each о scope не говорит, а тот же запрос — первая проба QSQUO#held:

```qlang
> :k 10 | [1 2] | map ~(add k)
[11 12]
```

Кейс стоит не в том разделе, чьё правило он показывает.

### case · QSPTH#query

`query.jsonl:26` «query-under-a-tag-answers-null-for-a-missing-key», запрос `::json{:a 1} | query /42 !| type`, ожидание `null`. Шаг `!| type` никогда не выполняется, так что ответ проверяется без него:

```qlang
> ::json{:a 1} | query /42
null
```

Хвост `!| type` в кейсе ничего не показывает.

### case · QSPTH#words

`words.jsonl:9` назван «toPath-reads-a-json-pointer», а показывает отказ строке не в форме JSON Pointer:

```qlang
> "a" | toPath !| type
::string/toPath/NotPointerError
```

Имя кейса говорит не о том правиле, которое держат его запрос и ответ.
