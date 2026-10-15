<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 3d6ad533 and checking docs/spec/QSBLD-functions-and-kinds.md and docs/spec/QSERR-errors.md, on 2026-10-15 from 07:04 to 07:20 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 3d6ad533. -->

### design · QSBLD#fn

«A function prints as its literal, the chain folded into a quote and its recipe after it, which the constructor of `::fn` reads back.» Здесь функция примитива и её печать, прочитанная обратно, равны по `eq`, но `apply` отвечает на них по-разному:

```qlang
> ::number/add | binding | get /value | :f it | print | parse | apply it | :g it | get [~(f | eq g) ~(5 | apply f [1]) ~(5 | apply g [1] !| type)]
[true 6 ::fn/RecipeMissingError]

> ::fn/RecipeMissingError | doc | content | lines | first
"A contract, a function with no recipe, runs nothing: `impl`"

> :B |~~ B. ~~| (::kind | impl ::builtin{}) | ::B[1] | type
::B
```

Два равных значения расходятся на одном вызове. Страница отказа называет `::fn[… ::builtin{}]` функцией «with no recipe», хотя рецепт `::builtin{}` у неё есть. Тот же `::builtin{}` читателя у вида (случай `kind.jsonl` «a-reader-kind-with-the-check-of-its-host-lays-its-tag») молча кладёт тег. QSBLD#kind этого правила не формулирует: он называет `impl ::builtin{}` только «the check a host hands a kind of the core». Вопрос: что должен отвечать `apply` на функцию, равную по `eq` функции, которую он выполняет?

### conflict · QSERR#flow, QSERR#catch

QSERR#flow: «Code a word runs that answers a failure answers the word». QSERR#catch: «A failure lives in the pipe alone: `|` passes it by, and `!|` alone catches it». QSCND#coalesce и страница `::any/coalesce` говорят обратное: «Code that answers a failure is taken as no value, as null is».

```qlang
> {} | coalesce ~(get /a) ~(1)
1

> [{}] | map ~(get /a) !| type
::path/KeyNotInMapError
```

Две главы задают для кода, который отвечает отказом внутри слова, два разных правила. Второе к тому же ловит отказ без `!|`.

### implementation · QSBLD#input

«An input holds the value of its kind the walk of its tags reaches». Случай `input.jsonl` «an-input-takes-the-value-of-its-kind-beneath-the-tags» снимает все теги с числа. Вход `::map` или `::vec` сохраняет один тег, и именно самый внутренний:

```qlang
> :any/m (::fn | takes :x |~~ x ~~| /0 ::map | impl ~(x)) | null | get [~(m ::T{:a 1}) ~(m !{:a 1}) ~(m ::T::U{:a 1}) ~(m {:a 1})]
[::T{:a 1} !{:a 1} ::U{:a 1} {:a 1}]

> :any/m (::fn | takes :x |~~ x ~~| /0 ::vec | impl ~(x)) | null | get [~(m ::T[1]) ~(m ::T::U[1]) ~(m #[1])]
[::T[1] ::U[1] #[1]]

> :any/m (::fn | takes :x |~~ x ~~| /0 ::set | impl ~(x)) | null | get [~(m ::T#[1]) ~(m ::T::U#[1])]
[#[1] #[1]]

> :any/m (::fn | takes :x |~~ x ~~| /0 ::number | impl ~(x | type)) | null | get [~(m ::T#1) ~(m ::T::U#1)]
[::number ::number]
```

Входы чисел и множеств снимают все теги. Входы векторов и отображений снимают все, кроме последнего, так что `::T::U{…}` отдаётся как `::U{…}`. Вопрос: какое значение должен получать рецепт, когда значение вида лежит под одним или несколькими тегами?

### design · QSBLD#input

«args past the places the inputs read, where every input reads a numbered place, under the call as `…/ArgsBeyondInputsError`, while an input that reads `/-1`, the args whole or code of several steps takes any number». Путь `/0` и код из одного шага `~(get /0)` читают одно и то же место, но лишние аргументы обрабатывают по-разному:

