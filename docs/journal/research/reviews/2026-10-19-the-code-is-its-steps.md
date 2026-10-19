## qlang review: the-code-is-its-steps (master...bb62f35b)

A review of the branch before it lands, which the maintainer asked for, «ревьвшешь себя агентом перед мержем» (maintainer, 2026-10-19 17:46 UTC, session d7f52e95): a clean Opus started by the session with no tool to change a file, which read the tree at bb62f35b, the baseline 6ebe3da0, on 2026-10-19, the three batches of the branch, the move of the baseline that dissolved D367, D368 and D371 and the walk of the open records at the move. Its report stands as it wrote it; the session's reading follows it.

Verdict: changes asked

1. core/src/nouns.mjs:124-131, 350-353 (`answerKindsOf`, `kindsWalkedTo`). Когда метка глагола стоит в середине обхода субъекта, обход режется на ней. Вычислитель же кладёт ответ как вид субъекта (core/src/eval.mjs:640-650, `keptAsSubject`/`keptUnderTags`), и обход ответа уходит дальше метки. После `within` сервер теряет все глаголы вектора. Нарушено правило QSHST#tools:345 «the kinds of the answer as the evaluator lays it». Тест verb-tooling.test.mjs:53 держит только метку в конце обхода (`vec/sort` на `['Box','tagged','vec']`); метку в середине (`::tagged`) не держит ни один тест (QSWRK#branch). Проба (`completionsAtOffset` из lsp/src/features.mjs):
   - после `::Box[1 2] | within ~(append 3) | ` → `count: false first: false within: true total: 41`;
   - после `::Box[1 2] | ` → `count: true first: true total: 79`;
   - `qlang '::Box[1 2] | within ~(append 3) | get [~(it) ~(count) ~(first)]'` → `[::Box[1 2 3] 3 1]`.

