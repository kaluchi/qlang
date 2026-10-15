<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at 985a4b82 and checking docs/spec/QSNAM-names-and-scope.md and docs/spec/QSDSP-a-word-found-through-its-subject.md, on 2026-10-15 from 08:05 to 08:15 UTC. Its prompt is `scripts/spec-check-prompt.txt` at 985a4b82. -->

### design · QSNAM#scope

В QSNAM#scope сказано: «A name is declared once in a scope: the second declaration is refused where it stands». В QSNAM#declare: «a body that answers a failure declares nothing». В QSERR#flow: «the body of a declaration that fails leaves the scope as it was».

```qlang
> :k (1 | div 0) !| env | has :k
false

> :k (1 | div 0) !| :k 2 | k
|~| raised, and no !| caught it
::bind/NameDeclaredTwiceError!{
  :name :k
  :trail [
    {
      :step ~(:k 2)
      :subject ::number/div/divisor/ZeroError!{
        :actualType ::number
        :actualValue 0
        :trail [
          {
            :step ~(div 0)
            :subject 1
            :skipped ~()
          }
          {
            :step ~(:k (1 | div 0))
            :subject ::qlang
            :skipped ~()
          }
        ]
      }
      :skipped ~(k)
    }
  ]
}
```

Первое объявление `k` ничего не объявило, и scope остался прежним. Но восстановление на fail track, которое объявляет `k` впервые, получает отказ как повторное объявление: дерево считает написанные объявления (`repeatsDeclarationInScope` в `core/src/walk.mjs:170`), а не привязки, которые оказались в scope. Вопрос к правилам: что значит «declared» в QSNAM#scope — объявление, записанное в pipeline, или привязка, которую оно дало? Какой ответ здесь был бы согласован с QSNAM#declare и QSERR#flow?

### conflict · QSDSP#walk

В QSDSP#walk: «A tagged value reaches `::tagged` after its own tag and before its payload» и «a word on a narrower label stands over one of the same name on a broader one». В QSERR#rest: «The walk of an error passes the tag of its site, then `::error`, then the map, so a word declared once on `::error` reaches every error».

```qlang
> :tagged/trail ~(99) | get [~(!{:a 1} | trail) ~(::Foo!{:a 1} | trail)]
[[] 99]

> :tagged/trail ~(99) | "x" | add 1 !| trail
99
```

Обход ошибки с тегом места проходит `::tagged` раньше, чем `::error`. Поэтому слово на `::tagged` перекрывает `::error/trail` у любой ошибки, поднятой рантаймом, но не у `!{…}` без тега места. Значит, утверждение QSERR#rest о пути обхода и о том, что «reaches every error», расходится с QSDSP#walk. Утверждение QSDSP#walk «narrower stands over broader» расходится с его же правилом обхода: `::tagged` шире `::error`, но стоит раньше. То же «reaches the narrower first» повторяет страница `::qlang | doc :names`.

### design · QSDSP#residence

В QSDSP#residence: «a set, a quote and a doc are vectors to a word of vectors, each answered back as its own kind». В QSORD#set: «a vector where it answers an order of its own, `sort` and `reverse`». В QSDSP#walk: «A word means one act wherever it resolves».

```qlang
> get [~(#[1 2 3] | sort ~(desc)) ~(#[1 2 3] | vec/sort ~(desc)) ~(#[1 2 3] | reverse) ~(#[1 2 3] | vec/reverse)]
[[3 2 1] #[1 2 3] [3 2 1] #[1 2 3]]
```

Один и тот же вопрос, развернуть или упорядочить множество, получает разные ответы в зависимости от того, как вызвано слово: по голому имени или по адресу слова векторов. Обращение по адресу возвращает ответ обратно во множество, и порядок, который вычислило слово, теряется: `vec/reverse` и `vec/sort` на множестве ведут себя как тождество. Вопрос: какой ответ слова векторов на множестве согласуется и с QSORD#set, и с «one act wherever it resolves»?

### conflict · QSNAM#reach

В QSNAM#reach: «a bare step that reaches a value the scope binds … where a word of the same name serves the subject, is refused as `::call/ValueMeetsWordError`». Страница `::call/ValueTakesNoModifiersError` говорит: «A word declared under a name a value of the scope already holds is shadowed by the value, `:addresses` naming where the word lives». Её закон `:namesTheVerbTheValueShadows` проверяет `~(:five 5 | :number/five ~(add 5) | 3 | five 42 !| get /addresses | eq #[::number/five])`.

```qlang
> :five 5 | :number/five ~(add 5) | 3 | five 42 !| get [~(type) /addresses]
[::call/ValueMeetsWordError #[::number/five]]
```

