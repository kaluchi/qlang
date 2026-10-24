# QSNUM · The verbs of numbers

Arithmetic over finite doubles, and the verbs that combine values of one
subject. The requirements of each section are the cases of its file
under `core/test/conformance/QSNUM/`.

## arithmetic

`add`, `sub`, `mul` and `div` take the number in the pipe as their
subject and one number as their input, computed against the subject;
`mod` answers the remainder with the sign of the divisor; `floor`,
`ceil` and `abs` take a number to a whole one or its size, and `round`
to the digits its call gives, a whole number, none where it gives none,
half away from zero as its digits are written, so a number below a half
rounds down, a negative count rounding to tens and beyond,
`15 | round -1` answering `20`, and a fraction refused as
`::number/round/digits/NotIntegerError`. An answer stands under the tags
the subject and the number given share, a bare one sharing any,
`::W#2.7 | floor` answering `::W#2` and `5 | add ::W#2` `::W#7`, and two
numbers under two tags are refused as the pair,
`::call/KindsMismatchedError` [QSDSP#answer]. A subject that is no number is
refused as `::number/add/SubjectNotNumberError` and an input that is no
number as `::number/add/addend/KindNotTakenError`. Every answer is a
finite double: one past the doubles is refused as
`::number/NotFiniteError` at the step that made it, whichever verb
computed it, its trace holding that step and the subject it ran on, and
one within them is given,
`1 | round 400` answering `1`, a division by zero under the divisor of
`div`, `::number/div/divisor/ZeroError`, and a remainder by zero under
that of `mod`, `::number/mod/divisor/ZeroError`. `range` answers the
whole numbers from zero below its subject, `[]` from zero and below, a
fraction refused by the invariant of its subject,
`::number/range/subject/NotIntegerError`, and a count past the length a
vector may have as `::number/range/CountTooLargeError`.

```qlang
> 10 | add 5 | mul 2 | sub 10
20

> get [~(7 | mod 3) ~(-7 | mod 3) ~(7 | mod -3)]
[1 2 -2]

> get [~(2.7 | floor) ~(2.1 | ceil) ~(-3 | abs) ~(2.567 | round 2)]
[2 3 3 2.57]

> get [~(::W#2.7 | floor) ~(5 | add ::W#2) ~(::Cents#1 | add ::Dollars#1 !| tag)]
[::W#2 ::W#7 ::call/KindsMismatchedError]

> 1e308 | mul 10 | add 1 !| get [~(tag) ~(trace | map ~failed) /trace/0/0]
[::number/NotFiniteError [~(mul 10)] 1e+308]

> get [~(1 | round 400) ~(1 | round -400)]
[1 0]

> 10 | div 0 !| tag
::number/div/divisor/ZeroError

> 5 | range
[0 1 2 3 4]
```

## combine

The subject of a call is the value in the pipe, always, and a call that
gives more args than the inputs of its verb read is refused as
`…/ArgsBeyondInputsError`, the page of its refusal naming what fits.
Values of one subject are combined by the verbs of one subject on
`::any`, each of the args a number or a path read against the subject:
`sumOf` and `mulOf` combine one value or more, `subOf` and `divOf` two,
under the tags the numbers share as the steps they run combine them
[QSDSP#answer], a call of `sumOf` that gives none refused as
`::any/sumOf/numbers/EmptyError` and one of `subOf` that gives one as
`::any/subOf/subtrahend/NotGivenError`.

```qlang
> 1 | add 1 2 !| get [~(tag) ~(explain | page | content | contains "sumOf")]
[::number/add/ArgsBeyondInputsError true]

> {:price 4 :qty 3} | mulOf /price /qty
12

> {:a 1} | get [~(sumOf !| tag) ~(subOf /a !| tag)]
[::any/sumOf/numbers/EmptyError ::any/subOf/subtrahend/NotGivenError]

> {:a ::Cents#5 :b ::Dollars#2} | get [~(sumOf (get /a) (get /b) !| tag) ~(mulOf (get /a) 3)]
[::call/KindsMismatchedError ::Cents#15]
```
