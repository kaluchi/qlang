## qlang review — modules-are-the-tree-of-names @ 1c0758e3, vec.qlang · set.qlang · map.qlang

**Verdict**: REQUEST CHANGES
**Gates**: `npm run ci` я не запускал, как вы и сказали (по вашим данным exit 0 на 1c0758e3). Прогнал все законы трёх источников по каждому адресу, у которого есть законы: `[…] | map ~(runLaws) | flat`. Проходят 203/203 (vec), 146/146 (set), 138/138 (map).

### Findings (20)

1. **One fact, one spelling** — blocker
Факты `leftType`/`rightType` объявлены шесть раз с одинаковым текстом: vec.qlang:1450-1456, 1525-1531, 1611-1617; set.qlang:1130-1136, 1224-1230, 1308-1314. Факт `key` объявлен пять раз: map.qlang:206-208, 260-262, 467-469, 526-528, 577-579. По D172 общие факты отказов лежат под `::error` (там уже есть `index`, `actualType`, `actualValue`, error.qlang:46-64). D172 прямо называет `:key` фактом отказа над map.
Ремонт: объявить `:error/leftType`, `:error/rightType`, `:error/key` по одному разу, а семнадцать копий удалить. Ещё три копии `key` в proj.qlang:91, 110, 135 — это не моя часть.

2. **Words carry paradigms** (D181) — major
В map.qlang:223 `map/sum/readsAFieldUnderStar` и map.qlang:941 `map/keys/readsTheKeysOfEachMapUnderStar` имена законов говорят о `*`, а `runLaws` печатает эти имена.
Ремонт: `sumsAFieldReadFirst` (как в vec.qlang:165) и `readsTheKeysOfEachMapByMap`. За пределами моей части то же самое в string.qlang:417, 492, 583, 746, 807.

3. **The language describes itself** — major
map.qlang:1261: в доке закона стоит «`map | raise` raises the subject». Здесь `map` уже слово, и такой вызов отказан: `{:kind :oops} | map | raise !| type` → `::map/map/code/NotGivenError`.
Ремонт: «`{…} | raise` raises the subject».

4. **The language describes itself** (D182) — major
Страницы модулей утверждают правило, которое `map` нарушает:
- vec.qlang:6 «where it answers a vector, it answers under the tags of the subject». Проба `::Box[1 2] | map ~(add 1) | type` → `::vec`. Так же ведёт себя `::Box[#[1] #[2]] | union` → `#[1 2]`.
- map.qlang:5-6 «…answers under the tags of the map». Проба `::Box{:a 1} | map ~(add 1)` → `{:a 2}`.
- set.qlang:7-8: слово, которое держит единый порядок, отвечает set. Но `::Box#[2 1] | map ~(add 1)` → `[2 3]`.

Ремонт: сформулировать правило через ключ ответа. Слово, чей `answer` называет метку самого слова, отвечает под тегами субъекта; `map` отвечает без тегов.

5. **The language describes itself** — major
vec.qlang:914-916 говорит «a map by its keys». Это неверно: `{:b 1 :a 3} | sort` → `{:b 1 :a 3}`, map/sort сортирует по значениям (map.qlang:596, закон 622-624).
Ремонт: «a map by its values, its keys kept».

6. **The language describes itself / One fact, one spelling** — major
- map.qlang:747-748 говорит «null answers null by an `at` of their own». Это противоречит vec.qlang:1126-1127 («null answers the default») и null.qlang:20. Проба: `null | at :a 7` → `7`.
- Ни vec/at, ни map/at не ссылаются на `::null/at`.
- Закон map.qlang:800-802 `chainsThroughNull` повторяет запрос null.qlang:53-55.

Ремонт: на обеих страницах «null answers the default, null when it gives none» и `::link~(::null/at | doc)`; закон удалить.

7. **The language describes itself** (ошибка ведёт на страницу своего места) — major
Касается union/minus/inter над контейнером, где значение — не set и не map:
- `#[1] | union !| explain | /page` выдаёт страницу конструктора set (set.qlang:18-21), с `minus`/`inter` то же. А set.qlang:1100-1101 обещает отказ самого union.
- `[1] | union !| type` → `::vec/union/answer/NotMapOrSetError`, у отказа нет страницы. При этом vec.qlang:1415-1416 говорит «a vector of one value answers it».
- `[1 2] | union` → `KindsMismatchedError ::number ::number`, то есть «mismatched» для одинаковых видов. Закон set.qlang:1176-1178 закрепляет то же.

Ремонт: один отказ `…/ElementNotSetOrMapError` с `:index` на обоих видах, со страницей и ремонтом. KindsMismatchedError оставить только для set рядом с map.

