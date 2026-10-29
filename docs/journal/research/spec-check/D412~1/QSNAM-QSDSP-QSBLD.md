> A check of the chapters `QSNAM`, `QSDSP`, `QSBLD` for D412 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–00:11 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### text · QSDSP#answer
«…and the distinct elements beneath the tag of a vector, a quote or a doc stay under it by `within ~(distinct)`.»

```qlang
> get [~(::Box[2 1 2] | within ~(distinct)) ~(~(a | a) | within ~(distinct) !| tag) ~(|~~ a ~(b) ~(b) ~~| | within ~(distinct) !| tag)]
[::Box#[1 2] ::quote/PayloadKindNotTakenError ::doc/PayloadKindNotTakenError]
```

Для цитаты и дока предложение расходится с [QSLIT#tag]: там цитата и док принимают payload как вектор по его собственному тегу, а множество таким вектором не является. Поэтому дерево и отказывает; держится правило только для вектора под тегом (кейс `the-set-of-the-elements-beneath-the-tag-of-a-vector-is-made-within-it`).

### design · QSBLD#kind
«A `::builtin{}` constructs within the kind its host handed it with … and within no other»; конструктор `::number` при этом «refuses a number past the doubles».

```qlang
> :N |~~ N ~~| (::number | binding | value); :S |~~ S ~~| (::set | binding | value); get [~(5 | tag ::N !| tag) ~(::N | binding | value | eq (::number | binding | value)) ~(::S[3 1 3])]
[::number/NotFiniteError true ::S#[1 3]]
```

Метка, связанная с kind'ом `::number` (тело-имя kind'а разрешено, кейс `a-body-reads-a-label-by-its-bare-name`), сохраняет конструктор хоста. Этот конструктор вызывается только за пределами double, поэтому конечное `5` под `::N` отвергается как `::number/NotFiniteError`. Каким должен быть согласованный ответ на `5 | tag ::N`, если `:N` держит kind `::number`?

### conflict · QSBLD#fn
Глава: «A refusal and an invariant are named one level under the function by a name of one segment, `:ByTooBigError`, a path in it refused as a command not taken». Страница `::fn/throws/modifiers`: «the name of the refusal, a keyword read as a tag, under the subject, an input or the answer where it is written with a path». Страница `::fn/throws` говорит то же.

```qlang
> get [~(::fn/throws/modifiers | doc | content | contains "where it is written with a path") ~(::fn | takes :by |~~ b ~~| /0 | throws :by/TooBigError |~~ t ~~| !| get [~(tag) ~(index)])]
[true [::fn/CommandNotTakenError 0]]
```

Страницы разрешают отказу имя с путём; глава, кейс `a-refusal-named-with-a-path-is-refused` и дерево его отвергают.

### conflict · QSBLD#kind
Глава: «a refusal and an invariant are named one level under the kind by a name of one segment, `:WNegativeError`, a path in it refused as a command not taken». Страница `::kind/throws/modifiers`: «the name of the refusal, a keyword read as a tag, under a field read before it where it is written with a path».

```qlang
> get [~(::kind/throws/modifiers | doc | content | contains "under a field read before it where it is") ~(::kind | wires :width |~~ w ~~| /width | throws :width/TooBigError |~~ t ~~| !| get [~(tag) ~(index)]) ~(::kind/CommandNotTakenError/refusesARefusalNamedWithAPath | binding | value | tag)]
[true [::kind/CommandNotTakenError 0] ::law]
```

Страница разрешает отказ с путём под полем, а её собственный закон `refusesARefusalNamedWithAPath`, глава и дерево его отвергают.

