# QSTXT · Text and patterns

The words of strings and the pattern, a value that reads text. The
requirements of each section are the cases of its file under
`core/test/conformance/QSTXT/`.

## string

A string counts, takes and drops by its code points, a letter of any
script, an emoji and a combining mark each one. `trim` answers it
without the whitespace at its two ends, `lower` and `upper` fold its
case letter by letter as Unicode maps it, and `lines` cuts it at `\n`
and `\r\n`, a line break at the end closing the last line and the empty
string holding none. `append` and `prepend` write a text at one end, a
keyword written as its name. A word only strings answer refuses a
subject of another kind under its own address,
`::string/lower/SubjectNotStringError`, and a name strings share with
another kind, `append`, as `::call/KindAnswersNoVerbError` with the
addresses of its words.

```qlang
> "привет" | count
6

> "db_host" | drop 3
"host"

> "Ann@Example.COM" | lower
"ann@example.com"

> "x" | append :a
"xa"

> "a\nb\nc" | lines
["a" "b" "c"]
```

## search

`contains`, `startsWith` and `endsWith` ask a string for a text, case
and all, a pattern for `contains` among them [QSTXT#match], and the
empty text stands in every string; a word that reads text refuses a
keyword for its text. `contains` asks a vector and a set for an element,
as `has` does; a value of no kind it serves is refused with the
addresses that serve it.

```qlang
> "Hello" | contains "hello"
false

> ["ops" "db"] | contains "ops"
true

> "anything" | startsWith ""
true

> "abc" | contains :a !| type
::string/contains/needle/KindNotTakenError
```

## split

`split` cuts a string at every occurrence of a text or every match of a
pattern, the pieces between them alone, the empty text cutting at every
code point; a separator at an end or two together leave empty pieces, so
`split` and `join` by one separator round-trip. `join` writes the
elements of a vector, or of a set in its order, between a separator, a
keyword written as its name; an element that is no string or keyword is
refused at its index.

```qlang
> "a,,b" | split ","
["a" "" "b"]

> "a,b,c" | split "," | join ";"
"a;b;c"

> ["a" 42] | join "," !| type
::vec/join/ElementNotStringOrKeywordError
```

## pattern

A pattern of text is a value of the kind `::regex`, written `#"\d+ms"`:
what stands between the quotes reaches the engine as written, a
backslash with the character after it, so `\"` is a quote that does not
end the literal. The flags `i`, `m` and `s` may follow the closing
quote, each once, and print in that order; the pattern reads text by
code points as Unicode does. The dialect is ECMAScript's of 2018: a
group of flags and a group name written twice are refused. A source that
is no pattern is refused by the parser with the reason, and the repair
of another dialect's habit where the source shows one: flags written
inside, or a backslash before a character that needs none. A pattern
prints as its literal and reads back, JSON writing that literal as a
string, and two are equal when their text and flags are. `toRegex` reads
a string as a pattern and answers a pattern as its source, each with the
flags its call gives in the place of its own. A pattern whose
matching backtracks without end runs as long as its matching does.

```qlang
> #"\d+ms" | type
::regex

> [#"\d+ms" #"a"mi] | map ~print
["#\"\\d+ms\"" "#\"a\"im"]

> "#\"(?i)a\"" | parse !| get /message | contains "the flags follow"
true

> #"a"m | toRegex "i"
#"a"i
```

## match

`contains`, `split` and `replace` tell a pattern from a text by its kind;
`match`, `capture` and `scan` take a pattern alone, refusing a text as
`::string/match/pattern/KindNotTakenError`. `contains` asks for a match
anywhere, `^` and `$` asking it of the whole; `match` answers the first
match as the vector of its text and groups, a group that took no part
`null`, or null where none stands; `capture` the named groups of the
first match as a map, or null, refusing a pattern that names no group;
`scan` the text of every match, an empty match met at every place, `[]`
where none stands. `replace` puts a text, or what code answers on each
match's vector, in the place of every match, read by code points: a
replacement string of a pattern names the parts of a match by `$1`,
`$<name>`, `$&`, the text before and after it by `` $` `` and `$'`, and
a dollar by `$$`, a group the pattern lacks standing as written; it
stands as written where a text is replaced; and code that answers no
string is refused as `::string/replace/with/AnswerNotStringError`.
`toRegex` reads a string as the source of a pattern, its flags a string
the call gives: a source the engine cannot read is refused with the
engine's reason and, where the source shows another dialect's habit, its
repair, a needless backslash or flags written inside, `toRegex "i"`;
flags of another kind are refused as
`::string/toRegex/flags/KindNotTakenError` and letters of no flag as
`::string/toRegex/flags/NotFlagsError`; and a string that writes a whole
literal is refused as `::string/toRegex/LiteralNotSourceError`, the
literal read by `parse | apply it`.

```qlang
> "v1.20 and v3.4" | match #"v(\d+)\.(\d+)"
["v1.20" "1" "20"]

> "2026-10-12 ERROR down" | capture #"(?<date>\S+) (?<level>\w+)"
{:date "2026-10-12" :level "ERROR"}

> "took 12ms, then 7ms" | scan #"\d+"
["12" "7"]

> "a" | match #"(b)?a"
["a" null]

> "error" | toRegex "mi"
#"error"im
```
