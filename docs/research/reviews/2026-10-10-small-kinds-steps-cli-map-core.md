## qlang review — modules-are-the-tree-of-names: мои источники каталога, c9c43bdb, 1c0758e3

**Verdict**: REQUEST CHANGES
**Gates**: `npm run ci` я не запускал, так было указано. С ваших слов на 1c0758e3 он дал exit 0. Законы под всеми адресами моих файлов прогнаны запросом `[…] | map ~(runLaws) | flat`: их 281, `filter ~(/ok | not)` → `[]`.

Пути даны от корня D:\git\qlang\. Исключение — п. 12, там пути абсолютные. Дефект, который был до ветки и который дифф только задел, я ставлю на ступень ниже.

### Findings (19)

1. **The sign of the diff** — blocker
   - `site/src/pages/index.astro:32` пишет «Thread values through chains of steps with |, distribute with *.». Первая страница сайта учит форме, которую парсер отвергает: `"[1 2 3] * add 1" | parse !| /found` → `"*"`.
   - `:16` — подпись «BindStep + distribute» над примером `map ~double`. 1c0758e3 правил `:17` этого файла, а обе строки оставил.
   - Ремонт: `:32` → «…with `|`, and a step on each element is the word `map`»; `:16` → «a name under a noun + map».

2. **The tests follow what they test** — major
   - `core/test/conformance/16-comments.jsonl:62,63,67`: перепись выбросила комментарий, ради которого стоит кейс. Сейчас запросы такие: `map ~(!| /kind)`, `map ~(| type)`, `map ~count`.
   - Формы с комментарием читаются: `[!{:kind :zap}] | map ~(|~ note ~| !| /kind)` → `[:zap]`; `[("x" | add 1)] | map ~(|~ note ~| | type) | first !| /trail/0/skipped` → `~(type)`; с `map ~(|~ note ~| count)` → `~(count)`. Ремонт: вернуть `|~ note ~|` в три запроса.
   - `:59` `comment-head-keeps-leading-distribute` = `[1 2] | (map ~(add 1))`: в запросе нет ни комментария, ни ведущего комбинатора. Удалить; комментарий после ведущего `!|` держит `:58`.
   - `targets.jsonl:92` `a-pipe-before-distribute-stands-for-it` (D130) = `[1 2] | map ~(add 1)`: пайпа перед комбинатором в запросе нет, правило ушло с `*` [D181]. Удалить.

3. **The tests follow what they test** — major
   - `core/test/conformance/targets.jsonl:40,41` (`every-verb-of-the-core-has-a-doc`, `every-example-of-the-core-passes`) обходят пустое множество.
   - Причина: `::qlang | manifest` отдаёт главы, под главами имён нет. `::qlang | manifest | map ~manifest | flat | count` → `0` в самом ядре, и `every` на пустом отвечает `true`.
   - Пустота родилась в ветке: на master обход шёл через `manifest * (spec | /verbs)`. 1c0758e3 переписал оба запроса и её не заметил.
   - То же ложное утверждение — в комментарии `core/test/unit/run-laws.test.mjs:2-4` («walks the whole catalog»).
   - Ремонт: `kinds | map ~manifest | flat | …`. Проба: `… | count` → `264`, `… | every ~(runLaws | every ~(/ok))` → `true`, `… | filter ~(doc | eq null)` → `[]`.

4. **One fact, one spelling** — major
   - Дубли среди кейсов:
     - `39-map-runs-code-on-each-element.jsonl:1` ≡ `04-vec-ops.jsonl:43`, слово в слово: `[1 2 3] | map ~(add 1)` → `[2 3 4]`.
     - `39…:2` ≡ `words/map-elements.jsonl:1`: `{:a 1 :b 2} | map ~(add 1)`.
     - `39…:4` повторяет утверждение `19-error-values.jsonl:50`.
     - `19-error-values.jsonl:26` ≡ `:27`.
     - `05-bindings.jsonl:5` ≡ `18-declared-verbs.jsonl:2`.
   - Юнит-тесты были лесами ветки `distribute` вычислителя. Теперь они тестируют слово каталога поверх его законов и кейсов:
     - `core/test/unit/eval-smoke.test.mjs:103-111` дублирует `04:43-44`;
     - `core/test/unit/fail-track.test.mjs:57-60` дублирует кейс `distribute-answers-its-first-failure` и закон `vec/map/answersTheFirstError`.
   - Ремонт: удалить `04:43`, `map-elements:1`, `19:27`, `18:2`, `19:50`, блок `eval — map` и тест `fail-track:57`.

