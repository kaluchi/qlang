# Разбор ревью работы D422 перед закрытием ветки the-tag-not-the-type

Чтение модели, сессия 586bb820, 2026-10-24. Отчёт — [D422~1.md](D422~1.md):
рецензент, которого сессия запустила над коммитом fd5dd020 до закрытия, на
дереве fd5dd020 (база 3945bed3), 20:44–21:12 UTC, вердикт `changes asked`,
восемь находок. Главные: неявный признак вида без payload терял `carries`,
`tells` и вид без команд; метка карт не ловила поднятое значение; `toVec`
квоты под тегом отвечал квотой; повторная укладка тега пропускала
инварианты. Всё это ветка починила, неявный признак сменила явным
`wraps … #[]`, а после ревью, по слову мейнтейнера, тег при укладке
спрашивает тот же обход, что `is` (D422, решение 1).

Промпт, на который он отвечал:

```text
You are a clean reviewer of one commit of the qlang repository at D:\git\qlang (a pipeline query language; read CLAUDE.md there for how the project works). Review the commit fd5dd020 on the branch the-tag-not-the-type ("Lay a tag once and take a payload by its own tag (D422)"). Do not edit, create, commit or stage anything; read only. The language runs as `node cli/src/bin.mjs '<query>' < /dev/null` from the repository root (in Git Bash a query must not begin with `/`); use it to probe every claim you make about behaviour before you make it.

What the commit means to do is the decision of the record docs/journal/D422.md, items 1 to 7; read it whole first, then docs/journal/AIM.md (the principles a change is judged by) and docs/spec/QSRVW-the-reviews-and-the-research.md section `review`. In short: (1) a tag laid over a value that already answers it (as `x | tag` reads it) changes nothing, every kind but the kinds of the core, whose constructors read a value of their own kind as itself; (2) a kind takes the payload its `wraps` names by the payload's OWN tag (no walk through tags), for a kind of the core and a kind of the reader alike, while the elements of a payload and the fields a kind reads are still held through their tags; (3) a kind whose chain names no payload (no wraps, reads or holds, no constructor) refuses any payload as `<tag>/PayloadNotTakenError` (`::any`, `::tagged`, `::qlang`, `::cli`), and five tags of shapes and views now write `wraps`; (4) `desc` turns: under `::desc` it answers the payload, otherwise lays `::desc`; (5) `toVec` of a quote and a doc answer their vector; (6) `is` refuses a call of no kind.

Read whole, with the file-reading tool, every file of the code the commit touches: core/src/eval.mjs, core/src/chain.mjs, core/src/nouns.mjs, core/src/types.mjs, core/src/address.mjs; and the diff of every other file (`git show fd5dd020 -- <path>`), reading whole the catalog sources whose pages it changes where you need their context (core/lib/qlang/any.qlang is large: read the declarations of :any, :any/tag, :any/desc, :any/is whole). Also core/src/dispatch.mjs (walkToKinds) and core/src/runtime/constructors.mjs (the guards of the kinds of the core) for context.

Hold the diff to three questions and probe each finding:
1. Correctness: does the code do what the decision says on every road a value takes? Look for holes: a tag laid by the answer rule of a verb (keptAsSubject, underTags, answerUnderItsLabel in eval.mjs) meeting the new idempotence or the new guard; invariants of a reader's kind skipped by the idempotence (a value tagged before its kind was declared, then laid again); a kind with only `throws`/`proves`/`tells` declared by a reader now refusing payloads it took before; `::desc` and its builtin constructor; error values at rest under a tag (`::Late!{…}`, `raise`); the fuzz of printing; sets, quotes and docs (vectors under a header tag) under `wraps ::vec`; anything the 3400 tests would not catch.
2. The rules of the work: one fact one spelling, names of the code as the language names things (docs/spec/QSLEX-the-words-and-the-names.md), comments of the code being marks alone, the pages of the catalog telling the rule they prove with laws that are not vacuous, the record's text true of the tree.
3. Quality: would a very strong engineer write this code and these pages this way? Name what reads as a patch or a special case and how it would read better.

Answer with the text of the report and nothing else: a verdict line, `Verdict: accepted` or `Verdict: changes asked`, then the findings, each a short paragraph that opens with `file:line`, says what is wrong, the principle or rule it breaks, and the probe (query and answer) that shows it. Order them by severity. Keep the report under 1500 words. If you find nothing worth changing, say so plainly.
```

