<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at c91769c4 and checking docs/spec/QSBLD-functions-and-kinds.md and docs/spec/QSERR-errors.md, on 2026-10-15 from 09:34 to 09:51 UTC. Its prompt is `scripts/spec-check-prompt.txt` at c91769c4. -->

### conflict · QSERR#catch

QSERR#catch: «A failure lives in the pipe alone: `|` passes it by, and `!|` alone catches it». Страница `::error` говорит то же: «`!|` alone catches it». А QSCND#coalesce: «Code that answers a failure is taken as no value, as null is». Страница `::any/coalesce` тоже засчитывает ошибку как отсутствие значения.

```qlang
> {} | coalesce ~(get /a) 5
5

> 5 | coalesce ~(add "x") 7
7

> 5 | coalesce (add "x") 7 !| type
::number/add/addend/KindNotTakenError
```

Две главы и две страницы задают два правила о том, кто ловит ошибку. По QSERR её ловит только `!|`, а `coalesce` гасит любую ошибку своего кода, включая ошибку вида, которая не имеет отношения к отсутствию ключа.

### design · QSERR#site

QSERR#site: «The refusal of an input's value lives under the input, whether an invariant or a primitive raises it». QSPTH#code: «those of the words that combine several values of one subject, `sumOf`, … take a path and read it».

```qlang
> {:a 1 :b "x"} | sumOf /a /b !| get [~(type) /index]
[::vec/sum/ElementNotNumberError 1]

> {:a 1 :b "x"} | sumOf /a (get /b) !| get [~(type) /index]
[::any/sumOf/numbers/ElementKindNotTakenError 1]

> {:a "x"} | sumOf /a !| trail | map /step
[~(sum) ~(sumOf /a)]
```

Одно и то же значение `"x"` на одном входе даёт два разных отказа. Если оно вычислено при вызове, отказ лежит под входом `numbers`. Если его прочёл путь, отказ лежит под адресом `::vec/sum`, а это слово, которое читатель не вызывал. В trail тогда стоит шаг из тела слова каталога, а в alert — проза страницы `sum`. Кейс `core/test/conformance/QSERR/site.jsonl:27` закрепляет второй путь. Под каким адресом согласованно лежал бы отказ значения, прочитанного путём на входе `sumOf`?

### design · QSBLD#answer

QSBLD#answer: «one kind makes the answer by its constructor and its invariants». QSBLD#input: «An input holds the value of its kind the walk of its tags reaches».

```qlang
> :number/a (::fn | returns |~~ r ~~| ::number | impl ~(::W#5)) | :number/b (::fn | returns |~~ r ~~| ::vec | impl ~(::T[1])) | 5 | get [~(a) ~(b)]
[5 ::T[1]]

> :any/a (::fn | takes :x |~~ x ~~| /0 ::number | impl ~(x | type)) | :any/b (::fn | takes :x |~~ x ~~| /0 ::map | impl ~(x | type)) | null | get [~(a ::W#5) ~(b ::T{:a 1})]
[::number ::T]

> get [~(::W#5 | tag ::number !| type) ~(::T[1] | tag ::vec !| type) ~(::T[2 1] | tag ::set) ~(::T[1] | tag ::quote) ~(::T{:a 1} | tag ::error)]
[::number/PayloadKindNotTakenError ::vec/PayloadKindNotTakenError #[1 2] ~(1) ::error::T{:a 1}]
```

На один вопрос, значение под чужим тегом в месте одного вида, дерево отвечает по-разному. Атом отдаётся из-под тегов, контейнер остаётся под ними. Конструктор, которым QSBLD#answer «делает» ответ, вообще отказывает `::W#5`, а ответ того же вида его принимает. Среди конструкторов ядра `::number`, `::vec`, `::map` и `::string` отказывают, `::set` и `::quote` снимают тег, а `::error` его сохраняет. Какой один ответ дали бы вход, ответ и конструктор вида ядра значению под тегом?

### design · QSERR#rest

