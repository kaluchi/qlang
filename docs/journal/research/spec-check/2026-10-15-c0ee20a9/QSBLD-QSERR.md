<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at c0ee20a9 and checking docs/spec/QSBLD-functions-and-kinds.md and docs/spec/QSERR-errors.md, on 2026-10-15 from 11:10 to 11:24 UTC. Its prompt is `scripts/spec-check-prompt.txt` at c0ee20a9. -->

### implementation · QSBLD#input

«An input holds the value of its kind the walk of its tags reaches». Кейс `an-input-takes-the-value-of-its-kind-beneath-the-tags` (`m ::Width#5` → `5`) показывает это правило для `::number`. Для `::vec` и `::map` дерево отдаёт рецепту само значение со всеми тегами, а не значение вида, до которого дошёл обход. С набором под тегом то же правило снимает только внешний тег:

```qlang
> :any/m (::fn | takes :x |~~ x ~~| /0 ::number | impl ~(x | type)) | 1 | m ::B#1
::number

> :any/m (::fn | takes :x |~~ x ~~| /0 ::string | impl ~(x | type)) | 1 | m ::B"s"
::string

> :any/m (::fn | takes :x |~~ x ~~| /0 ::vec | impl ~(x | type)) | 1 | get [~(m #[1 2]) ~(m ~(a)) ~(m ::B[1]) ~(m ::B#[1])]
[::set ::quote ::B ::set]

> :any/m (::fn | takes :x |~~ x ~~| /0 ::map | impl ~(x | type)) | 1 | get [~(m ::B{:a 1}) ~(m !{:a 1})]
[::B ::error]
```

Глава и кейс задают одно правило для всех видов, а дерево отвечает по-разному: `::B#1` приходит как `5`-подобное число без тега, `::B[1]` — с тегом `::B`. Источник расхождения — `isOfKind` в `core/src/runtime/verb.mjs:32`: для `'vec'` и `'map'` там проверка `isVec`/`isQMap` по самому значению. Вопрос к дизайну: что должен получить вход `::vec` или `::map`, когда ему дают вектор или отображение под чужим тегом, — так, чтобы ответ совпадал с ответом для `::number`, `::string` и `::set`?

### implementation · QSBLD#answer

«one kind makes the answer by its constructor and its invariants; an answer of the word's own label goes back under the subject's tags, held to the label». Когда `returns` называет один вид, ответ под посторонним тегом обрабатывается по-разному в зависимости от вида:

```qlang
> :number/f (::fn | returns |~~ r ~~| ::number | impl ~(::V#7)) | ::W#2 | f
::W#7

> :vec/f (::fn | returns |~~ r ~~| ::vec | impl ~(::V[7])) | ::W[2] | f
::W::V[7]

> :any/f (::fn | returns |~~ r ~~| ::number | impl ~(::W#5)) | 1 | f
5

> :any/f (::fn | returns |~~ r ~~| ::vec | impl ~(::B[1])) | 1 | f
::B[1]

> ::B[1] | tag ::vec
|~| raised, and no !| caught it
::vec/PayloadKindNotTakenError!{
  :expected #[::vec]
  :actualType ::B
  :trail [
    {
      :step ~(tag ::vec)
      :subject ::B[1]
      :skipped ~()
    }
  ]
}
|~| `::vec` reads its payload as the vector it is: a set turns into a
|~| vector by `toVec`, `#[2 1] | toVec`, and a vector under a tag of its
|~| own, a quote and a doc among them, gives the vector beneath by
|~| `payload`.
```

Для `::number` ответ теряет тег `::V`, для `::vec` сохраняет его. При этом сам конструктор `::vec`, которым по главе «делается» ответ, такое значение отвергает. Причина та же, что в предыдущей находке (`walkToKinds` в `core/src/eval.mjs:700–704`). Вопрос к дизайну: что должен отвечать единственный вид из `returns` на ответ под чужим тегом, чтобы `::number` и `::vec` вели себя одинаково?

### implementation · QSBLD#label

«The tag of a name that holds a value is refused as `::construct/TagNotKindError`». То же говорит QSLIT#tag («the tag of a name that holds data is refused»), а по QSNAM#address любое значение, кроме страницы, вида, функции или цитаты, — это данные. Имя, которое хранит `null`, нарушает правило: его тег ложится как тег, которого никто не объявлял:

```qlang
> :n null | ::n[1]
::n[1]

