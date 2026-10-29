> A check of the chapters `QSPTH`, `QSNUM`, `QSCOL` for D412 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–00:02 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### design · QSNUM#combine

«each of the args a number or a path read against the subject»

```qlang
> {:a "x"} | get [~(sumOf "x" !| tag) ~(sumOf /a !| tag) ~(mulOf "x" !| tag) ~(mulOf /a !| tag)]
[::any/sumOf/NumbersElementKindNotTakenError ::vec/sum/ElementKindNotTakenError ::any/mulOf/FactorsElementKindNotTakenError ::number/mul/MultiplierKindNotTakenError]

> {:a "x" :b 2} | get [~(subOf "x" /b !| tag) ~(subOf /a /b !| tag)]
[::any/subOf/MinuendKindNotTakenError ::number/sub/SubjectNotNumberError]

> {:a "x" :b 2} | mulOf /a /b !| trace | map ~failed
[~(mul) ~(reduce 1 ~(mul)) ~(mulOf /a /b)]
```

Один и тот же аргумент-текст отказывается по-разному. Если он записан значением, отказ стоит под собственным входом глагола с индексом. Если его читает путь, отказ стоит под шагом рецепта (`::vec/sum`, `::number/mul`, `::number/sub`), которого читатель не писал, и этот шаг ложится в трассу. Какое согласованное поведение отвечало бы на путь, прочитавший не число?

### text · QSCOL#group

«A key of another kind is refused at its element under the verb as `…/KeyKindNotTakenError`»

```qlang
> get [~([{:k [1]}] | groupBy /k !| tag) ~([{:k 1}] | groupBy :k !| tag) ~([{:k [1]}] | indexBy /k !| tag)]
[::vec/groupBy/KeyAnswerKindNotTakenError ::vec/groupBy/KeyKindNotTakenError ::vec/indexBy/KeyAnswerKindNotTakenError]
```

Предложение называет `…/KeyKindNotTakenError` отказ, который дерево, собственная проба секции, кейсы `core/test/conformance/QSCOL/group.jsonl:8`, `:21`, `:28` и QSERR#site («the key an element files under as `KeyAnswerKindNotTakenError`») называют `…/KeyAnswerKindNotTakenError`; под именем `KeyKindNotTakenError` стоит отказ самого входа `key`.

### design · QSPTH#code

«where the step writes the path the refusal names as `:repair` the step the call was likely meant as»

```qlang
> 5 | mul /qty !| repair
~(mul (get /qty))

> 5 | number/mul /qty !| get [~(tag) ~(repair)]
[::number/mul/MultiplierKindNotTakenError null]

> /tags | keys !| get [~(tag) ~(repair)]
[::map/keys/SubjectNotMapError ~(get /tags | keys)]

> /tags | map/keys !| get [~(tag) ~(repair)]
[::map/keys/SubjectNotMapError null]
```

Отказ с одним и тем же тегом несёт `:repair` при вызове голым именем и не несёт при вызове адресом, хотя шаг пишет путь одинаково. Какое согласованное поведение отвечало бы для вызова по адресу?

### design · QSCOL#algebra

«`unionOf` unites the maps or the sets its call computes, … one part answers itself» и «A fold takes a set or a map first, a value of another kind refused at its index, `ElementKindNotTakenError`»

```qlang
> {:a 5} | unionOf /a
5

> {:a 5} | get [/a] | union !| get [~(tag) ~(trace | last | path)]
[::vec/union/ElementKindNotTakenError /0]

> {:a 5 :b 6} | unionOf /a /b !| get [~(tag) ~(addresses)]
[::call/KindAnswersNoVerbError #[::map/union ::set/union ::vec/union]]

> {:m {:a 1} :s #[:a]} | get [~(unionOf /m /s !| tag) ~(get [/m /s] | union !| tag)]
[::map/union/OtherKindNotTakenError ::call/KindsMismatchedError]
```

