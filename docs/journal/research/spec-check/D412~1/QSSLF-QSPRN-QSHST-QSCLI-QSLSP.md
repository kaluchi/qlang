> A check of the chapters `QSSLF`, `QSPRN`, `QSHST`, `QSCLI`, `QSLSP` for D412 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–00:20 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### design · QSPRN#print

Правила раздела: «A value of `::frame` stands on one line whatever it holds» и «On one line every part stands on one line, … the docs and the body of its declarations …, which read back as the same steps». Рядом стоят QSQUO#parse: «Every text a quote prints reads back as the same quote» и QSPRN#legend: «A value of a kind that wires nothing … stand[s] on one line beside [its] gloss». При этом в прозе дока по QSSYN#doc нет записи для перевода строки внутри одной строки.

```qlang
> "[1] | map ~(:rate |~~ a\nb ~~| (\"x\" | add 1);\nrate)" | parse | answer !| trace | get /1 | print
::frame[null ~(:rate |~~ a
  b ~~| ("x" | add 1); rate)]

> "[1] | map ~(:rate |~~ a\nb ~~| (\"x\" | add 1);\nrate)" | parse | answer !| trace | get /1 | with {:f ~it} ~(get [~(f | tag) ~(f | print | lines | count) ~(f | print | parse | answer | eq f)])
[::frame 2 true]

> ["a\nb"] | tag ::doc | legend | print | lines
["::legend|~~ a" "  b ~~|  |~ A doc is prose held as a value, text that carries quotes of qlang ~|"]
```

Если в прозе дока есть перевод строки, «одна строка» и «печать читается обратно» не могут выполняться вместе. Дерево держит обратное чтение, и кадр с легендой выходят на две строки. Кейсы `QSPRN/print.jsonl:23,25,34` этого не ловят, потому что в них нет такого дока. Какое согласованное поведение отвечало бы здесь: какое из двух правил уступает доку с переводом строки, или есть однострочная запись прозы, которая читается обратно?

### design · QSSLF#axis

Правила оси: «any other name nothing declares is refused under the axis that read it» и «a value under a tag nothing declares by the first kind its stack of tags declares». QSNAM#address: «A tag no declaration names … lay themselves over a payload as it is». QSERR#site о слотах вердикта: «each a value of `::fn/slot` read by its name and its parts by theirs».

```qlang
> get [~(::number/add/subject | doc !| tag) ~(::number/add | manifest | has ::number/add/subject) ~(::number/add/subject{:found 1} | get /found !| get [~(tag) ~(names)]) ~(::number/add/subject{:found 1} | binding | name) ~("x" | add 1 !| subject | tag)]
[::any/doc/UnknownNameError false [::path/TagClosedError #[:answer :expected :found :index]] :map ::number/add/subject]

> get [~(::number/add/nobody{:found 1} | get /found) ~(::number/add/nobody | doc !| tag) ~(::number/add/surplus{:found 1} | get /found !| tag) ~(::number/add/surplus | doc !| tag)]
[1 ::any/doc/UnknownNameError ::path/TagClosedError ::any/doc/UnknownNameError]

> "x" | add 1 !| subject | get [~(tag) ~(is ::fn/slot) ~(doc | eq (::map | doc)) ~(get /found !| tag)]
[::number/add/subject false true ::path/TagClosedError]
```

Дверь закрывает тег слота `::number/add/subject` проводкой слота, как будто это объявленный вид. Оси считают тот же тег ничем не объявленным и читают его значение как `::map`, а `is ::fn/slot` отвечает `false`. Соседний незнакомый тег `::number/add/nobody` при этом открыт. Какое согласованное поведение отвечало бы: тег слота объявлен как узел, который читают оси, или значение под ним не закрыто?

### conflict · QSPRN#print

QSPRN#print: «Every host prints an answer through that layer, within the budget of every answer, … its REPL and the site an answer as its literal». QSPRN#budget: «Every host but the REPL prints an answer within one budget». QSCLI#repl говорит то же, что QSPRN#budget.

