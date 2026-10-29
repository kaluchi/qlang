> A pentimento audit of call--regex for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–23:57 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### vestige · core/lib/qlang/fn.qlang:298
«`tells :call` … a refusal of its subject, its args, its inputs, its answer or its invariants is named under it, `::fn/call/ByKindNotTakenError`». Здесь сохранилась модель, в которой отказ был открытой картой плоских ключей и читался путём. D453 закрыл все отказы видом их отказа, но семейство `::fn/call` оставил открытым. Вдобавок адрес, который никто не объявлял и чьё последнее имя оканчивается на `Error`, по одному этому написанию читает запись адреса перед ним. В итоге один и тот же отказ одного и того же входа одной функции читается двумя способами: у глагола как `by | found`, а под `apply` как `get /:by/found`. Именно второму способу учат законы fn.qlang:169, 181, 391 и 471. С чистого листа вызов функции через `apply` давал бы тот же вердикт, что и вызов глагола, `!| by | found` читал бы оба случая, и ни одна запись не находилась бы по окончанию имени.

```sh
$ qplay ':number/plus (::fn | takes :by |~~ b ~~| /0 ::number | impl ~(add by)); get [~(5 | plus "x" !| get [~(by | found) ~(get /:by/found !| tag)]) ~(5 | apply (::number/plus | binding | value) ["x"] !| get [~(tag) ~(get /:by/found) ~(by !| tag)])]' < /dev/null
[["x" ::path/TagClosedError] [::fn/call/ByKindNotTakenError "x" ::call/UnknownNameError]]

$ qplay 'get [~(::fn/call/AnyNameAtAllError | binding | name) ~(::number/add/WhateverError | doc | eq (::number/add | doc))]' < /dev/null
[:fn/call true]

$ git grep -n -e "function nodeOfRefused" -e "endsWith('Error')" -- core/src/runtime/axis.mjs
core/src/runtime/axis.mjs:44:function nodeOfRefused(scope, name) {
core/src/runtime/axis.mjs:46:  if (refusedName === null || !name.endsWith('Error')) return null;

$ sed -n '77,80p' docs/journal/replaced/D453.md
- An error at rest under `::error` alone, `!{:a 1}`, `{:a 1} | raise`, is a
  map of facts no refusal declares, read by paths, `!| get /a`, its trace
  among them, `!| get /trace`; so is one under a tag no node declares, a
  refusal of a function `apply` runs, under `::fn/call`, among them.
```

### pentimento · docs/spec/QSBLD-functions-and-kinds.md:379
«`construct` a name there like any other». Фраза написана как противопоставление модели, где конструктор метки лежал под ней как `::Box/construct`: так было до D357, а до D252 читатель объявлял его по имени кодом. Тот же слой держат ещё три текста. Имя кейса `construct-is-a-node-of-the-label-a-literal-runs` утверждает старое, хотя его ответ уже `::call/UnknownNameError`. Об этом же заголовок теста `core/test/unit/QSBLD/chain.test.mjs:7` и страница отказа `kind.qlang:91` («code that would build another value from the payload is no part of it»). С чистого листа глава и каталог говорили бы только, где стоит конструктор (вторая часть литерала вида), и ни фраза, ни кейс, ни тест не противопоставляли бы ему `construct`.

```sh
$ qplay ':Pos |~~ A positive number. ~~| (::kind | impl ::builtin{}); get [~(::Pos#5 | construct !| tag) ~(::Pos | manifest)]' < /dev/null
[::call/UnknownNameError #[]]

$ git grep -h -o -e '"name":"construct-is-a-[^"]*"' -- core/test/conformance/QSBLD
"name":"construct-is-a-name-like-any-other-under-a-label"
"name":"construct-is-a-node-of-the-label-a-literal-runs"

$ git grep -n -e "code that would build another value" -e "construct under a kind its chain built as any other name" -- core/lib/qlang/kind.qlang core/test/unit/QSBLD/chain.test.mjs
core/lib/qlang/kind.qlang:91:            code that would build another value from the payload is no
core/lib/qlang/kind.qlang:576:      code that would build another value from the payload is refused.
core/test/unit/QSBLD/chain.test.mjs:7:it('declares construct under a kind its chain built as any other name, the constructor standing in the literal of the kind', async () => {

$ git show 6413613f^:core/lib/qlang/kind.qlang | grep -n -e "lies under it as" -e "liesUnderTheKindAsItsConstructor"
546:      `| impl ::builtin{}`, its constructor, which lies under it as
565:    | proves :liesUnderTheKindAsItsConstructor
```

