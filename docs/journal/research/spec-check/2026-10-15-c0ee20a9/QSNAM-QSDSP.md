<!-- A check of the chapters of qlang by a clean Opus: `claude -p --model opus`, started from an empty directory with `--restricted` and `--strict-mcp-config`, its tools named by `--tools Read Grep Glob Bash`, the tree let in by `--add-dir D:/git/qlang` and reading, `qlang`, `grep` and `git ls-files` allowed by `--allowedTools`, no CLAUDE.md, no memory and no MCP server, without the `FORCE_COLOR` of the session, reading the tree at c0ee20a9 and checking docs/spec/QSNAM-names-and-scope.md and docs/spec/QSDSP-a-word-found-through-its-subject.md, on 2026-10-15 from 11:10 to 11:23 UTC. Its prompt is `scripts/spec-check-prompt.txt` at c0ee20a9. -->

### design · QSNAM#scope

В главе: «A value the reader bound to a bare name stands outside it, a bare step of that name refused as `::call/UnknownNameError` while `env` reads it [QSNAM#owner]». QSQUO#held говорит о коде, хранимом как данные: «A value that scope names is withheld: read by a step, by a tag or as the noun of a declaration, it is refused under its name as `::call/ValueWithheldError`». Здесь одна и та же цитата `~(mul n)` читает значение читателя, а два пути отвечают по-разному.

```qlang
> :n 3 | :number/times ~(mul n) | 5 | times !| get [~(type) /name /nearest]
[::call/UnknownNameError :n [::fn :in :ne :on]]

> :n 3 | :times ~(mul n) | 5 | apply times !| get [~(type) /name]
[::call/ValueWithheldError :n]

> :x 1 | :any/r ~(::x | binding | get /value) | r
1

> :x 1 | :q ~(::x | binding | get /value) | apply q !| get [~(type) /name]
[::call/ValueWithheldError :x]

> :x 1 | :any/r ~(env | has :x) | r
true

> :x 1 | :q ~(env | has :x) | apply q
false
```

Тело слова и цитата, хранимая в имени, расходятся на одном вопросе: какое значение читателя видно коду, который пишет не шаг. Тело слова отвечает «такого имени нет», причём `:nearest` не называет `n`, но читает значение как данные через `binding` и `env`. Хранимая цитата называет имя удержанным и не даёт ни того, ни другого. Каким должен быть один ответ на «код вне шага читает значение читателя»?

### design · QSDSP#residence

В главе: «A word is called by its name or by its address, which checks the subject by that residence; a set, a quote and a doc are vectors to a word of vectors, each answered back as its own kind». QSORD#set и QSCOL#sequence говорят иначе: «a vector where it answers an order of its own, `sort` and `reverse`» и «the reverse of a set a vector».

```qlang
> #[3 1 2] | reverse
[3 2 1]

> #[3 1 2] | vec/reverse
#[1 2 3]

> #[1 2 3] | sort ~(desc)
[3 2 1]

> #[1 2 3] | vec/sort ~(desc)
#[1 2 3]
```

Вызов по имени и вызов по адресу дают для одного множества разные ответы. Через адрес ответ снова кладётся под `::set` и переупорядочивается, так что порядок, который слово и вычисляло, молча теряется. Каким должен быть согласованный ответ слова векторов на множество, вызванного по адресу?

### design · QSDSP#tagname

В главе: «a word of the noun's values refuses a tag name under the word». QSSLF#axis: «a label may declare a `doc` of its own, which its values answer before the word of every value» и «a name by its tag, … `::vec/count | doc`, a label of the root from the root». QSNAM#owner: «a word a reader declared under it answers the reader's own calls».

```qlang
> :Box |~~ B ~~| | :Box/doc ~("box page") | get [~(::Box{} | doc) ~(::Box | doc !| type)]
["box page" ::Box/doc/SubjectNotBoxError]

> :vec/doc ~("a reader page") | ::vec | doc !| type
::vec/doc/SubjectNotVecError
```

Каждое правило верно само по себе, но вместе выходит вот что: стоит метке объявить для своих значений собственный `doc` (и так же любую другую ось), как страницу самой метки уже не прочитать по её тегу. С `::vec` это касается и метки корня, хотя по QSSLF#axis её страница читается из корня. Что должен отвечать `::Box | doc` после `:Box/doc`?

### conflict · QSNAM#address

В главе: «The value says what the node is: a page or a kind makes a label, a function or a quote under a label a word … Written as a step, an address reads what it declared, a word run and any other value itself». QSHST#source: «A `::builtin{}` written in the recipe of a word a reader declares is the value it is: the word's address answers its function as a value, and its bare name reaches no word».

```qlang
> :vec/f (::fn | impl ::builtin{}) | [1] | vec/f | type
::fn

> :vec/f (::fn | impl ::builtin{}) | [1] | f !| type
::call/UnknownNameError

> :vec/f (::fn | takes :n |~~ n ~~| /0) | [1] | vec/f !| type
::fn[~(takes :n |~~ n ~~| /0) null]

> :f (::fn | takes :n |~~ n ~~| /0) | [1] | apply f [1] !| type
::fn/RecipeMissingError
```

QSNAM#address считает любую функцию под меткой словом, а QSHST#source и дерево — нет: функция с рецептом хоста и функция совсем без рецепта остаются данными. Через `apply` та же функция без рецепта отказывает с `::fn/RecipeMissingError`.

### design · QSDSP#walk

В главе: «`is` answers whether the walk of a value's tags reaches a value of one of the kinds it is given … so `::vec | is ::vec` is false». В той же главе, в QSDSP#tagname: «A tag name in the subject position walks the kind of tag names, then the noun the tag names, then `::any`».

```qlang
> get [~(::vec | is ::vec) ~(::vec | count !| type)]
[false ::vec/count/SubjectNotVecError]
```

Вопрос «доходит ли обход `::vec` до `::vec`» получает два ответа. `is` говорит «нет», а диспетчеризация доходит до `::vec/count` и отказывает под его адресом. Какой из двух обходов есть обход имени тега?

### design · QSNAM#address

В главе: «a function or a quote under a label a word, any other value data». QSPTH#code и QSQUO#modifier: «An input that takes code takes a quote or a path»; QSNAM#value: «a quote or a path under it goes bare into an input that takes code».

```qlang
> :p /a | [{:a 1}] | map p
[1]

> :map/q ~(get /a) | {:a 1} | q
1

> :map/p /a | {:a 1} | p !| type
::call/UnknownNameError
```

Везде в языке путь и цитата — две формы кода, и под голым именем они так и работают. Под меткой же цитата становится словом, а путь — данными, и голое имя его не достаёт. Должен ли путь под меткой отвечать так же, как цитата?

### text · QSDSP#refusal

В главе: «is refused as `::call/KindAnswersNoVerbError`, with the name as `:name`, the subject's outermost tag as `:actualType`, the addresses … as `:addresses`, and, where …, `:nearest`». При этом закон страницы `::call/KindAnswersNoVerbError` `:namesTheReadOfAPath` и QSPTH#words требуют у этого отказа ещё один факт, `:read`.

```qlang
> /tags | count !| entries | map ~first
[:name :addresses :read :actualType :trail]

> /tags | count !| get /read
~(get /tags | count)
```

Перечень фактов в разделе не включает `:read`, хотя его держат страница отказа, её закон и QSPTH#words.

### case · QSNAM#scope

В главе: «a declaration the fail track passed by counts, and so does one whose body failed, so a recovery after `!|` declares another name». В `scope.jsonl` есть кейс только на пропущенное объявление (`a-declaration-the-fail-track-skipped-counts-as-written`). Кейса на объявление, тело которого упало, нет ни в одном файле: оба кейса `QSERR/flow.jsonl` (`a-declaration-whose-body-fails-…`) проверяют, что имя не связано, а не то, что оно засчитано.

```qlang
> :x (1 | div 0) !| :x 2 | x !| type
::bind/NameDeclaredTwiceError

> :x (1 | div 0) !| env | has :x
false
```

Правило «упавшее тело тоже засчитывается» не держит ни один кейс.

### case · QSNAM#letters

В главе: «begins with a letter of any script or `_` and goes on with letters, digits, `_` and `-`, and a tag is written in the same letters, while a key of a path may begin with a digit or `-` as well, `/1a`», а также «the parser refusing a step `false/x`». В `letters.jsonl` 7 кейсов: имя в кавычках, слово литерала и его метка. Ни один не объявляет и не вызывает имя другой письменности, имя с `_` в начале или с `-`, не проверяет, что тег отказывает в имени с цифры, и не держит `/1a` или отказ шагу `false/x`.

```qlang
> :имя 5 | имя
5

> :_x 1 | _x
1

> :a-b 1 | a-b
1

> "false/x" | parse !| type
::quote/ParseError

> {"1a": 1} | get /1a
1
```

Эти правила раздела показывают только пробы главы, кейса на них нет.

### case · QSNAM#declare

В главе: «a word after a keyword or a tag name is a step of its own, joined by a combinator». В `declare.jsonl` такого кейса нет. Единственный близкий кейс, `QSSYN/step.jsonl` `a-word-after-a-literal-step`, проверяет `1 2`, а не тело объявления.

```qlang
> ":s ::vec it" | parse !| get /message
steps are joined by `|`: write `a | b`
```

Правило о слове после ключевого слова или имени тега в теле объявления не держит ни один кейс.
