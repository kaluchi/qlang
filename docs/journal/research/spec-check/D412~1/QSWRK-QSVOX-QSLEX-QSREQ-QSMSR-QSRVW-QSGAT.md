> A check of the chapters `QSWRK`, `QSVOX`, `QSLEX`, `QSREQ`, `QSMSR`, `QSRVW`, `QSGAT` for D412 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `09767318`, on the baseline `6285e02c`; run 2026-10-28, 23:30–23:59 UTC. A path it names reads as `git show 09767318:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qplay`, `grep` and `git ls-files` allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.
> At the effort `max`, set by `CLAUDE_CODE_EFFORT_LEVEL` in the environment of its start, which no flag and no settings file overrides.

### implementation · scripts/benchmark/sets.mjs:88

QSMSR#benchmark: «it runs the playground on the tasks of a set, handed one first screen». Промпт, который `run` отдаёт каждому ребёнку, требует «run `qplay`» и тут же показывает форму запроса `qlang '<query>' < file.json`. Строкой ниже стоит «do not end it with `| json` or `| out`».

```sh
$ git grep -n -F "< file.json" -- scripts/benchmark/sets.mjs
scripts/benchmark/sets.mjs:88:    'RULES: use the Bash tool only to run `qplay` and to `cat` or `head` the data files of the current directory; read nothing else. A query over a data file reads it from stdin: `qlang \'<query>\' < file.json`, a text file alike, `qlang \'<query>\' < file.log`.',

$ git grep -n -F "COMMAND_LINE_TOOLS =" -- scripts/benchmark/child.mjs
scripts/benchmark/child.mjs:15:const COMMAND_LINE_TOOLS = ['Bash(qplay:*)', 'Bash(MSYS_NO_PATHCONV=1 qplay:*)', 'Bash(cat:*)', 'Bash(head:*)'];