```qlang
> :vec/top (::fn | takes :n |~~ n ~~| /0 ::number | impl ~(take n)) | [5 1 4 2] | top 1 2 !| get [~(type) /places]
[::vec/top/ArgsBeyondInputsError 1]

> :vec/top (::fn | takes :n |~~ n ~~| ~(get /0) ::number | impl ~(take n)) | [5 1 4 2] | top 1 2
[5]

> :vec/top (::fn | takes :n |~~ n ~~| ~(get /0) ::number | impl ~(take n)) | [5 1 4 2] | top !| type
::vec/top/n/NotGivenError
```

Путь и код, читающие одно место, по-разному отвечают на один вопрос. Код к тому же строг к пропуску (`NotGivenError`), но не к лишнему. Вопрос: когда место, прочитанное кодом из одного шага, считается нумерованным?

### design · QSERR#site

«The refusal of an input's value lives under the input, whether an invariant or a primitive raises it, and what a run answers under the word.» Случай `site.jsonl` «each-value-the-call-gives-is-refused-with-its-index» фиксирует отказ под `::vec/sum`. В зависимости от того, передано ли значение готовым или путём, текст на месте числа у `sumOf` отказывается по-разному:

```qlang
> {:b "x"} | get [~(sumOf 1 (get /b) !| get [~(type) /index]) ~(sumOf 1 /b !| get [~(type) /index])]
[[::any/sumOf/numbers/ElementKindNotTakenError 1] [::vec/sum/ElementNotNumberError 1]]
```

Значение и путь дают на один вопрос два адреса. Второй не лежит ни под входом `numbers`, ни под словом `sumOf`. Вопрос: под каким адресом должен лежать отказ значения, которое вход прочитал по пути?

### design · QSBLD#fn

QSNAM#address: «a function or a quote under a label a word». QSBLD#fn допускает функцию без рецепта («a function whose recipe is no code, a primitive's or none»), но не говорит, что с ней происходит при вызове. Контракт под меткой — не слово, а `apply` на него даёт третий ответ:

```qlang
> :number/c (::fn | takes :x |~~ x ~~| /0) | 5 | c 1 !| get [/name /nearest]
[:c []]

> :number/c (::fn | takes :x |~~ x ~~| /0) | 5 | number/c 1 !| type
::call/ValueTakesNoModifiersError

> :number/c (::fn | takes :x |~~ x ~~| /0) | ::number | manifest | has ::number/c
true

> 5 | apply (::fn | takes :x |~~ x ~~| /0) [1] !| type
::fn/RecipeMissingError
```

Голое имя, адрес и `apply` по-разному отвечают на вызов одной и той же функции под меткой. Правило `::fn/RecipeMissingError` записано на странице и в законе `fn.qlang`, но не в главе. Вопрос: что должен отвечать вызов контракта, объявленного под меткой?

### design · QSERR#catch

«A value written after `!|` is the recovery the catch answers.» QSSYN#step: «a path, which the habit wrote there to read a fact of the error, is refused as after `|`».

```qlang
> "!{:k 1} | raise !| /k" | parse !| get /message
"a path is a value, which the word that takes it reads: write `get /k`"

> !{:k 1 :j 2} | raise !| [/k /j]
[/k /j]

> "{:k 1} | [/k]" | parse !| get /message
"a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`"
```

После `!|` голый путь отказывается как привычка читать факт, а шаблон из путей — та же привычка — молча отвечает данными. После `|` отказываются обе формы. Вопрос: как после `!|` должен читаться литерал, который держит пути?

### implementation · QSERR#trail

«a trail other than a plain vector of maps, each holding a quote under `:skipped`, is refused as `::error/TrailNotVecError`». Страница `::error/TrailNotVecError` говорит то же: «no plain vector».

```qlang
> {:trail ::T[]} | raise !| type
::error

> {:trail [::T{:skipped ~()}]} | raise !| type
::error

