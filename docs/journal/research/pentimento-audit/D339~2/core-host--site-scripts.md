> A pentimento audit of core-host--site-scripts for D339 by a clean Opus answering `scripts/pentimento-audit-prompt.txt`.
> Tree `9778080c`, on the baseline `9780e1ed`; run 2026-10-30, 15:12–15:39 UTC. A path it names reads as `git show 9778080c:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### archaism · stdio/lib/qlang/stdio.qlang:229
Цитата: «A single map goes in a vector first, `get [~(it)] | table`» и на строке 236, на странице отказа `SubjectNotVecError`: «`{:name "alice"} | get [~(it)] | table`».
Слой: страница `table` и страница её отказа сохраняют форму той модели, где код в шаблоне писали квотой: D496 (ea3315f4) переписал закон `drawsAMapInAVector` на `get [it]`, а прозу оставил, и ремонт, который отказ предлагает сессии, язык сам отвергает как `::any/get/PathQuotedError` (кейс `get-refuses-a-template-part-written-as-a-quote`).
Чистый лист: обе страницы писали бы `get [it] | table`, так же как закон.
```qlang
> get [(::vec/table | doc | content | contains "get [~(it)] | table") (::vec/table/SubjectNotVecError | doc | content | contains "get [~(it)] | table") ({:name "alice"} | get [~(it)] | table !| tag) ({:name "alice"} | get [it] | table | contains "alice")] < /dev/null
[true true ::any/get/PathQuotedError true]
```
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 show ea3315f4 -- stdio/lib/qlang/stdio.qlang | grep -n -F "get [~(it)]"
35:-        ~({:name "alice"} | get [~(it)] | table | contains "alice")
```

