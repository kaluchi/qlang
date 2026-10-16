# Разбор девятого внешнего аудита

Чтение модели, сессия 70702c43, 2026-10-16. Аудит — [D327~1.md](D327~1.md):
чистый Opus с промптом `scripts/outside-audit-prompt.txt` на дереве
6c2b377c, ветка the-trail-the-shape-and-the-marker на базисе 6faa5883;
его вызвала D327, и её `Runs.` держит запуск. Каждое утверждение ниже
проверено запуском `qlang` на том же дереве. Восьмой аудит и его разбор
читаются в истории,
`git show 44fcc725:docs/journal/research/outside-audit/2026-10-15-0504adf4.md`.

## Что поменялось с восьмым

Ушло: не названо снова.

- `keys` и `vals` вразнобой как тихий неверный ответ. Девятый говорит
  лишь, что `keys` и `entries` идут в разном порядке (3.6); страница
  `keys` ведёт к `entries`, решение мейнтейнера в D15 стоит.
- Равные мапы, которые не взаимозаменяемы.
- `coalesce`, глотающий опечатку, D299.
- Церемония функции: страница на каждом входе, рецепт без аргументов.
- Рамка `table`, закрытая в разборе восьмого; шум трейла от группы;
  индекс элемента в отказе `map`, который держит дорога `:index` в D327.
- Старт он не называет, но старт вырос: `qlang '1'` идёт 0,86–0,92 с
  против 0,71–0,75 у восьмого. Ветка добавила существительные очертания;
  держит D268.

Названо снова:

- имя с цитатой отвечает цитатой, D256: `:double ~(mul 2) | 5 | double`
  отвечает `~(mul 2)`, и теперь ещё `map ~double` отвечает
  `[~(mul 2) ~(mul 2)]`;
- хранимый код не видит имён вокруг, D304, четвёртый аудит подряд, и
  снова замыкание через `fill`;
- `reduce 0 ~(add)` против `~(add | it)`, D274;
- два поля одной записи и семейство `*Of`, у девятого резче: абзац первой
  страницы признаёт ловушку;
- `manifest` вперемешку;
- регистр прозы, D294, девятый аудит подряд;
- грамматика, перенос строки и комментарии на символе пайпа, D295;
- `gt "18"` между строками, D311;
- вес процесса и глава работы в `docs/spec/`.

## Что он нашёл нового

Проверено пробами:

