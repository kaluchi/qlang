<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at c91769c4 and checking docs/spec/QSNAM-names-and-scope.md and docs/spec/QSDSP-a-word-found-through-its-subject.md, on 2026-10-15 from 09:34 to 09:49 UTC. Its prompt is `scripts/spec-check-prompt.txt` at c91769c4. -->

### design · QSNAM#scope

«A value the reader bound to a bare name stands outside it, a bare step of that name refused as `::call/UnknownNameError` while `env` reads it» против QSQUO#held: «A value that scope names is withheld: read by a step, by a tag … it is refused under its name as `::call/ValueWithheldError`».

```qlang
> :n 3 | :number/times ~(mul n) | 5 | times !| get [~(type) /name /nearest]
[::call/UnknownNameError :n [::fn :in :ne :on]]

> :n 3 | :times ~(mul n) | 5 | apply times !| get [~(type) /name]
[::call/ValueWithheldError :n]

> :x 1 | :number/e ~(env | keys) | 5 | e
#[:number/e :x]

> :x 1 | :e ~(env | keys) | 5 | apply e
#[]

> :x |~~ n ~~| 1 | :number/b ~(::x | binding | get /value) | 5 | b
1

> :x |~~ n ~~| 1 | :q ~(::x | binding | get /value) | 5 | apply q !| get [~(type) /name]
[::call/ValueWithheldError :x]
```

Одна и та же цитата, написанная читателем в одном запросе, отвечает на вопрос «читается ли значение читателя `x`» по-разному. Если она лежит телом слова, голый шаг даёт `UnknownNameError`, а `env` и `binding` отдают значение. Если она лежит в имени и её запускает `apply`, все три дороги отказывают как `ValueWithheldError`, а `env` молча опускает имя. Вопрос к дереву: какой единый ответ давали бы тело слова и удерживаемая цитата на одно и то же чтение имени читателя?

### design · QSDSP#residence

«A word is called by its name or by its address, which checks the subject by that residence; a set, a quote and a doc are vectors to a word of vectors, each answered back as its own kind» вместе с QSORD#set: «a vector where it answers an order of its own, `sort` and `reverse`».

```qlang
> #[1 2 3] | reverse
[3 2 1]

> #[1 2 3] | vec/reverse
#[1 2 3]

> #[3 1 2] | sort ~(desc)
[3 2 1]

> #[3 1 2] | vec/sort ~(desc)
#[1 2 3]
```

Вызов по имени и вызов по адресу (как говорит глава, это одно и то же слово) отвечают на одном множестве по-разному. По адресу ответ возвращается под `::set`, и конструктор множества молча отменяет порядок, ради которого слово вызывали. Вопрос: какой ответ слова порядка на множестве был бы одинаков на обеих дорогах?

### conflict · QSNAM#scope

Глава говорит, что значение читателя в теле слова отказывается как `::call/UnknownNameError`, «while `env` reads it». Страница этого отказа говорит: «A step called a name nothing declares, no name of the scope and no word of any kind».

```qlang
> :n 3 | :number/times ~(env | get /n | get /value) | 5 | times
3

> :n 3 | :number/times ~(mul n) | 5 | times !| type
::call/UnknownNameError
```

Страница `::call/UnknownNameError` описывает имя, которого никто не объявил. Глава этим же тегом отказывает имени, которое объявлено и которое `env` читает из того же тела.

### conflict · QSNAM#binding

Страница `::any/env` говорит: «Answers what the reader declared before the step … Inside a fork it holds the names before the fork and the fork's own». QSQUO#held говорит, что прошлое удерживаемого кода — это «the words, the nodes and the labels of that step's scope, and the names the code declares itself». Сама QSNAM#binding говорит: «`env` answers the declarations of the reader where the step stands», и исключения для удерживаемого кода не называет.

```qlang
> :x 1 | 5 | apply ~(env | keys)
#[:x]

> :x 1 | :e ~(env | keys) | 5 | apply e
#[]

> :Box |~~ B. ~~| | :Box/side 3 | :e ~(env | keys) | 5 | apply e
#[:Box :Box/side]
```

Запуск цитаты — это форк со своим scope. Страница `env` обещает в нём имена, объявленные до форка. Дерево вслед за QSQUO#held опускает значения читателя и само имя `:e`, а узлы и метки оставляет.

### conflict · QSDSP#answer

Страница `::qlang/verbs`: «a verb of vectors reaches a vector under a tag and keeps the tag». QSDSP#answer: «a word whose answer names `::any`, or that names none, answers what it computed, `map` among them». То же говорят пробы и кейс `sort-over-a-tag-stacked-on-a-set-answers-the-bare-vector`.

```qlang
> ::Box[1 2] | map ~(add 1)
[2 3]

> ::vec/map/answer | binding | get /value
::any

> ::Box#[3 1 2] | sort
[1 2 3]
```

Страница утверждает сохранение тега для любого слова векторов. Глава и кейсы сохраняют тег только для слов, чей ответ — собственный вид субъекта.

### text · QSNAM#address

