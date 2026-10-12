## qlang review — modules-are-the-tree-of-names @ 1c0758e3, моя часть

Файлы: D:\git\qlang\core\lib\qlang.qlang (ниже qlang), D:\git\qlang\core\lib\qlang\any.qlang (any), D:\git\qlang\core\lib\qlang\number.qlang (number), D:\git\qlang\core\lib\qlang\string.qlang (string).

**Verdict**: REQUEST CHANGES
**Gates**: `npm run ci` я не запускал, так велел вызов (по его словам, exit 0 на 1c0758e3). `runLaws` по manifest `::any`, `::number`, `::string`, по всем `kinds` и по `::qlang` провалов не даёт. Порядок рассказа у каждого слова соблюдён, кроме `json` (см. 25).

### Findings (26)

1. **The language describes itself** — blocker
   qlang:378-380, страница `::boolean`: «`filter`, `every` and `if` take a quote that answers one». Для `if` это ложно. Проба: `5 | if ~(gt 0) ~(1) ~(2) !| type` → `::any/if/condition/NotBooleanError`.
   Ремонт: «`filter` and `every` take a quote that answers one, `if` a boolean computed at the call».

2. **The language describes itself** (текст писан под `*`) — blocker
   any:461-462 «Over a vector the subject is each element, `map ~(if …)`» и страница закона any:541-542 `:any/if/choosesForEachElement`. Проба: `[1 -2 3] | if (gt 0) ~(/) ~(0) !| type` → `::call/KindAnswersNoVerbError`.
   Ремонт: «Under `map` the subject is each element» и на странице, и в законе.

3. **The language describes itself** — blocker
   string:905-908, `parseJson`: «of a value under a tag, an error among them, as a map of its `$tag` and `payload`». Проба: `[(!{:k 1})] | json | parseJson | /0 | keys` → `#[:"$error"]`. Страница `json` (any:262-270) про ошибку внутри значения ничего не говорит.
   Ремонт: убрать «an error among them». На страницу `json` добавить, как пишется ошибка внутри значения (`$error`, `descriptor`), и закон под `::any/json`.

4. **The language describes itself** — blocker
   qlang:303-307, страница `::builtin`: `::vec` назван среди имён, чьё значение `::builtin{}`. Проба: `::vec | binding | /value | type` → `::doc`, а `::vec/construct | binding | /value` → `::builtin{}`. Фраза «a kind a host declares ends with one» тоже не держится: `:number/construct` стоит первым (number:6).
   Ремонт: «`::number/add` and `::vec/construct` the language's own»; «a kind a host declares builds its values by its `construct`».

5. **One fact, one spelling** — blocker
   Законы, повторяющие чужой запрос слово в слово: qlang:78=1068, 82=557, 86=1072, 106=1084, 134=1088, 150=1007, 222=1092, 226=1180, 230=1328, 262=1372, и qlang:174 `:qlang/rounds` = number:279. В парах «первая страница — глава» повторено и само предложение (28↔1041, 49↔1050, 49↔1134, 51↔1312).
   Ремонт: каждый запрос остаётся в одном месте. Из глав уходят предложение и закон, повторяющие первую страницу (`:qlang/pipeline/{replacesByALiteral,replacesByATagName,failsOnAMiss,keepsTheRecordByAName,holdsTheValueByAName}`, `:qlang/names/declaresOnce`, `:qlang/errors/namesTheSite`, `:qlang/code/isAVectorOfSteps`, `:qlang/values/impliesTheKinds`). `:qlang/rounds` уходит целиком: первая страница про `round 2` ничего не говорит. Из пары `readsJson` остаётся `:map/readsJson`.

6. **One fact, one spelling** — major
   Почти-повторы законов:
   - «литерал отвечает своим видом» доказан трижды: qlang:150/1007, законы видов `isA…` (337, 369, 385, 407, 436, 465, 549) и any:205-247 `:any/type/of…`;
   - `:desc/descendsAKey` (748) ≈ any:36; `:desc/holdsTheValue` (736) ≈ any:45;
   - qlang:415 ≈ number:26;
   - qlang:298 ≈ 1404 ≈ 770;
   - 254≈1352, 258≈1344, 290≈623, 170≈569, 194≈525, 118≈1269.
   Ремонт: на каждый факт один закон, под именем, чья страница этот факт говорит.

7. **One fact, one spelling** — major
   Две страницы говорят одно почти теми же словами:
   - `::desc` qlang:726-733 и `::any/desc` any:9-18;
   - `::error` qlang:657-661 и `::qlang/errors` 1302-1306;
   - `::explanation` 823-827 и `::any/explain` any:1231-1233;
   - `ne` any:143-146 повторяет ловушки `eq` any:71-73;
   - `::number` qlang:395 и 401 говорит «a step whose result leaves the domain/range answers an error» дважды на одной странице;
   - qlang:1424-1425 повторяет правило stdin со страницы `::cli`.
   Ремонт: страница вида говорит, что такое значение вида, и даёт ссылку на слово. Повтор уходит.

