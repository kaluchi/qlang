> A pentimento audit of core-host--site-scripts for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–23:58 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### archaism · stdio/lib/qlang/stdio.qlang:148
Цитата: «A subject past the budget is written as `::qlang/AnswerBeyondBudgetError` with its head, each `:read` in it continuing the query from the subject at the `stdio/tap`».
Слой: страница `stdio/tap` описывает отказ по бюджету в прежней модели, где у печати была «голова» и были факты `:read`, продолжающие запрос; у нынешнего отказа факты `:characters`, `:budget` и `:answer`, а ответ лежит в ячейке `::cell`, рядом с ней стоят виды.
Чистый лист: страница говорила бы то же, что QSHST#effect: субъект сверх бюджета пишется отказом, и его `:answer` — ячейка, которую читает `answer`.
```qlang
> ::stdio/tap | doc | content | contains ":read" < /dev/null
true

> ::qlang/AnswerBeyondBudgetError | manifest < /dev/null
#[::qlang/AnswerBeyondBudgetError/answer ::qlang/AnswerBeyondBudgetError/budget ::qlang/AnswerBeyondBudgetError/characters ::qlang/AnswerBeyondBudgetError/expected ::qlang/AnswerBeyondBudgetError/found ::qlang/AnswerBeyondBudgetError/index ::qlang/AnswerBeyondBudgetError/trace]
```
```sh
$ qplay '5000 | range | stdio/tap :big | count' < /dev/null 2>&1 | grep -c -e ':read' -e ':head'
0

$ qplay '5000 | range | stdio/tap :big | count' < /dev/null 2>&1 | grep -o -E '^  :answer(/count)? [^"]+'
  :answer ::cell
  :answer/count 5000
```