QSERR#rest: «its print reads back as itself», «a refusal of the label answering for the literal». QSQUO#step: «an error literal as the error at rest it writes». Кейсы `QSERR/rest.jsonl:18,28` и `QSERR/catch.jsonl:16–19` держат шаг как значение.

```qlang
> ~(::number!{:a 1}) | first | :v it | get [~(type) ~(is ::number) ~(print) ~(print | parse | apply it !| type)]
[::number false "::number!{:a 1}" ::number/PayloadKindNotTakenError]

> ::number!{:a 1} !| type
::number/PayloadKindNotTakenError
```

Через шаг цитаты получается значение, которое литерал сделать не может. Его `type` отвечает `::number`, а `is ::number` отвечает `false`, и его print читается обратно как отказ, а не как оно само. Каким было бы согласованное значение шага `::number!{…}` в цитате?

### design · QSERR#rest

QSERR#rest: «a map of facts under `::error`… whose payload is the map of the facts». QSLIT#tag: «for an error the map of its facts». QSPRN#print: «the set, the quote, the doc and the error by their own brackets».

```qlang
> ::T{:a 1} | tag ::error | get [~(type) ~(payload | type) ~(print)]
[::error ::T "::error::T{:a 1}"]

> ::T[2 1] | tag ::set
#[1 2]
```

Ошибка в покое здесь держит payload под чужим тегом и печатается без своей скобки `!{`, тогда как `::set` над тем же видом входа снимает тег. Тексты и дерево здесь расходятся.

### conflict · QSBLD#input

QSBLD#input: «a place the call leaves out, read strictly by a path or by code, as `…/by/NotGivenError`». QSERR#site: «a refusal of the read of a path sits under `::path`, whichever word reads it».

```qlang
> :any/m (::fn | takes :k |~~ k ~~| ~(get /0 | get /note) | impl ~(k)) | null | get [~({} | get /note !| type) ~(m {} !| type) ~(m 5 !| type)]
[::path/KeyNotInMapError ::any/m/k/NotGivenError ::path/SubjectHasNoPartsError]
```

Две главы задают два правила для отказа чтения пути. В месте входа `get` по пропущенному ключу отказывает под входом, а QSERR#site ставит такой отказ под `::path` при любом читающем слове.

### design · QSBLD#fn

QSBLD#fn: «`impl` its recipe, code or a host's `::builtin{}`». QSNAM#address: «a function or a quote under a label a word». Страница `::fn`: «A word is a function named under a label, called by its function alone».

```qlang
> :number/c (::fn | takes :by |~~ b ~~| /0) | 5 | get [~(::number/c | binding | get /value | type) ~(::number/c | manifest) ~(c 3 !| type) ~(number/c 3 !| type) ~(::number/c[1] !| type)]
[::fn #[::number/c/by] ::call/UnknownNameError ::call/ValueTakesNoModifiersError ::construct/TagNotKindError]

> :number/c (::fn | takes :by |~~ b ~~| /0) | 5 | apply (::number/c | binding | get /value) [3] !| type
::fn/RecipeMissingError
```

Функция без рецепта под меткой кладёт узел входа как слово, но вызывается как данные. Через `apply` та же функция отказывает с `::fn/RecipeMissingError` — закон этой страницы, который QSBLD#fn не называет. Правило «функция без рецепта — данные» записано только в коде: `core/src/runtime/nouns.mjs:100–105` и `lsp/src/features.mjs:454–456` ссылаются на [QSBLD#fn], а в самой главе его нет. Каким один ответ был бы на вызов контракта по имени, по адресу и через `apply`?

### text · QSBLD#fn

Страница `::fn` объявляет `| throws :RecipeMissingError` с законом «A function with no recipe is refused at its call», а `::fn/PayloadNotPairError` закреплён законом `refusesANumber`. QSBLD#fn не называет ни тот, ни другой отказ.