- **`is` с тегом, которого никто не объявил, молча отвечает `false`
  (3.1).** `5 | is ::Numbr` отвечает `false`, а `::vec/sortt | doc`
  отказывает с ближайшими. Тег, которого никто не объявил, — вид
  тождества [QSNAM#address], под ним может стоять значение, так что
  `false` верен; но опечатку он не ловит. Внёс в D294.
- **Тег второго слагаемого теряется (3.1).** `::W#5 | add ::H#1`
  отвечает `::W#6`: вход держит значение своего вида, до которого доходит
  обход [QSBLD#input], а ответ держит теги субъекта [QSDSP#answer]. Тег —
  не единица измерения; вид со своим `add`, отвергающим чужой тег, пишет
  читатель.
- **`::W#"a"` — шаблон под тегом, а не строка (3.1).**
  `::W#"a" | payload | type` отвечает `::regex`. По [QSLIT#tag] литерал
  касается тега своим знаком: `#"…"` — знак шаблона, строку пишут
  `::W"a"`. Разбор не путается, путается читатель: `#` у числа — касание,
  у шаблона — его начало. Ось одного представления тега — D297.
- **Отказ слова зависит от того, на скольких видах оно живёт (3.3).**
  `5 | count` отвечает `::call/KindAnswersNoVerbError`, а
  `5 | concat [1]` — `::vec/concat/SubjectNotVecError` [QSDSP#refusal],
  [QSDSP#residence]. Его довод нов: тег отказа — интерфейс, и он сменится,
  когда каталог объявит `concat` на втором виде. Внёс в D311 вместе с его
  дорогой для строк.
- **Строки упорядочены по единицам UTF-16, а считаются по кодовым точкам
  (3.6).** `["ﬁ" "😀"] | sort` отвечает `["😀" "ﬁ"]`, а `"😀" | count` —
  `1`; страницы сравнений строк говорят «by their characters»
  (`core/lib/qlang/string.qlang:95`). [QSORD#order] пишет единицы UTF-16,
  [QSTXT#string] — кодовые точки: у языка два понятия знака.
- **JSON со входа и `parseJson` ставили ключи-индексы вперёд (3.8).**
  `{"b":1,"2":2,"a":3}` со входа давал `[:"2" :b :a]`, литерал — `[:b :"2"
  :a]`. Поправлено, см. ниже.
- **`json` терял ключ `__proto__` (3.8).** `{:"__proto__" 1 :b 2} | json`
  отвечал `{"b":2}`. Поправлено.
- **Проза страниц держит отступ исходника (3.8).**
  `::vec/payload | doc | first | contains "\n            "` отвечает
  `true`; док — литерал, его текст как написан [QSSYN#doc], и `doc` с
  `explain` печатают отступы источника. Внёс в D294.

## Где он ошибся или неточен

- **3.2, «`held.jsonl:39`: `f | eq h`, а поведение у них разное».**
  Случай `a-quote-holds-no-scope` держит обратное: равные `f` и `h` оба
  отказывают `ValueWithheldError`. Разница, которую он имеет в виду, —
  цитата, написанная в шаге, против хранимой [QSQUO#held]:
  `:k 2 | [1 2] | map ~(add k)` отвечает `[3 4]`, а
  `:k 2 | :f ~(add k) | [1 2] | map f` — отказ. Это D304.
- **3.9 и §6, «независимость параллельных вызовов обеспечивает shell, а
  не код возврата».** Код 0 держит харнесс агента: ненулевой код одного
  вызова останавливает параллельные вызовы рядом, так сказал мейнтейнер
  (сессия dda915a5), и страница `::cli` это называет. Довод аудитора эту
  причину не снимает.
- **§6, «D321: дешевле, чтобы `:nearest` предлагал `count`».** D321 это
  взвесила и отложила: подсказка оставляет раундтрип. Нового довода нет.
- **3.5, три формы условий.** Каждая по своему правилу: условие `if`
  вычисляется всегда, поэтому значение [QSCND#branch]; часть, что бежит
  по элементу или по выбору, — цитата [QSQUO#modifier];
  `allOf ~(…) ~(…)` ленив целиком [QSCND#boolean]. Пример первой страницы
  смешивает формы, чтобы показать жадный модификатор.
- **3.2, `map f` с функцией.** Вход кода берёт цитату или путь, функцию
  берёт `apply` [QSQUO#modifier]: `:f (::fn | takes :by |~~ b ~~| /0 |
  impl ~(add by)) | [1 2] | map f` отказывает
  `::vec/map/code/KindNotTakenError`. Так задумано.
- **3.3, `:vec/sum ~(count)` и `NameDeclaredTwiceError`.** Адрес корня
  объявляется один раз [QSNAM#address], и страница отказа называет
  корень. Не ошибка.
- Счёты верны с округлением: `held.jsonl` — 41 случай, `.qlang` — 14096
  строк, `replaced/` — 297, глава работы — 614 строк.

## Что просит вашего слова

1. **Код возврата.** Девятый первым голосует за ненулевой код. Ваш довод —
   харнесс. Дорога, которая его не трогает: флаг для скриптов,
   `--exit-on-failure`, при умолчании 0.
2. **Порядок строк.** Упорядочить строки по кодовым точкам, как их
   считает `count`, или оставить UTF-16 и написать это на страницах
   сравнений.
3. **Три корня.** Девятый сводит большую часть открытых записей к трём
   решениям: код без замыканий, одно пространство имён значений и слов,
   модификатор только от субъекта. Пересмотр корня закрыл бы больше
   записей, чем точечные правки. Это вопрос стратегии, а не правка.

## Что сделано без вашего слова

- JSON со входа и `parseJson` читаются, как литерал: ключи в порядке
  текста, `fromJsonText` в `core/src/runtime/format.mjs`. Против прежнего
  чтения на девяти тысячах сгенерированных документов значения равны
  везде; порядок разошёлся там, где есть ключи-индексы, и теперь он
  текстовый.
- `json` пишет ключ `__proto__`, как любой.
- D256 получила случай `:double`; D294 — `is` с необъявленным тегом и
  отступ прозы; D311 — отказ, зависящий от числа видов слова, и дорогу
  для строк, читающихся числами.

## Судьбы находок

The problems, its third section:

1. Silent wrong answers. The name that holds a quote, read as a later step, open as D256, the case of `map ~double` carried there; `is` over a tag no declaration names carried into D294; the tag of an addend left by [QSBLD#input] and [QSDSP#answer]; a pattern under a tag by [QSLIT#tag], one representation of a tag open as D297; the comparison of strings open as D311.
2. Code as a value. Held code open as D304, the closure by `fill` among its roads; the case it cites holds equal quotes behaving alike; a function refused where code is taken by [QSQUO#modifier]; `reduce` open as D274.
3. One namespace of values and words. A value meeting a word by [QSNAM#reach]; the refusal of a subject by the count of residences carried into D311; a second declaration of a root address by [QSNAM#address].
4. Arithmetic from the subject. By [QSNUM#combine]; a word that combines a vector waits for a task, as `spread` of the eighth did.
5. Three forms of conditions. By [QSCND#branch], [QSQUO#modifier] and [QSCND#boolean].
6. Collections and tags. `keys` by the maintainer's D15; `map` by [QSDSP#answer]; `sort` across kinds against `lt`, D311; the order of strings asks the maintainer's word.
7. `manifest`. By [QSSLF#manifest], as in the eighth.
8. The codec and the print. The order of the keys of a JSON text and the key `__proto__` repaired in the branch; the indentation of a page's prose carried into D294.
9. The exit code. The maintainer's decision, [QSHST#answer]; a flag for scripts asks his word.
10. The private dialect. Open as D294.
11. Complexity. The comments and the line break open as D295; the chapter of the work stands in `docs/spec/` by [QSWRK#documents].

Its proposals, the fifth section: the flag of the exit code asks the maintainer's word; the ordered codec and `__proto__` done; the indentation of prose with D294; `manifest` as a record and signatures wait for a task, as in the eighth; the closure by `fill` in D304; one protocol of code by [QSQUO#modifier]; arithmetic over a vector waits for a task; one form of conditions set aside by the rules of the third section; a warning where a name a reader declares is a word's waits beside the trivia of D256; one tag for a subject a word does not serve carried into D311; NDJSON and files as arguments, the input of a host, wait for a task; `shape`, `paths` and `elide` on the first screen meet D333 and the outline of D327; the glossary with D294; the chapter of the work by [QSWRK#documents]. Its disagreements, the sixth: "everything is a value" and held code, D304, the case it cites holding the opposite; "words carry paradigms", D294; one model, D304 and [QSNAM#reach]; the comments of the grammar, D295; D321 weighed `:nearest` and set it aside; D256 takes its case; D311 takes its road for strings that read as numbers; the exit code stands on the harness and its flag asks the maintainer's word; the host boundary agreed, the codec repaired; the three roots ask the maintainer's word.
