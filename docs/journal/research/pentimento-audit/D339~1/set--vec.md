> A pentimento audit of set--vec for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–23:59 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### archaism · core/lib/qlang/tagged.qlang:9
Текст: «the data keeps its shape, so the verbs of the payload's kind still serve it»; там же, строки 23–26: «then this kind, then the kind of its payload, … and a vector under a tag stays a vector».
Слой: страница держит модель открытого тега, в которой любой тег пропускает вызов к глаголам вида своего payload. Формулировка стоит с a1014671 (2026-10-12), а закрытый тег, который прокладывает части и останавливает на себе обход [QSDSP#walk], [QSBLD#value], пришёл с D449 (дерево 297d1956), и страница `::tagged` о нём не знает.
Чистый лист: страница сказала бы, что глаголы payload служат открытому тегу, а значение под тегом, чей вид прокладывает части, отвечает только на прокладанные имена и на слова `::tagged` и `::any`.
```
$ qplay 'get [~(::Box[1 2] | count) ~(::span[0 1 1 1 1 2] | count !| tag) ~(::span[0 1 1 1 1 2] | is ::vec) ~(::span[0 1 1 1 1 2] | vec/count !| tag)]' < /dev/null
[2 ::call/KindAnswersNoVerbError false ::vec/count/SubjectNotVecError]

$ git -C D:/git/qlang-worktrees/closeout-pentimento show a1014671:core/lib/qlang/tagged.qlang | grep -n 'still serve'
10:      words of the payload's kind still serve it, `::Box[1 2] | count`

$ git -C D:/git/qlang-worktrees/closeout-pentimento show -s --format='%h %ad' --date=short a1014671 297d1956
a1014671b 2026-10-12
297d1956b 2026-10-25
```

### archaism · core/lib/qlang/vec.qlang:946
Текст: «the second is refused, `:key` naming the keyword». Та же фраза стоит в `vec.qlang:1059` и `set.qlang:200`, а в главе `QSCOL-collections.md:261`: «its `:key` the keyword».
Слой: это плоский факт прежней модели, где `KeyTakenError` прокладывал `wires :key … ::keyword`. Теперь `:key` — слот входа `key` в вердикте, а ключевое слово лежит в его части `answer`.
Чистый лист: страницы и глава назвали бы ключевым словом `key | answer`, а значением, которое легло первым, — `taken`, на языке слотов [QSERR#site].
```
$ qplay '[1 "1"] | groupBy !| get [~(payload | keys) ~(key | tag) ~(key | answer)]' < /dev/null
[#[:key/answer :key/found :subject/found :taken :trace] ::vec/groupBy/key :"1"]

$ git -C D:/git/qlang-worktrees/closeout-pentimento show 236e4ea8:core/lib/qlang/vec.qlang | grep -n -F 'wires :key '
961:        ~(wires :key |~~ The keyword both values file under. ~~| ::keyword

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -E ':key. naming the|its .:key. the keyword' -- core/lib docs/spec
core/lib/qlang/set.qlang:200:            value under a key: the second is refused, `:key` naming the
core/lib/qlang/vec.qlang:946:            value under a key: the second is refused, `:key` naming the
core/lib/qlang/vec.qlang:1059:            value under a key: the second is refused, `:key` naming the
docs/spec/QSCOL-collections.md:261:the second refused as `KeyTakenError`, its `:key` the keyword and
```

### vestige · core/src/runtime/regex-primitives.mjs:1
Текст: модуль `regex-primitives.mjs` с `registerPrimitive('string/match'` … `'string/replace'`.
Слой: имя появилось при переименовании `regex.mjs` по форме `<noun>-primitives.mjs` [QSLEX#grep] в 95169244 (D431), но модуль не держит ни одного примитива `::regex`. Единственный глагол `::regex/toRegex` регистрируется в `convert.mjs:74`, а здесь стоят глаголы `::string`, так что имя говорит о том, чем модуль не является.
Чистый лист: `match`, `capture`, `scan` и `replace` стояли бы в `string-primitives.mjs` рядом с `string.qlang`, `regex/toRegex` — в модуле `::regex`, а чтение движка осталось бы в `regex-read.mjs`.
```
$ qplay '::regex | manifest' < /dev/null
#[::regex/PayloadKindNotTakenError ::regex/payload ::regex/toRegex]

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -o -E "registerPrimitive\('(regex|string)/(match|capture|scan|replace|toRegex)'" -- core/src/runtime
core/src/runtime/convert.mjs:74:registerPrimitive('regex/toRegex'
core/src/runtime/convert.mjs:80:registerPrimitive('string/toRegex'
core/src/runtime/regex-primitives.mjs:22:registerPrimitive('string/match'
core/src/runtime/regex-primitives.mjs:29:registerPrimitive('string/capture'
core/src/runtime/regex-primitives.mjs:36:registerPrimitive('string/scan'
core/src/runtime/regex-primitives.mjs:56:registerPrimitive('string/replace'

$ git -C D:/git/qlang-worktrees/closeout-pentimento show --format= --name-status 95169244 -- core/src/runtime/regex-primitives.mjs core/src/runtime/regex.mjs
R094	core/src/runtime/regex.mjs	core/src/runtime/regex-primitives.mjs
```

### vestige · core/src/runtime/sequence.mjs:18
Текст: `registerPrimitive('string/count', …)` в `sequence.mjs`, `map/union|minus|inter` в `setops.mjs`, `string/toNumber|toTag|toRegex` в `convert.mjs`.
Слой: рантайм разложен по операциям: «последовательность поперёк видов» (`sequence.mjs`, бывший `vec.mjs`), «операции множеств» (`setops.mjs`, хотя модуль держит и алгебру отображений, и свёртки векторов, которые глава зовёт algebra [QSCOL#algebra]) и «конверсии» (`convert.mjs`). Эта раскладка пережила правило, по которому примитивы существительного стоят в `<noun>-primitives.mjs` рядом с его страницей: примитивы `::string` разбросаны по семи модулям, `::map` — по четырём, модулей `::vec` и `::set` нет вовсе, а модули по операциям импортируют друг друга.
Чистый лист: по модулю на существительное рядом с его страницей (`vec-primitives.mjs`, `set-primitives.mjs`, `map-primitives.mjs`, `string-primitives.mjs`), а общий помощник — в модуле того существительного, которому он принадлежит.
```
$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -c -E "register(Primitive|StateReader)\((\[[^]]*)?'string/" -- core/src/runtime
core/src/runtime/code.mjs:1
core/src/runtime/convert.mjs:4
core/src/runtime/json.mjs:1
core/src/runtime/path-primitives.mjs:1
core/src/runtime/regex-primitives.mjs:4
core/src/runtime/sequence.mjs:3
core/src/runtime/string-primitives.mjs:10

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -c -E "register(Primitive|StateReader)\((\[[^]]*)?'map/" -- core/src/runtime
core/src/runtime/convert.mjs:1
core/src/runtime/map-primitives.mjs:4
core/src/runtime/sequence.mjs:17
core/src/runtime/setops.mjs:3

$ git -C D:/git/qlang-worktrees/closeout-pentimento ls-files --error-unmatch core/src/runtime/string-primitives.mjs core/src/runtime/map-primitives.mjs core/src/runtime/vec-primitives.mjs core/src/runtime/set-primitives.mjs
error: pathspec 'core/src/runtime/vec-primitives.mjs' did not match any file(s) known to git
error: pathspec 'core/src/runtime/set-primitives.mjs' did not match any file(s) known to git
core/src/runtime/map-primitives.mjs
core/src/runtime/string-primitives.mjs
Did you forget to 'git add'?

$ git -C D:/git/qlang-worktrees/closeout-pentimento show --format= --name-status f58ffead -- core/src/runtime/sequence.mjs core/src/runtime/vec.mjs
R087	core/src/runtime/vec.mjs	core/src/runtime/sequence.mjs

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -E "from './(regex-primitives|string-primitives|convert)\.mjs'" -- core/src/runtime
core/src/runtime/sequence.mjs:9:import { keywordFiledFor, KINDS_A_KEY_FILES_UNDER } from './convert.mjs';
core/src/runtime/sequence.mjs:10:import { writtenAsText } from './string-primitives.mjs';
core/src/runtime/string-primitives.mjs:5:import { containsMatch, piecesBetweenMatches } from './regex-primitives.mjs';
```

### archaism · core/lib/qlang/trace.qlang:108
Текст: «`"x" | add 1 !| trace | subject` answering `"x"`, the value a refusal of a subject leaves to the trace».
Слой: страница написана в 236e4ea8 (2026-10-26, 13:14), когда отказ субъекта нёс только метку, а сам субъект оставлял кадру трассы. Через пять с половиной часов 9c85c16e начал заливать в вердикт слот `subject/found`; фраза осталась от прежнего слоя, а глагол стал третьей дорогой к одному значению.
Чистый лист: субъект отказа читался бы одной дорогой, `!| subject | found`, и вид `trace | subject` не объяснялся бы тем, что отказ «оставляет» субъект трассе.
```
$ qplay '"x" | add 1 !| get [~(subject | found) ~(trace | subject) ~(trace | first | subject) ~(payload | keys)]' < /dev/null
["x" "x" "x" #[:subject/expected :subject/found :trace]]

$ git -C D:/git/qlang-worktrees/closeout-pentimento show 236e4ea8~1:core/lib/qlang/trace.qlang | grep -c 'trace/subject'
0

$ git -C D:/git/qlang-worktrees/closeout-pentimento show 236e4ea8:core/lib/qlang/trace.qlang | grep -n 'leaves to the'
113:      answering `"x"`, the value a refusal of a subject leaves to the

$ git -C D:/git/qlang-worktrees/closeout-pentimento show -s --format='%h %ad' --date=iso 236e4ea8 9c85c16e
236e4ea8b 2026-10-26 13:14:03 +0300
9c85c16e4 2026-10-26 18:41:19 +0300

$ git -C D:/git/qlang-worktrees/closeout-pentimento show -s --format=%s 9c85c16e | grep -o -E 'retells no value, .actualValue. and the mark of a refusal of the subject leaving its sites'
retells no value, `actualValue` and the mark of a refusal of the subject leaving its sites
```

### vestige · core/lib/qlang/trace.qlang:31
Текст: `| accepts |~~ The frames, from where the failure arose outward, a vector of frames plain or under ::trace … ~~|` — без единого вида.
Слой: страж `::trace` живёт в JS-конструкторе `framesOfTrace`, который сам пишет `kindsExpected('vec')` и `kindsExpected(FRAME_TAG.name)`, а цепочка вида не называет — вопреки [QSBLD#kind], «the guard of a kind is its chain». Коммит D443 (6e770b58), записавший это правило, тронул `frame.qlang` и не тронул `trace.qlang`, у которого `wraps`/`accepts` не называл вида ни до, ни после.
Чистый лист: страж в цепочке, `accepts |~~ … ~~| [::frame]`, который даёт ровно те же отказы (проба с видом читателя), а конструктор только строит — снимает тег над кадром.
```
$ qplay 'get [~([::trace ::set ::frame] | map ~(binding | value | get /0 | first | get /modifiers | count)) ~(::trace#[::frame[1 ~(a)]] !| expected) ~(::trace[{:failed ~(a)}] !| get [~(index) ~(expected)])]' < /dev/null
[[1 2 2] #[::vec] [0 #[::frame]]]

$ qplay ':T |~~ T. ~~| (::kind | accepts |~~ The frames. ~~| [::frame]); get [~(::T#[::frame[1 ~(a)]] !| expected) ~(::T[{:failed ~(a)}] !| get [~(index) ~(expected)])]' < /dev/null
[#[::vec] [0 #[::frame]]]

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -E "kindsExpected\(('vec'|FRAME_TAG\.name)\)" -- core/src/eval-trace.mjs
core/src/eval-trace.mjs:31:  if (!isVec(payload) || !holdsNoOtherTag(payload, TRACE_TAG.name)) throw new TracePayloadKindNotTakenError({ expected: kindsExpected('vec'), found: payload });
core/src/eval-trace.mjs:34:  if (index !== -1) throw new TraceElementKindNotTakenError({ expected: kindsExpected(FRAME_TAG.name), found: payload, index });

$ git -C D:/git/qlang-worktrees/closeout-pentimento show --format= --name-only 6e770b58 -- core/lib/qlang/frame.qlang core/lib/qlang/trace.qlang
core/lib/qlang/frame.qlang
```

### subordination · core/lib/qlang/span.qlang:35
Текст: `| wires :startOffset … /0 ::number` … `| wires :endColumn … /5 ::number` рядом с `| wires :start … ~(take 3 | tag ::point)` и `:end`.
Слой: шесть плоских имён вошли в 613197e1 вместе с легендой. D458 так и записал: «A part the kind computes, by code or a longer path, stands in no legend … and `::span` names each of its six numbers by its index … so its legend glosses each number». Проводка вида ядра подстроена под ограничение легенды, а у каждого числа появились две дороги, `start | line` и `startLine`, и двадцать узлов в манифесте.
Чистый лист: одна дорога — диапазон из двух точек или шесть имён без точек, а легенда, зависящая от вида, а не вид от неё, глоссировала бы и часть, которую вид вычисляет.
```
$ qplay '"[1\n2" | parse !| location | get [~(startLine) ~(start | line) ~(endColumn) ~(end | column) ~(::span | manifest | count)]' < /dev/null
[2 2 2 2 20]

$ qplay '::span[0 1 1 1 1 2] | legend | print | lines | get [/1 /2]' < /dev/null
["  0              |~ The offset of the start, counted from zero · startOffset ~|" "  1              |~ The line of the start, counted from one · startLine ~|"]

$ git -C D:/git/qlang-worktrees/closeout-pentimento show 72db85fd:core/lib/qlang/span.qlang | grep -c startLine
0

$ git -C D:/git/qlang-worktrees/closeout-pentimento show 613197e1:core/lib/qlang/span.qlang | grep -c startLine
4
```

### drift · core/src/runtime/sequence.mjs:226
Текст: `new KeyTakenError({ 'key/answer': named, taken })` против `'key/answer': answer` в строке 223.
Слой: часть слота `answer`, которая по главе есть «what the code of the slot answered» [QSERR#site], в `KeyAnswerKindNotTakenError` держит ответ кода ключа. В `KeyTakenError` она держит ключевое слово, под которое этот ответ лёг, хотя код ответил строкой: одно слово над двумя вещами, след плоского `:key` из второй находки.
Чистый лист: `key | answer` всегда держал бы то, что ответил код, а ключевое слово, под которое легли оба значения, было бы фактом под своим именем, прокладанным `throws`.
```
$ qplay 'get [~([{:id 1} {:id "1"}] | indexBy /id !| key | answer) ~([{:id [1]}] | indexBy /id !| key | answer)]' < /dev/null
[:"1" [1]]

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -o -E "'key/answer': [a-z]+" -- core/src/runtime/sequence.mjs
core/src/runtime/sequence.mjs:223:'key/answer': answer
core/src/runtime/sequence.mjs:226:'key/answer': named
```

### drift · core/lib/qlang/string.qlang:885
Текст: «with `:found` when a token stood there»; закон `namesTheTokenFound` (строка 915): «The refusal names the token that stood where the parser stopped».
Слой: «token» — словарь лексера, а грамматика безлексерная, и `:found` держит один символ, на котором остановилось чтение [QSSYN#refusal]. В главах то же слово называет единицы `tokenize` [QSHST#tokens] и ещё `;`, «the parser's token». Кроме того, страница описывает `ParseError` одними `:expected`/`:found`, а отказ, который пишет грамматика, держит `:message` и не держит `:expected`.
Чистый лист: «the character it met», как главы называют продолжения («any character»), и страница, которая называет `:message` рядом с `:expected` и `:found`.
```
$ qplay 'get [~("::Box#abc" | parse !| found) ~("add )" | parse !| payload | keys) ~("[(5 | add 1) 2]" | parse !| payload | keys)]' < /dev/null
["a" #[:expected :found :location :marker :origin :source :trace] #[:location :marker :message :origin :source :trace]]

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -w -i -E 'tokens?' -- core/lib docs/spec/QSSYN-grammar.md docs/spec/QSHST-hosts.md
core/lib/qlang/string.qlang:885:      what the parser wanted and where, with `:found` when a token stood
core/lib/qlang/string.qlang:915:        |~~ The refusal names the token that stood where the parser
docs/spec/QSHST-hosts.md:6:process, the cell a host keeps a value in, and the tokens the core hands
docs/spec/QSHST-hosts.md:330:## tokens
docs/spec/QSHST-hosts.md:333:its parser and the parts it keeps and no runtime, names each token of a source by
docs/spec/QSHST-hosts.md:348:a type of semantic token [QSLSP#server], the extension of the editor by
docs/spec/QSSYN-grammar.md:12:ended by `;`, the parser's token, and at most one query after them. A
```

### subordination · docs/spec/QSTXT-text.md:106
Текст: «The dialect is ECMAScript's of 2018: a group of flags and a group name written twice are refused»; на странице `regex.qlang:20` — «the one of JavaScript in its edition of 2018».
Слой: диалект regex языка определён выпуском платформы хоста, и ядро удерживает его рукописным сканером `laterEditionOf`, который отказывает в формах более поздних редакций движка. Глава и страница называют один диалект двумя словами, ECMAScript и JavaScript.
Чистый лист: глава назвала бы своими правилами формы, которые читает язык, а движок был бы реализацией за границей хоста («The host boundary» в AIM) — без даты выпуска в тексте и без имени функции про редакции.
```
$ qplay 'get [~("a(?i:b)" | toRegex !| message) ~("(?<n>a)|(?<n>b)" | toRegex !| message)]' < /dev/null
["a group of flags stands in the source; the flags are the input `flags` of `toRegex`, `toRegex \"i\"`" "the group name `n` is written twice"]

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -i -E 'edition of 2018|ECMAScript.s of|function laterEditionOf' -- core/lib core/src docs/spec
core/lib/qlang/regex.qlang:20:      The dialect is the one of JavaScript in its edition of 2018, which
core/src/regex-read.mjs:29:function laterEditionOf(source) {
docs/spec/QSTXT-text.md:106:reads text by code points as Unicode does. The dialect is ECMAScript's of
```

### archaism · core/lib/qlang/tag.qlang:19
Текст: «a tag nothing declares is a kind of identity, which checks nothing and lays itself over the value».
Слой: фраза из модели, где «A kind is declared by its page» и необъявленный тег считался видом-тождеством (a1014671). Теперь тег, который ничто не объявляет, никакого вида не называет: у него нет записи, нет страницы и нет места в `::host | kinds` [QSNAM#address].
Чистый лист: словами главы [QSLIT#tag] — тег, который ничто не объявляет, не называет вида и ложится над payload как есть.
```
$ qplay '::Nobody[1 2] | get [~(tag) ~(tag | binding !| tag) ~(::host | kinds | has ::Nobody)]' < /dev/null
[::Nobody ::any/binding/UnknownNameError false]

$ git -C D:/git/qlang-worktrees/closeout-pentimento show a1014671:core/lib/qlang/tag.qlang | grep -n -A2 'A kind is'
16:      payload under it, which ::link~(::tagged | doc) tells. A kind is
17-      declared by its page, and its tag is the address of that name; a
18-      tag nothing declares is a kind of identity, which checks nothing
```

### shim · core/src/runtime/setops.mjs:45
Текст: `const KINDS_NAMING_A_MAP_KEY = kindsExpected(...KINDS_OF_A_KEY_ALONE);`
Слой: виды ключа самого по себе вычисляются второй раз и под вторым именем рядом с тем же выражением в `path-primitives.mjs:152`. Точно так же текст ключевого слова пишут две функции, `textOf` (`convert.mjs:13`) и `writtenAsText` (`string-primitives.mjs:7`), и вторую `sequence.mjs` берёт через модуль строк.
Чистый лист: одна константа множества видов ключа рядом с `KINDS_OF_A_KEY_ALONE` в `path-read.mjs` и одна функция текста ключевого слова под `::keyword`.
```
$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -F 'kindsExpected(...KINDS_OF_A_KEY_ALONE)' -- core/src
core/src/runtime/path-primitives.mjs:152:    if (!isKeyAlone(key)) throw refusingAPart(new VecToPathElementKindNotTakenError({ 'subject/expected': kindsExpected(...KINDS_OF_A_KEY_ALONE) }), index);
core/src/runtime/setops.mjs:45:const KINDS_NAMING_A_MAP_KEY = kindsExpected(...KINDS_OF_A_KEY_ALONE);

$ qplay 'get [~({:a 1} | minus [true] !| keys | expected) ~([:a true] | toPath !| subject | expected)]' < /dev/null
[#[::keyword ::number ::string] #[::keyword ::number ::string]]

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -E 'const (textOf|writtenAsText) =' -- core/src/runtime
core/src/runtime/convert.mjs:13:const textOf = value => (isKeyword(value) || isTag(value) ? value.name : String(value));
core/src/runtime/string-primitives.mjs:7:export const writtenAsText = value => (isKeyword(value) ? value.name : value);
```

### vestige · core/src/runtime/sequence.mjs:267
Текст: `// [QSERR#site]` над `string/take` … `map/drop`; `// [QSNUM#arithmetic]` над `numberBeneath` (строка 46); головная метка из семи разделов (строка 1) над одними импортами.
Слой: метки — то, что срез комментариев до меток (c97b62ee, D418) оставил от прозы, сравнивавшей блок с чужим правилом. Поэтому они называют разделы, чьё правило блок не держит: зажим счёта — это [QSCOL#sequence] и [QSTXT#string], а инвариант стоит в цепочке как `holds :CountNotIntegerError`.
К D412, часть 3: запись говорит, что метка — заявка автора, которую никакая проверка не вычисляет; здесь три конкретные метки, которые опровергает чтение их же блоков.
Чистый лист: `// [QSCOL#sequence], [QSTXT#string]` над take/drop, `// [QSCOL#sequence]` над `numberBeneath`, а над импортами — никакой метки.
```
$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -E 'QS(ERR.site|NUM.arithmetic)' -- core/src/runtime/sequence.mjs
core/src/runtime/sequence.mjs:1:// [QSBLD#fn], [QSDSP#walk], [QSORD#order], [QSDSP#residence], [QSCOL#map], [QSTXT#string], [QSERR#site]
core/src/runtime/sequence.mjs:46:// [QSNUM#arithmetic]
core/src/runtime/sequence.mjs:267:// [QSERR#site]

$ git -C D:/git/qlang-worktrees/closeout-pentimento show c97b62ee~1:core/src/runtime/sequence.mjs | grep -n -E "invariant of its input|its subject .QSNUM"
61:// its subject [QSNUM#arithmetic], or undefined.
328:// A count is a whole number by the invariant of its input [QSERR#site]; a
```

### vestige · core/lib/qlang/set.qlang:5
Текст: в голове `set.qlang` — «every other verb reaches it through the walk as the verb of vectors, `#["b" "a"] | join ","` answering `"a,b"`»; в голове `vec.qlang:5–8` — «a verb whose answer names the vector answers under the tags of the subject … The inputs of a verb are read and held to their invariants before the verb runs».
Слой: головной комментарий источника каталога держит прозу, которую комментарии кода потеряли с D418. Он пересказывает [QSDSP#residence], [QSDSP#answer] и [QSBLD#fn] и повторяет пример закона `joinsASetInTheOneOrder`, который в комментарии не запускает никто.
К D412, часть 3: среди текстов, сохраняющих прозу рядом с метками, запись называет скрипты, грамматику и конфигурации vitest, но не головы каталога.
Чистый лист: в голове осталась бы одна строка `The rules it holds: …` [QSREQ#marks], а пример жил бы только в законе, где он исполняется.
```
$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -F '#["b" "a"] | join ","' -- core/lib
core/lib/qlang/set.qlang:5:   through the walk as the verb of vectors, `#["b" "a"] | join ","`
core/lib/qlang/vec.qlang:1934:        ~(#["b" "a"] | join "," | eq "a,b")

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -E 'answers under the tags of the subject,|held to their invariants before the verb runs' -- core/lib/qlang/vec.qlang
core/lib/qlang/vec.qlang:5:   whose answer names the vector answers under the tags of the subject,
core/lib/qlang/vec.qlang:8:   are read and held to their invariants before the verb runs.
```

### pentimento · core/lib/qlang/vec.qlang:796
Текст: «A set is searched by its one order» (то же в `vec.qlang:864`) и законы `searchesASetByItsOneOrder` у `has` и `contains`.
Слой: фраза пересказывает механизм кода — двоичный поиск `containsElement` (`sequence.mjs:276–288`), который ни один запрос не отличит от перебора. Законы под этим именем проверяют только членство, так что ни предложение, ни имя закона читатель против дерева не решит.
Чистый лист: страница говорила бы то, что решается: множество держит элемент, равный данному так, как их сравнивает `eq`, — и имя закона называло бы это правило.
```
$ qplay 'get [~(#[:qa :dev :ops] | has :ops) ~([:qa :dev :ops] | has :ops) ~([::vec/has ::vec/contains] | map ~(laws | keys | filter ~(toString | endsWith "OneOrder")))]' < /dev/null
[true true [#[:searchesASetByItsOneOrder] #[:searchesASetByItsOneOrder]]]

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -E 'searched by its one|middle = \(low \+ high\)' -- core/lib/qlang/vec.qlang core/src/runtime/sequence.mjs
core/lib/qlang/vec.qlang:796:      `[:ops] | has "ops"` answers `false`. A set is searched by its one
core/lib/qlang/vec.qlang:864:      `with {:fruit ~it} ~(["apple" "pear"] | contains fruit)`. A set is searched by its one order,
core/src/runtime/sequence.mjs:281:    const middle = (low + high) >> 1;
```

### subordination · core/lib/qlang/trace.qlang:94
Текст: «A host shows it beside a trace past the room of a fact, `:trace/failed`» (то же в строках 109 и 125).
Слой: `trace/failed`, `trace/subject` и `trace/paths` вошли в 236e4ea8 как «verbs a trace gains» ради видов алерта, потому что `reveals` называет только глагол вида. В итоге каталог держит три однострочные обёртки над кадрами ради печати хоста, и их страницы называют своего потребителя.
Чистый лист: `reveals`, который берёт код вида так же, как `wires` берёт свой селектор, и никакого глагола в каталоге ради алерта.
```
$ qplay '[::trace/failed ::trace/subject ::trace/paths] | map ~(binding | value | get /1)' < /dev/null
[~(map ~(failed)) ~(first | subject) ~(map ~(path) | filter ~(ne null))]

$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -E 'A host shows it beside a trace' -- core/lib/qlang/trace.qlang
core/lib/qlang/trace.qlang:94:      them a frame at a time. A host shows it beside a trace past the room
core/lib/qlang/trace.qlang:109:      trace. A host shows it beside a trace past the room of a fact,
core/lib/qlang/trace.qlang:125:      element tells which element. A host shows it beside a trace past the

$ git -C D:/git/qlang-worktrees/closeout-pentimento show -s --format=%s 236e4ea8 | grep -o -E 'a trace the steps that failed, the subject the step met and the paths of the parts, verbs a trace gains'
a trace the steps that failed, the subject the step met and the paths of the parts, verbs a trace gains
```

### subordination · core/lib/qlang/string.qlang:815
Текст: «It is met where `parseJson` reads JSON text, the text a host lifts for a query to start from among it».
Слой: страница отказа в ядре пересказывает поведение плейграунда, который поднимает стандартный ввод через `parseJson` [QSCLI#stdin], то есть называет потребителя и его способ.
Чистый лист: страница говорила бы только о тексте JSON, который читает `parseJson`, а то, что хост поднимает им ввод, осталось бы в главе хоста и на странице `::host`.
```
$ git -C D:/git/qlang-worktrees/closeout-pentimento grep -n -E 'host lifts for a query|lifts the text by the verb' -- core/lib docs/spec
core/lib/qlang/string.qlang:815:            reads JSON text, the text a host lifts for a query to start
docs/spec/QSCLI-the-command-line.md:87:alike. The playground lifts the text by the verb `parseJson`, run on it
```
