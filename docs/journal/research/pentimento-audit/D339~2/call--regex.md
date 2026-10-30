> A pentimento audit of call--regex for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `9778080c`, on the baseline `9780e1ed`; run 2026-10-30, 15:12–15:36 UTC. A path it names reads as `git show 9778080c:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### archaism · core/lib/qlang/map.qlang:441

«`entries | first`, while `keys | first` answers the key first by name». Рядом core/lib/qlang/keyword.qlang:72 и закон :85: «`groupBy /year | keys | toVec | map toNumber`».

Эти тексты остались от модели, в которой `keys` отвечал множеством ключей в одном порядке (её заменил D485, ныне в `replaced/`). Только тогда «первый по имени» и `| toVec` что-то значили. С чистого листа страница сказала бы, что `keys | first` — это ключ первой записи, а пример и закон `::keyword/toNumber/readsTheNumberOfAKey` обошлись бы без `toVec`.

```
> get [({:tue 15 :mon 12} | keys | first) (::map/first | doc | content | contains "answers the key first by") ({:b 1 :a 2} | keys | get [tag (eq (toVec))]) (::keyword/toNumber | doc | content | contains "keys | toVec")] < /dev/null
[:tue true [::vec true] true]
```

### archaism · core/lib/qlang/number.qlang:554

«so a record a number names is read from the map they build, `byId | query (get /uid | toKeyword)`».

Пример держится за слой, где `query` принимал вычисленный ключ. Сейчас группа для `query` — это код: ответом становится сам keyword, запись не читается, а `get /uid` читается из `byId`. С чистого листа запись по вычисленному ключу читал бы `at`: `byId | at (… | toKeyword)` или `byId | at 1`.

```
> [{:uid 1 :name "Ann"}] | indexBy /uid | with {:byId it} (get [(byId | query (get /uid | toKeyword) !| tag) (byId | at 1 | get /name)]) < /dev/null
[::path/KeyNotInMapError "Ann"]

