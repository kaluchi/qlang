> A pentimento audit of qlang--builtin for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–00:05 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### vestige · core/lib/qlang.qlang:676
«The verbs of the kinds the walk of a value's tags reaches and those of every value are the whole of its verbs: a verb in none of them does not exist.»
Слой: модель поиска глагола, какой она была до D476 (переход выполнен 9809a8c8, 2026-10-29). Тогда глаголы значения находил только обход его тегов до `::any`, а глагола другой метки, которого вызывают по адресу на виды из его `on`, глава не знает.
Чистый лист: глава `::qlang/verbs` описывает обе дороги, как [QSDSP#residence]. Голое имя ищется обходом тегов субъекта, адрес — по резиденции и по видам из `on` (`5 | Shop/double`, `[1 2] | stdio/out json`).
```sh
$ qplay ':Shop |~~ A shop. ~~|; :Shop/double (::fn | on |~~ A number. ~~| ::number | impl ~(mul 2)); get [~(5 | Shop/double) ~(5 | double !| tag) ~(::qlang/verbs | doc | content | lines | join " " | contains "a verb in none of them does not exist")]' < /dev/null
[10 ::call/KindAnswersNoVerbError true]

$ git log --format="%h %ad" --date=short -S "a verb in none" -- core/lib/qlang.qlang
60b3eedb 2026-10-16

$ git log -1 --format="%h %ad" --date=short 9809a8c8
9809a8c81 2026-10-29
```

### subordination · core/lib/qlang.qlang:987
«The playground reads JSON from stdin as values and other text as a string, … its page, `::host | doc`, tells the rest.» Первая страница добавляет «and whole in the REPL of the command line» (стр. 178–179).
Слой: глава `::qlang/hosts` была страницей командной строки. До последней правки в ней стояло «The command line reads JSON from stdin … `::cli | doc`», и при правке её лишь переименовали. Исключение одного хоста, его REPL, несёт и первая страница ядра.
Чистый лист: каталог ядра говорит то, что верно для каждого хоста. Про stdin, REPL и страницу под алертом пишет `::host | doc` самого playground, и он это уже пишет; в `core/src` playground не назван ни разу. Дополняет D412 (часть 1): та говорит о чтениях инструментов и тестах хостов в ядре, а здесь то же видно в первой странице и главе каталога.
```sh
$ qplay 'get [~(::qlang | doc | content | lines | join " " | contains "and whole in the REPL of the command line") ~(::qlang/hosts | doc | content | lines | join " " | contains "The playground reads JSON from stdin as values") ~(::host | binding | origin) ~(::host | doc | content | lines | join " " | contains "but in the REPL, which prints it whole")]' < /dev/null
[true true :playground true]

$ git grep -c -i -w -e playground -e qplay -e REPL -- core/lib core/src
core/lib/qlang.qlang:7

$ git show a9df14a5~1:core/lib/qlang.qlang | grep -n -B2 -A3 "reads JSON"
952-            of its refusal's page, as `!| doc` reads it, so the reader
953-            repairs the call where it failed. The command line
954:            reads JSON from stdin as values and other text as a string,
955-            and prints its answer as the language prints it, a string as
956-            its text, so `| json` writes JSON; its page, `::cli | doc`,
957-            tells the rest.
```

### subordination · core/lib/qlang.qlang:216
«write it whole through the door the query opens itself: `stdio/out` a text, `print | stdio/out` the literal of a value and `json | stdio/out` its JSON.» То же есть в главе хостов, стр. 974.
Слой: потоки были словами командной строки, и починку отказа ядра написали её словами. После D476–D477 потоки ушли в пакет `@kaluchi/qlang-stdio`, от которого ядро не зависит, а страница отказа ядра всё ещё зовёт `stdio/out`.
Чистый лист: страница `::qlang/AnswerBeyondBudgetError` чинит словами ядра: `get`, `take`, `keys`, `count`, `shape` и `answer` клетки. Дверь потоков называет страница того хоста, который их ставит; `::host | doc` playground её уже называет.
```sh
$ qplay 'get [~(::stdio/out | binding | origin) ~(::qlang/AnswerBeyondBudgetError | doc | content | contains "stdio/out") ~(::qlang/hosts | doc | content | lines | join " " | contains "`print | stdio/out` writes an answer whole")]' < /dev/null
[:stdio true true]

$ git grep -l ":stdio/out" -- "*.qlang"
stdio/lib/qlang/stdio.qlang

$ git grep -c "qlang-stdio" -- core/package.json core/src | wc -l
0
```

### vestige · core/src/runtime/json.mjs:39
«error:   e => ({ $error: { $tag: e.tag.name, facts: toPlain(e.facts) } })». Глава [QSPRN#json] (стр. 187–189) повторяет: «a failure a host converts … writes `{"$error": {"$tag": name, "facts": …}}`».
Слой: JSON-режим командной строки (D103, D192: на JSON-вход отвечали JSON, ошибку писали объектом `$error`). Режим ушёл в D402 вместе с `--json`. Теперь ни один хост дерева не отдаёт неудачу в `toPlain`; форму читают только регэкспы `scripts/benchmark` над старыми прогонами и один тест.
Чистый лист: у ошибки одна JSON-форма — та, что `json` пишет над ошибкой покоя. Ни обработчика `error` в `toPlain`, ни фразы о `$error` в главе нет.
```sh
$ qplay '"x" | add 1 !| json | parseJson | keys' < /dev/null
#[:"$tag" :payload]

$ git grep -n -P "\x24error" -- core/src scripts playground/src stdio/src site/src lsp/src
core/src/runtime/json.mjs:39:  error:   e => ({ $error: { $tag: e.tag.name, facts: toPlain(e.facts) } })
scripts/benchmark/child.mjs:48:  const failure = /::([\w/@.-]+)!\{|"\$error": \{\s*"\$tag": "([^"]+)"/.exec(toolResultText);
scripts/benchmark/verdict.mjs:37:const shortAnswer = answer => (answer?.['$error'] !== undefined ? `отказ ${answer['$error']['$tag']}` : JSON.stringify(answer).slice(0, 100));

$ git grep -n -w -e toPlain -e fromPlain -- playground stdio site lsp vscode scripts | wc -l
0

$ git log --oneline -S "facts: toPlain" -- core/src
285240b00 Let the refusal of an answer JSON cannot carry hold the answer's literal, and an error's JSON write its facts (D192)
```

### drift · core/lib/qlang/bind.qlang:7
«adds a word with its page to the scope of the text, its `::binding`: a kind, … and a value under a bare name». Рядом `::builtin/RootValueNotWordError`: «A source of the root declares words, a kind, a verb under a label and a node under a noun, data under an address among them». И `::bind/ChainAnswersNoWordError`: «builds a word: a kind, a function, a page or a law».
Слой: «word» — общее слово ранних текстов для всякого объявленного имени, и на нём названы два отказа. AIM при этом прямо говорит, что `word` «strikes a heap of senses». В итоге значение под голым именем у `::bind` слово, а у `::builtin` нет; данные под адресом у `::builtin` слово, а у `ChainAnswersNoWordError` нет.
Чистый лист: объявление пишет `::binding`. То, что строит цепь, и то, чего корень ждёт от источника, носят каждое свой термин, и имена отказов идут от этих терминов.
```sh
$ qplay 'get [~(::bind | doc | content | lines | join " " | contains "adds a word with its page to the scope of the text") ~(::bind | doc | content | lines | join " " | contains "and a value under a bare name, which the query reads") ~(::builtin/RootValueNotWordError | doc | content | lines | join " " | contains "A source of the root declares words, a kind, a verb under a label and a node under a noun, data under an address among them") ~(::bind/ChainAnswersNoWordError | doc | content | lines | join " " | contains "builds a word: a kind, a function, a page or a law")]' < /dev/null
[true true true true]

$ git grep -n "strikes a heap of senses" -- docs/journal/AIM.md
docs/journal/AIM.md:149:`word` strikes a heap of senses. One concept goes by one term and one
```

### vestige · core/lib/qlang/builtin.qlang:68
«A name is `::builtin{}`, or a kind ends in one, and the host handed no primitive for it». В главе хостов то же: «brings verbs of its own, each a name whose value is `::builtin{}`» (qlang.qlang:961).
Слой: глагол хоста в виде голого дескриптора под меткой (`:any/x ::builtin{};`) — форма из времени до глаголов, построенных цепью. Сегодня ни один источник так не пишет, каждый глагол хоста — `::fn`. Но корень всё ещё оборачивает голую форму в `functionOfRecipe(value)`, а у читателя она становится функцией без команд, хотя страница `::builtin` (стр. 18–19) говорит «a name that holds one reads it as data».
Чистый лист: у глагола хоста одна форма — функция с рецептом `impl ::builtin{}`; голый дескриптор под меткой — это данные.
```sh
$ qplay 'get [~(::builtin/PrimitiveNotHandedError | doc | content | lines | first) ~(::qlang/hosts | doc | content | lines | join " " | contains "each a name whose value is `::builtin{}`") ~(::stdio/out | binding | value | tag) ~(::host | kinds | toVec | map ~(manifest) | flat | filter ~(binding | value | tag | eq ::builtin) | count)]' < /dev/null
["A name is `::builtin{}`, or a kind ends in one, and the host" true ::fn 0]

$ qplay ':any/greet ::builtin{}; get [~(::any/greet | binding | value | tag) ~(5 | any/greet !| get [~(tag) ~(found)])]' < /dev/null
[::builtin [::fn/RecipeMissingError ::fn[~() ::builtin{}]]]

$ git grep -n "functionOfRecipe(value)" -- core/src/runtime/root.mjs
core/src/runtime/root.mjs:70:      takePrimitive(builtin, primitive, [isFn(value) || isKind(value) ? value : functionOfRecipe(value)], name);
```

### archaism · core/lib/qlang/builtin.qlang:52
«a fact that neither its label nor `::error` declares … the facts an error holds are the definitions under the label that names it, and under `::error` for those every refusal shares».
Слой: модель, где факты отказа объявлялись узлами-«definitions» под меткой отказа, а общие для всех отказов — под `::error`. Теперь факты провязывает вид отказа (`throws … ~(wires …)`), под `::error` нет ни одного факта, а код поднимает дефект за факт, «which the kind of its refusal does not wire».
Чистый лист: страница говорит то, что проверяет `factsInOrder`, — факт, которого вид отказа не провязывает, — и чинит записью `wires` в цепи отказа. Слово «definition», занятое в [QSSLF#catalog] под историю имени, второго смысла не несёт.
```sh
$ qplay 'get [~(::builtin/RefusalFactNotDeclaredError | doc | content | lines | join " " | contains "or under `::error` when every refusal shares it") ~(::error | manifest)]' < /dev/null
[true #[::error/PayloadKindNotTakenError ::error/payload]]

$ git grep -n "does not wire" -- core/src/error-convert.mjs
core/src/error-convert.mjs:14:  ({ address, fact }) => `${address.literal} carries ${fact.literal}, which the kind of its refusal does not wire`);
```

### shim · core/lib/qlang/bind.qlang:153
«so a `print` declared under a label is refused, `:name` naming it». Связыватель (`eval.mjs:228`) отказывает одному имени, `print`, хотя `json` и `tag` того же `::any` читатель затеняет свободно.
Слой: дверь собственного print вида, которую закрыл D478. Отказ — выбор модели в D478, и он сторожит форму, которой больше нет. `core/README.md:101–102` всё ещё пишет «the print a kind declares among it».
Чистый лист: принтер литерала не читает глаголов, так что `print` — такой же глагол `::any`, как `json`. Все их держит одно правило резиденции, без особого имени в связывателе и без отказа под него.
```sh
$ qplay ':Box |~~ A box. ~~|; :Box/json ~("j"); :Box/tag ~("t"); get [~(::Box#1 | json) ~(::Box#1 | tag) ~(~(:Box |~~ B ~~|; :Box/print ~("p");) | answer !| tag)]' < /dev/null
["j" "t" ::bind/PrintDeclaredError]

$ git grep -n -e "kind declares among it" -e "PRINT_NAME" -- core/README.md core/src/eval.mjs
core/README.md:102:  kind declares among it and a failure under the line that says it was
core/src/eval.mjs:54:const PRINT_NAME = 'print';
core/src/eval.mjs:228:  if (nounName !== null && nounName !== ANY_KIND_NAME && splitAddress(name)[1] === PRINT_NAME) throw new BindPrintDeclaredError({ name: makeKeyword(name) });
```

### subordination · core/src/runtime/print.mjs:52
«export async function boundAnswer(answer, scope, written = null, keep = null)». Параметр `written` — текст, который хост пишет вместо печати; передаёт его один playground, и только для строки.
Слой: соглашение командной строки «строка выводится своим текстом» протекло в бюджет ядра. Строка, чья печать длиннее бюджета, в playground выводится целой, хотя [QSPRN#budget] считает «the characters of the print».
Чистый лист: ядро считает бюджет по печати, единственному известному ему тексту, одинаково для всех хостов, и в его API нет параметра одного хоста.
```sh
$ qplay '15999 | range | map ~("a") | join ""' < /dev/null | wc -c
16000

$ qplay '15999 | range | map ~("a") | join "" | print | count' < /dev/null
16001

$ git grep -n "ANSWER_BUDGET =" -- core/src/rooms.mjs
core/src/rooms.mjs:8:export const ANSWER_BUDGET = 16000;

$ git grep -n "boundAnswer(" -- playground/src stdio/src site/src
playground/src/render.mjs:40:    const shown = await boundAnswer(result, scope, typeof result === 'string' ? result : null, kept);
playground/src/render.mjs:53:  return await shownText(await boundAnswer(value, scope, typeof value === 'string' ? value : null), value, scope, page);
playground/src/repl.mjs:126:    const shown = isErrorValue(result) ? await boundAnswer(result, scope, null, value => keepCell({ query: cellEntry.source, scope, value })) : result;
site/src/lib/cell-shown.js:13:    const shown = await boundAnswer(result, scopeAfterCell);
stdio/src/streams.mjs:30:      const shown = await printAnswer(await boundAnswer(subject, state.scope, null, kept), state.scope);
```

### shim · core/lib/qlang/bind.qlang:63
«~(wires :message |~~ What the rule of a name says of the name. ~~| ::string». `::bind/NameNotCallableError` и `::bind/LiteralComputesError` заново пишут провязку, которую `call.qlang:53` и `:63` уже пишут для тех же отказов. При этом в той же цепи `PayloadNotSchemaError` делит вид `::call/PayloadNotSchemaError` по тегу (стр. 54).
Слой: копии провязки `::call` сделаны 2026-10-19. Когда 2026-10-25 `PayloadNotSchemaError` стал делить вид `::call`, две другие копии остались как были.
Чистый лист: все три отказа `::bind` делят вид своего двойника из `::call` одним тегом ([QSBLD#fn]), и факт `:message` со страницей стоит в одном месте.
```sh
$ qplay 'get [~(::bind/NameNotCallableError | manifest | map ~(binding | name | toString | split "/" | last) | eq (::call/NameNotCallableError | manifest | map ~(binding | name | toString | split "/" | last))) ~(::bind/LiteralComputesError | manifest | map ~(binding | name | toString | split "/" | last) | eq (::call/LiteralComputesError | manifest | map ~(binding | name | toString | split "/" | last))) ~(::bind/PayloadNotSchemaError | manifest | map ~(binding | name | toString | split "/" | last))]' < /dev/null
[true true ["expected" "field" "found" "index" "trace"]]

$ git grep -n -e "What the rule of a name says of the name" -e "What the rule says of the literal, the template" -e "        ::call/PayloadNotSchemaError" -- core/lib/qlang/bind.qlang core/lib/qlang/call.qlang
core/lib/qlang/bind.qlang:54:        ::call/PayloadNotSchemaError
core/lib/qlang/bind.qlang:63:        ~(wires :message |~~ What the rule of a name says of the name. ~~| ::string
core/lib/qlang/bind.qlang:73:              |~~ What the rule says of the literal, the template `get` builds it
core/lib/qlang/call.qlang:53:        ~(wires :message |~~ What the rule of a name says of the name. ~~| ::string
core/lib/qlang/call.qlang:63:              |~~ What the rule says of the literal, the template `get` builds it

$ git log --format="%h %ad" --date=short -S "What the rule of a name says of the name" -- core/lib/qlang/bind.qlang | tail -1
816a23d5 2026-10-19

$ git log --format="%h %ad" --date=short -S "::call/PayloadNotSchemaError" -- core/lib/qlang/bind.qlang | tail -1
491a19c6 2026-10-25
```

### vestige · core/lib/qlang/any.qlang:2386
«wires :name |~~ The name asked for, a keyword or a tag. ~~| #[::keyword ::tag]». Провязка факта `:name` из `::any/UnknownNameError` переписана в три отказа `with`, в `::bind/NameNotCallableError` и дальше: всего десять копий в пяти источниках.
Слой: копия первой провязки имени. В `with` и в связывании имя пишут, а не «asked for», и оно всегда ключевое слово (`with.mjs` строит его через `makeKeyword`), так что страница факта говорит то, чем значение не бывает. Рядом `::call/UnknownNameError` и `::any/UnknownNameError` провязывают одни и те же факты дважды, с разными страницами и видами `:name`.
Чистый лист: факт назван и описан по тому, что он держит там, где его кладут, а у отказа имени, которого ничто не объявляет, один вид, общий шагу и осям. Дополняет D339 (часть 12): копия здесь не только повторяет факт, но и ошибается в нём.
```sh
$ qplay 'get [~({:items [5 6]} | with [/items/0] ~(it) !| name | tag) ~({:name :"a b" :body 1} | tag ::bind !| name | tag) ~(::any/with/NamesKeyNotNameError/name | doc | content)]' < /dev/null
[::keyword ::keyword "The name asked for, a keyword or a tag."]

$ git grep -c "The name asked for, a keyword or a tag" -- core/lib
core/lib/qlang/any.qlang:4
core/lib/qlang/bind.qlang:1
core/lib/qlang/call.qlang:1
core/lib/qlang/fn.qlang:2
core/lib/qlang/kind.qlang:2

$ qplay 'get [~(::call/UnknownNameError/name | doc | content) ~(::any/UnknownNameError/name | doc | content) ~(::call/UnknownNameError | manifest | map ~(binding | name | toString | split "/" | last) | eq (::any/UnknownNameError | manifest | map ~(binding | name | toString | split "/" | last)))]' < /dev/null
["The name the step called." "The name asked for, a keyword or a tag." true]
```

### subordination · core/src/runtime/tagged-primitives.mjs:11
«registerPrimitive('any/payload', …)». В модуле `::tagged` лежат также `any/tag` (стр. 14), а `boolean/and`, `or` и `not` — в `predicates.mjs`.
Слой: модули сгруппированы по ролям (`predicates`, `control`, `axis`), а не по правилу [QSLEX#grep] «the primitives of a noun stand in `core/src/runtime/<noun>-primitives.mjs` beside its page». Примитивы `::any` разложены по двенадцати модулям, и ни один из них не назван по `::any`.
Чистый лист: примитивы `::any` стоят рядом с `any.qlang` в модуле своего существительного, `tagged-primitives.mjs` держит один `within`, а `boolean-primitives.mjs` стоит рядом с `boolean.qlang`.
```sh
$ git -C D:/git/qlang-worktrees/closeout-pentimento ls-files --error-unmatch core/src/runtime/tagged-primitives.mjs core/src/runtime/any-primitives.mjs core/src/runtime/boolean-primitives.mjs
error: pathspec 'core/src/runtime/any-primitives.mjs' did not match any file(s) known to git
error: pathspec 'core/src/runtime/boolean-primitives.mjs' did not match any file(s) known to git
core/src/runtime/tagged-primitives.mjs
Did you forget to 'git add'?

$ git grep -n -E "register(Primitive|StateReader)\('(any|boolean)/(payload|tag|and|or|not)'" -- core/src/runtime
core/src/runtime/predicates.mjs:21:registerPrimitive('boolean/and', (subject, condition) => subject && condition);
core/src/runtime/predicates.mjs:22:registerPrimitive('boolean/or',  (subject, condition) => subject || condition);
core/src/runtime/predicates.mjs:23:registerPrimitive('boolean/not', subject => !subject);
core/src/runtime/tagged-primitives.mjs:11:registerPrimitive('any/payload', subject => (isTagged(subject) ? payloadBeneath(subject) : subject));
core/src/runtime/tagged-primitives.mjs:14:registerStateReader('any/tag', async (subject, tagName, state) =>

$ git grep -c -E "register(Primitive|StateReader)\('any/" -- core/src/runtime | wc -l
12
```

### shim · core/lib/qlang.qlang:258
«proves :multipliesTwoFields … ~({:price 4 :qty 3} | mulOf /price /qty | eq 12)» — это тот же запрос, что в законе `::any/mulOf/multipliesTwoFields`. В той же цепи `readsAModifierFromTheSubjectOfItsStep` (стр. 261) и `losesTheRecordAfterAStep` (стр. 270) доказывают один факт, а `asksWhetherTheStepBeforeStood` стоит и на `::qlang`, и на `::qlang/errors`.
Слой: законы первой страницы, написанные до её глав и до законов глаголов, так и остались рядом с ними, и `runLaws` гоняет один запрос под двумя именами.
Чистый лист: закон стоит один раз, под тем именем, чьё утверждение он доказывает. Дополняет D339 (часть 12): её пробы — о страницах `sum` и `add`, а здесь повторяются сами законы.
```sh
$ qplay 'get [~(::qlang | laws | get /multipliesTwoFields/1 | eq (::any/mulOf | laws | get /multipliesTwoFields/1)) ~(::qlang | laws | get [/readsAModifierFromTheSubjectOfItsStep/1 /losesTheRecordAfterAStep/1]) ~(get [~(::qlang | laws | get /asksWhetherTheStepBeforeStood/1) ~(::qlang/errors | laws | get /asksWhetherTheStepBeforeStood/1)])]' < /dev/null
[true [~({:price 4 :qty 3} | get /price | mul (get /qty) !| tag | eq ::path/SubjectHasNoPartsError) ~({:qty 2 :price 3} | get /qty | mul (get /price) !| tag | eq ::path/SubjectHasNoPartsError)] [~(get [~(!{:code 404} | raise | ok !| false) ~(5 | ok !| false)] | eq [false true]) ~(get [~(!{:code 404} | raise | ok !| false) ~(42 | ok !| false)] | eq [false true])]]
```

### pentimento · core/lib/qlang.qlang:810
«A reader learning a tool fails often, and the failure is where what it needs is cheapest to give.»
Слой: обоснование решения «ошибка — значение со страницей», перенесённое в главу каталога. Против дерева читатель его проверить не может.
Чистый лист: глава `::qlang/errors` говорит, что несёт неудача и как ведёт к своей странице, а довод остаётся в AIM.
```sh
$ qplay '::qlang/errors | doc | content | lines | join " " | contains "A reader learning a tool fails often, and the failure is where what it needs is cheapest to give."' < /dev/null
true
```

### drift · core/lib/qlang.qlang:726
«A tag no declaration answers is a kind of identity, which checks nothing and lays the tag on the value.» То же в `tag.qlang:19` и в имени закона `::any/manifest/readsPastATagOfIdentity`, хотя страница этого закона говорит «a tag nothing declares».
Слой: «identity» как имя необъявленного тега есть только в каталоге. Главы пишут «A tag no declaration names … lay themselves over a payload as it is», а словом «identity» зовут идентичность клетки и хэш корня (QSHST#cell) и тождественную функцию `~()`.
Чистый лист: необъявленный тег назван термином глав, а у «identity» один смысл.
```sh
$ qplay 'get [~(::qlang/verbs | doc | content | lines | join " " | contains "A tag no declaration answers is a kind of identity") ~(::any/manifest | laws | keys | has :readsPastATagOfIdentity) ~(::cell | doc | content | lines | join " " | contains "an identity under its tag")]' < /dev/null
[true true true]

$ git grep -n -w -i identity -- docs/spec
docs/spec/QSCND-conditions-and-conversions.md:89:them on the subject; an identity branch, `~()`, leaves the subject. A
docs/spec/QSHST-hosts.md:289:language: `::cell`, a kind of the core over its identity, letters, digits
docs/spec/QSHST-hosts.md:297:identity of what it keeps, twelve digits of hexadecimal of the hash of the
docs/spec/QSHST-hosts.md:300:`<root>` the identity of the sources and the code it booted, the query,
docs/spec/QSQUO-code-as-data.md:11:the parser. `~()` is the empty quote, which runs as the identity. A
```

### vestige · core/lib/qlang/any.qlang:1663
«A value turned by `desc` opens to the value it turned, and an error at rest to its facts.»
Слой: страница и её закон `opensAnErrorAtRestToItsFacts` написаны 2026-10-24. Правило [QSERR#rest], по которому под тегом отказа стоит `::error` («`payload` answers the `::error` beneath it»), появилось на день позже. Поэтому к фактам открывается только голая `!{…}`, а именно её и проверяет закон.
Чистый лист: страница говорит, что `payload` ошибки покоя отказа — её `::error`, а факты — уже payload этого `::error`.
```sh
$ qplay 'get [~("x" | add 1 !| payload | tag) ~(::any/payload | doc | content | lines | join " " | contains "and an error at rest to its facts")]' < /dev/null
[::error true]

$ git log --format="%h %ad" --date=short -S "opensAnErrorAtRestToItsFacts" -- core/lib/qlang/any.qlang | tail -1
e05325f6 2026-10-24

$ git log --format="%h %ad" --date=short -S "past the wiring of the kind" -- docs | tail -1
b7a62517 2026-10-25
```

### vestige · core/src/runtime/json.mjs:136
«// [QSQUO#modifier]» стоит над `StringParseJsonTextNotJsonError`, `any/json` и `string/parseJson`.
Слой: это остаток комментария «each taking the value the walk served alone [QSQUO#modifier]», который c97b62ee8e урезал до одной ссылки. Само правило теперь в [QSDSP#answer], а в [QSQUO#modifier] его нет.
Чистый лист: пометка называет секцию, чьё правило держит блок. Дополняет D412 (часть 3): там вопрос о проверке пометок, а это пример пометки, которую конвертация комментариев оставила на секции без её правила.
```sh
$ git grep -n "QSQUO#modifier" -- core/src/runtime/json.mjs
core/src/runtime/json.mjs:136:// [QSQUO#modifier]

$ git show c97b62ee8e -- core/src/runtime/json.mjs | grep -n -B1 "value the walk served alone"
95--// `json` resides on `::any` and `parseJson` on `::string`, each taking the
96:-// value the walk served alone [QSQUO#modifier].

$ git grep -n "a primitive runs on the values the walk served" -- docs/spec
docs/spec/QSDSP-a-verb-found-through-its-subject.md:185:steps keep; a primitive runs on the values the walk served. A primitive

$ git grep -n "walk served" -- docs/spec/QSQUO-code-as-data.md | wc -l
0
```

### vestige · core/lib/qlang/any.qlang:1026
«`source`, `doc`, `laws` and `runLaws` read a name as `binding` does, and each is refused under a tag of its own» — в этом перечне нет `manifest`, хотя страница вида `::any` (стр. 21–22) его называет.
Слой: перечень написан 2026-10-13, когда в нём стоял ушедший `explain`, а у `manifest` своего отказа ещё не было (он появился 2026-10-15). `explain` потом вычеркнули, а `manifest` так и не вписали.
Чистый лист: перечень осей, делящих отказ, стоит в одном месте, на странице `::any/UnknownNameError`, и страница `binding` ссылается туда.
```sh
$ qplay 'get [~(::nosuch | manifest !| tag) ~(::any/binding/UnknownNameError | doc | content | lines | join " " | contains "`source`, `doc`, `laws` and `runLaws` read a name as `binding` does")]' < /dev/null
[::any/manifest/UnknownNameError true]

$ git show 0e68c6b7:core/lib/qlang/any.qlang | grep -n -B1 "and each is"
1011-            | binding`. `source`, `doc`, `explain`, `laws` and `runLaws`
1012:            read a name as `binding` does, and each is refused under a tag

$ git log --format="%h %ad" --date=short -S "any/manifest/UnknownNameError" -- core/src | tail -1
0e1f8469 2026-10-15
```

### vestige · core/lib/qlang/absent.qlang:1
«`::absent`, the mark in a shape of a key some records lack»
Слой: шапку написали 2026-10-16, когда `::absent` метил только ключи. 2026-10-27 страница добавила элемент вектора или множества, пустого в части данных, а шапку не поправили.
Чистый лист: шапка говорит то же, что страница: метка стоит над частью, которой нет в части данных.
```sh
$ qplay '[{:labels [{:name "bug"}]} {:labels []}] | shape' < /dev/null
::shape[
  {
    :labels [::absent{:name ::string}]
  }
]

$ git log --format="%h %ad" --date=short -S "the mark in a shape of a key some records lack" -- core/lib/qlang/absent.qlang
69187a4d 2026-10-16

$ git log --format="%h %ad" --date=short -S "the element of a vector or a set empty in some" -- core/lib/qlang/absent.qlang
acae4977 2026-10-27
```

### shim · core/src/runtime/json.mjs:142
«JSON.parse(subject);». `parseJson` читает текст дважды: сначала `JSON.parse` ради вердикта и сообщения движка, затем `fromJsonText` (стр. 146), который полагается на первую проверку и сам ничего не проверяет. Рядом `fromPlain` поднимает JSON через `Object.entries` (стр. 79), то есть, по чтению кода, с целочисленными ключами впереди, тогда как `parseJson` держит порядок текста.
Слой: первым подъёмом был `fromPlain` (2026-04-15); `fromJsonText` добавили 2026-10-16 ради порядка ключей, а проверку оставили старому чтению.
Чистый лист: один читатель JSON строит значение и сам отказывает с причиной и путём, и порядок ключей у `parseJson` и у подъёма хоста один.
```sh
$ git grep -n -e "JSON.parse(subject)" -e "return fromJsonText(subject)" -e "Object.entries(plainObj)" -- core/src/runtime/json.mjs
core/src/runtime/json.mjs:79:  for (const [plainKey, nestedVal] of Object.entries(plainObj)) {
core/src/runtime/json.mjs:142:    JSON.parse(subject);
core/src/runtime/json.mjs:146:  return fromJsonText(subject);

$ qplay '"{\"b\": 1, \"2\": 2}" | parseJson | entries | map ~first' < /dev/null
[:b :"2"]

$ git log --format="%h %ad" --date=short -S "export function fromPlain" -- core/src | tail -1
0fef233bb 2026-04-15

$ git log --format="%h %ad" --date=short -S "export function fromJsonText" -- core/src | tail -1
fd1ad6d3 2026-10-16
```

### pentimento · core/lib/qlang.qlang:731
«so a noun that stands for a thing outside the language is addressed bare, `::Jenkins | builds`»
Слой: пример из D179/D180 взят из мира сестринского проекта, а не из языка. На него не отвечает ни один хост, а закон рядом (`takesTheTagOfItsNoun`) показывает то же правило на `::Desk | hours`.
Чистый лист: глава показывает правило запросом, который отвечает, и не называет продукт. Дополняет D424: запись набрасывает хост Jenkins как такой, на который «no host answers yet», а глава каталога уже подаёт его как действующий пример.
```sh
$ git grep -n -w Jenkins -- core docs/spec
core/lib/qlang.qlang:731:            the language is addressed bare, `::Jenkins | builds`, while a

$ qplay 'get [~(::Jenkins | builds !| tag) ~(::qlang/verbs | laws | get /takesTheTagOfItsNoun/1)]' < /dev/null
[::call/UnknownNameError ~(:Desk |~~ A help desk. ~~|; :Desk/hours (::fn | on |~~ The desk itself. ~~| ::tag | impl ~("9 to 5")); ::Desk | hours | eq "9 to 5")]
```

### drift · core/lib/qlang.qlang:2
«its page, the first screen a session reads»
Слой: шапка источника зовёт страницу `::qlang` «first screen». Главы же различают «the first page» — страницу `::qlang` ([QSNAM#root], [QSSLF#page]) — и «the first screen» — страницы языка и хоста вместе ([QSMSR#benchmark], [QSPRN#budget]).
Чистый лист: «first page» означает страницу `::qlang`, «first screen» — `[::qlang ::host] | map ~(get [~(it) ~(doc)])`, и каждое слово держит один смысл.
```sh
$ git grep -n -i "first screen" -- docs/spec core/lib
core/lib/qlang.qlang:2:   its page, the first screen a session reads, the refusal of an answer
docs/spec/QSMSR-the-measures.md:13:first screen, the pages of the language and of the playground as
docs/spec/QSPRN-printing-and-codecs.md:279:`count` counts a string, which is never smaller than the first screen,
```
