<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 985a4b82 and checking docs/spec/QSBLD-functions-and-kinds.md and docs/spec/QSERR-errors.md, on 2026-10-15 from 08:05 to 08:18 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 985a4b82. -->

### conflict · QSERR#catch, QSERR#flow

QSERR#catch: «A failure lives in the pipe alone: `|` passes it by, and `!|` alone catches it». QSERR#flow: «Code a word runs that answers a failure answers the word». QSCND#coalesce и страница `::any/coalesce` говорят другое: «Code that answers a failure is taken as no value, as null is» и «that is neither null nor an error».

```qlang
> {} | coalesce ~(get /a) ~(1)
1

> {} | allOf ~(get /a) !| type
::path/KeyNotInMapError

> {} | cond ~(get /a) ~(1) ~(2) !| type
::path/KeyNotInMapError
```

Две главы дают два разных правила для кода, который внутри слова отвечает отказом. По QSCND `coalesce` ловит отказ без `!|`, хотя QSERR говорит, что ловит только `!|`.

### conflict · QSERR#catch

«`ok` answers `true`, so `ok !| false` asks whether the step before stood.» Страница `::qlang/errors` даёт другую форму: «Whether the step before failed is `false !| true`». Парсер её отказывает:

```qlang
> ::qlang/errors | doc | content | contains "`false !| true`"
true

> "x" | add 1 | false !| true
|~| raised, and no !| caught it
::quote/ParseError!{
  :source "\"x\" | add 1 | false !| true"
  :marker "              ^~~~~        "
  :message "a step is a command: a value stands at the head, where it is the subject, or as what a word takes"
  :location ::span[14 1 15 19 1 20]
  :trail []
}
|~| The source does not read as qlang: `:marker` points where the
|~| reading stopped, `:message` names the habit a form of another
|~| language wrote, and where none does `:expected` lists what could
|~| stand there and a source cut short names the bracket it left open.
```