```qlang
> ::fn | manifest | filter ~(toString | endsWith "Error")
#[::fn/FactUnderNoNameError ::fn/LawUnderNoNameError ::fn/NameDeclaredTwiceError ::fn/NameUnderNoInputError ::fn/PayloadNotPairError ::fn/RecipeMissingError ::fn/RecipeNotCodeError ::fn/SignatureNotCommandsError]
```

Правило отказа контракта при вызове держат страница и её законы, а глава его не формулирует.

### implementation · QSERR#site

QSERR#site: «a refusal the catalog declares links the page of its place». Кейс `QSERR/site.jsonl:19` держит это правило для `::path/KeyNotInMapError`.

```qlang
> [::fn/RecipeMissingError ::fn/takes/SubjectNotFnError ::kind/RecipeNotBuiltinError ::error/PayloadKindNotTakenError ::error/TrailNotVecError ::path/KeyNotInMapError ::map/raise/SubjectNotMapError ::error/trail/SubjectNotErrorError] | map ~(get [~(it) ~(doc | links | count)])
[[::fn/RecipeMissingError 0] [::fn/takes/SubjectNotFnError 0] [::kind/RecipeNotBuiltinError 0] [::error/PayloadKindNotTakenError 0] [::error/TrailNotVecError 1] [::path/KeyNotInMapError 2] [::map/raise/SubjectNotMapError 0] [::error/trail/SubjectNotErrorError 0]]

> kinds | toVec | map ~(manifest !| #[]) | flat | :nodes it | get [~(nodes) ~(nodes | map ~(manifest !| #[]) | flat)] | flat | filter ~(toString | endsWith "Error") | distinct | :errs it | get [~(errs | count) ~(errs | filter ~(doc | links | count | eq 0) | count)]
[266 228]
```

Глава и кейс говорят одно и то же, а у большинства отказов, объявленных в каталоге, страница не ведёт ни по одной ссылке. Какую страницу места согласованно связывала бы страница каждого такого отказа?

### design · QSBLD#fn

QSBLD#fn: «the names `answer` and `subject`, which the chain lays itself». Страница `::fn/LawUnderNoNameError`: «a name the function declares before it: … the subject or the answer». Страница `::fn/NameUnderNoInputError`: «under an input taken before it or under the answer».

```qlang
> ::fn | throws :answer/BadError |~~ b ~~| | type
::fn

> ::fn | proves :answer/x |~~ b ~~| ~(true) !| type
::fn/LawUnderNoNameError

> :number/f (::fn | holds :answer/NotSmallError |~~ s ~~| ~(lt 10) | impl ~(add 100)) | get [~(5 | f !| type) ~(::number/f | manifest) ~(::number/f/answer | binding !| type) ~(::number/f/answer/NotSmallError | doc)]
[::number/f/answer/NotSmallError #[] ::any/binding/UnknownNameError |~~ s ~~|]
```

Без `returns` отказ и инвариант под `answer` принимаются, а закон под ним отвергается. Узел `answer/NotSmallError` лежит под узлом `answer`, которого нет, и `manifest` слова его не видит, хотя QSNAM#address требует, чтобы существительное было объявлено раньше. Каким один ответ был бы на имя под `answer` до `returns`?

### design · QSBLD#recipe

QSBLD#recipe: «its inputs by their names and the args as `args`». QSNAM#scope: «A step of the body's pipeline that declares `args` or an input is refused as a second declaration».

```qlang
> :any/f (::fn | takes :args |~~ a ~~| /0 | impl ~(args)) | :any/g (::fn | takes :x |~~ a ~~| /0 | impl ~(args)) | null | get [~(f 5) ~(g 5)]
[5 ::any/g[5]]

> :any/f ~(:args 1 | args) | null | f !| type
::bind/NameDeclaredTwiceError
```

Объявить `args` шагом тела нельзя, а вход с именем `args` молча занимает место аргументов вызова. QSBLD#fn исключает из имён входов `answer`, `subject` и слова литералов, но не `args`. Каким один ответ был бы на второе объявление `args` в области, которую открывает вызов?

### design · QSBLD#recipe

QSBLD#recipe: «A value a recipe needs is an input». QSQUO#held: «A value that scope names is withheld… refused under its name as `::call/ValueWithheldError`».