«The value says what the node is: a page or a kind makes a label, a function or a quote under a label a word, any other value data.» QSHST#source с кейсом `a-builtin-in-a-reader-recipe-is-the-value-it-is` говорят: «A `::builtin{}` written in the recipe of a word a reader declares is the value it is: the word's address answers its function as a value, and its bare name reaches no word».

```qlang
> :number/f (::fn | impl ::builtin{}) | 5 | f !| get [~(type) /name]
[::call/UnknownNameError :f]

> :number/f (::fn | impl ::builtin{}) | 5 | number/f | type
::fn

> :number/f (::fn | takes :x |~~ x ~~| /0) | 5 | f !| get [~(type) /name]
[::call/UnknownNameError :f]
```

Функция под меткой — не слово, если её рецепт не код и не примитив хоста: это `::builtin{}` читателя или рецепта нет вовсе. Глава называет словом любую функцию под меткой.

### text · QSNAM#word

«an input read from its place, a modifier that is the literal of an atom and each run of the code a verb runs meet the budget of frames one below the call, a quote written as a modifier handed to the call as it is». Страница `::call/EvaluationDepthExceededError` говорит: «a modifier computed at the call … run one frame below the step that called them … a quote written as a modifier is a value at the call».

```qlang
> :number/down ~(if (gt 0) ~(sub 1 | down) ~(apply ~(apply ~([] | count [1])))) | 498 | down !| type
::call/EvaluationDepthExceededError

> :number/down ~(if (gt 0) ~(sub 1 | down) ~(apply ~(apply ~([] | count (1))))) | 498 | down !| type
::call/EvaluationDepthExceededError

> :number/down ~(if (gt 0) ~(sub 1 | down) ~(apply ~(apply ~([] | count ~(x))))) | 498 | down !| type
::vec/count/ArgsBeyondInputsError
```

Литерал контейнера и группа тоже встречают бюджет на кадр ниже вызова, как и страница говорит о любом вычисленном модификаторе. Глава сужает правило до литерала атома.

### text · QSNAM#letters

«A name a step can call begins with a letter of any script or `_` …, and a key of a path and a tag are written in the same letters».

```qlang
> ":1a 2" | parse !| type
::quote/ParseError

> "::1a[1]" | parse !| type
::quote/ParseError

> {"1a": 1} | get /1a
1

> /-a | segments
[:"-a"]
```

Голый ключ пути принимает символы продолжения имени и в начале (`RelaxedKeyName` в `core/src/grammar.peggy:832`), а имя и тег — нет. Глава уравнивает их буквы.

### design · QSNAM#reach

«A reader's bare name stands over a bare name of the root, while the tag of a label of the root stays the root's». Вместе с QSNAM#letters: «each declares a label, which its tag reaches where the root holds no label of that name».

```qlang
> :vec |~~ mine ~~| | get [~(vec) ~(::vec | doc | content | contains "mine") ~(::vec | binding | get /origin)]
[|~~ mine ~~| false :qlang/vec]

> :null |~~ A thing. ~~| | get [~(env | get /null | get /value) ~(::null | binding | get /origin)]
[|~~ A thing. ~~| :qlang/null]
```

Объявление страницей принимается, и `env` держит его как метку читателя. Но голое имя и адрес отвечают на вопрос о странице `vec` по-разному, и ни одна дорога не достигает этой метки как метки. Вопрос: какой ответ согласовал бы голое имя и тег одного имени?

### case · QSNAM#reach

Правило «A value named by the name of a word of `::any`, `type`, `doc`, `env`, `get`, meets that word on every subject» не держит ни один кейс: в `QSNAM/reach.jsonl` все встречи значения со словом идут на словах видов (`count`, `filter`, `sort`, `second`, `hours`).

```qlang
> :type 5 | 1 | type !| get /addresses
#[::any/type]
```

```
$ git -C D:/git/qlang ls-files --error-unmatch core/test/conformance/QSNAM/reach.jsonl
core/test/conformance/QSNAM/reach.jsonl
```

Правило раздела есть в тексте главы, а в кейсах его нет.

### case · QSNAM#letters

Кейс `the-word-of-a-literal-names-a-label` (`":null |~~ A thing. ~~| | 1" | parse | count` → `2`) показывает только, что парсер читает два шага. Что объявляется метка, он не показывает.

```qlang
> ":null |~~ A thing. ~~| | 1" | parse | count
2
```

Имя кейса говорит о метке, а запрос держит правило разбора (QSSYN#line).

### case · QSNAM#word

Кейс `a-declaration-writes-into-no-verb-it-was-handed` объявляет одну цитату `~(:returns ::number | 1)` под двумя метками и показывает, что её объявления остаются внутри её запуска.

```qlang
> :A |~~ A. ~~| | :B |~~ B. ~~| | ~(:returns ::number | 1) | get [~(:A/f (it) | ::A{} | f) ~(:B/f (it) | ::B{} | f)]
[1 1]
```

Это правило QSNAM#scope («What the body declares stays in it»), а не правило слова из QSNAM#word.