Страница концепта учит форме, которую глава (QSSYN#step и QSERR#catch) отказывает, и с главой расходится.

### conflict · QSERR#print

«A failure prints as its error at rest with the path it flew among its facts, `:trail []` for one that flew no step … the error at rest `!|` grounds it to holds no empty `:trail`». Страница `::error` говорит, что печать читается обратно в то, что даёт `!|`:

```qlang
> ::error | doc | content | contains "the print reads back as the error at rest, as `!|` grounds it"
true

> {:a 1 :trail []} | raise
|~| raised, and no !| caught it
!{
  :a 1
  :trail []
}

> {:a 1 :trail []} | raise !| get [~(print) ~(eq !{:a 1 :trail []})]
["!{:a 1}" false]
```

Глава и дерево печатают провал без пройденных шагов с `:trail []`, а `!|` даёт ошибку без него. Страница утверждает, что эти два значения совпадают.

### conflict · QSBLD#fn

«a fact, always written with a path, and a law with a path stand under a name declared before them, a refusal among them». Страница `::fn/carries` сужает это правило до отказа:

```qlang
> ::fn/carries | doc | content | lines | get /2
"      under the refusal its path names, one `throws` declares or one the"

> :number/f (::fn | takes :x |~~ x ~~| /0 | carries :x/f |~~ f ~~| ::number | impl ~(add x)) | ::number/f/x/f | binding | get /value
::number
```

Глава и дерево кладут факт под любое имя, объявленное раньше, в том числе под вход. Страница допускает только отказ.

### conflict · QSBLD#kind

«a field's and a page's of one segment beside `payload`, `construct` and the words of a literal, `::kind/SignatureNotCommandsError` refusing one written otherwise». Страница `::kind/SignatureNotCommandsError` перечисляет команды без `tells` и об имени страницы не говорит, хотя дерево отказывает под ней:

```qlang
> ::kind/SignatureNotCommandsError | doc | content | contains "tells"
false

> ::kind | tells :a/b |~~ p ~~| !| type
::kind/SignatureNotCommandsError
```

Глава подводит имя страницы под этот отказ, а страница отказа его не знает.

### implementation · QSBLD#input, QSBLD#value

«An input holds the value of its kind the walk of its tags reaches». Случай `input.jsonl` «an-input-takes-the-value-of-its-kind-beneath-the-tags» и закон `::kind` «holdsThePayloadOfItsKind» снимают все теги. Вход `::map` и payload вида `::map` оставляют один тег, самый внутренний:

```qlang
> :any/m (::fn | takes :x |~~ x ~~| /0 ::map | impl ~(x)) | null | get [~(m ::T::U{:a 1}) ~(m ::T{:a 1})]
[::U{:a 1} ::T{:a 1}]

> :any/m (::fn | takes :x |~~ x ~~| /0 ::string | impl ~(x)) | null | get [~(m ::T::U"a") ~(m ::T"a")]
["a" "a"]

> :Box |~~ B ~~| (::kind | wraps |~~ m ~~| ::number) | get [~(::Box::T#1 | payload) ~(::Box::T::U#1 | payload)]
[1 1]

> :Box |~~ B ~~| (::kind | wraps |~~ m ~~| ::map) | get [~(::Box::T{:a 1} | payload) ~(::Box::T::U{:a 1} | payload)]
[::T{:a 1} ::U{:a 1}]
```

Строки и числа отдаются без тегов, а у отображения из `::T::U{…}` остаётся `::U{…}`. Вопрос: какое значение должен получать вход или payload, когда значение его вида лежит под одним или несколькими тегами?

### design · QSBLD#fn

QSNAM#address: «a function or a quote under a label a word». QSBLD#fn допускает рецепт «none». Что отвечает вызов такой функции, глава не говорит, а страница `::fn` объявляет `::fn/RecipeMissingError`. Под меткой контракт не слово и не значение:

```qlang
> :number/c (::fn | takes :x |~~ x ~~| /0) | 5 | c 1 !| get [/name /nearest]
[:c []]

> :number/c (::fn | takes :x |~~ x ~~| /0) | ::number | manifest | has ::number/c
true

> :number/f (::fn | takes :x |~~ x ~~| /0) | ::number/f[1] | type
|~| raised, and no !| caught it
::construct/TagNotKindError!{
  :tag ::number/f
  :actualType ::fn
  :actualValue ::fn[~(takes :x |~~ x ~~| /0) null]
  :trail [
    {
      :step ~(::number/f[1])
      :subject ::qlang
      :skipped ~(type)
    }
  ]
}
|~| The tag before a payload addresses a kind, a label declared by its
|~| chain or by its page alone, a word, whose args it lays itself over,
|~| `::vec/take[2]`, or no declaration at all; a tag that addresses a
|~| name holding a value of its own names nothing to build by, and
|~| `:tag` is that tag. The value is read by its name, `limit`, and is
|~| put under a tag of its own by `tag`, `limit | tag ::Limit`.

> 5 | apply (::fn | takes :x |~~ x ~~| /0) [1] !| type
::fn/RecipeMissingError
```

Функция под меткой, которая по QSNAM#address должна быть словом, на голое имя, на тег и на `apply` отвечает тремя разными способами. Вопрос: чем должен быть контракт под меткой и что должен отвечать его вызов?

### design · QSBLD#fn

«A function prints as its literal … which the constructor of `::fn` reads back.»

```qlang
> ::number/add | binding | get /value | :f it | print | parse | apply it | :g it | get [~(f | eq g) ~(5 | apply f [1]) ~(5 | apply g [1] !| type)]
[true 6 ::fn/RecipeMissingError]
```

Два значения, равные по `eq`, на одном вызове `apply` отвечают по-разному. Вопрос: что должен отвечать `apply` на функцию, равную той, которую он выполняет?

### design · QSBLD#kind, QSBLD#fn

QSBLD#kind: «`impl ::builtin{}` the check a host hands a kind of the core». Случай `kind.jsonl` «a-reader-kind-with-the-check-of-its-host-lays-its-tag» держит вид читателя с `::builtin{}`, и глава этого правила не формулирует. У функции читателя тот же `::builtin{}` даёт другой ответ:

```qlang
> :B |~~ B. ~~| (::kind | wraps |~~ m ~~| ::map | impl ::builtin{}) | ::B/construct | binding | get /value
::builtin{}

> :B |~~ B. ~~| (::kind | impl ::builtin{}) | ::B[1] | type
::B

> :number/n (::fn | takes :x |~~ x ~~| /0 | impl ::builtin{}) | 5 | n 1 !| type
::call/UnknownNameError
```

`::builtin{}`, который хост не передавал, у вида молча оставляет проверку без хозяина и кладёт тег. У функции тот же `::builtin{}` стирает слово. Вопрос: что должен значить `::builtin{}`, который пишет читатель, у вида и у функции?

### design · QSBLD#input

«args past the places the inputs read, where every input reads a numbered place, under the call as `…/ArgsBeyondInputsError`, while an input that reads `/-1`, the args whole or code of several steps takes any number».

```qlang
> :vec/top (::fn | takes :n |~~ n ~~| ~(query /0 3) ::number | impl ~(take n)) | [5 1 4 2] | top 1 2 !| get [~(type) /places]
[::vec/top/ArgsBeyondInputsError 1]

> :vec/top (::fn | takes :n |~~ n ~~| ~(get /0) ::number | impl ~(take n)) | [5 1 4 2] | top 1 2 !| get [~(type) /places]
[5]
```

Код из одного шага `~(query /0 3)` считается нумерованным местом, а `~(get /0)`, тоже из одного шага и строго читающий `/0`, берёт сколько угодно аргументов. Ни один случай этого не держит. Вопрос: когда место, прочитанное кодом из одного шага, должно считаться нумерованным?

### design · QSERR#site

«The refusal of an input's value lives under the input, whether an invariant or a primitive raises it». Случай `site.jsonl` «each-value-the-call-gives-is-refused-with-its-index» держит отказ под `::vec/sum`.

```qlang
> {:b "x"} | get [~(sumOf 1 (get /b) !| get [~(type) /index]) ~(sumOf 1 /b !| get [~(type) /index])]
[[::any/sumOf/numbers/ElementKindNotTakenError 1] [::vec/sum/ElementNotNumberError 1]]
```

Одно и то же значение входа `numbers` отказывается под двумя адресами в зависимости от того, передано оно готовым или путём. Второй адрес лежит не под входом. Вопрос: под каким адресом должно отказываться значение, которое вход прочитал по пути?

### design · QSERR#trail, QSERR#raise

QSERR#trail: «one that writes its `:trail`, empty among them, resumes that path when raised and adds no stop». QSERR#raise: «An error opened by a catch and raised again is the error it was». QSERR#print: «the error at rest `!|` grounds it to holds no empty `:trail`».

```qlang
> get [~(!{:a 1 :trail [{:step ~(pre) :subject 1 :skipped ~()}]} | :e it | raise !| eq e) ~(!{:a 1 :trail []} | :e it | raise !| eq e)]
[true false]

> {:a 1 :trail []} | raise | count !| trail
[]
```

Каждое правило соблюдено, но вместе они дают вот что: ошибка, выписавшая пустой путь, после `raise … !|` перестаёт быть собой, а пропущенный `count` не попадает ни в одну остановку. Вопрос: что должен давать `raise … !|` для ошибки, которая сама выписала пустой путь, и где должны оставаться пропущенные ею шаги?

### design · QSERR#catch

«A value written after `!|` is the recovery the catch answers.» QSSYN#step: «a path, which the habit wrote there to read a fact of the error, is refused as after `|`».

```qlang
> "!{:k 1} | raise !| /k" | parse !| get /message
"a path is a value, which the word that takes it reads: write `get /k`"

> !{:k 1 :j 2} | raise !| {:k /k}
{:k /k}
```

Голый путь после `!|` отказывается как привычка читать факт. Шаблон из путей, та же привычка, молча отвечает данными. Вопрос: как после `!|` должен читаться литерал, который держит пути?

### text · QSBLD#kind

«a law or a fact under a name declared before it, `NameUnderNoFieldError`, `LawUnderNoNameError` and `FactUnderNoNameError` refusing one under none». Страница `::kind/carries` и дерево держат правило, которого глава не формулирует: «a fact written with no path is a fact of the payload». У функции факт без пути отказывается:

```qlang
> :B |~~ B ~~| (::kind | carries :note |~~ n ~~| ::number) | ::B/note | binding | get /value
::number

> ::fn | carries :limit |~~ The limit. ~~| !| type
::fn/FactUnderNoNameError
```

Правило о факте payload есть на странице и в дереве, а в главе его нет. Случая оно тоже не имеет.

### text · core/src/eval.mjs:112

Код цитирует QSERR#rest для правил, которые формулируют QSERR#trail, QSERR#flow, QSERR#raise, QSERR#print и QSERR#site:

```
$ grep -n "QSERR#rest" core/src/eval.mjs core/src/runtime/print-value.mjs core/src/runtime/manifest.mjs core/src/primitives.mjs core/src/runtime/vec.mjs core/src/error-convert.mjs
core/src/eval.mjs:112:    // stop [QSERR#rest].
core/src/eval.mjs:136:// step joining the skipped steps of its last stop [QSERR#rest], and `!|` fires
core/src/eval.mjs:170:// [QSERR#rest].
core/src/eval.mjs:199:// literal, the parts after it left unread [QSERR#rest].
core/src/eval.mjs:228:// [QSERR#rest].
core/src/eval.mjs:238:// on as it is to the literal it fails [QSERR#rest].
core/src/eval.mjs:281:// its last stop [QSERR#rest], and the literal's own raise where the payload
core/src/eval.mjs:301:// holds [QSERR#rest]; a name is declared once in its scope [QSNAM#scope], a
core/src/eval.mjs:550:// trail's first stop holds [QSERR#rest].
core/src/eval.mjs:947:// anywhere else the error is the answer [QSERR#rest], [QSBLD#fn],
core/src/eval.mjs:967:// over an error [QSERR#rest], and never under the name of a value withheld
core/src/runtime/print-value.mjs:113:// before the bang, none for the kind of errors [QSERR#rest], its facts and the
core/src/runtime/print-value.mjs:116:// of a host says above it that it was raised [QSERR#rest].
core/src/runtime/print-value.mjs:135:// writes `#[…]` [QSERR#rest].
core/src/runtime/manifest.mjs:37:// answered at rest, as `!|` grounds it [QSERR#rest], [QSSLF#laws].
core/src/primitives.mjs:95:// values [QSDSP#walk]: `raise` names its error by the outermost [QSERR#rest].
core/src/runtime/vec.mjs:107:// the vector it answered, or null [QSERR#rest], [QSORD#sort].
core/src/runtime/vec.mjs:157:// vector holds an error [QSERR#rest], [QSORD#sort].
core/src/error-convert.mjs:35:// after them as the trail joins it [QSERR#rest]. A fact neither declares is a
core/src/error-convert.mjs:50:// the subject the first stop holds [QSERR#rest], [QSERR#site].
```

- Остановка и пропущенные шаги (112, 136, 170, 281) — это правило QSERR#trail.
- Отказ части литерала, тела объявления и ключа (199, 238, 301, vec.mjs:107/157) — QSERR#flow.
- Тег, который берёт `raise` (primitives.mjs:95), — QSERR#raise.
- Печать провала (print-value.mjs:113/116) — QSERR#print.
- Порядок фактов и `:actualValue` (550, error-convert.mjs:35/50) — QSERR#site.

### text · core/src/eval.mjs:45

Код цитирует QSBLD#input, QSBLD#chain, QSBLD#answer и QSBLD#fn для правил, которых в этих разделах нет:

```
$ grep -n "QSBLD#input\]" core/src/eval.mjs core/src/address.mjs core/src/runtime/axis.mjs core/src/runtime/nouns.mjs core/src/runtime/verb.mjs
core/src/eval.mjs:45:// under a label, a word, an invariant or a tag no node answers [QSBLD#input].
core/src/eval.mjs:676:// The name a recipe reads the args of its call by [QSBLD#input].
core/src/eval.mjs:946:// [QSBLD#input]; a name withheld from held code, which ran no step, and
core/src/eval.mjs:966:// as it is where no kind answers the tag [QSLIT#tag], [QSBLD#input], never
core/src/address.mjs:3:// noun null for a name of one segment [QSBLD#input].
core/src/runtime/axis.mjs:159:// reached, so a name under a name is read by its address [QSBLD#input].
core/src/runtime/nouns.mjs:7:// [QSBLD#input].
core/src/runtime/nouns.mjs:71:// primitive runs on the label's values [QSBLD#input].
core/src/runtime/nouns.mjs:95:// word is the label of the args of a call of it [QSBLD#input].
core/src/runtime/nouns.mjs:331:// [QSBLD#input].
core/src/runtime/verb.mjs:19:// keep a kind and for `tag` [QSBLD#input].
$ grep -n "QSBLD#chain\]" core/src/runtime/predicates.mjs
24:// a set read as a vector and a tagged map as a map [QSDSP#walk], [QSBLD#chain].
$ grep -n -B1 "QSBLD#answer\]" core/src/eval.mjs
720-// refused as the answer is, so a kind that joins the answer changes no tag
721:// [QSBLD#answer].
$ grep -n "QSSLF#catalog\], \[QSBLD#fn\]" core/src/eval.mjs lsp/src/features.mjs
core/src/eval.mjs:691:// bringing none [QSSLF#catalog], [QSBLD#fn]: one that reaches another of the
core/src/eval.mjs:744:// null for a word that answers any value [QSSLF#catalog], [QSBLD#fn].
lsp/src/features.mjs:288:// word's own label [QSSLF#catalog], [QSBLD#fn]; null where a step answers no
```

- `TagNotKindError` и тег, который ложится как есть (eval.mjs:45/966, verb.mjs:19), — это QSBLD#label и QSLIT#tag.
- `splitAddress` и чтение имени по адресу (address.mjs:3, axis.mjs:159) — QSNAM#address и QSSLF#axis.
- Слово `is` (predicates.mjs:24) — QSDSP#walk.
- Ответ, приведённый к видам `returns` (691, 744, features.mjs:288), — QSBLD#answer, а не QSSLF#catalog и QSBLD#fn.
- eval.mjs:721 приписывает QSBLD#answer обоснование «so a kind that joins the answer changes no tag», которого в разделе нет.

### case · QSBLD#fn

Ни один случай не держит часть правил раздела:
- `fill` отказывает под `::fn/call/…` и `::fn/fill/RecipeNotCodeError`;
- `apply` с `#[]` или с пустым вектором под тегом для quote;
- команда после `impl` присоединяется к остальным.

```
$ grep -rcE "fn/fill/RecipeNotCodeError|fn/call/[a-z]+/|\| impl ~\([^)]*\) \| (takes|returns|throws)" core/test/conformance/QSBLD core/test/conformance/QSQUO
core/test/conformance/QSBLD/answer.jsonl:0
core/test/conformance/QSBLD/chain.jsonl:0
core/test/conformance/QSBLD/fn.jsonl:0
core/test/conformance/QSBLD/input.jsonl:0
core/test/conformance/QSBLD/kind.jsonl:0
core/test/conformance/QSBLD/label.jsonl:0
core/test/conformance/QSBLD/recipe.jsonl:0
core/test/conformance/QSBLD/value.jsonl:0
core/test/conformance/QSQUO/apply.jsonl:0
core/test/conformance/QSQUO/held.jsonl:0
core/test/conformance/QSQUO/literal.jsonl:0
core/test/conformance/QSQUO/modifier.jsonl:0
core/test/conformance/QSQUO/parse.jsonl:0
core/test/conformance/QSQUO/step.jsonl:0
```

```qlang
> ::fn[~(takes :by |~~ b ~~| /0 ::number) ~(add by)] | get [~(fill "x" !| type) ~(fill 1 2 !| type) ~(fill !| type)]
[::fn/call/by/KindNotTakenError ::fn/call/ArgsBeyondInputsError ::fn/call/by/NotGivenError]

> ::fn | takes :by |~~ b ~~| /0 | fill 1 !| type
::fn/fill/RecipeNotCodeError
```

Дерево эти правила выполняет, но ни один случай их не держит.

### case · QSBLD#fn

Имена двух случаев называют порядок, «taken after it» и «declared after it», а запросы ничего после не объявляют:

```
$ grep -noE '"name":"a-(refusal-under-an-input-taken|law-under-a-name-declared)-after-it-is-refused","query":"[^"]*"' core/test/conformance/QSBLD/fn.jsonl
17:"name":"a-refusal-under-an-input-taken-after-it-is-refused","query":"::fn | throws :y/BadError |~~ b ~~| !| type"
18:"name":"a-law-under-a-name-declared-after-it-is-refused","query":"::fn | proves :z/holds |~~ l ~~| ~(true) !| type"
```

```qlang
> ::fn | throws :y/BadError |~~ b ~~| | takes :y |~~ y ~~| /0 !| type
::fn/NameUnderNoInputError
```

Правило «taken before it», которое называют имена, ни один случай не показывает: запросы проверяют только имя, не объявленное вовсе.

### case · QSERR#raise

«a subject that is no map, a value under a tag over another value among them, is refused as `::map/raise/SubjectNotMapError`». Единственный случай отказа — число:

```
$ grep -n "SubjectNotMapError" core/test/conformance/QSERR/raise.jsonl
13:{"name":"raise-resides-on-the-map","query":"5 | raise !| type","expect":"::map/raise/SubjectNotMapError"}
```

```qlang
> ::Foo[1] | raise !| type
::map/raise/SubjectNotMapError
```

Часть правила о значении под тегом над не-отображением не держит ни один случай.

### case · QSBLD#label, QSBLD#input

```
$ grep -noE '"name":"(a-name-under-a-label-runs-on-its-value|a-count-under-a-tag-is-whole-where-it-equals-its-floor)"' core/test/conformance/QSBLD/label.jsonl core/test/conformance/QSBLD/input.jsonl
core/test/conformance/QSBLD/label.jsonl:17:"name":"a-name-under-a-label-runs-on-its-value"
core/test/conformance/QSBLD/input.jsonl:70:"name":"a-count-under-a-tag-is-whole-where-it-equals-its-floor"
```

- `label.jsonl:17` (`::Box[4 2] | length`) показывает правило QSNAM#word: слово под меткой работает на её значениях.
- `input.jsonl:70` (`[1 2 3] | take ::N#2`) показывает правило QSCOL#sequence: «a count whole where it equals its floor».