```sh
$ grep -n -A 2 "Every host prints an answer through that layer" D:/git/qlang-worktrees/closeout-spec/docs/spec/QSPRN-printing-and-codecs.md
64:its own. Every host prints an answer through that layer, within the
65-budget of every answer, the playground a string as its text and its REPL
66-and the site an answer as its literal.

$ grep -n "Every host but the REPL prints" D:/git/qlang-worktrees/closeout-spec/docs/spec/QSPRN-printing-and-codecs.md
277:Every host but the REPL prints an answer within one budget,

$ grep -n "boundAnswer(result" D:/git/qlang-worktrees/closeout-spec/playground/src/repl.mjs
126:    const shown = isErrorValue(result) ? await boundAnswer(result, scope, null, value => keepCell({ query: cellEntry.source, scope, value })) : result;
```

Два раздела одной главы дают REPL разные правила бюджета. `repl.mjs` пропускает через `boundAnswer` только отказ.

### conflict · stdio/lib/qlang/stdio.qlang:149

Страница `::stdio/tap`: «A subject past the budget is written as `::qlang/AnswerBeyondBudgetError` with its head, each `:read` in it continuing the query from the subject at the `stdio/tap`». QSHST#effect: «past it as the refusal instead, the subject the cell the host keeps it in, beside the views its kind reveals». QSPRN#budget: «whose facts are `:characters`, …, `:budget`, and `:answer`».

```qlang
> get [~(::stdio/tap | doc | content | contains "`:read` in it continuing the query") ~(::qlang/AnswerBeyondBudgetError | manifest | has ::qlang/AnswerBeyondBudgetError/read)]
[true false]
```

```sh
$ qplay '5000 | range | stdio/tap :big | count' < /dev/null 2>&1 | grep -c ':read'
0
```

Страница называет «head» и факт `:read`, которых отказ не проводит и `stdio/tap` не пишет. Глава описывает вместо этого ячейку и виды.

### text · QSCLI#answer

«an error of the kind of errors, which no site refused, and one whose tag no declaration names are written without a page».

```sh
$ qplay '::number/add/FooError{:a 1} | raise' < /dev/null | grep -m1 '^|~| Answers'
|~| Answers the subject plus the number the call gives, `10 | add 3`.

$ qplay '::Foo{:a 1} | raise' < /dev/null | grep -c '^|~|'
1
```

```qlang
> ::number/add/FooError | binding | get [~(name) ~(eq (::number/add | binding))]
[:number/add true]
```

Отказ под необъявленным тегом на `Error` под объявленным адресом пишется со страницей этого адреса, как велит QSSLF#axis («A tag nothing declares whose last name ends in `Error` reads the record of the address before it»). Фраза верна только для тегов, под которыми нет объявленного адреса.

### text · QSHST#effect

«the words of `::stdio` …, each called by its address: `::stdio | in` reads standard input» и «A verb of a stream serves any value, its `on` naming `::any`, and is called by its address, a bare name of it reaching none».

```qlang
> get [~(5 | stdio/in !| tag) ~(::stdio | in) ~(::stdio/in | binding | value | get /0 | first | get /modifiers | last)]
[::stdio/in/SubjectNotStdioError "" ::tag]
```

