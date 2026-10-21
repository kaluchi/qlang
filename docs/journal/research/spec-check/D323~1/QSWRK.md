> A check of the chapters `QSWRK` for D323 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `c0ee20a9`, itself the baseline; run 2026-10-15, 11:10–11:23 UTC. A path it names reads as `git show c0ee20a9:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qlang`, `grep` and `git ls-files` allowed, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.

### design · QSWRK#target

«it names the record in transit that left it» и «A branch that works targets starts from master with its suite green» (QSWRK#target) против «the merge holds no record in transit» (QSWRK#baseline) и «`check:conventions` refuses a case whose record overrides neither its section nor its chapter whole» (QSWRK#cases).

```sh
$ grep -nE 'in transit that left it|A branch that works targets starts|holds no record in transit' docs/spec/QSWRK-the-work.md
162:in transit that left it. The runner holds it to three verdicts: it
173:record comes first. A branch that works targets starts from master with
253:  cuts, and the merge holds no record in transit.
440:its change undone, and master holds no record in transit, its open

$ grep -nE 'a target names the decision' core/test/unit/conformance.test.mjs
135:          expect(test.decision, `${test.name}: a target names the decision that left it`).toBeDefined();

$ grep -n '_decision' scripts/dissolve-records.mjs
70:      const { decision: _decision, ...rest } = JSON.parse(line);

$ grep -n 'in transit at the merge' scripts/baseline-walk.mjs
98:    for (const name of recordsInTransit(repoRoot).keys()) walk.violations.push({ where: `${JOURNAL}/${name}.md`, problem: `in transit at the merge ${baseline} that landed it: dissolve it into its sections or set it aside before the merge` });

$ grep -nE 'starts from a green master|A branch that works targets, a subagent' CLAUDE.md
242:- A branch that works targets, a subagent's in its own worktree
243:  among them, starts from a green master, leaves the decision
```

```sh
$ cat core/test/conformance/*/*.jsonl | qlang --raw 'lines | filter ~(ne "") | map ~(parseJson) | filter ~(anyOf ~(has :target) ~(has :decision)) | count'
0
```

Каждое правило по отдельности понятно. Но вместе они не дают цели дожить до master. Цель обязана называть запись в транзите над своей секцией. В merge, которым ветка садится на master, записей в транзите быть не может. Растворение записи снимает с кейса `decision`, а без него раннер роняет цель. Значит, на master целей нет и быть не может, хотя QSWRK#target и CLAUDE.md:242 описывают ветку, которая начинает работу над целями с master. QSWRK#spec к тому же требует записывать противоречие как цель там, где правило главы стоит, но запись, которая не меняет правила, всё равно должна переопределять секцию. Вопрос: где цель живёт между двумя переносами базовой линии и что с ней происходит при переносе, если она ещё не встречена?

### conflict · CLAUDE.md:19

В CLAUDE.md: «A session reads the cataphatic core first, so its picture of the language is built from what holds, then lands on the apophatic texts». В QSWRK#documents: «A session lands on the apophatic texts … and reads the cataphatic ones by topic at the point of need».

```sh
$ grep -nE 'cataphatic|apophatic' CLAUDE.md
12:The texts of the work speak in two voices [QSWRK#documents]. The
13:cataphatic ones state what holds, in the present: the chapters of
15:code. The apophatic ones carry the change against the baseline: the
19:session reads the cataphatic core first, so its picture of the language
20:is built from what holds, then lands on the apophatic texts, where its

$ grep -nE 'lands on the apophatic|reads the cataphatic ones by topic' docs/spec/QSWRK-the-work.md
427:of a rule among them. A session lands on the apophatic texts, the
429:open, where its work is, and reads the cataphatic ones by topic at the point
```

Первая строка вывода grep по CLAUDE.md взята из того же файла: строка 12 содержит «The» в конце, а слово «cataphatic» стоит на строке 13. Два текста дают сессии противоположный порядок чтения. По CLAUDE.md катафатическое ядро (Tier 1: «every session, whole») читается первым и целиком. По главе сессия сначала садится на апофатические тексты, а катафатические читает по теме, когда они понадобятся.

### text · QSWRK#target

«lists every such move: a target added or a case added under another record; a change to the specification, … a record added, rewritten, moved or taken away, but for a line of fate appended; the targets met outside the task; and the lines of the implementation that spell a target they met».

```sh
$ grep -nE "findings.push\(\`(case removed|case rewritten|case marked|case moved|guide of the records)" scripts/gate-diff.mjs
74:    findings.push(`case removed: ${key}`);
78:  if (!sameText) findings.push(`case rewritten: ${key}`);
79:  if (before.target !== true && after.target === true) findings.push(`case marked as a target: ${key}`);
80:  if (decisionsOf(before).join() !== decisionsOf(after).join()) findings.push(`case moved to other decisions: ${key}`);
100:  if (path.endsWith('README.md')) { findings.push(`guide of the records changed: ${path}`); continue; }
```

Перечень в главе подан как полный («every such move»), но в нём нет пяти ходов, которые `gate-diff.mjs` сообщает как находки: удалённый, переписанный и помеченный целью кейс, кейс, перенесённый к другим записям, и изменённый README записей.

### implementation · QSWRK#marks

«a screen and a run of the benchmark in the name of its file, `screens/D270.txt`».

```sh
$ git -C D:/git/qlang ls-files --error-unmatch scripts/benchmark/runs scripts/benchmark/screens
scripts/benchmark/runs/R10.json
scripts/benchmark/runs/R9.json
scripts/benchmark/screens/D270.txt
scripts/benchmark/screens/D320.txt

$ grep -n '"screen"' scripts/benchmark/runs/R10.json
5:  "screen": "8ddd07f4f5da",

$ grep -n 'PATH_MARKS = ' -A 3 scripts/marks.mjs
44:const PATH_MARKS = [
45-  /^scripts\/benchmark\/screens\/(D\d+)(?:\.[0-9a-f]+)?\.txt$/,
46-  /^scripts\/benchmark\/sets\/[^/]+\/runs\/(D\d+)~[^/]+\.json$/
47-];
```

Прогоны референсов `R9.json` и `R10.json` — тоже прогоны бенчмарка (QSWRK#measure: «runs of the references»), но в имени файла записи нет. Их экран указан хешем, а не сохранённым экраном с номером записи, и `marks.mjs` такие файлы не размечает. Какой ответ был бы согласованным: относится ли правило именования ко всем прогонам или только к прогонам наборов?

### text · QSWRK#measure

«A child of the benchmark, `claude -p` … runs the command line on the tasks of a set, handed the pages of the language and of the command line as the language prints them, `[::qlang ::cli] | map ~(get [~(it) ~(doc)])`». При этом глава перечисляет `prompt` среди команд `scripts/benchmark.mjs`.

```sh
$ grep -n 'Start with' scripts/benchmark.mjs
88:- Start with \`qlang --help < /dev/null\` and \`qlang '::qlang | doc | content' < /dev/null\`, the language's own first screen, then explore the language by asking it.

$ grep -nE 'whose runs under' scripts/benchmark.mjs
7:// `benchmark/tasks.mjs`, whose runs under `benchmark/runs/` a model read and
```

Протокол `prompt`, по которому получены прогоны референсов, расходится с описанием главы. Ребёнку не передают страницы. Ему велят самому прочесть `--help` и `::qlang | doc | content`, а это другой «первый экран», чем запрос, который назван в главе.

### implementation · QSWRK#probe

«each read as the command line reads a query with no input, from `::qlang`».

```qlang
> ::cli | doc | type
::doc

> ::any/out | binding | get /origin
:cli
```

```sh
$ grep -n 'createSession()' scripts/sensors/run-probes.mjs
63:  const { result, error } = await (await createSession()).evalCell(query, { initialPipeValue: LANGUAGE_NOUN });
```

Запрос с `> ` раннер читает в сессии ядра без источников хоста (`createSession()` без `sources`), а командная строка читает его поверх источника `:cli`. Поэтому проба, которая называет `::cli`, `out`, `in`, `err`, `tap` или `table`, получит в `check:probes` другой ответ, чем в командной строке, на которую ссылается глава.

### implementation · QSWRK#journal

«A citation of a record is a link of markdown to its file, `[Dnn]`».

```sh
$ grep -nE '\[D[0-9]+\]' CLAUDE.md
222:and `cli/`; which thresholds the work keeps is an open record [D296].
322:public surface shifts. Its work is a record in force, [D38].

$ grep -cE '^\[[A-Z0-9#a-z]+\]: ' CLAUDE.md
0
```

CLAUDE.md, документ, который цитирует записи, ссылается на `[D296]` и `[D38]` без определений ссылок. Эти цитаты не являются ссылками markdown на файл.

### implementation · QSWRK#code

«The code names each thing as the language names it … A comment states what holds, in one sentence, and cites the section or the record it holds; the reason of a rule lives with its record».

```qlang
> !{:a 1} | payload
{:a 1}

> ::error | manifest | has ::error/payload
true
```

```sh
$ grep -nE 'because a set opener|descriptor brackets' core/src/highlight.mjs
347:// descriptor brackets. `#[` is not listed here because a set opener

$ grep -rnw 'descriptor' core/src/eval.mjs core/src/runtime/print-value.mjs
```

Последний grep выше показан без вывода; ниже — тот же grep только по `core/src/eval.mjs`, с выводом.

```sh
$ grep -nw 'descriptor' core/src/eval.mjs
174:  const errorOfKind = makeTaggedInstance(ERROR_TAG, new Map(raised.descriptor));
449:  if (!refused.descriptor.has('actualValue')) return isPath(subject) ? readOfPathSubject(subject, node) : null;
450:  const value = refused.descriptor.get('actualValue');
462:  if (!isErrorValue(refused) || refused.descriptor.has('read') || refused.descriptor.has('trail')) return state;
465:  const facts = factsInOrder(refused.tag, new Map(refused.descriptor).set('read', read), env);

$ grep -nE '^\s*(//|#).*\b(which is why|because|would slip|would only|so that)\b' scripts/workspace-manifests.mjs .github/workflows/ci.yml cli/vitest.config.mjs core/vitest.config.mjs scripts/release.mjs
scripts/workspace-manifests.mjs:7:// consumer resolves it for real, which is why the range has to name
.github/workflows/ci.yml:119:  # would slip past every other matrix entry.
cli/vitest.config.mjs:26:      // resolves. It carries no testable branch and would only
```

Язык называет карту фактов ошибки её payload (`::error/payload`), а код — `descriptor`. Комментарий `core/src/highlight.mjs:344-348` занимает несколько предложений, объясняет причину («because») и не цитирует ни секцию, ни запись. Комментарии инструментов тоже несут причины («which is why», «would slip past»), хотя по главе причина живёт в записи.

### implementation · QSWRK#baseline

Обход держит «a record in transit in the tree of the merge that landed it».

```sh
$ grep -n 'startsWith(baseline)' scripts/baseline-walk.mjs
97:  if (git(repoRoot, 'rev-parse', 'HEAD').startsWith(baseline)) {
```

Записи в транзите в дереве merge проверяются только тогда, когда HEAD и есть этот merge. После любого следующего коммита дерево merge больше не читается, и правило главы держится лишь в один момент.

### implementation · QSWRK#tooling

«`check:conventions` holds … the words that tell when a text changed … and the markers TODO, FIXME and HACK, in the sources outside `docs/`, `vscode/` and the instructions».

```sh
$ grep -nE 'mjs\|js\|md\|qlang\)\$' scripts/check-conventions.mjs
126:    if (!/\.(mjs|js|md|qlang)$/.test(entry) || VERBATIM_REPORT.test(relPath)) continue;

$ git -C D:/git/qlang ls-files --error-unmatch core/src/grammar.peggy site/src/pages/index.astro
core/src/grammar.peggy
site/src/pages/index.astro
```

Проверка читает только `.mjs`, `.js`, `.md` и `.qlang`. Грамматика `.peggy`, страницы `.astro` и workflow `.yml` — тоже исходники, но в этом скане они не участвуют.

### implementation · QSWRK#code

«The ratio of comment lines to code lines … falls on every branch, which `node scripts/measure.mjs` measures against the baseline».

```sh
$ grep -nE '^//   node scripts/measure' scripts/measure.mjs
10://   node scripts/measure.mjs <fromRef> <toRef>
11://   node scripts/measure.mjs --steps <ref> <ref> [<ref>...]
```

Скрипт мерит между двумя ссылками, которые передаются явно. Базовую линию он сам не находит, в отличие от `baseline-walk.mjs`, так что «against the baseline» обеспечивает вызывающий, а не скрипт.

### text · QSWRK#spec

«a chapter of the language shows its rules by probes, and this chapter by the checks each section names».

```sh
$ qlang --raw 'split "\n## " | drop 1 | filter ~(contains "```" | not) | map ~(lines | first)' < D:/git/qlang/docs/spec/QSHST-hosts.md
["input" "shell" "repl" "tools"]

$ qlang --raw 'split "\n## " | drop 1 | filter ~(contains "```" | not) | map ~(lines | first)' < D:/git/qlang/docs/spec/QSSLF-the-language-describes-itself.md
["catalog"]

$ qlang --raw 'split "\n## " | filter ~(startsWith "catalog") | first | get [~(contains "scripts/") ~(contains "npm ") ~(contains "check")]' < D:/git/qlang/docs/spec/QSWRK-the-work.md
[false false false]
```

Пять секций глав языка не показывают свои правила ни одной пробой. Секция QSWRK#catalog не называет ни проверки, ни скрипта. При этом введение главы (строка 7: «the checks of the tooling hold the rules for which a section names a check, and the review and the maintainer hold the rest») допускает секции без проверок, а QSWRK#spec требует, чтобы проверку называла каждая.

### text · QSWRK#cases

«A case is a line of `core/test/conformance/<chapter>/<section>.jsonl`» против «It refuses a record that overrides nothing and one that claims a case outside the chapters» (QSWRK#baseline).

```sh
$ grep -nE 'A case is a line of|case outside the chapters' docs/spec/QSWRK-the-work.md
136:it. A case is a line of `core/test/conformance/<chapter>/<section>.jsonl`,
231:  case outside the chapters. Records in transit over one section

$ grep -n 'a case outside the' core/test/unit/conformance.test.mjs scripts/dissolve-records.mjs
core/test/unit/conformance.test.mjs:103:  // the record's change is in transit over it; a case outside the
scripts/dissolve-records.mjs:9:// overrides nothing, or a case outside the chapters that names it, is
```

QSWRK#cases определяет кейс только как строку файла секции. QSWRK#baseline, раннер и `dissolve-records.mjs` знают кейс вне глав, а раннер ещё и требует, чтобы такой кейс открывался записью. Правило для кейса вне глав в QSWRK#cases не сформулировано.

### text · QSWRK#target

«The runner holds it to three verdicts: it answers its goal, and the branch that met it drops the mark; it answers its present, and stays a target; it answers neither, and fails». Отдельно: «A block of a document fenced as `qlang target` states an answer a repair must produce».

```sh
$ grep -nE 'the tree meets this target' core/test/unit/conformance.test.mjs
136:          expect(answersAsExpected, `${test.name}: the tree meets this target of ${test.decision}; drop its "target" mark`).toBe(false);

$ grep -n "if (answer === '')" scripts/sensors/run-probes.mjs
145:  if (answer === '') return !isErrorValue(await answerOf(query));
```

Глава говорит «fails» только о третьем вердикте. Раннер же роняет и первый, пока не снята пометка. Кроме того, `run-probes.mjs` считает блок `target` без ответа встреченным, если запрос не отвечает ошибкой; в главе этого правила нет.

### text · QSWRK#journal

«A decision is a record of its own, `docs/journal/Dnn.md`, numbered in the order it was written».

```sh
$ git -C D:/git/qlang ls-files --error-unmatch docs/journal/replaced/E1.md docs/journal/replaced/E6.md
docs/journal/replaced/E1.md
docs/journal/replaced/E6.md

$ grep -n 'E1 onward' scripts/requirements.mjs
19:// and then E1 onward, those of the environment of the work.
```

Дерево держит второй ряд записей, `E1`…`E6` («those of the environment of the work»). Все скрипты журнала читают их по шаблону `[DE]\d+`, а глава называет только `Dnn`.

### apophasis · QSWRK#journal

«The prune of a decision ends with a walk of every record in force against the tree, not with a search of its own words»; «Doubt is resolved by a record with its source, and by no item of a process, list of statuses or comment in code».

```sh
$ grep -nE 'not with a search|by no item' docs/spec/QSWRK-the-work.md
40:a record with its source, and by no item of a process, list of statuses
55:against the tree, not with a search of its own words, and a walk of the
```

Положительная часть правила уже сказана. Хвост «not with …» и «by no item …» говорит о том, чем правило не является.

### apophasis · QSWRK#branch

«a clause copied from the code beside it that no road reaches leaves rather than a case inventing a road»; «found by search rather than by memory»; «a cut is read by the name of the test that failed, never by a count».

```sh
$ grep -nE 'rather than|never by a count' docs/spec/QSWRK-the-work.md
307:beside it that no road reaches leaves rather than a case inventing a
309:read by the name of the test that failed, never by a count. A script that
314:by search rather than by memory, and its first commits delete. The work
```

К уже сказанному правилу каждая фраза добавляет отвергнутую альтернативу.

### apophasis · QSWRK#baseline

«its move is the clean desk: however a shift left the work, the next starts in order».

```sh
$ grep -nE 'however a shift left' docs/spec/QSWRK-the-work.md
214:is the clean desk: however a shift left the work, the next starts in
```

Предложение обосновывает перенос базовой линии тем, что после него наступает порядок, а не говорит, что при переносе выполняется.