8. **One fact, one spelling** — major
   Страница слова повторяет ремонт со страницы своего отказа:
   - number: 33-37↔59-62, 98-100↔120-123, 145-147↔168-171, 189-191↔212-214 (`if (/count | eq 0) ~(0) ~(divOf …)` дважды), 251-252↔275-276;
   - string: 349-350↔373-374, 444-445↔455-456, 511-512↔522-524, 556-557↔567-568, 595-596↔608-609, 701-703↔721-723, 763-765↔783-784;
   - any: 17-18↔28-29, 190-191↔201-202, 270↔287-289, 331-332↔342-343, 1237-1238↔1254-1256, 1293-1294↔1310-1311, 1432-1433↔1443-1444.
   Ремонт: страница слова говорит, что вызов отказывается, и даёт `::link~(<адрес отказа> | doc)`. Ремонт стоит один раз — на странице, куда приводит `!| explain`.

9. **The language describes itself** — major
   Тринадцать страниц отказов без закона под своим адресом:
   - any:163, 168 (`ne`), 1724, 1776, 1784;
   - number:267, 376, 404, 432;
   - string:105, 135, 166, 306.
   Нашёл фильтром `laws | count | eq 0` по всем объявленным отказам.
   Ремонт: закон под каждым адресом, например `:any/ne/value/NotGivenError/refusesACallWithNoValue ::law~(5 | ne !| type | eq ::any/ne/value/NotGivenError)`.

10. **The language describes itself** — major
   Страницы отказов не говорят, как починить вызов:
   - any:168-169 (у `eq` рядом ремонт есть, 101-103), any:703-707, 710-714;
   - number:19-24;
   - number:115-117, 163-165, 207-209 — у `addend` (54-55) ремонт через `parseJson` есть, у соседей нет;
   - string:924-927, 933-940;
   - якоря any:967-969, 1052-1054, 1137-1139, 1370-1372.
   Ремонт: на каждой странице вызов, который работает (`"5" | parseJson | sub 1`, `cond ~(gt 9) ~("big") ~("small")`, `doc :take`).

11. **The language describes itself** (D179) — major
   Страницы не говорят, что будет с вызовом без значения или с несколькими значениями:
   - number: `add` (без значения); `sub` `mul` `div` `gt` `gte` `lt` `lte` (оба случая); `round` (несколько);
   - string: `gt` `gte` `lt` `lte` `take` `drop` `lower` `upper` `trim` `contains` `startsWith` `endsWith` `prepend` `append` `parseJson` `keyword` `parse`.
   Пробы: `1 | add !| type` → `::number/add/addend/NotGivenError`; `"a" | lower 1 !| type` → `::string/lower/ArgsBeyondPartsError`.
   Ремонт: по предложению на страницу, как у слов `::any`: «The call takes one number», «The call takes no value».

12. **Executable over narrated** — major
   Утверждения, у которых нет закона под своим именем:
   - «A number under a tag answers under the tag» — number:39-40, 102, 149-150, 194 (закон есть только `:qlang/verbs/answersUnderTheTags`);
   - number:144 `7 | mul 0.5`; number:148 `5 | mul /` (закон стоит под `:proj`);
   - «answers no `gt`/`count`/`contains`…» — number:316-318, string:29-30, 184-186, 645-646. Проба: `[1] | gt [0] !| /addresses` → `#[::desc/gt ::keyword/gt ::number/gt ::string/gt ::tag/gt]`;
   - примеры `mulOf` (any:1652-1653) и `subOf` (1700-1701) доказаны только на qlang:118-124;
   - `apply`: ведущий `!|` и повтор хвоста `:trail` (any:758-759);
   - `coalesce`: «`0` and `""`» (any:587-588);
   - `eq`: порядок ключей map (any:70). Закон стоит под `ne` (175-177), а страница `ne` о порядке ключей молчит;
   - «one literal is written in one of the two forms» (qlang:489-490, 540-541). Проба: `"[1, 2 3]" | parse !| type` → `::quote/ParseError`;
   - нет ложного случая у number `gte`/`lte` и string `lt`.
   Ремонт: на каждое утверждение закон под словом; `keepsTheOrderOfKeysAside` переносится под `::any/eq`.

13. **The language describes itself** — major
   any:1346-1349, `runLaws`: ключ `:error` назван, но не объяснён; «`:actual` what its query answered» неверно для закона, ответившего ошибкой. Проба: `:any/k ~(5) | :any/k/bad |~~ b ~~| ::law~(add "x") | ::any/k | runLaws | first` → `{:actual null :error "::number/add/SubjectNotNumberError" :ok false …}`.
   Ремонт: дописать это на страницу и добавить закон `:any/runLaws/failsALawThatAnswersAnError`.

14. **Words carry paradigms** (имена под `*`) — major
   any:808-810 `:any/apply/runsADistribute` «A distribute runs over the subject.» — distribute было именем `*`, а запрос доказывает то же, что `runsTheCode`. Имена законов в string: 417, 492, 583, 746, 807 `…UnderStar`.
   Ремонт: `runsADistribute` удалить; законы переименовать в `…ByMap`.