```qlang
> :k 1 | get [~(:f ~(add k) | 5 | apply f !| get [~(type) /name]) ~(:g (::fn | takes :x |~~ x ~~| /0 | impl ~(add k)) | 5 | apply g [1] !| get [~(type) /name /nearest])]
[[::call/ValueWithheldError :k] [::call/UnknownNameError :k [:ok :x]]]
```

Одно и то же значение читателя, прочитанное кодом, который его не видит, отказывает двумя тегами. Цитата в имени даёт `ValueWithheldError`, а рецепт функции, запущенный через `apply`, даёт `UnknownNameError`, и его `:nearest` не называет `k`. Каким был бы один отказ для значения, удержанного от кода?

### design · QSBLD#fn

QSBLD#fn: «`apply` hands a function a vector or a set of arguments… a quote or a path takes empty args alone, `[]`, `#[]` or an empty vector under a tag». Закон `::any/apply`: «A second quote is no argument of the first».

```qlang
> get [~(5 | apply (::fn | takes :x |~~ x ~~| /0 | impl ~(add x)) ~(3)) ~(5 | apply ~(add 1) ~()) ~(5 | apply ~(add 1) ~(mul 2) !| type)]
[8 6 ::any/apply/args/NotTakenError]
```

Цитата, переданная в аргументы, читается как вектор своих шагов. Функция получает литерал `3` из `~(3)`, а пустая цитата принимается как пустые аргументы, хотя закон страницы говорит, что вторая цитата аргументом не бывает. Как согласованно был бы прочитан код в месте аргументов?

### design · QSERR#trail

QSERR#trail: «a trail other than a plain vector of plain maps… is refused as `::error/TrailNotVecError`… The word `trail` answers the path».

```qlang
> get [~(!{:trail 5} | trail !| type) ~(!{:trail 5} | raise !| type)]
[::error/trail/answer/KindNotTakenError ::error/TrailNotVecError]
```

Один и тот же неправильный путь отказывает по-разному: `raise` отказывает с `TrailNotVecError`, а слово `trail` — отказом своего ответа. Каким один отказ был бы на `:trail`, который не является путём?

### text · QSBLD#label

QSBLD#label: «The tag of a name that holds a value is refused as `::construct/TagNotKindError`». QSNAM#address: «a page or a kind makes a label, a function or a quote under a label a word, any other value data». Комментарий `core/src/eval.mjs:44–45` говорит: «a value goes under a label, a word, an invariant or a tag no node answers [QSBLD#label]».

```qlang
> :Box |~~ B ~~| (::kind | holds :TooBigError |~~ t ~~| ~(lt 9)) | :Box/limit 5 | get [~(::Box/TooBigError | binding | get /value | type) ~(::Box/TooBigError[1] | type) ~(::Box/limit[1] !| type)]
[::holds ::Box/TooBigError ::construct/TagNotKindError]
```

Узел инварианта держит `::holds~(…)`, то есть ни страницу, ни вид, ни слово, но его тег кладётся сам. Это правило записано в комментарии кода, а не в главе.

### case · QSBLD#input

QSBLD#input: «a path that meets a value it cannot read with the path's refusal, `::path/SubjectHasNoPartsError`». Ни один кейс не показывает путь места, который встречает значение без частей. В кейсе `QSBLD/input.jsonl:61` «an-input-that-reads-from-the-end-reads-the-last-object» `SubjectHasNoPartsError` даёт модификатор `(get /nope)`, вычисленный при вызове, а это правило [QSQUO#modifier].

```
$ grep -rhoE 'takes [^"]*/0/[a-z]+ [^"]*SubjectHasNoParts' core/test/conformance | wc -l
0
```

```qlang
> :any/m (::fn | takes :k |~~ k ~~| /0/k | impl ~(k)) | null | m 5 !| type
::path/SubjectHasNoPartsError
```

У правила раздела нет кейса, а кейс, названный по чтению с конца, показывает правило другого раздела.