> :n null | [1] | tag ::n
::n[1]

> :n 0 | ::n[1] !| type
::construct/TagNotKindError

> :n false | ::n[1] !| type
::construct/TagNotKindError
```

Глава и кейс `the-tag-of-a-name-that-holds-a-value-builds-nothing` формулируют правило для любого значения. В `core/src/eval.mjs:972` условие `declared === null` не отличает «узел не объявлен» от «узел хранит `null`». Вопрос: должен ли тег имени, хранящего `null`, отвергаться так же, как тег имени, хранящего `0`?

### design · QSBLD#fn

«`::fn/NameDeclaredTwiceError` a name declared again, an invariant named as the refusal of its input's kinds among them». Цепочка функции резервирует только имя отказа по видам. Инвариант может взять имя отказа, который рантайм поднимает по правилу, — `:x/NotGivenError` или `:answer/KindNotTakenError`. Цепочка вида такое же имя для поля отвергает:

```qlang
> ::fn | takes :w |~~ w ~~| /0 | holds :w/NotGivenError |~~ n ~~| ~(true) | type
::fn

> ::kind | reads :w |~~ w ~~| /w | holds :w/NotGivenError |~~ n ~~| ~(true) !| type
::kind/NameDeclaredTwiceError

> ::fn | returns |~~ r ~~| #[::number ::string] | holds :answer/KindNotTakenError |~~ n ~~| ~(true) !| type
::fn[~(returns |~~ r ~~| #[::number ::string] | holds :answer/KindNotTakenError |~~ n ~~| ~(true)) null]

> :number/f (::fn | takes :x |~~ x ~~| /0 | holds :x/NotGivenError |~~ n ~~| ~(gt 0) | impl ~(x)) | get [~(1 | f !| type) ~(1 | f -1 !| type) ~(::number/f | manifest)]
[::number/f/x/NotGivenError ::number/f/x/NotGivenError #[::number/f/x]]
```

Пропущенное место и нарушенный инвариант дают один и тот же тег. Кроме того, `takes` (`core/src/runtime/signature.mjs:121`) и `reads` (`:184`) по-разному отвечают на один вопрос: какие имена отказов под входом заняты. Вопрос: какой набор имён отказов, поднимаемых по правилу, должна резервировать цепочка — одинаково для входа функции и поля вида?

### conflict · QSERR#print

В главе: «A failure prints as its error at rest with the path it flew among its facts, `:trail []` for one that flew no step … the error at rest `!|` grounds it to holds no empty `:trail`». На странице `::error`: «so the print reads back as the error at rest, as `!|` grounds it».

```qlang
> ::error | doc | content | contains "the print reads back as the error at rest, as `!|` grounds it"
true

> {:a 1 :trail []} | raise
|~| raised, and no !| caught it
!{
  :a 1
  :trail []
}

> {:a 1 :trail []} | raise !| eq !{:a 1 :trail []}
false
```

Глава говорит, что напечатанный отказ, не пролетевший ни одного шага, не совпадает с ошибкой, к которой его приводит `!|`. Страница говорит, что совпадает.

### conflict · QSBLD#kind

На странице `::kind`: «the constructor attaches the tag to the payload or refuses it, and builds no other value». В QSLIT#tag и QSORD#set: «`::set[3 1]` is `#[1 3]`», «Its constructor orders what it is given and holds each element once». При этом `::set` — вид с конструктором:

```qlang
> ::kind | doc | content | contains "builds no other value"
true

> ::set | binding | get /value | type
::kind

> ::set/construct | binding | get /value | type
::builtin

> ::set[3 1]
#[1 3]
```

Страница вида запрещает конструктору строить другое значение, а глава о наборе описывает конструктор, который его строит.

### text · QSERR#site

«A refusal is declared in the source of the place it guards». Отказ входа, которого вызов не дал, нигде не объявлен: его binding — запись самого входа, и в `manifest` входа его нет. QSSLF#explain при этом знает «a refusal the runtime raises by rule under a word, with no page of its own».

```qlang
> 1 | add !| type
::number/add/addend/NotGivenError

> ::number/add/addend/NotGivenError | binding | get [/name /value]
[:number/add/addend /0]

> ::number/add/addend | manifest
#[::number/add/addend/KindNotTakenError]

> ::vec/reduce/reducer | manifest
#[::vec/reduce/reducer/KindNotTakenError ::vec/reduce/reducer/NotGivenError]
```

Фраза говорит обо всех отказах. Кейсы (`QSBLD/input.jsonl` `a-required-input-left-out-is-refused-by-its-name`) и QSSLF содержат отказы, которых не объявляет ни один источник.

### text · QSBLD#fn

«A function prints as its literal … which the constructor of `::fn` reads back, a payload that is no such pair refused as `::fn/PayloadNotPairError`»; для вида глава называет только `::kind/RecipeNotBuiltinError`. Дерево отвергает пару, у которой первый элемент не цитата, другими отказами. `::fn/RecipeNotCodeError` в главе встречается только как отказ `fill`, а `::kind/PayloadNotPairError` не упомянут вовсе:

```qlang
> ::fn[1 2] !| type
::fn/RecipeNotCodeError

> ::fn[1 ~(x)] !| type
::fn/SignatureNotCommandsError

> ::fn[~() ~(1) 3] !| type
::fn/PayloadNotPairError

> ::kind[1] !| type
::kind/PayloadNotPairError
```

Каталог (`::fn | manifest`, `::kind | manifest`) содержит правила литерала, которых глава не формулирует.

### text · QSBLD#fn

«a function with no recipe as `::fn/RecipeMissingError`». Функция, рецепт которой — `::builtin{}` читателя без реализации от хоста, отвергается этим же отказом, хотя рецепт у неё напечатан:

```qlang
> ::fn | impl ::builtin{} | print
::fn[~() ::builtin{}]

> 5 | apply (::fn | impl ::builtin{}) !| type
::fn/RecipeMissingError
```

Фраза главы называет случай «рецепта нет», а дерево подводит под него и `::builtin{}` читателя (QSHST#source: «the value it is»).

### text · QSBLD#kind

«`impl ::builtin{}` the check a host hands a kind of the core». Кейс `a-reader-kind-with-the-check-of-its-host-lays-its-tag` показывает, что вид читателя тоже принимает `::builtin{}` и кладёт свой тег:

```qlang
> :B |~~ B. ~~| (::kind | impl ::builtin{}) | ::B[1] | type
::B
```

Кейс содержит правило для вида читателя, которого глава не формулирует.

### text · QSERR#trail

«An error at rest holds the facts it is written with» и «The word `trail` answers the path, `[]` for an error that holds none». Для ошибки в покое, у которой `:trail` не путь, глава ответа `trail` не называет, а дерево отвергает его под ответом:

```qlang
> !{:trail 5} | get [~(get /trail) ~(trail !| type)]
[5 ::error/trail/answer/KindNotTakenError]
```

Ошибку в покое с таким фактом глава допускает (кейс `the-step-of-an-error-literal-whose-trail-is-no-path-is-data`), но о том, что `trail` для неё отказывает, не говорит.

### case · QSBLD#label

«A value laid under a tag before its kind is declared keeps the tag». Кейс `a-tag-used-before-its-kind-is-checked-by-the-kind-after` (`::AutoLater[5] | :AutoLater … | get [~(::AutoLater#7 | payload) ~(::AutoLater#5 !| type)]`) читает только литералы после объявления. Значение, положенное до объявления, он не читает, а оно проходит, хотя нарушает инвариант:

```qlang
> ::AutoLater[5] | :AutoLater |~~ AutoLater. ~~| (::kind | holds :TooSmallError |~~ Above six. ~~| ~(gt 6)) | type
::AutoLater
```

Первую половину правила секции ни один кейс не содержит.