### pentimento · docs/spec/QSERR-errors.md:41
«a `:kind` entry a fact as any key is». Фраза противопоставляет текст модели D61/D190, где `:kind` в карте и в ошибке называл тег. Та же оговорка повторяется в QSSLF:60 («`{:kind ::set} | doc` the page of maps»), в четырёх именах кейсов, названных по тому, чего `:kind` больше не делает, и в 30 кейсах, где у ошибки по-прежнему записан факт `{:kind :oops}`. С чистого листа раздел просто говорил бы, что факты ошибки — карта с любыми ключами, а кейсы писали бы нейтральный факт.

```sh
$ qplay 'get [~(!{:kind ::Foo} | raise !| get [~(tag) /kind]) ~({:kind ::set} | doc | eq (::map | doc))]' < /dev/null
[[::error ::Foo] true]

$ git grep -h -o -E '"name":"(a-kind-in-an-error-literal-is-a-fact|raise-names-no-tag-by-a-kind|the-kind-field-of-a-map-names-nothing|the-tag-of-a-map-carrying-a-kind-field-is-map)"' -- core/test/conformance
"name":"raise-names-no-tag-by-a-kind"
"name":"a-kind-in-an-error-literal-is-a-fact"
"name":"the-tag-of-a-map-carrying-a-kind-field-is-map"
"name":"the-kind-field-of-a-map-names-nothing"

$ git grep -c -F "{:kind :oops" -- core/test/conformance
core/test/conformance/QSERR/catch.jsonl:5
core/test/conformance/QSERR/flow.jsonl:1
core/test/conformance/QSERR/raise.jsonl:1
core/test/conformance/QSERR/rest.jsonl:1
core/test/conformance/QSERR/trace.jsonl:19
core/test/conformance/QSQUO/step.jsonl:1
core/test/conformance/QSSYN/comment.jsonl:2

$ head -1 docs/journal/replaced/D190.md
# D190 · The tag of an error is written before its bang, and `:kind` is a fact like any other
```

### archaism · core/lib/qlang/fail.qlang:12
«`~(!| get /kind) | first` answering `::fail~(get /kind)`». В странице 9 таких примеров. Это шаг модели, где ошибка несла свой вид фактом `:kind` (`!{:kind :oops}`), а fail track читал его как `!| /kind`. Сегодня этот шаг на любом отказе каталога сам отказывается с `::path/TagClosedError`. С чистого листа страница показывала бы шаг, на который error at rest действительно отвечает: `~(!| tag)` или `~(!| doc)`.

```sh
$ qplay 'get [~(~(!| get /kind) | first) ~("x" | add 1 !| get /kind !| tag) ~("x" | add 1 !| tag)]' < /dev/null
[::fail~(get /kind) ::path/TagClosedError ::number/add/SubjectNotNumberError]

$ git grep -c "get /kind" -- core/lib/qlang/fail.qlang
core/lib/qlang/fail.qlang:9

$ git show c6577878:core/lib/qlang/fail.qlang | grep -n "/kind"
11:      ~(~(!| /kind) | first | payload | eq ~(/kind))

$ git show c6577878:core/lib/qlang/error.qlang | grep -n -m3 ":kind"
47:        !{:kind :oops :trail 5}
52:        !{:kind :oops} | count
57:        !{:kind :oops} | count
```

### vestige · core/lib/qlang/frame.qlang:85
«A path reads the parts of a frame by the names its kind wires.» Это страница закона, и её опровергает собственный запрос закона: он читает части кавычками, а не путём. Опровергает её и соседний закон: «No path reads beneath the tag of a frame». Фраза осталась от промежуточного шага коммита 297d1956: D451 протянул проводку кадра, при которой части ещё читались путём по именам, а D449 в том же коммите закрыл тег. С чистого листа: «A frame's parts are read by the names its kind wires, bare».

```sh
$ qplay 'get [~(::frame | laws | get /readsItsPartsByTheirNames | first | content) ~("x" | add 1 | mul 2 !| trace | first | get [~(get /subject !| tag) ~(get [~(subject) ~(unfinished) ~(path)])])]' < /dev/null
["A path reads the parts of a frame by the names its kind wires." [::path/TagClosedError ["x" ~(add 1 | mul 2) null]]]

$ git log --format="%h %s" -S "A path reads the parts of a frame by the names its kind wires" -- core/lib/qlang/frame.qlang | cut -c1-120
297d1956 Read a closed tag by its bare names alone (D449), wire the frame, the span and the point (D451), and take expla
```