> {:trail #[]} | raise !| type
::error/TrailNotVecError

> {:trail [{:skipped ::T~()}]} | raise !| type
::error/TrailNotVecError
```

Вектор под тегом и отображение под тегом проходят как след, а quote под тегом отказывается. Ни один случай этого не фиксирует. Вопрос: должен ли «plain» отказывать и тегу над вектором и над остановкой?

### design · QSERR#trail

«one that writes its `:trail`, empty among them, resumes that path when raised and adds no stop». QSERR#print: «the error at rest `!|` grounds it to holds no empty `:trail`». Страница `::map/raise`: «an error at rest raised again is itself».

```qlang
> get [~(!{:a 1 :trail [{:step ~(pre) :subject 1 :skipped ~()}]} | :e it | raise !| eq e) ~(!{:a 1 :trail []} | :e it | raise !| eq e)]
[true false]

> {:a 1 :trail []} | raise | count !| trail
[]
```

Каждое правило по отдельности соблюдено, но вместе ошибка в покое с выписанным пустым следом, поднятая и пойманная, перестаёт быть собой. Пропущенный ею `count` не попадает никуда. Вопрос: что должен давать `raise … !|` для ошибки, которая сама выписала пустой путь?

### conflict · QSERR#site

«The refusal of a primitive takes the address of the word that ran it» и в том же разделе «a refusal of the language's own steps sits under the kind of that step, `::path`, …». QSSYN#step отказывает пути как шагу, а QSPTH#value говорит: «A path is a value … and the word that takes it reads it».

```qlang
> {} | get [~(get /b !| type) ~(put /a/b 1 !| type) ~(update /a ~(1) !| type)]
[::path/KeyNotInMapError ::path/KeyNotInMapError ::path/KeyNotInMapError]
```

Отказ примитивов `get`, `put` и `update` лежит не под словом, которое их выполнило, а под `::path`. Этот вид раздел называет видом «шага», а другие главы шагом путь не считают.

### conflict · QSBLD#input, QSBLD#recipe

QSBLD#input: «the invariant holding of the value as the call gives it, its tags among it». QSBLD#recipe: «an invariant its input's value alone», где значение входа — «the value of its kind the walk of its tags reaches».

```qlang
> :any/m (::fn | takes :x |~~ x ~~| /0 ::number | holds :x/BadError |~~ b ~~| ~(type | eq ::number) | impl ~(x | type)) | null | get [~(m 5) ~(m ::W#5 !| get [~(type) /actualValue])]
[::number [::any/m/x/BadError ::W#5]]
```

Два раздела по-разному описывают, что видит инвариант входа. Дерево следует первому: инвариант отказывает `::W#5`, хотя виды входа его принимают и рецепт получил бы `5`. При этом инвариант вида по QSBLD#value держится «of the payload beneath the tag».

### text · QSBLD#fn

«A refusal and an invariant written with a path stand under an input taken before it or under the answer, an invariant and a fact always written so». Случай `fn.jsonl` «a-function-carries-a-fact-of-a-refusal-under-its-name» ставит факт под отказ:

```qlang
> ::fn | throws :TooBigError |~~ t ~~| | carries :TooBigError/note |~~ n ~~| | type
::fn

> ::fn | carries :TooBigError/note |~~ n ~~| | throws :TooBigError |~~ t ~~| !| type
::fn/FactUnderNoNameError
```

Фраза помещает факт под вход или ответ, а случай и дерево — под любое имя, объявленное до него, как QSBLD#kind и пишет для вида («a law or a fact under a name declared before it»).

### text · QSBLD#fn, QSBLD#kind

QSBLD#fn: «an input's of one segment beside the names `answer` and `subject`». QSBLD#kind: «a field's and a page's of one segment beside `payload` and `construct`» — и дальше только `::kind/NameDeclaredTwiceError`. Страницы исключают ещё «the words of a literal», и вид отказывает под отказом, которого глава не называет:

```qlang
> ::fn | takes :null |~~ w ~~| /0 !| type
::fn/SignatureNotCommandsError

> ::kind | reads :null |~~ w ~~| /w !| type
::kind/SignatureNotCommandsError

> ::kind | reads :a/b |~~ w ~~| /w !| type
::kind/SignatureNotCommandsError

> :any/m (::fn | takes :xs |~~ X ~~| /0 [::number] | impl ~(xs)) | null | m [1]
[1]
```

Страницы и дерево исключают слова литералов, и глава этого не формулирует. Страница `::fn/SignatureNotCommandsError` перечисляет виды входа как «a tag or a set of tags», упуская вектор видов, который QSBLD#input задаёт («Kinds written as a vector of one tag or of one set»).

### text · QSBLD#chain

«A page, a law and any other value a reader declares by name under a word or a label lie there for `doc`, `manifest` and `runLaws`.» Страница `::bind/WrittenOutsideItsChainError` говорит уже: «A page and a law are declared by a name under any of them».

```qlang
> :any/k ~(5) | :any/k/helper ~(1) !| get [~(type) /name]
[::bind/WrittenOutsideItsChainError :any/k/helper]

> :any/k ~(5) | :any/k/n 3 | ::any/k | manifest
#[::any/k/n]
```

Любая quote и любой путь под словом читаются как вход и отказываются, а глава относит их к «any other value», которое там лежит.

### text · QSPTH#template, core/src/runtime/raise.mjs:12, core/src/grammar.peggy:138

«A part that answers a failure is the answer of the template, the parts after it unread [QSERR#rest].» Это правило формулирует QSERR#flow, а не QSERR#rest. Код так же цитирует разделы, которые этих правил не содержат:

```
$ grep -n "QSERR#rest" core/src/runtime/raise.mjs core/src/runtime/print.mjs core/src/eval-trail.mjs
core/src/runtime/raise.mjs:2:// track as an error [QSERR#rest].
core/src/runtime/raise.mjs:12:// [QSERR#rest]. A map that writes `:trail` resumes that path [QSERR#rest].
core/src/runtime/print.mjs:29:// literal passes over [QSERR#rest].
core/src/eval-trail.mjs:2:// alone [QSERR#rest], and its `:trail` holds a stop at every step that
core/src/eval-trail.mjs:21:// holds no `:trail` [QSERR#rest].
$ grep -n "QSERR#site\]\|QSBLD#fn\]\.\|QSBLD#kind\]; any" core/src/grammar.peggy
8:// line runs on to the next declaration [QSBLD#fn]. Every combinator is set
138:  // catch; a combinator stands once between two steps [QSERR#site].
459:// one step, as a body is [QSBLD#fn]. The body of a bare name with its page,
461:// the noun it names, `:Box |~~ … ~~| ::kind | wraps …` [QSBLD#kind]; any other
500:// may be too [QSBLD#fn].
```

Правила `raise` (QSERR#raise), пути (QSERR#trail) и печати (QSERR#print) процитированы как QSERR#rest. Правило «один комбинатор между шагами» — как QSERR#site, хотя это QSSYN#combinator. Раскладка тела и док в позиции модификатора процитированы как QSBLD#fn/QSBLD#kind, хотя это QSSYN#line и QSSYN#doc.

### case · QSBLD#fn, QSBLD#answer, QSBLD#kind, QSERR#trail

Ни один случай не держит отказы, которые формулируют эти разделы: `::fn/SignatureNotCommandsError`, `::fn/NameDeclaredTwiceError`, `::fn/NameUnderNoInputError`, `::fn/LawUnderNoNameError`, `::any/apply/args/KindNotTakenError`, `::fn/fill/RecipeNotCodeError`, `::fn/returns/kinds/NotGivenError`, `::kind/RecipeNotBuiltinError`, `::kind/FactUnderNoNameError`, `::error/trail/SubjectNotErrorError`.

```
$ grep -rcE "fn/NameDeclaredTwice|fn/SignatureNotCommands|NameUnderNoInput|fn/LawUnderNoName|apply/args/KindNotTaken|RecipeNotCode|RecipeNotBuiltin|kind/FactUnderNoName|returns/kinds/NotGiven|RecipeMissing|trail/SubjectNotError" core/test/conformance/QSBLD core/test/conformance/QSERR
core/test/conformance/QSBLD/answer.jsonl:0
core/test/conformance/QSBLD/chain.jsonl:0
core/test/conformance/QSBLD/fn.jsonl:0
core/test/conformance/QSBLD/input.jsonl:0
core/test/conformance/QSBLD/kind.jsonl:0
core/test/conformance/QSBLD/label.jsonl:0
core/test/conformance/QSBLD/recipe.jsonl:0
core/test/conformance/QSBLD/value.jsonl:0
core/test/conformance/QSERR/catch.jsonl:0
core/test/conformance/QSERR/flow.jsonl:0
core/test/conformance/QSERR/print.jsonl:0
core/test/conformance/QSERR/raise.jsonl:0
core/test/conformance/QSERR/rest.jsonl:0
core/test/conformance/QSERR/site.jsonl:0
core/test/conformance/QSERR/trail.jsonl:0
```

Правила обоих разделов стоят без случаев. В QSERR/flow нет случая на отказ в ветке `if`, хотя раздел её называет.

### case · QSBLD#answer, QSDSP#residence, QSERR#raise

Часть случаев стоит не под тем разделом, чьё правило показывает:

```
$ grep -n "SubjectKindNotTakenError" core/test/conformance/QSBLD/answer.jsonl
10:{"name":"the-subject-of-a-function-apply-runs-is-refused-by-its-role","query":"true | apply (::fn | on |~~ A number or a text. ~~| #[::number ::string] | impl ~(it)) [] !| get [~(type) /expected]","expect":"[::fn/call/SubjectKindNotTakenError #[::number ::string]]"}
$ grep -n "raise/SubjectNotMapError" core/test/conformance/QSDSP/residence.jsonl
20:{"name":"raise-resides-on-the-map","query":"5 | raise !| type","expect":"::map/raise/SubjectNotMapError"}
$ grep -c "SubjectNotMapError" core/test/conformance/QSERR/raise.jsonl
0
$ grep -n "atoms-of-its-facts" core/test/conformance/QSERR/raise.jsonl
13:{"name":"an-error-comes-back-from-the-atoms-of-its-facts","query":"#[1 :k :trail ::FooError] | get [/3 ~(get [[/1 /0] [/2 []]] | indexBy ~(first) | map ~last)] | tag | raise","expect":"::FooError!{\n  :k 1\n  :trail []\n} | raise"}
```

- Субъект функции под `apply` — правило QSBLD#fn, а случай стоит в QSBLD/answer.
- Отказ `raise` не-отображению — правило QSERR#raise, а его единственный случай стоит в QSDSP/residence. Часть «a value under a tag over another value» не держит ни один случай.
- `raise.jsonl:13` показывает правило QSLIT#atoms.
- `kind.jsonl:12–14` («…refused-with-the-kinds-expected») показывают `:expected` из QSBLD#value.

### apophasis · QSBLD#input, QSBLD#answer, QSERR#site

Три фразы обосновывают правило будущим изменением, а не формулируют то, что верно:

- QSBLD#input: «the kinds it takes its `:expected`, a set of tags, so the name stays while the kinds of the input grow».
- QSBLD#answer: «so a kind that joins the answer changes no tag».
- QSERR#site: «its kinds the fact `:expected`, so a kind that joins a holder changes no tag».

```qlang
> 1 | add "x" !| get [~(type) /expected /actualType]
[::number/add/addend/KindNotTakenError #[::number] ::string]
```

Правило (отказ назван по роли держателя, виды стоят в `:expected`) уже сказано в каждой из фраз, а придаточное с «so» к нему ничего не добавляет: это обоснование через рост видов.