$ git grep -n -F "\"qplay\":" -- playground/package.json
playground/package.json:7:    "qplay": "src/bin.mjs"
```

```qlang
> "hi" | out !| get [~(tag) ~(addresses)]
[::call/KindAnswersNoVerbError #[::stdio/out]]
```

Глава говорит, что ребёнок запускает playground, а образец вызова в промпте замера — команда `qlang`. Её нет ни в разрешённых инструментах ребёнка, ни в пакете, ни в PATH: `withTheLanguageOf` кладёт туда только `qplay`. Голое `out` язык отклоняет, он знает только адрес `stdio/out`. Вопрос: какой вызов должен показывать промпт, чтобы его RULES, `COMMAND_LINE_TOOLS` и команда пакета называли одно и то же?

### conflict · scripts/retired-words.mjs:107

Запись D442 велит вместо `actualType` писать «`:actualTag`». Запись D467 в том же лексиконе отклоняет `actualTag`. Проверка печатает `written` автору как то, что надо написать.

```sh
$ git grep -n -E "by: 'D(442|452|467)'" -- scripts/retired-words.mjs
scripts/retired-words.mjs:106:  { regex: /\btypeOf\b/, written: 'the tag of a value, the tag `tag` answers, `tagOf`', by: 'D442' },
scripts/retired-words.mjs:107:  { regex: /\b(?:actual|left|right)Type\b/, written: 'the tag a fact of a refusal names, `:actualTag`, and the tags two values part at, `:leftTag` and `:rightTag`', by: 'D442' },
scripts/retired-words.mjs:110:  { regex: /`explain`|\|\s*explain\b|\bany\/explain\b|::explanation\b/, written: 'the page of a value, of an error at rest the page of the refusal it carries, `doc`', by: 'D452' },
scripts/retired-words.mjs:113:  { regex: /\bactual(?:Tag|Value)\b|\brefusingTheSubject\b/, written: 'the value the rule of a refusal met, `found`, its kind `found | tag`', by: 'D467' },

$ git grep -n -F "retired: write" -- scripts/conventions-verdict.mjs
scripts/conventions-verdict.mjs:51:  retired: found => section('Words the language retired', found, ({ file, line, word, written, by }) => `  ${file}:${line}  \`${word}\`, which ${by} retired: write ${written}\n`,
```

```qlang
> "x" | add 1 !| payload | keys
#[:subject/expected :subject/found :trace]
```

Две записи одного лексикона (QSLEX#term) задают противоположные правила для слова `actualTag`: одна его предписывает, другая отклоняет. В дереве такого факта нет.

### implementation · scripts/gate-diff.mjs:32

QSREQ#target говорит, что копия diff с master «lists every move it made on the requirements and the gates, which the review reads first». QSREQ#cases называет раннер: «`core/test/unit/QSREQ/cases.test.mjs`». В списке GATES раннер записан под путём, которого нет.

```sh
$ git grep -n -F "conformance\.test\.mjs" -- scripts/gate-diff.mjs
scripts/gate-diff.mjs:32:  /^core\/test\/unit\/conformance\.test\.mjs$/,

$ git grep -n -F "RUNNER_OF_THE_CASES =" -- scripts/dossier.mjs
scripts/dossier.mjs:24:const RUNNER_OF_THE_CASES = 'core/test/unit/QSREQ/cases.test.mjs';

$ git -C D:/git/qlang-worktrees/closeout-spec ls-files --error-unmatch core/test/unit/conformance.test.mjs core/test/unit/QSREQ/cases.test.mjs
error: pathspec 'core/test/unit/conformance.test.mjs' did not match any file(s) known to git
core/test/unit/QSREQ/cases.test.mjs
Did you forget to 'git add'?
```

`dossier.mjs` и глава называют настоящий раннер, а gate-diff — несуществующий файл. Правка раннера попадает в «other files changed», а не в «gate touched». Вопрос: должен ли gate-diff считать воротами тот раннер, который называет QSREQ#cases?

### conflict · CLAUDE.md:118

«`npm test`: every workspace's suite, the inner loop [QSREQ#rigor]».

```sh
$ git grep -n -E "inner loop" -- CLAUDE.md docs/spec
CLAUDE.md:118:- `npm test`: every workspace's suite, the inner loop [QSREQ#rigor].
docs/spec/QSREQ-the-requirements.md:208:The inner loop runs the tests of the topic; a commit runs `npm test`, and
```

Seed называет внутренним циклом `npm test`. Раздел, на который он ссылается, называет внутренним циклом тесты темы, а `npm test` относит к коммиту.

### design · QSREQ#marks

QSREQ#marks: «a citation written in backquotes is the example of a mark, and one in a string of the code … names nothing». `marks.mjs` так и читает: через `comments.mjs`. Но сверка («a citation in the code and the tests of a record out of force», QSWRK#reconciliation), счётчик desk «lines of code that cite them» и растворение читают и переписывают `[Dnn]` регэкспом по всему тексту файла, со строками и примерами в обратных кавычках.

```sh
$ git grep -n -F "citationsIn(readText(" -- scripts
scripts/desk.mjs:74:  .map(file => new Set(citationsIn(readText(join(root, file))).filter(({ name }) => transit.has(name)).map(({ line }) => line)).size)
scripts/reconciliation.mjs:159:    for (const { name, line } of citationsIn(readText(join(repoRoot, file)))) {
scripts/reconciliation.mjs:178:    for (const { name, line } of citationsIn(readText(join(repoRoot, file)))) {

$ git grep -n -F "const commentsOfLines" -- scripts/marks.mjs
scripts/marks.mjs:48:const commentsOfLines = (text, path) => linesOfComments(path, text).map(({ names }) => names);

$ git grep -n -F "replaceAll(" -- scripts/dissolve-records.mjs
scripts/dissolve-records.mjs:52:  return citedOnce(lines.join('\n').replaceAll(`[${name}]`, `[${section}]`), section);

$ git grep -n -F "[D404]" -- scripts/test-homes.mjs core/test/unit/QSREQ/marks.test.mjs
core/test/unit/QSREQ/marks.test.mjs:45:    const text = titled('[QSCLI#answer] reads -h', 'reads -h [QSCLI]', 'reads a nest [D404]', 'reads -h as the page');
core/test/unit/QSREQ/marks.test.mjs:47:      [1, 'cites [QSCLI#answer] in its title, which its path names'], [2, 'cites [QSCLI] in its title, which its path names'], [3, 'cites [D404] in its title, which its path names']]);
scripts/test-homes.mjs:120:// A rule cited in a title, `[QSCLI#answer]` or `[D404]`.
```

Два пути по-разному отвечают на вопрос, какие строки цитируют запись. Для D404 марки не видят ни одной из трёх строк, а сверка и desk видят все три. Растворение или слияние такой записи переписали бы данные теста и пример. Вопрос: какое прочтение цитаты должны брать сверка, desk, `dissolve-records.mjs` и `merge-records.mjs`, чтобы совпасть с `marks.mjs`?

### implementation · scripts/spec-check-prompt.txt:9

QSRVW#audits: проверка глав держит их согласие «with the implementation». Шаг 2 промпта ищет цитаты «under {{repo}}/core, cli, lsp and scripts». Папки `cli` нет, а код playground цитирует разделы.

```sh
$ git grep -n -F "core, cli, lsp and scripts" -- scripts
scripts/spec-check-prompt.txt:9:2. The code that cites it: Grep for the text `[CODE#name]` under {{repo}}/core, cli, lsp and scripts, and read each block that cites it.

$ git -C D:/git/qlang-worktrees/closeout-spec ls-files --error-unmatch cli playground/src/bin.mjs stdio/src/streams.mjs
error: pathspec 'cli' did not match any file(s) known to git
playground/src/bin.mjs
stdio/src/streams.mjs
Did you forget to 'git add'?

$ git grep -l -F "[QSCLI#" -- playground stdio
playground/lib/qlang/playground.qlang
playground/src/argv.mjs
playground/src/highlight-ansi.mjs
playground/src/line-editor.mjs
playground/src/main.mjs
playground/src/render.mjs
playground/src/repl.mjs
playground/src/run.mjs
playground/src/stdin.mjs
playground/test/QSERR/print.test.mjs
playground/test/helpers/main-streams.mjs
playground/test/helpers/run-cli.mjs
playground/test/helpers/scripted-repl.mjs

$ git grep -n -F "under core/src, stdio/src, playground/src and lsp/src" -- scripts
scripts/design-check-prompt.txt:10:3. The implementation: the code a road touches under core/src, stdio/src, playground/src and lsp/src, found by Grep, and every caller of what it changes.
```

Промпт проверки глав не ищет цитаты в коде playground и stdio, хотя промпт критики уже их называет. Вопрос: в каких папках проверка глав должна искать код, который цитирует раздел?

### conflict · QSWRK#stint

QSWRK#stint: «the work of a record writes no record of a question of its own beside it». QSWRK#journal: «A question of its own is a record of its own».

```sh
$ git grep -n -F "question of its own" -- docs/spec CLAUDE.md
docs/spec/QSWRK-the-work.md:50:of a record writes no record of a question of its own beside it. A landing in
docs/spec/QSWRK-the-work.md:124:question of its own is a record of its own. `node scripts/requirements.mjs`

$ git grep -n -F "opened since the baseline" -- docs/spec scripts/reconciliation.mjs
docs/spec/QSWRK-the-work.md:226:- a record opened since the baseline that is still open, a question the
scripts/reconciliation.mjs:154:    reconciled.violations.push({ where: `${JOURNAL}/${name}.md`, problem: `opened since the baseline ${baseline} and still open: the stint that raised the question decides it before it lands, asking the maintainer where the choice is his` });
```

Два раздела одной главы дают противоположные правила о том, получает ли вопрос, поднятый работой, свою запись. Сверка при этом исходит из того, что внутри стинта записи открываются.

### implementation · CLAUDE.md:100

QSVOX#seed: «It names the sections it points to and restates none of them, so a rule changes in its section alone». CLAUDE.md:6 сам пишет «It restates no rule». При этом CLAUDE.md повторяет правила QSGAT#workspaces и QSWRK#journal. Ещё он держит правила, которых нет ни в одном разделе, и обращается к читателю: «the screen you run is the truth».

```sh
$ git grep -n -F "dependency at runtime and no" -- CLAUDE.md docs/spec
CLAUDE.md:142:dependency at runtime and no `node:*` import under `core/src/`; `stdio/` the
docs/spec/QSGAT-the-repository-and-its-gate.md:15:JavaScript with no dependency at runtime and no `node:*` import under

$ git grep -n -F "quoted words bind a session" -- CLAUDE.md docs/spec
CLAUDE.md:100:Only the maintainer's quoted words bind a session; a record the model
docs/spec/QSWRK-the-work.md:108:Only the maintainer's quoted words bind a session. A record the model

$ git grep -n -E "token cap|never .cat|next-step|no retelling" -- docs/spec CLAUDE.md
CLAUDE.md:35:with the file-reading tool: a read the tool cut at its token cap did not
CLAUDE.md:37:session read. A large file is never `cat`-ed.
CLAUDE.md:108:questions the tree cannot answer; no retelling, no tables unless asked, no
CLAUDE.md:109:next-step pitches. Verify before asserting: any claim about behaviour is run
```

Seed и правило QSVOX#seed расходятся: одни правила seed пересказывает, другие держит только у себя. Вопрос: в каком разделе должны жить правила чтения и формы ответа, чтобы правило менялось только в своём разделе?

### conflict · core/README.md:18

Страница пакета пишет: «`env | keys` lists the names a query declared, `kinds` the labels the scope reads». В строке 79 она даёт пример `declareRefusal('any/out/SubjectKindNotTakenError')`. Главы пишут `::host | env` (QSNAM#binding), `::host | kinds` (QSNAM#root) и `stdio/out` (QSHST#effect).

```qlang
> env | keys !| get [~(tag) ~(addresses)]
[::call/KindAnswersNoVerbError #[::host/env]]

> get [~(kinds !| get [~(tag) ~(addresses)]) ~(::host | kinds | has ::vec) ~(::any/out/SubjectKindNotTakenError | binding !| tag) ~(::stdio/out | manifest | has ::stdio/out/SubjectKindNotTakenError)]
[[::call/KindAnswersNoVerbError #[::host/kinds]] true ::any/binding/UnknownNameError true]
```

QSVOX#seed называет этот файл «the embedding interface». Seed даёт формы, которые язык отклоняет, и адрес, которого нет, а главы дают рабочие.

### implementation · QSREQ#rigor

«a script reads a module of JavaScript by its parser, acorn, never by a regex over its text». Это правило нарушают три места:
- `check-conventions.mjs:799` читает заголовки тестов регэкспом, хотя `test-homes.mjs` читает их acorn;
- `grep-ergonomics.mjs:36` регэкспом читает экспорты `core/src` для `vocabulary.mjs --exports`;
- `root-exports.mjs` читает модули через espree, которого нет ни в одном package.json.

```sh
$ git grep -n -E "^const (EXPORTED|TEST_TITLE) =|^import \{ parse \} from 'espree'" -- scripts
scripts/check-conventions.mjs:799:const TEST_TITLE = /\b(?:it|test|describe)(?:\.\w+)?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
scripts/grep-ergonomics.mjs:36:const EXPORTED = /^export (?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm;
scripts/root-exports.mjs:7:import { parse } from 'espree';

$ git grep -n -F "from 'acorn'" -- scripts
scripts/check-conventions.mjs:155:import { parse } from 'acorn';
scripts/comments.mjs:10:import { parse as parseJavaScript } from 'acorn';
scripts/core-imports.mjs:10:import { parse } from 'acorn';
scripts/import-reach.mjs:12:import { parse } from 'acorn';
scripts/pentimento-audit.mjs:26:import { parse as parseJavaScript } from 'acorn';
scripts/test-homes.mjs:14:import { parse } from 'acorn';

$ git grep -n -E "\"(espree|acorn)\"" -- package.json core/package.json stdio/package.json playground/package.json lsp/package.json site/package.json vscode/package.json
package.json:39:    "acorn": "^8.19.0",
```

Заголовки одних и тех же тестов читаются двумя путями: регэкспом и парсером. Вопрос: каким путём скрипты должны читать заголовки тестов и экспорты модулей, чтобы совпасть с правилом раздела?

### implementation · QSLEX#term

«The tests of the lexicon show each entry by the spellings it refuses … every entry refusing a sample». У четырёх записей лексикона нет ни одного образца в `core/test/unit/QSLEX/term.test.mjs`: D442 `typeOf`, D442 `actual|left|rightType`, D452 `explain`, D467 `actualTag`. Их строки показаны во второй находке выше.

```sh
$ git grep -c -E "typeOf|explain|actualTag|refusingTheSubject|leftType" -- scripts/retired-words.mjs core/test/unit/QSLEX/term.test.mjs
scripts/retired-words.mjs:4
```

Лексикон и его тесты расходятся с разделом. Вопрос: какие написания должны отказывать тесты, чтобы каждая из этих записей показывалась образцом?

### implementation · QSLEX#code

«A comment of the sources and the tests of the core … is a mark alone … so no comment says again what a section states». Грамматика `core/src/grammar.peggy` — модуль ядра (QSGAT#imports: «the parser…»), но её комментарии пересказывают QSSYN#step прозой. Проверка (22) читает только `*.mjs`.

```sh
$ git grep -n -F "A text is its declarations, each ended" -- core/src/grammar.peggy
core/src/grammar.peggy:3:// A text is its declarations, each ended by `;`, and at most one query after

$ git grep -n -F "MARKED_SOURCES.flatMap" -- scripts/check-conventions.mjs
scripts/check-conventions.mjs:908:  const files = execFileSync('git', ['ls-files', ...MARKED_SOURCES.flatMap(dir => [`${dir}/*.mjs`, `${dir}/**/*.mjs`])], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean);
```

Правило сказано о всех источниках ядра, а проза грамматики и граница проверки с ним расходятся. Вопрос: распространяется ли правило «a mark alone» на грамматику, и если да, что читает её комментарии?

### implementation · QSLEX#grep

«the primitives of a noun stand in `core/src/runtime/<noun>-primitives.mjs` beside its page, `core/lib/qlang/<noun>.qlang`». Примитивы `::number` лежат в `arith.mjs`, примитивы `::vec` — в `sequence.mjs`.

```sh
$ git grep -n -E "registerPrimitive\('(number/add|vec/count)'" -- core/src/runtime
core/src/runtime/arith.mjs:7:registerPrimitive('number/add', asCombiner((augend, addend) => augend + addend));
core/src/runtime/sequence.mjs:19:registerPrimitive('vec/count', sequence => sequence.length);

$ git -C D:/git/qlang-worktrees/closeout-spec ls-files --error-unmatch core/src/runtime/number-primitives.mjs core/src/runtime/vec-primitives.mjs core/src/runtime/doc-primitives.mjs
error: pathspec 'core/src/runtime/number-primitives.mjs' did not match any file(s) known to git
error: pathspec 'core/src/runtime/vec-primitives.mjs' did not match any file(s) known to git
core/src/runtime/doc-primitives.mjs
Did you forget to 'git add'?
```

Раздел описывает раскладку модулей по существительным, а дерево следует ей только для части существительных. Вопрос: где по раскладке раздела стоят примитивы `number` и `vec`?

### drift · QSLEX#grep

«The session names the conversation of a model alone … and a notebook the cells a host runs over one scope». Одну вещь — ноутбук ячеек, который ведёт хост, — тексты называют двумя словами:
- notebook: QSCLI#repl, QSHST#notebook, playground/README.md;
- session: страница `::host` у playground, `::host/env`, глава `::qlang/names`.

```sh
$ git grep -n -E "opens a (notebook|session)" -- playground docs/spec
playground/README.md:55:`qplay -i` opens a notebook whose cells share the names they declare;
playground/lib/qlang/playground.qlang:12:      `qplay -i ['<query>']` opens a session of cells, the query its first,
```

```qlang
> get [~(::host/env | doc | content | contains "session before it") ~(::host | doc | content | contains "opens a session of cells") ~(::qlang/names | doc | content | contains "a cell of a session")]
[true true true]
```

Читатель примет «session of cells» и «notebook» за две разные вещи. При этом раздел оставляет слово «session» только за разговором модели.

### conflict · QSWRK#stint

QSWRK#stint: «Code is committed on its branch, never on master … Nothing in a stint switches the branch of the checkout, merges or writes to master but its closeout». QSGAT#release: «the commit of a release lands on master directly». `release.mjs` требует, чтобы checkout стоял на master.

```sh
$ git grep -n -E "never on master|lands on master directly|or writes to" -- docs/spec
docs/spec/QSGAT-the-repository-and-its-gate.md:122:lands on master directly.
docs/spec/QSWRK-the-work.md:25:it shows when it lands. Code is committed on its branch, never on master.
docs/spec/QSWRK-the-work.md:30:Nothing in a stint switches the branch of the checkout, merges or writes to

$ git grep -n -E "must be on master|git commit -m|git push origin master" -- scripts/release.mjs
scripts/release.mjs:12://   • must be on master
scripts/release.mjs:123:if (branch !== 'master') fail(`must be on master, got ${branch}`);
scripts/release.mjs:252:run(`git commit -m "Release ${version}"`);
scripts/release.mjs:258:run('git push origin master');
```

Две главы по-разному отвечают, что кроме закрытия пишет в master. Стинт идёт от одного закрытия до другого, и релиз попадает внутрь этого промежутка.

### text · QSMSR#benchmark

«Each task keeps a reference, the shortest query the tree answers it with, `scripts/benchmark/tasks.mjs`». В том же разделе задачи набора пишет чистый автор, и ответы к ним считает скрипт («the data, the tasks and a script that computes the answers»). У задач наборов reference нет.

```sh
$ git grep -c -E "reference|\"expected\"" -- scripts/benchmark/tasks.mjs scripts/benchmark/sets/W/tasks.json scripts/benchmark/sets/Y/tasks.json
scripts/benchmark/sets/W/tasks.json:14
scripts/benchmark/sets/Y/tasks.json:14
scripts/benchmark/tasks.mjs:24

$ git grep -c -F "reference" -- scripts/benchmark/sets/W/tasks.json scripts/benchmark/sets/Y/tasks.json scripts/benchmark/tasks.mjs
scripts/benchmark/tasks.mjs:24
```

«Each task» охватывает и задачи наборов, о которых раздел только что сказал, а reference держат только задачи `tasks.mjs`.

### implementation · QSVOX#folders

«the research under `research/` [QSRVW#research], each folder of it with a README that says what it holds». «it» можно прочесть и как research, и как журнал. При любом прочтении одной папке README не хватает.

```sh
$ git -C D:/git/qlang-worktrees/closeout-spec ls-files --error-unmatch docs/journal/research/prior-art/README.md docs/journal/replaced/README.md docs/journal/research/design-check/README.md
error: pathspec 'docs/journal/research/prior-art/README.md' did not match any file(s) known to git
error: pathspec 'docs/journal/replaced/README.md' did not match any file(s) known to git
docs/journal/research/design-check/README.md
Did you forget to 'git add'?
```

У `research/prior-art/` и у `replaced/` нет README, которого требует раздел. Вопрос: каким папкам журнала раздел требует README?

### implementation · QSVOX#folders

«A sensor that reads the transcripts says which directories it read and how many transcripts each gave». Транскрипты читают шесть сенсоров (включая общий модуль `transcripts.mjs`), а говорят, что прочли, только два.

```sh
$ git grep -l -F "recordsOf(" -- scripts/sensors
scripts/sensors/check-quotes.mjs
scripts/sensors/context-inventory.mjs
scripts/sensors/maintainer-messages.mjs
scripts/sensors/read-coverage.mjs
scripts/sensors/transcript-tail.mjs
scripts/sensors/transcripts.mjs

$ git grep -l -F "transcriptCoverage()" -- scripts/sensors
scripts/sensors/check-quotes.mjs
scripts/sensors/maintainer-messages.mjs
scripts/sensors/transcripts.mjs
```

`context-inventory.mjs`, `read-coverage.mjs` и `transcript-tail.mjs` читают транскрипты и не называют прочитанные каталоги. Вопрос: относится ли правило к сенсору, который читает транскрипт одной сессии?

### implementation · QSWRK#reconciliation

«`check:conventions` fails on what it finds and `npm run desk` shows it. It refuses: … a series of the benchmark past its two latest at the baseline».

```sh
$ git grep -n -F "seriesPastTheirTwoLatest" -- scripts
scripts/check-conventions.mjs:143:import { baselineOf, citableOf, isCitingCode, reconciliationOf, recordsInTransit, reportsWithoutReading, seriesPastTheirTwoLatest, waitsForTheCloseout, CITING_DOCUMENTS, WORK_CHAPTERS } from './reconciliation.mjs';
scripts/check-conventions.mjs:665:  return baseline === undefined ? [] : seriesPastTheirTwoLatest(repoRoot, baseline).map(series => ({ ...series, baseline }));
scripts/drop-documents.mjs:16:import { isReadme, recordHolding, seriesPastTheirTwoLatest, textsInForce, unitOf, uncitedDocuments } from './reconciliation.mjs';
scripts/drop-documents.mjs:23:const older = named === null ? seriesPastTheirTwoLatest(repoRoot).flatMap(series => series.older) : [];
scripts/reconciliation.mjs:474:// seriesPastTheirTwoLatest(repoRoot, revision) → each series that holds
scripts/reconciliation.mjs:479:export function seriesPastTheirTwoLatest(repoRoot, revision) {

$ git grep -n -E "reconciliationOf\(|seriesPast" -- scripts/desk.mjs
scripts/desk.mjs:38:const reconciled = reconciliationOf(root);
```

Desk показывает только `reconciliationOf`, а серии сверяет одна проверка (14). Поэтому этот пункт сверки desk не показывает. Вопрос: должен ли desk показывать всё, что раздел относит к сверке?

### conflict · QSWRK#closeout

QSWRK#closeout: «An outside audit runs on a tree a closeout landed [QSRVW#audits]». QSRVW#audits говорит только «read the tree at HEAD», а QSRVW#readers — «best on master after a branch landed». `outside-audit.mjs` отказывает лишь дереву с незакоммиченными правками.

```sh
$ git grep -n -E "^> Tree" -- docs/journal/research/outside-audit
docs/journal/research/outside-audit/D327~1.md:2:> Tree `6c2b377c`, on the baseline `6faa5883`; run 2026-10-16, 01:30–01:39 UTC. A path it names reads as `git show 6c2b377c:<path>`.
docs/journal/research/outside-audit/D353~1.md:2:> Tree `aa7019da`, itself the baseline; run 2026-10-20, 20:29–20:39 UTC. A path it names reads as `git show aa7019da:<path>`.
docs/journal/research/outside-audit/D395~1.md:2:> Tree `22ac26d2`, on the baseline `a07a6ef5`; run 2026-10-21, 00:34–01:02 UTC. A path it names reads as `git show 22ac26d2:<path>`.
```

QSWRK формулирует правило, раздел, на который он ссылается, его не формулирует, а QSRVW#readers даёт только предпочтение. Два из трёх аудитов в дереве читали дерево, которое не было базой.

### conflict · CLAUDE.md:113

«Commit on request, push only on an explicit invitation, never amend [QSWRK#stint]». В QSWRK#stint правила «commit on request» нет: там «its first commits delete», а закрытие приходит и «in a session that works on its own while he is away» (QSWRK#closeout).

```sh
$ git grep -n -E "Commit on request|works on its own|its first commits delete" -- CLAUDE.md docs/spec
CLAUDE.md:26:   session that works on its own while he is away [QSWRK#closeout].
CLAUDE.md:113:it instead of reading it back whole. Commit on request, push only on an
docs/spec/QSWRK-the-work.md:35:search, and its first commits delete. The work of the model on the texts is
```

Seed и глава по-разному отвечают, когда сессия делает коммит.

### text · QSWRK#journal

«`Language.` a change of the language whose requirements are cases, `Process.` a rule of the work, and any other domain one its own tests hold». QSMSR#benchmark: «A measurement belongs to a record in force, … held by the runs and the screen named after it».

```sh
$ git grep -n -E "^Domain\. Benchmark" -- docs/journal
docs/journal/D320.md:3:Domain. Benchmark.
docs/journal/D395.md:3:Domain. Benchmark.
docs/journal/replaced/D213.md:6:Domain. Benchmark.
docs/journal/replaced/D216.md:6:Domain. Benchmark.
docs/journal/replaced/D270.md:6:Domain. Benchmark.
docs/journal/replaced/D271.md:6:Domain. Benchmark.

$ git grep -n -F "record.domain !== 'benchmark' || record.measured" -- scripts/decision-records.mjs
scripts/decision-records.mjs:162:  && (record.domain === 'language' ? record.met.length > 0 : record.domain !== 'benchmark' || record.measured);
```

QSWRK#journal относит домен Benchmark к доменам, которые держат их тесты. QSMSR и дерево держат его прогонами и экраном.

### drift · scripts/merge-records.mjs:148

«The documents the walk holds to the records in force [QSWRK#reconciliation]» и в строке 83 — «which the walk reads». Лексикон заменил «walk of the baseline» на «the reconciliation» (D429). Запись D436 оставляет слово walk только за обходом тегов значения.

```sh
$ git grep -n -E "which the walk reads|the walk holds" -- scripts
scripts/merge-records.mjs:83:  // A citation a document writes in words, which the walk reads beside
scripts/merge-records.mjs:148:// The documents the walk holds to the records in force [QSWRK#reconciliation].

$ git grep -n -F "by: 'D429'" -- scripts/retired-words.mjs
scripts/retired-words.mjs:100:  { regex: /\bmov(?:e|es|ed|ing)[\s-]+(?:of[\s-]+)?the[\s-]+baselines?\b|\bbaseline[\s-]+mov(?:e|es|ed|ing)\b/i, written: 'the closeout of a stint, its records dissolved, its chapters written and its branch landed', by: 'D429' },
scripts/retired-words.mjs:101:  { regex: /\bwalk(?:s|ed)?[\s-]+(?:of[\s-]+)?(?:the|a)[\s-]+baselines?\b|\bbaseline[\s-]+walk\b|\bwalkOfBaseline\b/i, written: 'the reconciliation of the tree with its baseline, `scripts/reconciliation.mjs`', by: 'D429' },
```

Одну вещь называют «the reconciliation» (глава, `reconciliation.mjs`) и «the walk» (комментарии слияния). Читатель примет «the walk» за обход тегов.

### conflict · README.md:44

«Bumps the core and the command line and the sibling ranges». QSGAT#release: «the bump of the workspaces the matrix of `.github/workflows/deploy.yml` publishes».

```sh
$ git grep -n -F -- "- workspace:" .github/workflows/deploy.yml
.github/workflows/deploy.yml:27:          - workspace: "@kaluchi/qlang-core"
.github/workflows/deploy.yml:29:          - workspace: "@kaluchi/qlang-stdio"
.github/workflows/deploy.yml:31:          - workspace: "@kaluchi/qlang-playground"

$ git grep -n -E "Bumps the core and the command line|installing the CLI" -- README.md scripts/release.mjs
README.md:44:Bumps the core and the command line and the sibling ranges, rebuilds,
scripts/release.mjs:195:// registry verbatim. A consumer installing the CLI resolves that
```

Seed называет два поднимаемых пакета вместо трёх, которые публикует матрица, и пропускает streams. В комментарии `release.mjs` та же вещь называется «the CLI».

### implementation · QSGAT#gate

«in the core and the playground a test and a hook wait twenty seconds». Интеграционные тесты playground (`playground/test/integration/`, QSREQ#marks) ждут 15 секунд, а hookTimeout у них не задан.

```sh
$ git grep -n -E "testTimeout|hookTimeout" -- core/vitest.config.mjs playground/vitest.config.mjs playground/vitest.integration.config.mjs
core/vitest.config.mjs:14:    testTimeout: 20000,
core/vitest.config.mjs:15:    hookTimeout: 20000,
playground/vitest.config.mjs:18:    testTimeout: 20000,
playground/vitest.config.mjs:19:    hookTimeout: 20000,
playground/vitest.integration.config.mjs:23:    testTimeout: 15000
```

Одна из двух конфигураций vitest у playground расходится с разделом. Вопрос: относится ли правило о двадцати секундах к интеграционному набору playground?

### pentimento · eslint.config.mjs:15

«(CLAUDE.md hard invariant: the core ships to browser, Deno, Bun bundles…). Test files, cli, and the lsp server are free to `node:*` as before.» В строке 49 — «used by cli», в `check-conventions.mjs:165` — «the doc tree (quotes CLAUDE.md rules verbatim …)».

```sh
$ git grep -n -E "CLAUDE.md hard invariant|CLAUDE.md rules verbatim|as before|used by cli" -- eslint.config.mjs scripts/check-conventions.mjs
eslint.config.mjs:15://     `node:*` modules (CLAUDE.md hard invariant: the core ships
eslint.config.mjs:18://     server are free to `node:*` as before.
eslint.config.mjs:49:        // Node globals used by cli / lsp / scripts / tests.
scripts/check-conventions.mjs:165:// tree (quotes CLAUDE.md rules verbatim and can name the forbidden
```

Комментарии сохраняют прежний слой: правила тогда жили в CLAUDE.md, а папка `cli` ещё существовала. Сейчас правило в QSGAT#workspaces, `cli` в дереве нет, а «as before» рассказывает историю.

### pentimento · .github/workflows/deploy.yml:20

«Core is built first — other workspaces that import from it at test time need the generated artefacts. Serial publish keeps the npm-registry transition visible per package.» Рядом: ci.yml:137 «Naming the failing states instead would let `skipped` through…» и playground/vitest.integration.config.mjs:13 «Coverage is intentionally NOT enforced here…».

```sh
$ git grep -n -E "Core is built first|max-parallel|run: npm run build -w" -- .github/workflows/deploy.yml
.github/workflows/deploy.yml:20:      # Core is built first — other workspaces that import from it
.github/workflows/deploy.yml:23:      max-parallel: 1
.github/workflows/deploy.yml:43:      - run: npm run build -w @kaluchi/qlang-core

$ git grep -n -E "Naming the failing|intentionally NOT enforced" -- .github/workflows/ci.yml playground/vitest.integration.config.mjs
.github/workflows/ci.yml:137:      # Every needed job must report `success`. Naming the failing
playground/vitest.integration.config.mjs:13:// Coverage is intentionally NOT enforced here — v8 coverage runs
```

Эти комментарии оправдывают выбор отвергнутой дорогой или говорят, чего нет, вместо того чтобы сказать, что держится. Причина в deploy.yml — слой, который каждая задача опровергает: она сама собирает core (строка 43).