Рецепт `unionOf` и свёртка вектора тех же частей, собранного `get`, отвечают на один вопрос по-разному:

- одна часть не того вида у `unionOf` отвечает собой, у свёртки отказана на `/0`;
- две такие части у `unionOf` дают отказ вызова с адресами `union`;
- карта рядом с множеством даёт `::map/union/OtherKindNotTakenError` у `unionOf` и пару `::call/KindsMismatchedError` у свёртки.

Какое согласованное поведение отвечало бы на часть, которая не карта и не множество, и на карту рядом с множеством?

### conflict · QSDSP#answer

«`append` and `prepend`, `concat`, … works beneath the tags the two share, … and two under different tags are refused as the pair»

```qlang
> get [~(::A[1] | append ::B[2]) ~(::A[1] | append ::A[2]) ~(::A[1] | prepend ::B[2]) ~(::A"x" | append ::B"y" !| tag)]
[::A[1 ::B[2]] ::A[1 ::A[2]] ::A[::B[2] 1] ::call/KindsMismatchedError]
```

QSDSP#answer числит `append` и `prepend` объединителями для любого вида. QSCOL#sequence («`append` and `prepend` put one element at an end, a vector given among them») и страницы `::vec/append` и `::vec/prepend` («a vector under a tag stays under it») кладут элемент целиком под теги субъекта; дерево так и отвечает для векторов, а под общими тегами объединяет только строки.

### text · QSCOL#group

«the second refused as `KeyTakenError`, its `:key` the keyword»

```qlang
> [1 "1"] | groupBy !| get [~(payload | keys) ~(key) ~(key | answer)]
[#[:key/answer :key/found :subject/found :taken :trace] ::vec/groupBy/key{:found null :answer :"1"} :"1"]
```

Факта `:key` с ключевым словом у отказа нет: `key` читает слот входа, а ключевое слово стоит в его части `answer`, как и читает кейс `core/test/conformance/QSCOL/group.jsonl:14` (`key | answer`).

### conflict · core/lib/qlang/vec.qlang:946

«`:key` naming the keyword»

```qlang
> ::vec/groupBy/KeyTakenError | doc | content | contains "`:key` naming the"
true

> ::vec/groupBy/KeyTakenError | laws | map ~(get /1)
{
  :refusesTwoValuesOfOneText ~([1 "1"] | groupBy !| get [~(tag) ~(key | answer) ~(taken) ~(trace | last | path)] | eq [::vec/groupBy/KeyTakenError :"1" 1 /1])
}
```

Страница отказа называет ключевое слово `:key`, а закон под ней читает его как `key | answer`. То же расхождение стоит в `core/lib/qlang/vec.qlang:1059` против закона `:1095` (`indexBy`) и в `core/lib/qlang/set.qlang:200` против закона `:232` (`::set/groupBy`).

### text · QSPTH#get

«each refusal holding the value it met beneath them as `:found`, the subject of the step that reads it among them, `get`, `query`, `has`, a write and a path run as code»

```qlang
> :Card |~~ A card. ~~| (::kind | accepts |~~ The parts. ~~| ::vec | wires :took |~~ The seconds. ~~| /1 ::number); {:a 5 :c ::Card["a" 312]} | get [~(has /a/b) ~(get /a/b !| tag) ~(has /c/took) ~(get /c/took !| tag)]
[false ::path/SubjectHasNoPartsError false ::path/TagClosedError]
```

`has` не отказывает ни на одном чтении пути. Там, где `get` отказывает, закрытый тег среди этого, он отвечает `false`, как говорят QSPTH#has («answers whether `get` reads it») и закон `readsNoPathThroughAValueWithoutParts` страницы `::map/has`.

### design · QSPTH#template

«Its first input names the parts: a vector of paths, …, a map among them naming the parts it maps» и «a question alone, which no brackets hold, is refused as `::any/settle/QuestionsKindNotTakenError`»