### conflict · QSNAM#binding
Глава: «`::host | env` answers … in code its own names and the nodes and the labels of the step it runs in [QSQUO#held]». Страница `::host/env`: «Inside a fork it holds the names before the fork and the fork's own, and the fork's stay inside it, and so does code a step wrote».

```qlang
> :rate 2; get [~(:Crate |~~ A crate. ~~|; ::host | env | keys) ~(::host | env | keys)]
[#[:Crate] #[]]

> :rate 2; (:Crate |~~ A crate. ~~|; ::host | env | keys)
#[:Crate :rate]

> ::host/env | doc | content | contains "and so does code a step wrote"
true
```

По странице код, который написал шаг, держит значения, объявленные до форка. Дерево и глава держат в нём только его собственные имена, узлы и метки. Закон страницы `holdsTheNamesOfAForkAndKeepsThemInside` проверяет только метку `:Box`.

### implementation · QSBLD#fn
«A name is declared once, `::fn/NameDeclaredTwiceError` refusing a name declared again, an invariant named as a refusal the runtime raises by rule among them».

```qlang
> get [~(::fn | takes :x |~~ x ~~| /0 | holds :XNotGivenError |~~ n ~~| ~(false) !| tag) ~(::fn | takes :x |~~ x ~~| /0 | holds :ArgsBeyondInputsError |~~ n ~~| ~(false) | tag)]
[::fn/NameDeclaredTwiceError ::fn]

> :number/f (::fn | takes :x |~~ x ~~| /0 | holds :ArgsBeyondInputsError |~~ never ~~| ~(false) | impl ~(x)); get [~(5 | f 1 !| get [~(tag) ~(payload | keys)]) ~(5 | f 1 2 !| get [~(tag) ~(payload | keys)])]
[[::number/f/ArgsBeyondInputsError #[:subject/found :trace :x/found]] [::number/f/ArgsBeyondInputsError #[:subject/found :surplus/found :trace :x/found]]]

> :number/f (::fn | holds :SubjectNotNumberError |~~ n ~~| ~(false) | impl ~(1)); get [~(5 | f !| tag) ~("x" | f !| tag)]
[::number/f/SubjectNotNumberError ::number/f/SubjectNotNumberError]
```

Дерево отвергает инвариант с именем `…NotGivenError`, но принимает `ArgsBeyondInputsError` и `SubjectNotNumberError`, а это тоже отказы, которые runtime поднимает по правилу ([QSBLD#input], [QSERR#site]). В итоге один тег отвечает за два разных правила. Должны ли эти имена отвергаться для `holds` так же, как `:XNotGivenError`?

### design · QSBLD#fn
«a payload or a `trace` the quote writes refused as `::kind/NameDeclaredTwiceError`; a refusal of a verb is its verdict, the slots of the verb wired before the facts the quote writes».

```qlang
> get [~(::fn | throws :E |~~ e ~~| ~(wires :trace |~~ t ~~|) !| tag) ~(::fn | throws :E |~~ e ~~| ~(wires :subject |~~ s ~~|) | tag)]
[::kind/NameDeclaredTwiceError ::fn]

> :number/f (::fn | throws :E |~~ e ~~| ~(wires :subject |~~ S ~~|) | impl ~(::number/f/E!{} | raise)); get [~(::number/f | binding | value | tag) ~(5 | f !| tag) ~(::number/f/E | doc !| tag) ~(::number/f | manifest | has ::number/f/E)]
[::fn ::kind/NameDeclaredTwiceError ::kind/NameDeclaredTwiceError true]
```

Повторное объявление имени в цитате `throws` отвергается по-разному: `trace` — сразу в цепочке, а факт с именем слота глагола проходит цепочку и объявление, после чего каждое чтение и каждый `raise` этого отказа падает. Где должен отвергаться факт, названный слотом глагола?

### implementation · QSNAM#reach
«A name that reaches nothing is refused as `::call/UnknownNameError`, with the names near it»; в #declare: «a verb called there is refused as `::bind/SubjectNotGivenError`».

```qlang
> get [~(~(:x cout; 1) | answer !| get [~(tag) ~(payload | keys)]) ~(~(:x vec/cout; 1) | answer !| get [~(tag) ~(nearest)]) ~(5 | cout !| get [~(tag) ~(nearest)])]
[[::bind/SubjectNotGivenError #[:name :trace]] [::call/UnknownAddressError [::vec/count]] [::call/UnknownNameError [:count :out]]]
```

В теле объявления имя, которое ничего не достигает, отвергается как вызов глагола без субъекта и без `:nearest`, тогда как неизвестный адрес там же получает `UnknownAddressError` с `:nearest`. Как согласованно должно отвергаться в теле неизвестное голое имя?

### text · QSDSP#walk
«and a tag the walk of a value reaches, laid over it, changes nothing [QSLIT#tag]».

```qlang
> ::Pos#-3 | apply ~(:Pos |~~ P ~~| (::kind | holds :NotPositiveError |~~ Above zero. ~~| ~(gt 0)); get [~(is ::Pos) ~(tag ::Pos !| tag)])
[true ::Pos/NotPositiveError]
```

Предложение опускает правило, которое держат [QSLIT#tag], [QSBLD#label] и страница `::any/tag`: внешний тег значения кладётся заново через свой kind и может отказать.

### text · QSNAM#address
«Written as a step, an address reads what it declared, … and any other value itself, whatever the subject».

```qlang
> apply ~(:Box |~~ A box. ~~|; :Box/side 3; get [~(5 | (Box/side)) ~(5 | Box/side !| tag)])
[3 ::call/ValueAsALaterStepError]
```

Предложение расходится с [QSNAM#value] («a node of data read by its address is refused there alike») и с кейсом `a-node-of-data-written-as-a-later-step-is-refused-as-a-value-is`: как поздний шаг узел данных отвергается.

### implementation · QSNAM#letters
«A name a step can call begins with a letter of any script or `_` and goes on with letters, digits, `_` and `-`». То же говорят кейс `a-name-begins-with-a-letter-of-any-script-or-an-underscore-and-goes-on-with-a-hyphen` и страница `::qlang/names`.

```qlang
> get [~(":𐐀 5; 𐐀" | parse !| get [~(tag) ~(found)]) ~(":имя 5; имя" | parse | answer) ~(":a·b 5; a·b" | parse | answer) ~(":a‿b 5; a‿b" | parse | answer)]
[[::quote/ParseError "𐐀"] 5 5 5]
```

```sh
$ grep -n "first plane" core/test/unit/QSNAM/letters.test.mjs
14:  it('reads no letter past the first plane of Unicode in the regex of a name, as the parser reads a character a code unit', async () => {
31:  it('reads no letter past the first plane of Unicode as the start of a bare name, and its quoted form takes it', () => {
```

Грамматика читает символ по code unit, поэтому буква письменности вне базовой плоскости (Deseret) именем не становится. При этом `·` и `‿`, которые не буквы и не цифры, внутрь имени проходят; тесты секции держат правило, которого глава не формулирует. Какие символы согласованно должны начинать и продолжать имя?

### case · QSDSP#tagname
Кейс `the-verbs-of-tag-names-come-before-the-verbs-of-the-noun-a-tag-names` (`::number | gt ::A`) и такой же пробник под «so a bare name after it finds the tag's own verbs first, then the noun's».

```qlang
> get [~(::number | gt ::A) ~(::number | binding :gt | name) ~(::tag | manifest | has ::tag/gt) ~(::number | toString) ~(::number | number/toString !| tag)]
[true :any/gt false "number" ::number/toString/SubjectNotNumberError]
```

`gt` живёт на `::any`, нет ни `::tag/gt`, ни `::number/gt`, так что кейс показывает правило [QSCND#compare], а не порядок «тег, затем существительное»; порядок виден на `toString`.

### implementation · QSBLD#fn
«a law with a path stands under a name declared before it, a refusal among them». Страницы `::fn/proves` («a refusal, a fact or the answer»), `::fn/LawUnderNoNameError` и `::kind/LawUnderNoNameError` включают в этот список факт.

```qlang
> get [~(::fn | throws :TooBigError |~~ t ~~| ~(wires :bound |~~ b ~~| ::number) | proves :TooBigError/bound/holds |~~ p ~~| ~(true) !| tag) ~(::fn/proves | doc | content | contains "a refusal, a fact or the answer") ~(::fn/LawUnderNoNameError | doc | content | contains "an invariant, a fact")]
[::fn/LawUnderNoNameError true true]
```

Закон под фактом отказа страницы разрешают, а дерево отвергает его как `LawUnderNoNameError`; ни один кейс этого правила не держит. Должен ли закон стоять под фактом?

### design · QSBLD#input
«inside a recipe `args` reads them»; [QSBLD#fn] запрещает входу только имена «`subject`, `surplus`, `answer`, `repair` and `trace`».

```qlang
> :number/f (::fn | takes :args |~~ a ~~| /0 | takes :n |~~ n ~~| /1 | impl ~(args)); :number/g (::fn | takes :a |~~ a ~~| /0 | takes :n |~~ n ~~| /1 | impl ~(args)); get [~(5 | f 1 2) ~(5 | g 1 2) ~(::fn | takes :answer |~~ a ~~| /0 !| tag)]
[1 ::number/g[1 2] ::fn/CommandNotTakenError]
```

На одно имя в рецепте претендуют два правила: `args` читает args, а каждый вход читается по своему имени. Цепочка вход `:args` принимает, и в рецепте он молча перекрывает args. Что согласованно должно читать `args` в таком рецепте?

### conflict · QSDSP#walk
Глава: «the walk stops at it, the names its kind wires, its words and those of `::tagged` and `::any` serving its value». Страница `::any/is`: «a value of a kind that wires its parts is of that kind alone». Страница `::call/KindAnswersNoVerbError`: «answers the verbs of its kind and of every value alone».

```qlang
> :Card |~~ A card. ~~| (::kind | accepts |~~ The parts. ~~| ::vec | wires :took |~~ The seconds. ~~| /1 ::number); ::Card["a" 312] | get [~(is ::tagged) ~(binding :within | name) ~(within ~(append 1) | took) ~(is ::vec)]
[true :tagged/within 312 false]

> get [~(::any/is | doc | content | contains "is of that kind alone") ~(::call/KindAnswersNoVerbError | doc | content | contains "of every value alone")]
[true true]
```

Обе страницы не упоминают `::tagged`, до которого обход закрытого значения доходит и по главе, и по дереву.

### text · QSBLD#label
«The tag of a name that holds a value is refused as `::construct/TagNamesAValueError`».

```qlang
> get [~(::number/add/addend | binding | value) ~(::number/add/addend{:found 1} | tag) ~(1 | add "x" !| addend | tag) ~(apply ~(:limit 5; ::limit[1] !| tag))]
[/0 ::number/add/addend ::number/add/addend ::construct/TagNamesAValueError]
```

Узел входа держит свой селектор `/0`, но его тег не отвергается, а строит слот вердикта ([QSERR#site]). Ни глава, ни страница `::construct/TagNamesAValueError` слот среди строящих тегов не называют.

### conflict · QSDSP#residence
Глава: «The comparisons reside on `::any`».

```sh
$ grep -o -E '"name":"a-comparison-of-[a-z]+-resides-on-[a-z]+"' core/test/conformance/QSDSP/residence.jsonl
"name":"a-comparison-of-strings-resides-on-strings"
"name":"a-comparison-of-keywords-resides-on-keywords"
"name":"a-comparison-of-tags-resides-on-tags"
```

```qlang
> get [~("b" | binding :gt | name) ~(:b | binding :lt | name) ~(::b | binding :gte | name)]
[:any/gt :any/lt :any/gte]
```

Имена трёх кейсов селят сравнения на строки, ключевые слова и теги, а глава и дерево — на `::any`.

### case · QSDSP#refusal
«so a verb the reader declares under a second noun makes the refusal of a name one verb of the root holds the call's, its address beside the root's».

```qlang
> :Box |~~ A box. ~~|; :Box/keys ~(1); 42 | keys !| get [~(tag) ~(addresses)]
[::call/KindAnswersNoVerbError #[::Box/keys ::map/keys]]
```

```sh
$ grep -o -E '; :[A-Z][A-Za-z]*/[a-z][A-Za-z]*' core/test/conformance/QSDSP/refusal.jsonl
; :Box/area
; :Circle/area
```

Правило держит только пробник главы. Кейсы секции объявляют лишь `area`, а это имя не держит ни один глагол корня.

### conflict · QSNAM#declare
«adds a word with its page to the scope of the text» и «A text declares the words its query reads: … and a value under a bare name». Страница `::builtin/RootValueNotWordError`: «A source of the root declares words, a kind, a verb under a label and a node under a noun».

```qlang
> get [~(:rate 2;) ~(~(:Box |~~ A box. ~~| ::vec | manifest;) | answer !| tag) ~(::builtin/RootValueNotWordError | doc | content | contains "declares words, a kind, a verb under a label")]
[#[::rate] ::bind/ChainAnswersNoWordError true]
```

Глава считает значение под голым именем словом; имя и страница отказа `RootValueNotWordError` и страница `ChainAnswersNoWordError` значение из слов исключают.

### text · QSNAM#declare
«Inside a command a name holds a value: in a modifier, in a quote, which declares names of its own, and in the recipe of a verb».

```qlang
> get [~(5 | add (:number/three ~(3); 1 | three)) ~([1] | map ~(:number/three ~(3); 1 | three)) ~(5 | add (:Box |~~ B ~~|; ::Box#1 | payload))]
[8 [3] 6]
```

Предложение сводит объявленное внутри команды к значению, тогда как в модификаторе и в цитате объявляются глагол под меткой и kind.

### conflict · QSNAM#declare
Пример главы «`:Box |~~ A box. ~~|` answering `#[::Box]`» и кейс `a-text-of-declarations-alone-answers-the-addresses-it-declared` пишут последнее объявление без `;`. [QSSYN#step]: «A text … is its declarations, each ended by `;`».

```qlang
> get [~(":rate 2" | parse | answer) ~(":rate 2;" | parse | answer)]
[#[::rate] #[::rate]]
```

Два места спецификации по-разному отвечают, обязан ли последний объявленный текст заканчиваться `;`; дерево принимает оба написания.

### text · QSBLD#chain
«A page, a law and a verb a reader declares by name under a verb or a label lie there for `doc`, `manifest` and `runLaws`».

```qlang
> ~(:number/add/helper ~(1);) | answer !| tag
::bind/WrittenOutsideItsChainError

> :number/add/helper (::fn | impl ~(1)); get [~(::number/add | manifest | has ::number/add/helper) ~(5 | number/add/helper !| tag)]
[true ::call/ValueAsALaterStepError]
```

Под глаголом рецепт отвергается той же секцией («any quote or path a reader declares there»), а функция ложится как данные, а не глагол ([QSNAM#address]: «A verb is a function named under a label»). Глагол под глаголом, о котором говорит предложение, дерево не держит.

### conflict · QSBLD#fn
Глава: «none of the names every verdict holds, `subject`, `surplus`, `answer`, `repair` and `trace`». Страница `::fn/takes/modifiers`: «neither `answer` nor `subject`, which the chain lays itself».

```qlang
> get [~(::fn | takes :trace |~~ t ~~| /0 !| tag) ~(::fn | takes :surplus |~~ t ~~| /0 !| tag) ~(::fn | takes :repair |~~ t ~~| /0 !| tag) ~(::fn/takes/modifiers | doc | content | contains "repair")]
[::fn/CommandNotTakenError ::fn/CommandNotTakenError ::fn/CommandNotTakenError false]
```

Страница называет только два запрещённых имени входа, а глава и дерево запрещают пять.

### conflict · QSBLD#kind
Глава перечисляет команды цепочки kind'а, включая `reveals`. Страница `::kind` перечисляет `accepts`, `wires`, `tells`, `holds`, `throws`, `proves` и `impl`.

```qlang
> get [~(::kind | manifest | has ::kind/reveals) ~(::kind | doc | content | contains "reveals")]
[true false]
```

Страница kind'а и ссылки её `CommandNotTakenError` не называют команду `reveals`, которую держат глава и дерево.

### conflict · QSBLD#kind
Глава: «`impl` its constructor, a `::builtin{}`, another value refused as `::kind/ConstructorKindNotTakenError` as the literal refuses it».

```qlang
> get [~(::kind | impl null) ~(::kind/impl/constructor | doc | content)]
[::kind[~() null] "The constructor, a primitive of the host, `::builtin{}`, or\nnull."]
```

Глава отвергает любое значение, кроме `::builtin{}`, а страница входа и дерево принимают ещё и `null`.

### conflict · QSBLD#label
Кейс `construct-is-a-node-of-the-label-a-literal-runs`; глава: «`construct` a name there like any other».

```qlang
> :Pos |~~ A positive number. ~~| (::kind | impl ::builtin{}); get [~(::Pos#5 | construct !| tag) ~(::Pos | manifest)]
[::call/UnknownNameError #[]]
```

Имя кейса называет `construct` узлом метки, который исполняет литерал, а сам запрос кейса и глава показывают, что такого узла нет.

### conflict · QSNAM#scope
Кейс `a-later-step-of-a-recipe-declares-no-input-again` (запрос `impl ~(:x 3; add 1 | add x)`). [QSSYN#step] отвергает объявление после первого шага запроса.

```qlang
> ":number/m (::fn | takes :x |~~ x ~~| /0 | impl ~(add 1 | :x 3; add x)); 1 | m 2" | parse !| get [~(tag) ~(message | contains "at the head of its text")]
[::quote/ParseError true]
```

Имя кейса описывает объявление поздним шагом рецепта — форму, которую грамматика отвергает; в самом запросе объявление стоит в голове.

### drift · QSBLD#recipe
```sh
$ grep -o -E '"name":"[a-z-]*sentence[a-z-]*"' core/test/conformance/QSBLD/recipe.jsonl
"name":"a-recipe-reads-no-value-of-a-sentence"
"name":"a-value-the-sentence-names-reaches-no-selector-of-a-verb"
"name":"a-value-the-sentence-names-reaches-no-invariant-of-a-verb"
"name":"a-recipe-of-a-function-reads-its-input-past-a-value-of-the-sentence"
"name":"a-value-of-the-sentence-shadows-no-verb-the-recipe-of-a-function-calls"
```

То, что кейсы зовут «sentence», главы называют text ([QSSYN#step]) и «the code that calls the verb» ([QSBLD#recipe]).

### drift · QSDSP#refusal
```sh
$ grep -o -E '"name":"[a-z-]*contract[a-z-]*"' core/test/conformance/QSDSP/refusal.jsonl core/test/conformance/QSBLD/fn.jsonl
core/test/conformance/QSDSP/refusal.jsonl:"name":"the-contract-of-filter-names-its-residences"
core/test/conformance/QSDSP/refusal.jsonl:"name":"the-contract-of-prepend-names-its-residences"
core/test/conformance/QSDSP/refusal.jsonl:"name":"a-contract-names-its-residences"
core/test/conformance/QSBLD/fn.jsonl:"name":"a-contract-under-a-label-refuses-its-call-by-name-and-by-address"
```

То, что глава называет «a name whose verbs reside on several kinds», кейсы QSDSP#refusal зовут «contract», а в [QSBLD#fn] и на странице `::fn` contract — это функция без рецепта.

### pentimento · QSNAM#value
«Written as a later step, a name that holds a value would drop the subject the steps before it answered, as a literal written there would, so it is refused as `::call/ValueAsALaterStepError`». То же обоснование стоит на странице `::call/ValueAsALaterStepError`.

```qlang
> 7 | apply ~(:rest 5; add 1 | rest) !| tag
::call/ValueAsALaterStepError
```

Оборот «would drop the subject … as a literal written there would» — это обоснование правила через то, чего дерево не делает; ни один запуск его не проверит.