### case · QSBLD#fn

QSBLD#fn: «a command written after `impl` joins the others and the recipe stays, while `impl` over the noun alone makes the function of no commands, its code, which takes no command after it, `::fn/takes/SubjectNotFnError`». Там же: «`apply` hands a function a vector or a set of arguments… `[]`, `#[]` or an empty vector under a tag». Ни один кейс не держит эти правила.

```
$ grep -rhoE 'impl ~\([^)]*\) \| (takes|returns|on|throws)' core/test/conformance | wc -l
0
$ grep -rhoE 'apply [^"]*(#\[[0-9]|::T\[\])' core/test/conformance | wc -l
0
```

```qlang
> ::fn | impl ~(add 1) | takes :by |~~ b ~~| /0 !| type
::fn/takes/SubjectNotFnError
```

Правила раздела держат только пробы главы.

### case · QSBLD#answer

QSBLD#answer: «`::fn/returns/kinds/NotGivenError` refusing none given and `::fn/SignatureNotCommandsError` an empty set». Кейс на пустое множество не написан, а кейс на `NotGivenError` лежит в `QSBLD/fn.jsonl:19` «returns-with-a-page-and-no-kinds-is-refused», под чужим разделом.

```
$ grep -rhoE 'returns [^"]*#\[\]' core/test/conformance | wc -l
0
```

```qlang
> ::fn | returns |~~ r ~~| #[] !| type
::fn/SignatureNotCommandsError
```

Одно правило раздела без кейса, второе показано кейсом раздела `fn`.

### case · QSBLD#recipe

QSBLD#recipe: «A recipe written alone under a label is the function of no commands it is: args given to it are refused as `…/ArgsBeyondInputsError`». В `recipe.jsonl` нет такого кейса. Близкий кейс `QSBLD/input.jsonl:34` «a-word-of-no-inputs-reads-its-args» показывает это правило, но лежит в `input`.

```
$ grep -rhoE ':[a-z]+/[a-z]+ ~\([^"]*ArgsBeyondInputs' core/test/conformance/QSBLD | wc -l
0
```

```qlang
> :any/n ~(args | count) | 5 | n 1 !| type
::any/n/ArgsBeyondInputsError
```

Это правило раздела не держит ни один его кейс.

### case · QSBLD#chain

Кейсы `QSBLD/chain.jsonl:7–9` «a-noun-lists-the-refusals-of-its-verbs», «a-step-lists-its-refusals-on-its-noun» и «a-noun-lists-each-refusal-once» показывают, что исходник существительного перечисляет отказы своих мест. Это правило QSERR#site («A refusal is declared in the source of the place it guards») и QSSLF#manifest («a noun the refusals its source declares»), а не правило QSBLD#chain о декларации вне цепи.

```
$ grep -o '"name":"[^"]*"' core/test/conformance/QSBLD/chain.jsonl | sed -n '7,9p'
"name":"a-noun-lists-the-refusals-of-its-verbs"
"name":"a-step-lists-its-refusals-on-its-noun"
"name":"a-noun-lists-each-refusal-once"
```

Эти три кейса стоят не в том разделе, чьё правило они показывают.

### case · QSERR#print

QSERR#print говорит о том, как ошибка печатается: «A failure prints as its error at rest with the path it flew among its facts, `:trail []` for one that flew no step». Оба кейса раздела сверяют значение, а не print, потому что раннер сравнивает результаты через `deepEqual`. Значит, они показывают факты и trail [QSERR#site], [QSERR#trail], а не печать. Кроме того, раннер в `conformance.test.mjs:5` ссылается на это правило как на [QSERR#rest].

```
$ grep -o '"name":"[^"]*"' core/test/conformance/QSERR/print.jsonl
"name":"a-failure-prints-as-its-error-at-rest-raised"
"name":"a-read-that-misses-flies-its-path"
$ sed -n '6p' core/test/unit/conformance.test.mjs
// Both are eval'd, results compared via deepEqual.
```

Ни один кейс раздела не держит его правило печати.
