<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at c0ee20a9 and checking docs/spec/QSSLF-the-language-describes-itself.md, docs/spec/QSPRN-printing-and-codecs.md and docs/spec/QSHST-hosts-and-the-command-line.md, on 2026-10-15 from 11:10 to 11:30 UTC. Its prompt is `scripts/spec-check-prompt.txt` at c0ee20a9. -->

### design · QSSLF#axis

«A tag nothing declares whose last name ends in `Error` reads the record of the address before it; any other name nothing declares is refused under the axis». В QSSLF#near сказано: «a tag nothing declares … refused with `:nearest`».

```qlang
> ::number/add/SubjectNotNumbrError | doc | eq (::number/add | doc)
true

> ::number/add/SubjectNotNumbrError | laws | keys
#[:addsTheNumber :answersUnderTheTag :computesTheAddendAgainstTheSubject :refusesASumPastTheDoubles]

> ::number/add/SubjectNotNumbrError | manifest | count
4

> ::number/ad/SubjectNotNumberError | doc !| get [~(type) /nearest]
[::any/doc/UnknownNameError [::number/add/SubjectNotNumberError]]
```

Правило, написанное для отказов, которые рантайм поднимает «by rule», ловит любую опечатку в имени отказа. `doc`, `laws` и `manifest` молча отвечают тем, что лежит под словом, а опечатка в середине адреса получает отказ с `:nearest`. Какой ответ был бы последовательным для тега на `Error`, который не объявлен и который рантайм не поднимает?

### conflict · QSPRN#span

«A payload that is no vector is refused as `…/PayloadKindNotTakenError`». QSBLD#input говорит: «Kinds written as a vector of one tag or of one set are the kinds of each element: the input holds a vector, or a set, of the value of its kind of each». `::span` объявлен как `wraps … [::number]`.

```qlang
> ::span#[5 4 3 2 1 0] | start
::point#[0 1 2]

> ::span#[0 1 2 3 4 5] | get [~(payload | type) ~(start | payload | type) ~(eq ::span[0 1 2 3 4 5])]
[::set ::set false]
```

QSPRN отказывает всему, что не вектор, а правило QSBLD для видов «of each element» принимает и множество. Множество переставляет шесть чисел по одному порядку, и `start` отвечает точкой поверх множества.

### design · QSSLF#doc

«`content` answers the text, each quote and its tags where it stands, written as its literal spelled it». QSQUO#literal: «Two quotes are equal when their steps are, spacing and comments aside».

```qlang
> |~~ ~({"a":   1}) ~~| | :x it | |~~ ~({:a 1}) ~~| | :y it | get [~(x | eq y) ~(get [~(x) ~(y)] | distinct | print) ~(get [~(y) ~(x)] | distinct | print)]
[true "#[|~~ ~({\"a\":   1}) ~~|]" "#[|~~ ~({:a 1}) ~~|]"]
```

Два дока равны по `eq` и сливаются в одно множество, но печатаются по-разному. Поэтому печать одного и того же множества зависит от того, в каком порядке пришли элементы. Что последовательно отвечать `print` и `content` для равных значений?

### design · QSHST#answer

«a budget is asked for, `| elide N` in the query or `--budget=N` before it, a whole count of characters above zero on either road, which prints every answer as `elide` cuts it». QSERR#catch: «`|` passes it by».

```qlang
> 250 | range | map ~("a") | join "" | add 1 | elide 150 !| get /trail/-1/skipped
~(elide 150)
```

```sh
$ qlang --budget=150 '250 | range | map ~("a") | join "" | add 1' < /dev/null
|~| raised, and no !| caught it
::number/add/SubjectNotNumberError!{
  :actualType ::string
  :trail [
    {
      :step ~(add 1)
      :subject ::elision{
        :size 250
        :read ~(!| get /trail/0/subject)
        :head "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
      :skipped ~()
    }
  ]
}
|~| `add` adds to a number: two fields of one record add by `sumOf /x
|~| /y`, a vector adds to each element by `map`, `map ~(add 1)`, a
|~| string joins by `append`, and text that holds a number is read first
|~| by `toNumber`.
```

Глава называет эти два способа равными. Но сбой обходит шаг `| elide N`, и его субъект выходит целым, 250 символов, а `--budget=N` обрезает тот же сбой до маркера. Как последовательно ответить бюджету, заданному в запросе, когда ответ — сбой?

### design · QSPRN#print

«Every host prints an answer through `print`, the command line a string as its text and the REPL as its literal». QSNAM#owner: «an extension of a kind of another owner stays where it was written».

```qlang
> :vec/print ~("V") | [1] | print
V

> :vec/print ~("V") | [1]
[1]

> :Box |~~ B ~~| | :Box/print ~("box") | ::Box#1
box
```

`print` из запроса и командная строка печатают один и тот же ответ по-разному, когда читатель расширил `print` у вида корня. Для собственного вида читателя они совпадают. Какую печать хост должен давать последовательно?

