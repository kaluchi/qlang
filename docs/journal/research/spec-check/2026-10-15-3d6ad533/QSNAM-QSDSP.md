<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 3d6ad533 and checking docs/spec/QSNAM-names-and-scope.md and docs/spec/QSDSP-a-word-found-through-its-subject.md, on 2026-10-15 from 07:04 to 07:19 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 3d6ad533. -->

### design · QSNAM#scope
Правило «A name is declared once in a scope: the second declaration is refused where it stands» вместе с QSNAM#declare «a body that answers a failure declares nothing» (и QSERR#flow «the body of a declaration that fails leaves the scope as it was») отказывает объявлению имени, которого в области нет. Объявление, пропущенное на треке ошибки или упавшее, ничего не объявило, а восстановление `!| :x …` всё равно отвергается как повторное:

```qlang
> {} | raise | :x 1 !| env | has :x
false

> {} | raise | :x 1 !| :x 2 | x !| type
::bind/NameDeclaredTwiceError

> :x (1 | div 0) !| env | has :x
false
```

Страница `::bind/NameDeclaredTwiceError` тоже говорит «a declaration of a name one of them declared before is refused». Код (`repeatedDeclarationsOf` в `core/src/walk.mjs`) считает повтор по тексту конвейера, а не по тому, что было объявлено на самом деле. Вопрос: что «declared once» считает объявленным, написанный шаг или исполненный? Последовательный ответ: либо обе пробы с `:x 2` отказывают, либо обе объявляют.

