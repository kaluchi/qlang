> A check of the chapters `QSTXT`, `QSCND`, `QSQUO` for D319 by a clean Opus answering `scripts/spec-check-prompt.txt`.
> Tree `c91769c4`, itself the baseline; run 2026-10-15, 09:34–09:47 UTC. A path it names reads as `git show c91769c4:<path>`.
> Run as `claude -p --model opus` from an empty directory with `--restricted` and `--strict-mcp-config`, tools `Read Grep Glob Bash`, `qlang`, `grep` and `git ls-files` allowed, no CLAUDE.md, memory or MCP server, no `FORCE_COLOR`.

### design · QSCND#compare

«`gt`, `gte`, `lt` and `lte` … compare the subject with a value of its kind by the one order [QSORD#order]». Если объект сравнения — значение под тегом, `gt` сравнивает payload, а `max` и `sort` ранжируют те же два значения по единому порядку, где число стоит раньше любого тега. На вопрос «что больше» два пути отвечают противоположно:

```qlang
> 5 | gt ::Box#3
true

> [5 ::Box#3] | max
::Box#3

> [5 ::Box#3] | sort
[5 ::Box#3]

> 5 | gt (3 | desc)
true

> get [5 ~(3 | desc)] | max
::desc#3
```

`gt` и `max`/`sort` по-разному упорядочивают одну и ту же пару. Вопрос: под каким тегом значение-объект сравнения должно попадать в `gt` — по своему payload или по единому порядку, как его видят `max` и `sort`?

### design · QSCND#coalesce

«a call whose alternatives are all values puts the subject first, so `query /timeout | coalesce 30` reads the timeout, else 30». Значение, вычисленное при вызове, и цитата дают разные ответы на один вопрос. Кроме того, добавление одной альтернативы-кода исключает субъект из перебора:

```qlang
> {:t null} | coalesce (get /t) 30
{:t null}

> {:t null} | coalesce ~(get /t) 30
30

> {:a 1} | coalesce /b (get /a)
1

> {:a 1} | coalesce (query /b) (get /a)
{:a 1}

> [1] | coalesce []
[1]

> [1] | coalesce [] ~(5)
[]
```

Правило «subject first» срабатывает по виду других альтернатив, а не по смыслу той, которую пишут. Вопрос: каким должен быть ответ `coalesce`, если альтернатива написана группой, а не цитатой или путём, и остальные альтернативы при этом те же?

### design · QSCND#boolean

«an error computed at the call [is refused] at its own [index]» (allOf) и в QSCND#coalesce: «a value computed at the call that is a failure is the answer of the call [QSQUO#modifier]». Оба входа принимают и код, и значение, и оба ссылаются на одно правило QSQUO#modifier, но провал, вычисленный при вызове, обрабатывают противоположно:

```qlang
> 5 | allOf (1 | div 0) true !| get [~(type) /index /actualType]
[::any/allOf/conditions/ElementKindNotTakenError 0 ::number/div/divisor/ZeroError]

> {} | coalesce (1 | div 0) 5 !| type
::number/div/divisor/ZeroError
```

QSQUO#modifier различает только «input that takes code» (провал отвергается под входом) и «input of a value» (провал передаётся дальше). Вход, который принимает и то и другое, это правило не определяет. Вопрос: какой из двух ответов должен давать вход, принимающий и код, и значение?

### design · QSTXT#split

«`split` and `join` by one separator round-trip». При этом `join` пишет разделитель-keyword «as its name», а QSTXT#search: «a word that reads text refuses a keyword for its text». Вместе эти правила ломают обещанный round-trip:

```qlang
> ["a" "b"] | join :x
axb

> "axb" | split :x !| type
::string/split/separator/KindNotTakenError
```

Каждое правило по отдельности сформулировано так, как задумано, но вместе они дают разделитель, который `join` принимает, а `split` отвергает. Вопрос: должен ли keyword-разделитель работать одинаково в обе стороны?

### conflict · QSCND#coalesce

Глава: «Code that answers a failure is taken as no value, as null is». Страница `::any/coalesce`: «Answers the first answer … that is neither null nor an error», returns: «The first answer that is neither null nor an error, null when every alternative answers one». Ошибку в покое дерево не пропускает:

```qlang
> {} | coalesce ~(!{:a 1}) 5
!{:a 1}
```

Глава пропускает только провал, страница — любую «error», а ошибка в покое по QSERR#rest является обычным значением.

### conflict · QSCND#coalesce

QSERR#flow: «Code a word runs that answers a failure answers the word, the elements after it left unrun». QSCND#coalesce: «Code that answers a failure is taken as no value, as null is»:

```qlang
> [1 2] | map ~(div 0) !| type
::number/div/divisor/ZeroError

> {} | coalesce ~(1 | div 0) 5
5
```

Общее правило QSERR#flow о коде, который отвечает провалом, расходится с правилом `coalesce`, и ни один из двух текстов не называет другое правило исключением.

### conflict · QSQUO#modifier

QSQUO#apply называет функцию кодом: «`apply` runs code against its subject: a quote, a path … or a function». QSNAM#value: «Code under a bare name runs by `apply`, or goes bare into an input that takes code». QSQUO#modifier же допускает функцию только у `apply`: «An input that takes code takes a quote or a path, …, `apply` a function too»:

```qlang
> :f (::fn | takes :by |~~ How much. ~~| /0 | impl ~(add by)) | [1 2] | map f !| type
::vec/map/code/KindNotTakenError
```

QSNAM#value обещает, что любой код под именем можно передать голым во вход, принимающий код. QSQUO#modifier исключает из этого функцию, которую QSQUO#apply считает кодом.

### text · QSTXT#pattern

«what stands between the quotes reaches the engine as written, a backslash with the character after it, so `\"` is a quote that does not end the literal». Источник `\"`, переданный движку как есть, — это не паттерн. Литерал же передаёт движку голую кавычку:

```qlang
> "\"" | toRegex
#"\""

> "\\\"" | toRegex !| type
::string/toRegex/TextNotPatternError
```

Литерал `#"\""` записывает источник `"`, без обратной косой черты. Значит, `\"` не доходит до движка «as written», а фраза утверждает обратное.

### case · QSCND#quantify

Правило «a predicate that answers a failure hands it on as the answer» не подтверждено ни одним case в `QSCND/quantify.jsonl`, и QSERR/flow.jsonl тоже не содержит case для `every`/`any`:

```qlang
> [1 2] | any ~(div 0) !| type
::number/div/divisor/ZeroError
```

```sh
$ git -C D:/git/qlang ls-files --error-unmatch core/test/conformance/QSCND/quantify.jsonl
core/test/conformance/QSCND/quantify.jsonl
```

Правило раздела не держит ни один case.

### case · QSTXT#split

Правило «the empty text cutting at every code point» не подтверждено ни одним case: `split.jsonl:60` режет пустым паттерном `#""`, а не пустым текстом. Закон `::string/split` `keepsAnEmojiWholeAtTheEmptySeparator` это правило доказывает, но по QSWRK#cases «a requirement a law proves as well stays a case»:

```qlang
> "a😀b" | split ""
["a" "😀" "b"]
```

Правило раздела держат только законы страницы, case его не держит.

### case · QSQUO#step

Правила «a group as its quote under `::group`» и «[a quote built over a path alone] answers the path it holds» не подтверждены ни одним case. `::group` не встречается ни в одном файле conformance, а `::fail` проверяется только под QSSYN#comment (`comment.jsonl:35`, `:38`):

```qlang
> ~(add (1)) | first | get /modifiers | first | type
::group

> {:age 3} | apply ([/age] | tag ::quote)
/age
```

Два правила раздела не держит ни один case.

### case · QSTXT#string

Правило «the empty string holding none» (про `lines`) не подтверждено ни одним case: в `string.jsonl` есть только `:14` и `:18`:

```qlang
> "" | lines
[]
```

Правило раздела не держит ни один case.

### case · core/test/conformance/QSTXT/pattern.jsonl:24

`{"name":"toRegex-refuses-flags-that-are-no-string","query":"\"a\" | toRegex 5 !| type","expect":"::string/toRegex/flags/KindNotTakenError"}`. Отказ на флаги другого рода сформулирован в QSTXT#match («flags of another kind are refused as `::string/toRegex/flags/KindNotTakenError`»), а QSTXT#pattern говорит только о флагах вызова:

```qlang
> "a" | toRegex 5 !| type
::string/toRegex/flags/KindNotTakenError
```

Case показывает правило QSTXT#match, а лежит под QSTXT#pattern.

### case · core/test/conformance/QSQUO/literal.jsonl:20

`{"name":"a-quote-holds-a-doc-under-the-tag-of-a-kind-as-written","query":"~(|~~ see ::number~(~(x)) ~~|) | print", …}`. Case проверяет, что документ сохраняет цитату со стеком тегов так, как её записал литерал. Это правило QSSLF#doc («each quote and its tags where it stands, written as its literal spelled it»). В QSQUO#literal такого правила нет: там сказано «the full form is the one the printer writes».

```qlang
> ~(|~~ see ::number~(~(x)) ~~|) | print
~(|~~ see ::number~(~(x)) ~~|)
```

Case показывает правило QSSLF#doc, а лежит под QSQUO#literal.