### conflict · QSHST#source

«A `::builtin{}` written in the recipe of a word a reader declares is the value it is: the word's address answers its function as a value, and its bare name reaches no word». QSNAM#address: «The value says what the node is: … a function or a quote under a label a word … Written as a step, an address reads what it declared, a word run».

```qlang
> :any/v (::fn | impl ::builtin{}) | 5 | get [~(any/v | type) ~(v !| type)]
[::fn ::call/UnknownNameError]

> :any/v (::fn | impl ~(it)) | 5 | get [~(any/v) ~(v)]
[5 5]
```

По QSNAM функция под меткой — это слово, которое адрес запускает. По QSHST та же функция с рецептом `::builtin{}` — значение: адрес её не запускает, и голое имя её не достигает.

### design · QSSLF#laws

«`runLaws` runs each as held code on null, the laws of a member when it is given its anchor, `::qlang | runLaws :errors`». В QSSLF#axis сказано: «`laws`, `explain`, `manifest` and `tutorial` take no member».

```qlang
> ::qlang | runLaws :errors | count
8

> ::qlang | laws :errors !| type
::any/laws/ArgsBeyondInputsError

> ::qlang | doc :errors | type
::doc
```

Законы одного и того же члена запускаются через якорь, а прочитать их через тот же якорь нельзя: страница `laws` отсылает к адресу. Последовательно ли, что одни и те же записи по якорю читают `doc`, `binding`, `source` и `runLaws`, а `laws`, `explain`, `manifest` и `tutorial` — нет?

### case · QSSLF#explain

«The page of a refusal says what failed, which fact names the culprit and how the call is repaired, and its laws hold the recovery through `!|`». Ни один кейс этого не проверяет, и дерево это правило не держит.

```qlang
> [::span/start/SubjectNotSpanError ::any/put/path/KindNotTakenError ::string/scan/pattern/KindNotTakenError ::call/HostFailureError] | map ~(laws | count)
[0 0 0 0]

> kinds | toVec | :ks it | map ~(manifest) | flat | :n1 it | map ~(manifest) | flat | :n2 it | map ~(manifest) | flat | :n3 it | get [~(ks) ~(n1) ~(n2) ~(n3)] | flat | filter ~(toString | endsWith "Error") | :errs it | filter ~(laws | count | eq 0) | get [~(errs | count) ~(count)]
[459 70]
```

Из 459 отказов на трёх уровнях под видами у 70 нет ни одного закона, хотя глава говорит, что законы отказа держат восстановление через `!|`.

### text · QSSLF#manifest

«`manifest` … answers the set of the nodes declared one name under the name its subject reads: its words, its refusals, its pages, the payload and the fields of a kind, and the inputs, the subject and the answer of a word». Кейсы QSERR/site.jsonl:5 (`::error | manifest | has ::error/actualType`) и QSBLD/label.jsonl:3 (`::Box/construct` в манифесте) держат больше.

```qlang
> :Box |~~ B ~~| (::kind | carries :size |~~ s ~~| ::number | throws :BadError |~~ b ~~| | carries :BadError/why |~~ w ~~| ::string) | get [~(::Box | manifest) ~(::Box/BadError | manifest)]
[#[::Box/BadError ::Box/size] #[::Box/BadError/why]]

> ::vec | manifest | filter ~(toString | endsWith "construct")
#[::vec/construct]
```

Манифест отвечает и факты (`carries`), и конструктор, а перечень главы их не называет.

### text · QSHST#answer

«a call with no query, an argument after the query, a `--budget` that is no positive count and a `--color` other than `auto`, `always` and `never` are refused with a usage line and the code 2; any other argument before the query is read as the query».

```sh
$ qlang --version < /dev/null
@kaluchi/qlang-cli 0.10.0
$ grep -n "'-h'\|'-V'\|'--repl'" cli/src/argv.mjs
90:    if (head === '-h' || head === '--help')    return { kind: 'help' };
91:    if (head === '-V' || head === '--version') return { kind: 'version' };
92:    if (head === '-i' || head === '--repl') { isRepl = true; cursor += 1; continue; }
```

По фразе главы `--version` и `--help` читались бы как запрос. Командная строка берёт их как флаги, а глава не называет ни их, ни `--repl`.

### text · QSPRN#print

«a vector and a map by their brackets around the print of each element». Кейс QSSLF/explain.jsonl:9 держит раскладку печати по строкам (`contains "::explanation{\n  :page |~~"`), а глава о ней молчит.

```qlang
> [{:a 1} {:a [1]} [[1]] {:a {:b 1}}] | map ~print
["{:a 1}" "{\n  :a [1]\n}" "[[1]]" "{\n  :a {:b 1}\n}"]
```

Map, в котором лежит контейнер, печатается по строкам с отступом в два пробела, вектор — в одну строку. Глава такого правила не формулирует.

### text · QSPRN#elide

