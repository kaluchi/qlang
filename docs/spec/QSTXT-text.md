# QSTXT · Text and patterns

The words of strings and the pattern, a value that reads text. The
requirements of each section are the cases of its file under
`core/test/conformance/QSTXT/`.

## string

A string counts, takes and drops by its characters, a letter of any
script one. `trim` answers it without the whitespace at its two ends,
`lower` and `upper` fold its case letter by letter as Unicode maps it,
and `lines` reads it as the vector of its lines. `append` and `prepend`
write a text at one end, a keyword written as its name; a word of
strings refuses a subject of another kind.

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
and all, and the empty text stands in every string. `contains` asks a
vector and a set for an element, as `has` does; a value of no kind it
serves is refused with the addresses that serve it.

```qlang
> "Hello" | contains "hello"
false

> ["ops" "db"] | contains "ops"
true

> "anything" | startsWith ""
true
```

## split

`split` cuts a string at every occurrence of a text or every match of a
pattern, the pieces between them alone; a separator at an end or two
together leave empty pieces, so `split` and `join` by one separator
round-trip. `join` writes the strings of a vector between a separator, a
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
string, and two are equal when their text and flags are. A pattern whose
matching backtracks without end runs as long: the language bounds no
match.

```qlang
> #"\d+ms" | type
::regex

> [#"\d+ms" #"a"mi] | map ~print
["#\"\\d+ms\"" "#\"a\"im"]

> "#\"(?i)a\"" | parse !| get /message | contains "the flags follow"
true
```

## match

A word that reads text tells a pattern from a text by its kind.
`contains` asks for a match anywhere, `^` and `$` asking it of the whole;
`match` answers the first match as the vector of its text and groups, or
null; `capture` the named groups of the first match as a map, or null,
refusing a pattern that names no group; `scan` the text of every match;
`replace` puts a text, or what code answers on each match's vector, in
the place of every match; `toRegex` reads a string as the source of a
pattern, its flags the call's.

```qlang
> "v1.20 and v3.4" | match #"v(\d+)\.(\d+)"
["v1.20" "1" "20"]

> "2026-10-12 ERROR down" | capture #"(?<date>\S+) (?<level>\w+)"
{:date "2026-10-12" :level "ERROR"}

> "took 12ms, then 7ms" | scan #"\d+"
["12" "7"]

> "error" | toRegex "mi"
#"error"im
```
