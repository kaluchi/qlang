> A pentimento audit of set--vec for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `9778080c`, on the baseline `9780e1ed`; run 2026-10-30, 15:12–15:41 UTC. A path it names reads as `git show 9778080c:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### shim · core/lib/qlang/set.qlang:288
Текст: `:set/sort`, а также `:set/reverse` (`set.qlang:266`) и `:set/zip` (`set.qlang:421`), «A set keeps no order but the one order, so the answer is a vector»; в коде `registerPrimitive(['vec/sort', 'set/sort'], …)`, `['vec/reverse', 'set/reverse']` и `columnsOf` под двумя отказами, `vec/zip/…` и `set/zip/ElementKindNotTakenError`.
Слой: множество — это вектор под собственным тегом, и любой ответ метки вектора кладётся обратно в множество ([QSDSP#residence], [QSORD#set]); поэтому порядок и столбцы пришлось объявить заново, тем же примитивом под вторым адресом. А глагол векторов, вызванный по адресу на множестве, отвечает разворотом, который конструктор множества тут же отменяет.
Чистый лист: тег субъекта ложился бы обратно только на ответ из его же элементов, а порядок и столбцы были бы вектором по `returns` одного глагола; тогда `sort`, `reverse` и `zip` были бы по одному слову, без отказов-двойников.
Дополняет D339 (часть 13, «a set, a quote and a doc walking `::tagged` as a vector under a tag of its own»): цена этой модели — три переобъявленных глагола и `vec/reverse` по адресу, который ничего не разворачивает.
```
$ qplay 'get [(#[3 1 2] | reverse) (#[3 1 2] | vec/reverse) (#[3 1 2] | sort desc) (#[3 1 2] | vec/sort desc) (#[[1 1] [2 2]] | zip) (#[[1 1] [2 2]] | vec/zip)]' < /dev/null
[[3 2 1] #[1 2 3] [3 2 1] #[1 2 3] [[1 2] [1 2]] #[[1 2]]]

$ grep -n -E "registerPrimitive\(\['vec/(sort|reverse)', 'set/(sort|reverse)'\]|registerPrimitive\('(vec|set)/zip'" core/src/runtime/sequence.mjs
44:registerPrimitive('vec/zip', vectors => columnsOf(vectors, VecZipElementKindNotTakenError));
45:registerPrimitive('set/zip', vectors => columnsOf(vectors, SetZipElementKindNotTakenError));
146:registerPrimitive(['vec/sort', 'set/sort'], rankedByAKey(async (sequence, key) => {
322:registerPrimitive(['vec/reverse', 'set/reverse'], sequence => [...sequence].reverse());
```

### archaism · core/lib/qlang/trace.qlang:115
Текст: «Answers the paths of the parts the verbs of its levels ran their code on». Тот же слой стоит в `frame.qlang:10–11` («where the step ran its code on a part of its subject, the path of that part»), `frame.qlang:32`, `frame.qlang:70`, `qlang.qlang:862–863`, `qlang.qlang:893`, `QSPRN-printing-and-codecs.md:250` и в имени кейса `QSERR/trace.jsonl:49`.
Слой: это модель, где путь кадра называл только элемент, на котором глагол запустил свой код. Теперь путь называет часть, на которой шаг отказал, в том числе ту, которую он отверг сам: элемент `sum`, `zip`, `join`, `toPath`, `toMap` и свёртки алгебры ([QSERR#trace]); так уже говорит страница `::frame/path`.
Чистый лист: страницы, глава и кейс говорили бы «the paths of the parts its steps failed at», одним правилом с [QSERR#trace].
```
$ qplay 'get [([1 "x"] | sum !| trace | paths) ([[1 2] 3] | zip !| trace | paths) ("x" | add 1 !| trace | paths) (::frame/path | doc | content | contains "the part it refused itself")]' < /dev/null
[[/1] [/1] [] true]

$ grep -n -E "ran (its|their) code|ran-no-code" core/lib/qlang/trace.qlang core/lib/qlang/frame.qlang core/lib/qlang.qlang docs/spec/QSPRN-printing-and-codecs.md core/test/conformance/QSERR/trace.jsonl | cut -c1-120
core/lib/qlang/trace.qlang:115:  |~~ Answers the paths of the parts the verbs of its levels ran their code
core/lib/qlang/trace.qlang:126:        |~~ The path of the element `map` ran its code on. ~~|
core/lib/qlang/frame.qlang:32:            step that failed met, and the frame of a verb that ran its code
core/lib/qlang/frame.qlang:70:            subject the step ran its code on, and nothing past it:
core/lib/qlang/frame.qlang:103:        |~~ The frame of `map` holds the vector it ran its code over. ~~|
core/lib/qlang.qlang:893:        |~~ The frame of a verb that ran its code on an element names the
docs/spec/QSPRN-printing-and-codecs.md:250:`paths`, the paths of the parts its verbs ran their code on; the legend of
core/test/conformance/QSERR/trace.jsonl:49:{"name":"the-frame-of-a-step-that-ran-no-code-on-a-part-names-no-path","query
```

### vestige · core/lib/qlang/set.qlang:64
Текст: `:set/distinct … impl ~(it)`, «Answers the set itself, `it`, under the tags it came with»; в `QSORD-one-order.md:58` он стоит среди собственных глаголов множества: «`toSet` and `distinct` the set itself under the tags it came with».
Слой: собственный `distinct` множества остался от слоя, где `distinct` вектора под тегом отвечал без тегов (D355, replaced, снимала этот ответ). Теперь `vec/distinct` отвечает под тегами, обход даёт множеству тот же ответ, и каталог сам нарушает правило «its own verbs are those whose answer on a set is not the answer of the verb of vectors on it» (голова `set.qlang:1–3`, [QSORD#set], [QSDSP#residence]). Кроме того, «множество само» записано двумя механизмами: рецептом `~(it)` здесь и примитивом `set => set` для `set/toSet` в `convert.mjs:90`.
Чистый лист: `#[…] | distinct` доходил бы до `vec/distinct` обходом, адреса `::set/distinct` не было бы, а среди своих глаголов множества перечислялись бы только глаголы с иным ответом.
```
$ qplay 'get [(::Box#[2 1] | distinct) (::Box#[2 1] | vec/distinct) (::set/distinct | binding | value | get /1) (::set/toSet | binding | value | get /1) (::set | doc :distinct | content | contains "the set itself")]' < /dev/null
[::Box#[1 2] ::Box#[1 2] ~(it) ::builtin{:of ::set/toSet} true]

$ grep -n -E "registerPrimitive\('set/toSet'|toSet. and .distinct. the set itself" core/src/runtime/convert.mjs docs/spec/QSORD-one-order.md
core/src/runtime/convert.mjs:90:registerPrimitive('set/toSet', set => set);
docs/spec/QSORD-one-order.md:58:columns, two equal ones kept, `toSet` and `distinct` the set itself under
```

### shim · core/src/runtime/regex-primitives.mjs:39
Текст: `const engineOfText = needle => engineOf(needle.replace(SYNTAX_CHARACTERS, '\\$&'), '', 'g');`
Слой: правило [QSTXT#search] «by its code points, so no half of a pair of surrogates is found in a character» реализовано дважды. `contains`, `split`, `startsWith` и `endsWith` ищут текст вручную по суррогатам (`insideACodePoint`, `cutsACodePoint`, `wholeMatchesOf`, `string-primitives.mjs:13–40`), а `replace` превращает тот же текст в экранированный regex под флагом `u`.
Чистый лист: один поиск текста по кодовым точкам рядом со `string.qlang`, которым пользуется и `replace`.
```
$ qplay 'get [("😀" | contains "\ud83d") ("😀" | split "\ud83d") ("😀" | startsWith "\ud83d") ("😀" | replace "\ud83d" "x") ("a😀" | replace "" "-")]' < /dev/null
[false ["😀"] false "😀" "-a-😀-"]

$ grep -n -E "const engineOfText|const cutsACodePoint|const insideACodePoint|function wholeMatchesOf" core/src/runtime/regex-primitives.mjs core/src/runtime/string-primitives.mjs | cut -c1-110
core/src/runtime/regex-primitives.mjs:39:const engineOfText = needle => engineOf(needle.replace(SYNTAX_CHARACT
core/src/runtime/string-primitives.mjs:15:const insideACodePoint = (text, at) => at > 0 && at < text.length &&
core/src/runtime/string-primitives.mjs:16:const cutsACodePoint = needle => needle.length > 0 && (isLowSurrogat
core/src/runtime/string-primitives.mjs:18:function wholeMatchesOf(text, needle) {
```

### subordination · docs/spec/QSLIT-values-and-literals.md:131
Текст: «a duplicate key reads as `JSON.parse` reads it, at the boundary as in a query»; то же в `QSPRN-printing-and-codecs.md:201–202`.
Слой: правило языка о повторённом ключе сказано через функцию платформы хоста, хотя та же глава уже держит его своими словами в [QSLIT#container]: «of two entries of one key, the last value stands where the first entry stood».
Чистый лист: обе главы ссылались бы на [QSLIT#container], а `JSON.parse` оставался бы реализацией за границей хоста («The host boundary» в AIM).
```
$ qplay 'get [({"a": 1, "b": 2, "a": 3}) ({:a 1 :b 2 :a 3}) ("{\"a\": 1, \"b\": 2, \"a\": 3}" | parseJson)]' < /dev/null
[{:a 3 :b 2} {:a 3 :b 2} {:a 3 :b 2}]

$ grep -n -F 'JSON.parse' docs/spec/QSLIT-values-and-literals.md docs/spec/QSPRN-printing-and-codecs.md
docs/spec/QSLIT-values-and-literals.md:131:duplicate key reads as `JSON.parse` reads it, at the boundary as in a
docs/spec/QSPRN-printing-and-codecs.md:202:`JSON.parse` reads it.
```

### shim · core/src/runtime/regex-primitives.mjs:38
Текст: `const SYNTAX_CHARACTERS = /[\\^$.*+?()[\]{}|/]/g;`
Слой: множество синтаксических знаков regex записано трижды: здесь — для экранирования текста, в `regex-read.mjs:53` (`TAKES_AN_ESCAPE`) — для чтения лишней обратной косой черты, и прозой ремонта в `regex-read.mjs:68` (`NEEDED_ESCAPES`). Все три записи несут `/` — разделитель литерала JavaScript `/…/`; литерал `#"…"` его экранирования не требует.
Чистый лист: одна константа в `regex-read.mjs`, из которой выведены экранирование, чтение лишней косой черты и текст ремонта, без знака чужого литерала.
```
$ grep -n -F '{}|/' core/src/regex-read.mjs core/src/runtime/regex-primitives.mjs
core/src/regex-read.mjs:53:const TAKES_AN_ESCAPE = /[\p{L}\p{N}^$\\.*+?()[\]{}|/]/u;
core/src/runtime/regex-primitives.mjs:38:const SYNTAX_CHARACTERS = /[\\^$.*+?()[\]{}|/]/g;

$ grep -n -F '{ } | /' core/src/regex-read.mjs | cut -c1-120
68:const NEEDED_ESCAPES = 'a backslash stands before `^ $ \\ . * + ? ( ) [ ] { } | /`, a letter of a class such as `\\d`

$ qplay 'get [("a/b" | contains #"a/b") ("a/b" | contains #"a\/b")]' < /dev/null
[true true]
```

### shim · core/src/runtime/regex-primitives.mjs:57
Текст: `const replacement = isKeyword(written) ? written.name : written;`
Слой: «ключевое слово пишется своим именем» записано четырежды: здесь строкой внутри `replace`, в `writtenAsText` (`string-primitives.mjs:7`), в `textOf` (`convert.mjs:13`) и в `keyNameOf` (`path-read.mjs:20`).
Чистый лист: одна функция текста ключевого слова под `::keyword`, которую вызывают `append`, `prepend`, `join`, `replace`, `toString` и чтение ключа.
Дополняет D339 (часть 13, «one fact written twice … the text of a keyword»): написаний не два, а четыре; одно встроено прямо в `replace`, другое стоит в чтении ключа пути.
```
$ grep -n -E "isKeyword\([a-z]+\)( \|\| isTag\([a-z]+\))? \? [a-z]+\.name" core/src/*.mjs core/src/runtime/*.mjs
core/src/path-read.mjs:20:export const keyNameOf = key => (isKeyword(key) ? key.name : String(key));
core/src/runtime/convert.mjs:13:const textOf = value => (isKeyword(value) || isTag(value) ? value.name : String(value));
core/src/runtime/regex-primitives.mjs:57:  const replacement = isKeyword(written) ? written.name : written;
core/src/runtime/string-primitives.mjs:7:export const writtenAsText = value => (isKeyword(value) ? value.name : value);

$ qplay 'get [("x" | append :a) (["a" "b"] | join :x) ("ab" | replace "b" :c) (:a | toString)]' < /dev/null
["xa" "axb" "ac" "a"]
```

### vestige · core/lib/qlang/span.qlang:57
Текст: `| throws :EndNotReadError` со страницей «`:found` holds the refusal of the point its last numbers make» и закон `EndNotReadError/refusesThreeNumbers`.
Слой: цепочка держит страницу и узел для одного конца — из модели, где спан с меньшим числом чисел оставлял непрочитанным только конец (так говорила глава до правки после `spec-check/D412~1`). Его близнец `::span/StartNotReadError` не имеет ни страницы, ни узла и читает страницу `::span`.
Чистый лист: оба отказа одного правила стояли бы одинаково — оба со страницей и законом либо оба по странице вида.
```
$ qplay 'get [(::span[0 1] !| get [tag (doc | eq (::span | doc))]) (::span[0 1 1] !| get [tag (doc | eq (::span | doc))]) (::span | manifest | filter (toString | endsWith "NotReadError"))]' < /dev/null
[[::span/StartNotReadError true] [::span/EndNotReadError false] #[::span/EndNotReadError]]
```

### shim · core/src/runtime/convert.mjs:14
Текст: `registerPrimitive(['string/toString', 'number/toString', 'keyword/toString', 'tag/toString', 'boolean/toString'], textOf);` — без `null/toString`.
Слой: текст литерала булева значения даёт примитив через `String(value)`, а текст `null` — рецепт `~("null")` в `null.qlang`. При этом `null/toKeyword` берёт тот же текст примитивом через `String(null)`, так что одно правило «a boolean and null by their literals» ([QSCND#convert]) держится двумя механизмами.
Чистый лист: `null/toString` в том же списке адресов `textOf`, без рецепта, повторяющего литерал.
```
$ qplay 'get [(::null/toString | binding | value | get /1) (::boolean/toString | binding | value | get /1) (::null/toKeyword | binding | value | get /1) (null | toString) (null | toKeyword)]' < /dev/null
[~("null") ::builtin{:of ::boolean/toString} ::builtin{:of ::null/toKeyword} "null" :null]

$ grep -n -F "registerPrimitive(['string/toString'" core/src/runtime/convert.mjs | cut -c1-140
14:registerPrimitive(['string/toString', 'number/toString', 'keyword/toString', 'tag/toString', 'boolean/toString'], textOf);
```

### subordination · docs/spec/QSSLF-the-language-describes-itself.md:335
Текст: «The core carries the working set a shell would supply to every host, one with no shell around its queries among them, the site's playground».
Слой: состав каталога ядра обоснован одним потребителем — плейграундом сайта без оболочки — и аналогией с оболочкой. Правило, которое абзац выше уже ставит («what was inexpressible … or shortens what every host would otherwise write»), для этого не используется.
Чистый лист: раздел назвал бы, что ядро несёт, под правилом каталога, без хоста-потребителя.
```
$ grep -n -E "a shell would supply|the site.s playground" docs/spec/QSSLF-the-language-describes-itself.md
335:working set a shell would supply to every host, one with no shell around
336:its queries among them, the site's playground: the JSON codec both ways,
```

### shim · core/src/runtime/shape-primitives.mjs:51
Текст: `const MAY_WRITE_A_NUMBER = /^-?\d[\d.eE+-]*$/;` перед вызовом `numberWritten(key)`.
Слой: правило [QSPTH#shape] «a number as `toNumber` reads it» держит вторую запись алфавита числового литерала: регекс быстрого пути рядом с грамматикой, через которую `numberWritten` (`convert.mjs:38`) читает число.
Чистый лист: ключ свёртки проверялся бы одним чтением, тем же, каким `toNumber` читает текст.
```
$ grep -n -E "MAY_WRITE_A_NUMBER|import \{ numberWritten" core/src/runtime/shape-primitives.mjs
8:import { numberWritten } from './convert.mjs';
51:const MAY_WRITE_A_NUMBER = /^-?\d[\d.eE+-]*$/;
52:const writesANumber = key => MAY_WRITE_A_NUMBER.test(key) && numberWritten(key) !== null;

$ qplay 'get [({:"1e3" 1 :"2e3" 2} | shape) ("1e3" | toNumber) ({:"01" 1 :"02" 2} | shape)]' < /dev/null
[::shape::each{:"1e3" ::number} 1000 ::shape{:"01" ::number :"02" ::number}]
```

### drift · core/src/runtime/sequence.mjs:338
Текст: `async function foldOf(entries, seed, reducer)` и `function foldOf(values, pair, refusals, readsEvery, state)` в `setops.mjs:91`; `async function indexOf(sequence, key, …)` в `sequence.mjs:258`.
Слой: одно имя стоит над двумя разными функциями двух модулей — свёрткой `reduce` и свёрткой алгебры. А `indexOf`, который в JavaScript называет позицию элемента, строит отображение `indexBy` — вопреки [QSLEX#grep], где имена кода «chosen for the grep».
Чистый лист: у каждой свёртки своё имя по тому, что она делает, а имя построителя индекса — от `indexBy`.
```
$ grep -n -E "^(async )?function (foldOf|indexOf)\b" core/src/runtime/sequence.mjs core/src/runtime/setops.mjs
core/src/runtime/sequence.mjs:258:async function indexOf(sequence, key, KeyAnswerKindNotTakenError, KeyTakenError) {
core/src/runtime/sequence.mjs:338:async function foldOf(entries, seed, reducer) {
core/src/runtime/setops.mjs:91:function foldOf(values, pair, refusals, readsEvery, state) {
```

### subordination · core/lib/qlang/tagged.qlang:39
Текст: `| proves :readsAsAConstructStep`, «The step `::Box[1 2]` is a `::construct`.»
Слой: закон о записи шага разбора стоит под существительным глаголов значений под тегом, хотя у `::construct` есть свой закон `holdsTheTagAndThePayload`, который читает тот же первый шаг той же цитаты.
Чистый лист: факт о записи шага — один закон под `::construct`.
```
$ qplay 'get [(::tagged | laws | keys) (::tagged | laws | get /readsAsAConstructStep | last) (::construct | laws | get /holdsTheTagAndThePayload | last)]' < /dev/null
[[:reachesPayload :readsAsAConstructStep] ~(~(::Box[1 2]) | first | tag | eq ::construct) ~(~(::Box[1 2]) | first | get [/tag /payload] | eq [::Box [1 2]])]
```

### shim · core/src/runtime/setops.mjs:52
Текст: `if (at === undefined) throw new KeyRefusal({ 'keys/expected': KINDS_NAMING_A_MAP_KEY, 'keys/index': index });`
Слой: одна функция `keyNamesOf` выбирает форму отказа по флагу — по отсутствию аргумента `at`. Для `minus`/`inter` отображения отказ ставится под вход `keys` со своим индексом, для свёртки вектора — под субъект с путём кадра.
Чистый лист: вызывающий передавал бы отказ своей роли сам, и флага не было бы.
```
$ grep -n -F "at === undefined" core/src/runtime/setops.mjs
52:    if (at === undefined) throw new KeyRefusal({ 'keys/expected': KINDS_NAMING_A_MAP_KEY, 'keys/index': index });

$ qplay 'get [({:a 1} | minus [true] !| get [tag (keys | index)]) ([{:a 1} [true]] | minus !| get [tag (trace | last | path)])]' < /dev/null
[[::map/minus/KeysElementKindNotTakenError 0] [::vec/minus/KeyKindNotTakenError /1/0]]
```

### pentimento · core/lib/qlang/snippet.qlang:12
Текст: «A snippet answers whatever it shows, a failure among them, since it reproduces a situation for its reader».
Слой: придаточное «since it reproduces a situation for its reader» — обоснование, которое ни один читатель не решит против дерева.
Чистый лист: «A snippet answers what its code answers, a failure among them» — это и держит закон `answersWhatItShows`.
```
$ qplay '::snippet | doc | content | lines | join " " | contains "since it reproduces a situation for its reader"' < /dev/null
true
```

### pentimento · core/lib/qlang/vec.qlang:1782
Текст: «`desc` turns the key, or one index of it, to descend, as `ORDER BY score DESC, name` reads»; на странице `every` (`vec.qlang:483`): «the question a law asks of a listing».
Слой: страница сравнивает правило с SQL, которого дерево не держит, и говорит читателю о применении глагола, которое проба не решает.
Чистый лист: страница показывала бы ключ-вектор и `desc` запросом, который отвечает, — как уже делает следующий за этой фразой пример.
```
$ qplay 'get [(::vec/sort | doc | content | contains "as `ORDER BY score DESC, name` reads") (::vec/every | doc | content | contains "the question a law asks of a listing")]' < /dev/null
[true true]
```

### drift · docs/spec/QSHST-hosts.md:127
Текст: «no mark a host read reaches the core» — о знаке порядка байтов, в том же разделе, где строками выше `readingState` назван «the mark the root of the package hands it», а входы кода — «the marks of the inputs a primitive runs as code».
Слой: в одном разделе одно слово стоит над двумя вещами, и фразу о знаке порядка байтов можно прочесть как сказанную о пометках примитивов.
Чистый лист: «byte order mark» полностью везде, где речь о нём, а для пометки примитива — слово одного смысла.
```
$ grep -n -w -E "marks?" docs/spec/QSHST-hosts.md | cut -c1-110
107:takes the values alone; a host marks its own so by `readingState`, the
108:mark the root of the package hands it, while the marks of the inputs a
124:`TextDecoder`, the decode the text of a response runs: a byte order mark
127:host and no mark a host read reaches the core; the bundle of the site reads
128:its sources by the loader `text` of esbuild, which drops the mark alike.
129:A string that holds the mark holds the character, which the grammar reads
```

### vestige · docs/spec/QSCLI-the-command-line.md:28
Текст: «`playground/src/bin.mjs` is the one file of the playground that touches the process»; то же правило записано в `QSGAT-the-repository-and-its-gate.md:56`.
Слой: одно правило записано в разделах двух глав, так что цитата не может назвать его одним `[QS…#…]`.
Чистый лист: правило стоит в одном разделе, а другой ссылается на него.
```
$ grep -n -E "is the one file$|^of the playground that touches|is the one file of the playground" docs/spec/QSCLI-the-command-line.md docs/spec/QSGAT-the-repository-and-its-gate.md
docs/spec/QSCLI-the-command-line.md:28:`-V` or `--version` the version. `playground/src/bin.mjs` is the one file
docs/spec/QSCLI-the-command-line.md:29:of the playground that touches the process.
docs/spec/QSGAT-the-repository-and-its-gate.md:56:`playground/src/bin.mjs` is the one file of the playground that touches
```