«a whole count above zero, another refused as `::any/elide/budget/NotCountError`». Страница `::any/elide` объявляет `throws :budget/KindNotTakenError` и закон `refusesAString`.

```qlang
> [1 2] | elide "x" !| type
::any/elide/budget/KindNotTakenError

> [1 2] | elide -3 !| type
::any/elide/budget/NotCountError
```

Под `NotCountError` глава подводит любой «another» бюджет. Страница и дерево так отказывают только числу; бюджету другого вида отказ идёт под `KindNotTakenError`.

### case · QSSLF#manifest

Кейс QSSLF/manifest.jsonl:24 `a-noun-lists-the-refusals-of-its-verbs`: `::number | source | parse | contains "throws :addend/KindNotTakenError"`. Кейсы :25 и :26 читают `binding | get /value | get /0`, то есть цепочку вида.

```qlang
> ::number | manifest | has ::number/add/addend/KindNotTakenError
false

> ::number | source | parse | contains "throws :addend/KindNotTakenError"
true

> ::Box::vec | get [~(manifest | eq (::vec | manifest)) ~(manifest | eq (::tag | manifest))]
[false true]
```

Кейс :24 показывает правило `source` из QSSLF#axis («every declaration written under its address»). Кейсы :25 и :26 показывают, что держит цепочка вида (QSBLD#kind), а не манифест. Кейс :3 `a-tag-over-a-name-passes-to-manifest` проверяет только `::set`, хотя манифест здесь не переходит к имени `::vec`, а читает вид `::tag`.

### case · QSPRN#print

Кейсы QSPRN/print.jsonl:9–17: `{"name":"true","query":"true","expect":"true"}`, `{"name":"doc-line-form-renders-as-block","query":"|~~| oneliner","expect":"|~~ oneliner~~|"}` и остальные.

```sh
$ grep -n "deepEqual(queryResult, expectedValue)" core/test/unit/conformance.test.mjs
133:        const answersAsExpected = deepEqual(queryResult, expectedValue);
```

Раннер сравнивает значения, поэтому эти кейсы без `print` в запросе показывают чтение литерала (QSLIT, QSSYN#doc), а не печать, хотя по имени говорят о печати.

### case · QSHST#source

Кейсы QSHST/source.jsonl:1 `a-builtin-written-in-a-recipe-is-a-value` и :2 `a-builtin-in-a-declared-word-is-the-value-it-is`: `:any/c ~(::builtin{}) | 42 | c | type`.

```qlang
> :any/c ~(::builtin{}) | 42 | get [~(c | type) ~(any/c | type)]
[::builtin ::builtin]
```

Правило секции — голое имя слова, чей рецепт `::builtin{}`, не достигает слова. В этих кейсах `::builtin{}` стоит шагом внутри цитаты-рецепта, голое имя слово достигает, и кейсы правила не показывают; его показывает только кейс :11.

### design · QSPRN#json

«a value under a tag as the object `{"$tag": name, "payload": …}` …, an error at rest two such layers, the tag of its site over `error`». Блок кода, который цитирует эту секцию, пишет сбой иначе.

```qlang
> "x" | add 1 !| json
{"$tag":"number/add/SubjectNotNumberError","payload":{"$tag":"error","payload":{"actualType":"::string","trail":[{"step":"~(add 1)","subject":"x","skipped":"~()"}]}}}
```

```sh
$ grep -n '\$error' core/src/runtime/format.mjs core/test/unit/print-value-extras.test.mjs
core/src/runtime/format.mjs:55:  error:   e => ({ $error: { $tag: e.tag.name, facts: toPlain(e.descriptor) } })
core/test/unit/print-value-extras.test.mjs:100:  it('as the object of its $error, its tag and its facts [QSPRN#json]', async () => {
core/test/unit/print-value-extras.test.mjs:102:    expect(Object.keys(plain)).toEqual(['$error']);
core/test/unit/print-value-extras.test.mjs:103:    expect(plain.$error.$tag).toBe('number/add/SubjectNotNumberError');
core/test/unit/print-value-extras.test.mjs:104:    expect(plain.$error.facts.actualType).toBe('::string');
```

`json` пишет ошибку двумя слоями `$tag`/`payload`, а `toPlain` на границе хоста пишет то же содержание формой `$error`/`facts`, и тест ссылается на эту форму как на `[QSPRN#json]`. Какая JSON-форма ошибки была бы одной на обоих путях?

### text · QSSLF#axis

«`doc` takes as well a vector of names as a path of members and a set as several pages, … an element that is no keyword as `::any/doc/anchor/ElementNotKeywordError` with its `:index`, the place in the set of an element that is neither a name nor a path». Кейс QSSLF/axis.jsonl:48 `a-set-of-anchors-takes-null-and-a-path-of-anchors`.

```qlang
> ::qlang | doc #[null [:pipeline]] | count
2
```

Кейс держит `null` как элемент множества якорей (страница самого субъекта), а по тексту главы такой элемент, не имя и не путь, должен быть отказан.
