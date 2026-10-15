<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at c91769c4 and checking docs/spec/QSWRK-the-work.md, on 2026-10-15 from 09:34 to 09:43 UTC. Its prompt is `scripts/spec-check-prompt.txt` at c91769c4. -->

### implementation · scripts/baseline-walk.mjs:17

QSWRK#baseline: «`check:conventions` holds the walk: … a citation in the code and the tests of a record that no met case holds». QSWRK#baseline (move): `dissolve-records.mjs` «names its section in each citation of it». Три артефакта до сих пор цитируют растворённые записи, и ни проверка, ни растворение их не видят: `CITING_CODE_ROOTS` не включает `core/scripts`, `site/scripts` и `site/test`.

```sh
$ grep -n "\[D[0-9]*\]" core/scripts/update-parse-error-snapshots.mjs site/scripts/_browser-entry.mjs site/scripts/bundle-qlang.mjs
core/scripts/update-parse-error-snapshots.mjs:12:// The decisions it exists for: [D7], [D125].
site/scripts/_browser-entry.mjs:19:// which the bundler writes from LANGUAGE_SOURCES [D153].
site/scripts/bundle-qlang.mjs:24:// `package.json#imports` maps it, in a Map by its uri [D153].

$ grep -n "^Dissolved into" docs/journal/replaced/D7.md docs/journal/replaced/D125.md docs/journal/replaced/D153.md
docs/journal/replaced/D7.md:125:Dissolved into [QSHST#answer] and [QSSLF#explain].
docs/journal/replaced/D125.md:33:Dissolved into [QSSYN#refusal] and [QSSYN#doc].
docs/journal/replaced/D153.md:109:Dissolved into [QSDSP#residence] and [QSHST#source].

$ grep -n "export const CITING_CODE_ROOTS" scripts/baseline-walk.mjs
17:export const CITING_CODE_ROOTS = ['core/src', 'core/host', 'core/lib', 'core/test/unit', 'core/test/helpers', 'core/test/qlang', 'cli/src', 'cli/lib', 'cli/test', 'lsp/src', 'lsp/test', 'vscode/src', 'vscode/test', 'site/src', 'scripts', '.github/workflows'];
```

Глава требует отказывать коду, который цитирует запись вне силы, а обход проверяет код не везде, где он лежит. В тех же корнях не проверяются и цитаты разделов, отсутствующих в главе: QSWRK#spec, «a citation of a section its chapter lacks». Вопрос: какой набор корней обхода отвечал бы «the code and the tests» целиком?

### design · QSWRK#baseline

«The baseline is the last commit that landed a branch on master, a merge on its first parent line … It moves when a branch lands, at the end of every shift that wrote records». QSWRK#branch: «a change to the journal alone lands on master directly».

```sh
$ grep -n "lands on master directly\|at the end of every shift that wrote\|The baseline is the last commit that landed" docs/spec/QSWRK-the-work.md
212:The baseline is the last commit that landed a branch on master, a merge
215:order. It moves when a branch lands, at the end of every shift that wrote
279:the journal alone lands on master directly. A push waits for the
596:lands on master directly. A release happens at the maintainer's word,

$ grep -n "'--merges', '--first-parent'" scripts/baseline-walk.mjs
70:  const landed = mainline === undefined ? '' : git(repoRoot, 'rev-list', '-1', '--merges', '--first-parent', mainline).trim();
```

Смена, которая пишет только журнал, пишет записи. По #baseline базовая линия должна сдвинуться в конце такой смены. Но по #branch эта смена приходит на master без merge, а базовая линия по определению и по реализации — только merge. Так что сдвинуться она не может, и записи копятся под пределом «no more than twenty». Вопрос: что сдвигает базовую линию в конце смены, которая пишет только журнал?

### design · QSWRK#probe

«A probe is a fenced block of a document whose lines that begin with `>` are queries typed into `qlang`». `check:probes` вычисляет эти запросы в ядре от `null`, а ответ-строку сверяет через командную строку, где субъект — `::qlang`.

```qlang
> eq null
false

> type
::tag
```

```sh
$ grep -n "rootState(null, initialEnv)" core/src/eval.mjs
63:  const finalState = await evalBody(ast, rootState(null, initialEnv));

$ grep -n "evalQuery(query)" scripts/sensors/run-probes.mjs
121:  try { return squash(printValue(await evalQuery(query))); } catch (thrown) { return `threw ${thrown.message}`; }
134:  if (answer === '') return !isErrorValue(await evalQuery(query));
147:  if (typeof await evalQuery(query) === 'string' && squash(onCommandLine(query)) === answer) return true;
150:  try { return deepEqual(await evalQuery(query), await evalQuery(answer)) || 'lossy'; } catch { return 'lossy'; }
```

Два пути к одному вопросу дают разные ответы. Набранный в `qlang` запрос `eq null` отвечает `false`, а прогон проб считает его от `null` и ждёт `true`. Поэтому проба выше, верная для командной строки, у `check:probes` вышла бы STALE. Вопрос: от какого субъекта читается проба главы, чтобы оба пути отвечали одно?

### implementation · scripts/gate-diff.mjs:38

QSWRK#target: дифф перечисляет «a change to … the configurations of vitest and eslint». Шаблон ворот не узнаёт конфигурацию vitest для интеграционных тестов командной строки, которую запускает гейт.

```sh
$ grep -n "vitest" scripts/gate-diff.mjs
38:  /(^|\/)vitest\.config\.[cm]?js$/,

$ git -C D:/git/qlang ls-files --error-unmatch cli/vitest.integration.config.mjs
cli/vitest.integration.config.mjs

$ grep -n "test:integration\"" cli/package.json
27:    "test:integration": "vitest run --config vitest.integration.config.mjs"
```

Глава считает воротами все конфигурации vitest, а дифф пропускает `vitest.integration.config.mjs`. Вопрос: какой шаблон покрыл бы каждую конфигурацию, которую читает `npm run ci`?

### conflict · CLAUDE.md:213

CLAUDE.md: «a citation of a record not in force, which the code, the tests and the cases never make and the documents make only of one open or waiting on its target». QSWRK#baseline: «a citation in the code and the tests of a record that no met case holds … and a citation in a document that cites of a record out of force or of the language with no case, an open record among those it may cite».

```sh
$ grep -n "\[D38\]\|\[D296\]" CLAUDE.md
221:and `cli/`; which thresholds the work keeps is an open record [D296].
321:public surface shifts. Its work is a record in force, [D38].

$ grep -n "^Domain\." docs/journal/D38.md docs/journal/D296.md
docs/journal/D38.md:3:Domain. Host.
docs/journal/D296.md:3:Domain. Process.
```

Тексты ставят границу в разных местах:
- Для кода CLAUDE.md запрещает только записи вне силы, а глава запрещает и запись языка в силе, которую держат одни цели.
- Для документов CLAUDE.md разрешает только открытые записи и ждущие цели. Сам CLAUDE.md при этом цитирует D38, запись хоста в силе, которая ни открыта, ни ждёт цели. Глава такую цитату разрешает.

### implementation · scripts/check-conventions.mjs:461

QSWRK#journal: «`check:conventions` holds the fates: each names a record that exists». Среди судеб глава называет «`Filed under the principles by` or `Filed under the tooling by`», а проверка читает только три вида строк.

```sh
$ grep -n "const fatesOf" scripts/check-conventions.mjs
461:  const fatesOf = name => statementsOfRecord.get(name).filter(statement => /^(Replaced by|Merged into|Pruned of what) /.test(statement));

$ grep -n "^Filed under" docs/journal/replaced/D159.md docs/journal/replaced/D161.md
docs/journal/replaced/D159.md:43:Filed under the tooling by [D226]: `check:conventions` holds it.
docs/journal/replaced/D161.md:83:Filed under the principles by [D225]: the audit states it in its
```

Ссылка на запись в строке `Filed under … by [Dnn]` (а `Dissolved into` вообще называет раздел) не проверяется на существование. Вопрос: какие строки судьбы обязана читать проверка, чтобы держать «each names a record that exists»?

### text · QSWRK#probe

«A probe that reads a machine, the sister project or the environment, one that names `jdt`, `scripts/sensors`, `env` or a variable of the shell, keeps the date of its answer and is run by hand». Пробы глав, где есть слово `env` языка, читают область имён, а не машину, и `check:probes` прогоняет их автоматически. Правило реализации относится к shell-командам, которые начинаются с `env`.

```qlang
> :x 1 | env | get [~(has :x) ~(has :vec)]
[true false]
```

```sh
$ grep -n "readsTheRepositoryAlone =" scripts/sensors/run-probes.mjs
100:const readsTheRepositoryAlone = command => !/\bjdt\b|scripts\/sensors|^env\b|\$[A-Z]/.test(command);
```

По букве предложения проба QSNAM#binding «names `env`» и должна запускаться вручную. Прогон же относит слово только к shell-пробе, начинающейся с `env`.

### conflict · core/test/unit/print-round-trip.test.mjs:1

QSWRK#spec: «The code, the tests and the cases cite the section whose rule they hold». Тест обратного чтения печати и шапка принтера ссылаются на QSWRK#code. Но QSWRK#code говорит лишь «A printer decides a spelling by the kind of the value». Правило «the text of a value of the language reads back as it» стоит в QSPRN#print. Так же `string.mjs:31` относит правило концов строк к QSWRK#catalog, а оно стоит в QSTXT#string.

```sh
$ grep -n "QSWRK#code\]\|QSWRK#catalog\]" core/test/unit/print-round-trip.test.mjs core/src/runtime/print-value.mjs core/src/runtime/string.mjs
core/test/unit/print-round-trip.test.mjs:1:// Every value prints as a literal that reads back as itself [QSWRK#code]: values
core/test/unit/print-round-trip.test.mjs:128:describe('the round trip of the print [QSWRK#code]', () => {
core/src/runtime/print-value.mjs:1:// The printer of the core: the text that reads back as a value [QSWRK#code], a part a
core/src/runtime/string.mjs:31:// final ending opens no line [QSWRK#catalog].
```

```qlang
> {:a [1 "x" :k]} | :v it | print | parse | apply it | eq v
true

> "a\r\nb\n" | lines
["a" "b"]
```

Комментарии приписывают правило разделу, который его не формулирует. Поэтому `marks.mjs QSPRN#print` и `marks.mjs QSTXT#string` этих блоков не найдут.

### design · QSWRK#diff

«Measured from the baseline, the core sources, the documents and the tests are held to a diff that deletes more than it adds». В той же главе: #branch «A new public surface comes with its tests first», #journal — каждое решение пишется записью, а #cases — «a rule no record states is written into the record it belongs to before a case names it there». Область `documents` содержит журнал, область `tests` — кейсы conformance.

```sh
$ grep -n "deletes more than it\|A new public surface comes with its tests first\|written into the record it belongs to before a case" docs/spec/QSWRK-the-work.md
147:written into the record it belongs to before a case names it there. The
283:A new public surface comes with its tests first. Each clause added to a
352:the documents and the tests are held to a diff that deletes more than it

$ grep -n "return 'tests'\|return 'documents'" scripts/measure.mjs
44:  if (`/${path}`.includes('/test/')) return 'tests';
45:  if (['spec', 'journal', 'other docs', 'site'].includes(fine) || path.endsWith('.md')) return 'documents';
```

Ветка, которая выполняет требования главы — пишет запись и добавляет тесты новой поверхности, — по тем же областям растит documents и tests. А #diff требует, чтобы они от базовой линии сокращались. Вопрос: какой результат измерения считается согласным для ветки с новой поверхностью?

### text · QSWRK#tooling

Workflow публикации сайта помечен `[QSWRK#tooling]`, но раздел не говорит о нём ни слова: он называет только `ci.yml` и `deploy.yml`.

```sh
$ git -C D:/git/qlang ls-files --error-unmatch .github/workflows/pages.yml
.github/workflows/pages.yml

$ grep -n "QSWRK\|deploy-pages" .github/workflows/pages.yml
1:# The decisions it exists for: [QSWRK#tooling].
45:      - uses: actions/deploy-pages@v5

$ grep -n "workflows" docs/spec/QSWRK-the-work.md
192:`.github/workflows/`, a case in its `decision` while it is in transit, a
571:GitHub, `.github/workflows/ci.yml`, run its steps but `check:fuzz` and
593:and its push; the tag runs `.github/workflows/deploy.yml`, which
```

Дерево держит правило — сайт собирается и публикуется в GitHub Pages при каждом push в master, — которого раздел, на который ссылается артефакт, не формулирует.

### text · QSWRK#tooling

«its catalog under `core/lib/qlang/` is read at runtime as `#qlang/<name>`». Топик языка лежит вне этой папки и читается без имени.

```sh
$ grep -n '"#qlang' core/package.json
24:    "#qlang": "./lib/qlang.qlang",
25:    "#qlang/load-source": {
29:    "#qlang/*": "./lib/qlang/*.qlang"

$ git -C D:/git/qlang ls-files --error-unmatch core/lib/qlang.qlang
core/lib/qlang.qlang
```

Предложение не покрывает `core/lib/qlang.qlang`, читаемый как `#qlang`. QSHST#source при этом называет его источником каталога: «the source `qlang` holds the topic of the language».

### apophasis · QSWRK#catalog

«Every host counts a host with no shell around its queries, the site's playground among them, so the core carries the working set a shell would supply».

```sh
$ grep -n "so the core carries the working set" docs/spec/QSWRK-the-work.md
447:them, so the core carries the working set a shell would supply: the JSON
```

Перечень рабочего набора ядра выводится из довода («so»). Сам набор можно было бы назвать прямо, как то, что выполняется.