По своей цепочке (`on ::tag`) и странице («It is asked of `::stdio` at the head of a query») `stdio/in` служит только имени тега `::stdio`. До него доходит голое имя после этого тега (QSDSP#tagname), а не любое значение и не только адрес.

### conflict · QSHST#notebook

QSHST#notebook: «A host puts its names into the scope by its sources alone, and a reader by a declaration». QSHST#door: «the values of the scope it hands a notebook or `evalQuery` are held where the core takes them, by the same scan».

```sh
$ grep -n "scopeHolding = \|takes each kind of value of the language as the subject of a cell and as what a name of a scope holds" D:/git/qlang-worktrees/closeout-spec/core/test/unit/QSHST/door.test.mjs
168:  const scopeHolding = async value => new Map(await langRuntime()).set('held', makeBinding({ name: makeKeyword('held'), value }));
170:  it('takes each kind of value of the language as the subject of a cell and as what a name of a scope holds', async () => {
406:  const scopeHolding = async value => new Map(await langRuntime()).set('held', makeBinding({ name: makeKeyword('held'), value }));
```

Дверь и её тесты принимают имя `held`, которое хост кладёт прямо в переданную область. #notebook допускает имена хоста только через источники.

### conflict · QSHST#source

QSHST#source: «`::builtin/SourceLoadError` holds `:origin`, …, `:sourceLocation`, …, and `:cause`». Страницы `::builtin/*` говорят то же: «`:origin` names the source, `:name` the name and `:sharedWith` that other name». QSERR#site: «A refusal of the runtime holds its facts in the order the kind of its refusal wires them, a fact the kind does not wire a defect of the runtime» и «a defect of the runtime hold[s] the value [its] rule met as `:found`». QSBLD#fn: «The facts a refusal carries are the commands of the kind of the refusal».

```qlang
> get [~(::builtin/SourceLoadError | manifest) ~(::builtin/SourceLoadError/origin | doc !| tag) ~(::builtin/PrimitiveNamesNoBuiltinError | manifest | has ::builtin/PrimitiveNamesNoBuiltinError/sharedWith)]
[#[::builtin/SourceLoadError/expected ::builtin/SourceLoadError/found ::builtin/SourceLoadError/index ::builtin/SourceLoadError/trace] ::any/doc/UnknownNameError false]
```

```sh
$ grep -n "sourceLocation" D:/git/qlang-worktrees/closeout-spec/core/src/source-load-error.mjs D:/git/qlang-worktrees/closeout-spec/core/host/load-source-node.mjs
D:/git/qlang-worktrees/closeout-spec/core/src/source-load-error.mjs:6:  ({ origin, sourceLocation, cause }) => `failed to read qlang source '${origin.name}' from ${sourceLocation} — ${cause.message ?? String(cause)}`);
D:/git/qlang-worktrees/closeout-spec/core/host/load-source-node.mjs:21:    throw new BuiltinSourceLoadError({ origin: makeKeyword(uri), sourceLocation: filePath, cause });
```

Дефекты загрузки и корня несут факты, которых вид их отказа не проводит, и `manifest` с `doc` их не знают. QSERR#site и QSBLD#fn сводят факты отказа к проводке.

### case · QSSLF#axis

«the laws of a refusal a query can meet hold the recovery through `!|`, a defect of the runtime and a failure inside a primitive a host hands … holding none».

```qlang
> get [~("[1" | parse !| location | get /start/line !| tag) ~(::path/TagClosedError | laws) ~(5 | gt 1 2 !| tag) ~(::any/gt/ArgsBeyondInputsError | laws) ~(::excerpt[1] !| tag) ~(::excerpt/PayloadKindNotTakenError | laws)]
[::path/TagClosedError {} ::any/gt/ArgsBeyondInputsError {} ::excerpt/PayloadKindNotTakenError {}]
```

Это правило не держит ни один кейс. В дереве у отказов, которые запрос встречает, законов нет.

### text · QSPRN#span

«a span of fewer numbers leaves its end unread, `::span/EndNotReadError`, … and a point of another length or with a fraction is refused by the invariant of its kind, `::point/PayloadNotOffsetLineAndColumnError`».

```qlang
> get [~(::span[0 1 1] !| get [~(tag) ~(found | tag)]) ~(::point[0 1] !| tag) ~(::span[0 1] !| tag) ~(::point[0 1 1 4] !| tag)]
[[::span/EndNotReadError ::point/OffsetNotGivenError] ::point/ColumnNotGivenError ::span/StartNotReadError ::point/PayloadNotOffsetLineAndColumnError]
```

Собственный кейс раздела (`QSPRN/span.jsonl:4`) и закон `::point/ColumnNotGivenError/refusesTwoNumbers` отвергают короткую точку как непереданное поле, а инвариант срабатывает только на длинной. Спан короче трёх чисел не читает начало, а не конец.

### conflict · QSPRN#print

QSPRN#print: «is laid on lines as a source of the catalog writes it … a command writes its name on its line and each modifier on a line of its own, indented by four … its body on the line of its last doc». QSSLF#catalog: «its pipe under the `f` of `::fn` …, a command too long for its line standing on three, its head, its page and the modifiers after its page» и «a doc of several lines closing on a line of its own, and its value after them».

```qlang
> ::number/round | source | toString | lines | drop 9 | take 6
["    ::link~(::number/div) ~~| (::fn" "| takes :digits" "    |~~ The digits after the point, a whole number, none when the call" "      gives none. ~~|" "    ~(query /0 0)" "    ::number"]
```

```sh
$ grep -n -B 2 -A 4 "^    | takes :digits" D:/git/qlang-worktrees/closeout-spec/core/lib/qlang/number.qlang
487-  ~~|
488-  ::fn
489:    | takes :digits
490-        |~~ The digits after the point, a whole number, none when the call
491-            gives none.
492-        ~~|
493-        ~(query /0 0) ::number
```

Обе главы описывают «раскладку каталога», но разными правилами: про колонку пайпа, модификаторы, место тела и закрытие многострочного дока.

### text · QSHST#source

«Each source is the source of one noun, …, so a kind lives whole in the source of its noun» и «A host's source declares its own noun and its verbs under the labels of their subjects».

```qlang
> [::host ::host/status ::host/streams ::cell ::cell/answer] | map ~(get [~(it) ~(binding | origin)])
[[::host :playground] [::host/status :qlang/host] [::host/streams :playground] [::cell :qlang/cell] [::cell/answer :stdio]]
```

Источник `playground` не объявляет своего существительного: он кладёт страницу и узлы на `::host` ядра. `::cell` живёт в двух источниках. Правило QSNAM#root («`:host |~~ … ~~|;`, which the root lays over the noun of the core once [QSHST#source]») ссылается на этот раздел, но здесь оно не сказано.

### conflict · QSLSP#symbols

QSLSP#symbols: «a kind built elsewhere and bound by name is a kind to the runtime and a value to the tools». QSNAM#address: «A label is a kind declared under a name, by the chain that builds it from `::kind` or by its page alone».

```qlang
> :K (::kind | accepts |~~ x ~~| ::map); :Box |~~ A box. ~~| K; get [~(::Box{:a 1} | tag) ~(::Box#5 !| tag) ~(::host | kinds | has ::Box)]
[::Box ::Box/PayloadKindNotTakenError true]
```

Метка, объявленная именем, привязанным к виду (здесь и в `QSHST/source.jsonl:15`: `:R (::set | binding | value | print | parse | answer)`), для рантайма и для `::host | kinds` остаётся меткой. QSNAM#address знает только два пути объявить метку.

### design · QSLSP#reach

«a reading of the text alone, which reaches a node declared after the last call of the verb, where the language refuses the name, and misses one declared in a group around a call».

```qlang
> get [~(~(:number/f ~(g); :x (5 | f); :number/g ~(1); x) | answer !| get [~(tag) ~(name)]) ~(:number/f ~(g); 5 | (:number/g ~(1); f))]
[[::call/UnknownNameError :g] 1]
```

```sh
$ grep -n "reaches a verb declared after the verb" D:/git/qlang-worktrees/closeout-spec/lsp/test/QSLSP/reach.test.mjs
184:  it('reaches a verb declared after the verb, one that calls it back among them, in the body of a verb under a label of the root and of the document alike', async () => {
```

Язык разрешает имя в теле глагола по дереву в месте вызова, а сервер — по тексту. На один вопрос, что значит `g` в теле `f`, они отвечают противоположно. Какое согласованное поведение отвечало бы ховеру и переходу к объявлению на таком имени?

### drift · QSHST#notebook

QSHST#notebook и QSCLI#repl («in one notebook») называют ячейки над одной областью словом notebook. QSLEX#grep это закрепляет. Страницы каталога называют то же самое словом session.

```sh
$ grep -n -A 2 "The session names" D:/git/qlang-worktrees/closeout-spec/docs/spec/QSLEX-the-words-and-the-names.md
53:its files, since every tool and every reader searches it. The session names
54-the conversation of a model alone, the word of the harness its transcripts
55-are read by, and a notebook the cells a host runs over one scope

$ grep -n "a session of cells\|a cell of a session\|hands a session or a query" D:/git/qlang-worktrees/closeout-spec/playground/lib/qlang/playground.qlang D:/git/qlang-worktrees/closeout-spec/core/lib/qlang.qlang D:/git/qlang-worktrees/closeout-spec/core/lib/qlang/builtin.qlang
D:/git/qlang-worktrees/closeout-spec/playground/lib/qlang/playground.qlang:12:      `qplay -i ['<query>']` opens a session of cells, the query its first,
D:/git/qlang-worktrees/closeout-spec/core/lib/qlang.qlang:589:            query, a cell of a session and a source of the root are
D:/git/qlang-worktrees/closeout-spec/core/lib/qlang/builtin.qlang:85:            what a name holds in the scope it hands a session or a query,

$ grep -n -A 1 "the cells of a$" D:/git/qlang-worktrees/closeout-spec/core/lib/qlang/host.qlang
105:  |~~ Answers what the reader declared before the step, the cells of a
106-      session before it among them: a map from each name to the record of
```

Читатель страниц примет «session of cells» за что-то иное, чем notebook глав.

### drift · QSHST#cell

QSHST#cell: «the words the query declared, each with its value», страница `::cell/answer`: «the names the query that kept it declared» и «the values it declared».

```sh
$ grep -n "the words the query declared\|over the root and those words" D:/git/qlang-worktrees/closeout-spec/docs/spec/QSHST-hosts.md
301:`source.qlang`, the words the query declared, each with its value as the
305:`answer` reads the answer back over the root and those words, a value

$ grep -n "the names the query that kept it declared\|the values$\|it declared, .names.qlang." D:/git/qlang-worktrees/closeout-spec/stdio/lib/qlang/stdio.qlang
176:      over the root and the names the query that kept it declared:
183:      the query, `source.qlang`, the values
184:      it declared, `names.qlang`, and the answer, `answer.qlang`, each as the

$ grep -n "entry.get('source') !== null" D:/git/qlang-worktrees/closeout-spec/stdio/src/cells.mjs
50:    if (typeof name === 'string' && entry.get('source') !== null) declared.push(`${printValue(entry.get('name'))} ${printValue(entry.get('value'))};`);
```

В `names.qlang` лежат все объявления с источником, виды и глаголы среди них, а тексты называют это тремя словами. По слову «values» читатель решит, что там только значения под голыми именами.

### case · QSSLF#catalog

«a verb, its page, then its chain, its inputs each with the refusal of its kinds, its answer, its refusals each with the repair, its laws and its recipe last».

```qlang
> ::host | kinds | toVec | map ~(manifest) | flat | filter ~(binding | value | tag | eq ::fn) | filter ~(binding | value | get /0 | map ~(get /name) | reduce {:seen false :bad false} ~(with {:acc /0 :name /1} ~(get {:seen ~(acc | get /seen | or (name | eq :proves)) :bad ~(acc | get /bad | or (acc | get /seen | and (name | ne :proves)))})) | get /bad) | map ~(binding | name)
[:any/put :any/query :any/update :regex/toRegex :stdio/err :string/capture :string/replace :string/scan :string/toRegex]

> ::any/put | binding | value | get /0 | take 5 | map ~(get [/name ~(get /modifiers | first)])
[[:takes :path] [:throws :PathKindNotTakenError] [:proves :PathKindNotTakenError/refusesABoolean] [:takes :value] [:proves :addsAKey]]
```

Кейс раздела (`QSSLF/catalog.jsonl:2`) проверяет только первую и последнюю команду глаголов `::vec`. Девять глаголов других меток ставят закон отказа сразу за отказом, перед следующим входом или ответом.

### case · QSSLF#catalog

«how the name behaves is told by its laws, …, so a behaviour the prose tells and a law proves is told by the law alone».

```qlang
> get [~(::number/add | doc | content | contains "a sum past the doubles is refused as") ~(::number/add | laws | get /refusesASumPastTheDoubles | get [~(first | content) /1]) ~(::number/add | doc | content | contains "`::Width#2 | add 3`") ~(::number/add | laws | get /answersUnderTheTag | get /1)]
[true ["A sum past the doubles is refused as no number." ~(1e+308 | add 1e+308 !| tag | eq ::number/NotFiniteError)] true ~(::Width#2 | add 3 | eq ::Width#5)]
```

Это правило не держит ни один кейс. Проза страницы `::number/add` пересказывает поведение, которое доказывают её законы.

### text · QSLSP#server

QSLSP#server: «coats the tokens of `tokenize` by a type of semantic token, a bracket and a gap by none [QSHST#tokens]». QSHST#tokens: «`quote` the `~(` and `)` of a quote …; `vec`, `set`, `map` and `error` the brackets of a container and of an error literal».

```sh
$ grep -n "^  quote:\|^  error:" D:/git/qlang-worktrees/closeout-spec/lsp/src/features.mjs
480:  quote:       'string',
487:  error:       'keyword',

$ grep -n "const UNCOATED" D:/git/qlang-worktrees/closeout-spec/lsp/test/QSLSP/server.test.mjs
34:  const UNCOATED = new Set(['vec', 'set', 'map', 'group', 'punctuation', 'whitespace', 'unparsed']);
```

Скобки цитаты и литерала ошибки по QSHST#tokens — тоже скобки, а сервер красит их типами `string` и `keyword`.

### text · QSPRN#legend

«beneath them stands a closed comment for each view the kind reveals, its name, the kind its verb answers and the gloss of the page of that answer, a view that names no verb of the kind standing by its name».

```qlang
> :Bag |~~ A bag. ~~| (::kind | accepts |~~ The things. ~~| ::vec | reveals :size); :Bag/size |~~ How many things: it holds. ~~| ~(count); get [~(::Bag/size/answer | binding !| tag) ~(::Bag | legend | print | lines | last)]
[::any/binding/UnknownNameError "|~ size · How many things ~|"]
```

Кейс `QSPRN/legend.jsonl:32` держит третье правило, которого глава не утверждает: вид, чей глагол не называет ответа, стоит с глоссой страницы самого глагола.

### text · QSCLI#repl

Глава не называет мета-команды REPL.

```sh
$ grep -n "line === '.exit'\|line === '.help'" D:/git/qlang-worktrees/closeout-spec/playground/src/repl.mjs
104:      if (line === '.exit') {
108:      if (line === '.help') {

$ grep -n "lists the commands of the REPL on" D:/git/qlang-worktrees/closeout-spec/playground/test/QSCLI/repl.test.mjs
9:  it('lists the commands of the REPL on `.help`, runs the cell after it and closes at the end of its input', async () => {

$ grep -c "\.help\|\.exit\|meta command" D:/git/qlang-worktrees/closeout-spec/docs/spec/QSCLI-the-command-line.md
0
```

Тесты раздела держат команды `.help` и `.exit`, а глава о них молчит.

### text · QSCLI#line-editor

«reads a chunk of one character, or one that begins with an escape, as keys, and any other chunk as text» и «each keeping the edits made in it until a submit».

```sh
$ grep -n "reads text whose one line feed ends it key by key\|Ctrl+C clears per-entry history drafts" D:/git/qlang-worktrees/closeout-spec/playground/test/QSCLI/line-editor.test.mjs
279:  it('Ctrl+C clears per-entry history drafts', () => {
587:  it('reads text whose one line feed ends it key by key', () => {

$ grep -n -A 1 "feed(stdinStream, 'abc' + NEWLINE, 'd', SUBMIT);" D:/git/qlang-worktrees/closeout-spec/playground/test/QSCLI/line-editor.test.mjs
590:    feed(stdinStream, 'abc' + NEWLINE, 'd', SUBMIT);
591-    expect(capture.lines).toEqual(['abc\nd']);
```

Тесты раздела читают кусок текста, который кончается единственным переводом строки, по клавишам: перевод строки остаётся в ячейке, а не отбрасывается как хвост вставки. Ctrl+C тоже сбрасывает правки ячеек истории, а не только отправка.

### conflict · docs/spec/README.md:6

README: «The requirements of a section of the language are the cases of the conformance file named for it». Предисловие QSPRN: «The requirements of each section are the cases of its file under `core/test/conformance/QSPRN/`». QSREQ#cases: «A case holds … no text a host writes around an answer, the line of a raise, the page of a refusal or the budget of an answer». Предисловия QSCLI и QSLSP: «The tests of … hold its sections».

```sh
$ git -C D:/git/qlang-worktrees/closeout-spec ls-files --error-unmatch core/test/conformance/QSPRN/
core/test/conformance/QSPRN/excerpt.jsonl
core/test/conformance/QSPRN/json.jsonl
core/test/conformance/QSPRN/legend.jsonl
core/test/conformance/QSPRN/print.jsonl
core/test/conformance/QSPRN/span.jsonl

$ git -C D:/git/qlang-worktrees/closeout-spec ls-files --error-unmatch core/test/conformance/QSCLI/ core/test/conformance/QSLSP/
error: pathspec 'core/test/conformance/QSCLI/' did not match any file(s) known to git
error: pathspec 'core/test/conformance/QSLSP/' did not match any file(s) known to git
Did you forget to 'git add'?
```

У QSPRN#budget, QSCLI и QSLSP нет файлов кейсов, а бюджет по QSREQ#cases вообще нельзя выразить кейсом.

### text · docs/spec/QSCLI-the-command-line.md:6

QSCLI: «The tests of `playground/` and of `stdio/` hold its sections». QSLSP: «The tests of `lsp/` and `vscode/` hold its sections».

```sh
$ git -C D:/git/qlang-worktrees/closeout-spec ls-files --error-unmatch core/test/unit/QSCLI core/test/unit/QSLSP
core/test/unit/QSCLI/stdin.test.mjs
core/test/unit/QSLSP/offer.test.mjs
core/test/unit/QSLSP/reach.test.mjs
core/test/unit/QSLSP/server.test.mjs
core/test/unit/QSLSP/symbols.test.mjs

$ git -C D:/git/qlang-worktrees/closeout-spec ls-files --error-unmatch stdio/test
error: pathspec 'stdio/test' did not match any file(s) known to git
Did you forget to 'git add'?
```

У `stdio/` своих тестов нет, а разделы QSCLI#stdin и QSLSP держат ещё и тесты ядра.

### case · QSSLF#manifest

```sh
$ grep -o -n '"name":"a-fan-out-over-a-noun[^"]*","query":"[^"]*"' D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSSLF/manifest.jsonl
5:"name":"a-fan-out-over-a-noun-resolves-each-element-through-it","query":"::vec | get [~(manifest | has ::vec/count) ~(doc :count | eq (::vec/count | doc))]"

$ grep -n "fan-out over the noun is a template" D:/git/qlang-worktrees/closeout-spec/docs/spec/QSDSP-a-verb-found-through-its-subject.md
237:subject; a fan-out over the noun is a template of `get` whose quotes run
```

Кейс показывает правило QSDSP#tagname о разветвлении по существительному, которого QSSLF#manifest не утверждает.

### case · QSCLI#colour

«`auto`, its default, paints where `FORCE_COLOR` holds anything but `0`».

```sh
$ grep -n "env.FORCE_COLOR" D:/git/qlang-worktrees/closeout-spec/playground/src/main.mjs
12:  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true;

$ grep -c "FORCE_COLOR: ''" D:/git/qlang-worktrees/closeout-spec/playground/test/QSCLI/colour.test.mjs
0
```

Пустой `FORCE_COLOR` по фразе главы — «anything but `0`», а `main.mjs` читает его как незаданный. Ни один тест раздела этот случай не держит.

### text · QSHST#cell

«`::cell`, a kind of the core over its identity, letters, digits and hyphens».

```qlang
> get [~(::cell"имя" !| tag) ~(::cell"a_b" !| tag) ~(::cell"AB-12" | tag)]
[::cell/PayloadNotIdentityError ::cell/PayloadNotIdentityError ::cell]
```

```sh
$ grep -n 'contains #' D:/git/qlang-worktrees/closeout-spec/core/lib/qlang/cell.qlang
30:        ~(contains #"^[A-Za-z0-9-]+$")
```

Инвариант страницы принимает только буквы ASCII, а «letter» в QSNAM#letters — «a letter of any script».

### text · QSPRN#print

«and any other character below U+0020 and a lone surrogate as `\u` and their four digits, so the print shows a control character».

```qlang
> get [~("\u007f" | print | count) ~("\u0085" | print | count) ~("\u0007" | print | count)]
[3 3 8]
```

DEL и управляющий символ C1 печатаются сырыми, так что следствие «shows a control character» верно только для C0.

### text · QSPRN#print

«a `print` declared under a label, a kind of a reader, of a host or of the root, is refused, `::bind/PrintDeclaredError`».

```qlang
> get [~(~(:any/print ~("x");) | answer !| tag) ~(~(:vec/print ~("x");) | answer !| tag) ~(~(:tagged/print ~("x");) | answer !| tag)]
[::bind/NameDeclaredTwiceError ::bind/PrintDeclaredError ::bind/PrintDeclaredError]
```

Под меткой корня `::any` объявление `print` отказывается другим тегом.

### pentimento · QSPRN#excerpt

«A host prints no value cut to a room» и «no verb cuts a value to a room».

```qlang
> [1 2] | excerpt !| tag
::call/UnknownNameError
```

Фразы говорят, чего нет, хотя правило рядом сказано как то, что есть («the whole is read live»). Проба проверяет отсутствие только одного имени, `excerpt`.

### pentimento · QSCLI#answer

«No flag sets or cuts the budget». То же в QSPRN#budget: «The command line writes no flag that sets or cuts the budget».

```sh
$ qplay --width=80 '1' < /dev/null 2>&1
qplay: --width=80 is no flag of the playground, which `qplay --help` lists
```

Отрицание повторяет правило о флагах, которое уже стоит в разделе. Проба отвергает именно `--width`, флаг, которого дерево не держит.

### pentimento · QSSLF#catalog

«A verb enters the catalog when it expresses what was inexpressible over the values the language has, or shortens what every host would otherwise write» и «since a name that answers otherwise than the habit expects fails in silence».

```sh
$ grep -n "A verb enters the catalog when\|fails in silence" D:/git/qlang-worktrees/closeout-spec/docs/spec/QSSLF-the-language-describes-itself.md
323:A verb enters the catalog when it expresses what was inexpressible over the
340:a name that answers otherwise than the habit expects fails in silence.
```

Критерий входа глагола в каталог и довод «since … fails in silence» не решаются против дерева.

### pentimento · QSHST#effect

«a host that wants the provenance of a value seen tags the value» и «a host whose verb is better served by calls at once takes the whole vector and bounds its own calls».

```sh
$ grep -n "provenance\|calls at once" D:/git/qlang-worktrees/closeout-spec/docs/spec/QSHST-hosts.md
251:explicit step at the boundary; a host that wants the provenance of a
255:order, and a host whose verb is better served by calls at once takes the
```

Это совет автору хоста, и в дереве нет хоста, против которого его можно проверить.

### pentimento · scripts/sensors/run-probes.mjs:6

«Answers compare as the printer writes them, because a probe records what was printed».

```sh
$ grep -n "because a probe records what was printed" D:/git/qlang-worktrees/closeout-spec/scripts/sensors/run-probes.mjs
6:// because a probe records what was printed: a literal answer is read
```

«because» здесь — довод, а не то, что держится.