5. **The tests follow what they test** — major
   - `core/test/unit/quote.test.mjs:53-55` («a wrapper stands in the quote itself and in no container») собирает `tag ::each`.
   - `::each` — метка, которой не отвечает ни один узел. `ElementNotStepError` приходит потому, что значение под ней вообще не шаг, а не из-за обёртки.
   - Ремонт: `[[(~(f) | tag ::fail)]] | tag ::quote` → `::quote/ElementNotStepError`, и причина здесь та, что в заголовке теста.

6. **Words carry paradigms** — major
   - Имена кейсов и тестов называют `*`. Список даёт `git grep -n -i distribut -- core/test`: 16 файлов кейсов и `depth-budget.test.mjs:41`. Плюс `core/test/unit/fork-order.test.mjs:28-29` («the elements under `*`…»).
   - Вне моих файлов то же у закона `core/lib/qlang/any.qlang:808` `:any/apply/runsADistribute`.
   - Ремонт: имя по утверждению о `map` (`map-over-a-set-answers-the-vector-of-the-images`) или удаление дубля из п. 4. После ремонта grep должен отвечать пусто.

7. **One fact, one spelling** — major (до ветки, дифф правил строку)
   - `lsp/src/features.mjs:239`: регексы `/\s(!\||\|)\s*$/` и `/\n\s*$/` повторяют правила `Combinator` и `LineContinuationUnit` из `core/src/grammar.peggy:101-103,147`.
   - 1c0758e3 снял `*` с обеих записей одновременно — это и есть цена второй записи.
   - Ремонт: разобрать источник через `parse`, поставив шаг `/` на место курсора, и прочесть комбинатор последнего звена из дерева. Регексы удалить.

8. **One fact, one spelling** — major (запись до ветки, расхождение — в ветке)
   - Поля записей шага записаны схемой в `core/src/runtime/quote-steps.mjs:80-98`. Прозой они же повторены в `call.qlang:9-10,15-17`, `bind.qlang:7-8,13-17`, `construct.qlang:7-8,13-16`, `proj.qlang:7-8,13-15` и на страницах видов `core/lib/qlang.qlang:861,873,900`.
   - Записи уже разошлись. Страница говорит «`:modifiers`, a vector of steps», а схема берёт только шаги-слова (`vecOf(isElementStep)`): `{:name :f :modifiers [(~(add 1) | first)]} | tag ::call !| [type /field]` → `[::call/PayloadNotSchemaError :modifiers]`.
   - Ремонт: каждое поле — определение под меткой с видом, как факт отказа [D172], например `:call/name |~~ The name the step calls. ~~| ::keyword` и `:call/modifiers … ::vec` с инвариантом шага-слова. `recordConstructor` берёт схему и обязательные поля из этих определений, страницы отказов ссылаются на них. Решение записать.

9. **The language describes itself** — major
   - `error.qlang:67-68` утверждает «one for each step it passed». Это ложно: `"x" | add 1 | mul 2 | sub 3 !| trail | count` → `1`.
     - Ремонт: «one for the step that raised it and one for each step that ran that step, the steps it passed held under `:skipped`».
   - `doc.qlang:74` утверждает «answers one string». На деле `|~~ only prose ~~| | segments` → `[" only prose "]`.
     - Ремонт: «answers a vector of one string».

10. **The language describes itself (D179)** — major
    - Страницы не говорят, что делает вызов без значения и с лишними значениями. Отказы по правилу не написаны страницами, и `!| explain` ведёт на страницу части, где ремонта нет: `::a | gt !| explain | page | content` → «The tag name the subject is compared with…».
    - Где это так:
      - `tag.qlang:19,74,107,142`
      - `keyword.qlang:19,68,100,134,166`
      - `desc.qlang:11,55,89,124`
      - `doc.qlang:28,69,122,166`
      - `boolean.qlang:19` (`true | not (eq 5) !| type` → `::boolean/not/ArgsBeyondPartsError`) и `:69,132` (вызов без `right`)
      - `quote.qlang:75,113`, `explanation.qlang:6,49`
      - `tagged.qlang:6,55` (`::Box[1] | within !| type` → `::tagged/within/code/NotGivenError`)
      - `null.qlang:19` (`null | at !| type` → `::null/at/place/NotGivenError`)
      - `error.qlang:66`
      - `cli/lib/qlang/cli.qlang:60,100,135` (`"hi" | @out "a" "b" !| type` → `::any/@out/ArgsBeyondPartsError`)
    - Ремонт по образцу `eq` (`any.qlang:95-104,134-140`): фраза на странице слова; страницы `…/NotGivenError` и `…/ArgsBeyondPartsError` там, где процедура помогает (`at`, `within`, `not`, сравнения); закон под каждой.

