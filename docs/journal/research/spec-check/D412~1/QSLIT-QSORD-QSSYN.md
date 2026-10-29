> A check of the chapters `QSLIT`, `QSORD`, `QSSYN` for D412 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–23:59 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### text · QSLIT#kind

«so every value splits into its tag and its payload and joins back by `tag`, `:t (tag) | payload | tag t`»

```qlang
> get [~(":t (tag) | payload | tag t" | parse !| message) ~([1 2] | apply ~(:t (tag); payload | tag t) !| get [~(tag) ~(name)]) ~(::any/tag | doc | content | contains "`with {:kind ~tag} ~(payload | tag kind)`")]
["a declaration ends with `;`, which joins it to the query after it: write `:name body; query`" [::bind/SubjectNotGivenError :tag] true]
```

Формулу, которой раздел записывает правило, парсер отказывает по правилу QSSYN#step («a `|` after a declaration»). Если поставить `;`, тело объявления отказано по QSNAM#declare: тело выполняется без субъекта. При этом страницы `::any/tag` и `::any/payload`, а также собственная проба раздела пишут разбор и сборку через `with {:t ~tag} ~(payload | tag t)`.

### design · QSLIT#closed

«names the literal as the template of `get`, its tags and its brackets kept, `[::Box[x] 1]` naming `get [::Box[~(x)] 1]` … and inside an error literal names the facts built by `get` and made an error by `raise`»

```qlang
> :Box |~~ B ~~| (::kind | wires :w |~~ w ~~| /w ::number); get [~("::Box{:w (x)}" | parse !| message) ~(:x 3; get ::Box{:w ~(x)} !| tag) ~(:x 3; get {:w ~(x)} | tag ::Box)]
["a literal computes nothing: a shape computed is built by `get`, its parts paths and quotes, write `get ::Box{:w ~(x)}`" ::Box/WKindNotTakenError ::Box{:w 3}]

> get [~("::number/add/SubjectNotNumberError!{:subject/found (1 | add 1)}" | parse !| message) ~(get {:subject/found ~(1 | add 1)} | tag ::number/add/SubjectNotNumberError | raise !| tag)]
["an error literal computes nothing: facts computed are built by `get` and `raise` makes them an error, write `get {:subject/found ~(1 | add 1)} | tag ::number/add/SubjectNotNumberError | raise`" ::number/add/SubjectNotNumberError/PayloadKindNotTakenError]
```

Ремонт, который называет отказ парсера, сам отказывается в двух случаях:
- для вида с проводкой полей QSPTH#template отказывает путь или цитату в поле («a kind whose field takes a number refuses a path written at that field … built by `get` and then `tag`»);
- для тега отказа QSLIT#tag кладёт этот тег только поверх ошибки в покое («the tag of a refusal … lays the kind of the refusal over an error at rest alone»).

Вопрос: какой ремонт должен называть отказ литерала под тегом, чтобы названная форма отвечала при любом виде этого тега?

### design · QSORD#desc

«`desc` turns its subject: a value under `::desc` answers its payload and any other is laid under `::desc` … `5 | desc | tag ::Box | desc` answering `::Box::desc#5`»

```qlang
> get [~(5 | desc | tag ::Box | desc) ~(5 | desc | tag ::Box | is ::desc) ~(5 | desc | tag ::Box | desc | eq (5 | desc | tag ::Box)) ~([1 2] | map ~(desc | tag ::Box) | sort ~(desc) | map ~(payload | payload)) ~([1 2] | map ~(desc | tag ::Box) | sort | map ~(payload | payload))]
[::Box::desc#5 true true [2 1] [2 1]]

> ::any/desc | doc | content | lines | filter ~(contains "every kind")
["`sort ~(get [~(get /score | desc) /name])`. A value of every kind"]
```