8. **One fact, one spelling / D179** — major
vec.qlang:1430-1436, 1505-1511, 1591-1597: у vec/union, vec/minus, vec/inter есть часть `with`, её страница — «The value the subject is joined with». Вектор ни с чем не соединяется, отказывается любое значение:
- set или map отказываются с парой: `[#[1]] | union #[2]` → `::vec ::set`;
- остальное — инвариантом части, без пары: `[1] | union 5 !| type` → `::vec/union/with/NotSetOrMapOrNullError`. Это противоречит vec.qlang:1419-1420.

Получается два отказа на один факт. Кроме того, ключ `with` — предлог, которым не пользуется ни одна страница: в set.qlang:1095 «The other value», в map.qlang:1070-1071 «the map the call gives».
Ремонт: у vec удалить `with`, его отказ, вторую причину KindsMismatchedError и законы `refusesAVectorAndASet`. Добавить страницу `vec/union/ArgsBeyondPartsError` с «`a | union b`». У set и map назвать часть словом прозы, `other`.

9. **Words carry paradigms** — major
Алгебра говорит «join», хотя `join` — слово, которое пишет строки в одну (vec.qlang:1658):
- vec.qlang:1431-1481, 1506-1561, 1592-1647;
- set.qlang:1097-1177, 1217, 1222, 1262, 1301, 1306, 1346;
- map.qlang:1074-1075, 1082, 1088, 1092, 1114;
- vec.qlang:1778.

Для minus и inter это ещё и неверно по смыслу («`minus` over a vector joins its values»).
Ремонт: для union «unites» (законы уже называются `unitesTheValues`), для minus «takes … from», для inter «keeps what … share». Законы отказов — «A set beside a map is refused with the pair».

10. **The language describes itself** (D179: страница отказа говорит, как починить вызов) — major
`[1 2] | filter ~(1) !| explain` показывает страницу без ремонта. Таких страниц много:
- ConditionNotBooleanError: vec.qlang:457, 554, 622; set.qlang:436, 491, 546; map.qlang:462, 521, 572.
- KeyNotKeywordError: vec.qlang:763, 852; set.qlang:603, 664.
- KeyNotKeywordOrStringError: vec.qlang:1533, 1619; map.qlang:1146, 1204.
- ElementNotNumberError: set.qlang:189, 233; map.qlang:255 (у vec.qlang:152-155 и map.qlang:201-204 ремонт есть).
- set SubjectEmptyError: set.qlang:1122, 1216, 1300. Фраза «over a set its call leaves without the other value joins» к тому же не читается.
- set KindsMismatchedError: set.qlang:1127, 1221, 1305; ещё set.qlang:1118.
- Инварианты count/index («The count is a number.»): vec.qlang:1034-1144; set.qlang:765-904; map.qlang:662-715; плюс vec.qlang:1679.
- ReducerNotBinaryError: set.qlang:1061-1066, map.qlang:871-876 (ремонт есть в vec.qlang:1338-1339).

Ремонт: каждая страница заканчивается вызовом, который проходит. Например, `filter ~(/n | gt 0)`; `groupBy ~(/active | print)` (проба → `{:true … :false …}`); `take 3`.

11. **Words carry paradigms** — major
Общие слова там, где у языка есть своё:
- vec.qlang:527 «a listing»;
- vec.qlang:572, 640 «An empty container» (страница говорит «the empty vector»);
- set.qlang:573, 588 «bucket» (vec.qlang:731 говорит «group»);
- «Pipeline» в именах законов vec.qlang:1395, 1403-1404, set.qlang:1084, map.qlang:894, хотя доки говорят «two steps».

Ремонт: вычеркнуть «of a listing»; «vector», «group», `refusesTwoSteps`.

12. **The language describes itself** (имя закона и его запрос) — minor
- set.qlang:1068 `foldsInTheOneOrder`: сумма от порядка не зависит.
- set.qlang:288, 339 `readsTheKey`: док про `desc` (ср. vec.qlang:271 `turnsTheKeyByDesc`).
- set.qlang:1017 `splicesOneLevel`: док «stays whole».
- vec.qlang:875 `filesAStringUnderItself`: док «under its keyword».
- vec.qlang:996, 1000 `refuses…`: это ошибка чтения, а у min и groupBy тот же факт назван `answersTheErrorOfTheKey`.
- vec.qlang:396-398: «not run» запросом не различимо.
- map.qlang:418-421: значение с ошибкой одно, «first» не доказан.
- set.qlang:960-962 вызывает vec/distinct. Перенести под set/reverse, у утверждения set.qlang:968-969 своего закона нет.
- map.qlang:731-733 не вызывает `drop` и повторяет 1151-1153.
- map.qlang:1004-1007 доказывает то, чего страница entries не говорит.

