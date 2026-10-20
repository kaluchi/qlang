# QSTXT · Text and regexes

The verbs of strings and the regex, a value that reads text. The
requirements of each section are the cases of its file under
`core/test/conformance/QSTXT/`.

## string

A string counts, by `count`, `size` and `length` alike, takes and drops
by its code points, a letter of any script, an emoji and a combining mark
each one. `trim` answers it
without the whitespace at its two ends, `lower` and `upper` fold its
case as Unicode maps the text, a letter to two where it writes two and a
sigma at the end of a word to its final form, and `lines` cuts it at `\n`
and `\r\n`, a line break at the end closing the last line and the empty
string holding none. `append` and `prepend` write a text at one end, a
keyword written as its name. A verb of strings that holds its name alone
refuses a subject of another kind under its own address,
`::string/lower/SubjectNotStringError`, and a name strings share with
another kind, `append`, `prepend`, `count`, `take`, `drop` and `contains`
among them, is refused by the call, `::call/KindAnswersNoVerbError`,
with the addresses of its verbs.

```qlang
> "привет" | count
6

> "abc" | length
3

> "db_host" | drop 3
"host"

> "Ann@Example.COM" | lower
"ann@example.com"

> get [~("ΣΑΣ" | lower) ~("straße" | upper)]
["σας" "STRASSE"]

> "x" | append :a
"xa"

> "a\nb\nc" | lines
["a" "b" "c"]

> get [~(42 | lower !| type) ~(42 | take 2 !| get [~(type) /addresses])]
[::string/lower/SubjectNotStringError [::call/KindAnswersNoVerbError #[::map/take ::string/take ::vec/take]]]
```

## search

`contains`, `startsWith` and `endsWith` ask a string for a text, case
and all, a regex for `contains` among them [QSTXT#match], and the
empty text stands in every string; a verb that reads text refuses a
keyword for its text. `contains` asks a vector for an element, a path
among them, which `has` reads as the path it is, and a set answers it by
the verb of vectors; a subject of no kind its verbs serve is refused by
the call with their addresses.

```qlang
> "Hello" | contains "hello"
false

> ["ops" "db"] | contains "ops"
true

> "anything" | startsWith ""
true

> "abc" | contains :a !| type
::string/contains/needle/KindNotTakenError

> get [~(42 | contains "x" !| get [~(type) /addresses]) ~(#[1 2] | binding :contains | get /name)]
[[::call/KindAnswersNoVerbError #[::string/contains ::vec/contains]] :vec/contains]
```

## split

`split` cuts a string at every occurrence of a text or every match of a
regex, the pieces between them alone, the empty text cutting at every
code point; a separator at an end or two together leave empty pieces, so
`split` and `join` round-trip by one separator string. `join` writes the
elements of a vector, or of a set in its order, between a separator, a
keyword written as its name; an element that is no string or keyword is
refused at its index, the place of the step's frame naming it
[QSERR#trace].

```qlang
> "a,,b" | split ","
["a" "" "b"]

> "a,b,c" | split "," | join ";"
"a;b;c"

> ["a" 42] | join "," !| get [~(type) ~(trace | last | place)]
[::vec/join/ElementNotStringOrKeywordError /1]
```

## regex

A regex is a value of the kind `::regex`, written `#"\d+ms"`: what stands
between the quotes reaches the engine as written, a backslash with the
character after it, save `\"`, a quote that does not end the literal,
which reaches it as the quote alone. The flags `i`, `m` and `s` may
follow the closing quote, each once, and print in that order; the regex
reads text by code points as Unicode does. The dialect is ECMAScript's of
2018: a group of flags and a group name written twice are refused. A
source that is no regex is refused by the parser with the reason, and the
repair of another dialect's habit where the source shows one: flags
written inside, or a backslash before a character that needs none; a
failure to parse names a character and a flag of a regex among the
continuations of the reading. A regex prints as its literal and reads
back, JSON writing that literal as a string, and two are equal when their
text and flags are. `toRegex` reads a string as the source of a regex,
and a regex by its source, each with the flags its call gives in the
place of its own, a regex keeping its own and a string taking none where
the call gives none or null. A regex whose matching backtracks without
end runs as long as its matching does.

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

`contains`, `split` and `replace` take a regex or a text, told apart by
its kind, `replace` naming what it seeks `:needle` as `contains` does;
`match`, `capture` and `scan` take a regex alone, their input `:regex`,
refusing a text as `::string/match/regex/KindNotTakenError`. `contains`
asks for a match anywhere, `^` and `$` asking it of the whole, or of each
line under the flag `m`; `match` answers the first match as the vector of
its text and groups, a group that took no part `null`, or null where none
stands; `capture` the named groups of the first match as a map, or null,
refusing a regex that names no group as
`::string/capture/RegexNamesNoGroupError`; `scan` the text of every
match, an empty match met before every code point and at the end, `[]`
where none stands. `replace` puts a text, or what code answers on each
match's vector, in the place of every match, read by code points: the
string that replaces a match of a regex names the parts of the match by
`$1`, `$<name>`, `$&`, the text before and after it by `` $` `` and `$'`,
and a dollar by `$$`, a group the regex lacks standing as written, but
for two digits whose first names a group, `$10` read as `$1` and `0`, as
ECMAScript reads it; it stands as written where a text is replaced; and
code that answers no string is refused as
`::string/replace/with/AnswerNotStringError`. `toRegex` reads a string as
the source of a regex, its input `flags` a string the call gives: a
string that writes no regex the engine reads is refused as
`::string/toRegex/TextNotRegexError` with the engine's reason and, where
the source shows another dialect's habit, its repair, a needless
backslash or flags written inside, `toRegex "i"`; flags of another kind
are refused as `::string/toRegex/flags/KindNotTakenError` and letters of
no flag as `::string/toRegex/flags/NotFlagsError`; and a string that
writes a whole literal is refused as
`::string/toRegex/LiteralNotSourceError`, the literal read by
`parse | open`.

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

> get [~(::string/match | binding | get /value | inputs | map ~(get /name)) ~(::string/replace | binding | get /value | inputs | map ~(get /name)) ~("abc" | match "a" !| type) ~("a1" | capture #"(\d)" !| type) ~("(" | toRegex !| type)]
[[:regex] [:needle :with] ::string/match/regex/KindNotTakenError ::string/capture/RegexNamesNoGroupError ::string/toRegex/TextNotRegexError]
```