Два пути отвечают на один вопрос по-разному. `is ::desc` считает `::Box::desc#5` значением `::desc`. Рецепт `desc` смотрит на внешний `tag`, а по QSLIT#tag тег, к которому значение уже относится, ничего не меняет. В итоге `desc` оставляет значение как есть, и ключ `~(desc)` сортирует так же, как без ключа. Это расходится со страницей `::any/desc` («A value of every kind turns») и с первой страницей («`desc` turns a key to descend»).

Вопрос: что должен отвечать `desc` на значение `::desc` под другим тегом, чтобы переворачивать любое значение?

### text · QSSYN#step

«A text … is its declarations, each ended by `;`, the parser's token, and at most one query after them.»

```qlang
> :Box |~~ A box. ~~|
#[::Box]

> get [~(::qlang/pipeline | doc | content | contains "each ended by `;`, and one query after them") ~(::qlang | doc | content | contains "A text is its declarations, each ended by `;`")]
[true true]
```

```sh
$ grep -n -o '"name":"a-text-of-declarations-alone[^}]*' D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSNAM/declare.jsonl
11:"name":"a-text-of-declarations-alone-answers-the-addresses-it-declared","query":":Box |~~ A box. ~~|","expect":"#[::Box]"
$ grep -n "the last one by the end" D:/git/qlang-worktrees/closeout-spec/core/src/grammar.peggy
363:// group: its declarations, each ended by `;`, the last one by the end of the
```