### drift · docs/spec/QSHST-hosts.md:205
Цитата: «A query runs as a cell of a notebook.» В той же главе, на строке 288: «A cell is the interface a host gives for the work with state inside the language». В QSPRN:43: «a cell of the `table` of the streams».
Слой: словом «cell» называли ячейку блокнота и клетку таблицы, а потом тем же словом назвали `::cell`, вид ядра с первой страницы; в итоге одна страница `::host` пишет и «a session of cells», и «the cell the playground keeps it in», а в коде `cellEntry` и `cellText` (playground/src/render.mjs:24) — ячейка блокнота, `cellTextOf` (stdio/src/table.mjs:9) — клетка таблицы, stdio/src/cells.mjs — `::cell`.
Чистый лист: «cell» значило бы только `::cell` первой страницы, а у ячейки блокнота и клетки таблицы были бы свои слова (QSLEX#term).
```qlang
> ::host | doc | content | lines | join " " | get [~(contains "a session of cells") ~(contains "as the cell the playground keeps it in")] < /dev/null
[true true]

> get [~(::cell | doc | content | lines | first) ~(::vec/table | doc | content | lines | join " " | contains "draws an empty cell")] < /dev/null
["A cell is the interface a host gives for the work with state inside" true]
```
```sh
$ grep -n -e "A query runs as a cell of a notebook" -e "A cell is the interface" -e "a cell of the .table" docs/spec/QSHST-hosts.md docs/spec/QSPRN-printing-and-codecs.md
docs/spec/QSHST-hosts.md:205:A query runs as a cell of a notebook. A scope is the names a step reads
docs/spec/QSHST-hosts.md:288:A cell is the interface a host gives for the work with state inside the
docs/spec/QSPRN-printing-and-codecs.md:43:writes a value on one line, a cell of the `table` of the streams among
```

### drift · playground/lib/qlang/playground.qlang:12
Цитата: «`qplay -i ['<query>']` opens a session of cells».
Слой: на первом экране «session» называет серию ячеек REPL, и так же пишет страница `::host/env` в ядре («the cells of a session before it»); при этом QSLEX#grep отдаёт «session» разговору модели, а ячейкам хоста над одним scope — «notebook», и сам `::host` — «The host a session is in» именно в смысле разговора.
Чистый лист: страница писала бы «opens the REPL, a notebook of cells», то есть словом из глав.
```qlang
> get [~(::host | doc | content | lines | join " " | contains "opens a session of cells") ~(::host/env | doc | content | lines | join " " | contains "the cells of a session")] < /dev/null
[true true]
```
```sh
$ grep -n "The session names" docs/spec/QSLEX-the-words-and-the-names.md
53:its files, since every tool and every reader searches it. The session names
```

### archaism · playground/src/repl.mjs:46
Цитата: «Names a cell declares, `:name body` and `:name it` among them, persist across the cells of one run of the REPL.»
Слой: `:name it` — форма из модели, где объявление брало значение из трубы; сейчас тело объявления субъекта не читает, и такой текст отвергается.
Чистый лист: справка не называла бы отвергнутую форму, а значение субъекта именовалось бы через `with`, как объясняет страница самого отказа.
```sh
$ grep -n -e ':name it' playground/src/repl.mjs
46:Names a cell declares, \`:name body\` and \`:name it\` among them,
```
```qlang
> ~(:rate it; rate) | answer !| tag < /dev/null
::bind/SubjectNotGivenError
```

### drift · docs/spec/QSHST-hosts.md:334
Цитата: «names each token of a source by what it writes in the language, one sense to a kind: … `punctuation` the rest a gap holds; `whitespace`; and `unparsed`».
Слой: «kind» — главный термин языка (вид значения, `::kind`, «a tag names a kind»), но им же назван класс токена; это слово держат таблицы покраски (`SGR_OF_KIND`, `TYPE_OF_KIND`, `CLASS_OF_KIND`, `class="${kind}"`), а в lsp/src/features.mjs оба смысла живут рядом: `kindOf` — тег значения, `tok.kind` — класс токена.
Чистый лист: у класса токена было бы своё слово, а виды значений входили бы в него по своим тегам.
```qlang
> get [~(::host | kinds | has ::punctuation) ~(::host | kinds | has ::verb) ~(::host | kinds | has ::whitespace) ~(::host | kinds | has ::number)] < /dev/null
[false false false true]
```
```sh
$ grep -n "_OF_KIND = {\|^const kindOf" playground/src/highlight-ansi.mjs lsp/src/features.mjs vscode/src/markdown-block.js
playground/src/highlight-ansi.mjs:7:const SGR_OF_KIND = {
lsp/src/features.mjs:45:const kindOf = value => tagOf(value).name;
lsp/src/features.mjs:472:const TYPE_OF_KIND = {
vscode/src/markdown-block.js:10:const CLASS_OF_KIND = {
```

### subordination · stdio/src/cells.mjs:19
Цитата: «const CODE_OF_THE_ROOT = [[…'@kaluchi/qlang-core'…, ['lib', 'src', 'host', 'gen']], [join(dirname(fileURLToPath(import.meta.url)), '..'), ['lib', 'src']]];»
Слой: пакет потоков сам вычисляет идентичность корня по раскладке папок ядра (это второй экземпляр списка `files` из core/package.json) и не учитывает источник хоста `playground.qlang`; `cell/answer` при этом читает ячейку над корнем из одних `stdioSources`, а не над тем корнем, который поднял хост, поэтому фразу страницы `NotHeldError` «kept … by another host» дерево не решает.
Чистый лист: идентичность отдаёт тот, кто поднял корень, — ядро над источниками, которые ему вручил хост (QSHST#cell: «the identity of the sources and the code it booted»), и чтение назад идёт над теми же источниками.
```sh
$ grep -n -A2 "CODE_OF_THE_ROOT = \[" stdio/src/cells.mjs
19:const CODE_OF_THE_ROOT = [
20-  [dirname(dirname(fileURLToPath(import.meta.resolve('@kaluchi/qlang-core')))), ['lib', 'src', 'host', 'gen']],
21-  [join(dirname(fileURLToPath(import.meta.url)), '..'), ['lib', 'src']]

$ grep -n -A5 '"files"' core/package.json
31:  "files": [
32-    "src/",
33-    "host/",
34-    "lib/",
35-    "gen/"
36-  ],

$ grep -n -o "cellPrimitives(() => stdioSources(ioContext))" stdio/src/stdio-sources.mjs
16:cellPrimitives(() => stdioSources(ioContext))

$ git -C D:/git/qlang-worktrees/closeout-pentimento ls-files --error-unmatch playground/lib/qlang/playground.qlang
playground/lib/qlang/playground.qlang
```

### shim · stdio/src/table.mjs:17
Цитата: «function docOnOneLine(part) { … return `|~~ ${part.map(segment => (typeof segment === 'string' ? segment.replace(LINE_BREAK, ' ') : …)).join('')} ~~|`; }»
Слой: однострочная форма принтера ядра пропускает док (`doc: (d, indent) => printDoc(d, indent)` не принимает `oneLine`), поэтому потоки печатают док сами через крючок легенды `printedOf` и второй раз записывают литерал `|~~ … ~~|` вне ядра.
Чистый лист: однострочная форма ядра клала бы на одну строку и док (QSPRN#print: хост «asks the printer for that form»), а `table` вызывал бы `printValue(value, 0, undefined, true)` без собственного принтера.
```sh
$ grep -rn -F '`|~~ ${' core/src stdio/src playground/src lsp/src site/src vscode/src | cut -c1-60
core/src/print-value.mjs:129:  return `|~~ ${doc.map(segment
stdio/src/table.mjs:19:  return `|~~ ${part.map(segment => (

$ grep -n "^  doc: " core/src/print-value.mjs
59:  doc:     (d, indent) => printDoc(d, indent),
```
```qlang
> get [{:d ~(["a\nb"] | tag ::doc)}] | table < /dev/null
+-------------+
| d           |
+-------------+
| |~~ a b ~~| |
+-------------+
```

### vestige · playground/src/repl.mjs:20
Цитата: «const REPL_HELP = `Meta commands: .help list meta commands .exit close the REPL (Ctrl+D on an empty line works too) Editing: …`»
Слой: метакоманды `.help` и `.exit` взяты из модели REPL Node: их нет ни в QSCLI#repl, ни в QSCLI#line-editor, ни на странице `::host`; справка повторяет клавиши главы вторым текстом вне каталога; ячейку `.exit` REPL перехватывает раньше языка, а язык прочёл бы её как путь в стиле jq; заголовки тестов («lists the commands of the REPL on `.help`») к тому же употребляют «command» там, где в языке это шаг.
Чистый лист: REPL закрывается по Ctrl+D, как уже сказано в главе, а всё, что о нём нужно знать, выдаёт команда — страница `::host`.
```sh
$ grep -n -e '^  \.exit' -e '^  \.help' playground/src/repl.mjs
21:  .help    list meta commands
22:  .exit    close the REPL (Ctrl+D on an empty line works too)

$ grep -c -e '\.exit' -e '\.help' docs/spec/QSCLI-the-command-line.md playground/lib/qlang/playground.qlang
docs/spec/QSCLI-the-command-line.md:0
playground/lib/qlang/playground.qlang:0

$ qplay '.exit' < /dev/null | grep -o -E '^  :message .*'
  :message "`.exit` is no path: a part is read by `get` and a path, which opens with a slash, `get /exit`"
```

### vestige · playground/src/render.mjs:11
Цитата: «_rootVerbNamesPromise = langRuntime().then(scope => verbNames(scope));» То же в playground/src/repl.mjs:51: «const rootVerbNames = verbNames(await langRuntime());»
Слой: покраска берёт имена слов из отдельной второй загрузки корня, где есть только язык, а не из корня, который поднял блокнот playground вместе с потоками; поэтому слово этого корня `table` красится как `name`.
Чистый лист: один корень служит и прогону, и покраске — `verbNames` над scope блокнота (QSHST#tokens: «`verb` the name of a call that names a word of the root»).
```sh
$ qplay --color=always '~([1] | table | count)' < /dev/null | cat -v | grep -o -E '\[3;[0-9]+m(table|count)'
[3;36mtable
[3;94mcount

$ grep -n "verbNames(" playground/src/render.mjs playground/src/repl.mjs
playground/src/render.mjs:11:    _rootVerbNamesPromise = langRuntime().then(scope => verbNames(scope));
playground/src/repl.mjs:51:  const rootVerbNames = verbNames(await langRuntime());
```
```qlang
> ::vec | manifest | has ::vec/table < /dev/null
true
```

### subordination · playground/src/stdin.mjs:34
Цитата: «const notJson = isErrorValue(read.result) && read.result.tag.name === StringParseJsonTextNotJsonError.prototype.address;»
Слой: корень ядра экспортирует класс отказа одного примитива (core/src/index.mjs:16) ради подъёма stdin в одном хосте, и хост сверяет тег с адресом на прототипе класса, хотя язык отвечает на этот вопрос сам.
Чистый лист: подъём — это запрос языка над текстом (`parseJson !| …` по тегу отказа) или правило самого playground, без экспорта из ядра.
Добавляет к D412: часть 1 записывает `readsItsSubject` в ядре ради QSCLI#stdin; здесь второй экспорт того же слоя и двойной разбор запроса — main.mjs:36 разбирает его только чтобы решить, читать ли stdin, а потом `evalCell` разбирает снова.
```sh
$ grep -rln "StringParseJsonTextNotJsonError" --include=*.mjs core/src stdio playground/src lsp/src site/src site/scripts
core/src/index.mjs
core/src/runtime/json.mjs
playground/src/stdin.mjs

$ grep -n "parseSource(queryText)\|notebook.evalCell(queryText" playground/src/main.mjs playground/src/run.mjs
playground/src/main.mjs:36:    quote = parseSource(queryText);
playground/src/run.mjs:10:  const cellEntry = lifted.raised ?? await notebook.evalCell(queryText, lifted);
```
```qlang
> "not json" | parseJson !| tag | eq ::string/parseJson/TextNotJsonError < /dev/null
true
```

### shim · stdio/src/cells.mjs:50
Цитата: «if (typeof name === 'string' && entry.get('source') !== null) declared.push(`${printValue(entry.get('name'))} ${printValue(entry.get('value'))};`);»
Слой: потоки заново выводят «слова, объявленные запросом» из внутреннего Map scope по своему правилу (строковый ключ и `source !== null`), хотя в ядре для `::host | env` есть `readerNamesOf` с другим фильтром (`isBinding`); вдобавок значение ячейки строится печатью и вычислением её литерала, `evalQuery(`::cell${JSON.stringify(identity)}`, scope)`, при том что в ядре есть `CELL_TAG`.
Чистый лист: вывод один — `::host | env | filter ~(source | eq null | not)` или функция ядра, — а `::cell` строится конструктором ядра.
```sh
$ grep -n "entry.get('source') !== null" stdio/src/cells.mjs | cut -c1-80
50:    if (typeof name === 'string' && entry.get('source') !== null) declared.pu

$ grep -n "isBinding(entry)) readerNames" core/src/nouns.mjs
300:  for (const [name, entry] of scope) if (isBinding(entry)) readerNames.set(name, entry);

$ grep -n 'evalQuery(`::cell' stdio/src/cells.mjs
80:  return await evalQuery(`::cell${JSON.stringify(identity)}`, scope);
```
```qlang
> :Box |~~ A box. ~~| (::kind | wires :w |~~ w ~~| /w ::number); :rate 2; ::host | env | map ~(source | eq null) < /dev/null
{
  :Box false
  :Box/w true
  :Box/WKindNotTakenError true
  :rate false
}
```

### pentimento · docs/spec/QSHST-hosts.md:219
Цитата: «its playground runs the cells of one run in one notebook, each printing its answer».
Слой: фраза хранит модель, где прогон playground на сайте делился на несколько ячеек; дерево же каждый прогон запускает весь текст одной ячейкой в новом блокноте, а пустая строка для языка — пробел.
Чистый лист: «its playground runs the text of a run as one cell in a notebook of its own».
```sh
$ grep -n "createNotebook({ scope })\|notebook.evalCell(source)" site/src/pages/playground.astro
233:      const notebook = await createNotebook({ scope });
234:      const { text: printed, failed } = await cellShown(await notebook.evalCell(source));
```
```qlang
> "[1 2] | count\n\n3 | add 1" | parse < /dev/null
~([1 2] | count 3 | add 1)
```

### drift · playground/lib/qlang/playground.qlang:58
Цитата: «`::host | status` shows its screen»; на строке 2: «the sections of its screen, `::host | status`».
Слой: в текстах о том, что верно, «screen» означает три вещи — первый экран страниц (QSPRN#budget, QSMSR#benchmark), экран работы `npm run desk` (QSVOX#folders) и ответ `::host | status`; сам `status` со своим «section» (а это слово в главах означает раздел главы) не держит ни одна глава, только каталог и случай QSNAM/binding.jsonl:20; секция `:host/labels` пишет «How many kinds» над `::host | kinds`.
Чистый лист: у каждого слова один смысл, а `status` либо описан в главе, либо узлы данных под `::host` обходятся без «экрана».
Добавляет к D257: там «the screen of a world» — идея, которая ждёт задачи, а каталог уже называет экраном ответ `::host | status`, то есть слово занято раньше, чем идея взята в работу.
```sh
$ grep -rl -F '::host | status' docs/spec core/lib playground/lib stdio/lib
core/lib/qlang/host.qlang
core/lib/qlang.qlang
playground/lib/qlang/playground.qlang

$ grep -n -o '"name":"[^"]*status"' core/test/conformance/QSNAM/binding.jsonl
20:"name":"the-host-a-session-is-in-answers-its-kinds-its-env-and-its-status"

$ grep -n -w -i "screen" docs/spec/QSVOX-the-texts-and-their-voices.md docs/spec/QSPRN-printing-and-codecs.md core/lib/qlang/host.qlang | cut -c1-110
docs/spec/QSVOX-the-texts-and-their-voices.md:15:The screen of the work, `npm run desk`, and the sensors under
docs/spec/QSVOX-the-texts-and-their-voices.md:67:the screen of the work, the aim and the records in transit an
docs/spec/QSPRN-printing-and-codecs.md:279:`count` counts a string, which is never smaller than the first scre
core/lib/qlang/host.qlang:2:   page, which the host writes, its screen, the kinds that lie on it and
core/lib/qlang/host.qlang:11:      `:host |~~ … ~~|;`. `::host | status` answers its screen, the
core/lib/qlang/host.qlang:31:  |~~ Answers the screen of the host a session is in, its state in
```
```qlang
> ::host | status | map /section < /dev/null
[::host/labels ::host/streams]
```

### shim · site/src/lib/format-example.js:29
Цитата: «if (/^ {2}\S/.test(line))    return { type: 'cont',    content: line.slice(2) };»
Слой: блок примеров (запрос после `> `, его продолжения, ответ) в дереве разбирается трижды по трём разным правилам: scripts/sensors/run-probes.mjs считает продолжением строку с отступом только до первой строки ответа, vscode/src/markdown-block.js — только сразу после подсказки, а format-example.js — любую строку с двумя пробелами в начале, включая строки многострочного ответа, и вдобавок красит строку, начинающуюся с `|~`, целиком как комментарий в обход `tokenize`, даже если это док `|~~`.
Чистый лист: один читатель блока примеров рядом с `tokenize` в `core/highlight`, общий для проб, расширения и сайта.
```sh
$ grep -n -e "line.startsWith('  ')" scripts/sensors/run-probes.mjs
103:    } else if (open && !open.shell && open.answer.length === 0 && line.startsWith('  ')) {

$ grep -n -F '/^\s+\S/' vscode/src/markdown-block.js
58:    if (prompt !== undefined) while (end < lines.length && /^\s+\S/.test(lines[end])) end += 1;

$ grep -n -e "type: 'cont'" -e "type: 'comment'" site/src/lib/format-example.js
27:    if (/^\|~/.test(line))     return { type: 'comment', content: line };
29:    if (/^ {2}\S/.test(line))    return { type: 'cont',    content: line.slice(2) };
```
```qlang
> [1 "x" 3] | map ~(mul 2) | count !| trace < /dev/null
::trace[
  ::frame["x" ~(mul 2)]
  ::frame[[1 "x" 3] ~(map ~(mul 2) | count) /1]
]
```

### pentimento · playground/lib/qlang/playground.qlang:7
Цитата: «qplay — a demo command-line app for playing with qlang and checking that its core answers: vanilla qlang-core + qlang-stdio».
Слой: «vanilla» противопоставляет playground хосту с доменом, а этого читатель дерева проверить не может; «a demo … app for playing» — обращение к читателю; «qlang-core + qlang-stdio» — имена, которых в дереве нет; и всё это первая строка первого экрана в каждом прогоне бенчмарка.
Чистый лист: первая строка говорит, что это за хост: «the smallest host that embeds the language, with the streams of `::stdio`».
```qlang
> ::host | doc | content | lines | take 2 < /dev/null
["qplay — a demo command-line app for playing with qlang and checking" "that its core answers: vanilla qlang-core + qlang-stdio, queried from"]
```
```sh
$ grep -h -o '"name": "[^"]*"' core/package.json stdio/package.json
"name": "@kaluchi/qlang-core"
"name": "@kaluchi/qlang-stdio"
```

### vestige · site/scripts/_browser-entry.mjs:31
Цитата: «export { evalQuery, printValue, printAnswer, boundAnswer, langRuntime, parseSource, createNotebook, isErrorValue, verbNames } from '@kaluchi/qlang-core';»
Слой: шесть реэкспортов (`evalQuery`, `printValue`, `printAnswer`, `boundAnswer`, `parseSource`, `isErrorValue`) остались со времён, когда страницы печатали ответ сами — теперь `printAnswer`, `boundAnswer` и `isErrorValue` вызывает только `cellShown`, импортируя их прямо из ядра, — и шапка оправдывает их гипотетическими «Embedders hosting qlang in a browser tab», а ни один модуль дерева не берёт их из бандла.
Чистый лист: бандл экспортирует ровно пять имён, которые импортируют две страницы.
```sh
$ grep -rn -o "const { [a-zA-Z, ]* } = await import(" site/src
site/src/pages/index.astro:199:const { createNotebook, cellShown, langRuntime, inlineCatalogLocator, verbNames } = await import(
site/src/pages/playground.astro:201:const { createNotebook, cellShown, langRuntime, inlineCatalogLocator, verbNames } = await import(

$ grep -rln "qlang.js" site/src site/test
site/src/pages/index.astro
site/src/pages/playground.astro

$ grep -n "^import" site/src/lib/cell-shown.js
8:import { boundAnswer, printAnswer, isErrorValue } from '@kaluchi/qlang-core';
```

### archaism · site/src/pages/index.astro:32
Цитата: «Thread values through chains of steps with |»; на строке 34: «the trace holds the steps a failure skipped, ready to replay».
Слой: «chains of steps» — цепочка методов, а chain в языке — это команды на существительном `::fn` или `::kind` (QSBLD#fn, QSBLD#kind); слова «replay» нет ни в каталоге, ни в главах, где пропущенные шаги «run again by `apply`» (QSERR#trace).
Чистый лист: «steps joined by `|`» и «`trace | last | skipped`, run again by `apply`».
```sh
$ grep -n -o "Thread values through chains of steps\|ready to replay" site/src/pages/index.astro
32:Thread values through chains of steps
34:ready to replay

$ grep -rlw -i "replay" core/lib docs/spec site/src stdio/lib playground/lib
site/src/pages/index.astro
```
```qlang
> get [~(::fn | doc | content | contains "chain") ~(::kind | doc | content | contains "chain")] < /dev/null
[true true]
```

### vestige · vscode/src/extension.js:1
Цитата: «// The editor's extension: it launches the language server of the checkout, paints a block of qlang in a preview of markdown by the core's tokens and selects a word by the regex of a name the core exports …»
Слой: правило «a comment … is a mark alone» (QSLEX#code) распространяется на ядро, потоки, playground и сервер, но не на `vscode/` и `site/`, и их комментарии пересказывают раздел (здесь почти дословно QSLSP#extension) или обосновывают выбор.
Чистый лист: одно правило комментариев для всех рабочих пространств, `MARKED_SOURCES` без исключений.
```sh
$ grep -n "^const MARKED_SOURCES" scripts/check-conventions.mjs
902:const MARKED_SOURCES = ['core/src', 'core/host', 'core/test', 'stdio/src', 'playground/src', 'playground/test', 'lsp/src', 'lsp/test'];

$ grep -n -e "launches the language server of the" -e "word by the regex of a name the core exports" vscode/src/extension.js docs/spec/QSLSP-the-language-server.md
vscode/src/extension.js:1:// The editor's extension: it launches the language server of the checkout,
vscode/src/extension.js:3:// selects a word by the regex of a name the core exports, each once the module
docs/spec/QSLSP-the-language-server.md:78:The extension of the editor, which launches the language server of the
docs/spec/QSLSP-the-language-server.md:85:word by the regex of a name the core exports [QSNAM#letters], and its
```

### vestige · playground/src/argv.mjs:30
Цитата: «return { kind: 'evalQuery', queryText: HELP_QUERY, colorMode, failureExitCode };» (и строка 49).
Слой: режим назван по экспорту ядра `evalQuery`, через который запрос больше не проходит (run.mjs запускает его через `notebook.evalCell`), и `main` с этим видом ничего не сравнивает — управление просто доходит до него по умолчанию.
Чистый лист: режим назывался бы по тому, что он делает, или вовсе не имел бы имени, раз `main` различает только `version`, `usageError` и `repl`.
```sh
$ grep -rn -o "kind: 'evalQuery'" playground/src
playground/src/argv.mjs:30:kind: 'evalQuery'
playground/src/argv.mjs:49:kind: 'evalQuery'

$ grep -c "evalQuery" playground/src/main.mjs playground/src/run.mjs
playground/src/main.mjs:0
playground/src/run.mjs:0

$ grep -n "cliInvocation.kind ===" playground/src/main.mjs
49:  if (cliInvocation.kind === 'version') {
53:  if (cliInvocation.kind === 'usageError') {
57:  if (cliInvocation.kind === 'repl') {
```

### vestige · playground/src/render.mjs:52
Цитата: «export async function answerText(value, scope, page = null)».
Слой: это третий путь к показанному тексту ответа, рядом с `renderCellOutcome` и `writeCellOutcome` из REPL, и существует он только для тестов: ни один модуль исходников его не импортирует.
Чистый лист: тесты проверяли бы правило тем же путём, что и хост, — через `renderCellOutcome`.
```sh
$ grep -rln "answerText" playground/src playground/test stdio site lsp
playground/src/render.mjs
playground/test/QSCLI/answer.test.mjs
playground/test/QSERR/alert.test.mjs
playground/test/QSERR/print.test.mjs
playground/test/QSPRN/budget.test.mjs
```

### pentimento · site/scripts/bundle-qlang.mjs:8
Цитата: «Inline sourcemaps keep stack traces from runtime exceptions pointing at the original `core/src/runtime/<file>.mjs` line instead of the bundled `qlang.js` line — debugging a failing query in browser DevTools lands on the primitive of the verb in source form.»
Слой: комментарий обосновывает выбор, противопоставляет его тому, чего в дереве нет («instead of an opaque `qlang.js:N:M` line», «without a separate roundtrip»), и обращается к инструменту читателя; так же написаны _browser-entry.mjs:10 и :29 («Embedders … do the same», «without ever touching the locator machinery itself»).
Чистый лист: здесь стояла бы метка правила, а причина жила бы в записи журнала.
```sh
$ grep -n "instead of\|DevTools\|roundtrip" site/scripts/bundle-qlang.mjs
10:// instead of the bundled `qlang.js` line — debugging a failing
11:// query in browser DevTools lands on the primitive of the verb in
50:  // back to `core/src/runtime/<file>.mjs` instead of an opaque
52:  // original source embedded in the map so DevTools renders
53:  // readable frames without a separate roundtrip.

$ grep -n "Embedders\|Reference browser-embedding\|without ever touching" site/scripts/_browser-entry.mjs
1:// Reference browser-embedding entry point for qlang.
10:// Embedders hosting qlang in a browser tab do the same:
29:// same `qlang.js` bundle without ever touching the locator
```

### vestige · stdio/src/table.mjs:6
Цитата: «const VecTableRowKindNotTakenError     = declareRefusal('vec/table/RowKindNotTakenError');»
Слой: это единственная константа модуля, но она выровнена по столбцу `=` таблицы отказов в streams.mjs, где `StdioOutSubjectKindNotTakenError` имеет длину ровно 32, то есть по таблице, которой в этом модуле уже нет.
Чистый лист: одна строка без выравнивания.
```sh
$ grep -n "declareRefusal(" stdio/src/streams.mjs stdio/src/table.mjs
stdio/src/streams.mjs:7:const StdioOutSubjectKindNotTakenError = declareRefusal('stdio/out/SubjectKindNotTakenError');
stdio/src/streams.mjs:8:const StdioErrSubjectKindNotTakenError = declareRefusal('stdio/err/SubjectKindNotTakenError');
stdio/src/table.mjs:6:const VecTableRowKindNotTakenError     = declareRefusal('vec/table/RowKindNotTakenError');
```
```qlang
> 42 | table !| tag < /dev/null
::vec/table/SubjectNotVecError
```

### archaism · playground/src/line-editor.mjs:137
Цитата: «emitter.emit('line', lineText);»; в playground/src/repl.mjs:82 — «lineEditor.on('line', (rawLine) => {», на строке 97 — «async function handleLine(rawLine)».
Слой: интерфейс редактора повторяет `node:readline` (`'line'`, `'close'`, `prompt`), хотя событие несёт ячейку, в которую Ctrl+Enter вставляет перевод строки, а глава так и пишет: «The REPL runs a cell at a time», «Enter submits the cell, Ctrl+Enter writes a line break into it».
Чистый лист: событие и имена называют ячейку — `'cell'`, `cellText`, `handleCell`.
```sh
$ grep -n "emit('line'\|on('line'\|code === 0x0a\|function handleLine" playground/src/line-editor.mjs playground/src/repl.mjs | cut -c1-110
playground/src/line-editor.mjs:137:    emitter.emit('line', lineText);
playground/src/line-editor.mjs:271:    if (code === 0x0a) { insertNewlineAtCursor();  return; }
playground/src/line-editor.mjs:468:    emitter.emit('line', lineText);
playground/src/line-editor.mjs:487:      emitter.emit('line', lineText);
playground/src/line-editor.mjs:494:      emitter.emit('line', pendingChunk);
playground/src/line-editor.mjs:516:    emitter.emit('line', lineText);
playground/src/repl.mjs:82:    lineEditor.on('line', (rawLine) => {
playground/src/repl.mjs:97:    async function handleLine(rawLine) {

$ grep -n "Ctrl+Enter writes a line break" docs/spec/QSCLI-the-command-line.md
200:the cell, Ctrl+Enter writes a line break into it, and Alt+Enter submits a
```

### shim · lsp/src/server.mjs:186
Цитата: «function offsetToPosition(source, offset) {»
Слой: перевод смещения в строку и символ сервер делает тремя способами — `offsetToPosition` для каталога, `buildLineCharIndex` (lsp/src/features.mjs:530) для семантических токенов и `TextDocument.positionAt` для документа, — хотя части парсера уже несут line и column, а `spanOf` (features.mjs:69) их отбрасывает.
Чистый лист: один способ — `positionAt` над каждым текстом или line/column самой части.
```sh
$ grep -n "function offsetToPosition\|function buildLineCharIndex\|const spanOf\|span.start.line" lsp/src/server.mjs lsp/src/features.mjs
lsp/src/server.mjs:186:function offsetToPosition(source, offset) {
lsp/src/features.mjs:69:const spanOf = read => ({ startOffset: read.span.start.offset, endOffset: read.span.end.offset });
lsp/src/features.mjs:420:    const startLine = read.span.start.line - 1;
lsp/src/features.mjs:530:function buildLineCharIndex(source) {

$ grep -c "positionAt(" lsp/src/server.mjs
10
```

### vestige · core/host/load-source-node.mjs:11
Цитата: «filePath = createRequire(import.meta.url).resolve(`#${uri}`);»
Слой: здесь и в других местах остались идиомы Node, написанные до `import.meta.resolve` и `import.meta.dirname`, — `createRequire` для разрешения импорта пакета и эмуляция CommonJS `__dirname` в stdio/src/stdio-sources.mjs:12, playground/src/playground-sources.mjs:8 и site/scripts/bundle-qlang.mjs:36, — хотя пакеты требуют `"node": ">=24"`, а stdio/src/cells.mjs и lsp/src/server.mjs уже используют `import.meta.resolve`, скрипты — `import.meta.dirname`.
Чистый лист: одна идиома платформы, той, которую требует `engines`.
```sh
$ grep -n "createRequire(import.meta.url).resolve\|__dirname = dirname(fileURLToPath" core/host/load-source-node.mjs stdio/src/stdio-sources.mjs playground/src/playground-sources.mjs site/scripts/bundle-qlang.mjs | cut -c1-120
core/host/load-source-node.mjs:11:    filePath = createRequire(import.meta.url).resolve(`#${uri}`);
stdio/src/stdio-sources.mjs:12:const __dirname = dirname(fileURLToPath(import.meta.url));
playground/src/playground-sources.mjs:8:const __dirname = dirname(fileURLToPath(import.meta.url));
site/scripts/bundle-qlang.mjs:36:const __dirname = dirname(fileURLToPath(import.meta.url));

$ grep -n -o "import.meta.resolve(" stdio/src/cells.mjs lsp/src/server.mjs
stdio/src/cells.mjs:20:import.meta.resolve(
lsp/src/server.mjs:39:import.meta.resolve(

$ grep -n -o "import.meta.dirname" scripts/desk.mjs
19:import.meta.dirname

$ grep -h -A1 '"engines"' core/package.json
  "engines": {
    "node": ">=24"
```