### design · QSNAM#scope
«The body of a word runs in the scope its call opens: …, and the nodes and labels of the scope it is called in. A value the reader bound to a bare name stands outside it». То же самое отделение действует для удержанного кода (QSQUO#held: «its past is … the words, the nodes and the labels»; `isNodeOrLabel` в `core/src/eval.mjs:669`). Одно и то же данное читателя доходит до кода или нет только в зависимости от того, лежит оно под голым именем или под адресом:

```qlang
> :k 3 | :number/f ~(k) | 5 | f !| type
::call/UnknownNameError

> :Box |~~ B ~~| | :Box/k 3 | :number/f ~(Box/k) | 5 | f
3

> :k 3 | :q ~(k) | 5 | apply q !| type
::call/ValueWithheldError

> :Box |~~ B ~~| | :Box/k 3 | :q ~(Box/k) | 5 | apply q
3
```

QSBLD#recipe говорит «A value a recipe needs is an input», однако значение под адресом доходит до рецепта, минуя входы. Вопрос: какой единый ответ дают голое имя и адрес, когда тело слова или удержанный код читает данные читателя?

### design · QSNAM#scope
Чтение значения читателя, которое коду недоступно, отвергается двумя тегами в зависимости от дороги. Удержанный в имени код даёт `ValueWithheldError` (QSQUO#held), тело слова даёт `UnknownNameError` (QSNAM#scope «refused as `::call/UnknownNameError`»):

```qlang
> :k 10 | :q ~(add k) | 5 | apply q !| get [~(type) /name]
[::call/ValueWithheldError :k]

> :k 10 | :number/q ~(add k) | 5 | q !| get [~(type) /name]
[::call/UnknownNameError :k]
```

Здесь расходятся «запрос» (код под голым именем) и «тело слова». Последовательное поведение ответило бы на один вопрос одним тегом.

### design · QSNAM#binding
«`env` answers the declarations of the reader where the step stands, in the body of a word those of the query that called it». По QSQUO#held удержанный код читает только свои имена. В итоге один и тот же шаг `env` после `:y 2` даёт три разных ответа по трём дорогам. Тело слова к тому же не видит страницы имени, которое само только что объявило, а удержанный код её видит:

```qlang
> :x 1 | apply ~(:y 2 | env | keys)
#[:x :y]

> :x 1 | :q ~(:y 2 | env | keys) | apply q
#[:y]

> :x 1 | :any/w ~(:y 2 | env | keys) | w
#[:any/w :x]

> :q ~(:y |~~ Y ~~| 2 | ::y | doc) | apply q
|~~ Y ~~|

> :any/w ~(:y |~~ Y ~~| 2 | ::y | doc) | w !| type
::any/doc/UnknownNameError
```

Страница `::any/env` («Answers what the reader declared before the step… Inside a fork it holds the names before the fork and the fork's own») не описывает ни один из двух последних ответов. Вопрос: что должен отвечать `env` (и `doc` имени, объявленного шагом выше) одинаково на всех трёх дорогах?

### design · QSDSP#residence
«A word is called by its name or by its address…; a set, a quote and a doc are vectors to a word of vectors, each answered back as its own kind». QSDSP#walk: «A word means one act wherever it resolves». Вызов `reverse` на множестве по имени и по адресу `vec/reverse` даёт разные ответы, и по адресу разворот теряется при обратной упаковке в множество:

```qlang
> #[1 2 3] | get [~(reverse) ~(vec/reverse)]
[[3 2 1] #[1 2 3]]
```

Страница `::set/reverse` говорит «the answer is a vector»; QSORD#set говорит «a vector where it answers an order of its own, `sort` and `reverse`». Вопрос: что отвечает слово векторов, вызванное по адресу над множеством, когда его акт — порядок?

### design · QSDSP#residence
Случай `a-name-resides-under-the-label-it-is-declared-under` объявляет функцию хоста под меткой читателя, и она работает как слово. Её печать, прочитанная обратно, равна ей по `eq`, но словом не становится. QSHST#source: «A `::builtin{}` written in the recipe of a word a reader declares is the value it is… its bare name reaches no word»:

```qlang
> ::vec/take | binding | get /value | :f it | print | parse | apply it | eq f
true

> :T |~~ T ~~| | :T/tk (::vec/take | binding | get /value) | ::T[1 2 3] | tk 2
[1 2]

> :T |~~ T ~~| | :T/tk (::vec/take | binding | get /value | print | parse | apply it) | ::T[1 2 3] | tk 2 !| type
::call/UnknownNameError
```

Два значения, равные для `eq` и печатающиеся одинаково, расходятся в том, что делает из них объявление (значение и его литерал). Вопрос: что последовательно: оба становятся словами, ни одно не становится, или они различимы?

### design · QSNAM#value
Факты отказа `::call/ValueTakesNoModifiersError` зависят от того, совпадает ли значение имени с субъектом как объект. `errorFromQlang` (`core/src/error-convert.mjs:55`) выбрасывает `:actualValue` при `value === subject`. QSERR#site выбрасывает его только «out of a refusal of the subject», а здесь отвергнуто значение имени:

```qlang
> [1] | :v it | v 1 !| keys
#[:actualType :addresses :name :trail]

> :v [1] | [1] | v 1 !| keys
#[:actualType :actualValue :addresses :name :trail]
```

Случай `cannot-apply-args-to-value` (`5 | :five it | five 42`) закрепляет в ожидании форму без `:actualValue`. Вопрос: держит ли этот отказ значение имени при равных значениях одинаково, независимо от их идентичности?

### conflict · QSNAM#owner
Глава: «a name under a noun the reader declared reads as the reader wrote it, and the reader's labels go with the reader's values into the word. A word joined to a kind by the kind's owner goes where the kind's values go». Страница `::qlang/names`: «A word the reader declares under a label shadows a word of its name on a broader label in the reader's own calls…, and no word of the root sees it». Первая страница (`::qlang`, п. 7) говорит то же: «which no word of the root sees»:

```qlang
> :Box |~~ A box. ~~| | :Box/doc ~("box page") | ::Box{} | tutorial | first
box page
```

Страницы утверждают это для любой метки без условий, а глава и случай `a-word-of-a-kind-the-reader-declared-answers-inside-a-word-of-the-root` ограничивают это существительными корня.

### conflict · QSNAM#scope
Глава: «A value the reader bound to a bare name stands outside it, a bare step of that name refused as `::call/UnknownNameError`». Страница этого отказа: «A step called a name nothing declares, no name of the scope and no word of any kind… A name is declared before the steps that read it, `:x 5 | x`»:

```qlang
> :n 3 | :number/times ~(mul n) | 5 | times !| get [~(type) /name]
[::call/UnknownNameError :n]
```

Имя объявлено читателем до шага, так что страница называет причиной «nothing declares» и даёт ремонт, который здесь уже выполнен.

### text · QSNAM#binding
«The axes read the record: `binding` the record itself, `source` its source and `doc` its page». QSSLF#axis: «`source` every declaration written under its address». Страница `::any/source` говорит «every declaration under its address», а страница `::any/binding` — «`source` its quote»:

```qlang
> :Box |~~ B ~~| | :Box/a 1 | ::Box | binding | get /source
~(:Box |~~ B ~~|)

> :Box |~~ B ~~| | :Box/a 1 | ::Box | source
~(:Box |~~ B ~~|
| :Box/a 1)
```

Предложение главы и страница `binding` сводят `source` к полю `:source` записи, а QSSLF, страница `source` и дерево — нет.

### text · QSDSP#refusal
«and, where the pages of those words lead to one, `:nearest`, the words they link that the subject answers». Случай `a-refused-word-leads-only-to-a-word-of-its-answer` и страница `::call/KindAnswersNoVerbError` («…that the subject answers and that answer a kind the verbs answer») держат ещё одно условие, которого глава не называет:

```qlang
> ::string/parse | doc | links
[::link~(::quote/parse | doc) ::link~(::any/apply | doc)]

> 42 | parse !| has :nearest
false
```

По правилу главы ответ был бы `:nearest [:apply]`, потому что 42 отвечает на `apply`.

### text · QSNAM#address
QSLIT#tag: «A tag no declaration names, and the tag of a word, lays itself over a payload as it is [QSNAM#address]». QSNAM#address формулирует только первое: «A tag no declaration names lays itself over a payload as it is». Правило о теге слова, на которое ссылается QSLIT (и которое QSBLD#input использует для args, `::number/add[1 2]`), в цитируемой секции не записано:

```qlang
> :number/f ~(1) | ::number/f[1] | type
::number/f
```

Единственный случай про это, `a-tag-of-a-word-no-name-declares-is-identity` (`::code{:a 1}`), по имени говорит о слове, а проверяет незаявленный тег.

### text · QSNAM#reach
«A label… its name written bare is the reader's to declare, and undeclared it is refused as `::call/UnknownNameError`». Имя метки, совпадающее с именем слова, отвечает словом или `KindAnswersNoVerbError`:

```qlang
> 5 | doc | type
::doc

> 5 | map !| type
::call/KindAnswersNoVerbError

> 5 | vec !| get /nearest
[::vec]
```

Предложение не делает исключения, которое делает первое правило той же секции (слово, живущее на метке, до которой доходит обход).

### conflict · core/src/state.mjs:116
«The scopes of the words of the root, where a bare name and the definition of a call read the root alone [QSNAM#owner]». QSNAM#owner ограничивает это: «a name under a noun of the root reads the root alone… a name under a noun the reader declared reads as the reader wrote it»:

```qlang
> :Box |~~ A box. ~~| | :Box/doc ~("box page") | ::Box{} | tutorial | first
box page
```

Комментарий утверждает, что голое имя в слове корня читает только корень, а глава и дерево — нет.

### conflict · QSNAM#letters
Страница `::qlang/names`: «a value the reader names takes any name», то же на странице `::call/ValueMeetsWordError`: «A name of the reader's takes any name». Глава: слова литералов «each declares a label», а имя, которое шаг не может вызвать, отвергается:

```qlang
> ":true 5 | 7" | parse !| get /message
`:true` is the word of a literal, which a step reads as the value: declare another name
```

### case · QSNAM#address
У правила «An address no declaration names, written as a step, is refused as `::call/UnknownAddressError` with its `:address` and the tag names near it as `:nearest`» нет ни одного случая во всём `core/test/conformance/`:

```qlang
> 5 | vec/cout !| get [~(type) /address /nearest]
[::call/UnknownAddressError ::vec/cout [::vec/count]]
```

```
$ grep -rl "UnknownAddressError" core/test/conformance/
```

grep ничего не напечатал.

### case · QSDSP#walk
Правила «a word on a narrower label stands over one of the same name on a broader one» и «`::vec | is ::vec` is false and `::vec | is ::tag` true», а также порядок `::tagged` перед полезной нагрузкой не держит ни один случай в `QSDSP/walk.jsonl`. Первое держится только случаем `QSNAM/owner.jsonl` `a-reader-extension-of-a-noun-of-the-root-answers-the-reader-s-own-call`:

```qlang
> :tagged/count ~(99) | ::Box[1 2] | count
99

> ::vec | is ::vec
false
```

### case · QSNAM#root
У правил «a source declares no name the root holds… and fails whole as `::builtin/RootSourceNotDeclaredError`» и (QSNAM#reach) «a bare name a host's source declares that is no label» нет случаев в `QSNAM/`. Голых имён корня, которые не были бы метками, в каталоге нет: каждое голое объявление в `core/lib/qlang/*.qlang` и `cli/lib/qlang/*.qlang` — это метка (`:any`, `:vec`, …, `:cli`).

```
$ grep -rl "RootSourceNotDeclared" core/test/conformance/
```

grep ничего не напечатал.

### case · QSNAM#declare
Случай `a-verb-moved-left-answers-as-inline` (`:vec/most ~(count | sub 1) | … | take most`) показывает правило QSQUO#modifier («a bare name and a group included, so `take count`»), а не правило объявления:

```qlang
> :vec/most ~(count | sub 1) | {:items [1 2 3] :limit 2} | get /items | take most
[1 2]
```