Судьбы, каждая с пробой на дереве после починки:

1. **`namesNoPayload` не читал `carries`.** Починено иначе, чем предлагал
   рецензент: неявного признака больше нет. Тег без payload пишет это сам,
   `wraps |~~ … ~~| #[]` (`::tagged`, `::qlang`, `::cli`), а вид, который
   не называет видов payload, берёт любой.
   `:Oops |~~ A failure of mine. ~~| (::kind | carries :message |~~ The message. ~~| ::string) | ::Oops{:message "boom"} | tag`
   → `::Oops`.

2. **Метка карт не ловит поднятое значение.** Оставлено правилом (D422,
   решение 2): метка берёт ошибку в покое по её собственному тегу,
   `::error`. Метка, чей `wraps` называет одни карты, отказывает на ловле,
   и отказ уходит к следующей ловле; `#[::map ::error]` её держит;
   пойманный отказ ложится под метку через свой payload. Кейсы:
   `a-catch-whose-label-takes-maps-alone-refuses-the-error-at-rest` и
   `a-catch-whose-label-takes-errors-holds-the-error-at-rest-under-it` в
   `QSERR/catch.jsonl`,
   `the-error-literal-stays-under-the-tag-of-maps-and-is-refused-by-a-label-of-maps`
   в `QSERR/rest.jsonl`.
   `:Late |~~ L ~~| (::kind | wraps |~~ e ~~| #[::map ::error]) | get [~("x" | add 1 !| tag ::Late !| get [~(tag) /actualTag]) ~("x" | add 1 !| payload | tag) ~("x" | add 1 !| payload | tag ::Late | tag)]`
   → `[[::Late/PayloadKindNotTakenError ::number/add/SubjectNotNumberError] ::error ::Late]`.

3. **`quote/toVec` под тегом.** Починено, как предлагал рецензент:
   `quote/toVec` и `doc/toVec` стоят на общем примитиве `vec/toVec` и
   `set/toVec` (`core/src/runtime/convert.mjs`), рецептов `~(payload)` и
   `~(segments)` нет, законы обоих держат субъект под тегом.
   `get [~(::Box~(add 1 | mul 2) | toVec | tag) ~(::Box#[2 1] | toVec | tag) ~(|~~ a ~~| | tag ::Box | toVec | tag)]`
   → `[::vec ::vec ::vec]`.

4. **Четыре пробы глав без пробы того же запроса в записи.** Починено: D422
   держит пробы тех же запросов для QSBLD:280, QSBLD:339, QSCND:240 и
   QSORD:155 и ещё трёх, которые повернула укладка по обходу: QSCND:228,
   QSLIT:195 и QSSLF:279. `node scripts/sensors/run-probes.mjs docs/journal/D422.md`
   → шестнадцать `ok`. Пробы, сменившиеся с `actualTag`, принадлежат D442 и
   ждут закрытия.

5. **Повторная укладка до чтения объявления.** Починено: внешний тег
   значения кладётся заново над payload под ним, через вид.
   `::Pos#-3 | :Pos |~~ A positive number. ~~| (::kind | holds :NotPositiveError |~~ Above zero. ~~| ~(gt 0)) | tag ::Pos !| tag`
   → `::Pos/NotPositiveError`. Тег, стоящий глубже другого, по решению 1
   остаётся как есть: значение уже принадлежит ему. Пример с `::Mark{:a 1}`
   распался вместе с неявным признаком:
   `::Mark{:a 1} | :Mark |~~ M ~~| (::kind | proves :p |~~ p ~~| ~(true)) | get [~(tag ::Mark) ~({:a 1} | tag ::Mark)]`
   → `[::Mark{:a 1} ::Mark{:a 1}]`.