13. **One fact, one spelling** (законы-повторы) — minor
Пары законов с одним утверждением: vec.qlang:961-965 и 967-970; set.qlang:441-443 и 445-447; map.qlang:776-778 и 808-810; map.qlang:1260-1262 и 1264-1266; vec.qlang:1362-1368 и 1403-1409; vec.qlang:1222-1224 и set.qlang:56-58.

14. **One fact, one spelling** (один факт разными словами в трёх видах) — minor
- Отсылка к другим видам: «answer `count` by words of their own» (vec.qlang:27-28) против «answer by a `count` of their own» / «order by a `sort` of their own» (map.qlang:72-73, 601-602 и далее).
- Счёт ≤ 0: vec.qlang:1015-1016, set.qlang:748-749, map.qlang:646 — три формулировки.
- Страница части `count`: «How many.» (vec.qlang:1031, 1087), set.qlang:762, map.qlang:659 — тоже три.
- NotQuote-страницы: короткие в map.qlang:355, 518, 569, 619; vec.qlang:364-366 длиннее, чем vec.qlang:452-453.
- Предикат: vec.qlang:427-428, set.qlang:409-410, map.qlang:434-435.
- Ловушка null у `first`: `count` (vec.qlang:80-81) против `empty` (set.qlang:91-92).
- Остановку на первом значении называет только vec (vec.qlang:528-529, 597-598). Set и map останавливаются так же: `#[0 "x"] | every ~(gt 0)` → `false`, `{:a 0 :b "x"} | every ~(gt 0)` → `false`.
- set.qlang:505, 560 «holds every predicate» — в страницах set «holds» означает членство.

15. **The language describes itself** (одна ловушка, страница только у одного вида) — minor
- `count 1` и `first 2` имеют страницы у set и map (set.qlang:42, 103, 146; map.qlang:83, 141), а у vec нет: `[1 2] | count 1 !| type` → `::vec/count/ArgsBeyondPartsError`.
- `map` без кода: страница есть у vec (vec.qlang:370, 375), у map нет: `{:a 1} | map !| type` → `::map/map/code/NotGivenError`.
- `take` и `at` без счёта: страницы есть у set (set.qlang:773, 908), у `#[1] | drop` нет (→ `::set/drop/count/NotGivenError`), у vec и map тоже нет.
- map/last, map/empty, map/avg, map/reverse, map/keys говорят «it takes no value» без страницы и закона.
- map/union не говорит, что будет при вызове без map: `{:a 1} | union` → `::map/union/with/NotGivenError`.

16. **Executable over narrated** — minor
Утверждения страниц без законов:
- vec.qlang:26-27 счёт doc (`|~~ a ::link~(1) b ~~| | count` → `3`);
- vec.qlang:336-342: литерал, `map ~(add 1 !| 0)` → `[2 0]`, имена прогона (`[1 2] | map ~(:x 5 | add x) | x` → UnknownNameError);
- vec.qlang:139-140 null в sum;
- vec.qlang:1017-1018 тег у take;
- `::Box[[1] [2]] | flat` → `::Box[1 2]` (страница об этом молчит);
- ключ у max: vec.qlang:293-294, map.qlang:338-339;
- set.qlang:1355-1356 «binary search» — механизм рантайма, закон его не держит. Удалить.

17. **The language describes itself** — minor
vec.qlang:1520-1522 и 1606-1608 не упоминают set, который слова этих страниц принимают: `[{:a 1 :b 2} #[:a]] | minus` → `{:b 2}`. vec.qlang:1416 говорит «two sets or two maps» про вектор любой длины.

18. **The language describes itself** — minor
Свёртка `::Box#[#[1] #[2]] | union` → `::Box#[1 2]`, а у вектора и у set of maps ответ без тега (`#[1 2]`, `{:a 1 :b 2}`). set.qlang:1093-1102 об этом молчит. По доводу D182 свёртка должна отвечать без тега на обоих видах.

19. **The order of concepts is the order of dependencies** — minor
- min и max читают ключ «as `sort` reads its key» (vec.qlang:227-228), а `sort` стоит позже (895).
- sum чинится через `map` (vec.qlang:140), а `map` стоит позже (331).
- `reduce` стоит последним (1293), хотя sum, count и max «factor through it».
- `has` стоит в трёх файлах в трёх разных местах: vec.qlang:659, set.qlang:1353, map.qlang:1017.

Ремонт: один порядок для всех трёх — сначала слова, исполняющие код, потом меры, членство, срезы, форма, алгебра, построение.

20. **Words carry paradigms** — minor
- set.qlang:944, 957 «already»;
- map.qlang:281, 339, 598 «instead»;
- set.qlang:774, 909, 1376 «was called», хотя остальные страницы отказов написаны в настоящем времени.