2. core/src/walk.mjs:116-137 (`bindingNamesVisibleAt`, ветка «outside» на :127-128) и docs/spec/QSHST-hosts-and-the-command-line.md:333-338. В теле глагола имена берутся по месту объявления, «of the pipelines that hold it wherever they stand», а не по дереву в месте вызова. Сама секция обосновывает правило словами «as a verb reads the tree where it is called [QSNAM#verb]», и дерево это опровергает (QSWRK#spec). Проба, goto-definition на `helper` в теле `Box/area`:
   - `:Box |~~ B ~~| | :Box/area ~(helper) | (:Box/helper ~(1) | ::Box[1] | area)`: рантайм → `1`, сервер → `null`;
   - `:Box |~~ B ~~| | :Box/area ~(helper) | ::Box[1] | area | :Box/helper ~(1)`: рантайм → `::call/UnknownNameError`, сервер прыгает на `{"startOffset":57,"endOffset":73}`.

3. docs/spec/QSHST-hosts-and-the-command-line.md:320. Секция пишет «`verb` the name of a call that reaches a word of the root», а painter красит по имени: core/src/highlight.mjs:96 `verbNames.has(name) ? 'verb' : 'name'`. Док самого `tokenize` (highlight.mjs:15) говорит честно: «a call `verbNames` holds». D371 решил «by what it reaches», реализация этого не делает, секция утверждает, что делает (QSWRK#spec). Название describe в core/test/unit/highlight.test.mjs:150 тоже «by what it reaches». Проба:
   - `tokenize(':count 5 | count', verbNames)` → `count:verb`, а `qlang ':count 5 | count'` → `5` (значение читателя);
   - для `:Box |~~ B ~~| | :Box/count ~(1) | ::Box[1] | count` → `count:verb`, а qlang → `1` (`Box/count` читателя).

4. docs/spec/QSHST-hosts-and-the-command-line.md:331-332 «reads the language from the core, spelling none of it». Сервер пишет язык сам:
   - lsp/src/features.mjs:542 `/^[ \t]+$/` — зазор между вызовом и курсором. Грамматика читает комментарий как пробел (QSSYN#comment, grammar.peggy:1079), этот regex — нет;
   - features.mjs:289 `STEP_AT_CURSOR = ' it'`;
   - lsp/src/server.mjs:78 `triggerCharacters: ['|', '/', ':', '(', ' ']`.

   Нарушены QSWRK#spec и AIM state 4. Проба `signatureHelpAtOffset` в конце строки:
   - `[1 2] | take ` → `take count`;
   - `[1 2] | take |~ how many ~| ` → `null`, хотя `qlang '[1 2] | take |~ how many ~| 1'` → `[1]`.

5. docs/spec/QSHST-hosts-and-the-command-line.md:351 «where the last part of its node ends» против :336 «the verbs, the nodes and the labels». В одной секции «node» — то часть разбора, то узел scope; то же в lsp/src/features.mjs:488. D367 решил «node names no part of a source», и при растворении это правило потеряно. Это drift (QSWRK#documents; AIM «A term strikes one sense»). Проба: `rg -n "part of its node|nodes and the labels" docs/spec/QSHST-hosts-and-the-command-line.md` → строки 336 и 351.

6. Знак диффа от базиса. Документы растут на +795 строк, тесты на +539. Нарушены QSWRK#diff («the core sources, the documents and the tests are held to a diff that deletes more than it adds») и AIM state 7. Проба:
   - `node scripts/measure.mjs --steps 6ebe3da0 HEAD` → `+1687 −1967 | +279 −135 | +1757 −962 | +1866 −1327 | +527 −827` (core sources | catalog | documents | tests | tooling);
   - `measure.mjs 6ebe3da0 HEAD`: spec 4807→4930, journal 49801→50466, core unit tests 9501→9725, lsp 2046→2180.

   Ядро удаляет больше, чем добавляет (−279), доля комментариев падает 0.336→0.331 — это держится.

7. core/src/nouns.mjs:124-131. Если `returns` называет метку, `answerKindsOf` отбрасывает остальные виды `returns`. Вычислитель сначала проверяет именно их (core/src/eval.mjs:661-663). Функция экспортируется пакетом для инструментов, а её док и тест (verb-tooling.test.mjs:53) обещают «as the evaluator lays it» (QSHST#tools:345, QSWRK#code). В корне такой `returns` есть только у `fn/impl`, поэтому сервер сегодня на это не наступает. Проба (createSession + `:vec/h (::fn | returns |~~ The count or the vector. ~~| #[::vec ::number] | impl ~(count))`):
   - `answerKindsOf(scope, nodeOf(scope,'vec/h'), ['vec'])` → `["vec"]`;
   - `[1 2] | h | type` → `::number`.

8. lsp/src/features.mjs:295-298. Комментарий говорит, что после вызова виды — это «the kinds the `returns` of a verb that serves it names [QSBLD#answer]». Код (:316, через `answerKindsOf`) даёт обход субъекта через метку. Это ложный комментарий, и цитата не та: нужна QSHST#tools (QSWRK#code). Проба:
   - после `::Box[1 2] | append 3 | ` сервер предлагает `within` и `payload`, после `[1 2] | append 3 | ` — нет;
   - `::vec/append/answer | binding | get /value` → `::vec`.

9. Цитаты, названные при переносе, чей блок держит правило другой секции (QSWRK#spec, QSWRK#marks):
   - core/test/unit/eval-smoke.test.mjs:283 и core/test/unit/errors.test.mjs:61 — [QSERR#site] на место отказа по span. QSERR#site (QSERR-errors.md:228-283) о span не говорит; правило в QSQUO#step:52-55. Нужно [QSQUO#step].
   - lsp/test/features.test.mjs:374 и :636 — [QSQUO#step] на hover и references. Нужно [QSHST#tools], для `::error` перед `!` ещё [QSERR#rest].
   - core/test/unit/door.test.mjs:221 — [QSQUO#step] на печать `::error` с не-map payload, «the error literal writing a map alone». Это QSERR#rest:12-17, нужно [QSERR#rest].
   - core/src/grammar.peggy:11-16 — абзац про запись шага, которую строит конструктор, и отказ в месте части. Это QSQUO#step, а названа только [QSSYN#doc].
   - core/src/eval.mjs:149-150 — «A group runs its quote as a fork» названо [QSQUO#step]; fork — это QSNAM#scope.

   Выборка: все изменённые цитаты eval.mjs (15), grammar.peggy (23), steps.mjs (19), walk.mjs (5), features.mjs (11 изменённых и неизменённые), highlight.mjs (8) и около 60 в остальных модулях и тестах.

10. docs/spec/QSHST-hosts-and-the-command-line.md:307-363 (## tools) не держит ни одной пробы, хотя запуск показывает её правила. Проба D273 ушла вместе с записью, и фраза «a kind built elsewhere and bound by name is a kind to the runtime» осталась без пробы. Нарушены QSWRK#spec («shows its rules by probes where a run shows them») и QSWRK#baseline. Проба:
    - `sed -n '/^## tools/,$p' … | rg -c '^```'` → 0;
    - `:K (::kind | wraps |~~ x ~~| ::map) | :Box |~~ A box. ~~| K | get [~(::Box{:a 1} | type) ~(::Box#5 !| type) ~(kinds | has ::Box)]` → `[::Box ::Box/PayloadKindNotTakenError true]`.

11. docs/journal/D293.md:117-126 (слияние D297). Две альтернативы потеряли цену: «…the runtime rebuilt at its seams» (у D297 было «the tests that import the classes go with them») и «The members of the table a test alone reads leaving with that test…» (у D297 было «at the cost of the test of a table of its own»). Пропали также фраза «the registry of the primitives seals after the bootstrap» и проба класса на каждый отказ. Нарушено QSWRK#journal: у каждой альтернативы — своя цена, слияние пробует каждую переносимую фразу. Проба: `node --input-type=module -e "…typeof declareRefusal('probe/SomeError')"` → `function`.

12. docs/journal/D353.md:179-196. Area 25-й пачки — «the parser, the evaluator, the walks, the printer and `elide`; the chapters, the seeds, and the case files». Второй вопрос D295 («what spells it for the editor», D295.md:53-61, `vscode/syntaxes/*.tmLanguage.json`) в area не попадает, а D353 обещает, что записи несут пачки, чья area с ними совпадает. Проба: `rg -n "TextMate|tmLanguage|syntaxes" docs/journal/D353.md` → пусто.

13. docs/journal/D257.md:124-145 (слияние D259 и D268) — нарушено QSWRK#journal (слияние пробует каждую переносимую фразу):
    - фраза «the slash stands inside a tag's name and the dot does not» перенесена без пробы D259; проба держится: `::app/m8/web/Foo | type` → `::tag`, `"::app.m8.web.Foo | type" | parse !| type` → `::quote/ParseError`;
    - замер D268 («0.74 to 0.84 s», «half a million characters») перенесён без перепроверки на сегодняшнем дереве: `cat core/lib/qlang.qlang core/lib/qlang/*.qlang | wc -c` → 727663; три запуска `node cli/src/bin.mjs '1'` → 993, 945, 1073 ms.

14. docs/journal/D295.md:10 «three counters its predicates raise and give back». `spanOfALine` — флаг, а не счётчик: `let spanOfALine = false;` (grammar.peggy:305), на :855-856 ставится в true и false. Нарушено QSWRK#journal (запись в силе говорит словами дерева). Проба: `rg -n spanOfALine core/src/grammar.peggy` → 305, 783, 853, 855, 856.

15. docs/spec/QSNAM-names-and-scope.md:152-154 (новое определение). «its scope, the names the steps before it declared over the root, which `env` lists» не держится в recipe: там scope открывает вызов (QSWRK#spec). Проба: `:Box |~~ B ~~| | :Box/f (::fn | impl ~(env | keys)) | ::Box[1] | f` → `#[:Box :Box/f]`, имена, которых не объявил ни один шаг recipe.

16. docs/spec/QSQUO-code-as-data.md:69-70 «A payload that is no map, and of `::fail` and `::group` one that is no quote, is refused…». Фраза без квалификатора; D367 писал «The payload of a record of a step». У payload метки такого правила нет (QSWRK#spec, точность). Проба: `::call[1] !| type` → `::call/PayloadKindNotTakenError`, а `::Box[1]` стоит как значение.

Проверено и держится:
- `run-probes.mjs` без аргументов: 662 ok и одна цель D257.
- `check-conventions.mjs`: OK.
- Правила D367/D368/D371/D322 разошлись по своим секциям.
- D309 и D281 перенесли вопросы, пробы, источники и альтернативы целиком.
- D353 ставит каждую открытую запись в пачку или в ожидание мейнтейнера.
- В сообщениях коммитов нет счётов.

## The fates of the findings

The session's reading, each finding held to its probe in the tree of bb62f35b and repaired in the commit after it.

1. Held in part. `within ~(get /0)` on `::Box[1 2]` answers `::Box` over a number, so the kinds beneath the label the walk reached are no fact of the answer, and the server keeps them out; what it lost is the tag the reached value stands under: `kindsWalkedTo` keeps the `::tagged` of the reached value, and QSHST#tools states that the kinds beneath, which the answer may change, are left out, its probe `::Box[1 2] | within ~(get /0) | type` → `::Box`. A test of a label in the middle of the walk and of the verb's own label holds it.
2. Held in its text. The server reads the declarations around a verb from the text alone; QSHST#tools no longer says it reads the tree where the verb is called. The reading at each call of the verb went into the ideas of D257, the record whose axis it is, beside the walk it would cost.
3. Held. QSHST#tools says a call is painted `verb` where it names a word of the root, read by the name alone.
4. Held for the gap. The gap between a call and the cursor is read by the grammar, `parse` of the gap answering the empty quote, so a comment there reads as whitespace, held by a test that fails on the server before the repair; QSHST#tools says the server reads the grammar for what stands as whitespace. The step it writes at the cursor and the characters that call it are the protocol's, written where the server talks to the editor; the section says what the server reads from the core rather than that it spells none of the language.
5. Held. QSHST#tools and the comment of `foldingRangesOf` say where a fold's last part ends.
6. Confirmed, not repaired at this move. The documents grew by the records of the two batches, which the move keeps under `replaced/`, the open records the reviews of the shift left and the sections written anew, and the tests by the tests of the new rules; the rule of [D353] that a finding enters the record of its axis, which the maintainer's word on the growth of the journal brought, holds the next batches to it.
7. Held. `answerKindsOf` answers the walk through the label beside the other kinds `returns` names, held by a test (`vec/h` → `[vec number]`).
8. Held. The comment says the kinds of the answer of a call as `answerKindsOf` reads them, citing QSHST#tools.
9. Held. The five citations name QSQUO#step, QSERR#rest with QSHST#tools, QSHST#tools, QSERR#rest, QSQUO#step beside QSSYN#doc, and QSNAM#scope.
10. Held. QSHST#tools holds the probe of a kind bound by name and of `within`.
11. Held. D293 keeps the cost of each alternative it took from D297, the sealing of the table and the probe of a class for each refusal.
12. Held. Batch 25 of D353 names the grammars of the editor in its area.
13. Held. D257 holds the probe of the slash and the dot and the measure of the boot taken again on the tree of the move.
14. Held. D295 says two counters and a flag.
15. Held. QSNAM#scope says the names in force before a step, a recipe's those its call opens.
16. Held. QSQUO#step says the payload of a record of a step.