```qlang
> {:a 1} | get [~(with ~(get /a) ~(1) !| get [~(tag) ~(name) ~(selector)]) ~(with [~(get /a)] ~(1) !| tag)]
[[::any/with/NamesSelectorKindNotTakenError :name :get] ::any/with/NamesElementKindNotTakenError]

> 5 | settle ~(add 1) !| questions | get [~(expected) ~(found | is ::vec)]
[#[::map ::vec] true]
```

Для обхода цитата — вектор записей шагов [QSDSP#walk]. Поданная как имена `with`, она читается как вектор карт имён и отказана по селектору `:name` со значением `:get`, которых читатель не писал; та же цитата внутри вектора отказана как элемент. У `settle` цитата отказана с `:expected #[::map ::vec]`, хотя сама `is ::vec`. Какое согласованное поведение отвечало бы на цитату там, где стоят имена или вопросы?

### implementation · QSPTH#code

«An input whose kinds leave a path out refuses one, and where the step writes the path the refusal names as `:repair` …»

```qlang
> [1] | concat /a !| get [~(tag) ~(repair)]
[::vec/concat/VectorsElementKindNotTakenError null]

> ["a"] | join /sep !| get [~(tag) ~(repair)]
[::vec/join/SeparatorKindNotTakenError ~(join (get /sep))]
```

Глава и её кейсы `core/test/conformance/QSPTH/code.jsonl:7` и `:8` держат repair там, где шаг пишет путь, которого вход не берёт. На входе каждого элемента (`vectors` у `concat`) отказ repair не называет, а у разделителя `join` называет. Какое согласованное поведение отвечало бы на путь, поданный входу каждого элемента?

### text · QSCOL#map

«The verbs a vector has beyond these, `distinct`, `groupBy`, `flat` and `contains` among them, a map does not answer»

```qlang
> get [~({} | empty) ~({:a 1} | empty) ~(::map | manifest | has ::map/empty)]
[true false true]

> ::vec/empty | doc | content | contains "A map answers `empty` by a verb of"
true
```

Карта отвечает `empty` своим глаголом `::map/empty`. Об этом говорит страница `::vec/empty`, это прогоняют кейсы `core/test/conformance/QSCOL/group.jsonl:6` и `:20` на картах, которыми отвечают `groupBy` и `indexBy`, а перечень секции `empty` опускает.

### text · QSCOL#image

«A value computed at the call instead of the code is refused with the repair.»

```qlang
> [1 2] | map (add 1) !| get [~(tag) ~(repair) ~(payload | keys)]
[::vec/map/CodeKindNotTakenError null #[:code/expected :code/found :subject/found :trace]]
```

Отказ не держит `:repair` — слот вердикта, который QSPTH#code называет у отказанного пути. Его страница говорит «refused with what it answered», то есть держит `code | found`.

### design · QSPTH#shape

«where every key is data, a number, a text that begins with a date, a uuid or an email»

```qlang
> get [~({:"01" 1 :"02" 2} | shape) ~(/01 | segments) ~("01" | toNumber !| tag) ~({:"1e3" 1 :"2e3" 2} | shape) ~("1e3" | toNumber)]
[::shape::each{:"01" ::number} [:"01"] ::string/toNumber/TextNotNumberError ::shape{:"1e3" ::number :"2e3" ::number} 1000]
```

`shape` принимает ключ `"01"` за число, а `"1e3"` — нет. `segments` (QSPTH#verbs: «a segment of digits that writes no number a key, `/01`») и `toNumber` отвечают наоборот. Какое согласованное поведение отвечало бы на вопрос, пишет ли ключ число?

### drift · core/lib/qlang/each.qlang:7

«every key of which is data, an id, a date, a uuid or an email»

```qlang
> ::each | doc | content | contains "every key of which is data, an id, a date"
true

> get [~({:"17" 1 :"42" 2} | shape) ~({:u1 1 :u2 2} | shape)]
[::shape::each{:"17" ::number} ::shape{:u1 ::number :u2 ::number}]
```

Страница `::each` называет «an id» то, что QSPTH#shape называет «a number», а id, который не число (`u1`), ничего не сворачивает.

### text · QSPTH#get

«`::path/IndexOutOfBoundsError` with the index as `:index`»

```qlang
> [10 20 30] | get /99 !| get [~(index) ~(length)]
[99 3]
```

Факт `:length` (длину субъекта) держат кейсы `core/test/conformance/QSPTH/get.jsonl:17`, `:18` и страница отказа (`wires :length`, закон `IndexOutOfBoundsError/refusesAnIndexPastTheEnd`), а секция его не называет.

### text · QSPTH#shape

«a set as `#[E]`, an empty vector `[]`» и «`paths` answers the leaves of a value, … and `#[]` for an atom»

```qlang
> {:d {} :e #[] :f []} | paths
#[[/d ::map] [/e ::set] [/f ::vec]]

> get [~(#[] | shape) ~([#[] #[]] | shape)]
[::shape#[] ::shape[#[]]]

> ::shape | doc | content | contains "each set `#[E]`, `#[]` an"
true
```

Кейсы `core/test/conformance/QSPTH/shape.jsonl:1`, `:57` и страницы `::any/paths` («an empty vector or map is a part that holds none») и `::shape` держат два правила, которых секция не говорит: пустые карта, множество и вектор — листья `paths` со своим видом, а пустое множество даёт форму `#[]`.

### case · QSPTH#verbs

«under the address of its verb where one verb holds the name …, the refusal naming as `:repair` the step the call was likely meant as»

```qlang
> /tags | keys !| get [~(tag) ~(repair)]
[::map/keys/SubjectNotMapError ~(get /tags | keys)]
```

```sh
$ grep -rho '"query":"/[^"]*repair[^"]*"' core/test/conformance
"query":"/tags | count !| repair"
```

Единственный кейс, где субъект — путь и читается repair, — `/tags | count`, то есть отказ вызова. Отказ под адресом единственного глагола с его repair держит только проба главы, ни один кейс.

### text · QSPTH#has

«so a path held as an element is asked for by `contains` [QSCOL#sequence]»

```sh
$ grep -n -E '^## |contains' docs/spec/QSCOL-collections.md
8:## sequence
76:## map
87:has beyond these, `distinct`, `groupBy`, `flat` and `contains` among
89:`vals` first, `{:a 1} | vals | contains 1` answering `true`.
102:## image
123:## filter
139:## reduce
176:## algebra
249:## group
279:## within

$ grep -n -E '^## |asks a vector for an element' docs/spec/QSTXT-text.md
7:## string
50:## search
55:keyword for its text. `contains` asks a vector for an element, a path
77:## split
99:## regex
134:## match
```

QSCOL#sequence не называет `contains` вовсе; правило `contains` над вектором, где путь — один из элементов, стоит в QSTXT#search.

### drift · core/test/conformance/QSCOL/within.jsonl:4

«within-returns-the-kind-of-its-subject»

```sh
$ grep -rhoE '"name":"[^"]*(returns|yields)[^"]*"' core/test/conformance/QSCOL
"name":"groupBy-empty-vec-yields-empty-map"
"name":"indexBy-empty-vec-yields-empty-map"
"name":"vals-map-yields-vec"
"name":"keys-map-yields-set"
"name":"reduce-empty-returns-seed"
"name":"take-over-length-returns-whole"
"name":"drop-over-length-returns-empty"
"name":"within-returns-the-kind-of-its-subject"
```

```qlang
> get [~(::tagged/within/answer | binding | value) ~(::vec/reduce/answer | binding | value)]
[::tagged ::any]
```

Главы и страницы называют то, чем отвечает глагол, словом «answers», а эти имена кейсов — словами «returns» и «yields». «returns» — слово команды `returns`, которая у `within` называет `::tagged`, а у `reduce` — `::any`.