### subordination · core/src/nouns.mjs:647
Цитата: «// [QSLSP#server], [QSLSP#offer]» над «export function shownFor(scope, name, kindNames = null) {»; то же с `isVerbBody` (core/src/chain.mjs:64, «// [QSNAM#address], [QSLSP#server], [QSNAM#declare]»).
Слой: ядро держит и экспортирует из корня две функции, которые само не вызывает ни разу; их единственный потребитель — языковой сервер, а `shownFor` заново выводит из цепочки `::fn` имена входов, которые язык и так отвечает через `inputs`.
Чистый лист: форма вызова строится в `lsp/` из ответа языка, `binding | value | inputs`, а в ядре остаются только те чтения, которыми ядро пользуется само.
Дополняет D412 (часть 1 говорит о тестах чтений инструментов в ядре) и D339 (часть 13, «the readings of the language server»): здесь назван сам код и показано, что ядро его не вызывает, а язык отвечает тот же факт сам.
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -c -w -E "isVerbBody|shownFor" -- core/src lsp/src playground/src stdio/src site/src vscode/src scripts
core/src/chain.mjs:1
core/src/index.mjs:2
core/src/nouns.mjs:1
lsp/src/features.mjs:8
```
```qlang
> get [(::vec/take | binding | value | inputs | map /name) (::vec/take | binding | name)] < /dev/null
[[:count] :vec/take]
```

### shim · lsp/src/features.mjs:58
Цитата: «const SPAN_BETWEEN_BACKQUOTES = /(?<!`)(`+)[\s\S]*?(?<!`)\1(?!`)/g;»; в QSLSP#reach то же правило: «each sign of Markdown outside a span between backquotes escaped».
Слой: hover строит Markdown страницы из её плоской печати `doc | content` и ищет спаны между обратными кавычками регексом, как будто страница по-прежнему строка markdown; у дока же проза и квоты лежат отдельными сегментами, и обратная кавычка из кода квоты в печати `content` оказывается среди прозы и сбивает пары регекса (против QSREQ#rigor: «never by a regex over the text of a print»).
Чистый лист: сервер обходит `segments` дока, экранирует каждую строку прозы и пишет каждую квоту как код.
```qlang
> |~~ see ::snippet~("a`b" | count) and `x` here ~~| | get [segments content] < /dev/null
[["see " ::snippet~("a`b" | count) " and `x` here"] "see ::snippet~(\"a`b\" | count) and `x` here"]
```
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -F -e "const SPAN_BETWEEN_BACKQUOTES" -e "markdownOfProse(await contentOfThePage" -- lsp/src/features.mjs
lsp/src/features.mjs:58:const SPAN_BETWEEN_BACKQUOTES = /(?<!`)(`+)[\s\S]*?(?<!`)\1(?!`)/g;
lsp/src/features.mjs:72:const markdownOfThePage = async address => markdownOfProse(await contentOfThePage(address));
```

### subordination · playground/src/run.mjs:12
Цитата: «return { ...cellEntry, page: await contentOfThePage(cellEntry.result, cellEntry.scopeAfterCell) };» и render.mjs:59 «const shownPage = refused ? await contentOfThePage(shown, scope) : page;».
Слой: страница отказа нужна для рисовки ответа, а `contentOfThePage` живёт в модуле запуска; run.mjs заранее считает страницу и кладёт её на запись ячейки полем `page`, которого в записи блокнота нет (QSHST#notebook: «`{ source, uri, result, defect, scopeAfterCell }`»), а render.mjs импортирует функцию из run.mjs и для отказа по бюджету считает страницу ещё раз, выбирая ветку сравнением имён тегов; правило «у вида ошибок страницы нет» записано наполовину в JS (`ERROR_KIND`), наполовину в запросе.
Чистый лист: `shownText` в render.mjs один раз читает страницу того, что показывается, а run.mjs только запускает запрос.
Дополняет D339 (часть 13, `answerText`): параметр `page` у `answerText` появился из-за этой второй дороги.
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -E "contentOfThePage|\.page|page: |ERROR_KIND" -- playground/src
playground/src/render.mjs:5:import { contentOfThePage } from './run.mjs';
playground/src/render.mjs:42:    return await shownText(shown, result, scope, cellEntry.page ?? null);
playground/src/render.mjs:59:  const shownPage = refused ? await contentOfThePage(shown, scope) : page;
playground/src/run.mjs:12:  return { ...cellEntry, page: await contentOfThePage(cellEntry.result, cellEntry.scopeAfterCell) };
playground/src/run.mjs:15:const ERROR_KIND = 'error';
playground/src/run.mjs:21:export async function contentOfThePage(failure, scope) {
playground/src/run.mjs:22:  if (failure.tag.name === ERROR_KIND) return null;
```

### shim · playground/src/render.mjs:74
Цитата: «line = line === null ? `|~| ${word}` : `${line} ${word}`;» рядом с «const COMMENT_WIDTH = 72;».
Слой: по QSPRN#print то, что хост печатает об ответе, рисует «one layer of the core, `printAnswer` and `boundAnswer`», и строку `|~| raised, …` действительно пишет ядро; но страницу под алертом playground рисует сам, вторым слоем: со своим написанием открытия строчного комментария, своей шириной 72 при `LINE_WIDTH = 80` принтера и с `oneLine`, который склеивает абзацы страницы в одну строку.
Чистый лист: один слой ядра рисует и строку подъёма, и страницу строчными комментариями, а хост только говорит, нужна ли страница.
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -F -e "const RAISED_LINE" -e "line === null ?" -e "COMMENT_WIDTH = " -e "LINE_WIDTH = " -- core/src/print-value.mjs core/src/runtime/print.mjs playground/src/render.mjs
core/src/print-value.mjs:154:export const LINE_WIDTH = 80;
core/src/runtime/print.mjs:61:const RAISED_LINE = '|~| raised, and no !| caught it';
playground/src/render.mjs:65:const COMMENT_WIDTH = 72;
playground/src/render.mjs:74:    line = line === null ? `|~| ${word}` : `${line} ${word}`;
```

### drift · playground/lib/qlang/playground.qlang:63
Цитата: «:host/labels |~~ How many kinds lie on the playground, the language's and the streams'. ~~| ::snippet~(::host | kinds | count);».
Слой: секция называется `labels`, а её страница и её запрос говорят «kinds»: секции экрана и глаголы ядра делят одно существительное `::host`, имя `kinds` уже занято глаголом `::host/kinds`, и секцию с таким именем язык отвергает.
Чистый лист: у секций экрана своё место под `::host`, и секция носит имя того, что показывает.
Дополняет D269 (правило столкновений имён хоста): здесь столкновение уже заставило хост назвать секцию чужим словом; сам дрейф labels/kinds в D339, часть 13, отмечен, а его причина — нет.
```qlang
> ::host | status | map (get [/section /page /query]) < /dev/null
[[::host/labels "How many kinds lie on the playground, the language's and the streams'." ~(::host | kinds | count)] [::host/streams "The streams the playground installs, the words of `::stdio`." ~(::stdio | manifest)]]

> get [(~(:host/kinds |~~ How many kinds. ~~| ::snippet~(::host | kinds | count);) | answer !| tag) (~(:host/count |~~ How many kinds. ~~| ::snippet~(::host | kinds | count); ::host | status | map /section) | answer)] < /dev/null
[::bind/NameDeclaredTwiceError [::host/count ::host/labels ::host/streams]]
```

### vestige · site/src/layouts/Base.astro:9
Цитата: «description = "A pipeline query language over values: a query passes its subject through steps, each answering a new value."»; другими словами то же в site/src/pages/index.astro:64 и :115, а карточки `features` (index.astro:31–37) пересказывают правила языка своими фразами.
Слой: сайт держит собственное описание языка: первая фраза первой страницы написана в нём трижды, плюс пересказ правил, хотя сайт собирается вместе с ядром (`langRuntime()` вызывается при сборке, index.astro:6).
Чистый лист: описание выводится из `::qlang | doc` и страниц глав, и ни один потребитель не несёт своего написания языка (AIM, состояние 4).
Дополняет D339 (часть 13, index.astro:32).
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -i "pipeline query language over values" -- site/src core/lib playground/lib docs/spec README.md core/README.md
core/README.md:3:A pipeline query language over values: a query starts from a subject
core/lib/qlang.qlang:7:  |~~ qlang is a pipeline query language over values. A query starts from a
site/src/layouts/Base.astro:9:  description = "A pipeline query language over values: a query passes its subject through steps, each answering a new value."
site/src/pages/index.astro:64:            A pipeline query language over values. Runs in the browser.
site/src/pages/index.astro:115:            A pipeline query language over values: a query starts from a subject and
```

### shim · lsp/src/features.mjs:329
Цитата: «const SIGNS_OF_A_FORM = { vec: 1, map: 1, set: 2, quote: 2, error: 2, group: 1 };» и на строке 348 особый случай короткой квоты `~add`.
Слой: длины знаков `[`, `{`, `#[`, `~(`, `!{` и `(` записаны в сервере ещё раз, хотя `tokenize` уже отдаёт каждый такой знак одним токеном своего вида и со своим спаном.
Чистый лист: стоит ли позиция на знаке формы, сервер узнаёт по токену `tokenize` или по частям парсера.
Дополняет D339 (часть 13, «one fact written twice … the sign of a tag»): кроме знака тега, повторно записаны знаки контейнеров, ошибки, квоты и группы.
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -E "SIGNS_OF_A_FORM = |source\[start \+ 1\]" -- lsp/src/features.mjs
lsp/src/features.mjs:329:const SIGNS_OF_A_FORM = { vec: 1, map: 1, set: 2, quote: 2, error: 2, group: 1 };
lsp/src/features.mjs:348:  const opened = kind === 'quote' && source[start + 1] !== '(' ? 1 : signs;

$ qplay --color=always '[#[1] !{:a 1} ~(add 1)]' < /dev/null | cat -v
^[[93m[^[[0m^[[92m#[^[[0m^[[33m1^[[0m^[[92m]^[[0m ^[[91m!{^[[0m^[[36m:a^[[0m ^[[33m1^[[0m^[[91m}^[[0m ^[[32m~(^[[0m^[[3;94madd^[[0m^[[3m ^[[0m^[[3;33m1^[[0m^[[32m)^[[0m^[[93m]^[[0m
```

### shim · lsp/src/features.mjs:417
Цитата: «return evalQuery(`${source.slice(start.offset, end.offset)}\n| content !| ""`);».
Слой: значение дока у сервера уже есть (`declaration?.value.get('docs')`), но чтобы получить его `content`, сервер вырезает исходный текст дока и вычисляет его заново с дописанным шагом, потому что `evalQuery` не принимает субъекта; playground для той же задачи запускает глагол на значении через `evalCell(…, { initialPipeValue })`.
Чистый лист: у хоста одна дорога к глаголу над значением, субъект ячейки, без обратного превращения значения в текст.
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -F -e '| content !| ""' -e 'initialPipeValue: failure' -- lsp/src playground/src
lsp/src/features.mjs:77:  if (!contentOfPages.has(address)) contentOfPages.set(address, tidyPage(await evalQuery(`${address} | doc | content !| ""`)));
lsp/src/features.mjs:417:    return evalQuery(`${source.slice(start.offset, end.offset)}\n| content !| ""`);
playground/src/run.mjs:23:  const explained = await (await createNotebook({ scope })).evalCell(CONTENT_OF_THE_PAGE, { initialPipeValue: failure });
```

### pentimento · docs/spec/QSHST-hosts.md:251
Цитата: «What changes the world is a verb of its host … A tag may describe an effect a host is to perform, and such a value is performed by an explicit step at the boundary, the provenance of a value a host shows being a tag over it».
Слой: это намерение для хостов, которых в дереве нет: ни один глагол хоста здесь не отдаёт «a noun that queries read» как результат изменения мира, ни один тег не описывает эффект, ни один хост не показывает происхождение значения тегом, так что читатель не может проверить эти предложения по дереву; проверка глав `spec-check/D412~1` нашла их прежнюю редакцию («a host that wants the provenance…»), а переписанная редакция по-прежнему не проверяется.
Чистый лист: раздел говорит о потоках `::stdio`, которые в дереве есть, а замысел для хостов с доменом живёт в журнале.
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -i -E "provenance|describe an effect|changes the world" -- docs/spec core/lib stdio/lib playground/lib core/src stdio/src playground/src
docs/spec/QSHST-hosts.md:251:`stdio/err print` writes a look whole. What changes the world
docs/spec/QSHST-hosts.md:257:explicit step at the boundary, the provenance of a value a host shows
```

### vestige · stdio/lib/qlang/stdio.qlang:185
Цитата: «A host of the streams keeps it under `<tmp>/qlang/<root>/cells/<id>/` … It keeps the query, `source.qlang`, the values it declared, `names.qlang`, and the answer, `answer.qlang`».
Слой: раскладку хранилища одного хоста записывают четыре текста: константы cells.mjs:13–16, страница `::cell/answer`, QSHST#cell и тест playground/test/QSHST/cell.test.mjs:26, который держит имена файлов в согласии с кодом (по AIM тест, охраняющий согласие двух написаний, — симптом).
Чистый лист: раскладка записана только в коде, страница говорит лишь, что ячейку читает `answer`, и тест читает ячейку через `answer`, а не по именам файлов.
Дополняет D339 (часть 12, один факт в нескольких местах).
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -F "names.qlang" -- stdio docs/spec core/lib playground
docs/spec/QSHST-hosts.md:309:ended by its `;`, `names.qlang`, and the answer as
playground/test/QSHST/cell.test.mjs:26:  expect(['source.qlang', 'names.qlang', 'answer.qlang'].map(name => readFileSync(join(folder, name), 'utf8').slice(0, 10))).toEqual([':number/k ', ':number/k ', '[0 1 2 3 4']);
stdio/lib/qlang/stdio.qlang:187:      declared, `names.qlang`, and the answer, `answer.qlang`, each as the
stdio/src/cells.mjs:15:const NAMES = 'names.qlang';
```

### vestige · stdio/lib/qlang/stdio.qlang:34
Цитата: «| proves :declaresTable |~~ The streams declare `table` under vectors. ~~|» и `:declaresTheStreams`.
Слой: оба закона `::stdio` проверяют только то, что источник объявил собственные имена; это проверка установки хоста, оформленная как закон, а не поведение имени (QSSLF#catalog: «how the name behaves is told by its laws»).
Чистый лист: законы `::stdio` описывают поведение потоков или отсутствуют, а установку держат тесты хоста и `manifest`.
```qlang
> ::stdio | laws | map (get /1) < /dev/null
{
  :declaresTable ~(::vec | manifest | has ::vec/table)
  :declaresTheStreams ~(::stdio | manifest | has ::stdio/out)
}
```

### drift · site/src/lib/format-example.js:38
Цитата: «.filter(l => l.type === 'prompt' || l.type === 'cont')»: все запросы блока склеиваются в один источник для `highlightQlang`.
Слой: сайт красит каждый запрос в контексте всех запросов блока, хотя QSHST#tokens пишет «each query painted with the context of its lines», а расширение красит запросы по одному; два запроса, склеенные переводом строки, язык читает как один конвейер и отвергает, так что второй запрос блока окрасился бы как `unparsed`.
Чистый лист: один читатель блока примеров, который отдаёт `tokenize` каждый запрос вместе с его строками.
Дополняет D339 (часть 13, format-example.js:29): расходится не только правило строк продолжения, но и контекст покраски.
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -F -e "l.type === 'prompt' || l.type === 'cont'" -e "each query painted with" -- site/src/lib/format-example.js docs/spec/QSHST-hosts.md
docs/spec/QSHST-hosts.md:360:query, the lines that continue it and an answer, each query painted with
site/src/lib/format-example.js:38:    .filter(l => l.type === 'prompt' || l.type === 'cont')
```
```qlang
> get [("[1 2]\ncount" | parse !| message) ("[1 2]" | parse | answer)] < /dev/null
["steps are joined by `|`, at the end of a line or at the start of the next: a line break is a space" [1 2]]
```

### drift · playground/src/repl.mjs:61
Цитата: «let wroteByOut = false;» рядом с «let didExplicitStdoutEffect = false;» (main.mjs:70) и «const recordStdoutEffect = ioContext.recordStdoutEffect ?? (() => {});» (streams.mjs:22).
Слой: один факт, «запрос написал в stdout через `stdio/out`», назван в трёх модулях тремя именами, и ни одно из них не слово главы («holds the channel»); при этом потоки по умолчанию подставляют пустую функцию, так что правило, которое страница `::stdio` подаёт как правило потоков, соблюдается только у хоста, передавшего обратный вызов.
Чистый лист: одно имя из главы, а правило канала принадлежит либо потокам (тогда без умолчания), либо хосту (тогда оно записано на его странице).
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -E "recordStdoutEffect|didExplicitStdoutEffect|wroteByOut" -- playground/src stdio/src
playground/src/main.mjs:70:  let didExplicitStdoutEffect = false;
playground/src/main.mjs:71:  const recordStdoutEffect = () => { didExplicitStdoutEffect = true; };
playground/src/main.mjs:75:    { stdinReader, stdoutWrite, stderrWrite, recordStdoutEffect },
playground/src/main.mjs:80:    didExplicitStdoutEffect,
playground/src/render.mjs:34:  const { didExplicitStdoutEffect, shouldColorize, failureExitCode = 0 } = outcomeOpts;
playground/src/render.mjs:38:    if (didExplicitStdoutEffect) return null;
playground/src/repl.mjs:61:  let wroteByOut = false;
playground/src/repl.mjs:68:      recordStdoutEffect: () => { wroteByOut = true; },
playground/src/repl.mjs:114:      wroteByOut = false;
playground/src/repl.mjs:117:      await writeCellOutcome(cellEntry, rootVerbNames, writeOutput, writeDiagnostic, wroteByOut);
playground/src/repl.mjs:123:async function writeCellOutcome(cellEntry, rootVerbNames, stdoutWrite, stderrWrite, wroteByOut) {
playground/src/repl.mjs:125:    if (wroteByOut && !isErrorValue(result)) return null;
stdio/src/streams.mjs:22:  const recordStdoutEffect = ioContext.recordStdoutEffect ?? (() => {});
stdio/src/streams.mjs:25:    'stdio/out': makeWriter(ioContext.stdoutWrite, recordStdoutEffect, StdioOutSubjectKindNotTakenError),
```
```qlang
> ::stdio | doc | content | lines | join " " | contains "holds the channel, and its answer is left unwritten" < /dev/null
true
```

### drift · playground/src/line-editor.mjs:35
Цитата: «const history = [];», затем `historyIndex`, `historyDrafts` и в справке repl.mjs:36 «the in-memory history».
Слой: прежние ячейки REPL в коде называются `history`, глава называет их «the cells submitted before», а в текстах, по которым решается, что верно, «history» означает историю репозитория и прошлое текста (QSMSR, QSWRK, QSRVW, QSVOX); выходит, что одно слово стоит над двумя вещами, а одна вещь названа двумя словами.
Чистый лист: слово главы в коде, а «history» только для истории репозитория (QSLEX#term).
Дополняет D339 (часть 13, события `line`).
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -c -w -i "history" -- docs/spec playground/src site/src/pages
docs/spec/QSMSR-the-measures.md:5
docs/spec/QSRVW-the-reviews-and-the-research.md:2
docs/spec/QSVOX-the-texts-and-their-voices.md:5
docs/spec/QSWRK-the-work.md:2
playground/src/line-editor.mjs:8
playground/src/repl.mjs:2
site/src/pages/index.astro:7

$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -F -e "the cells submitted before" -e "in-memory history" -- docs/spec playground/src
docs/spec/QSCLI-the-command-line.md:212:through the cells submitted before, each keeping the
playground/src/repl.mjs:36:                      through the in-memory history, falling back
```

### shim · playground/src/repl.mjs:18
Цитата: «const PROMPT = '\x1b[1;97mqplay\x1b[0m\x1b[1;36m>\x1b[0m ';» и line-editor.mjs:41 «prompt.replace(/\x1b\[[0-9;]*m/g, '').length».
Слой: подсказка окрашена сырыми кодами SGR в обход слоя цвета (QSCLI#colour: «a layer over the tokens of the core's `tokenize`, a colour to each kind»; в `SGR_OF_KIND` этих кодов нет), а редактор потом снимает эту окраску регексом, чтобы узнать ширину подсказки.
Чистый лист: редактор получает текст подсказки и её окраску отдельно, а цвет подсказки входит в тот же слой цвета.
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -F -e "const PROMPT" -e "promptVisibleLength =" -- playground/src
playground/src/line-editor.mjs:41:  const promptVisibleLength = prompt.replace(/\x1b\[[0-9;]*m/g, '').length;
playground/src/repl.mjs:18:const PROMPT = '\x1b[1;97mqplay\x1b[0m\x1b[1;36m>\x1b[0m ';

$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -F -e "1;97" -e "1;36" -- playground/src
playground/src/repl.mjs:18:const PROMPT = '\x1b[1;97mqplay\x1b[0m\x1b[1;36m>\x1b[0m ';
```

### pentimento · playground/src/repl.mjs:43
Цитата: «so an appended step like `| get /key` can land on the same cell as the paste» и на строке 39 «Ctrl+C              discard the current buffer and reprompt».
Слой: справка объясняет читателю, зачем нужно такое поведение, а про Ctrl+C говорит меньше главы: по главе Ctrl+C «clears the cell and the edits kept in the cells before», и код действительно очищает `historyDrafts`.
Чистый лист: справку REPL дают глава или страница `::host`, выданные командой, без доводов.
Дополняет D339 (часть 13, метакоманды REPL, repl.mjs:20).
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n -F -e "Ctrl+C" -e "historyDrafts.clear()" -e "so an appended" -- playground/src/repl.mjs playground/src/line-editor.mjs docs/spec/QSCLI-the-command-line.md
docs/spec/QSCLI-the-command-line.md:213:edits made in it until a submit or Ctrl+C, an empty cell and one that
docs/spec/QSCLI-the-command-line.md:214:repeats the cell before it never stored. Ctrl+C clears the cell and the
playground/src/line-editor.mjs:133:    historyDrafts.clear();
playground/src/line-editor.mjs:367:    historyDrafts.clear();
playground/src/repl.mjs:39:  Ctrl+C              discard the current buffer and reprompt
playground/src/repl.mjs:43:block across as many rows as the content needs, so an appended
```

### drift · playground/src/argv.mjs:14
Цитата: «`qplay [flags] '<query>'`» в сообщении об аргументе после запроса.
Слой: строка использования записана дважды и по-разному: в сообщении `[flags]`, а на странице `::host` — `qplay [--color=MODE] [--fail] '<query>'`.
Чистый лист: сообщение отсылает к странице (`qplay --help`), как уже делает `noFlag`, или берёт строку с неё.
```sh
$ qplay '1' 'x' < /dev/null 2>&1
qplay: 'x' after the query is read by nothing: the flags stand before the query, which is one argument, `qplay [flags] '<query>'`
```
```qlang
> ::host | doc | content | lines | filter (startsWith "Usage") | first < /dev/null
Usage: `qplay [--color=MODE] [--fail] '<query>'` runs a query,
```

### vestige · lsp/src/server.mjs:90
Цитата: «severity: d.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning».
Слой: до ветки предупреждения не доходит ни одна диагностика, потому что `parseDocument` пишет только `'error'`; ветка сохраняется, поскольку порог покрытия на `lsp/` не распространяется (QSGAT#gate).
Чистый лист: просто `DiagnosticSeverity.Error`, без условия.
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n "severity" -- lsp/src
lsp/src/features.mjs:99:        severity: 'error'
lsp/src/features.mjs:106:        severity: 'error'
lsp/src/server.mjs:90:    severity: d.severity === 'error'
```

### vestige · playground/src/main.mjs:13
Цитата: «if (env.NO_COLOR    && env.NO_COLOR    !== '') return false;».
Слой: второе условие не может оказаться ложным, когда истинно первое (непустая строка всегда `!== ''`), то есть это оговорка, до которой не доходит ни одна дорога (QSREQ#rigor: «a clause … that no road reaches leaves»).
Чистый лист: `if (env.NO_COLOR) return false;`.
```sh
$ git -C D:/git/qlang-worktrees/pentimento-d339 grep -n "NO_COLOR" -- playground/src/main.mjs playground/lib/qlang/playground.qlang docs/spec/QSCLI-the-command-line.md
docs/spec/QSCLI-the-command-line.md:184:holds anything but `0`, writes plain where `NO_COLOR` holds anything but
playground/lib/qlang/playground.qlang:16:      `always` and `never` whatever it is, and `NO_COLOR=1` and
playground/src/main.mjs:13:  if (env.NO_COLOR    && env.NO_COLOR    !== '') return false;
```