Страница утверждает, что значение затеняет слово, а глава — что значение и слово встречаются с отказом. Закон проходит только потому, что читает `/addresses`, который есть у обоих отказов: на самом деле поднят `ValueMeetsWordError`, а не отказ этой страницы.

### conflict · QSDSP#residence

В QSDSP#residence: «A word serves the values the walk of their tags brings to its label and, beside them, a value of the kinds its `on` names». Так же в QSBLD#fn: «A word serves the values of its label and of the kinds `on` names». В QSDSP#tagname: «A word of the noun itself, whose function names `::tag` by `on`, serves the noun's values and the noun's own tag name, and refuses every other tag name».

```qlang
> :Shop |~~ A shop. ~~| | :Shop/f (::fn | on |~~ Tags. ~~| #[::tag ::number] | impl ~("ok")) | get [~(5 | f) ~(::Shop | f) ~(::Other | f !| type)]
["ok" "ok" ::Shop/f/SubjectNotShopError]
```

Здесь `on` обслуживает любое значение `::number`, а `::tag` — только собственное имя тега этого noun. Общее правило QSDSP#residence и QSBLD#fn («a value of the kinds its `on` names») и частное правило QSDSP#tagname дают разные ответы для `::Other`.

### conflict · QSDSP#walk

В QSSLF#axis сказано, что значение под тегом, который ничто не объявляет, читается «by the first kind its stack of tags declares from the outside in, as a call of a word walks it, so `::Box{:a 1} | doc` is the page of `::map`». В QSDSP#walk: «A tagged value reaches `::tagged` after its own tag and before its payload».

```qlang
> :tagged/w ~("tagged") | :map/w ~("map") | ::Box{:a 1} | get [~(w) ~(doc | eq (::map | doc)) ~(doc | eq (::tagged | doc))]
["tagged" true false]
```

Вызов слова на `::Box{:a 1}` первым объявленным видом встречает `::tagged`, а ось берёт `::map`. Значит, «as a call of a word walks it» в QSSLF#axis описывает другой обход, чем тот, что задаёт QSDSP#walk.

### conflict · QSNAM#address

В QSNAM#address: «The value says what the node is: a page or a kind makes a label, a function or a quote under a label a word, any other value data». В QSHST#source: «A `::builtin{}` written in the recipe of a word a reader declares is the value it is: the word's address answers its function as a value, and its bare name reaches no word».

```qlang
> :number/z (::fn | returns |~~ n ~~| ::number | impl ::builtin{}) | get [~(5 | z !| type) ~(number/z | type)]
[::call/UnknownNameError ::fn]
```

Функция под меткой здесь не слово: адрес читает её как данные, а голое имя ничего не находит. Это расходится с QSNAM#address («a function … under a label a word») и согласуется с QSHST#source. Дерево (`isMemberValue` в `core/src/runtime/nouns.mjs:104`) решает по рецепту функции, а QSNAM#address — по тому, что значение является функцией.

### case · QSNAM#letters

Кейс `{"name":"the-word-of-a-literal-names-a-label","query":"\":null |~~ A thing. ~~| | 1\" | parse | count","expect":"2"}` только разбирает текст. Он не показывает правило, которое называет: что метка объявлена, что её тег до неё доходит, и что метка корня `::null` остаётся корневой. Ни один кейс в `core/test/conformance` не запускает метку читателя с именем слова литерала (Grep по `:(true|false|null) \|~~` находит только этот кейс и `QSBLD/fn.jsonl:15`). То же с чтением её узлов по тегу, `::false/x`: это есть только в пробе главы.

```qlang
> :true |~~ T. ~~| | get [~(::true | doc | content) ~(::true | binding | get /origin)]
[" T. " :cell-1]

> :null |~~ A thing. ~~| | :null/x 3 | get [~(::null/x | binding | get /value) ~(env | keys)]
[3 #[:null :null/x]]
```

Правило QSNAM#letters «each declares a label, which its tag reaches where the root holds no label of that name, a label of the root staying the root's, `::null` among them» не подтверждено ни одним кейсом.

### case · cli/test/streams.test.mjs:5

Заголовок тестового файла цитирует раздел об именах, а его наборы проверяют слова потоков `in`, `out`, `err` и `tap`, правило QSHST#effect.

```sh
$ grep -n "QSNAM#letters\|^describe(" cli/test/streams.test.mjs
5:// The decisions it exists for: [QSNAM#letters].
23:describe('in', () => {
38:describe('out — bare form (0 captured)', () => {
57:describe('out — full-application form (1 captured)', () => {
85:describe('err — bare form', () => {
104:describe('err — full-application form', () => {
121:describe('tap', () => {
```

Цитата `[QSNAM#letters]` указывает на правило о буквах имён, а ни один тест файла его не показывает.