### vestige · core/lib/qlang/call.qlang:200
`::call/UnknownNameError` выводит факт `:addresses`, а страница сама признаёт: «so `:addresses` holds none here». Факт остался от `::call/UnresolvedIdentifierError`, который держал «where verbs of that name live under other kinds». Этот случай давно ушёл в `KindAnswersNoVerbError`, и `eval.mjs` бросает `UnknownNameError` только при пустом наборе адресов. С чистого листа вид выводил бы `name` и `nearest`, без факта, который всегда `#[]`.

```sh
$ qplay 'get [~(thisIsNotDefined !| addresses) ~([1] | nosuch !| addresses) ~(::call/UnknownNameError | manifest | has ::call/UnknownNameError/addresses) ~(5 | count !| tag)]' < /dev/null
[#[] #[] true ::call/KindAnswersNoVerbError]

$ git grep -n -e "if (addresses.length > 0)" -e "throw new CallUnknownNameError" -- core/src/eval.mjs
core/src/eval.mjs:390:    if (addresses.length > 0) {
core/src/eval.mjs:395:    throw new CallUnknownNameError({ name: makeKeyword(lookupName), nearest: nearestNames(state.scope, lookupName), addresses });

$ git show e5c3f794^:core/lib/qlang/call.qlang | grep -n -e "^:call/UnresolvedIdentifierError" -e "where verbs of that name live under other kinds"
68::call/UnresolvedIdentifierError
71:      `:addresses` where verbs of that name live under other kinds, and
```

### subordination · core/lib/qlang/regex.qlang:20
«The dialect is the one of JavaScript in its edition of 2018 … which only later engines read». Диалект языка задан выпуском платформы. Отказ `toRegex` отдаёт текст ошибки самого движка без его префикса (`ENGINE_PREFIX`), так что причина отказа зависит от рантайма хоста. Тот же слой есть в number.qlang:443–444: предел `range` — «the length a vector of the engine may have» (`2 ** 32 - 1` в arith.mjs). С чистого листа диалект и пределы описывались бы тем, что в них входит, а отказы говорили бы словами языка, одинаково на любом хосте.

```sh
$ qplay 'get [~("(" | toRegex !| message) ~("a{2,1}" | toRegex !| message) ~(::regex | doc | content | contains "edition of 2018")]' < /dev/null
["Unterminated group" "numbers out of order in {} quantifier" true]

$ git grep -n -e "^function laterEditionOf" -e "^const ENGINE_PREFIX" -- core/src/regex-read.mjs
core/src/regex-read.mjs:29:function laterEditionOf(source) {
core/src/regex-read.mjs:41:const ENGINE_PREFIX = /^Invalid regular expression: (?:\/[\s\S]*\/[a-z]*: )?/;

$ qplay '5e9 | range !| get [~(tag) ~(longest)]' < /dev/null
[::number/range/CountTooLargeError 4294967295]

$ git grep -n "LONGEST_VECTOR = " -- core/src/runtime/arith.mjs
core/src/runtime/arith.mjs:22:const LONGEST_VECTOR = 2 ** 32 - 1;
```

### shim · core/lib/qlang/host.qlang:10
«whose page the host writes, the page of the program, which a source of the host declares alone, `:host |~~ … ~~|;`». Повторное объявление имени корня разрешено ровно одному имени, `host`, через особый случай `withThePageOfTheHost`, который срабатывает раньше отказа на повторное объявление. В результате запись `::host` склеена из двух объявлений: `origin` и `source` взяты у playground, а значение — вид, объявленный ядром, и запись этого не говорит. Это дополняет D269: там не названа единственная коллизия имён хоста, которую корень разрешает по имени. С чистого листа хост передавал бы страницу как данные своего notebook, или запись `::host` называла бы, где объявлено её значение.