11. **The language describes itself** — major
    - Страницы инвариантов-отказов говорят, что должно держаться, но не говорят, как починить вызов. Именно сюда ведёт `!| explain`: `:a | gt "a" !| explain | page | content` → «The value compared is a keyword.»
    - Где: `tag.qlang:46-47,95-96,126-127,162-163`, `keyword.qlang:44-45,88-89,118-119,154-155`, `desc.qlang:39-40,77-78,112-113,145-146`, `boolean.qlang:93-94,154-155`.
    - Процедура уже стоит на странице слова — перенести её на страницу отказа:
      - keyword: «a string is turned by `keyword` first, `"b" | keyword | gt :a`»;
      - tag: «a keyword compares with a keyword, `:b | gt :a`»;
      - desc: «a value is turned first, `gt (2 | desc)`»;
      - boolean: «the conditions of one value hold together by `allOf`».
    - У инвариантов `gte/lt/lte` (tag, keyword, desc) и у `any/@err/text/NotStringOrNullError` нет закона отказа.

12. **The sign of the diff** — major (отставание всей ветки)
    - Замена `*` не легла в сестринский проект. `x * f` пишут:
      - D:\git\eclipse-jdt-search\cli\lib\jdt\coverage.qlang:195,200,220,232
      - D:\git\eclipse-jdt-search\cli\lib\jdt\graph.qlang:6,46,656
      - D:\git\eclipse-jdt-search\README.md:35,87
      - D:\git\eclipse-jdt-search\AGENTS.md:117-121
      - D:\git\eclipse-jdt-search\cli\README.md:53-59,176
      - D:\git\eclipse-jdt-search\cli\agents\Explore.md:24-26 и Plan.md:22-37
    - Там же стоит `::verb~`, которого в ветке уже нет.
    - Ремонт: перевести jdt в этой ветке до слияния, `x * f` → `x | map ~(f)`.

13. **The language describes itself** — minor
    - `quote.qlang:43-45`: закон `ParseError/refusesASourceCutShort` стоит между страницей и фактами `:47-73`. Перенести после `:quote/ParseError/uri`.
    - `cli.qlang:24-30`: законы `:cli` стоят раньше его отказа `:32-45`. Переставить после отказа.
    - `cli.qlang:203-205`: `:vec/table/refusesANumber` — закон об отказе `vec/table/SubjectNotVecError`, но стоит не под его адресом.
      - Ремонт: завести страницу `:vec/table/SubjectNotVecError` («`table` draws a vector of maps; a single map goes in a vector first, `[/] | table`»).
      - Под ней — закон на ловушке: `{:name "alice"} | table !| [type /actualType]` → `[::vec/table/SubjectNotVecError ::map]`.

14. **Executable over narrated** — minor. Утверждения без закона:
    - `boolean.qlang:75-76` (то же у `or`): `[1 2 3] | filter ~(gt 1 | and (lt 3)) !| [type /actualType]` → `[::call/KindAnswersNoVerbError ::boolean]`.
    - `quote.qlang:121-122`: `~(add 1) | open !| type` → `::number/add/SubjectNotNumberError`.
    - `keyword.qlang:173-175`: `5 | keyword !| /addresses` → `#[::keyword/keyword ::string/keyword]`.
    - `boolean.qlang:22-23` — пустой вектор.
    - `doc.qlang:35` — строка в `content`.
    - `error.qlang:13-15` — set, quote и doc под `:trail`.
    - `tagged.qlang:59-61`: шаги между могут ломать инвариант, `… | ::Pos(3) | within ~(sub 5 | add 10)` → `::Pos(8)`.
    - `bind.qlang:162-163`: свой scope открывают элемент, модификатор и цитата, а закон есть только на группу.

15. **One fact, one spelling** — minor
    - Законы, которые повторяют другие законы:
      - `doc.qlang:98-100` повторяет `:94-96`;
      - `proj.qlang:147-149` повторяет `vec.qlang:384-386`, а страница `:128-132` не ссылается на `::vec/map`;
      - `call.qlang:127-129` покрыт законом `:131-135`; слить их в `[type /actualType /addresses]`;
      - `tag.qlang:223-225` доказывает отсутствие и пройдёт и после переименования `addsTheNumber`; брать имя из `::number/add | laws`.
    - Факты:
      - `printed` объявлен одним и тем же текстом шесть раз: `bind:49`, `call:43`, `construct:47`, `fail:32`, `group:32`, `proj:40`;
      - `field` — четыре раза: `bind:21`, `call:21`, `construct:20`, `proj:19`.
      - Ремонт: по одному определению под `::error`, как у `index` и `places`.