15. **The language describes itself** — major
   Законы, которые не доказывают ничего со своей страницы:
   - qlang:794-796 `:snippet/showsInThePageOfVectors` проверяет содержимое чужой страницы;
   - qlang:717-719 `:elision/hasAPage`;
   - qlang:345-347 и 353-355: про конструктор говорит глава `::qlang/verbs` (1236-1238), страница `::tag` молчит.
   Ремонт: первые два удалить; законы конструктора перенести к главе.

16. **Words carry paradigms** (отрицание как определение) — major
   - qlang:679-681 «A refusal's type is its site, not `::error`.» с хвостом `| eq ::error | not`; положительный закон уже есть — qlang:230;
   - qlang:1381-1382 «holds no one entity but a set of values»;
   - string:936-939 «rather than turned into an infinity … never in a literal».
   Ремонт: закон удалить; «An address holds a set of values»; страница отказа говорит, как его обойти.

17. **Words carry paradigms** (мутация) — major
   - qlang:841 «`within`, which edits it»;
   - string:440-441 «the vector it has become»;
   - any:1473 и 1552-1553 «A tag is replaced».
   Ремонт: «runs code on the value beneath and puts its answer back under the tag»; «`lines` answers a vector»; «another tag goes over the payload».

18. **Words carry paradigms** — major
   qlang:1243 «a guardian with no payload»: такого слова в языке нет, страницы у него тоже нет.
   Ремонт: «a noun that stands for a thing outside the language is addressed bare».

19. **The order of concepts** — major
   - qlang: порядок видов 302-984 не следует ни одной главе (`::builtin` стоит до `::tag`, `::fail` 940 и `::explanation` 822 оторваны от `::error` 656, `::any` последний), а главы 985-1428 идут после всех видов. Ремонт: первая страница, затем каждая глава, за ней виды её множества, в порядке глав.
   - any: `desc` стоит первым (8), `is` последним (1978), хотя `is` спрашивают инварианты начиная с 404, а `type` ссылается на него (192). Ремонт: `is` поставить рядом с `type`, `desc` рядом с `tag`.

20. **The language describes itself** (гипертекст) — major
   - Проба `kinds | filter ~(doc | links | count | eq 0)` → `#[::builtin ::cli ::holds ::law]`: страницы qlang:302-310, 798-803, 809-816 никуда не ведут.
   - `::builtin ::desc ::holds ::law ::tagged` не входят ни в одно множество глав.
   - `::qlang/errors` (1309-1310) не ссылается на `::qlang/code`.
   Ремонт: добавить ссылки, включить виды в множества глав, добавить `::link~(::qlang/code | doc)`.

21. **The language describes itself** — major
   string:181, 213-214, 230, 289, 347-348: «an emoji counts one / is taken whole / stays whole». Пробы: `"👍🏽" | count` → `2`; `"🇺🇸x" | take 1 | count` → `1`.
   Ремонт: «an emoji of one code point counts one; a modifier, a flag or a joiner counts each code point» и закон.

22. **The language describes itself** — major
   - string:440-441 «`join "\n"` writes it back». Проба: `"one\ntwo\n" | lines | join "\n" | eq "one\ntwo\n"` → `false`.
   - qlang:499-500 «Commas between elements are spaces.» противоречит странице 489-490.
   Ремонт: «writes back a text with no closing break»; «A comma between every two elements writes the same vector» и закон отказа для смешанного литерала.

23. **Executable over narrated** — minor
   По литералу не видно, что проверяет закон: string:219 `"é"` — это `e` и U+0301, а на string:64 `"é"` — U+00E9, на странице они неотличимы; string:618 держит U+00A0.
   Ремонт: `"e\u0301"`, `"\u00a0a\u00a0"`.

24. **Words carry paradigms** — minor
   - qlang:1386-1387: пример якоря написан без якоря, правильно `::qlang | doc :pipeline`;
   - qlang:876 «schema»;
   - qlang:25, 955, 1052, 395, 401 «result» (слово языка — answer);
   - qlang:14 «implicit argument»;
   - qlang:759-760, 786: страницы рассказывают о тестах;
   - any:2061, 2067: страница части «X»;
   - части `value` не названы в прозе: number:360, 389, 417; string:20, 87, 118, 148;
   - any:1600 «The numbers added.» читается как часть `numbers` (1604). Ремонт: «The sum of the numbers».

25. **The language describes itself** — minor
   any:279-284 `:any/JsonValueNotEncodableError` стоит внутри рассказа `json`, хотя адрес у него вне `json`. Это дефект хоста: `declareInvariantError` уходит мимо fail track. Закона нет, а страница советует запросу обходить ошибку, которой запрос не встречает.
   Ремонт: вынести из рассказа и сказать, кто его встречает.

26. **Prose names the invariant** — minor
   - any:3-6: второе предложение заголовка говорит о словах, которых файл не объявляет;
   - формула порядка рассказа повторена в заголовках any:2-3, number:3-4, string:2-4 (всего в 15 источниках);
   - законы с именем на `Error` (any:637, 2037; qlang:675, 683, 832) попадают под греп отказов `Error$`.
   Ремонт: заголовок говорит только, что держит файл; законы переименовать.