6. **Страницы старого правила.**
   - `invariant.qlang` и `law.qlang`: payload — «a quote», одной строкой
     `wraps`. `::law::Foo~(3 | eq 3) !| tag` → `::law/PayloadKindNotTakenError`.
   - `desc.qlang`: закон `buildsByItsConstructor`, `impl` и регистрация
     конструктора (`core/src/runtime/constructors.mjs`) ушли, голова модуля
     говорит о законах.
   - `kind.qlang:34-35` и `qlang.qlang:704` снова верны: вид без команд
     берёт payload как есть.
     `:K |~~ K ~~| (::kind[~() null]) | get [~(5 | tag ::K) ~(:L |~~ L ~~| | 5 | tag ::L)]`
     → `[::K#5 ::L#5]`.
   - Отказ тега без payload — обычный `PayloadKindNotTakenError`, его
     страница — `throws` цепочки тега, у вида читателя — страница отказа
     видов. `5 | tag ::tagged !| explain | page | content` → «`::tagged`
     names the verbs of every value under a tag and takes no payload: …»;
     `:Topic |~~ A topic. ~~| (::kind | wraps |~~ None. ~~| #[]) | 5 | tag ::Topic !| explain | page | content`
     → «`payload` holds no value.»
   - Страница `::any/tag`: «the payload its `wraps` names». Вид без `wraps`
     берёт любой:
     `:Pt |~~ P ~~| (::kind | reads :x |~~ x ~~| /x ::number) | ::Pt::T{:x 1}`
     → `::Pt::T{:x 1}`.
   - `kind/wraps`: закон `takesNoPayloadOfASetOfNoKinds` над видом
     читателя; закон `refusesAnEmptySetOfKindsOfThePayload` сменился законом
     `refusesAnEmptySetOfKindsOfEachElement`.

7. **Конструктор как `constructorOf(kind) === null`.** Ушло вместе с
   `namesNoPayload`.
   `:Box |~~ A parcel. ~~| (::kind | tells :start |~~ Where to start. ~~|) | 5 | tag ::Box`
   → `::Box#5`.

8. **Качество.**
   - Мёртвая ветка `kindName === ANY_KIND_NAME` и `ownTagIs` ушли. Страж
     payload, `payloadHeldByItsKinds` (`core/src/eval.mjs`), читает голову
     payload по её тегу, `tagOf`, как его читает `tag`, а элементы — через
     их теги, `walkToKinds`, как `is`: два вопроса, по предикату на каждый.
   - Страж payload стоит отдельно от `heldByItsKinds`, который держит входы
     функции и поля вида через их теги; ветки квоты, дока и множества
     служат этим дорогам.
   - Отказ один, `PayloadNotTakenError` нет:
     `:Mark |~~ M ~~| (::kind | wraps |~~ None. ~~| #[]) | :any/mk (::fn | returns |~~ r ~~| ::Mark | impl ~(5)) | 1 | mk !| tag`
     → `::any/mk/answer/KindNotTakenError`.
   - `isInvariant` и `isLaw` (`core/src/nouns.mjs`) читают
     `isQuote(value.payload)`, без `beneathTags`.

После ревью мейнтейнер спросил, почему `5 | tag ::any` отказывает, когда
`5 | is ::any` отвечает `true`, и попросил согласованного поведения. Тег при
укладке спрашивает тот же обход, что `is`: `5 | tag ::any`,
`#[2 1] | tag ::vec`, `::Box#5 | tag ::number` и `!{:a 1} | tag ::map`
отвечают субъектом. `::any` больше не пишет `#[]`, а законы и кейсы
`::map` и `::vec`, где вид ядра отказывал значению своего вида, переписаны
под D422.