> get [({:"1" {:name "Ann"}} | query (5 | toKeyword)) ({:a 1} | query :a !| tag) (::number/toKeyword | doc | content | contains "byId | query (get /uid | toKeyword)")] < /dev/null
[:"5" ::any/query/PathKindNotTakenError true]
```

### vestige · core/lib/qlang/call.qlang:164

Страницы фактов двух соседних отказов перепутаны:
- `::call/KindAnswersNoVerbError/nearest`: «nearest in spelling, `[]` where none is near».
- `::call/UnknownNameError/addresses` (:209): «one for each kind that answers it», хотя на :205 сказано «so `:addresses` holds none here».
- `::call/UnknownNameError/nearest` (:212–226) описывает правило соседнего отказа: «`print` and `json` for the `toString` of a vector». Там же «`multiply` for `mul`» читается наоборот относительно «`sumOf` for `addOf`»: это `multiply` ведёт к `mul`.

Это слой одного отказа на оба случая, который разделили, не перечитав страницы фактов. В D339 (часть 13) записан только пустой `:addresses`. Добавляю: страница `nearest` у KindAnswersNoVerbError ложна в обеих частях — там не соседи по написанию, а глаголы, к которым ведут страницы, и null вместо `[]`. С чистого листа каждый отказ описывал бы свои факты: `UnknownNameError` без `:addresses` и с правилом написания, `KindAnswersNoVerbError/nearest` — глаголы, к которым ведут страницы, а где их нет — отсутствие факта.

```
> get [(::call/KindAnswersNoVerbError/nearest | doc | content) ([1 2] | toString !| nearest) (5 | count !| nearest) (::call/UnknownNameError/addresses | doc | content) (zzzq !| addresses)] < /dev/null
["The names the step could have meant: nearest in spelling, `[]`\nwhere none is near." [:json :print] null "The addresses where a verb of that name lives: one for each\nkind that answers it." #[]]

> get [(::call/UnknownNameError/nearest | doc | content | contains "for the `toString` of a vector") (5 | multiply 2 !| nearest)] < /dev/null
[true [:mul]]
```

### archaism · core/lib/qlang/fail.qlang:12

«`~(!| get /kind) | first` answering `::fail~(get /kind)`» — в fail.qlang 14 чтений `get /kind`. То же в docs/spec/QSERR-errors.md:168 (`42 !| get /kind`), :44 («a `:kind` entry a fact as any key is») и :60.

Это модель ошибки, которая несла свой вид фактом `:kind`. Теперь вид — это тег. Ошибка отказа закрыта для путей, а у `::error` нет `:kind`, так что образцовый шаг после `!|` падает на любом настоящем отказе. Фраза главы — контраст именно с той моделью. D339 часть 13 называет `:kind` только в именах кейсов и тестов. Добавляю: страницу и законы `::fail` и разделы rest и catch главы QSERR. С чистого листа примеры fail-трека читали бы `!| tag`, `!| message` или `!| trace`, а фразы про `:kind` не было бы.

```
> get [("x" | add 1 !| get /kind !| tag) ({:a 1} | raise !| get /kind !| tag) (::fail | doc | content | contains "~(!| get /kind) | first") ("x" | add 1 !| tag)] < /dev/null
[::path/TagClosedError ::path/KeyNotInMapError true ::number/add/SubjectNotNumberError]

$ qplay '::stdio | in | split "get /kind" | count | sub 1' < D:/git/qlang-worktrees/pentimento-d339/core/lib/qlang/fail.qlang
14
```

### vestige · core/lib/qlang/fail.qlang:31

«A value after `!|` is the recovery the catch answers, but for a path … `:message` names that verb, `get`». Факт `:message` (:38): «What the rule says of the path».

Страница хранит правило, по которому после `!|` отказывали только пути. Тот же отказ теперь отвергает и цитату (с отсылкой к `apply`), и литерал, держащий путь (QSSYN#step). С чистого листа страница называла бы все три случая, а описание факта говорило бы «of the value».

```
> get [([~(count)] | tag ::quote | tag ::fail !| message) ([[/a]] | tag ::quote | tag ::fail !| message) (::fail/StepNotCommandError | doc | content)] < /dev/null
["code runs on the value in the pipe by `apply`: write `apply (…)`" "a literal that holds a path is the template `get` reads: write `get [/a]`" "A value after `!|` is the recovery the catch answers, but for a\npath, which the verb that takes it reads: `:message` names that\nverb, `get`.\n::link~(::fail) ::link~(::qlang/pipeline)"]
```

### shim · core/src/runtime/fn-primitives.mjs:30

`const ARGS_NAME = 'args';` против `const ARGS_NAME = makeKeyword('args');` в core/src/eval.mjs:604.

У имени аргументов рецепта два написания в двух модулях. Отказ входу `args` повторно обходит сырые команды по литералу `'takes'`, хотя `chainOfFn` уже прочёл входы. Пять остальных запретных имён при этом живут отдельно, в `NAMES_OF_A_VERDICT` (core/src/chain.mjs:29). С чистого листа было бы одно экспортированное имя там, где рецепт его открывает; chain.mjs проверял бы его вместе с именами вердикта по `chainOfFn(fn).inputs`.

```
$ qplay '::stdio | in | lines | filter (contains "ARGS_NAME =")' < D:/git/qlang-worktrees/pentimento-d339/core/src/eval.mjs
["const ARGS_NAME = makeKeyword('args');"]

$ qplay '::stdio | in | lines | filter (contains "ARGS_NAME")' < D:/git/qlang-worktrees/pentimento-d339/core/src/runtime/fn-primitives.mjs
["const ARGS_NAME = 'args';" "  const takes = commands.find(step => step.get('name').name === 'takes' && step.get('modifiers')[0].name === ARGS_NAME);"]

> get [(::fn | takes :args |~~ The args. ~~| /0 | impl ~(args) !| tag) (::fn | takes :subject |~~ s ~~| /0 !| tag) (::fn | takes :args |~~ The args. ~~| /0 | tag)] < /dev/null
[::fn/CommandNotTakenError ::fn/CommandNotTakenError ::fn]
```

### vestige · core/src/runtime/arith.mjs:13

`const unsignedZero = …` и рядом `return rounded === 0 ? 0 : rounded;` (:33). Законы `::number/round/printsNoNegativeZero` (core/lib/qlang/number.qlang:483) и `roundsUp` «prints no negative zero» (:167).

Это слой печатника, который писал `-0`. Сейчас отрицательный ноль не виден нигде. `mul` и `div` его не нормализуют, а `print`, `toString`, `json`, `eq` и порядок читают его как `0`. Выходит, два написания в трёх глаголах и два закона охраняют то, чего читатель не видит. С чистого листа нормализации и этих законов не было бы.

```
$ qplay '::stdio | in | lines | filter (anyOf (contains "unsignedZero") (contains "=== 0 ? 0 :"))' < D:/git/qlang-worktrees/pentimento-d339/core/src/runtime/arith.mjs
["const unsignedZero = number => (number === 0 ? 0 : number);" "  return unsignedZero(remainder !== 0 && Math.sign(remainder) !== Math.sign(divisor) ? remainder + divisor : remainder);" "registerPrimitive('number/ceil', subject => unsignedZero(Math.ceil(subject)));" "  return rounded === 0 ? 0 : rounded;"]

> get [(0 | mul -1 | print) (0 | div -5 | print) (0 | mul -1 | get [toString json]) (5 | div (0 | mul -1) !| tag) (-0.4 | round | print)] < /dev/null
["0" "0" ["0" "0"] ::number/div/DivisorZeroError "0"]
```

### pentimento · core/lib/qlang/excerpt.qlang:22

«Nothing is cut: a fact stands whole, as a cell that gives it back whole, or as the facts its kind reveals of it». Близнец в главе — docs/spec/QSPRN-printing-and-codecs.md:64: «cuts nothing».

Это успокоение против старой обрезки через `…`. Его опровергает собственная оговорка: хост без ячейки показывает лишь виды. Опровергает и правило QSERR#alert: алерт молча оставляет 13 частей из 16, тогда как AIM требует сказать, что опущено. С чистого листа страница говорила бы, что выдержка хранит и что роняет, а опущенное считалось бы в самой выдержке.

```
$ qplay 'get {:m (16 | range | map (get [toString (400 | range)]) | toMap)} | raise' < /dev/null | grep -c '/last'
13

$ qplay 'get {:m (16 | range | map (get [toString (400 | range)]) | toMap)} | raise' < /dev/null | grep -c -e 'm/1[3-5]' -e '…' -e 'drop'
0

> get [(::excerpt | doc | content | contains "Nothing is cut") (::excerpt | doc | content | contains "keeps no\ncell shows the tag, the views and the parts alone")] < /dev/null
[true true]
```

### pentimento · docs/spec/QSLIT-values-and-literals.md:130

«An object reads as the map of its keys, `type` and `error` as any other». Проба на :144 и кейсы `a-map-with-a-key-named-type-is-a-map` и `a-map-with-a-key-named-error-is-no-failure`.

Это контраст с JSON-кодеком, который читал `{"type": "quote" …}` и `{"type": "error" …}` как цитату и отказ. В core/src нет `'type'`, так что проба и кейсы проверяют отсутствие механизма. С чистого листа раздел просто говорил бы, что объект читается как отображение своих ключей, без именованных ключей, проб и кейсов.

```
> get [({"type": "quote", "source": "hi"} | tag) ({"error": {"message": "x"}} | tag) ("{\"type\":\"error\"}" | parseJson | tag)] < /dev/null
[::map ::map ::map]
```

### drift · core/lib/qlang/keyword.qlang:12

Слово «letters» в каталоге значит три разные вещи:
- keyword.qlang:12: «begins with a letter of any script or `_` and goes on with letters, digits, `_` and `-`»;
- core/lib/qlang/call.qlang:48–50: «the letters, digits, `_` and `-` after it»;
- core/lib/qlang/cell.qlang:9/22/29: «letters, digits and hyphens» при `#"^[A-Za-z0-9-]+$"`.

Первые две страницы хранят ASCII-модель имени, к которой «of any script» привито только для первой буквы. Грамматика же берёт соединители и комбинирующие знаки по QSNAM#letters. А в `::cell` «letters» — это латиница. D339 записал идентичность ячейки, сформированную одним хранилищем; добавляю: само слово «letters» на её странице расходится со смыслом языка. С чистого листа страницы описывали бы буквы имени одним написанием, по QSNAM#letters, а идентичность ячейки — словом «Latin letters».

```
> get [(apply (:a‿b 5; a‿b)) (::call{:name :a‿b} | tag) (::cell"данные" !| tag) (::cell/payload | doc | content)] < /dev/null
[5 ::call ::cell/PayloadNotIdentityError "The identity of the cell, letters, digits and hyphens."]

> get [(::keyword | doc | content | contains "goes on with letters, digits, `_` and `-`") (::call/NameNotCallableError | doc | content | contains "the letters, digits, `_` and `-` after")] < /dev/null
[true true]
```

### drift · core/lib/qlang/call.qlang:98

«A verb of that name, which the name stands over», а на :106 в том же отказе: «one a declaration shadows among them». Первая страница: «the verb shadows a verb of that name on a broader label».

Одно понятие — имя, заслоняющее глагол своего имени, — названо двумя словами: «stands over» (24 раза) и «shadows» (9 раз). При этом «stands over» значит ещё и тег над значением (core/lib/qlang/doc.qlang:106, quote.qlang:227, shape.qlang:20, QSLIT:237, QSPTH:384) и scope над корнем (QSNAM:212). С чистого листа был бы один термин для заслонения и отдельное слово для тегов.

```
> get [(::call/ValueTakesNoModifiersError | doc | content | contains "which the name stands over") (::call/ValueTakesNoModifiersError/addresses | doc | content | contains "declaration shadows") (::qlang | doc | content | contains "the verb shadows a verb") (::doc/links | doc | content | contains "a reader stands over")] < /dev/null
[true true true true]
```

### vestige · core/lib/qlang/kind.qlang:60

Ссылки `::kind/CommandNotTakenError` перечисляют accepts, wires, tells, holds, throws, proves. Страница NameDeclaredTwiceError (:70) говорит: «the payload, each field, refusal, fact, invariant and law».

Это цепочка вида до `reveals`. Те же отказы уже отвергают и неверный `reveals`, и вид, объявленный дважды, но ни одна страница его не называет. С чистого листа ссылки выводились бы из `KIND_COMMAND_NAMES`, а страница NameDeclaredTwiceError называла бы виды и страницы.

```
> get [(::kind/CommandNotTakenError | doc | links | map answer) (::kind | reveals 5 !| tag) (::kind | reveals :count | reveals :count !| tag) (::kind/NameDeclaredTwiceError | doc | content | contains "view")] < /dev/null
[[::kind/accepts ::kind/wires ::kind/tells ::kind/holds ::kind/throws ::kind/proves] ::kind/CommandNotTakenError ::kind/NameDeclaredTwiceError false]
```

### subordination · core/src/runtime/code.mjs:18

`export async function refusalOfAParse(...)` импортируется в core/src/notebook.mjs:7.

Превращение отказа разбора в значение выросло в модуле глаголов `parse`, `apply`, `answer` и `fill`. Notebook, чья собственная работа — превращать брошенный разбор ячейки в её результат, тянется за ним в модуль глаголов: это его единственный такой импорт, два других — корень. D339 перечисляет code.mjs как дом «по роли»; добавляю эту зависимость. С чистого листа функция жила бы ниже глаголов, рядом с `errorFromParse` или с `layTag` в eval.mjs.

```
$ qplay '::stdio | in | lines | filter (contains "export ")' < D:/git/qlang-worktrees/pentimento-d339/core/src/runtime/code.mjs
["export async function refusalOfAParse(parseError, scope, uri) {"]

$ qplay '::stdio | in | lines | filter (contains "runtime/")' < D:/git/qlang-worktrees/pentimento-d339/core/src/notebook.mjs
["import { langRuntime } from './runtime/lang-runtime.mjs';" "import { refusalOfAParse } from './runtime/code.mjs';" "import { declareRoot } from './runtime/root.mjs';"]
```

### shim · core/src/runtime/kind-primitives.mjs:27

Проверка пары `payload.length !== 2 || !isQuote(payload[0])` дословно повторена в fn-primitives.mjs:38. Повторены и `madeKind`/`madeFn`, `kindFrom`/`functionOf`, цикл по `*_COMMAND_NAMES`.

Функция и вид собираются двумя копиями одного механизма (цитата цепочки плюс вторая часть). Копии расходятся лишь видами второй части и идиомой: `NO_KIND` строится один раз, `functionOf` — заново на каждый вызов. С чистого листа был бы один конструктор цепного значения, параметризованный существительным.

```
$ qplay '::stdio | in | lines | filter (anyOf (contains "function made") (contains "Of(subject)") (contains "From = ") (contains "PayloadNotPairError(") (contains "for (const command of"))' < D:/git/qlang-worktrees/pentimento-d339/core/src/runtime/kind-primitives.mjs
["function madeKind(commands, constructor) {" "  if (!isVec(payload) || !holdsNoOtherTag(payload, KIND_TAG_NAME) || payload.length !== 2 || !isQuote(payload[0])) throw new KindPayloadNotPairError({ found: payload });" "const kindFrom = subject => (isKind(subject) ? subject : NO_KIND);" "for (const command of KIND_COMMAND_NAMES) {"]

$ qplay '::stdio | in | lines | filter (anyOf (contains "function made") (contains "Of(subject)") (contains "From = ") (contains "PayloadNotPairError(") (contains "for (const command of"))' < D:/git/qlang-worktrees/pentimento-d339/core/src/runtime/fn-primitives.mjs
["function madeFn(commands, recipe) {" "  if (!isVec(payload) || !holdsNoOtherTag(payload, FN_TAG_NAME) || payload.length !== 2 || !isQuote(payload[0])) throw new FnPayloadNotPairError({ found: payload });" "function functionOf(subject) {" "for (const command of FN_COMMAND_NAMES) {" "    const fn = functionOf(subject);" "registerPrimitive('fn/impl', (subject, recipe) => madeFn(commandsOf(functionOf(subject)), recipe));"]
```

### subordination · core/lib/qlang/each.qlang:37

Законы `keepsAFewNamesAsARecord`, `keepsTheFieldsOfAMapOfAtoms` и другие лежат под `::each`.

Правило, когда `shape` сворачивает отображение, рассказано под меткой `::each`: 7 из её 12 законов доказывают случаи, где `::each` нет. Один из них повторяет `::any/shape/keepsTheKeysOfAMap`. С чистого листа законы свёртки жили бы под `::any/shape`, а у `::each` остались бы законы его собственной нагрузки.

```
> get [(::each | laws | keys | count) (::each | laws | keys | filter (toString | startsWith "keeps") | count) ({:width 2 :height 3} | shape | payload | tag) (::any/shape | laws | has :keepsTheKeysOfAMap)] < /dev/null
[12 7 ::map true]

> get [(::any/shape | laws | get /keepsTheKeysOfAMap | last) (::each | laws | get /keepsTheFieldsOfAMapOfAtoms | last)] < /dev/null
[~({:id 7 :user {:name "Ann"}} | shape | eq ::shape{:id ::number :user {:name ::string}}) ~({:width 2 :height 3} | shape | eq ::shape{:width ::number :height ::number})]
```

### pentimento · docs/spec/QSPRN-printing-and-codecs.md:48

«asks the printer for that form and lays no print on one line by a regex over its text».

Это контраст с таблицей, которая когда-то сплющивала печать регексом. Ни одна проба языка этого не решает: ячейка печатается одинаково при любом способе. С чистого листа раздел называл бы форму, которую просит хост, а запрет регекса уже стоит в QSREQ#rigor.

```
> get [{:d (["a\nb"] | tag ::doc)}] | table < /dev/null
+-------------+
| d           |
+-------------+
| |~~ a b ~~| |
+-------------+
```

### subordination · docs/spec/QSNAM-names-and-scope.md:330

«by a name that holds a kind, `:Box |~~ A box. ~~| K;`, a label to the runtime [QSLSP#symbols]».

Определение метки в главе имён несёт чтение языкового сервера («a value to the tools») и ссылается вперёд, на главу инструмента. С чистого листа QSNAM сказал бы просто «label», а предел инструментов остался бы в QSLSP#symbols.

```
> :K (::kind | accepts |~~ x ~~| ::map); :Box |~~ A box. ~~| K; get [(::Box{:a 1} | tag) (::Box#5 !| tag) (::host | kinds | has ::Box)] < /dev/null
[::Box ::Box/PayloadKindNotTakenError true]
```

### drift · core/lib/qlang/quote.qlang:121

«a part of the grammar named as a keyword, `:name`, `:whitespace`, `:end-of-source`».

Ключевые слова продолжений разбора написаны двумя способами: дефисом (`:end-of-source`) и фразой в кавычках (`:"letters of a name"`, `:"number within the finite double range"`). Глава же пишет «the end of the source» и «a number». С чистого листа у всего семейства была бы одна форма, словами главы.

```
> get [("1 | add 1 x(" | parse !| expected | filter (is ::keyword)) ("(" | parse !| expected | filter (is ::keyword))] < /dev/null
[[:"letters of a name" :whitespace :end-of-source] [:whitespace :doc :name :"number within the finite double range"]]
```

### pentimento · core/lib/qlang/kind.qlang:379

«a kind of yours laying its tag by its commands».

Это обращение к читателю в катафатическом тексте, реплика диалога; так же core/lib/qlang.qlang:364 («A kind of your own»). С чистого листа было бы «a reader's kind lays its tag by its commands», как пишет QSBLD#kind.

```
> ::kind/impl | doc | content | contains "a kind of yours" < /dev/null
true
```