```sh
$ qplay 'get [~(::host | binding | origin) ~(::host | binding | value | tag) ~(::host | source | toString | contains "::kind") ~(::host/status | binding | origin)]' < /dev/null
[:playground ::kind false :qlang/host]

$ git grep -n -e "^const HOST_NAME" -e "root = withThePageOfTheHost" -e "const again = " -- core/src/runtime/root.mjs
core/src/runtime/root.mjs:33:const HOST_NAME = 'host';
core/src/runtime/root.mjs:58:    root = withThePageOfTheHost(root, declared);
core/src/runtime/root.mjs:59:    const again = [...declared.keys()].find(name => root.has(name));
```

### archaism · core/lib/qlang/host.qlang:105
«the cells of a session before it». D431 назвал ячейки, которые хост гоняет над одним scope, notebook, а слову session оставил только разговор модели. Каталог слова notebook не пишет ни разу, а session употребляет в обоих смыслах. На одной странице это «The host a session is in» (5 раз) и «the cells of a session»; в других местах — «a cell of a session» и «opens a session of cells». С чистого листа: «the cells of a notebook».

```sh
$ git grep -n -w -i -e "of a session" -e "a session of cells" -e "hands a session" -e "the cells of a" -- core/lib playground/lib
core/lib/qlang.qlang:589:            query, a cell of a session and a source of the root are
core/lib/qlang/builtin.qlang:85:            what a name holds in the scope it hands a session or a query,
core/lib/qlang/host.qlang:105:  |~~ Answers what the reader declared before the step, the cells of a
playground/lib/qlang/playground.qlang:12:      `qplay -i ['<query>']` opens a session of cells, the query its first,

$ git grep -c "a session is in" -- core/lib/qlang/host.qlang
core/lib/qlang/host.qlang:5

$ git grep -c -w -i notebook -- core/lib playground/lib docs/spec/QSHST-hosts.md docs/spec/QSLEX-the-words-and-the-names.md
docs/spec/QSHST-hosts.md:11
docs/spec/QSLEX-the-words-and-the-names.md:2

$ sed -n '43,44p' docs/journal/replaced/D431.md
- The word session names the conversation of a model alone, the word of
  the harness its transcripts are read by.
```