Раздел требует `;` после каждого объявления, и страницы `::qlang` и `::qlang/pipeline` повторяют это. Против этого стоят:
- кейс QSNAM/declare.jsonl:11;
- пример QSNAM#declare;
- комментарий грамматики, который цитирует [QSSYN#step].

Все три держат последнее объявление текста без запроса, завершённое концом текста.

### implementation · QSSYN#refusal

«one that ends with a combinator names the step it misses beside its continuations» при QSSYN#comment «A comment … is whitespace wherever whitespace stands»

```qlang
> ["[1] |" "[1] | |~ note ~|" "(1 | |~ note ~|)"] | map ~(parse !| message)
["`|` joins two steps, and the step after it is missing" null "`|` joins two steps, and the step after it is missing"]
```

```sh
$ grep -n -F '(!?\|)\s*$' D:/git/qlang-worktrees/closeout-spec/core/src/parse.mjs
109:  const combinator = /(?:^|\s)(!?\|)\s*$/.exec(source)?.[1];
```

В группе и в цитате комбинатор перед комментарием назван, в конце источника — нет. Причина: конечный комбинатор ищется регулярным выражением по тексту, а оно комментарий за пробел не считает.

Вопрос: должен ли источник, который кончается комбинатором и комментарием, называть пропущенный шаг, как это делают группа и цитата?

### implementation · QSSYN#step

«A path written before a word is refused naming both its readings … and a path followed by a word is refused naming the verb it meant, `/ne ""` naming `ne`»

```qlang
> get [~("{:a {:tags [1]}} | /a/tags count" | parse !| message) ~("[\"x\"] | filter ~(/a/ne \"\")" | parse !| message) ~("/tags count" | parse !| message) ~("{:a 1} | /\"a\" count" | parse !| message)]
["steps are joined by `|`: write `a | b`" "steps are joined by `|`: write `a | b`" "`/tags` is a path, a value: a part is read by `get`, `get /tags | count`, and a verb is called by its name alone, `tags count`" "steps are joined by `|`: write `a | b`"]
```

Правило выполняется только для пути из одного голого сегмента (`PathBeforeWord` в `core/src/grammar.peggy` читает `"/" KeywordName`). Путь из нескольких сегментов и ключ в кавычках получают общий отказ о `|`.

Вопрос: какие два прочтения должен называть отказ для `/a/tags count` и `/"a" count`?

### implementation · QSLIT#json

«a map that writes its keys both ways is refused where its entries end, naming the two»

```qlang
> ["{\"a\": 1 :b 2}" "{:a 1, \"b\": 2}" "{:a 1 \"b\": 2}" "{\"a\": 1, :b 2}"] | map ~(parse !| get [~(message) ~(location | start | column)])
[[null 9] [null 6] ["a map writes its keys one way, as keywords, `{:a 1 :b 2}`, or as the strings of JSON, `{\"a\": 1, \"b\": 2}`" 7] ["a map writes its keys one way, as keywords, `{:a 1 :b 2}`, or as the strings of JSON, `{\"a\": 1, \"b\": 2}`" 8]]
```

Из четырёх смешанных записей две отказаны без `:message`, общими продолжениями. Грамматика ловит смешение только после запятой JSON или перед строковым ключом.

Вопрос: должен ли отказ называть обе записи при любом порядке и разделителе?

### text · QSSYN#doc

«which reads a line break written as `\r\n` as one» … «the prose of a line doc ends at the line break of the line its last part ends on, a carriage return alone staying in it»

```qlang
> get [~("|~~| a\rb" | parse | first | segments) ~("|~~| a\rb" | parse | first | content | contains "\r") ~("|~~ a\rb ~~|" | parse | first | segments) ~(["a\rb"] | tag ::doc | segments) ~("|~~| a\rb" | parse | first | print)]
[["a\nb"] false ["a\nb"] ["a\nb"] "|~~ a\n  b ~~|"]
```

Одинокий `\r` действительно не завершает строковый док, но проза держит вместо него `\n`: в строковом доке, в блочном и в `tag ::doc`. Кейс QSSYN/doc.jsonl:43 держит это правило (`"|~~| a\rb"` → `"a\nb"`), а глава его не формулирует: она говорит только о `\r\n`.

### text · QSORD#sort

«another kind refused under its input `key`, `::vec/sort/KeyKindNotTakenError`, `::map/sort/key/…` and `::vec/min/key/…`»

```qlang
> get [~({:a 1} | sort 5 !| tag) ~([1] | min 5 !| tag) ~([1 2] | sort 5 !| tag) ~(::map/sort/key | manifest) ~(::vec/min/key | manifest) ~([{:n 1 :i 0} {:n 1 :i 1}] | max /n | get /i)]
[::map/sort/KeyKindNotTakenError ::vec/min/KeyKindNotTakenError ::vec/sort/KeyKindNotTakenError #[::map/sort/key/answer ::map/sort/key/expected ::map/sort/key/found ::map/sort/key/index] #[::vec/min/key/answer ::vec/min/key/expected ::vec/min/key/found ::vec/min/key/index] 0]
```

`::map/sort/key/…` и `::vec/min/key/…` — это части слота `key`. Сами отказы называются `::map/sort/KeyKindNotTakenError` и `::vec/min/KeyKindNotTakenError`, их держат кейсы QSORD/sort.jsonl:19 и :20.

### text · QSORD#set

«Its own verbs are those whose answer on a set is not the answer of the verb of vectors on it: … `toSet` and `distinct` the set itself»

```qlang
> get [~(#[2 1] | distinct | eq (#[2 1] | vec/distinct)) ~(::Box#[2 1] | distinct | eq (::Box#[2 1] | vec/distinct)) ~(::set/distinct | binding | value | get /1) ~(::Box#[2 1] | toSet | eq (::Box#[2 1] | vec/toSet))]
[true true ~(toSet) false]
```

Рецепт `set/distinct` — `~(toSet)`, и его ответ на множестве, голом и под тегом, равен ответу `vec/distinct`. На `::set` он стоит как имя привычки рядом с `toSet` (QSSLF#catalog, QSDSP#residence «`toSet` with `distinct` beside it»), а не по критерию раздела. Тот же критерий пишет и страница `::set`.

### conflict · QSSYN#step

QSSYN#step: «a path, a container literal and a tagged literal naming `get`». QSQUO#step: «`get` a path and a container, `tag` a tag name, `apply` a quote, and any other value 'a step is a command'».

```qlang
> ["5 | ::T#1" "5 | ::T:k" "5 | :k"] | map ~(parse !| message)
["a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`" "a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`" "a step is a command: a value stands at the head, where it is the subject, or as what a verb takes"]
```

Для литерала под тегом, который не путь и не контейнер, QSQUO#step предписывает 'a step is a command', а QSSYN#step и дерево называют `get`.

### conflict · QSSYN#refusal

QSSYN#refusal: «one that ends with a combinator names the step it misses beside its continuations»; «a bracket, a string, a quote, a doc or a comment open». Страница `::quote/ParseError`: «`:message` names the habit a form of another language wrote, and where none does `:expected` lists what could stand there and a source cut short names the bracket it left open.»

```qlang
> get [~(::quote/ParseError | doc | content | lines | filter ~(contains "none does")) ~("[1 2 3] |" | parse !| get [~(message) ~(expected)]) ~("|~ a" | parse !| message)]
[["another language wrote, and where none does `:expected` lists"] ["`|` joins two steps, and the step after it is missing" [:whitespace]] "`|~` opened at line 1, column 1 is never closed; `~|` completes the source"]
```

Страница отводит `:expected` случаю, когда `:message` нет, и всё оставшееся открытым называет «bracket». Глава и кейс QSSYN/combinator.jsonl:1 держат `:message` и `:expected` вместе, а отказ называет открытый комментарий `|~`.

### implementation · QSSYN#combinator

«A combinator is set off by whitespace on both sides, a line break counting as whitespace and an opening bracket or the start of the text standing for the space before it»

```qlang
> get [~(":x 1;| x" | parse | answer) ~("[1]| count" | parse !| message)]
[1 "a combinator is set off by whitespace on both sides: write ` | `"]
```

Дерево принимает `;` за пробел перед комбинатором: `QueryAfterTheDeclarations` читает `_ ";" _`. Глава даёт это право только открывающей скобке и началу текста.

Вопрос: стоит ли `;` перед `|` за пробел, как открывающая скобка, или `;|` отказывается, как `]|`?

### drift · core/test/conformance/QSLIT/tag.jsonl:35

«a-kind-whose-wraps-names-no-kind-takes-no-payload» против QSLIT#tag «a tag whose `accepts` names the set of no kinds takes no payload»

```qlang
> [::tagged ::qlang] | map ~(binding | value | get /0 | first | get /name)
[:accepts :accepts]
```

```sh
$ grep -n "wraps" D:/git/qlang-worktrees/closeout-spec/scripts/retired-words.mjs D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSLIT/tag.jsonl
D:/git/qlang-worktrees/closeout-spec/scripts/retired-words.mjs:92:  { regex: /\bwrapperConstructor\b|\bwrapsAPipelineInAGroup\b|\b[Rr]ewrap(?:s|ped|ping)?\b/, written: 'a tag that holds a payload under it, which `payload` takes off, the steps `::fail` and `::group`, each holding the quote of the step it stands for and named by its tag, and the tag `within` lays back over the payload it edits', by: 'D367' },
D:/git/qlang-worktrees/closeout-spec/scripts/retired-words.mjs:108:  { regex: /`wraps`|\|\s*wraps\b|\bkind\/wraps\b/, written: 'the payload a kind accepts, the command `accepts`', by: 'D450' },
D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSLIT/tag.jsonl:35:{"name":"a-kind-whose-wraps-names-no-kind-takes-no-payload","query":"get [~(5 | tag ::tagged !| tag) ~(1 | tag ::qlang !| tag)]","expect":"[::tagged/PayloadKindNotTakenError ::qlang/PayloadKindNotTakenError]"}
$ grep -n "wraps" D:/git/qlang-worktrees/closeout-spec/core/test/unit/QSERR/site.test.mjs
260:  it('names no refusal of a kind that writes no wraps and no field', async () => {
266:  it('names the refusal of every payload for a kind whose wraps names no kind', async () => {
```

Имя кейса называет команду `accepts` удалённым словом `wraps` (D450). Узкое правило лексикона его в имени с дефисами не ловит; так же пишут заголовки тестов `site.test.mjs:260` и `:266`.

### drift · core/test/conformance/QSSYN/line.jsonl:11

«a-body-begun-on-a-later-line-is-a-sentence» против QSSYN#line «a body begun on a later line is the body of the declaration above»

```sh
$ grep -n -o '"name":"[^"]*sentence[^"]*"' D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSSYN/line.jsonl D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSBLD/recipe.jsonl
D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSSYN/line.jsonl:11:"name":"a-body-begun-on-a-later-line-is-a-sentence"
D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSBLD/recipe.jsonl:2:"name":"a-recipe-reads-no-value-of-a-sentence"
D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSBLD/recipe.jsonl:4:"name":"a-value-the-sentence-names-reaches-no-selector-of-a-verb"
D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSBLD/recipe.jsonl:5:"name":"a-value-the-sentence-names-reaches-no-invariant-of-a-verb"
D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSBLD/recipe.jsonl:7:"name":"a-recipe-of-a-function-reads-its-input-past-a-value-of-the-sentence"
D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSBLD/recipe.jsonl:8:"name":"a-value-of-the-sentence-shadows-no-verb-the-recipe-of-a-function-calls"
```

В именах кейсов «sentence» стоит на месте объявления и текста — того, что главы и страницы называют `declaration` и `text`. В главах и на страницах «sentence» значит только предложение прозы.

### drift · core/test/conformance/QSLIT/json.jsonl:26

«json-object-key-that-is-no-identifier-reads-quoted» против QSLIT#json «quoted where the key is no bare name»

```sh
$ grep -rn -o "identifier[a-z-]*" D:/git/qlang-worktrees/closeout-spec/core/lib D:/git/qlang-worktrees/closeout-spec/docs/spec D:/git/qlang-worktrees/closeout-spec/core/test/conformance D:/git/qlang-worktrees/closeout-spec/CLAUDE.md
D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSLIT/json.jsonl:26:identifier-reads-quoted
$ grep -n "identifier" D:/git/qlang-worktrees/closeout-spec/scripts/retired-words.mjs
63:  { regex: /\bidentifier[\s-]+(?:start|continue)\b|\bchar-class\b|\bend-of-input\b|\bclassKeyword\b/i, written: 'a continuation in the words of the language, a name, the letters of a name, whitespace, a doc, the end of the source, a character by what it reads', by: 'D360' },
```

Единственное «identifier» в текстах, которые говорят, что выполняется, стоит здесь: на месте голого имени (QSLIT#json, QSNAM#letters), которое D360 предписывает писать вместо слов на «identifier».

### case · QSORD#desc

«within it by the reverse of their payloads' rank, under another tag as well» и «`5 | desc | tag ::Box | desc` answering `::Box::desc#5`»

```qlang
> get [~(5 | desc | tag ::Box | desc) ~(get [~(1 | desc | tag ::Box) ~(2 | desc | tag ::Box)] | sort)]
[::Box::desc#5 [::Box::desc#2 ::Box::desc#1]]
```

```sh
$ grep -n -c -e "desc | tag ::Box" -e "::Box::desc" D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSORD/desc.jsonl
0
```

Ни одно из двух правил раздела о `::desc` под другим тегом не держит ни один кейс.

### case · QSSYN#step

«refused by the parser: a path, a container literal and a tagged literal naming `get`, a tag name `tag` and a quote `apply`, and an atom, a regex, an error literal and a doc refused as a value standing where a command stands»; «a `!|` among the declarations»

```qlang
> ":a 1 !| :b 2" | parse !| message
a failure of a declaration is the failure of its text, which no `!|` of the text catches: a declaration ends with `;`, and a failure of the text is caught where the text is read, `~(…) | answer !| …`
```

```sh
$ grep -c -F -e 'which the verb that takes it reads' -e 'a tag goes over the value' -e 'a step is a command' -e 'a literal is a value, which' -e 'no `!|` of the text catches' D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSSYN/step.jsonl
0
$ grep -n -o '"name":"a-catch-among-the-declarations[^"]*","query":"[^}]*' D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSERR/catch.jsonl
29:"name":"a-catch-among-the-declarations-of-a-text-is-refused","query":"\":a 1 !| :b 2\" | parse !| tag","expect":"::quote/ParseError"
```

- Кейсы QSSYN/step.jsonl:1–5 держат только тег `::quote/ParseError`. Сообщения на пути парсера кейсы не держат, а `get` для литерала под тегом не держит ни один кейс.
- Отказ `!|` среди объявлений — правило этого раздела — стоит кейсом под QSERR#catch, который этого правила не формулирует.

### case · QSSYN#comment

«a `;` inside a comment, a doc, a string or a regex is theirs»; «A `~(` inside a block comment reads to the `)` that pairs it, where the source holds one»

```qlang
> get [~(5 |~ a; b ~| | add 1) ~(|~~ a; b ~~| | content) ~(#"a;b" | print) ~("[|~ ~(x ~| 1]" | parse | answer)]
[6 "a; b" "#\"a;b\"" [1]]
```

```sh
$ grep -c -F -e '~(x ~|' -e 'semicolon' D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSSYN/comment.jsonl
0
```

Ни один кейс раздела не держит `;` внутри комментария, дока или регекса, и ни один не держит `~(` без пары внутри блочного комментария. Кейс comment.jsonl:31 держит только `~(` с парой.

### case · QSSYN#doc

«A doc written before a declaration is refused, naming the slot»

```qlang
> "|~~ note ~~| :x 42" | parse !| message
a doc stands in the slot of the declaration it documents: write `:name |~~ … ~~| body`
```

```sh
$ grep -c -F 'the slot of the declaration' D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSSYN/doc.jsonl
0
```

Кейс QSSYN/doc.jsonl:23 держит только тег `::quote/ParseError`. То, что отказ называет слот, кейсом не держится.

### case · QSORD#sort

«`min` and `max` with a key answer the element, the first of equal ones»

```qlang
> [{:n 1 :i 0} {:n 1 :i 1}] | get [~(max /n | get /i) ~(min /n | get /i)]
[0 0]
```

```sh
$ grep -n -o '"name":"[^"]*equal[^"]*"' D:/git/qlang-worktrees/closeout-spec/core/test/conformance/QSORD/sort.jsonl
4:"name":"sort-keeps-equal-keys-in-subject-order"
11:"name":"min-takes-a-key-and-answers-the-first-of-equal-ones"
```

Правило о первом из равных для `max` кейсом не держится; кейс есть только для `min`.

### implementation · core/test/helpers/ring-of-atoms.mjs:56

QSREQ#marks: «The title of a test and of a group says its rule in the words of its section and cites none»

```sh
$ git -C D:/git/qlang-worktrees/closeout-spec ls-files --error-unmatch core/test/helpers/ring-of-atoms.mjs
core/test/helpers/ring-of-atoms.mjs
$ grep -n "describe(" D:/git/qlang-worktrees/closeout-spec/core/test/helpers/ring-of-atoms.mjs
56:  describe(`the ring of atoms over share ${share} of ${SHARES} of the catalog [QSLIT#atoms]`, () => {
```

Заголовок группы цитирует раздел, хотя правило это запрещает, и `check:conventions` его пропускает.

Вопрос: должна ли проверка читать и заголовки групп в шаблонных строках общих помощников?

### conflict · core/src/grammar.peggy:1078

Комментарий грамматики: «`:name` and `:"any text"` read as the same keyword.» QSLIT#keyword: «a bare name in quotes is that name».

```qlang
> :"any text" | eq :name
false
```

```sh
$ grep -n "read as the same keyword" D:/git/qlang-worktrees/closeout-spec/core/src/grammar.peggy
1078:// `:name` and `:"any text"` read as the same keyword.
```

Комментарий объявляет одним ключевым словом голое имя и произвольный текст в кавычках, а глава приравнивает только голое имя к тому же имени в кавычках. К тому же правило `Keyword` под этим комментарием покрыто меткой `[QSLIT#number]` со строки 1055: следующая метка стоит только на строке 1103.