16. **Words carry paradigms** — minor
    - `bind.qlang:160` «share one env» → «one scope».
    - `error.qlang:10` «error descriptor» и `builtin.qlang:132` «The descriptor carries» → «the facts of an error». Так говорит шапка `error.qlang:2-3`, а в `builtin.qlang:1,9,15` слово «descriptor» уже значит `::builtin`.
    - `tagged.qlang:104` «rewrap» → «goes back under the tag».
    - `construct.qlang:7` «constructor invocation» → «the step that puts a payload under a tag».
    - Часть `within` называется `code` (`tagged.qlang:78`), а проза `:56-69` говорит «the edit» → «the code» [D179].
    - Страницы `tag.qlang:75-78,108-111,143-145` и `keyword.qlang:69-71,101-103,135-137` ни разу не называют свою часть `value` этим словом.
    - Слово «still» сравнивает состояния: `docs/decisions/D130.md:32`, сообщение 1c0758e3 («still stands for it»), сообщение c9c43bdb («`*` still parses»).
    - Комментарии в тронутых файлах:
      - `vscode/syntaxes/qlang.tmLanguage.json:216` («pipeValue», «fail-apply», «materialized descriptor», «deflects» и объяснение порядка) → «`!|` the fail track and `|` the pipe, `!|` matched first».
      - `core/test/unit/tagged-lit.test.mjs:178-182` («Identity-overlay design… unchanged») → одно предложение о том, что держится.

17. **The language describes itself** — minor
    - `explanation.qlang:9-11` говорит «of an error the page of the refusal it carries». Но у отказа без страницы `explain` отдаёт страницу того, что отказало: так требует кейс `a-refusal-raised-by-rule-with-no-page-reads-the-page-of-what-refused`, и `::a | gt !| explain | page | content` возвращает страницу части.
    - Ремонт: дописать «…, or the page of what refused, the word or its part, where the refusal has none» и закон.

18. **Sources, not confidence** — minor
    - `docs/decisions/D181.md:41` пишет «Replaces in part [D52]», а `D52.md:22` — «Replaced by [D181]». D52 целиком о `*`, поэтому → «Replaces [D52] and in part [D103], [D116] and [D130]».
    - `D181.md:32-34` («more than half of their stars after a pipe») стоит без пробы и без ссылки на прогоны. Назвать набор и запрос.
    - Требование D181 «a step on each element is `map`» не покрыто ни одним кейсом с D181: D181 называет только `a-star-is-no-combinator`. Добавить D181 к `words/quote.jsonl:16`.

19. **One fact, one spelling / Prose names the invariant** — minor (до ветки)
    - `core/src/eval.mjs:43-45,146-150`: `builtin/UnknownCombinatorKindError` повторяет предусловие парсера. Парсер даёт только `|` и `!|`, а `evalAst` получает дерево только от `parse` (`core/src/runtime/root.mjs:49`, `core/src/session.mjs:44`).
      - Ремонт: выбирать трек по `kind === '!|'`, удалить отказ и его страницу `builtin.qlang:34-40`.
    - `core/src/fork.mjs` после ухода `forkEach` держит одну функцию с одним потребителем. Внести `fork` в `eval.mjs`, модуль удалить.
    - Сломан перенос строк в комментариях: `core/src/grammar.peggy:421`, `lsp/src/features.mjs:258`.

**Вопрос.** После `[1 2] | map ~(add 1) | ` редактор предлагает все имена: `lsp/test/features.test.mjs:160` теперь относит этот источник к случаю «no declaration names the kind». Причина в том, что `vec/map/answer` объявлен как `::any` [D182]. Под `*` вид `vec` сохранялся. D182 — запись модели. Если ответ `map` описать как вектор без меток субъекта с видом `vec`, который читает `answerKindsOf`, редактор вернёт себе точность.

**Что в порядке.** В `core/src` от `*` не осталось ни ветки вычислителя, ни экспорта, ни комментария. Новые комментарии говорят одним предложением, что держится. Знак диффа в исходниках отрицательный: у 1c0758e3 по `git show --numstat` (core, cli и lsp) +43 −131.