### vestige · core/src/runtime/env.mjs:1
Модуль примитивов `::host` назван по одному из двух своих глаголов и помечен `[QSSLF#axis]`. Это слой, где `env` и `kinds` были осями любого значения (`any/env`, `any/kinds`) до D476, которая перенесла их под `::host`, а модуль не переименовала. Рядом `arith.mjs` держит примитивы `::number`, а `code.mjs` — смесь `string/parse`, `any/apply` и трёх глаголов `::quote`; это раскладка «по теме» (bdbcd3a1), которую правило D431 и [QSLEX#grep] (`<noun>-primitives.mjs` рядом со страницей) переписало только для девяти нот. С чистого листа были бы `host-primitives.mjs`, `number-primitives.mjs` и `quote-primitives.mjs`, а каждая пометка называла бы правило своего модуля.

```sh
$ git -C D:/git/qlang-worktrees/closeout-pentimento ls-files --error-unmatch core/src/runtime/env.mjs core/src/runtime/arith.mjs core/src/runtime/code.mjs
core/src/runtime/arith.mjs
core/src/runtime/code.mjs
core/src/runtime/env.mjs

$ git -C D:/git/qlang-worktrees/closeout-pentimento ls-files --error-unmatch core/src/runtime/host-primitives.mjs
error: pathspec 'core/src/runtime/host-primitives.mjs' did not match any file(s) known to git
Did you forget to 'git add'?

$ git grep -n -e "^// " -e "registerStateReader('host/" -- core/src/runtime/env.mjs
core/src/runtime/env.mjs:1:// [QSDSP#residence], [QSSLF#axis], [QSNAM#binding]
core/src/runtime/env.mjs:8:registerStateReader('host/env', (subject, state) => readerNamesOf(state.scope));
core/src/runtime/env.mjs:9:registerStateReader('host/kinds', (subject, state) => makeSet(kindNamesOf(state.scope).map(makeTag)));

$ git show 9809a8c8 -- core/src/runtime/env.mjs | grep -E "^[-+]register"
-registerStateReader('any/env', (subject, state) => readerNamesOf(state.scope));
-registerStateReader('any/kinds', (subject, state) => makeSet(kindNamesOf(state.scope).map(makeTag)));
+registerStateReader('host/env', (subject, state) => readerNamesOf(state.scope));
+registerStateReader('host/kinds', (subject, state) => makeSet(kindNamesOf(state.scope).map(makeTag)));

$ git grep -h -o -E "register(Primitive|StateReader)\('[a-z]+/[a-zA-Z]+'" -- core/src/runtime/code.mjs
registerStateReader('string/parse'
registerPrimitive('quote/toString'
registerStateReader('any/apply'
registerStateReader('quote/answer'
registerPrimitive('quote/fill'
```

### shim · core/src/runtime/doc-primitives.mjs:8
Один факт — вектор сегментов дока — вычисляют два примитива с одинаковым телом: `doc/segments` здесь и `doc/toVec` в `convert.mjs:89`. Второй добавлен в D422 рядом со старым первым, и у каждого своя страница. Это дополняет часть 12 D339: псевдонимы там записаны рецептом `~(count)`, а здесь это вторая копия примитива. С чистого листа был бы один примитив, а второе имя — рецептом над ним или вовсе отсутствовало бы.

```sh
$ qplay '::Box|~~ a ~(b) c ~~| | get [~(segments) ~(toVec) ~(segments | eq toVec)]' < /dev/null
[["a " ~(b) " c"] ["a " ~(b) " c"] true]

$ git grep -n -e "'doc/segments'" -e "'doc/toVec'" -- core/src/runtime
core/src/runtime/convert.mjs:89:registerPrimitive(['vec/toVec', 'set/toVec', 'quote/toVec', 'doc/toVec'], sequence => Object.freeze([...sequence]));
core/src/runtime/doc-primitives.mjs:8:registerPrimitive('doc/segments', doc => Object.freeze([...doc]));
```

### vestige · core/lib/qlang/invariant.qlang:22
«Declared by a name outside a chain, an invariant holds of nothing and is refused.» `::bind/WrittenOutsideItsChainError` отказывает тем формам, которые D252 вывела из языка: invariant, конструктор и вход (путь-селектор), объявленные по имени. Поэтому путь под глаголом отклоняется, а число под тем же глаголом и путь под меткой — обычные данные. С чистого листа такого отказа не было бы: он защищает от привычки, которую дало только прошлое самого языка, а узел под глаголом был бы данными, как любой другой.

```sh
$ qplay 'get [~(~(:vec/take/hint 5;) | answer) ~(~(:vec/take/hint /0;) | answer !| tag) ~(~(:Box |~~ B ~~|; :Box/hint /0;) | answer) ~(~(:Box |~~ B ~~|; :Box/check ::invariant~(gt 0);) | answer !| tag)]' < /dev/null
[#[::vec/take/hint] ::bind/WrittenOutsideItsChainError #[::Box ::Box/hint] ::bind/WrittenOutsideItsChainError]

$ git show 4d753971 -- core/lib/qlang/bind.qlang | grep -n -E "^\+    \| proves :WrittenOutsideItsChainError/refuses(AnInvariantDeclaredBare|AConstructorUnderALabel|AnInputUnderAWord)"
169:+    | proves :WrittenOutsideItsChainError/refusesAnInvariantDeclaredBare
179:+    | proves :WrittenOutsideItsChainError/refusesAConstructorUnderALabel
182:+    | proves :WrittenOutsideItsChainError/refusesAnInputUnderAWord

$ git show -s --format=%s 4d753971
Build a kind from ::kind by commands, retire the declaration of roles by name, and gate every case of the suite by its record (D252, D253, D254)
```

### archaism · core/lib/qlang/kind.qlang:342
«The kind with the field after the ones it read.» и kind.qlang:8 «the fields it reads of the payload». Это страница ответа команды `reads`, перенесённая дословно, когда D450 переименовала её в `wires`. Глагол старой команды остался, а страница самой `wires` называет ту же вещь словом «part». С чистого листа: «The kind with the part after the ones it wires».

```sh
$ qplay 'get [~(::kind/wires/answer | doc | content) ~(::kind/reads | doc !| tag) ~(::kind/wires | doc | content | lines | first)]' < /dev/null
["The kind with the field after the ones it read." ::any/doc/UnknownNameError "Wires a part of the payload of a kind to a name: its name, its page,"]

$ git show 4306645e^:core/lib/qlang/kind.qlang | grep -n -e "^:kind/reads" -e "after the ones it read" -e "the fields it reads of"
8:  |~~ A kind: the payload its tag is laid over, the fields it reads of the
302::kind/reads
321:    | returns |~~ The kind with the field after the ones it read. ~~| ::kind

$ head -1 docs/journal/replaced/D450.md
# D450 · The commands of the chain of a kind: `accepts` its payload and `wires` a part
```

### vestige · core/lib/qlang/desc.qlang:4
«The rules it holds: [QSDSP#residence].» Часть 3 D412 уже считает, что эту пометку несут 32 источника. Дополнение — откуда она взялась: когда писались главы, ссылку на D114 («A kind lives whole in the source of its noun») механически заменили на `[QSDSP#residence]`. Правило D114 при этом стоит в [QSHST#source]. desc.qlang держит [QSORD#desc], который не помечает ни один источник каталога. С чистого листа каждый источник помечал бы свои разделы, например desc.qlang — [QSORD#desc], а call/construct/fail/group — [QSQUO#step].

```sh
$ git show b5347827 -- core/lib/qlang/desc.qlang | grep -E "^[-+].*decisions it"
-   The decisions it exists for: [D114]. ~|
+   The decisions it exists for: [QSDSP#residence]. ~|

$ head -1 docs/journal/replaced/D114.md
# D114 · A kind lives whole in the source of its noun, and the source of the language holds its topic alone

$ git grep -n -e "The rules it holds" -e "so a kind lives whole in the source of its" -- core/lib/qlang/desc.qlang docs/spec/QSHST-hosts.md
core/lib/qlang/desc.qlang:4:   The rules it holds: [QSDSP#residence]. ~|
docs/spec/QSHST-hosts.md:81:declared under it after, so a kind lives whole in the source of its

$ git grep -l "QSORD#desc" -- core/lib core/src
core/src/ordering.mjs
```

### archaism · core/lib/qlang/fn.qlang:209
`proves :CommandNotTakenError/countsTheObjectsAsTheLiteralDoes`. Это адрес закона, и в нём сохранился термин «objects», которым команда цепочки называла то, что берёт, до D440 («modifiers»). Страница закона при этом уже говорит «a modifier». С чистого листа: `countsTheModifiersAsTheLiteralDoes`.

```sh
$ qplay '::fn/CommandNotTakenError | laws | get /countsTheObjectsAsTheLiteralDoes | first | content' < /dev/null
A command its verb writes with a modifier left out or past the
last is refused as the literal's is.

$ git show 326adb89:core/lib/qlang/fn.qlang | grep -n -A1 "countsTheObjectsAsTheLiteralDoes"
166:    | proves :CommandNotTakenError/countsTheObjectsAsTheLiteralDoes
167-        |~~ A command its verb writes with an object left out or past the

$ head -1 docs/journal/replaced/D440.md
# D440 · What a command of a chain takes is its modifiers, the input `modifiers` of its verb
```

### drift · core/lib/qlang/excerpt.qlang:10
«`:addend/found ::cell"…";` … `:addend/found/tag ::vec;`». Так же в cell.qlang:14 и kind.qlang:425. Записи выписки — пары карты, и печать и главы пишут их без `;`. Механическая переписка D421 (5c6aabdd) поставила после них `;`, приняв их за объявления. Одна и та же запись выписки выглядит двумя способами, и читатель примет вторую за объявление. С чистого листа запись пишется так, как её печатает alert.

```sh
$ qplay '1 | add (3410 | range)' < /dev/null | grep -c -E '^  :addend/found(/tag ::vec| ::cell"[0-9a-f]{12}")$'
2

$ git grep -n -E '(::cell"…"|:addend/found/tag ::vec|count 3410);' -- core/lib
core/lib/qlang/cell.qlang:14:      `:answer ::cell"…";`, under the identity of the query and what it keeps,
core/lib/qlang/excerpt.qlang:10:      host keeps it in, `:addend/found ::cell"…";`, beside its tag and the
core/lib/qlang/excerpt.qlang:12:      name of the fact and its own, `:addend/found/tag ::vec;` and
core/lib/qlang/excerpt.qlang:13:      `:addend/found/count 3410;`, and beside its parts, each by the same
core/lib/qlang/kind.qlang:425:      `:addend/found/tag ::vec;` and `:addend/found/count 3410;`; the legend

$ git show 5c6aabdd -- core/lib/qlang/excerpt.qlang | grep -E "^[-+].*addend/found/tag"
-      name of the fact and its own, `:addend/found/tag ::vec` and
+      name of the fact and its own, `:addend/found/tag ::vec;` and
```

### drift · core/lib/qlang/fn.qlang:355
`wires :answer` у `::fn/slot` («What the code of the slot answered») рядом с `tells :answer` (fn.qlang:322, «The answer the recipe of a verb gave»). Одно слово называет и слот, и часть слота, отсюда адрес `::vec/take/answer/answer`. Кроме того, это два разных глагола (`quote/answer` выполняет код, `cell/answer` читает то, что хранит хост) и факт `:answer` у `::qlang/AnswerBeyondBudgetError`. С чистого листа у части слота было бы своё слово, и ответ кода на элемент не путался бы с ответом глагола.

```sh
$ qplay 'get [~(::vec/take/answer | manifest | has ::vec/take/answer/answer) ~(::vec/take/answer | doc | content) ~(::fn/slot | doc :answer | content | lines | first) ~(::qlang/AnswerBeyondBudgetError | manifest | has ::qlang/AnswerBeyondBudgetError/answer) ~(::quote/answer | binding | origin) ~(::cell/answer | binding | origin)]' < /dev/null
[true "The first elements, as many as the count." "What the code of the slot answered: where the verb ran it on a" true :qlang/quote :stdio]
```

### drift · core/lib/qlang/call.qlang:37
«a vector of a word at least» — здесь word значит модификатор, а через 140 строк, в call.qlang:178, «a word of their reader» значит глагол. В других страницах «a quote of one word» значит шаг, «runs a pipeline as one word» — группу, «a word of a literal» — `true`/`false`/`null`. Это то самое родовое слово, которое aim приводит как пример кучи смыслов. С чистого листа каждый смысл получил бы свой термин: modifier, verb, step, the word of a literal.

```sh
$ qplay 'get [~(::call | doc :PayloadNotSchemaError | content | contains "vector of a word at least") ~(::call/KindsMismatchedError | doc | content | contains "by a word of their reader") ~(::map/reduce | doc | content | contains "a quote of one word") ~(::group | doc | content | contains "as one word")]' < /dev/null
[true true true true]

$ git grep -n "strikes a heap of senses" -- docs/journal/AIM.md
docs/journal/AIM.md:149:`word` strikes a heap of senses. One concept goes by one term and one
```

### subordination · core/lib/qlang/cell.qlang:26
Инвариант вида ядра `::cell` обоснован так: «so it names no folder past the store its host keeps». Страница вида рассказывает, что делает один хост («The command line keeps so …»), а единственный глагол вида, `answer`, объявлен хостом stdio. Это дополняет D424, которая видит в ячейке первого обитателя, переданного хостом: здесь и форма идентичности в ядре продиктована файловым хранилищем этого хоста. С чистого листа ядро говорило бы, что такое идентичность, безопасность каталогов жила бы у хранилища хоста, а поведение командной строки — на странице её хоста.

```sh
$ qplay 'get [~(::cell"../notes" !| tag) ~(::cell/answer | binding | origin) ~(::cell/PayloadNotIdentityError | doc | content | contains "names no folder past the store its host keeps") ~(::cell | doc | content | contains "The command line keeps")]' < /dev/null
[::cell/PayloadNotIdentityError :stdio true true]
```

### drift · core/lib/qlang/host.qlang:31
«Answers the screen of the host». Слово screen называет здесь ответ `::host | status` (секции `::host/labels` и `::host/streams`). В других текстах так же называются first screen — первые страницы `[::qlang ::host] | map …` (qlang.qlang:2, QSPRN:279, QSMSR:13), и screen of the work — `npm run desk` (QSVOX:15). Читатель фразы «the first screen a session reads» станет искать её в `::host | status`. С чистого листа у каждого из трёх было бы своё слово.

```sh
$ git grep -n -w -i -e "first screen" -e "its screen" -e "the screen of" -- core/lib docs/spec/QSPRN-printing-and-codecs.md docs/spec/QSVOX-the-texts-and-their-voices.md docs/spec/QSMSR-the-measures.md
core/lib/qlang.qlang:2:   its page, the first screen a session reads, the refusal of an answer
core/lib/qlang.qlang:964:            host writes, `::host | status` answers its screen, the sections
core/lib/qlang/host.qlang:2:   page, which the host writes, its screen, the kinds that lie on it and
core/lib/qlang/host.qlang:11:      `:host |~~ … ~~|;`. `::host | status` answers its screen, the
core/lib/qlang/host.qlang:31:  |~~ Answers the screen of the host a session is in, its state in
docs/spec/QSMSR-the-measures.md:13:first screen, the pages of the language and of the playground as
docs/spec/QSPRN-printing-and-codecs.md:279:`count` counts a string, which is never smaller than the first screen,
docs/spec/QSVOX-the-texts-and-their-voices.md:15:The screen of the work, `npm run desk`, and the sensors under
docs/spec/QSVOX-the-texts-and-their-voices.md:67:the screen of the work, the aim and the records in transit and open, where

$ qplay '::host | status | map /section' < /dev/null
[::host/labels ::host/streams]
```

### pentimento · core/lib/qlang/fn.qlang:30
«A verb is a function named under a label, called by its function alone»; то же в странице закона fn.qlang:152 («called by its function»). Это противопоставление из D251 («reads its roles from the function alone») с ролями, которые раньше объявлялись по имени под глаголом. Без того фона фразу нечем проверить. С чистого листа: «A verb is a function named under a label».

```sh
$ qplay 'get [~(::fn | doc | content | contains "called by its function alone") ~(::fn | laws | get /isAVerbNamedUnderALabel | first | content)]' < /dev/null
[true "A function named under a label is a verb, called by its\nfunction."]

$ sed -n '76p' docs/journal/replaced/D251.md
The call of a function reads its roles from the function alone. The
```

### pentimento · core/lib/qlang/error.qlang:13
«a reader learning a tool fails often, and the failure brings what the reader needs at the moment it is cheapest to give». Это намерение из aim, перенесённое в первую страницу `::error` (c6577878). Никакой читатель не проверит его против дерева. С чистого листа страница говорила бы, что несёт ошибка, а её зачем осталось бы в aim.

```sh
$ qplay '::error | doc | content | lines | get [/3 /4 /5]' < /dev/null
["call. A step that fails answers an error raised, a failure; a" "reader learning a tool fails often, and the failure brings what" "the reader needs at the moment it is cheapest to give."]

$ git show c6577878:core/lib/qlang/error.qlang | grep -n -A1 "A reader learning a tool fails often"
9:  |~~ The kind of errors. A reader learning a tool fails often, and
10-      a failure is the moment when the knowledge it needs is cheapest to
```

### drift · core/lib/qlang/each.qlang:7
«every key of which is data, an id, a date, a uuid or an email». Глава называет тот же класс ключей «a number» (QSPTH:364). По слову «an id» читатель ждёт, что сложатся и ключи вроде `u17`, но они не складываются. С чистого листа одно слово, «a number», в каталоге и в главе.

```sh
$ qplay 'get [~({:"17" {:a 1} :"42" {:a 2}} | shape | payload | tag) ~({:"u17" {:a 1} :"u42" {:a 2}} | shape | payload | tag) ~(::each | doc | content | contains "an id, a date")]' < /dev/null
[::each ::map true]

$ git grep -n "where every key is data, a number" -- docs/spec/QSPTH-paths.md
docs/spec/QSPTH-paths.md:364:telling how the keys of the data read: where every key is data, a number,
```

### drift · core/lib/qlang/fail.qlang:36
«The value written after the bang.» Здесь bang — комбинатор `!|`. В остальных семи местах каталога и глав bang — знак литерала ошибки `!{…}`. Читатель отнесёт `:found` к содержимому `!{…}`. С чистого листа: «The value written after `!|`».

```sh
$ qplay 'get [~(::fail/StepNotCommandError/found | doc | content) ~(::error | doc | content | contains "written with a bang")]' < /dev/null
["The value written after the bang." true]

$ git grep -n -w "bang" -- core/lib docs/spec | cut -c1-110
core/lib/qlang.qlang:355:        |~~ A tag before the bang names the kind of the error. ~~|
core/lib/qlang/construct.qlang:89:            literal written with the tag before its bang.
core/lib/qlang/error.qlang:16:      An error at rest is written with a bang, `!{:reason :late}`, the
core/lib/qlang/error.qlang:17:      tag of its site before the bang, `::Late!{:by 3}`; it is
core/lib/qlang/error.qlang:18:      `::error{…}` under that tag, and prints with its bang, as a set
core/lib/qlang/error.qlang:60:        |~~ The bang writes an error at rest of the kind of errors. ~~|
core/lib/qlang/fail.qlang:36:          | wires :found |~~ The value written after the bang. ~~|)
docs/spec/QSERR-errors.md:16:`::Foo::error{…}`, the facts laid under the tag written before the bang
```
